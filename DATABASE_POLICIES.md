# FUSION-ONE — Database Policies

> Source of truth: [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql),
> sections 2, 3, 4, 5, 6.

This document is the complete listing of every Row Level Security (RLS)
policy and every Storage policy declared by the FUSION-ONE bootstrap,
together with the security model that ties them together.

It is paired with:

* [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md) for the
  high-level ownership model.
* [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md) for the
  `is_owner()` function that most policies call.
* [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) for the mock user
  used to exercise these policies during development.

---

## 1. Security Model Overview

### 1.1 Goals

The security model has three explicit goals:

1. **Tenant isolation by user.** One authenticated user must never see
   another user's data, even if both users share the same Supabase
   project.
2. **No anonymous access.** Unauthenticated requests must read no
   business data and write nothing.
3. **Server-side trust boundary.** A service-role client (used by
   server-only API routes) is allowed to bypass RLS entirely for
   cross-tenant operations. The boundary is enforced at the import
   level — see [`platform/supabase/admin.ts`](./platform/supabase/admin.ts).

### 1.2 Roles in play

Supabase assigns one of three Postgres roles to every request:

| Role             | Assigned when                                             | Can do what                                                       |
|------------------|-----------------------------------------------------------|-------------------------------------------------------------------|
| `anon`           | No JWT, or JWT signature invalid                          | Nothing on any business table (no policies target `anon`).        |
| `authenticated`  | Valid user JWT present                                    | Whatever the `Owner Access` policy permits — i.e. their own data. |
| `service_role`   | Request carries the project's `SUPABASE_SERVICE_ROLE_KEY` | Anything — RLS is bypassed entirely.                              |

The bootstrap's policies target only the `authenticated` role. The
`anon` role has zero policies on every business table, so anonymous
requests are silently filtered out: `SELECT` returns zero rows,
`INSERT`/`UPDATE`/`DELETE` are rejected.

### 1.3 The two ownership patterns

There are exactly two ways a policy decides whether the calling user
can touch a row:

#### Pattern A — Direct owner check

Used by `store` and `whatsapp_settings` because those are the two
tables whose rows literally contain `owner_user_id`:

```sql
USING (owner_user_id = auth.uid())
WITH CHECK (owner_user_id = auth.uid())
```

#### Pattern B — Indirect owner check via `is_owner()`

Used by every other business table, because they have no `owner_user_id`
column of their own. Their rows are owned *transitively* through the
single `store` row owned by the calling user:

```sql
USING (is_owner())
WITH CHECK (is_owner())
```

`is_owner()` is defined as:

```sql
CREATE OR REPLACE FUNCTION is_owner()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM store WHERE owner_user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

See [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md) for why
`SECURITY DEFINER` is essential here.

### 1.4 `USING` vs `WITH CHECK`

Every `FOR ALL` policy declares both:

* **`USING`** — applied to rows being read or deleted/updated. If
  `USING` returns `false` for a row, that row is invisible to
  `SELECT` and unmodifiable.
* **`WITH CHECK`** — applied to rows being inserted or updated. If
  `WITH CHECK` returns `false`, the write is rejected.

For FUSION-ONE both expressions are identical (`is_owner()` or
`owner_user_id = auth.uid()`). This means:

* A user can read every row their store owns.
* A user can insert any row (subject to the check) — the database
  does not enforce that the row's foreign keys point at rows owned
  by the same user. This is intentional: it would be expensive to
  chain `is_owner()` checks through every FK, and the application
  layer already ensures every inserted row's FKs are owned.
* A user can update or delete any row they can read.

### 1.5 What RLS does NOT enforce

* **No FK ownership chaining.** Inserting a `sale_items` row that
  points at another store's `inventory_items` row would pass RLS,
  because the `sale_items` policy only checks `is_owner()`, not
  the owner of the referenced inventory item. The application layer
  is responsible for ensuring cross-store FK references never occur.
* **No row-level uniqueness across users.** Two stores can have the
  same `bill_number` — there is no global uniqueness constraint, and
  RLS would not interfere with one if added.
* **No rate limiting or query budgeting.** RLS does not throttle
  reads; that's Supabase's API gateway's job.

---

## 2. RLS Enablement

Before any policy can take effect, RLS must be enabled on each table.
The bootstrap enables it on every business table:

```sql
ALTER TABLE financial_years       ENABLE ROW LEVEL SECURITY;
ALTER TABLE store                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties                ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE trade_ins              ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_in            ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments_out            ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_fund_entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_transfers       ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE proforma_trade_ins      ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_settings      ENABLE ROW LEVEL SECURITY;
```

Once enabled, the table becomes invisible to `anon` (because no
policy targets `anon`) and is governed by the policies defined below
for `authenticated`.

---

## 3. RLS Policies — Direct Owner Check

### 3.1 `store`

```sql
CREATE POLICY "Store Owner Access" ON store
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
```

| Aspect                  | Value                                                  |
|-------------------------|--------------------------------------------------------|
| Policy name             | `Store Owner Access`                                  |
| Target table            | `store`                                                |
| Command                  | `FOR ALL` (covers SELECT, INSERT, UPDATE, DELETE)     |
| Role                     | `authenticated`                                       |
| `USING` expression       | `owner_user_id = auth.uid()`                          |
| `WITH CHECK` expression  | `owner_user_id = auth.uid()`                          |

**Effect**:
* A user can `SELECT` only their own store row.
* A user can `INSERT` a store row only if they set `owner_user_id`
  to their own `auth.uid()`.
* A user can `UPDATE` only their own store row.
* A user can `DELETE` only their own store row (the application
  never does this — store rows are never deleted).

**Why direct instead of `is_owner()`?**
`is_owner()` reads from `store`. Using `is_owner()` on `store` would
be a circular check. The direct `owner_user_id = auth.uid()` is the
anchor that bootstraps the entire ownership model.

### 3.2 `whatsapp_settings`

```sql
CREATE POLICY "whatsapp_settings_owner" ON whatsapp_settings
  FOR ALL TO authenticated
  USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());
