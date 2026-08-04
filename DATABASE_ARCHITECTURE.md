# FUSION-ONE — Database Architecture

> Source of truth: [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql) and [`SUPABASE_SEED.sql`](./SUPABASE_SEED.sql).
> TypeScript row types: [`shared/types/common.ts`](./shared/types/common.ts), [`shared/types/sales.ts`](./shared/types/sales.ts), [`shared/types/purchases.ts`](./shared/types/purchases.ts).

This document describes the complete shape of the FUSION-ONE database as created by
`SUPABASE_BOOTSTRAP.sql` — the tables it contains, how they relate to one another, the
ownership model that backs Row Level Security, the authentication model that drives it,
the storage buckets that hold binary assets, the storage policies layered on top, and
the only custom Postgres function (`is_owner()`) used by the security policies.

It is intended as the high-level map. For policy-level detail see
[`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md); for the function definition see
[`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md); for per-table ownership and
consumer dependencies see [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md);
for environment setup see [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md).

---

## 1. Overview

FUSION-ONE is a single-tenant, IMEI-tracked mobile-phone retail billing system
running on Supabase (Postgres + PostgREST + Storage + GoTrue Auth). It models the
complete lifecycle of a phone retailer:

1. **Buy** phones from suppliers (purchases).
2. **Stock** them as IMEI-tracked inventory items.
3. **Sell** them to customers (sales), optionally taking trade-ins.
4. **Collect** outstanding balances (payments in) and **pay** suppliers (payments out).
5. **Quote** customers ahead of a sale (proforma invoices).
6. **Reconcile** the cash/bank position through a ledger (`account_transactions`).
7. **Brand** the printed invoice / quotation with a logo and signature image.

All business data lives behind Row Level Security. There is exactly one store per
authenticated user, and the store owner is the only principal who can read or write
the business rows that belong to them.

### 1.1 Database platform

| Property       | Value                                                    |
| -------------- | -------------------------------------------------------- |
| Engine         | PostgreSQL (managed by Supabase)                         |
| Schema         | `public` (all tables), `auth` (Supabase-managed), `storage` (Supabase-managed) |
| Primary keys  | `UUID DEFAULT gen_random_uuid()` for every business table |
| Money type     | `NUMERIC(12, 2)` (rupees with 2 decimal places)          |
| Timestamps     | `TIMESTAMPTZ DEFAULT now()`                              |
| Extensions      | `btree_gist` (for the financial-year overlap exclusion constraint) |

### 1.2 Schema inventory at a glance

The bootstrap creates **20 user-defined tables**, all in the `public` schema:

| #  | Table                       | Group                | Notes                                                  |
|----|-----------------------------|----------------------|--------------------------------------------------------|
| 1  | `financial_years`           | Setup / config       | One active at a time; drives bill-number counters.    |
| 2  | `store`                     | Setup / config      | The single tenant record. Holds logo/signature URLs.    |
| 3  | `bank_accounts`             | Banking              | Cash + bank ledgers.                                   |
| 4  | `payment_modes`             | Banking              | UPI/Card/NEFT/Cash etc., per bank account.             |
| 5  | `parties`                   | People               | Customers and suppliers share one table.               |
| 6  | `inventory_items`           | Inventory            | IMEI-tracked stock items. Self-referencing via `origin_inventory_item_id`. |
| 7  | `purchases`                 | Purchases            | Supplier bill header.                                  |
| 8  | `purchase_items`            | Purchases            | Mapping of purchases ↔ inventory_items.               |
| 9  | `sales`                     | Sales                | Customer bill header.                                  |
| 10 | `sale_items`                | Sales                | Mapping of sales ↔ inventory_items, with sold_price.  |
| 11 | `trade_ins`                 | Sales                | Devices taken in exchange during a sale.               |
| 12 | `payments_in`               | Payments             | Customer receipts.                                     |
| 13 | `payments_out`              | Payments             | Supplier disbursements.                                |
| 14 | `account_transactions`      | Ledger               | Append-only ledger per bank account.                   |
| 15 | `account_fund_entries`      | Ledger               | Manual fund additions to a bank account.               |
| 16 | `account_transfers`         | Ledger               | Internal transfers between two bank accounts.          |
| 17 | `proforma_invoices`         | Proforma             | Quotation header.                                      |
| 18 | `proforma_invoice_items`    | Proforma             | Quotation line items.                                  |
| 19 | `proforma_trade_ins`        | Proforma             | Estimated trade-ins on a quotation.                    |
| 20 | `whatsapp_settings`          | Messaging            | Per-user WhatsApp delivery configuration (placeholder).|

