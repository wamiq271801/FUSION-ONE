# FUSION-ONE — Database Functions, Triggers, and Views

> Source of truth: [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql),
> section 3 ("Security Functions").
>
> Companion docs:
> * [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md) — every policy that
>   calls the function below.
> * [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md) — high-level
>   model.

This document is the complete reference for the **only** custom
Postgres function in the FUSION-ONE database (`is_owner()`), and
explains why the project defines **zero triggers** and **zero views**
despite Supabase making both trivial to add.

---

## 1. Inventory

| Object type | Count | Names                          |
|-------------|-------|--------------------------------|
| Functions   | 1     | `is_owner()`                   |
| Triggers    | 0     | —                              |
| Views       | 0     | —                              |
| Materialised views | 0 | —                            |
| Extensions  | 1     | `btree_gist` (for the financial-year GiST exclusion constraint) |

This minimal surface is deliberate. The sections below explain each
decision.

---

## 2. The `is_owner()` Function

### 2.1 Definition

The bootstrap declares exactly one custom function:

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

### 2.2 Anatomy

| Clause                       | Value                                              | Why                                                                                                       |
|------------------------------|----------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `CREATE OR REPLACE FUNCTION` | —                                                  | Idempotent: re-running the bootstrap overwrites any prior definition without error.                       |
| Name                          | `is_owner`                                         | Lower-case, snake_case — Postgres convention.                                                            |
| Arguments                     | none                                               | The function takes no arguments; it reads the calling user from `auth.uid()`.                            |
| Return type                   | `BOOLEAN`                                          | Used directly as a policy predicate.                                                                     |
| Body language                 | `plpgsql`                                          | Required because the body uses a control-flow `BEGIN ... RETURN ... END` block.                         |
| `SECURITY DEFINER`            | present                                            | **Critical** — see section 2.4.                                                                           |
| `STRICT` / `IMMUTABLE` / etc. | not declared                                        | The function is `VOLATILE` by default, which is correct because it depends on `auth.uid()` (session state). |

### 2.3 Behaviour

* Returns `true` if at least one row in `store` has
  `owner_user_id = auth.uid()`.
* Returns `false` if no such row exists **or** `auth.uid()` is NULL
  (which happens when the caller is not authenticated).
* Always returns `false` for the `anon` role, because policies
  target `authenticated` only — `is_owner()` is never even invoked
  for `anon`.

### 2.4 Why `SECURITY DEFINER`?

`SECURITY DEFINER` makes the function execute with the privileges
of the function's **owner** (the user who ran the bootstrap — by
default the postgres superuser), not the privileges of the calling
role.

This is essential because of a chicken-and-egg problem:

* The only policy on `store` is `owner_user_id = auth.uid()`.
* `is_owner()` reads `store`.
* If `is_owner()` ran as the calling user (the default —
  `SECURITY INVOKER`), the `SELECT 1 FROM store` inside the
  function would be subject to `store`'s RLS policy
  (`owner_user_id = auth.uid()`).
* That policy expression is exactly what `is_owner()` is trying to
  evaluate, so the function would have to evaluate itself to
  evaluate itself — infinite recursion is avoided by RLS, but
  only because the inner `SELECT` would silently return zero
  rows for any caller who doesn't already own a store.
* The result would be that `is_owner()` returns `false` for every
  user — including legitimate store owners — breaking every
  business-table policy.

By running as `SECURITY DEFINER`, the function bypasses RLS on
`store` for the duration of its own `SELECT`, sees all store rows,
and correctly evaluates whether the calling user owns one.

### 2.5 Why no `STRICT`?

A `STRICT` function returns NULL immediately if any argument is
NULL. `is_owner()` takes no arguments, so `STRICT` would be a
no-op. Omitting it keeps the function definition shorter.

### 2.6 Why not `IMMUTABLE` or `STABLE`?

* `IMMUTABLE` would tell Postgres the function's result depends only
  on its arguments and can be cached forever. That's wrong —
  `is_owner()` depends on `auth.uid()` (session state) and on the
  current contents of `store`.
* `STABLE` would tell Postgres the function's result is constant
  within a single transaction. That's true in practice for the
  `auth.uid()` part, but not for the `store` part (a user could
  create their first store mid-transaction and then expect
  `is_owner()` to return `true` for subsequent policy evaluations
  in the same transaction). Defaulting to `VOLATILE` is the safe
  choice.

### 2.7 Performance characteristics

Every business-table RLS policy calls `is_owner()` once per row
evaluation. For a `SELECT * FROM sales` returning N rows, Postgres
will invoke `is_owner()` N times.

Each invocation runs:

```sql
SELECT 1 FROM store WHERE owner_user_id = auth.uid()
```

...which is an index lookup on `store.owner_user_id`. The bootstrap
does not explicitly create an index on `store.owner_user_id`, but
Supabase creates indexes for `UNIQUE` constraints and primary keys
automatically. `owner_user_id` has no unique constraint — so this
lookup is a sequential scan of `store`.

In practice `store` has exactly one row per authenticated user, and
across an entire Supabase project it has at most a few hundred rows
(one per tenant). The sequential scan is therefore effectively O(1)
and not a performance concern.

If you ever need to scale to thousands of tenants, add:

```sql
CREATE INDEX idx_store_owner_user_id ON store(owner_user_id);
```

### 2.8 How to call it

`is_owner()` is called implicitly by every `Owner Access` RLS
policy. You can also call it explicitly in queries, e.g.:

```sql
-- Read-only check from a route handler running as the user
SELECT is_owner() AS is_owner;
```

PostgREST exposes it as an RPC:

```ts
const { data } = await supabase.rpc('is_owner');
// data === true if the calling user owns a store
```

The application code does not currently call it directly — it
relies entirely on RLS to enforce ownership — but the RPC is
available if needed.

### 2.9 Testing the function manually

```sql
-- Switch to the mock user
SET request.jwt.claim.sub = '975839b1-18b7-4339-a9dd-00863521bb29';
SET request.role = 'authenticated';

SELECT is_owner();  -- should return true (mock user owns the seeded store)

-- Switch to a non-existent user
SET request.jwt.claim.sub = '00000000-0000-0000-0000-000000000000';

SELECT is_owner();  -- should return false (no store owned)

-- Switch to anon
SET request.role = 'anon';
SET request.jwt.claim.sub = '';

SELECT is_owner();  -- should return false (auth.uid() is NULL)
```

---

## 3. Triggers (None)

### 3.1 What the bootstrap does NOT define

There are **zero** `CREATE TRIGGER` statements in
`SUPABASE_BOOTSTRAP.sql`. None of the following common trigger
patterns are present:

* No `BEFORE INSERT` triggers to set `created_at`.
* No `BEFORE UPDATE` triggers to set `updated_at`.
* No `AFTER INSERT` triggers to write ledger entries.
* No `AFTER UPDATE` triggers to flip inventory status.
* No `INSTEAD OF` triggers on views (there are no views).

### 3.2 Why?

The FUSION-ONE codebase made an explicit architectural choice: **all
side effects live in TypeScript, not in PL/pgSQL**. Specifically:

1. **Testability.** Trigger logic is invisible to the TypeScript test
   suite and to the React DevTools. Domain mutation modules like
   [`domains/sales/mutations.ts`](./domains/sales/mutations.ts) and
   [`domains/accounts/mutations.ts`](./domains/accounts/mutations.ts)
   contain the entire side-effect surface — flipping inventory
   status, writing `account_transactions` rows, incrementing
   `financial_years.*_counter`. This logic is unit-testable without
   a database.

2. **Discoverability.** A new engineer reading
   [`domains/sales/mutations.ts`](./domains/sales/mutations.ts) sees
   the full sale-creation flow in one file. If side effects were
   split between TypeScript and PL/pgSQL, the engineer would need to
   cross-reference two languages and two codebases to understand
   what happens when a sale is saved.

3. **Avoiding double-action.** The classic trigger failure mode is
   "I updated the row, and the trigger fired, but I also wrote the
   side effect in my application code, so now there are two ledger
   entries." Centralising side effects in the application layer
   removes this failure mode.

4. **PostgREST compatibility.** PostgREST does invoke triggers when
   it inserts/updates rows (it goes through normal SQL), so the
   absence of triggers is not a PostgREST limitation — it's a
   design choice.

5. **Audit clarity.** With no triggers, the only writes that happen
   are the ones explicitly issued by the application. Database
   inspection after a sale shows exactly the rows the application
   intended to write, no surprises.

### 3.3 The cost

The cost is that the database does not enforce invariants that a
trigger would enforce. For example:

* `account_transactions` is not automatically kept in sync with
  `payments_in` / `payments_out`. If the application code has a
  bug and forgets to write the ledger row, the database will not
  complain.
* `sales.paid` and `sales.due` are not automatically recomputed
  when a `payments_in` row is inserted. The application must
  re-read, recompute, and update them.

The trade-off is deliberate: the FUSION-ONE team accepts this
responsibility in exchange for the testability and discoverability
benefits above.

### 3.4 When you might want to add a trigger

