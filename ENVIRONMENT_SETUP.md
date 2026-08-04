# FUSION-ONE — Environment Setup

> Source of truth:
> * [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql)
> * [`SUPABASE_SEED.sql`](./SUPABASE_SEED.sql)
> * [`platform/supabase/client.ts`](./platform/supabase/client.ts)
> * [`platform/supabase/server.ts`](./platform/supabase/server.ts)
> * [`platform/supabase/admin.ts`](./platform/supabase/admin.ts)
> * [`.env`](./.env) (local-only — see section 2.1)

This document walks through setting up an **isolated development
environment** for FUSION-ONE from scratch: the env vars you need,
the SQL scripts you must run in order, the mock user that the seed
data depends on, how to load and reload the seed data, and how to
start the Next.js dev server.

---

## 1. Overview

FUSION-ONE is a Next.js 16 application backed by Supabase. A working
dev environment consists of four things:

1. **A Supabase project** (cloud-hosted at
   [supabase.com](https://supabase.com) or self-hosted via Docker)
   that exposes Postgres, Auth, and Storage.
2. **The bootstrap SQL** (`SUPABASE_BOOTSTRAP.sql`) run on that
   project, which creates all 20 tables, RLS policies, storage
   buckets, storage policies, indexes, and the `is_owner()`
   function.
3. **The seed SQL** (`SUPABASE_SEED.sql`) run after the bootstrap,
   which creates a mock user and a complete demo dataset.
4. **The Next.js dev server** running locally, configured with the
   project's URL and anon key (and the service-role key for the
   admin client).

The following sections walk through each step.

### 1.1 What "isolated" means

* Each developer should have their own Supabase project so that
  schema experiments and seed-data resets do not affect teammates.
* The mock user is unique to the seeded project; using a different
  project's URL/keys will not authenticate the mock user.
* The dev server runs on port 3000 of the developer's machine and
  talks only to that developer's Supabase project.

### 1.2 What you need before you start

* Node.js 20+. FUSION-ONE uses `npm` for package management.
* A Supabase account (free tier is sufficient for development).
* `psql` (optional — useful for inspecting the database, but the
  Supabase dashboard SQL editor works fine too).
* The Supabase project URL, anon key, and service-role key — copy
  these from your Supabase dashboard's "Settings → API" page.

---

## 2. Environment Variables

### 2.1 Required env vars

The Next.js app reads three environment variables at build time /
runtime:

| Variable                            | Where used                                         | Example value                                     |
|-------------------------------------|----------------------------------------------------|---------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`          | All three Supabase clients (browser, server, admin). | `https://abcdefghijklm.supabase.co`                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`     | Browser and server clients (RLS-enforced).         | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`          |
| `SUPABASE_SERVICE_ROLE_KEY`         | Admin client only (RLS-bypassing, server-side).   | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`          |

The `NEXT_PUBLIC_` prefix is required for variables that must be
inlined into the browser bundle. The service-role key has no
prefix because it must **never** be exposed to the browser — see
section 2.3.

### 2.2 Where to put them

Create a `.env.local` file in the project root (Next.js loads it
automatically):

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

The repo also ships a `.env` file (containing only
`DATABASE_URL=file:/home/z/my-project/db/custom.db` — a leftover
from a previous Prisma-based setup that is no longer used by
Supabase-backed code). Do not delete it; some scripts may still
reference it.

### 2.3 Security: the service-role key

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. If it leaks into the
browser bundle (e.g. you accidentally import
[`platform/supabase/admin.ts`](./platform/supabase/admin.ts) from a
Client Component), every visitor can read and write every tenant's
data. To prevent this:

* Never add `NEXT_PUBLIC_` to `SUPABASE_SERVICE_ROLE_KEY`.
* Only import `platform/supabase/admin.ts` from
  [`app/api/**`](./app/api) route handlers or other server-only
  modules.
* ESLint is configured to flag accidental imports — see
  [`eslint.config.mjs`](./eslint.config.mjs).

### 2.4 Optional env vars

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT`     | Port the Next.js dev server binds to. FUSION-ONE is locked to 3000 by the platform. | `3000` |
| `NODE_ENV` | Standard Next.js variable; `development` enables verbose logging. | `development` |

### 2.5 Verifying the env

After creating `.env.local`, restart the dev server and verify
the Supabase clients can connect:

```ts
// Throw this in any server component temporarily:
import { createClient } from '@/platform/supabase/server';

const supabase = await createClient();
const { data, error } = await supabase.from('store').select('id, name').limit(1);
console.log({ data, error });
```

If you see an empty `data` array and no `error`, you're
authenticated as a user who owns no store (which is correct for a
brand-new project that hasn't been seeded yet). If you see an
`error`, your env vars or URL are wrong.

---

## 3. SQL Setup — Bootstrap

### 3.1 Running the bootstrap

1. Open your Supabase project dashboard.
2. Navigate to **SQL Editor → New query**.
3. Paste the entire contents of
   [`SUPABASE_BOOTSTRAP.sql`](./SUPABASE_BOOTSTRAP.sql) (≈ 480
   lines).
4. Click **Run**.

The script takes a few seconds to complete. You should see
"Success. No rows returned." at the bottom of the editor.

### 3.2 What the bootstrap does, in order

| Step | Section header in the SQL file | Action |
|------|---------------------------------|--------|
| 1    | Extensions                      | Enables `btree_gist`. |
| 2    | 1. Tables                       | Creates all 20 business tables with primary keys, foreign keys, CHECK constraints, and the partial unique index on `inventory_items`. |
| 3    | 2. Row Level Security           | Enables RLS on all 20 tables. |
| 4    | 3. Security Functions           | Creates (or replaces) the `is_owner()` function. |
| 5    | 4. RLS Policies                 | Creates 20 RLS policies on the business tables. |
| 6    | 5. Storage Buckets              | Creates the `store_assets` and `documents` storage buckets. |
| 7    | 6. Storage Policies             | Creates 8 storage policies (4 per bucket). |
| 8    | 7. Indexes                     | Creates 13 B-tree indexes on hot query columns. |

### 3.3 Verifying the bootstrap

Run the following queries in the SQL editor to verify each step:

```sql
-- Should return 20 tables (excluding auth- and storage-managed ones)
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

-- Should return 20 RLS-enabled tables
SELECT relname FROM pg_class
WHERE relrowsecurity = true AND relnamespace = 'public'::regnamespace
ORDER BY relname;

-- Should return 1 function: is_owner
SELECT proname FROM pg_proc
WHERE pronamespace = 'public'::regnamespace;

-- Should return 28 policies (20 RLS + 8 storage)
SELECT count(*) FROM pg_policies
WHERE schemaname IN ('public', 'storage');

-- Should return 2 buckets
SELECT id, name, public FROM storage.buckets;
```

### 3.4 Resetting the database

If you need to start over (e.g. after a schema experiment gone
wrong), use
[`sql/reset_database.sql`](./sql/reset_database.sql):

```sql
-- In the Supabase SQL editor, paste the contents of sql/reset_database.sql
-- This drops every business table and the is_owner() function.
```

Then re-run `SUPABASE_BOOTSTRAP.sql` followed by
`SUPABASE_SEED.sql`.

**Warning**: `reset_database.sql` permanently deletes all data.
Use it only on development projects.

---

## 4. SQL Setup — Mock User

The seed script depends on a Supabase Auth user existing with a
specific user ID. The bootstrap does **not** create this user (it
can't — the bootstrap only manages the `public` schema). The seed
script creates it as its first action (section 0 of
`SUPABASE_SEED.sql`).

### 4.1 Mock user credentials

| Field     | Value                                           |
|-----------|-------------------------------------------------|
| Email     | `mock@email.com`                                |
| Password  | `mockpassword123`                                |
| UID       | `975839b1-18b7-4339-a9dd-00863521bb29`           |

These credentials are hardcoded in
[`SUPABASE_SEED.sql`](./SUPABASE_SEED.sql) section 0. To log in
as the mock user from the FUSION-ONE UI, navigate to `/login` and
enter these credentials.

### 4.2 How the seed creates the mock user

```sql
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
SELECT
  '975839b1-18b7-4339-a9dd-00863521bb29',
  'mock@email.com',
  crypt('mockpassword123', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated'
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE id = '975839b1-18b7-4339-a9dd-00863521bb29'
);
```

Key points:

* The `crypt()` + `gen_salt('bf')` combination creates a bcrypt
  password hash that Supabase Auth recognises. The plaintext
  `mockpassword123` is what you type at the login screen.
* The `WHERE NOT EXISTS` guard makes the insert idempotent —
  re-running the seed never fails because the user already exists.
* `email_confirmed_at = now()` skips Supabase's email-confirmation
  flow, so the mock user can log in immediately without clicking a
  confirmation link.
* `aud = 'authenticated'` and `role = 'authenticated'` make the
  user appear in the standard Supabase auth dashboard.

### 4.3 Why insert into `auth.users` directly?

Supabase Auth normally creates users via its HTTP API
(`supabase.auth.admin.createUser` or the public
`supabase.auth.signUp`). The seed script inserts directly into
`auth.users` because:

* It's idempotent and pure-SQL — no Node.js script needed.
* It guarantees the user has the exact UID
  `975839b1-18b7-4339-a9dd-00863521bb29` that the rest of the
  seed data references.
* It works even on a brand-new Supabase project with no auth
  configuration (no email templates, no SMTP).

**Caveat**: Direct inserts into `auth.users` are officially
unsupported by Supabase and may break if Supabase changes the
schema of `auth.users` in a future version. If the seed starts
failing on the section 0 insert, check the Supabase release notes
for `auth.users` schema changes.

### 4.4 Verifying the mock user exists

```sql
SELECT id, email, email_confirmed_at, role
FROM auth.users
WHERE id = '975839b1-18b7-4339-a9dd-00863521bb29';
```

You can also sign in via the UI at `/login` with
`mock@email.com` / `mockpassword123`.

---

## 5. SQL Setup — Seed Data

### 5.1 Running the seed

1. Make sure the bootstrap has been run (section 3) and the mock
   user exists (section 4 — the seed script creates it
   automatically).
2. Open the Supabase SQL editor.
3. Paste the entire contents of
   [`SUPABASE_SEED.sql`](./SUPABASE_SEED.sql) (≈ 400 lines).
4. Click **Run**.

The script takes a second or two. You should see "Success. No
rows returned."

### 5.2 What the seed creates

The seed creates a complete demo dataset for a fictional store
called "Fusion Gadgets" in Bengaluru, India. The dataset is
summarised at the bottom of `SUPABASE_SEED.sql`:

| #  | Entity                       | Count | Notes                                                              |
|----|------------------------------|-------|--------------------------------------------------------------------|
| 0  | Mock user                    | 1     | The user that owns the store (section 4 above).                    |
| 1  | Financial year               | 1     | FY 2025-26 (1 Apr 2025 → 31 Mar 2026), status `active`.            |
| 2  | Store                        | 1     | "Fusion Gadgets", owned by the mock user.                         |
| 3  | Bank accounts                | 3     | Cash, HDFC Bank, ICICI Bank.                                       |
| 4  | Payment modes                | 4     | UPI (HDFC), Card (HDFC), NEFT (ICICI), Cash (Cash).               |
| 5  | Parties                      | 7     | 5 customers + 2 suppliers.                                         |
| 6  | Inventory items              | 10    | 7 in stock (incl. 1 trade-in), 2 sold, 1 trade-in.                |
| 7  | Purchases                    | 2     | 4 Samsung items + 3 Apple items.                                   |
| 8  | Sales                        | 3     | 2 iPhone (fully paid), 1 OnePlus (partial + trade-in).             |
| 9  | Trade-ins                    | 1     | Vivo V27 Pro against sale 3.                                       |
| 10 | Payments in                  | 3     | One per sale.                                                      |
| 11 | Payments out                 | 2     | One per purchase (full + partial).                                 |
| 12 | Account transactions         | 5     | One per payment (2 debits + 3 credits).                            |
| 13 | Proforma invoice             | 1     | 2 items, status `active`.                                          |
| 14 | WhatsApp settings            | 1     | Auto-send disabled, default templates.                              |

### 5.3 Deterministic IDs

Every seed row uses a deterministic UUID. For example:

* The financial year is `a1b2c3d4-0001-4000-8000-000000000001`.
* The store is `a1b2c3d4-0002-4000-8000-000000000002`.
* Bank accounts are `ba-0001-0000-0000-000000000001` etc.
* Parties are `pt-0001-0000-0000-000000000001` etc.

The deterministic IDs mean:

* Re-running the seed is safe — every `INSERT ... ON CONFLICT (id)
  DO NOTHING` skips rows that already exist.
* Tests can hardcode references to specific IDs (e.g. the mock
  store ID) without flakiness.
* The seed data is portable across projects (assuming the mock
  user has been created with the matching UID).

### 5.4 Bill-number counters

The seed sets `financial_years.sale_counter = 3`,
`purchase_counter = 2`, `proforma_counter = 1` because those are
the counts of seeded records. New bills created through the UI will
increment from these starting points: the next sale will be
`SAL-2025-26-0004`, the next purchase `PUR-2025-26-0003`, the next
proforma `PI-2025-26-0002`.

### 5.5 Re-running the seed

To re-run the seed (e.g. after tweaking it):

1. Run [`sql/reset_database.sql`](./sql/reset_database.sql) to drop
   all tables (this also drops the seed data, but does not drop the
   mock user — `auth.users` is not in the reset script).
2. Re-run `SUPABASE_BOOTSTRAP.sql`.
3. Re-run `SUPABASE_SEED.sql`.

If you want to reset the mock user too (e.g. to test the onboarding
flow), delete it explicitly:

```sql
DELETE FROM auth.users WHERE id = '975839b1-18b7-4339-a9dd-00863521bb29';
```

Then re-run the seed, which will recreate the user via section 0.

### 5.6 Verifying the seed

```sql
-- Should return 1 row: Fusion Gadgets
SELECT name, owner_user_id, onboarding_complete
FROM store;

-- Should return 10 inventory items
SELECT count(*) FROM inventory_items;

-- Should return 3 sales
SELECT bill_number, status FROM sales ORDER BY date;

-- Should return 5 ledger entries
SELECT reference_type, type, amount FROM account_transactions ORDER BY date;
```

You can also log in to the UI at `/login` as
`mock@email.com` / `mockpassword123` and browse the seeded data
through the dashboard, sales, purchases, inventory, parties, and
accounts pages.

---

## 6. Starting the Dev Server

### 6.1 Install dependencies

```bash
cd /home/z/my-project
npm install
```

This installs all dependencies listed in
[`package.json`](./package.json). The lockfile
([`package-lock.json`](./package-lock.json)) ensures reproducible installs.

### 6.2 Run the dev server

```bash
npm run dev
```

This starts the Next.js dev server on port 3000. The dev server
watches for file changes and hot-reloads automatically.

> **Important**: the cloud sandbox automatically runs `npm run dev`
> for you. Do **not** start a second instance — the port will
> conflict.

### 6.3 Verifying the dev server

Open the Preview Panel on the right side of the cloud IDE to see
the running application. If you're using the web interface, click
the **"Open in New Tab"** button above the Preview Panel to view
the app in a separate browser tab.

You should see the FUSION-ONE login page. Log in with
`mock@email.com` / `mockpassword123` to see the seeded store's
dashboard.

### 6.4 Reading the dev log

The dev server's stdout is written to
[`/home/z/my-project/dev.log`](./dev.log). Read this file to debug
server-side errors:

```bash
tail -n 200 /home/z/my-project/dev.log
```

Always check `dev.log` after making code changes — if the dev
server failed to compile a file, the error appears here, not in the
browser.

### 6.5 Lint

```bash
npm run lint
```

Runs ESLint on the entire project. Fix any errors before
committing. The linter is configured to catch accidental imports
of `platform/supabase/admin.ts` from client code (see section 2.3
above).

### 6.6 Production build

The cloud sandbox does not allow `npm run build` — the dev server
is the only way to run the app. If you need to test a production
build locally (outside the sandbox), use `npm run build && npm run
start`, but be aware that the cloud preview panel will not show
this.

---

## 7. End-to-End Verification Checklist

Run through this checklist after a fresh setup to confirm
everything works:

### 7.1 Database

- [ ] `SUPABASE_BOOTSTRAP.sql` runs without errors in the Supabase
      SQL editor.
- [ ] `SELECT count(*) FROM pg_tables WHERE schemaname = 'public'`
      returns 20.
- [ ] `SELECT count(*) FROM pg_policies WHERE schemaname IN
      ('public', 'storage')` returns 28.
- [ ] `SELECT id, name, public FROM storage.buckets` returns 2
      rows (`store_assets`, `documents`).

### 7.2 Auth

- [ ] `SUPABASE_SEED.sql` runs without errors.
- [ ] `SELECT email FROM auth.users WHERE id =
      '975839b1-18b7-4339-a9dd-00863521bb29'` returns
      `mock@email.com`.
- [ ] Logging in at `/login` with `mock@email.com` /
      `mockpassword123` succeeds and redirects to `/dashboard`.

### 7.3 Application

- [ ] `npm run lint` returns no errors.
- [ ] `npm run dev` starts the server on port 3000 without
      errors in `dev.log`.
- [ ] The Preview Panel shows the FUSION-ONE login page.
- [ ] After login, the dashboard shows the seeded store's name
      ("Fusion Gadgets") and the active financial year
      ("2025-26").
- [ ] The `/sales` page lists 3 seeded sales (`SAL-2025-26-0001`
      through `0003`).
- [ ] The `/inventory` page lists 8 in-stock items (7 originals +
      1 trade-in Vivo V27 Pro).
- [ ] The `/accounts` page shows balances for Cash, HDFC, and
      ICICI bank accounts.

### 7.4 Storage

- [ ] Uploading a logo in `/settings` writes to the `store_assets`
      bucket and updates `store.logo_url`.
- [ ] The uploaded logo appears on the next printed invoice.
- [ ] Adding a trade-in with a document upload writes to the
      `documents` bucket.

---

## 8. Common Setup Issues

### 8.1 "Permission denied for table store"

You ran the bootstrap as the wrong role. The bootstrap must be
run as the project owner (the default role when you use the
Supabase SQL editor). If you're using `psql`, connect with the
`postgres` user.

### 8.2 "policy already exists"

You re-ran the bootstrap without resetting first. Either drop the
existing policies manually (`DROP POLICY ...`) or run
[`sql/reset_database.sql`](./sql/reset_database.sql) and re-run
the bootstrap.

### 8.3 "violates foreign key constraint" when seeding

The mock user doesn't exist in `auth.users` yet. Section 0 of the
seed script should create it — if it failed, check that:

1. You ran the bootstrap first (the `whatsapp_settings` table
   must exist before section 0 of the seed runs, because section
   12 inserts a row that FKs to `auth.users`).
2. The Supabase project's `auth.users` table is not in a
   read-only state (some Supabase maintenance windows lock auth
   tables).

### 8.4 "Invalid API key" in the browser console

Your `NEXT_PUBLIC_SUPABASE_ANON_KEY` is wrong, or the URL doesn't
match the project the key was issued for. Re-copy both from the
Supabase dashboard's "Settings → API" page.

### 8.5 Login fails with "Email not confirmed"

The mock user's `email_confirmed_at` is NULL. This shouldn't
happen — section 0 of the seed sets it to `now()`. Re-run the
seed, or manually:

```sql
UPDATE auth.users
SET email_confirmed_at = now()
WHERE id = '975839b1-18b7-4339-a9dd-00863521bb29';
```

### 8.6 RLS blocks every query even after login

You're using the admin client (which bypasses RLS) for queries
that should be user-scoped, or you're not passing the user's
session cookies. Make sure:

* Client Components import from
  [`platform/supabase/client.ts`](./platform/supabase/client.ts).
* Server Components, Server Actions, and Route Handlers import
  `createClient` from
  [`platform/supabase/server.ts`](./platform/supabase/server.ts).
* Only API routes that explicitly need to bypass RLS import
  `supabaseAdmin` from
  [`platform/supabase/admin.ts`](./platform/supabase/admin.ts).

### 8.7 Port 3000 is already in use

The cloud sandbox locks port 3000. If you see "port already in
use", the dev server is probably already running — check
`dev.log` for the running instance. Do not start a second one.

### 8.8 `npm run dev` exits immediately

Check `dev.log`. The most common causes are:

* Missing env vars (see section 2).
* Syntax error in a TypeScript file — Next.js will refuse to start
  until the error is fixed.
* A circular import that Next.js 16's stricter module resolution
  catches.

---

## 9. Cross-References

* The complete schema reference:
  [`DATABASE_DEPENDENCIES.md`](./DATABASE_DEPENDENCIES.md).
* The complete policy listing:
  [`DATABASE_POLICIES.md`](./DATABASE_POLICIES.md).
* The `is_owner()` function definition:
  [`DATABASE_FUNCTIONS.md`](./DATABASE_FUNCTIONS.md).
* The high-level architecture overview:
  [`DATABASE_ARCHITECTURE.md`](./DATABASE_ARCHITECTURE.md).
* The reset script:
  [`sql/reset_database.sql`](./sql/reset_database.sql).
* The historical migration files (now consolidated into the
  bootstrap): [`sql/`](./sql).