```

| Aspect                  | Value                                                  |
|-------------------------|--------------------------------------------------------|
| Policy name             | `whatsapp_settings_owner`                              |
| Target table            | `whatsapp_settings`                                    |
| Command                  | `FOR ALL`                                             |
| Role                     | `authenticated`                                       |
| `USING` expression       | `owner_user_id = auth.uid()`                          |
| `WITH CHECK` expression  | `owner_user_id = auth.uid()`                          |

**Effect**:
* Each user can read, write, update, delete only their own
  settings row (the `UNIQUE` constraint on `owner_user_id`
  guarantees at most one row per user).
* The `owner_user_id` FK to `auth.users(id)` ensures the row
  cannot point at a non-existent user.

**Why direct instead of `is_owner()`?**
Two reasons:
1. `whatsapp_settings.owner_user_id` is a real FK to `auth.users`,
   unlike `store.owner_user_id` which has no FK. This makes the
   direct check trivially correct.
2. `whatsapp_settings` is conceptually per-user, not per-store.
   Using `is_owner()` would tie it to the store, but the table is
   seeded before any store exists (in the seed script) — using the
   direct check avoids ordering issues.

---

## 4. RLS Policies — Indirect Owner Check via `is_owner()`

The following 18 tables all share the identical policy shape. For
brevity, the policy body is shown once here and applies verbatim to
every table in the list:

```sql
CREATE POLICY "Owner Access" ON <table>
  FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());