Two Supabase-managed tables are also referenced:

* `auth.users` — Supabase Auth user records. Foreign-keyed by `store.owner_user_id`
  and `whatsapp_settings.owner_user_id`.
* `storage.objects` — Supabase Storage object metadata. Addressed via bucket
  policies, not foreign keys.

---

## 2. Entity Relationship Summary

The diagram below shows the principal foreign-key relationships. Arrows point from
the child (FK side) to the parent (PK side).

```
            auth.users
               │
               │ owner_user_id
               ▼
            store ─────── active_financial_year_id ─────► financial_years
                                                               ▲
                                                               │ financial_year_id
              ┌────────────────────────────────────────────────┤
              │                                                │
        bank_accounts ──── payment_modes                       │
              │                                                │
              │ bank_account_id                                 │
              ▼                                                │
       account_transactions                                     │
              │ reference_id ──► sales / purchases /          │
              │                  payments_in / payments_out /  │
              │                  account_fund_entries /        │
              │                  account_transfers             │
              │                                                │
       account_fund_entries                                    │
       account_transfers                                       │
                                                              │
       parties ─────► sales ─────► sale_items ─────► inventory_items
                ─────► purchases ──► purchase_items ──► inventory_items
                ─────► payments_in
                ─────► payments_out                                ▲
                                                                  │ origin_inventory_item_id
                                                                  │ (self-reference)
                                                                  │
       sales ─────► trade_ins ──────► inventory_items (new_inventory_item_id)

       proforma_invoices ─────► proforma_invoice_items
                            ─────► proforma_trade_ins
```

Key join patterns:

* **Sale ↔ inventory_item** is a many-to-many through `sale_items`, with the
  sold price recorded on the join row (`sold_price`). Each sale can contain at
  most one trade-in row per device, but multiple `trade_ins` rows are allowed
  per sale.
* **Purchase ↔ inventory_item** is many-to-many through `purchase_items`. The
  cost price lives on `inventory_items.purchase_price`, not on the join row.
* **inventory_items** is self-referential via `origin_inventory_item_id`.
  When a sale converts a trade-in into a stockable item, the new
  `inventory_items` row points back at the trade-in's previous stock row (if
  any) to preserve lineage.
* **financial_years** is referenced by almost every transactional table
  (`inventory_items`, `purchases`, `sales`, `payments_in`, `payments_out`,
  `account_transactions`, `account_fund_entries`, `account_transfers`,
  `proforma_invoices`). This is what allows bill-number counters and ledger
  rollups to be partitioned by financial year.
* **account_transactions** uses a polymorphic `reference_type` +
  `reference_id` pattern rather than a typed foreign key, because the
  referenced row may live in `sales`, `purchases`, `payments_in`,
  `payments_out`, `account_fund_entries`, or `account_transfers`.

---

## 3. The Ownership Model

### 3.1 Single store per user

The entire application assumes that **one Supabase auth user owns exactly one
store**. There is no concept of multiple stores per user, no store membership
table, no shared/invited users. The link is a single column:

```sql
store.owner_user_id UUID NOT NULL
```

This column has **no foreign key constraint declared** in the bootstrap
script (it intentionally avoids `REFERENCES auth.users(id)` so the bootstrap
can be re-run on a fresh project before any auth users exist), but the
seed data treats it as a FK and every RLS policy treats it as the source
of truth for ownership.

### 3.2 Two flavours of ownership check

There are exactly two patterns used across the 20 tables:

| Pattern                                   | Used by                                            |
|-------------------------------------------|----------------------------------------------------|
| Direct `owner_user_id = auth.uid()` check | `store`, `whatsapp_settings`                       |
| Indirect `is_owner()` function call        | Every other business table                         |

The direct check is appropriate for tables whose rows literally contain the
owning user id. The indirect check is used for tables that have no user id
column of their own — they are owned *transitively* through the store. The
`is_owner()` function (see [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md))
returns `true` if and only if the calling `auth.uid()` matches the
`owner_user_id` of any row in `store`.

### 3.3 Implications

* Adding a second user to a store is not supported — to share data, you would
  need to introduce a `store_members` table and broaden the `is_owner()`
  definition.
