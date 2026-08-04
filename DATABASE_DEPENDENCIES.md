# FUSION-ONE — Database Dependencies

> Source: [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql) and the code under
> [`domains/`](./domains), [`app/api/`](./app/api), [`app/(app)/`](./app/(app)),
> [`shared/types/`](./shared/types), [`platform/`](./platform).

This document is the per-table reference. For every table created by the
bootstrap it lists:

* **Purpose** — what the table stores, in one sentence.
* **Columns** — every column, with type and constraints.
* **Foreign keys** — every outbound FK and the table it points to.
* **Inbound references** — every other table that points at this one.
* **Application consumers** — which domain modules, API routes, and UI
  pages read or write the table.
* **Why it exists** — the design rationale, including what would break
  if it were removed.

Tables are listed in the order they appear in `SUPABASE_BOOTSTRAP.sql`.

The 20 tables fall into 6 functional groups:

1. Setup / config — `financial_years`, `store`, `bank_accounts`, `payment_modes`.
2. People — `parties`.
3. Inventory — `inventory_items`.
4. Purchases — `purchases`, `purchase_items`.
5. Sales — `sales`, `sale_items`, `trade_ins`.
6. Payments & Ledger — `payments_in`, `payments_out`, `account_transactions`,
   `account_fund_entries`, `account_transfers`.
7. Proforma — `proforma_invoices`, `proforma_invoice_items`, `proforma_trade_ins`.
8. Messaging — `whatsapp_settings`.

---

## 1. `financial_years`

### Purpose
One row per accounting year. Holds the bill-number counters for the year
and an `active`/`closed` flag. Exactly one financial year may be `active`
at a time (enforced by application convention, not by a DB constraint).

### Columns

| Column               | Type           | Constraints / Default                              |
|----------------------|----------------|----------------------------------------------------|
| `id`                 | `UUID`         | PK, `gen_random_uuid()`                            |
| `start_date`         | `DATE`         | NOT NULL                                            |
| `end_date`           | `DATE`         | NOT NULL                                            |
| `status`             | `TEXT`         | NOT NULL, CHECK in (`'active'`,`'closed'`)         |
| `sale_counter`       | `INTEGER`      | NOT NULL, default 0                                |
| `purchase_counter`   | `INTEGER`      | NOT NULL, default 0                                |
| `proforma_counter`   | `INTEGER`      | NOT NULL, default 0                                |
| `created_at`         | `TIMESTAMPTZ`  | default `now()`                                    |

Plus two table-level constraints:

* `fy_date_check` — `start_date < end_date`.
* `fy_no_overlap` — GiST exclusion: no two rows may have overlapping
  `[start_date, end_date]` ranges. Requires the `btree_gist` extension,
  which is enabled at the top of the bootstrap.

### Foreign keys
None outbound.

### Inbound references
The following tables have a `financial_year_id` column that references
this table:

* `inventory_items.financial_year_id`
* `purchases.financial_year_id`
* `sales.financial_year_id`
* `payments_in.financial_year_id`
* `payments_out.financial_year_id`
* `account_transactions.financial_year_id`
* `account_fund_entries.financial_year_id`
* `account_transfers.financial_year_id`
* `proforma_invoices.financial_year_id`

Additionally, `store.active_financial_year_id` references this table
(without `ON DELETE` semantics — closing a financial year never deletes
it, only flips its `status` to `'closed'`).

### Application consumers

* **Domain**: [`domains/financial-years/`](./domains/financial-years)
  (`index.ts`, `mutations.ts`).
* **UI**: [`app/(app)/financial-year/page.tsx`](./app/(app)/financial-year/page.tsx).
* **Provider**: [`shared/providers/FinancialYearProvider.tsx`](./shared/providers/FinancialYearProvider.tsx)
  keeps the active financial year in React context so every page can
  scope its queries.
* **Read by**: every transactional domain (sales, purchases, payments,
  proforma, accounts, inventory) when filtering or inserting rows.

### Why it exists
* Allows the store owner to "close" a year and open a new one without
  losing historical data.
* Lets bill-number counters reset at the start of each year
  (`SAL-2025-26-0001`, `SAL-2026-27-0001`, ...).
* Lets reports filter transactions by year without parsing date strings.
* Provides the scope for end-of-year inventory "carried forward"
  entries (`inventory_items.opening_entry_type = 'carried_forward'`).

---

## 2. `store`

### Purpose
The single tenant record. Holds the store's branding (name, address,
phone, logo URL, signature URL), the active financial year, and the
default invoice templates per document type.

### Columns

| Column                     | Type           | Constraints / Default                                                  |
|----------------------------|----------------|------------------------------------------------------------------------|
| `id`                       | `UUID`         | PK, `gen_random_uuid()`                                                |
| `owner_user_id`            | `UUID`         | NOT NULL (no FK declared, treated as → `auth.users(id)` by app code)   |
| `name`                     | `TEXT`         | NOT NULL                                                                |
| `address`                  | `TEXT`         |                                                                        |
| `phone`                    | `TEXT`         | NOT NULL                                                                |
| `email`                    | `TEXT`         |                                                                        |
| `website`                  | `TEXT`         |                                                                        |
| `gstin`                    | `TEXT`         |                                                                        |
| `logo_url`                 | `TEXT`         |                                                                        |
| `signature_url`            | `TEXT`         |                                                                        |
| `onboarding_complete`      | `BOOLEAN`      | default `false`                                                         |
| `active_financial_year_id` | `UUID`         | → `financial_years(id)`                                                 |
| `invoice_templates`        | `JSONB`        | default `{"sale":"prestige","purchase":"prestige","proforma":"prestige"}` |
| `created_at`               | `TIMESTAMPTZ`  | default `now()`                                                         |

### Foreign keys
* `active_financial_year_id` → `financial_years(id)`.

### Inbound references
None. (`is_owner()` reads `store.owner_user_id`, but it's a function call,
not a foreign key.)

### Application consumers

* **Platform**: `is_owner()` (see [`platform/`](./platform)) — every
  business-table RLS policy depends on this table.
* **Domain**: [`domains/settings/`](./domains/settings) (`index.ts`,
  `queries.ts`, `mutations.ts`).
