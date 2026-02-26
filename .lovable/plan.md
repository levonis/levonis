

# Taobao-Inspired Profile Page Redesign

## Current State
The profile page (`/profile`) is a simple stacked card layout with: profile header, rating card, activity summary, last 4 requests, and merchant conversion CTA. It lacks visual hierarchy, premium feel, and quick-access functionality.

## Data Available in Database
- **user_points**: `total_points`, `available_points`, `level` (bronze/silver/gold/platinum)
- **user_wallets**: `balance`, `currency`
- **user_coupons**: `discount_value`, `discount_type`, `is_used`, `expires_at`, `coupon_code`
- **loyalty_levels**: tier info with `name_ar`, `color`, `min_points`, `discount_percentage`, `frame_url`
- **orders**: `status` (pending, confirmed, shipped, arrived_iraq, delivered)
- **profiles**: full_name, username, avatar_url, phone_verified
- Existing `LevelBadge` and `AvatarWithFrame` components

## Architecture — 5 Zones

### A) Premium Profile Header
- Gradient background (based on user's loyalty level color)
- Glassmorphism overlay card with `backdrop-blur`
- Large `AvatarWithFrame` (size `lg`) centered or right-aligned
- Username + `LevelBadge` inline
- Progress bar toward next loyalty tier (query `loyalty_levels` for next tier's `min_points`)
- 4 compact stat pills in a row: Points | Coupons | Wallet | Savings
- CTA button: "ترقية العضوية" linking to `/rewards?tab=cards`

### B) Orders Control Center
- Section title "طلباتي" with "عرض الكل" link to `/orders`
- 5-column grid of order status icons with dynamic count badges
- Statuses: `pending` (بانتظار الدفع), `confirmed` (قيد التجهيز), `shipped` (تم الشحن), `arrived_iraq` (في الطريق), `delivered` (تم التسليم)
- Each column: outline icon + label + count badge (animated if >0)
- Tap navigates to `/orders?status=X`

### C) Quick Services Grid
- 4-column grid of service shortcuts
- Items: تتبع الشحنات, المفضلة, المتاجر المتابعة, سجل التصفح, العناوين, خدمة العملاء, الإعدادات
- Each item: icon in soft colored circle + label below
- Subtle tap scale animation via `active:scale-95`

### D) Coupons & Promotions
- Horizontal scroll of coupon cards (max 5 active ones)
- Each card: large discount value, condition text, expiry, "استخدم الآن" CTA
- Color coding: VIP gold gradient, standard red/pink, expired grayscale
- "عرض الكل" link

### E) Recent Activity (Simplified)
- Compact list of last 3 orders with status badge and date
- Replace the old rating/metrics cards (move to a sub-page if needed)

## Implementation Plan

### Step 1: Create sub-components
Create `src/components/profile/` directory with:
- `ProfileHeader.tsx` — gradient header with avatar, name, level, stats, progress
- `OrdersCenter.tsx` — 5-col order status grid with counts from `orders` table
- `QuickServicesGrid.tsx` — 4-col services grid
- `CouponsStrip.tsx` — horizontal coupon cards from `user_coupons`
- `RecentOrders.tsx` — last 3 orders compact list

### Step 2: Rewrite Profile.tsx
- Remove all existing card sections for regular users
- Import and compose the 5 new zone components
- Keep merchant view as-is (or enhance separately later)
- Remove `pt-24` top padding, use `pt-6` since bottom nav handles navigation
- Add `pb-24` for bottom nav clearance

### Step 3: Data fetching
- Add queries for `user_wallets` (balance), `user_coupons` (active count + list), `orders` (status counts), `loyalty_levels` (next tier info)
- Use existing `useUserPrintReputation`, `useUserCardFrame`, `LevelBadge`

### Step 4: Visual system
- Gradient backgrounds using loyalty level color
- `rounded-3xl` (24px) for main cards, `rounded-2xl` (16px) for inner cards
- Shadow scale: `shadow-sm`, `shadow-md`, `shadow-lg`
- Typography: section titles `text-base font-bold`, card titles `text-sm font-semibold`, body `text-xs`
- Glassmorphism: `bg-white/10 backdrop-blur-xl border border-white/20`
- Micro-interactions: `transition-all duration-200 active:scale-[0.97]`

### Step 5: Skeleton loading states
- Add skeleton placeholders for header stats, order counts, and coupons while data loads

## Technical Notes
- All data queries use existing database tables — no migrations needed
- Bottom navigation already exists in `AppNavBar` — no changes needed there
- The merchant profile view (approved merchants) stays unchanged initially
- RTL layout maintained with `dir="rtl"` on main container