* The model is **multi-tenant by user, single-tenant by store**: two
  different users see two different stores and cannot see each other's data.
* There is no `tenant_id` column on any business table. Tenancy is enforced
  purely through RLS, never through queries. This means a service-role
  client (see [`platform/supabase/admin.ts`](./platform/supabase/admin.ts))
  can read every tenant's data without filtering — that client must be kept
  server-side only.

---

## 4. The Authentication Model

FUSION-ONE uses **Supabase Auth (GoTrue)** for authentication. The
bootstrap script itself does not create any auth users; it only assumes
that `auth.users` exists (it always does on a Supabase project) and that
the `authenticated` Postgres role exists.

### 4.1 Three Supabase clients

The codebase instantiates three flavours of Supabase client. Each maps to a
distinct trust boundary:

| File                                      | Client               | Trust level                          | Use site                                  |
|-------------------------------------------|----------------------|--------------------------------------|-------------------------------------------|
| `platform/supabase/client.ts`            | `createBrowserClient`| Anonymous, RLS-enforced              | Client Components, browser hooks.        |
| `platform/supabase/server.ts`            | `createServerClient` | User-scoped, RLS-enforced            | Server Components, Server Actions, Route Handlers, Middleware. |
| `platform/supabase/admin.ts`              | `createClient`       | Service role, **RLS-bypassing**       | Server-only API routes that need to read across tenants or perform admin work. |

The browser and server clients carry the user's JWT (transferred via
cookies for the server client, via `localStorage` / cookies for the browser
client). All RLS policies target the `authenticated` role, which is the
role Supabase assigns to any request bearing a valid user JWT.

### 4.2 Sign-in flow

Authentication is handled by Supabase Auth via the email/password flow
(see [`app/actions/auth.ts`](./app/actions/auth.ts) and the
`(auth)/login` route group). After sign-in, the user's session JWT is
stored in cookies by `@supabase/ssr`. On every request the middleware
refreshes the session if needed.

### 4.3 Onboarding

When a brand-new user signs up, no `store` row exists for them. The
`(auth)/onboarding` page collects store details and creates the `store`
row (and the first `financial_years` row) via the user-scoped server
client. From that moment on, `is_owner()` returns `true` for that user
and they can read/write every business table.

The `store.onboarding_complete` boolean tracks whether the onboarding
wizard has been finished; the UI uses this to gate access to the main
app routes.

### 4.4 Mock user for development

The seed script (`SUPABASE_SEED.sql`, section 0) creates a deterministic
mock user directly in `auth.users` so the seed data can be loaded before
any sign-in has happened:

* **Email**: `mock@email.com`
* **Password**: `mockpassword123`
* **UID**: `975839b1-18b7-4339-a9dd-00863521bb29`

The insert is idempotent — it skips if the user already exists. See
[`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) for the full mock-user
walkthrough.

---

## 5. Storage Model

Two public storage buckets are created by the bootstrap:

| Bucket         | Public? | Intended contents                                                |
|----------------|---------|------------------------------------------------------------------|
| `store_assets` | `true`  | Store logo and signature image — referenced by `store.logo_url` and `store.signature_url`. |
| `documents`    | `true`  | Trade-in documents and other file uploads — referenced by `trade_ins.document_url`. |

Both buckets are **publicly readable** (anyone with the URL can `GET` the
object). Writes, updates and deletes are restricted to the `authenticated`
role via storage policies (see section 6 below).

### 5.1 Why public read?

Invoice PDFs and PNGs are rendered server-side (see
[`domains/invoice/renderers`](./domains/invoice/renderers)) and embedded
into WhatsApp messages. The WhatsApp delivery pipeline needs URLs that
can be fetched without authentication, so the buckets are public. The
obscurity of Supabase's storage object path (`bucket_id` + random UUID +
filename) provides the practical access-control.

### 5.2 Storage policy shape

For each bucket, four policies are declared:

1. **read** — `FOR SELECT` for `authenticated`, allowed when
   `bucket_id = '<bucket>'`.
2. **write** — `FOR INSERT` for `authenticated`, allowed when
   `bucket_id = '<bucket>'`.
3. **update** — `FOR UPDATE` for `authenticated`, allowed when
   `bucket_id = '<bucket>'`.
4. **delete** — `FOR DELETE` for `authenticated`, allowed when
   `bucket_id = '<bucket>'`.

There is **no per-object ownership check** in storage. Any authenticated
user can read or overwrite any other user's objects within the same
bucket. This is acceptable for the current single-tenant-per-deployment
shape but would need to be tightened (e.g. with a `storage.foldername`
name = `(auth.uid())` pattern) if multiple stores ever shared one
Supabase project. See [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md)
for the literal policy text.

---

## 6. Policy Model Summary

Every business table has Row Level Security **enabled** (via
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`). On each table, exactly
one policy named `"Owner Access"` is declared for the `authenticated`
role with `FOR ALL` (i.e. covering `SELECT`, `INSERT`, `UPDATE`,
`DELETE`):