* **UI**:
  * [`app/(auth)/onboarding/page.tsx`](./app/(auth)/onboarding/page.tsx)
    creates the store row on first run.
  * [`app/(app)/settings/page.tsx`](./app/(app)/settings/page.tsx)
    edits it.
  * The invoice templates (see
    [`domains/invoice/templates/`](./domains/invoice/templates))
    read `store.invoice_templates` to pick the default template.
* **Hook**: [`hooks/useStoreTemplates.ts`](./hooks/useStoreTemplates.ts).
* **TypeScript**: [`shared/types/common.ts`](./shared/types/common.ts)
  `Store`.

### Why it exists
* Defines the tenant boundary — `owner_user_id` is the only column
  linking business data to an auth user.
* Stores branding for the printed invoice: `logo_url`, `signature_url`,
  GSTIN, address, phone. The invoice renderers in
  [`domains/invoice/renderers/`](./domains/invoice/renderers) consume
  these fields directly.
* Tracks onboarding state so the UI can redirect unfinished users to
  the wizard.
* The `invoice_templates` JSONB column lets the store remember the
  last-used invoice template per document kind without adding three
  extra columns.

---

## 3. `bank_accounts`

### Purpose
Cash and bank ledgers. Each row represents either a cash drawer
(`is_cash = true`) or a real bank account (`is_cash = false`). All money
movements (sales, purchases, payments, fund entries, transfers,
ledger entries) reference one of these rows.

### Columns

| Column        | Type           | Constraints / Default        |
|---------------|----------------|------------------------------|
| `id`          | `UUID`         | PK, `gen_random_uuid()`      |
| `name`        | `TEXT`         | NOT NULL                     |
| `is_cash`     | `BOOLEAN`      | NOT NULL, default `false`    |
| `created_at`  | `TIMESTAMPTZ`  | default `now()`              |

### Foreign keys
None.

### Inbound references

* `payment_modes.bank_account_id` (CASCADE on delete).
* `purchases.bank_account_id`.
* `sales.bank_account_id`.
* `payments_in.bank_account_id`.
* `payments_out.bank_account_id`.
* `account_transactions.bank_account_id`.
* `account_fund_entries.bank_account_id`.
* `account_transfers.from_bank_account_id`.
* `account_transfers.to_bank_account_id`.

### Application consumers

* **Domain**: [`domains/accounts/`](./domains/accounts) (`index.ts`,
  `queries.ts`, `mutations.ts`).
* **Platform**: [`platform/services/accounts.ts`](./platform/services/accounts.ts)
  orchestrates ledger writes.
* **UI**: [`app/(app)/accounts/page.tsx`](./app/(app)/accounts/page.tsx).
* **API**:
  * [`app/api/accounts/add-funds/route.ts`](./app/api/accounts/add-funds/route.ts)
  * [`app/api/accounts/transactions/route.ts`](./app/api/accounts/transactions/route.ts)
  * [`app/api/accounts/transfer/route.ts`](./app/api/accounts/transfer/route.ts)
* **TypeScript**: [`shared/types/common.ts`](./shared/types/common.ts)
  `BankAccount` (note: the TS type has an optional computed `balance`
  field that does not exist in the DB; it's filled in by the
  `accounts` queries layer by summing `account_transactions`).

### Why it exists
* Separates "where the money lives" from "what the money was for".
* The `is_cash` flag lets the UI render cash accounts differently and
  skip the payment-modes dropdown (cash has no UPI/Card sub-modes).
* Centralises the bank balance calculation — the balance of any
  account is `SUM(credit) - SUM(debit)` from `account_transactions`
  for that `bank_account_id`.

---

## 4. `payment_modes`

### Purpose
Per-bank-account payment methods (e.g. HDFC Bank has UPI and Card;
ICICI Bank has NEFT; Cash account has Cash). Lets sales and purchases
record not just which bank account was used, but the specific payment
channel.

### Columns

| Column             | Type     | Constraints / Default                                  |
|--------------------|----------|--------------------------------------------------------|
| `id`               | `UUID`   | PK, `gen_random_uuid()`                                |
| `bank_account_id`  | `UUID`   | NOT NULL, → `bank_accounts(id)` ON DELETE CASCADE      |
| `name`             | `TEXT`   | NOT NULL                                                |

### Foreign keys
* `bank_account_id` → `bank_accounts(id)` ON DELETE CASCADE.

### Inbound references
* `purchases.payment_mode_id`.
* `sales.payment_mode_id`.
* `payments_in.payment_mode_id`.
* `payments_out.payment_mode_id`.
* `account_transactions.payment_mode_id`.

### Application consumers
* **Domain**: [`domains/accounts/`](./domains/accounts) queries.
* **UI**: dropdowns in the sale, purchase, payment-in, payment-out,
  fund-entry, and transfer forms.
* **TypeScript**: [`shared/types/common.ts`](./shared/types/common.ts)
  `PaymentMode`.

### Why it exists
* Allows fine-grained reporting: "how much did we receive via UPI
  this month?"
* Cascade-on-delete from `bank_accounts`: deleting a bank account
  also removes its payment modes. The transaction rows that reference
  the deleted payment mode will have `payment_mode_id = NULL`
  (because they use a plain FK without `ON DELETE SET NULL`), which
  is acceptable for historical records.

---

## 5. `parties`

### Purpose
Both customers and suppliers live here. There is no `type` column —
a party is a customer if it has ever been referenced by a `sale` or
`payment_in`, and a supplier if it has ever been referenced by a
`purchase` or `payment_out`. A party can be both.

### Columns

| Column        | Type           | Constraints / Default        |
|---------------|----------------|------------------------------|
| `id`          | `UUID`         | PK, `gen_random_uuid()`      |
| `name`        | `TEXT`         | NOT NULL                     |
| `number`      | `TEXT`         |                              |
| `address`     | `TEXT`         |                              |
| `created_at`  | `TIMESTAMPTZ`  | default `now()`              |

### Foreign keys
None.

### Inbound references

* `purchases.party_id`.
* `sales.party_id`.
* `payments_in.party_id`.
* `payments_out.party_id`.
* `proforma_invoices.party_id`.

