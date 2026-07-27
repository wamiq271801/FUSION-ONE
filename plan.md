Secondhand Mobile Billing App — Full Build Plan in Next.js

Build this app as a Next.js web app using React, Tailwind CSS, Next.js API routes, and Supabase.
Build the phases in order.Do not skip ahead.Each phase must be fully working before moving to the next.Do not add any feature, field, screen, rule, or library that is not listed here.Do not remove anything that is listed here.
This app is a personal app for one owner only.It is not a public app.It is not a multi-user business system.Build strictly for this owner workflow.

Tech Stack (use exactly this)

Framework: Next.js
Frontend: React
Styling: Tailwind CSS
Backend app logic: Next.js API routes
Database/Auth/Storage: Supabase
Authentication: email and password only
Database: PostgreSQL on Supabase
Database security: Row Level Security enabled on every table
Storage: Supabase Storage for store logo and trade-in documents
PDF generation: use one PDF library only everywhere
Language: TypeScript


Core Rules (apply everywhere)

Each IMEI is one item
One physical phone equals one inventory record in that financial year book
No two in-stock items can share the same IMEI in the same active stock state
IMEI uniqueness must be enforced in the app and in the database
A traded-in phone becomes a new inventory item
Sold records must remain unchanged
Sold items are read-only
Saved sale items cannot be edited or deleted
Single owner only
No staff
No roles
No permissions screen
No GST or tax calculation module
Bills use totals, discounts, trade-in credit, and due only
Never add tax fields or tax calculations
Sale bill number format: FG-S-YYYY-YY-NNN
Purchase bill number format: FG-P-YYYY-YY-NNN
NNN starts from 001
Sale and purchase counters are separate
Counters reset for each financial year
Bill number is stored with the bill
Never hard delete records
To remove something, mark it as void or cancelled where applicable
Keep all history in database
All money values must use decimal/numeric types
Never use float or double for money logic
Always show money with two decimal places
Every bill, payment, inventory record, and stock carry-forward record must belong to one financial year
Customer and supplier are one single master called Parties
One party can be buyer, seller, or both


Financial Year Master Rule
Each financial year is a separate ledger book.
This means:

The app always works inside one selected financial year
When the year changes, the whole app data must change to that year
This applies to:
Dashboard
Sales
Purchases
Inventory
Parties ledgers
Payments In
Payments Out
Exchange
Accounts balances


No normal screen may mix data from multiple years
All totals, balances, dues, stock, and records must be based on the selected year only
Bill creation must happen only in the selected active open year
If a selected year is closed, creation actions must be blocked


Inventory and Year Closing Rule
Inventory must also follow the year-book system.
This means:

Inventory shown in a selected year must be that year’s inventory only
When a year is closed, all unsold in-stock items from that year must carry forward into the next year
The next year must receive new opening stock records
The old year inventory must remain unchanged
The new year must work on its own carried-forward stock records
Selling in the new year must affect the new year stock record, not the old year record
Carried-forward stock must remain traceable to the old year source item


Validation Rules (must be explicit)
IMEI rules

IMEI is required where phone entry is required
IMEI must contain digits only
IMEI must be exactly 15 digits
No spaces allowed
No letters allowed
No special characters allowed
Trim before validation
Reject invalid IMEI before save
Reject duplicate in-stock IMEI before save

Party rules

name required
number required
address optional
trim name and number before save
number is stored as text
do not allow blank or whitespace-only values

Phone item rules

brand required
model required
IMEI required
RAM/ROM required
color required
purchase price required where applicable
base selling price required where applicable
purchase price cannot be negative
selling price cannot be negative
sold item must never become editable

Money rules

all money fields use decimal/numeric
all amount fields reject negative values
paid cannot be negative
due cannot be negative
payment amount cannot exceed current due
final total cannot be negative

Date rules

every transaction must have a date
transaction date must be inside the selected financial year date range
start date must be earlier than end date
financial years must not overlap
duplicate financial year ranges are not allowed
a year cannot be closed twice

Cash and payment mode rules

Cash account exists only once
Cash account never has payment modes
If Cash is selected, payment mode must be null
If non-cash account is selected, payment mode must belong to that account only
Do not allow mismatched account and payment mode

Bill rules

