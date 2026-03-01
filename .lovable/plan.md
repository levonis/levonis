

## Plan

### Issue 1: Add Product Notes in ProductShop (متجر المنتجات)

The `ProductShop.tsx` page currently has no mechanism for per-product notes. The purchase flow uses `purchase_product_with_gift_tickets` RPC which doesn't accept notes.

**Steps:**
1. **Database**: Add `customer_notes` column to `order_items` table (nullable text)
2. **State management in ProductShop.tsx**: Add a `productNotes` state (`Record<string, string>`) to track notes per product ID
3. **UI on ProductWithGiftCard**: Add an expandable notes section with a toggle button (e.g., pen icon). When expanded, show a glassmorphism-styled textarea with 3D depth effect (backdrop-blur, glass borders, shadow). Animation via framer-motion for smooth expand/collapse
4. **Pass notes through purchase flow**: Update `handlePurchaseClick` to carry notes, show them in the confirmation dialog, and pass to the RPC or store separately after purchase

Since the RPC `purchase_product_with_gift_tickets` doesn't support notes, after successful purchase we'll update the created record with notes via a separate query, or modify the approach to store notes in a `user_purchased_products` table if it exists.

### Issue 2: Order Preview Dialog Showing Half Page

In `AdminOrderChatDialog.tsx` line 434:
```tsx
<TabsContent value="order" className="flex-1 m-0 min-h-0 overflow-hidden">
  <div ref={orderViewportRef} className="h-full overflow-y-auto">
```

The issue is the `overflow-hidden` on TabsContent combined with flex layout not properly giving height to the order tab. The fix:
- Change TabsContent for "order" to properly fill available space with `overflow-y-auto` directly
- Ensure the inner div gets proper height calculation

### Issue 3: Order Notes Missing in Preview

The order preview in `AdminOrderChatDialog.tsx` only shows `shipping_notes` (line 468-473) but doesn't show `internal_notes` or `financial_notes`. 

**Fix:** Add display sections for:
- `internal_notes` (ملاحظات داخلية)  
- `shipping_notes` (already shown)
- `financial_notes` (ملاحظات مالية)

All in the order details tab after the customer info section.

---

### Technical Details

**Database migration:**
```sql
ALTER TABLE order_items ADD COLUMN customer_notes TEXT;
```

**ProductShop.tsx changes:**
- Add `productNotes` state
- Pass `notes` and `onNotesChange` props to `ProductWithGiftCard`

**ProductWithGiftCard.tsx changes:**
- Add expandable notes area with glassmorphism styling:
  - `bg-white/10 dark:bg-white/5 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)]`
  - framer-motion `AnimatePresence` for expand/collapse
  - Pen/notebook icon button to toggle

**AdminOrderChatDialog.tsx changes:**
- Fix overflow: change TabsContent order tab to `className="flex-1 m-0 min-h-0 overflow-y-auto"`
- Add `internal_notes` and `financial_notes` display blocks alongside existing `shipping_notes`

