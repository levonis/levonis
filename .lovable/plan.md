## Problem

In `/cp-x9A3kL7m/printer-protection`, when generating a warranty invoice:
- Admin selects a user from the buyer list (often sourced from `store_printers` which has no linked order)
- Clicks "حفظ الفاتورة" (Save Invoice)
- The invoice either fails silently or saves but never appears in the saved invoices list with user info

### Root cause

`saved_invoices` table only has `order_id` — no `user_id` column. When the selected buyer comes from `store_printers` (no order), the insert sets `order_id: null`. The record technically saves, but:
1. `AdminSavedInvoices.tsx` displays the customer via `invoice.orders?.profiles` — null when there is no order, so it shows "غير معروف"
2. The invoice can't be linked back to the user, defeating the purpose of "select a user and save"
3. All 0 existing rows in DB have `order_id NOT NULL` — confirming nothing without an order has ever persisted usefully

## Fix

### 1. Database migration

Add `user_id` (nullable uuid) and `printer_id` (nullable uuid, references `store_printers`) to `saved_invoices`. Backfill existing rows from `orders.user_id` where possible.

### 2. PrinterInvoiceGenerator.tsx

In the save handler (lines 544-567):
- Include `user_id: selectedUserId` and `printer_id: printer.id` in the insert
- Add a guard: require either `selectedUserId` or manual entry before allowing save (currently no validation)
- Surface the actual Postgres error message in the toast for easier diagnosis (currently swallows error details)
- Log the inserted row id on success

### 3. AdminSavedInvoices.tsx

Update the query to also fetch the standalone `user_id` (and printer info) and fall back to it when `orders` is null:

```ts
.select(`
  *,
  orders ( order_number, user_id, profiles (username, full_name) ),
  user_profile:profiles!saved_invoices_user_id_fkey ( username, full_name ),
  store_printers ( serial_number, model_name_ar )
`)
```

Display logic: prefer `orders.profiles` then fall back to `user_profile`. Show printer serial/model when no order exists.

## Out of scope

- Reworking the buyer selection UI
- Changing the warranty calculation
- The auto-generated invoices on order confirmation (already work, untouched)

## Verification

After implementation:
1. Open printer-protection → pick a printer → "إنشاء فاتورة" → select a user from `store_printers` only (no order) → Save → toast says success
2. Visit `/cp-x9A3kL7m/saved-invoices` → invoice appears with the correct customer name and printer info
3. Repeat with a buyer that has an order → still works as before (order_number shown)