Bill number is generated only at save time
Counters are year-specific
Sale and purchase counters are separate
Saved sale items are read-only
Saved bills are not editable where plan says read-only
Void records keep their original bill number


App Structure
Build with this structure:

app/ for routes and pages
app/api/ for Next.js API routes
components/ for reusable UI
features/ for feature screens and forms
lib/ for config and helpers
services/ for frontend service calls
server/ for server-side business logic
hooks/ for reusable hooks
types/ for shared types

Keep this separation:

UI in React components
Form state in feature components and hooks
Business rules in server logic and API routes
Database writes through controlled server-side logic
Do not put business logic directly inside presentational UI components


Phase 1 — Project Setup and App Shell
Goal
A running Next.js app with Tailwind, main layout, navigation, auth shell, and Supabase connection.
Build this

Create the Next.js app in TypeScript
Set up Tailwind CSS
Create the main layout:
left sidebar
top header
main content area


Add navigation links for:
Dashboard
Sales
Purchases
Inventory
Parties
Payments In
Payments Out
Exchange
Accounts
Financial Year
Settings


Create placeholder pages for all screens
Each placeholder page shows only page title
Set up Supabase connection using environment config
Do not hardcode Supabase values
Add a base app shell that supports:
authentication gate
selected financial year context placeholder
global toast/message area



Done when

App runs
Navigation works
All pages open
Supabase initializes without error


Phase 2 — Reusable UI Foundation
Goal
Build the reusable UI system for all later screens.
Build this
Create reusable components for:

button
text input
number input
textarea
select/dropdown
date input
checkbox
table
search input
modal/dialog
confirmation dialog
card/panel
summary tile
inline error message
toast message
loading state
empty state
page header
form section
action bar
read-only detail block
success screen layout

Create one consistent Tailwind theme for:

spacing
colors
borders
rounded corners
typography
table styles
form styles
button styles
modal styles

Done when

All later phases can be built using only these shared UI pieces
Layout and styling are consistent across screens


Phase 3 — Authentication and Owner Lock
Goal
Only the owner can use the app, with persistent login.
Build this

Create login page with:
email
password
sign-in button


Use Supabase Auth for sign-in
Build owner lock:
first account that completes onboarding becomes the owner
owner user ID is stored in store record
after owner exists, only that account can access app
reject every other account


Keep session persistent
On app load:
if session is valid, continue into app
if not, show login page


Add logout action

Done when

Owner can sign in
Session survives refresh/reopen
Logout works
Non-owner is blocked


Phase 4 — Onboarding
Goal
One-time setup after first login.
Build this
Show onboarding only if onboarding is not complete.
Create 3-step onboarding.
Step 1 — Business Profile
Fields:

store name required
address
phone required
email
website
GSTIN
logo upload optional

Save logo in Supabase Storage.
Step 2 — First Bank Account and Cash

create one bank account with required name
create Cash account automatically
allow adding payment modes to the bank account
Cash account is marked as cash and has no modes

Step 3 — First Financial Year
Fields:

start date required
end date required

Rules:

start date must be before end date

On Finish

save store row
save owner user ID
create bank account
create payment modes
create Cash account
create first financial year
set active financial year
set onboarding complete true

Done when

Onboarding completes once
All setup data is saved
Onboarding does not appear again


Phase 5 — Database Foundation
Goal
Create all tables, constraints, and RLS for the full app and year-book behavior.
Build these tables
store

id
owner_user_id
name
address
phone
email
website
gstin
logo_url
onboarding_complete
active_financial_year_id

financial_years

id
start_date
end_date
status (active or closed)
sale_counter
purchase_counter

bank_accounts

id
name
is_cash
created_at

payment_modes

id
bank_account_id
name

account_transactions

id
bank_account_id
payment_mode_id nullable
type (credit or debit)
amount
date
reference_type (sale, purchase, payment_in, payment_out)
reference_id
financial_year_id

parties

id
name
number
address nullable
created_at

inventory_items

id
brand
model
imei
ram_rom
color
purchase_price
base_selling_price
status (in_stock or sold)
source (purchase or trade_in)
financial_year_id
created_at
origin_inventory_item_id nullable
opening_entry_type (direct or carried_forward)

purchases