### Application consumers

* **Domain**: [`domains/parties/`](./domains/parties) (`index.ts`,
  `queries.ts`).
* **UI**:
  * [`app/(app)/parties/page.tsx`](./app/(app)/parties/page.tsx)
  * [`components/parties/PartyFormModal.tsx`](./components/parties/PartyFormModal.tsx)
* **TypeScript**: [`shared/types/common.ts`](./shared/types/common.ts)
  `Party` (with an optional computed `balance` field, populated by
  the parties query layer).
* **Invoice rendering**: the invoice templates (e.g.
  [`domains/invoice/templates/Prestige.tsx`](./domains/invoice/templates/Prestige.tsx))
  read `parties.name`, `parties.number`, `parties.address` to render
  the customer block.

### Why it exists
* One table for two roles means a customer who later becomes a
  supplier (or vice versa) doesn't need to be re-created.
* The lack of a `type` column is intentional — classifying parties
  by usage is cheaper than maintaining a denormalised flag.
* `number` (phone) is the primary contact channel and is used by
  the WhatsApp delivery pipeline.

---

## 6. `inventory_items`

### Purpose
The heart of the IMEI-tracked inventory. Each row is one physical
phone, identified by its IMEI. Rows track the device through its
lifecycle: bought → in stock → sold → (optionally re-acquired as a
trade-in and back in stock).

### Columns

| Column                       | Type             | Constraints / Default                                                   |
|------------------------------|------------------|-------------------------------------------------------------------------|
| `id`                         | `UUID`           | PK, `gen_random_uuid()`                                                  |
| `brand`                      | `TEXT`           | NOT NULL                                                                 |
| `model`                      | `TEXT`           | NOT NULL                                                                 |
| `imei`                       | `TEXT`           | NOT NULL                                                                 |
| `ram_rom`                    | `TEXT`           |                                                                          |
| `color`                      | `TEXT`           |                                                                          |
| `purchase_price`             | `NUMERIC(12, 2)` | NOT NULL                                                                 |
| `base_selling_price`         | `NUMERIC(12, 2)` | NOT NULL                                                                 |
| `status`                     | `TEXT`           | NOT NULL, CHECK in (`'in_stock'`,`'sold'`)                              |
| `source`                     | `TEXT`           | NOT NULL, CHECK in (`'purchase'`,`'trade_in'`)                           |
| `financial_year_id`          | `UUID`           | NOT NULL, → `financial_years(id)`                                        |
| `created_at`                  | `TIMESTAMPTZ`    | default `now()`                                                          |
| `origin_inventory_item_id`   | `UUID`           | → `inventory_items(id)` (self-reference, FK named `fk_origin_item`)       |
| `opening_entry_type`          | `TEXT`           | CHECK in (`'direct'`,`'carried_forward'`)                                |

**Partial unique index**:

```sql
CREATE UNIQUE INDEX idx_unique_imei_in_stock
  ON inventory_items(imei) WHERE status = 'in_stock';
```

This guarantees that at most one in-stock row exists per IMEI at any
time — but historical `sold` rows for the same IMEI can coexist.

### Foreign keys
* `financial_year_id` → `financial_years(id)`.
* `origin_inventory_item_id` → `inventory_items(id)` (self-reference).

### Inbound references
* `purchase_items.inventory_item_id`.
* `sale_items.inventory_item_id`.
* `trade_ins.new_inventory_item_id`.

### Application consumers

* **Domain**:
  * [`domains/inventory/`](./domains/inventory) (`index.ts`,
    `queries.ts`).
  * [`domains/sales/mutations.ts`](./domains/sales/mutations.ts) flips
    `status` from `in_stock` to `sold` when a sale is created, and
    back to `in_stock` if the sale is cancelled.
  * [`domains/purchases/mutations.ts`](./domains/purchases/mutations.ts)
    inserts new `in_stock` rows when a purchase is created.
  * [`domains/proformas/`](./domains/proformas) reads inventory items
    for the proforma item pickers (though proforma items are free-text
    descriptions, not FK to inventory).
* **UI**:
  * [`app/(app)/inventory/page.tsx`](./app/(app)/inventory/page.tsx)
  * [`app/(app)/exchange/page.tsx`](./app/(app)/exchange/page.tsx)
    (for trade-in creation, which produces a new `inventory_items` row
    with `source = 'trade_in'`).
  * Sale/purchase creation forms use the inventory items table to
    pick devices.
* **TypeScript**: [`shared/types/sales.ts`](./shared/types/sales.ts)
  `SaleItem.inventory_items` and
  [`shared/types/purchases.ts`](./shared/types/purchases.ts)
  `PurchaseItem.inventory_items`.

### Why it exists
* Enforces the IMEI uniqueness invariant for in-stock items via the
  partial unique index.
* The `origin_inventory_item_id` self-reference preserves the lineage
  of a trade-in device back to its original purchase, even after the
  device has been resold.
* `opening_entry_type` distinguishes devices added directly to the
  current financial year (`'direct'`) from devices carried forward
  from a previous closed year (`'carried_forward'`). This is used at
  year-end close to seed the new year's inventory.

---

## 7. `purchases`

### Purpose
Supplier bill header. Records the supplier (`party_id`), the bill
number, totals (`total`, `paid`, `due`), which bank account and
payment mode were used, the date, the financial year, and the
`active`/`cancelled` status.

### Columns