```

| Aspect                  | Value                                                  |
|-------------------------|--------------------------------------------------------|
| Policy name             | `Owner Access` (same name on every table — names are   |
|                         | scoped per table, so this is allowed)                  |
| Command                  | `FOR ALL`                                              |
| Role                     | `authenticated`                                       |
| `USING` expression       | `is_owner()`                                          |
| `WITH CHECK` expression  | `is_owner()`                                          |

### 4.1 Tables using this policy

| #  | Table                       | Group              |
|----|-----------------------------|--------------------|
| 1  | `financial_years`           | Setup / config     |
| 2  | `bank_accounts`              | Banking            |
| 3  | `payment_modes`              | Banking            |
| 4  | `parties`                    | People             |
| 5  | `inventory_items`            | Inventory          |
| 6  | `purchases`                  | Purchases          |
| 7  | `purchase_items`             | Purchases          |
| 8  | `sales`                      | Sales              |
| 9  | `sale_items`                 | Sales              |
| 10 | `trade_ins`                  | Sales              |
| 11 | `payments_in`                | Payments           |
| 12 | `payments_out`               | Payments           |
| 13 | `account_transactions`       | Ledger             |
| 14 | `account_fund_entries`       | Ledger             |
| 15 | `account_transfers`           | Ledger             |
| 16 | `proforma_invoices`          | Proforma           |
| 17 | `proforma_invoice_items`     | Proforma           |
| 18 | `proforma_trade_ins`         | Proforma           |

### 4.2 Why `is_owner()` instead of per-table FK?

None of these tables have a direct `owner_user_id` column. They are
all owned transitively through the `store` row. Adding a denormalised
`owner_user_id` column to each table would:

* Bloat every row by 16 bytes.
* Require triggers to keep the column in sync with `store.owner_user_id`.
* Add a maintenance burden every time a new table is added.

Using a `SECURITY DEFINER` function that reads `store` on demand is
cheaper (one index lookup per row evaluation) and keeps the schema
clean.

### 4.3 Why `FOR ALL` instead of separate per-command policies?

A single `FOR ALL` policy with both `USING` and `WITH CHECK` set to
`is_owner()` covers SELECT, INSERT, UPDATE, DELETE in one declaration.
This is more compact than four separate policies and ensures the
ownership invariant cannot drift between commands (e.g. if a future
migration added an INSERT-only policy with a looser check, it would
silently widen access).

### 4.4 Concrete effect per command

For every table in 4.1, the policy means:

* **SELECT** — the user sees every row whose owner is their store
  (because `is_owner()` is `true` for them; the function does not
  depend on the row being inspected, so the same answer applies to
  every row).
* **INSERT** — the user can insert any row, provided `is_owner()`
  is `true` at insert time. The row's own columns are not inspected
  by the policy, but FK constraints still apply (e.g. inserting a
  `sale` with a non-existent `party_id` still fails).
* **UPDATE** — the user can update any row they can SELECT. The
  `WITH CHECK` re-runs `is_owner()` after the update; since the
  function doesn't depend on row contents, this is always satisfied
  for the same user.
* **DELETE** — the user can delete any row they can SELECT. Cascade
  deletes (e.g. `purchase_items` when a `purchases` row is deleted)
  are not re-checked against the policy, because cascade deletes
  run as the table owner, not as the calling user.

---

## 5. Storage Buckets

The bootstrap creates two public storage buckets:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('store_assets', 'store_assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;
```

| Bucket         | Public | Intended contents                                                              |
|----------------|--------|--------------------------------------------------------------------------------|
| `store_assets` | `true` | Store logo and signature image — referenced by `store.logo_url`, `store.signature_url`. |
| `documents`    | `true` | Trade-in documents and other file uploads — referenced by `trade_ins.document_url`.   |

`ON CONFLICT (id) DO NOTHING` makes the bucket creation idempotent —
re-running the bootstrap does not fail if the buckets already exist.

### 5.1 Why public read?