id
bill_number
party_id
total
paid
due
bank_account_id
payment_mode_id nullable
date
financial_year_id
status (active or void)

purchase_items

id
purchase_id
inventory_item_id

sales

id
bill_number
party_id
total
discount
trade_in_credit
final_total
paid
due
bank_account_id
payment_mode_id nullable
date
financial_year_id
status (active or void)

sale_items

id
sale_id
inventory_item_id
sold_price

trade_ins

id
sale_id
brand
model
imei
ram_rom
color
credit_value
mrp nullable
document_url
new_inventory_item_id

payments_in

id
sale_id
party_id
amount
bank_account_id
payment_mode_id nullable
date
financial_year_id

payments_out

id
purchase_id
party_id
amount
bank_account_id
payment_mode_id nullable
date
financial_year_id

Database rules

Enable RLS on all tables
Owner can only access own data
Only one in-stock inventory item per IMEI in the working stock records
Use numeric/decimal for all money fields
Financial years must not overlap
Financial year range duplication must be blocked

Done when

All tables exist
All constraints exist
RLS is active
App can read and write all tables


Phase 6 — Financial Year Context System
Goal
The whole app works based on one selected financial year.
Build this

Create selected financial year state for the whole app
Load the active financial year on app start after login
Show selected financial year in header
Add year switch control in app header or financial year area
When year changes:
reload all screen data
reload all totals
reload all balances
reload all inventory
reload all ledgers


Every list, total, and query in the app must filter by selected financial year
If selected year is closed:
allow viewing
block creation
block editing where year freeze applies



Done when

Switching year updates full app data
No screen mixes data from different years
Closed year behaves as read-only


Phase 7 — Bank Accounts and Payment Modes
Goal
Manage accounts, payment modes, and year-specific balances.
Build this
Create Accounts screen.
Features

list all bank accounts
show balance for each account for selected year only
add bank account
edit bank account name
create Cash account only once
Cash account cannot be duplicated
under each non-cash account:
add payment modes
list payment modes
remove payment modes


Cash account:
shows no modes
does not allow adding modes



Balance rule

balance = year-specific credits minus year-specific debits from account_transactions

Done when

Accounts can be managed
Cash rules work
Balances are correct for selected year


Phase 8 — Inventory Management
Goal
Manage phone inventory by IMEI inside the selected financial year.
Build this
Create Inventory screen.
List columns

brand
model
IMEI
RAM/ROM
color
purchase price
base selling price
status

Features

search by IMEI
search by brand
search by model
filter by status
show inventory for selected year only
add item form with fields:
brand
model
IMEI
RAM/ROM
color
purchase price
base selling price / MRP


validate all fields before save
block duplicate in-stock IMEI before save
sold items open in read-only detail view
if selected year is closed, inventory is read-only

Inventory creation rules

item must be stamped with selected financial year
transaction date must be inside selected year range if date is used in item creation
new direct item uses opening_entry_type = direct

Done when

Inventory can be added
IMEI validation works
Duplicate in-stock IMEI is blocked
Search/filter work
Sold items are read-only
Closed year inventory is read-only


Phase 9 — Parties Management
Goal
Manage one shared party master for customer and supplier use.
Build this
Create Parties screen.
Fields

name required
number required
address optional

Features

add party
edit party
list parties
search parties
use same party in sales and purchases
allow inline party creation from sale form
allow inline party creation from purchase form

Ledger display for selected year only
For each party show:
Sales side

total business from sales in selected year
outstanding due to receive from sales in selected year

Purchases side

total business from purchases in selected year
outstanding payable from purchases in selected year

Closed year behavior

if selected year is closed, allow viewing only

Done when

Parties can be created and edited
Same party can be used in both directions
Ledger values are year-specific
Inline creation works


Phase 10 — Purchase Form, Success Screen, and Purchase Management
Goal
Record purchases, add stock, and manage purchase payments in the selected year.
Build this
Create Purchase form.
Purchase form

select existing party or create inline
add one or more phones
each phone has:
brand
model
IMEI
RAM/ROM
color
purchase price
base selling price


total = sum of purchase prices
select bank account
show only that account’s modes
if Cash selected, show no modes
enter paid amount
due = total minus paid
date required

Validation