| Column                | Type             | Constraints / Default                                   |
|-----------------------|------------------|---------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                  |
| `bill_number`         | `TEXT`           | NOT NULL                                                 |
| `party_id`            | `UUID`           | NOT NULL, → `parties(id)`                                |
| `total`               | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `paid`                | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `due`                 | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `payment_mode_id`     | `UUID`           | → `payment_modes(id)`                                    |
| `date`                | `DATE`           | NOT NULL                                                 |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `status`              | `TEXT`           | NOT NULL, CHECK in (`'active'`,`'cancelled'`)            |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `party_id` → `parties(id)`.
* `bank_account_id` → `bank_accounts(id)`.
* `payment_mode_id` → `payment_modes(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `purchase_items.purchase_id` (CASCADE on delete).
* `payments_out.purchase_id`.
* `account_transactions.reference_id` (when `reference_type = 'purchase'`).

### Application consumers

* **Domain**: [`domains/purchases/`](./domains/purchases) (`index.ts`,
  `queries.ts`, `mutations.ts`).
* **UI**:
  * [`app/(app)/purchases/page.tsx`](./app/(app)/purchases/page.tsx)
  * [`app/(app)/purchases/new/page.tsx`](./app/(app)/purchases/new/page.tsx)
  * [`app/(app)/purchases/[id]/page.tsx`](./app/(app)/purchases/[id]/page.tsx)
* **TypeScript**: [`shared/types/purchases.ts`](./shared/types/purchases.ts)
  `Purchase`.

### Why it exists
* Decouples the bill header from its line items so a purchase with
  many items doesn't duplicate supplier/bank/date on every row.
* The `due` column lets the UI show outstanding supplier balances
  without recomputing from `payments_out`.
* `status = 'cancelled'` enables soft-delete so historical bills
  remain auditable.

---

## 8. `purchase_items`

### Purpose
Many-to-many join between `purchases` and `inventory_items`. Each row
records that a specific inventory item was acquired in a specific
purchase. The inventory item's `purchase_price` (on the
`inventory_items` row itself) is the per-item cost — there is no
`cost_price` column on this join table.

### Columns

| Column               | Type     | Constraints / Default                                   |
|----------------------|----------|---------------------------------------------------------|
| `id`                 | `UUID`   | PK, `gen_random_uuid()`                                  |
| `purchase_id`        | `UUID`   | NOT NULL, → `purchases(id)` ON DELETE CASCADE           |
| `inventory_item_id`  | `UUID`   | NOT NULL, → `inventory_items(id)`                        |

### Foreign keys
* `purchase_id` → `purchases(id)` CASCADE.
* `inventory_item_id` → `inventory_items(id)`.

### Inbound references
None.

### Application consumers

* **Domain**: [`domains/purchases/queries.ts`](./domains/purchases/queries.ts)
  expands purchase line items via PostgREST's nested-select syntax:
  `purchase_items(inventory_items(*))`.
* **TypeScript**: [`shared/types/purchases.ts`](./shared/types/purchases.ts)
  `PurchaseItem`.

### Why it exists
* Lets one purchase contain multiple devices (e.g. a 4-phone bulk
  order from Samsung Distributor, as in the seed data).
* Cascade-on-delete from `purchases` means deleting a purchase
  automatically removes its line items — but note that
  `inventory_items` themselves are **not** cascade-deleted, only the
  join rows. The application layer must clean up orphaned
  `inventory_items` if a purchase is hard-deleted.

---

## 9. `sales`

### Purpose
Customer bill header. Records the customer (`party_id`), the bill
number, the price breakdown (`total`, `discount`, `trade_in_credit`,
`final_total`, `paid`, `due`), the bank account and payment mode, the
date, the financial year, and the `active`/`cancelled` status.

### Columns

| Column                | Type             | Constraints / Default                                   |
|-----------------------|------------------|---------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                  |
| `bill_number`         | `TEXT`           | NOT NULL                                                 |
| `party_id`            | `UUID`           | NOT NULL, → `parties(id)`                                |
| `total`               | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `discount`            | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `trade_in_credit`     | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `final_total`         | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `paid`                | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `due`                 | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `payment_mode_id`     | `UUID`           | → `payment_modes(id)`                                    |
| `date`                | `DATE`           | NOT NULL                                                 |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `status`              | `TEXT`           | NOT NULL, CHECK in (`'active'`,`'cancelled'`)            |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `party_id` → `parties(id)`.
* `bank_account_id` → `bank_accounts(id)`.
* `payment_mode_id` → `payment_modes(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `sale_items.sale_id` (CASCADE on delete).
* `trade_ins.sale_id` (CASCADE on delete).
* `payments_in.sale_id`.
* `account_transactions.reference_id` (when `reference_type = 'sale'`).

### Application consumers

* **Domain**: [`domains/sales/`](./domains/sales) (`index.ts`,
  `queries.ts`, `mutations.ts`, `helpers.ts`).
* **UI**:
  * [`app/(app)/sales/page.tsx`](./app/(app)/sales/page.tsx)
  * [`app/(app)/sales/new/page.tsx`](./app/(app)/sales/new/page.tsx)
  * [`app/(app)/sales/[id]/page.tsx`](./app/(app)/sales/[id]/page.tsx)
  * [`app/(app)/sales/[id]/edit/page.tsx`](./app/(app)/sales/[id]/edit/page.tsx)
* **Invoice rendering**: the invoice builders in
  [`domains/invoice/builders.ts`](./domains/invoice/builders.ts)
  consume the sale's full shape (header + items + trade-ins + store
  + party) to build the view model for the PDF/PNG renderer.
* **TypeScript**: [`shared/types/sales.ts`](./shared/types/sales.ts)
  `Sale`, `SaleDetail`.

### Why it exists
* The split into `total` / `discount` / `trade_in_credit` /
  `final_total` is deliberate — the invoice templates render each
  step of the calculation, and the audit trail needs every step
  preserved.
* `trade_in_credit` is stored on the sale header (not derived from
  `trade_ins`) so that even if a trade-in row is later edited, the
  historical sale's credit remains as billed.

---

## 10. `sale_items`

### Purpose
Many-to-many join between `sales` and `inventory_items`. Records the
`sold_price` per item — distinct from `inventory_items.base_selling_price`
because the cashier can override the price at sale time.

### Columns

| Column               | Type             | Constraints / Default                                   |
|----------------------|------------------|---------------------------------------------------------|
| `id`                 | `UUID`           | PK, `gen_random_uuid()`                                  |
| `sale_id`            | `UUID`           | NOT NULL, → `sales(id)` ON DELETE CASCADE                |
| `inventory_item_id`  | `UUID`           | NOT NULL, → `inventory_items(id)`                        |
| `sold_price`         | `NUMERIC(12, 2)` | NOT NULL                                                 |

### Foreign keys
* `sale_id` → `sales(id)` CASCADE.
* `inventory_item_id` → `inventory_items(id)`.

