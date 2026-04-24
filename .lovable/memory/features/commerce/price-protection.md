---
name: Price Protection Feature
description: Auto-detected price drops within 7 days of purchase create refund claims; users send to support; admin approves and credits wallet via RPC
type: feature
---
- Table: `price_protection_claims` (status enum: pending|awaiting_admin|processed|rejected). Unique on `order_item_id`.
- Detection: trigger `trg_products_price_drop` on `products.price` UPDATE → calls `detect_price_protection_for_product(p_id, new_price)`. Inserts pending claims for confirmed/delivered orders within 7 days.
- Reference date: `COALESCE(user_confirmed_at, delivered_at, confirmed_at)`.
- User UI: `src/components/profile/PriceProtectionSection.tsx` replaces RecentOrders in `/profile`. Button "طلب استرداد" creates/finds conversation and inserts price_protection JSON message.
- Chat card: `src/components/chat/messages/PriceProtectionCard.tsx` rendered in `AdminUserChat.tsx` and `ListingConversations.tsx` when `parsedContent.type === 'price_protection'`.
- Admin: `/cp-x9A3kL7m/price-protection` (`AdminPriceProtection.tsx`). RPCs: `approve_price_protection_claim(claim_id, refund_amount, notes)` credits user_wallets atomically; `reject_price_protection_claim(claim_id, reason)`.
