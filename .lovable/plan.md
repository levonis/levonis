

# Gacha Game System — Full Implementation Plan

## Scope Assessment

This is a **major platform feature** requiring ~20+ database tables, ~30+ components, admin management, economy logic, and 3D visuals. To deliver a production-quality result without breaking existing systems, I'll implement in **3 phases**.

---

## Phase 1: Database Schema & Core Backend

### New Database Tables (Migration)

```text
┌─────────────────────────────────────────────────────────┐
│                    GACHA SCHEMA                          │
├─────────────────────────────────────────────────────────┤
│ gacha_machines          - Machine definitions            │
│ gacha_machine_prizes    - Prize pool per machine         │
│ gacha_rarity_tiers      - Configurable rarity levels     │
│ gacha_spins             - Spin history log               │
│ gacha_dolls             - Collectible doll catalog       │
│ gacha_user_inventory    - User's owned dolls             │
│ gacha_coupons           - Coupon definitions             │
│ gacha_user_coupons      - User's owned coupons           │
│ gacha_advice_cards      - Advice/tip card pool           │
│ gacha_guaranteed_rules  - Guaranteed reward engine       │
│ gacha_guaranteed_claims - Track user claims              │
│ gacha_marketplace       - Doll listings for sale         │
│ gacha_transactions      - Points buy/sell ledger         │
│ gacha_price_history     - Doll price snapshots           │
│ gacha_settings          - Global gacha settings          │
└─────────────────────────────────────────────────────────┘
```

Key design decisions:
- Uses existing `user_points` and `user_tickets` tables for economy
- Each machine has its own prize pool with weighted rarity
- Guaranteed reward engine uses condition types: `exact_spend`, `spend_up_to`, `spend_at_least`, `spin_count`, `first_spin`
- Doll pricing: `base_price`, `current_price`, `demand_score`, `supply_count` columns
- Marketplace uses points from existing `user_points` system
- Instant sell uses configurable discount range per rarity tier

### Edge Functions
- `gacha-spin` — Atomic spin logic: validate tickets, pick prize by rarity weight, handle guaranteed rewards, deduct tickets, record spin, return result
- `gacha-sell` — Marketplace instant sell with discount calculation
- `gacha-market-buy` — Purchase listed doll, transfer ownership, move points

### RLS Policies
- Users can read machines, prizes, dolls catalog (public)
- Users can only read/write their own inventory, coupons, spins, listings
- Admin full access on all gacha tables

---

## Phase 2: User-Facing Game UI

### Pages & Components

1. **Gacha Landing** (`/games` → gacha card → `/games/gacha`)
   - 3D arcade hall with machine thumbnails
   - Premium retro aesthetic with neon/glow effects
   - Machine cards showing: name, theme, cost, featured prizes

2. **Machine Detail & Spin**
   - 3D gacha machine visualization (CSS 3D transforms + glow effects)
   - Prize showcase carousel
   - Single spin / Multi-spin (1x, 3x, 5x, 10x)
   - Animated capsule reveal with rarity glow
   - Guaranteed reward progress indicator

3. **Spin Result Modal**
   - Capsule opening animation
   - Rarity-colored reveal (Common→Legendary)
   - Prize details card
   - "Spin Again" / "View Collection" actions

4. **Collection/Inventory**
   - Grid gallery of owned dolls with rarity badges
   - Filter by rarity, category, tradable status
   - Doll detail modal: lore, market value, sell options

5. **Coupons Page**
   - Active/expired tabs
   - Coupon cards with expiry countdown
   - "Use in Cart" integration

6. **Marketplace**
   - Browse listings with filters (rarity, price, demand)
   - Sort by newest, price, popularity
   - Demand/scarcity indicators
   - Buy flow with points confirmation
   - User can list own dolls for sale

7. **Instant Sell Modal**
   - Shows market price vs instant price
   - Discount percentage display
   - Confirmation with final amount

8. **User Dashboard Tabs**
   - Wallet (tickets + points)
   - Spin History (last 25)
   - Marketplace History (last 50)
   - Transaction History (last 50)

### Integration with Existing Games Page
- Add "Gacha" card to `GAME_NODES` in `GamesData.ts`
- Route from MiniGames page to gacha sub-app
- Use existing `GameBalanceBar` for tickets/points display

---

## Phase 3: Admin Dashboard

### New Admin Tab in Games Settings
Add "Gacha" tab to `AdminGamesSettings.tsx` with sub-sections:

1. **Machines Management** — CRUD machines, set theme/cost/status, upload 3D model URL
2. **Prize Pool Editor** — Add/remove prizes per machine, set rarity weights
3. **Rarity Tiers** — Define tiers (Common 60%, Rare 25%, Epic 10%, Legendary 4%, Mythic 1%)
4. **Guaranteed Rules** — Configure conditions, limits, scheduling
5. **Dolls Catalog** — CRUD dolls, set base price, rarity, tradable status
6. **Dynamic Pricing** — View/override current prices, set price formulas
7. **Coupons** — Create coupon types, set expiry rules
8. **Advice Cards** — CRUD advice/tip content
9. **Marketplace** — View listings, moderate, remove
10. **Analytics** — Spins per machine, ticket spend, popular dolls, economy overview

### Admin Route
- `gachaSettings: ${ADMIN_BASE_PATH}/gacha-settings`

---

## Visual Direction

- **CSS 3D transforms** for machine rendering (not Three.js — lighter, faster)
- Glossy plastic materials via gradients + box-shadows
- Neon glow: `text-shadow` and `box-shadow` with vibrant colors
- Capsule colors per rarity: gray → green → blue → purple → gold
- Retro pixel font for headers, modern font for body
- Animated counters, confetti on rare pulls
- Dark arcade background with subtle grid pattern

---

## Files to Create/Modify

### New Files (~25-30 components)
- `src/components/games/gacha/` — All gacha game components
- `src/pages/GachaGame.tsx` — Main gacha page
- `src/components/admin/GachaAdminTab.tsx` — Admin management
- `supabase/functions/gacha-spin/index.ts` — Spin logic
- `supabase/functions/gacha-sell/index.ts` — Sell logic
- `supabase/functions/gacha-market-buy/index.ts` — Market purchase

### Modified Files
- `src/components/games/GamesData.ts` — Add gacha game node
- `src/pages/MiniGames.tsx` — Add gacha route
- `src/pages/AdminGamesSettings.tsx` — Add Gacha tab
- `src/config/adminConfig.ts` — Add gacha admin route
- App routing file — Add gacha routes

---

## Implementation Order

1. Database migration (all tables + RLS)
2. Edge functions (spin, sell, buy)
3. Gacha landing + machine selection
4. Spin mechanic + reveal animation
5. Collection/inventory
6. Marketplace + instant sell
7. Coupons integration
8. Admin dashboard
9. Analytics
10. Polish & animations

This is a large build. I'll implement it systematically, starting with the database and core spin mechanic, then expanding outward.

