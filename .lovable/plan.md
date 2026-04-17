
Continuing from the prior plan to fix featured product card alignment on mobile (`< 640px`).

## Changes

**1. `src/index.css`** — Add mobile-first sizes for cube elements (currently sized for desktop, overflow the 112px image container):
- `.cube-top-featured`, `.cube-mid-featured`, `.cube-front-featured`, `.cube-top-highlight`: width `120px`, reduced heights (top `14px`, front `30px`)
- `.cube-bottom-edge`: width `110px`
- `.cube-bottom-reflection`: width `108px`
- `.cube-glow-ring`: width `150px`
- `.cube-ambient-glow`: width `170px`

Keep existing `@media (min-width: 640px)` and `(min-width: 768px)` overrides intact.

**2. `src/components/FloatingProductCard.tsx`**:
- Replace inline `style={{ marginBottom: '-2.5rem' }}` on the image wrapper with responsive Tailwind: `mb-[-1rem] sm:mb-[-2.5rem]` so image sits correctly on the smaller mobile platform.
- Change ground reflection width `w-44` → `w-36 sm:w-64 md:w-[26rem]` to match scaled platform.

## Result
Image, pedestal, glow, and reflection stay proportional across mobile / tablet / desktop. Text content untouched.