### Inbound references
None.

### Application consumers
* **Domain**: [`domains/sales/queries.ts`](./domains/sales/queries.ts)
  expands sale items with their `inventory_items` via PostgREST.
* **Invoice rendering**: each sale item becomes one line in the
  invoice's item table.
* **TypeScript**: [`shared/types/sales.ts`](./shared/types/sales.ts)
  `SaleItem`.

### Why it exists
* `sold_price` lets a sale deviate from the `base_selling_price`
  without overwriting the base price (which is the default for the
  next sale of an identical device).
* Cascade-on-delete from `sales` keeps the join consistent.

---

## 11. `trade_ins`

### Purpose
Records devices the store accepted from a customer as part-exchange
during a sale. Each trade-in row tracks the device's brand/model/IMEI,
the `credit_value` subtracted from the sale total, the optional `mrp`
(for documentation), an optional `document_url` (uploaded to the
`documents` storage bucket), and `new_inventory_item_id` — the
new `inventory_items` row created when the trade-in device is
re-stocked for resale.

### Columns

| Column                  | Type             | Constraints / Default                                   |
|-------------------------|------------------|---------------------------------------------------------|
| `id`                    | `UUID`           | PK, `gen_random_uuid()`                                  |
| `sale_id`               | `UUID`           | NOT NULL, → `sales(id)` ON DELETE CASCADE                |
| `brand`                 | `TEXT`           | NOT NULL                                                 |
| `model`                 | `TEXT`           | NOT NULL                                                 |
| `imei`                  | `TEXT`           | NOT NULL                                                 |
| `ram_rom`               | `TEXT`           |                                                          |
| `color`                 | `TEXT`           |                                                          |
| `credit_value`          | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `mrp`                   | `NUMERIC(12, 2)` |                                                          |
| `document_url`          | `TEXT`           |                                                          |
| `new_inventory_item_id` | `UUID`           | → `inventory_items(id)`                                  |

### Foreign keys
* `sale_id` → `sales(id)` CASCADE.
* `new_inventory_item_id` → `inventory_items(id)`.

### Inbound references
None.

### Application consumers

* **Domain**: [`domains/sales/mutations.ts`](./domains/sales/mutations.ts)
  creates the trade-in row and the corresponding
  `inventory_items` row (with `source = 'trade_in'`,
  `origin_inventory_item_id` set if the device was previously in
  stock) when a sale with a trade-in is saved.
* **UI**: the trade-in section of the new-sale form.
* **Storage**: `document_url` is a path into the `documents` bucket.

### Why it exists
* Lets the store re-sell trade-in devices by linking them back to
  the originating sale.
* Preserves the trade-in's `credit_value` even if the new
  `inventory_items` row is later sold or modified.
* The `mrp` column is for invoice documentation only — it does not
  drive any calculation.

---

## 12. `payments_in`

### Purpose
Customer payments. Each row records an amount received from a party,
optionally linked to a specific sale, into a specific bank account via
a specific payment mode.

### Columns

| Column                | Type             | Constraints / Default                                   |
|-----------------------|------------------|---------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                  |
| `sale_id`             | `UUID`           | → `sales(id)`                                            |
| `party_id`            | `UUID`           | NOT NULL, → `parties(id)`                                |
| `amount`              | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `payment_mode_id`     | `UUID`           | → `payment_modes(id)`                                    |
| `date`                | `DATE`           | NOT NULL                                                 |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `sale_id` → `sales(id)` (nullable — a payment can be unlinked from
  any specific sale, e.g. an advance).
