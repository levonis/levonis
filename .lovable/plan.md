

# LEVONIS Homepage Premium Visual Redesign

## Overview
A refined visual upgrade of the existing homepage — preserving all ecommerce logic, data queries, routes, and backend — while applying a premium editorial aesthetic inspired by the reference image.

## Visual System

### Colors (CSS variable adjustments in `index.css`)
- Deepen the emerald background gradient: `--background: 155 55% 10%` → richer, darker emerald
- Warm ivory foreground: keep existing gold-cream `--foreground`
- Add new CSS custom properties: `--emerald-deep`, `--ivory-warm`, `--gold-muted` for the redesign layer
- No changes to theme-light or theme-dark variants

### Typography
- Headings: Use existing `font-amiri` (Arabic serif) for hero display text
- Body/UI: Keep `font-cairo` as-is for all functional text
- Add a `.font-display` utility class mapping to Amiri for editorial headings

### Spacing & Grid
- `max-w-[1400px]` container for desktop content
- 12-column CSS grid via Tailwind's grid utilities
- Generous padding: `py-20` to `py-28` between major sections
- Cards: `rounded-2xl` with soft `shadow-xl` and subtle border

### Buttons
- Primary CTA: gold fill with dark text, `rounded-full`, `px-8 py-3`
- Secondary: ghost/outline with gold border
- Hover: subtle scale + shadow lift

---

## Homepage Section Order (new)

1. **TopBar** — unchanged functionally, restyle with translucent emerald backdrop
2. **Hero Section** — NEW component, split layout
3. **Wishes Banner** — restyled, more subtle
4. **Banner Carousel** — restyled cards
5. **Reels Bar** — restyled
6. **Featured Products Grid** — NEW component, asymmetrical masonry
7. **Stories Bar** — restyled
8. **Bundles Section** — restyled
9. **Categories Section** — restyled with editorial cards
10. **Offers/Storage Section** — restyled
11. **Community Section** — NEW visual transition "digital garden"
12. **Footer** — restyled

---

## New Components

### 1. `src/components/home/HeroSection.tsx`
- Split layout: RTL — right side has bold serif headline + subtitle + CTA button; left side shows a featured product image on a "pedestal" (gradient card with shadow)
- Fetches one featured product from DB: `products` table where `featured = true`, picks first with image
- Background: deep emerald gradient with subtle radial glow behind the product
- Desktop: `grid grid-cols-12`, text spans 5 cols, product spans 7 cols
- Mobile: stacked, product on top

### 2. `src/components/home/FeaturedProductsGrid.tsx`
- Fetches 5-6 featured products from DB (`featured = true, has_in_stock = true`)
- Asymmetrical masonry layout using CSS grid with `grid-row-span` variations
- First product: large card spanning 2 rows (dominant)
- Others: standard size, mixed heights
- Each card: product image (large, `object-cover`), name, price, short label, "اطلب الآن" CTA
- Cards: `rounded-2xl`, emerald-tinted glass background, soft shadow, hover scale

### 3. `src/components/home/CommunityGardenTransition.tsx`
- Replaces the current `CommunitySection` wrapper on home only (CommunitySection still lazy-loaded inside)
- Layered background: deep emerald → darker gradient with soft radial light spots
- Decorative SVG/CSS shapes: soft glowing orbs, layered depth planes
- Elegant CTA: "استكشف مجتمعنا" button leading to `/community`
- Dreamy, premium feel — no literal plants, just abstract luminous landscape

---

## Restyled Existing Components (modifications)

### `src/pages/Home.tsx`
- Restructure section order as listed above
- Replace inline LEVONIS heading + social links section with the new HeroSection
- Add FeaturedProductsGrid after banner/reels
- Wrap CommunitySection in CommunityGardenTransition
- Apply new spacing classes throughout

### `src/components/CategoryCard.tsx`
- Larger cards on desktop: `h-[220px]`
- Emerald glass background with gold border on hover
- Serif category name styling

### `src/components/BundlesSection.tsx`
- Increase card size, add `rounded-2xl`, richer shadows
- Section heading with serif font

### `src/components/BannerCarousel.tsx`
- Add `max-w-[1400px] mx-auto` container
- Softer rounded corners, cinematic spacing

### `src/components/Footer.tsx`
- Darker emerald background
- Ivory text, gold accents on links
- More generous spacing

### `src/index.css`
- Add new utility classes: `.text-ivory`, `.bg-emerald-deep`, `.font-display`
- Add subtle keyframe for floating glow animation (community section)
- Adjust base `--background` slightly deeper

---

## Technical Constraints Honored
- All existing queries, hooks, routes, auth, cart, checkout remain untouched
- No new DB tables or migrations needed
- Products fetched via existing `products` table (`featured`, `has_in_stock` columns)
- All existing components (SearchBar, StoriesBar, ReelsBar, etc.) preserved functionally
- RTL layout maintained throughout (`dir="rtl"` on html)
- Mobile remains functional but desktop is the optimization priority