```sql
CREATE POLICY "Owner Access" ON <table>
  FOR ALL TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());
```

Exceptions:

* `store` and `whatsapp_settings` use a direct
  `owner_user_id = auth.uid()` check instead of `is_owner()`, because
  they are the tables that `is_owner()` itself reads from — using
  `is_owner()` on `store` would be recursive and unhelpful.
* Storage uses four separate policies per bucket (read/write/update/delete)
  instead of one `FOR ALL` policy, because storage policies can only
  target one operation each.

Anonymous users (`anon` role) have **no policies** on any business table
and therefore cannot read or write anything. Only `authenticated` users
can act, and only on their own store's rows.

See [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md) for the complete
policy listing.

---

## 7. Functions and Triggers

The bootstrap defines **exactly one** custom Postgres function:

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

* **`SECURITY DEFINER`** is essential — it lets `is_owner()` read the
  `store` table even when the calling role has no direct `SELECT` policy
  on it (which it doesn't; the only policy on `store` is
  `owner_user_id = auth.uid()` and that would be a circular check).
* **No triggers** are defined anywhere in the bootstrap. All side
  effects (writing `account_transactions`, marking `inventory_items`
  as `sold`, incrementing `financial_years.*_counter`) are performed by
  application code, not by database triggers. This was an explicit
  design choice — it keeps all mutation logic in TypeScript, where it
  can be unit-tested, rather than split between TS and PL/pgSQL.
* **No views** are defined. All read queries hit base tables directly,
  typically through PostgREST's automatic join expansion.

See [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md) for the full
function walkthrough and a discussion of why the project deliberately
omits triggers and views.

---

## 8. Constraints and Indexes

### 8.1 CHECK constraints

* `financial_years.status` — `'active' | 'closed'`.
* `financial_years.fy_date_check` — `start_date < end_date`.
* `financial_years.fy_no_overlap` — GiST exclusion constraint preventing
  two financial years from sharing any date range.
* `inventory_items.status` — `'in_stock' | 'sold'`.
* `inventory_items.source` — `'purchase' | 'trade_in'`.
* `inventory_items.opening_entry_type` — `'direct' | 'carried_forward'`.
* `purchases.status`, `sales.status` — `'active' | 'cancelled'`.
* `proforma_invoices.status` — `'active' | 'converted' | 'void'`.
* `account_transactions.type` — `'credit' | 'debit'`.
* `account_transactions.reference_type` — `'sale' | 'purchase' |
  'payment_in' | 'payment_out' | 'add_funds' | 'transfer' |
  'opening_balance' | 'sale_cancelled'`.
* `account_fund_entries.amount`, `account_transfers.amount` — `> 0`.
* `account_transfers.transfer_different_accounts` —
  `from_bank_account_id != to_bank_account_id`.

### 8.2 UNIQUE constraints

* `whatsapp_settings.owner_user_id` is `UNIQUE` — one settings row per user.
* `idx_unique_imei_in_stock` — a partial unique index on
  `inventory_items(imei) WHERE status = 'in_stock'`. This means an IMEI
  can appear multiple times in the table (e.g. once for an old `sold`
  row, once for a new `in_stock` row after a trade-in re-entered stock),
  but only **one `in_stock` row** can exist per IMEI at any time.

### 8.3 Indexes

The bootstrap adds B-tree indexes on the most-queried columns:

| Table                   | Indexed columns                          |
|-------------------------|------------------------------------------|
| `sales`                | `party_id`, `date`, `status`             |
| `purchases`            | `party_id`, `date`, `status`             |
| `inventory_items`      | `status`, `financial_year_id`            |
| `payments_in`          | `sale_id`                                |
| `payments_out`         | `purchase_id`                            |
| `account_transactions` | `date`, `(reference_type, reference_id)` |
| `proforma_invoices`    | `status`, `date`                         |