date must be inside selected year range
all phone field rules apply
paid cannot exceed total
due cannot be negative
selected year must be open

On save

generate next purchase bill number using selected year purchase counter
increment purchase counter
create purchase row
create inventory rows for each phone
set inventory source = purchase
set inventory status = in_stock
set opening_entry_type = direct
create purchase_items rows
create debit entry in account_transactions for paid amount
stamp selected financial year on all relevant rows

Success screen
Show saved purchase bill with actions:

Print
Save as PDF
New Purchase
Close

Purchase management screen

list purchases for selected year only
search purchases
open purchase details
generate PDF
pay party

Pay party dialog
Show:

total
paid
due
amount
bank account
payment mode
date

Rules:

date must be inside selected year range
amount cannot exceed current due
selected year must be open

On save:

reduce due
create debit in account_transactions
create payments_out record with selected year

Done when

Purchase creates stock
Purchase gets correct year-specific bill number
Ledger updates correctly
Success screen works
Purchase appears in management
Payment out works


Phase 11 — Sale Form with Trade-In and Success Screen
Goal
Create the main billing flow in the selected year.
Build this
Create Sale form.
Party section

select existing party or create inline

Item section

pick one or more in-stock phones from selected year inventory
allow search by IMEI or item search
each line shows item details and sold price
default sold price = base selling price
sold price editable
sold price cannot be negative

Discount section

whole bill discount amount

Trade-in dialog
Fields:

brand
model
IMEI
RAM/ROM
color
purchase price = credit value
optional MRP / selling price
document upload or camera capture
save document to Supabase Storage

Trade-in display

show compact list of added trade-ins in sale form

Totals

sale total = sum of sold prices
subtract bill discount
subtract total trade-in credit
final total = result
final total cannot be negative

Trade-in MRP-gap discount rule

if MRP is greater than credit value
show the difference as a discount line on bill

Payment section

select bank account
show only that account’s modes
if Cash selected, show no modes
enter paid amount
due = final total minus paid
date required

Validation

selected year must be open
date must be inside selected year range
paid cannot exceed final total
due cannot be negative

On save

generate next sale bill number using selected year sale counter
increment sale counter
create sale row
create sale_items rows
mark selected sold phones as sold
sold phones become read-only
for each trade-in:
create inventory row in selected year
source = trade_in
status = in_stock
opening_entry_type = direct
create matching purchase record for trade-in item in selected year
create purchase_item record
create trade_in record linked to sale and new inventory item


create credit in account_transactions for paid amount
stamp selected financial year on all relevant rows
lock sale from editing after save

Success screen
Show saved sale bill with actions:

Print
Save as PDF
New Sale
Close

Done when

Sale works on selected year stock
Discount works
Trade-in works
MRP-gap discount appears correctly
Ledger updates correctly
Success screen works
Sale becomes read-only


Phase 12 — Sale Management and Receive Payment
Goal
View sales and collect dues for selected year.
Build this
Create Sale management screen.
Features

list all sales for selected year only
search sales
open full read-only details
generate PDF for any sale

PDF must show

items
discount
trade-in discount
trade-in credit
total
paid
due

Receive payment dialog
Show:

total
paid
due
received amount
bank account
payment mode
date

Rules:

amount cannot exceed current due
date must be inside selected year range
selected year must be open

On save:

reduce due
create credit in account_transactions
create payments_in record with selected year

Done when

Sales list works
Details are read-only
PDF works
Receiving payment updates due and ledger correctly


Phase 13 — Payments In and Payments Out
Goal
Central year-specific payment screens.
Build this
Payments In screen

list all received payments for selected year only
filter/view by party

Payments Out screen

list all paid amounts for selected year only
filter/view by party

These screens must use records created from:

receive payment flow
pay party flow

Closed year behavior

allow viewing only

Done when

Both screens list correct year data
Party filtering works


Phase 14 — Exchange Management
Goal
One screen for all trade-ins in selected year.
Build this
Create Exchange screen.
Show for each row

brand
model
IMEI
credit value
set MRP
resulting discount
linked sale bill number
document link
current inventory status of that trade-in phone

Rules

show selected year data only
if selected year is closed, allow viewing only

Done when

Every trade-in appears correctly with correct selected year data