* `party_id` → `parties(id)`.
* `bank_account_id` → `bank_accounts(id)`.
* `payment_mode_id` → `payment_modes(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `account_transactions.reference_id` (when
  `reference_type = 'payment_in'`).

### Application consumers

* **Domain**: [`domains/accounts/mutations.ts`](./domains/accounts/mutations.ts)
  writes both this row and the matching `account_transactions` row
  in a single API call.
* **UI**: [`app/(app)/payments/page.tsx`](./app/(app)/payments/page.tsx)
  (split between payment-in and payment-out tabs).
* **API**: [`app/api/accounts/transactions/route.ts`](./app/api/accounts/transactions/route.ts)
  surfaces a unified ledger view that includes payments in.

### Why it exists
* Separates "money received" from "sale billed" — a customer may
  pay in instalments across multiple `payments_in` rows for one
  sale, or one `payments_in` row may settle multiple sales.
* Lets the store accept walk-in advance payments with no sale
  attached (`sale_id = NULL`).

---

## 13. `payments_out`

### Purpose
Supplier payments. Mirrors `payments_in` for outbound money.

### Columns

| Column                | Type             | Constraints / Default                                   |
|-----------------------|------------------|---------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                  |
| `purchase_id`         | `UUID`           | → `purchases(id)`                                        |
| `party_id`            | `UUID`           | NOT NULL, → `parties(id)`                                |
| `amount`              | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `payment_mode_id`     | `UUID`           | → `payment_modes(id)`                                    |
| `date`                | `DATE`           | NOT NULL                                                 |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `purchase_id` → `purchases(id)` (nullable).
* `party_id` → `parties(id)`.
* `bank_account_id` → `bank_accounts(id)`.
* `payment_mode_id` → `payment_modes(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `account_transactions.reference_id` (when
  `reference_type = 'payment_out'`).

### Application consumers
* Same pattern as `payments_in` — see above.

### Why it exists
Same rationale as `payments_in`: decouples "money paid to supplier"
from "purchase billed", so a purchase can be settled in multiple
instalments.

---

## 14. `account_transactions`

### Purpose
The append-only ledger. Every money movement in or out of any bank
account writes exactly one row here. The ledger is the source of
truth for "what is the current balance of bank account X" — the
balance is `SUM(credit) - SUM(debit)` filtered by `bank_account_id`.

### Columns

| Column                | Type             | Constraints / Default                                                                 |
|-----------------------|------------------|---------------------------------------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                                                |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                                                        |
| `payment_mode_id`     | `UUID`           | → `payment_modes(id)`                                                                  |
| `type`                | `TEXT`           | NOT NULL, CHECK in (`'credit'`,`'debit'`)                                              |
| `amount`              | `NUMERIC(12, 2)` | NOT NULL                                                                               |
| `date`                | `DATE`           | NOT NULL                                                                               |
| `reference_type`      | `TEXT`           | NOT NULL, CHECK in (`'sale'`,`'purchase'`,`'payment_in'`,`'payment_out'`,`'add_funds'`,`'transfer'`,`'opening_balance'`,`'sale_cancelled'`) |
| `reference_id`        | `UUID`           | NOT NULL (polymorphic — no FK)                                                          |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                                                      |
| `notes`               | `TEXT`           |                                                                                        |
| `transfer_group_id`   | `UUID`           | (groups the two legs of a transfer)                                                    |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                                                        |

### Foreign keys
* `bank_account_id` → `bank_accounts(id)`.
* `payment_mode_id` → `payment_modes(id)`.
* `financial_year_id` → `financial_years(id)`.
* `reference_id` is **not** a typed foreign key — it's a polymorphic
  pointer whose target table is identified by `reference_type`.

### Inbound references
None. (Ledger rows are referenced only via the polymorphic
`reference_id` from the application layer, never via FK.)

### Application consumers

* **Domain**: [`domains/accounts/queries.ts`](./domains/accounts/queries.ts)
  reads this table to compute balances and statement rows.
* **Platform**: [`platform/services/accounts.ts`](./platform/services/accounts.ts)
  exposes the `recordTransaction` helper used by sale, purchase,
  payment, fund, transfer, and cancellation flows.
* **UI**: [`app/(app)/accounts/page.tsx`](./app/(app)/accounts/page.tsx).
* **API**:
  [`app/api/accounts/transactions/route.ts`](./app/api/accounts/transactions/route.ts).

### Why it exists
* A single ledger makes balance computation, statement generation,
  and reporting trivial — one `GROUP BY bank_account_id, type`
  query.
* The polymorphic `reference_type` + `reference_id` lets the ledger
  reference any of seven source tables without needing seven nullable
  FK columns. The trade-off is that referential integrity is enforced
  by the application, not the database.
* `transfer_group_id` is the pattern used for the two legs of an
  inter-account transfer: one row credits the source account, another
  debits the destination, both share the same `transfer_group_id`.

---

## 15. `account_fund_entries`

### Purpose
Manual fund additions to a bank account (e.g. "owner deposited
₹50,000 personal cash into HDFC account"). The source of the
`reference_type = 'add_funds'` rows in `account_transactions`.

### Columns

| Column                | Type             | Constraints / Default                                   |
|-----------------------|------------------|---------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                  |
| `bank_account_id`     | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `amount`              | `NUMERIC(12, 2)` | NOT NULL, CHECK `amount > 0`                             |
| `date`                | `DATE`           | NOT NULL                                                 |
| `notes`               | `TEXT`           |                                                          |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `bank_account_id` → `bank_accounts(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `account_transactions.reference_id` (when
  `reference_type = 'add_funds'`).

### Application consumers

* **API**:
  [`app/api/accounts/add-funds/route.ts`](./app/api/accounts/add-funds/route.ts).
* **UI**: the "Add Funds" button on the accounts page.

### Why it exists
* Gives the store a way to record deposits that aren't tied to a
  sale or supplier refund — common in cash-heavy retail.
* The `amount > 0` CHECK constraint enforces that funds are always
  positive (use `account_transfers` to move money out).

---

## 16. `account_transfers`

### Purpose
Internal transfers between two bank accounts (e.g. "move ₹10,000 from
Cash to HDFC"). Source of the `reference_type = 'transfer'` rows in
`account_transactions` — each transfer writes two ledger rows (debit
on the source, credit on the destination) sharing the same
`transfer_group_id`.

### Columns

| Column                  | Type             | Constraints / Default                                   |
|-------------------------|------------------|---------------------------------------------------------|
| `id`                    | `UUID`           | PK, `gen_random_uuid()`                                  |
| `from_bank_account_id`  | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `to_bank_account_id`    | `UUID`           | NOT NULL, → `bank_accounts(id)`                          |
| `amount`                | `NUMERIC(12, 2)` | NOT NULL, CHECK `amount > 0`                             |
| `date`                  | `DATE`           | NOT NULL                                                 |
| `notes`                 | `TEXT`           |                                                          |
| `financial_year_id`     | `UUID`           | NOT NULL, → `financial_years(id)`                        |
| `created_at`             | `TIMESTAMPTZ`    | default `now()`                                          |

Table-level constraint:
```sql
CONSTRAINT transfer_different_accounts
  CHECK (from_bank_account_id != to_bank_account_id)
```

### Foreign keys
* `from_bank_account_id` → `bank_accounts(id)`.
* `to_bank_account_id` → `bank_accounts(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `account_transactions.reference_id` (when
  `reference_type = 'transfer'`).

### Application consumers

* **API**:
  [`app/api/accounts/transfer/route.ts`](./app/api/accounts/transfer/route.ts).
* **UI**: the "Transfer" button on the accounts page.

### Why it exists
* Allows cash-to-bank and bank-to-bank movements to be tracked
  without distortion of sale/purchase totals.
* The `transfer_different_accounts` CHECK constraint is a database
  backstop for what the UI also enforces.

---

## 17. `proforma_invoices`

### Purpose
Quotation headers. A proforma is a "pre-invoice" given to a customer
before they decide to buy. It carries the same price breakdown as a
sale but no payment rows and no inventory linkage (items are
free-text descriptions, not FKs to `inventory_items`).

### Columns

| Column                | Type             | Constraints / Default                                                          |
|-----------------------|------------------|-------------------------------------------------------------------------------|
| `id`                  | `UUID`           | PK, `gen_random_uuid()`                                                        |
| `bill_number`         | `TEXT`           | NOT NULL                                                                       |
| `party_id`            | `UUID`           | NOT NULL, → `parties(id)`                                                      |
| `total`               | `NUMERIC(12, 2)` | NOT NULL                                                                       |
| `discount`            | `NUMERIC(12, 2)` | NOT NULL, default 0                                                            |
| `trade_in_credit`     | `NUMERIC(12, 2)` | NOT NULL, default 0                                                            |
| `final_total`         | `NUMERIC(12, 2)` | NOT NULL                                                                       |
| `date`                | `DATE`           | NOT NULL                                                                       |
| `financial_year_id`   | `UUID`           | NOT NULL, → `financial_years(id)`                                              |
| `status`              | `TEXT`           | NOT NULL, CHECK in (`'active'`,`'converted'`,`'void'`), default `'active'`     |
| `created_at`           | `TIMESTAMPTZ`    | default `now()`                                                                |

### Foreign keys
* `party_id` → `parties(id)`.
* `financial_year_id` → `financial_years(id)`.

### Inbound references
* `proforma_invoice_items.proforma_invoice_id` (CASCADE).
* `proforma_trade_ins.proforma_invoice_id` (CASCADE).

### Application consumers

* **Domain**: [`domains/proformas/`](./domains/proformas) (`index.ts`,
  `queries.ts`).
* **UI**:
  * [`app/(app)/proformas/page.tsx`](./app/(app)/proformas/page.tsx)
  * [`app/(app)/proformas/new/page.tsx`](./app/(app)/proformas/new/page.tsx)
  * [`app/(app)/proformas/[id]/page.tsx`](./app/(app)/proformas/[id]/page.tsx)
* **Invoice rendering**: proformas go through the same invoice
  builder pipeline as sales, with the `proforma` template selected.

### Why it exists
* Lets the store issue quotations without committing inventory
  (no `inventory_items` FK) or payments.
* The `converted` status records that a proforma was turned into a
  real sale; the `void` status records that it was abandoned.
* The triple-status `active | converted | void` was added by the
  `void_migration.sql` (consolidated into the bootstrap).

---

## 18. `proforma_invoice_items`

### Purpose
Line items on a quotation. Unlike `sale_items`, these are free-text
descriptions paired with a quantity, rate, per-item discount and
computed value — there is no link to `inventory_items`.

### Columns

| Column                  | Type             | Constraints / Default                                   |
|-------------------------|------------------|---------------------------------------------------------|
| `id`                    | `UUID`           | PK, `gen_random_uuid()`                                  |
| `proforma_invoice_id`   | `UUID`           | NOT NULL, → `proforma_invoices(id)` ON DELETE CASCADE    |
| `description`           | `TEXT`           | NOT NULL                                                 |
| `qty`                   | `INTEGER`        | NOT NULL, default 1                                      |
| `rate`                  | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `discount`              | `NUMERIC(12, 2)` | NOT NULL, default 0                                      |
| `value`                 | `NUMERIC(12, 2)` | NOT NULL                                                 |

### Foreign keys
* `proforma_invoice_id` → `proforma_invoices(id)` CASCADE.

### Inbound references
None.

### Application consumers
* **Domain**: [`domains/proformas/queries.ts`](./domains/proformas/queries.ts).
* **UI**: proforma create/edit form.

### Why it exists
* Free-text descriptions let a salesperson quote items the store
  doesn't yet stock — e.g. "Samsung Galaxy Buds 2 Pro" without an
  inventory row.
* The per-item `discount` was added by
  `proforma_item_discount_migration.sql` (consolidated into the
  bootstrap).

---

## 19. `proforma_trade_ins`

### Purpose
Estimated trade-ins on a quotation. Like
`proforma_invoice_items`, this is a free-text estimate, not a real
inventory-affecting trade-in (which would live in `trade_ins`).

### Columns

| Column                  | Type             | Constraints / Default                                   |
|-------------------------|------------------|---------------------------------------------------------|
| `id`                    | `UUID`           | PK, `gen_random_uuid()`                                  |
| `proforma_invoice_id`   | `UUID`           | → `proforma_invoices(id)` ON DELETE CASCADE              |
| `description`           | `TEXT`           | NOT NULL                                                 |
| `qty`                   | `INTEGER`        |                                                          |
| `rate`                  | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `value`                 | `NUMERIC(12, 2)` | NOT NULL                                                 |
| `created_at`             | `TIMESTAMPTZ`    | default `now()`                                          |

### Foreign keys
* `proforma_invoice_id` → `proforma_invoices(id)` CASCADE.

### Inbound references
None.

### Application consumers
* **Domain**: [`domains/proformas/`](./domains/proformas).
* **UI**: the trade-in section of the proforma form.

### Why it exists
* Lets a proforma include an estimated trade-in credit (matching
  the `trade_in_credit` column on the proforma header) without
  committing the store to accept the trade-in.
* This table was added by `proforma_trade_in_migration.sql`
  (consolidated into the bootstrap).

---

## 20. `whatsapp_settings`

### Purpose
Per-user WhatsApp delivery configuration. Currently the table exists
and is seeded, but the runtime WhatsApp delivery pipeline actually
reads from `localStorage` in the browser — this table is the
intended future home for the same configuration once the pipeline
moves server-side.

### Columns

| Column                    | Type           | Constraints / Default                                   |
|---------------------------|----------------|---------------------------------------------------------|
| `id`                      | `UUID`         | PK, `gen_random_uuid()`                                  |
| `owner_user_id`            | `UUID`         | NOT NULL, UNIQUE, → `auth.users(id)`                     |
| `auto_send_sale`           | `BOOLEAN`      | NOT NULL, default `false`                                |
| `auto_send_proforma`       | `BOOLEAN`      | NOT NULL, default `false`                                |
| `sale_message_template`    | `TEXT`         | NOT NULL, default (see bootstrap for full template)      |
| `proforma_message_template`| `TEXT`         | NOT NULL, default (see bootstrap for full template)      |
| `created_at`               | `TIMESTAMPTZ`  | default `now()`                                          |
| `updated_at`               | `TIMESTAMPTZ`  | default `now()`                                          |

### Foreign keys
* `owner_user_id` → `auth.users(id)` UNIQUE. (This is the only
  business table with a real FK to `auth.users`.)

### Inbound references
None.

### Application consumers
* **Hook**: [`hooks/useDeliverySettings.ts`](./hooks/useDeliverySettings.ts).
* **UI**: [`components/settings/WhatsAppPlatformPanel.tsx`](./components/settings/WhatsAppPlatformPanel.tsx).
* **Platform**: [`platform/whatsapp/`](./platform/whatsapp).
* **API**: [`app/api/whatsapp/`](./app/api/whatsapp) routes.

### Why it exists
* Future-proofs the WhatsApp pipeline: the seed sets up one row
  with sensible template defaults so that switching the runtime
  from `localStorage` to this table requires no schema change.
* The `UNIQUE` constraint on `owner_user_id` enforces one
  settings row per user.

---

## 21. Supabase-managed tables

The bootstrap also references two tables that exist on every Supabase
project but are managed by Supabase, not by this script.

### 21.1 `auth.users`

* Managed by GoTrue.
* The mock-user seed inserts one row directly with `crypt()`-hashed
  password (`mockpassword123`).
* Referenced by `store.owner_user_id` (logical FK, no constraint)
  and `whatsapp_settings.owner_user_id` (real FK).

### 21.2 `storage.objects`

* Managed by Supabase Storage.
* Has two bucket-id values used by FUSION-ONE: `store_assets` and
  `documents`.
* Storage policies (see
  [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md)) restrict read,
  write, update, delete per bucket.

---

## 22. Cross-table dependency matrix

The matrix below summarises which tables reference which. Rows are
parents, columns are children. `→` means the child has a foreign
key to the parent.

| Parent ↓ \ Child →       | FY  | Store | BA  | PM  | Parties | Inv | Purch | PurItem | Sale | SaleItem | TradeIn | PayIn | PayOut | AcctTx | FundEnt | Transfer | Prof | ProfItem | ProfTI | WA   |
|--------------------------|-----|-------|-----|-----|---------|-----|-------|---------|------|----------|---------|-------|--------|--------|---------|----------|------|----------|-------|------|
| `financial_years`        |  -  |       |     |     |         |  →  |   →   |         |  →   |          |         |   →   |   →    |   →    |    →    |    →     |  →   |          |       |      |
| `store`                  |     |   -   |     |     |         |     |       |         |      |          |         |       |        |        |         |          |      |          |       |      |
| `bank_accounts`          |     |       |  -  |  →  |         |     |   →   |         |  →   |          |         |   →   |   →    |   →    |    →    | → / →    |      |          |       |      |
| `payment_modes`          |     |       |     |  -  |         |     |   →   |         |  →   |          |         |   →   |   →    |   →    |         |          |      |          |       |      |
| `parties`                |     |       |     |     |    -    |     |   →   |         |  →   |          |         |   →   |   →    |        |         |          |  →   |          |       |      |
| `inventory_items`        |  →  |       |     |     |         |  -  |       |    →    |      |    →     |    →    |       |        |        |         |          |      |          |       |      |
| `purchases`              |  →  |       |  →  |  →  |    →    |     |   -   |    →    |      |          |         |       |        |        |         |          |      |          |       |      |
| `purchase_items`         |     |       |     |     |         |  →  |   →   |    -    |      |          |         |       |        |        |         |          |      |          |       |      |
| `sales`                  |  →  |       |  →  |  →  |    →    |     |       |         |  -   |    →     |    →    |  →(n) |        |        |         |          |      |          |       |      |
| `sale_items`             |     |       |     |     |         |  →  |       |         |  →   |    -     |         |       |        |        |         |          |      |          |       |      |
| `trade_ins`              |     |       |     |     |         |  →  |       |         |  →   |          |    -    |       |        |        |         |          |      |          |       |      |
| `payments_in`            |  →  |       |  →  |  →  |    →    |     |       |         |  →   |          |         |   -   |        |        |         |          |      |          |       |      |
| `payments_out`           |  →  |       |  →  |  →  |    →    |     |   →   |         |      |          |         |       |    -   |        |         |          |      |          |       |      |
| `account_transactions`   |  →  |       |  →  |  →  |         |     |       |         |      |          |         |       |        |    -   |         |          |      |          |       |      |
| `account_fund_entries`   |  →  |       |  →  |     |         |     |       |         |      |          |         |       |        |        |    -    |          |      |          |       |      |
| `account_transfers`      |  →  |       |  →  |     |         |     |       |         |      |          |         |       |        |        |         |    -     |      |          |       |      |
| `proforma_invoices`      |  →  |       |     |     |    →    |     |       |         |      |          |         |       |        |        |         |          |  -   |    →     |   →   |      |
| `proforma_invoice_items` |     |       |     |     |         |     |       |         |      |          |         |       |        |        |         |          |  →   |    -     |       |      |
| `proforma_trade_ins`     |     |       |     |     |         |     |       |         |      |          |         |       |        |        |         |          |  →   |          |   -   |      |
| `whatsapp_settings`      |     |       |     |     |         |     |       |         |      |          |         |       |        |        |         |          |      |          |       |  -  |

* `→(n)` denotes a nullable FK.
* `account_transactions.reference_id` is polymorphic and therefore
  not shown as a real FK — it logically points to whichever table
  matches its `reference_type`.

---

## 23. Storage buckets (also referenced by tables)

| Bucket         | Referenced from columns                          |
|----------------|--------------------------------------------------|
| `store_assets` | `store.logo_url`, `store.signature_url`           |
| `documents`    | `trade_ins.document_url`                          |

The buckets themselves are created in `storage.buckets`; the
policies live on `storage.objects` (filtered by `bucket_id`).

---

## 24. Reading order for a new engineer

If you're new to the codebase, read the tables in this order to
build up a mental model from least to most dependent:

1. `financial_years` — the scope.
2. `store` — the tenant.
3. `bank_accounts` and `payment_modes` — the money containers.
4. `parties` — the people.
5. `inventory_items` — the goods.
6. `purchases` + `purchase_items` — how goods arrive.
7. `sales` + `sale_items` + `trade_ins` — how goods leave.
8. `payments_in` + `payments_out` — how cash actually moves.
9. `account_transactions` + `account_fund_entries` +
   `account_transfers` — the unified ledger.
10. `proforma_invoices` + `proforma_invoice_items` +
    `proforma_trade_ins` — pre-sale quotations.
11. `whatsapp_settings` — messaging configuration.

Then read [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md) and
[`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md) to understand
the security envelope that wraps the entire schema.