Every primary key is also implicitly indexed. There are no composite
indexes beyond the `(reference_type, reference_id)` one on
`account_transactions`.

---

## 9. Data Lifecycle

### 9.1 Inventory lifecycle

```
purchase ──► inventory_items(in_stock)
                │
                │ sale
                ▼
            inventory_items(sold)
                │
                │ trade-in re-enters stock
                ▼
            inventory_items(in_stock, source=trade_in,
                            origin_inventory_item_id=<old sold row>)
```

The `origin_inventory_item_id` self-reference lets the UI trace a
trade-in device back to the original purchase, preserving the purchase
price and original supplier even after the device has been resold.

### 9.2 Cancellation lifecycle

`purchases` and `sales` can transition from `active` to `cancelled`
(never back). Cancellation is a soft delete — the rows stay in the
table for audit purposes, and the application layer is responsible for:

* Reverting the `inventory_items.status` from `sold` back to
  `in_stock` (for a cancelled sale).
* Writing a compensating `account_transactions` row with
  `reference_type = 'sale_cancelled'` (for a cancelled sale).
* Not decrementing the `financial_years.*_counter` — once a
  bill number is used, it stays used.

The bootstrap schema itself enforces **none** of this; it only provides
the `status` column and its CHECK constraint. All compensating logic
lives in the domain mutation modules (e.g. `domains/sales/mutations.ts`).

### 9.3 Proforma lifecycle

```
proforma_invoices(status=active)
   │
   │ user converts the quotation into a real sale
   ▼
proforma_invoices(status=converted)
   │
   │ user voids the quotation (e.g. customer declined)
   ▼
proforma_invoices(status=void)
```

A proforma can never return to `active`. Once `converted`, the
associated `sales` row carries the actual sale; the proforma row stays
for audit. Once `void`, the row is permanently inactive.

---

## 10. Bill Numbering

Bill numbers are **not** database-generated. They are minted by the
application layer using counters stored on `financial_years`:

| Counter                        | Used by          | Format example     |
|--------------------------------|------------------|--------------------|
| `financial_years.sale_counter`     | `sales`         | `SAL-2025-26-0001` |
| `financial_years.purchase_counter` | `purchases`     | `PUR-2025-26-0001` |
| `financial_years.proforma_counter` | `proforma_invoices` | `PI-2025-26-0001` |

The application reads the current counter, increments it, persists the
new value, and uses it to build the bill number string. The seed data
starts `sale_counter=3`, `purchase_counter=2`, `proforma_counter=1`
because those are the counts of seeded records.

This pattern means bill numbers are unique **only by application
convention** — the database does not enforce uniqueness on
`sales.bill_number` or `purchases.bill_number`. Re-running the seed
script will not collide because every seed insert uses
`ON CONFLICT (id) DO NOTHING` keyed on the deterministic UUID, not on
the bill number.

---

## 11. Cross-References to Other Documentation

| Topic                                  | Document                              |
|----------------------------------------|---------------------------------------|
| Per-table purpose, consumers, FKs      | [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md) |
| Every RLS policy and storage policy    | [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md) |
| `is_owner()` and the absence of triggers/views | [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md) |
| How to stand up a fresh dev database   | [`ENVIRONMENT_SETUP.md`](./ENVIRONMENT_SETUP.md) |

---

## 12. Conventions

* **UUIDs everywhere** — no serial/integer primary keys, ever.
* **Soft deletes via `status`** — no row is ever hard-deleted except via
  `ON DELETE CASCADE` on child tables (`purchase_items`, `sale_items`,
  `trade_ins`, `proforma_invoice_items`, `proforma_trade_ins`).
* **Money is `NUMERIC(12,2)`** — never floating point.
* **Timestamps are `TIMESTAMPTZ`** — always stored as UTC.
* **JSONB only on `store.invoice_templates`** — used to remember which
  invoice template the user last picked for each of sale / purchase /
  proforma. No other JSONB columns exist.
* **No enums** — status fields are `TEXT` with `CHECK` constraints, so
  that adding a new status (e.g. `'void'` on proformas) only requires
  an `ALTER TABLE ... DROP CONSTRAINT ... ADD CONSTRAINT` migration,
  not a Postgres enum type migration.
* **`auth.uid()` is the only auth primitive** used by policies — there
  are no custom claims, no `auth.jwt()->>'role'` checks, no organisations
  or teams encoded in the JWT.
