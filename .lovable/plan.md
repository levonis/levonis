## Problem

In the warranty invoice (`PrinterInvoiceGenerator`):

1. **Subtotal**: For orders with COD (دفع عند الاستلام) or partial-payment (نصف المبلغ), the percentage shown on the invoice doesn't match what the customer agreed to. The current code uses `order_items.total_price` directly, which works for the printer line itself but doesn't reflect the actual price the user accepted in their order.
2. **Delivery**: Hardcoded to **12,000** even when the user picked **استلام من المخزن (pickup)** — the order's `delivery_method = 'pickup'` and `admin_shipping_cost = 0` are ignored.

## Root cause

In `src/components/admin/PrinterInvoiceGenerator.tsx`, `handleSelectUser`:
- Never reads the order's `delivery_method` or `admin_shipping_cost` — falls back to `12000` from `manualFields.delivery`.
- Subtotal is taken from `order_items.total_price` only; for COD/partial orders we should anchor the printer line to its true `unit_price * quantity` (which is what `total_price` already is for a line — confirmed via DB sample). The "wrong percentage" symptom is downstream of the wrong delivery + tax calc inflating the total.

Also `handleManualEntry` defaults delivery to `12000` — should default to `0` for pickup-style scenarios; we'll keep it editable but no longer assume 12,000 silently.

## Fix

### `src/components/admin/PrinterInvoiceGenerator.tsx` — `handleSelectUser`

When the buyer has an `orderId`:
1. Fetch the order's `delivery_method` and `admin_shipping_cost`.
2. If `delivery_method === 'pickup'` → delivery = **0**.
3. Else → delivery = `admin_shipping_cost ?? 0` (no more 12,000 fallback when there is a real order).
4. Sync `manualFields.subtotal` and `manualFields.delivery` so the config step (if it ever opens) shows the real values, not 12,000.
5. Recompute `total = subtotal + tax + delivery` with the corrected delivery.

Also remove the **date-overwriting bug** that snuck back into the link step: `handleSelectUser` currently writes `activation_date: new Date()` and `expiry_date: now + warrantyMonths` whenever an admin opens the invoice generator — this contradicts the previous fix in `PrinterActivationPanel`. Drop both fields from the update so admin-set warranty dates are preserved.

### Out of scope

- Changing how `order_items.total_price` is computed
- Modifying COD/partial-payment surcharge logic
- Changing the manual entry default of `12000` (still useful when there is no order at all — but it stops overriding real order data)

## Verification

1. Generate invoice for an order with `delivery_method = 'pickup'` → invoice shows **التوصيل: 0**.
2. Generate invoice for an order with `admin_shipping_cost = 5000` → invoice shows **التوصيل: 5,000**.
3. Generate invoice for a COD/partial order → subtotal = printer's actual line price; total = subtotal + tax + real delivery (no inflation from 12,000).
4. Re-open invoice generator on an already-activated printer with admin-set dates → dates remain unchanged in `store_printers`.