Both buckets are flagged `public = true`, which means anyone with
the object's URL can `GET` it without authentication. This is
required by the WhatsApp delivery pipeline: when an invoice is
rendered to PNG/PDF and uploaded, the resulting URL is sent in a
WhatsApp message and must be fetchable by the WhatsApp servers
(which do not carry the user's JWT).

The obscurity of the Supabase storage object path
(`https://<project>.supabase.in/storage/v1/object/public/<bucket>/<random-uuid>/<filename>`)
provides practical access control — the random UUID is not guessable.

### 5.2 Why no per-user folder isolation?

The current storage policies (section 6 below) do not check that the
uploading user owns the object they're overwriting or deleting.
Any authenticated user can read, write, update, or delete any
object in either bucket. This is acceptable for the current
single-tenant-per-deployment model (each Supabase project hosts one
store), but would need tightening if multiple stores ever shared one
project. The standard Supabase pattern for multi-tenant storage is:

```sql
-- Example (NOT in the bootstrap):
CREATE POLICY "user_own_folder" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
```

This pattern is intentionally **not** adopted in FUSION-ONE because
the application stores uploaded file paths directly in
`store.logo_url` / `trade_ins.document_url` without an
`auth.uid()`-prefixed folder layout. Adopting folder-name isolation
would require a migration of every existing URL.

---

## 6. Storage Policies

For each bucket, four policies are declared on `storage.objects`:
one per DML command (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). All
target the `authenticated` role and filter on `bucket_id`.

### 6.1 `store_assets` bucket

```sql
CREATE POLICY "store_assets_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'store_assets');

CREATE POLICY "store_assets_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'store_assets');

CREATE POLICY "store_assets_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'store_assets');

CREATE POLICY "store_assets_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'store_assets');
```

| Policy                   | Command  | Role            | `USING` / `WITH CHECK`              |
|--------------------------|----------|-----------------|--------------------------------------|
| `store_assets_read`      | SELECT   | `authenticated` | `USING (bucket_id = 'store_assets')` |
| `store_assets_write`     | INSERT   | `authenticated` | `WITH CHECK (bucket_id = 'store_assets')` |
| `store_assets_update`    | UPDATE   | `authenticated` | `USING (bucket_id = 'store_assets')` |
| `store_assets_delete`    | DELETE   | `authenticated` | `USING (bucket_id = 'store_assets')` |

### 6.2 `documents` bucket

```sql
CREATE POLICY "documents_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

CREATE POLICY "documents_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'documents');

CREATE POLICY "documents_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
```

| Policy                | Command  | Role            | `USING` / `WITH CHECK`              |
|-----------------------|----------|-----------------|--------------------------------------|
| `documents_read`      | SELECT   | `authenticated` | `USING (bucket_id = 'documents')`   |
| `documents_write`     | INSERT   | `authenticated` | `WITH CHECK (bucket_id = 'documents')` |
| `documents_update`    | UPDATE   | `authenticated` | `USING (bucket_id = 'documents')`  |
| `documents_delete`    | DELETE   | `authenticated` | `USING (bucket_id = 'documents')`  |

### 6.3 Why four policies per bucket?

Storage policies on `storage.objects` are evaluated per command,
and Postgres requires one policy per command. Unlike business-table
policies, you cannot use `FOR ALL` on `storage.objects` because
the storage layer needs to evaluate `USING` for reads and `WITH
CHECK` for writes separately, and Supabase's storage integration
does not support a single combined policy.

### 6.4 Why `WITH CHECK` for INSERT but `USING` for everything else?

* **SELECT** — needs `USING` to filter which existing rows are
  visible.
* **INSERT** — there is no existing row to filter against, so
  `USING` is meaningless. `WITH CHECK` validates the row being
  inserted (here, that its `bucket_id` is the allowed value).
* **UPDATE** — needs both: `USING` to filter what can be updated,
  and (optionally) `WITH CHECK` to validate the updated row. The
  bootstrap declares only `USING` for UPDATE, which means the row
  must currently be in the right bucket to be updatable, but the
  update itself can change `bucket_id` to anything (in practice
  the application never does this).
* **DELETE** — needs `USING` to filter what can be deleted. There
  is no `WITH CHECK` for DELETE because nothing is being written.

---

## 7. Trust Boundaries Summary

The diagram below summarises who can do what.

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Supabase Project                            │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ anon role                                                      │  │
│   │   → No policies on any business table                          │  │
│   │   → No policies on storage.objects                              │  │
│   │   → Cannot read, write, or delete anything                     │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ authenticated role                                             │  │
│   │   → Can SELECT/INSERT/UPDATE/DELETE rows in:                  │  │
│   │     - store (where owner_user_id = auth.uid())                 │  │
│   │     - whatsapp_settings (where owner_user_id = auth.uid())    │  │
│   │     - all other business tables (where is_owner() = true)     │  │
│   │   → Can SELECT/INSERT/UPDATE/DELETE objects in:                │  │
│   │     - store_assets bucket                                      │  │
│   │     - documents bucket                                          │  │
│   └──────────────────────────────────────────────────────────────┘  │
│                                                                      │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │ service_role                                                   │  │
│   │   → Bypasses RLS entirely                                       │  │
│   │   → Used only by platform/supabase/admin.ts                     │  │
│   │   → Imported only in app/api/** server routes                   │  │
│   │   → Never imported in client code                               │  │
│   └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 8. Operational Notes

### 8.1 Why no policy targets the `anon` role

Anonymous users have no policies on any business table. With RLS
enabled and no `anon` policy, the default behaviour is "deny all".
This is the desired posture: unauthenticated requests should not
see any business data.

If a future feature required public read access to specific rows
(e.g. a public invoice lookup by bill number), it would need:

1. A new policy `FOR SELECT TO anon USING (...)` on the relevant
   table.
2. Careful scoping of the `USING` expression so it doesn't leak
   data across tenants.

### 8.2 Why no `policy_admin` or superuser role

The bootstrap does not create custom Postgres roles or grant
additional privileges beyond what Supabase sets up by default.
All authorization decisions go through the standard `anon` /
`authenticated` / `service_role` trichotomy.

### 8.3 Re-running the bootstrap

The bootstrap is **mostly idempotent**:

* `CREATE TABLE` statements are not guarded — re-running the
  bootstrap on a project that already has the tables will fail on
  the first `CREATE TABLE`. Use the `sql/reset_database.sql` script
  first to drop everything (see [`sql/reset_database.sql`](./sql/reset_database.sql)).
* `CREATE POLICY` statements are also not guarded — re-running
  will fail with "policy already exists". The intended workflow is
  to reset the database before re-bootstrapping.
* `CREATE EXTENSION IF NOT EXISTS`, `INSERT INTO storage.buckets
  ... ON CONFLICT DO NOTHING`, and `CREATE OR REPLACE FUNCTION
  is_owner()` are all idempotent and safe to re-run.

### 8.4 Inspecting policies

Useful queries for inspecting the policy state:

```sql
-- List all policies on every business table
SELECT schemaname, tablename, policyname, permissive, roles,
       cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- List all RLS-enabled tables
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE relrowsecurity = true
ORDER BY relname;

-- List storage buckets
SELECT id, name, public FROM storage.buckets;

-- List storage policies
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;
```

### 8.5 Testing policies manually

To verify a policy works as expected, run a query as a specific
user:

```sql
-- Run as the mock user (requires psql with the mock user's JWT)
SET request.jwt.claim.sub = '975839b1-18b7-4339-a9dd-00863521bb29';
SET request.role = 'authenticated';

-- Should return exactly one row (the user's store)
SELECT id, name, owner_user_id FROM store;

-- Should return all inventory items (because is_owner() is true)
SELECT count(*) FROM inventory_items;

-- Switch to a different user
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';

-- Should return zero rows (no store owned by this user)
SELECT id, name FROM store;
SELECT count(*) FROM inventory_items;  -- should be 0
```

### 8.6 Common pitfalls

1. **Forgetting `WITH CHECK`** — if you add a `FOR ALL` policy
   with only `USING`, inserts will be silently allowed without any
   check. The bootstrap always declares both.
2. **Using `auth.uid()` in `is_owner()` without `SECURITY DEFINER`**
   — the function would then run as the calling user, who has no
   direct `SELECT` policy on `store` (the only policy on `store`
   is `owner_user_id = auth.uid()`, which is a different expression
   and would re-evaluate). The `SECURITY DEFINER` clause makes the
   function run as the table owner, bypassing that recursion.
3. **Adding a new table and forgetting `ALTER TABLE ... ENABLE ROW
   LEVEL SECURITY`** — without this line, no policy is enforced
   even if you create one. Always enable RLS when adding a table.
4. **Adding a new table and forgetting to add an `Owner Access`
   policy** — with RLS enabled and no policy, even the owner
   cannot read their own data. Every new business table needs
   exactly one `Owner Access` policy mirroring section 4.

---

## 9. Policy Listing — Quick Reference Table

For convenience, the entire policy inventory in one table:

| Table                       | Policy name                | Pattern             | `USING` / `WITH CHECK`                              |
|-----------------------------|----------------------------|---------------------|-----------------------------------------------------|
| `store`                     | `Store Owner Access`        | Direct owner check  | `owner_user_id = auth.uid()`                        |
| `whatsapp_settings`         | `whatsapp_settings_owner`   | Direct owner check  | `owner_user_id = auth.uid()`                        |
| `financial_years`           | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `bank_accounts`             | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `payment_modes`             | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `parties`                   | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `inventory_items`           | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `purchases`                 | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `purchase_items`            | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `sales`                     | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `sale_items`                | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `trade_ins`                 | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `payments_in`               | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `payments_out`              | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `account_transactions`      | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `account_fund_entries`      | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `account_transfers`         | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `proforma_invoices`         | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `proforma_invoice_items`    | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `proforma_trade_ins`        | `Owner Access`              | `is_owner()`        | `is_owner()`                                        |
| `storage.objects` (read)    | `store_assets_read`         | Bucket filter       | `bucket_id = 'store_assets'`                        |
| `storage.objects` (insert) | `store_assets_write`        | Bucket filter       | `bucket_id = 'store_assets'`                        |
| `storage.objects` (update) | `store_assets_update`       | Bucket filter       | `bucket_id = 'store_assets'`                        |
| `storage.objects` (delete) | `store_assets_delete`       | Bucket filter       | `bucket_id = 'store_assets'`                        |
| `storage.objects` (read)    | `documents_read`            | Bucket filter       | `bucket_id = 'documents'`                           |
| `storage.objects` (insert) | `documents_write`           | Bucket filter       | `bucket_id = 'documents'`                           |
| `storage.objects` (update) | `documents_update`          | Bucket filter       | `bucket_id = 'documents'`                           |
| `storage.objects` (delete) | `documents_delete`          | Bucket filter       | `bucket_id = 'documents'`                           |

**Total**: 20 RLS policies on business tables + 8 storage policies =
**28 policies**.

---

## 10. Cross-References

* The `is_owner()` function definition and rationale:
  [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md).
* The schema that these policies protect:
  [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md).
* The high-level ownership model:
  [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md), section 3.
* The mock user used to exercise these policies in dev:
  [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md), section 4.