If you find yourself writing the same compensating logic in three
places (e.g. "every time a sale is cancelled, also write a
`sale_cancelled` ledger row"), consider extracting it into a
trigger. The pattern would look like:

```sql
-- EXAMPLE — not in the bootstrap
CREATE OR REPLACE FUNCTION on_sale_cancelled()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status = 'active' THEN
    INSERT INTO account_transactions (
      bank_account_id, type, amount, date,
      reference_type, reference_id, financial_year_id
    )
    SELECT bank_account_id, 'debit', paid, date,
           'sale_cancelled', NEW.id, financial_year_id
    FROM sales WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sale_cancelled
  AFTER UPDATE ON sales
  FOR EACH ROW
  WHEN (NEW.status = 'cancelled' AND OLD.status = 'active')
  EXECUTE FUNCTION on_sale_cancelled();
```

Before adding such a trigger, audit the application layer to ensure
the same logic isn't already being applied — otherwise you'll get
double ledger entries.

---

## 4. Views (None)

### 4.1 What the bootstrap does NOT define

There are **zero** `CREATE VIEW` statements in
`SUPABASE_BOOTSTRAP.sql`. No standard views, no materialised views,
not even a `_view` suffixed convenience view.

### 4.2 Why?

1. **PostgREST already exposes joins.** When the application needs
   a sale with its items, party, and trade-ins, it does:

   ```ts
   supabase.from('sales').select(`
     *,
     parties ( name, number ),
     sale_items ( *, inventory_items ( brand, model, imei ) ),
     trade_ins ( * )
   `).eq('id', saleId).single();
   ```

   PostgREST expands this into a single SQL query with the
   appropriate joins. There is no need to maintain a view that
   pre-joins these tables — the join is expressed at the call site,
   where the consumer knows exactly which fields it needs.

2. **Views would drift.** A view that selects specific columns from
   `sales` would need to be updated every time a column is added.
   By querying base tables directly, the application automatically
   sees new columns without a database migration.

3. **Views would complicate RLS.** Views inherit RLS from their
   underlying tables, but view policies can be confusing —
   especially when a view joins tables with different ownership
   semantics. FUSION-ONE avoids this entirely by having no views.

4. **No reporting layer yet.** Views shine for analytical rollups
   ("daily sales by store", "monthly GST summary"). FUSION-ONE's
   reporting needs are currently met by ad-hoc queries in
   [`domains/dashboard/queries.ts`](./domains/dashboard/queries.ts)
   and the `accounts` queries layer. When (if) those queries
   become expensive or frequently-repeated, a materialised view
   refreshed by a cron would be the right tool.

### 4.3 When you might want to add a view

* **Dashboard aggregations.** If
  [`domains/dashboard/queries.ts`](./domains/dashboard/queries.ts)
  starts running expensive `GROUP BY` queries on every page load,
  consider a view (or a materialised view refreshed by
  `pg_cron`).
* **Statement generation.** The accounts statement page
  ([`app/(app)/accounts/page.tsx`](./app/(app)/accounts/page.tsx))
  currently computes balances by summing `account_transactions`
  on the client. A view like `bank_account_balances` would let
  the client read balances in a single round-trip.
* **Audit reports.** A view joining `sales` → `sale_items` →
  `inventory_items` with all the columns flattened would simplify
  audit exports.

If you add a view, document it here and ensure its policy (or
inherited policy) preserves the tenant isolation model.

---

## 5. Extensions

The bootstrap enables exactly one extension:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;
```

### 5.1 Why `btree_gist`?

Postgres's built-in GiST operator classes can compare ranges
(`daterange`, `int4range`, etc.) but cannot compare scalar types
like `DATE` directly. The `btree_gist` extension adds GiST operator
classes for scalar types, which is required by the financial-years
overlap-exclusion constraint:

```sql
CONSTRAINT fy_no_overlap EXCLUDE USING gist (
  daterange(start_date, end_date, '[]') WITH &&
)
```

Without `btree_gist`, this constraint would fail with
`data type date has no default operator class for access method "gist"`.

### 5.2 Other extensions NOT used

The bootstrap does **not** enable:

* `pgcrypto` — Supabase projects already have this enabled by
  default, and the `gen_random_uuid()` function used in every
  `DEFAULT` clause comes from it.
* `pg_stat_statements` — useful for query performance analysis but
  not required for the application to function.
* `postgis` — geographic queries are not needed.
* `pg_trgm` — trigram search; FUSION-ONE uses `ILIKE` for party /
  inventory searches.
* `vector` / `pgvector` — no embeddings or similarity search.

---

## 6. Built-in Functions Used

The bootstrap relies on several built-in Postgres / Supabase
functions, listed here for completeness:

| Function                | Where used                                           |
|-------------------------|------------------------------------------------------|
| `gen_random_uuid()`     | Every `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`. |
| `now()`                  | Every `created_at TIMESTAMPTZ DEFAULT now()`.        |
| `auth.uid()`             | The `is_owner()` function body and the `store` / `whatsapp_settings` direct-check policies. |
| `crypt()` and `gen_salt()` | Used in the seed script (`SUPABASE_SEED.sql`) to hash the mock user's password. These come from `pgcrypto`, which is enabled by default on Supabase. |
| `daterange(start, end, '[]')` | Used in the `financial_years.fy_no_overlap` exclusion constraint. |
| `storage.foldername(name)` | Not used in the bootstrap — included here because it is the standard Supabase pattern for per-user storage isolation, which FUSION-ONE does not adopt (see [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md) section 5.2). |

---

## 7. Sequences

There are **no** Postgres sequences (`CREATE SEQUENCE`) in the
bootstrap. All bill-number counters are stored as integer columns
on `financial_years` (`sale_counter`, `purchase_counter`,
`proforma_counter`) and incremented by application code, not by a
sequence.

### 7.1 Why not sequences?

* Sequences are monotonic across the entire database, but
  FUSION-ONE's bill numbers are scoped per financial year
  (`SAL-2025-26-0001`, `SAL-2026-27-0001`). A sequence would
  need to be reset at the start of each year — possible but
  fiddly.
* Sequences do not participate in transactions — they advance
  even if the surrounding transaction rolls back. This means
  gaps can appear in the bill-number sequence (e.g. `0001`,
  `0002`, `0004` if `0003` is rolled back). FUSION-ONE's
  retailers expect contiguous bill numbers.
* Storing the counter on `financial_years` lets the seed data
  start at a non-zero value (e.g. `sale_counter = 3` after
  seeding 3 sales), which is impossible with a sequence.

### 7.2 Concurrency note

Because the counter is updated by application code, two concurrent
sale creations could race and end up with the same bill number.
The application layer handles this with a read-modify-write cycle
that is **not** atomic by default. For a single-store, single-user
POS application this is acceptable; for multi-user concurrency,
the application should wrap the counter increment in a
`SELECT ... FOR UPDATE` transaction or use an `UPDATE ... SET
counter = counter + 1 RETURNING counter` pattern.

---

## 8. Functions Calling Other Functions

`is_owner()` does not call any other custom function. It uses only
the built-in `auth.uid()` and the implicit `EXISTS` subquery.

No other custom function exists in the bootstrap, so there are no
function-to-function dependencies to document.

---

## 9. Migration Considerations

### 9.1 Changing `is_owner()`

Because `is_owner()` is referenced by 18 policies (every business
table except `store` and `whatsapp_settings`), changing its
definition affects every business-table read and write in the
system. Treat changes to this function as a security-sensitive
operation.

To safely modify `is_owner()`:

1. Write the new function definition.
2. Test it on a staging database with the mock user.
3. Use `CREATE OR REPLACE FUNCTION is_owner() ...` to swap the
   definition atomically. Postgres replaces the function in place
   without dropping and recreating it, so existing policy
   references continue to work.

### 9.2 Adding multi-store support

If you ever need to support multiple stores per user, the change
would be:

1. Add a `store_id UUID` column to every business table.
2. Migrate existing rows to set `store_id` to the user's existing
   store.
3. Update every `Owner Access` policy from `is_owner()` to
   `is_owner_of(store_id)` — a new function that takes the row's
   `store_id` and checks whether the calling user owns that store.
4. Optionally add a `store_members` table for shared access.

This is a substantial migration and would touch every table;
plan it carefully.

### 9.3 Adding triggers later

If you add a trigger (e.g. for automatic `account_transactions`
writes), be aware:

* Triggers run with the privileges of the table owner by default,
  which on Supabase is the postgres superuser. They will bypass RLS.
* Trigger-inserted rows will still be subject to RLS when read by
  the user, so the trigger-inserted ledger row will be visible if
  the calling user owns a store.
* Trigger errors will bubble up to the user as `PostgREST` errors
  and may leak internal details. Wrap trigger bodies in
  `BEGIN ... EXCEPTION WHEN OTHERS THEN ... END` blocks to provide
  user-friendly error messages.

---

## 10. Cross-References

* Every policy that calls `is_owner()`:
  [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md), section 4.
* The `store` table that `is_owner()` reads from:
  [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md), section 2.
* The high-level ownership model that motivates the function:
  [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md), section 3.
* The `auth.users` table that the function indirectly depends on
  (via `auth.uid()`):
  [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md), section 21.1.