Phase 15 — Financial Year Management
Goal
Create, switch, and close financial years with proper carry-forward stock behavior.
Build this
Create Financial Year screen.
List

list all financial years
show status
closed years are read-only

Create financial year
Fields:

start date
end date

Rules:

start date required
end date required
start date must be earlier than end date
new range must not overlap existing year
duplicate range not allowed
created year does not become active unless explicitly selected

Switch active year

owner can manually select active year
whole app data must switch to selected year

Warning banner

if active year end date has passed
show persistent warning across app
do not block work

Close year
Only active open year can be closed.
On close:

mark year as closed
freeze all records in that year
find all unsold in-stock inventory in that year
ensure next year exists, or create next year with continuing dates
create opening stock records in next year for all unsold stock
carried-forward stock records must:
belong to next year
copy stock details
keep IMEI
set status = in_stock
set source based on carried item logic as needed by copied data
set opening_entry_type = carried_forward
set origin_inventory_item_id to old year inventory item


carry-forward must happen once only
closing action must not be repeatable
do not change old year records after close
do not automatically switch to next year unless explicitly selected

Closed year behavior

no new sale
no new purchase
no new payment
no inventory add
no editing of year records
viewing, search, and printing allowed

Done when

Year creation works
Overlap is blocked
Year switching works
Closing works
Carry-forward stock works
Closed year is frozen
Old year history remains unchanged
New year gets opening stock


Phase 16 — Dashboard
Goal
Show selected-year business summary and quick actions.
Build this
Create Dashboard screen.
Analytics tiles for selected year only

total in-stock count
total stock value
today’s sales total
this month’s sales total
today’s purchases total
this month’s purchases total
total dues to receive
total payables
each account’s balance

Alerts

financial year ended warning
outstanding dues
zero or low stock
pending payments

Quick action buttons

New Sale
New Purchase
Add Inventory
Receive Payment
Pay Party

Rules:

if selected year is closed, creation actions must be blocked

Done when

All numbers are correct for selected year
Alerts show correctly
Quick actions work correctly


Phase 17 — Settings
Goal
Edit business profile and logout.
Build this
Create Settings screen.
Editable fields

store name
address
phone
email
website
GSTIN
logo upload or replace

Behavior

save changes to store row
updated details must appear in future bill print and PDF
include logout action

Done when

Business profile can be updated
New bills use updated details
Logout works


Phase 18 — PDF and Print Layout
Goal
Finalize sale and purchase print output.
Build this
Create branded PDF and print layouts for sales and purchases.
Header

store name
logo
GSTIN
phone
website
email
address

Bill info

bill number
date
financial year

Party section

party details

Body

items
discounts
trade-in MRP-gap discount
trade-in credit
total
paid
due

Use the same PDF library everywhere.
Done when

Purchase PDF is correct
Sale PDF is correct
Print output is correct


Phase 19 — Final Locking of Rules and End-to-End Completion
Goal
Finish the app and enforce all strict behavior.
Build this
Apply final consistency across:

spacing
colors
typography
buttons
forms
tables
modals
success screens
detail views

Lock all final behavior:

sold inventory item cannot be edited
saved sale cannot be edited
closed year cannot accept new data
old year data remains unchanged
carried-forward stock is created only once
due cannot go below zero
payment cannot exceed due
IMEI must be exactly 15 digits
invalid dates must be blocked
overlapping years must be blocked
account and payment mode mismatch must be blocked
Cash account cannot have payment modes

Run full end-to-end testing for:

login
onboarding
year selection
bank account and payment mode setup
party creation
inventory add
purchase to inventory
sale from inventory
trade-in creation
receive payment
pay party
year closing
stock carry forward
dashboard totals
PDF generation
closed year read-only behavior

Done when

The full app works from start to end
All year-book rules work
All validations are strict
All listed flows are complete
No extra features exist outside this plan


Final Build Rule
Build this app exactly in the phase order above.Do not skip phases.Do not add extra modules.Do not split customer and supplier. Use Parties everywhere.Do not add tax logic.Do not hard delete records.Do not allow editing of sold sale-linked inventory.Do not allow duplicate in-stock IMEI.Do not mix data across financial years on normal screens.Treat each financial year as a separate ledger book.Carry forward unsold stock to next year on closing.