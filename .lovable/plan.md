

## Profile Orb beside the Dynamic Island + Circular Reveal Animation

### What the user gets

A small **glassmorphism circular button** with the user's avatar (or User icon) pinned at the top of the screen, **next to the Dynamic Island**. Tapping it triggers a premium **circular expansion animation** that grows from the orb's position until it fills the entire screen — and the `/profile` page content is revealed from within that expanding circle (clipped to it). Navigating away (back button, route change) plays the reverse: the page contracts back into the orb.

```text
┌──────────────────────────────────────────┐
│                                          │
│   ◯  ▭▭▭▭▭ DynamicIsland ▭▭▭▭▭          │  ← top bar
│   ↑                                      │
│   Profile orb (glass, 40px)              │
│                                          │
│   Tap → circle expands from orb origin  │
│   ◯ → ◯◯ → ⬤⬤⬤ (fills screen)            │
│                                          │
│   /profile content rendered inside       │
└──────────────────────────────────────────┘
```

### Components to build

1. **`src/components/ProfileOrb.tsx`** (new)
   - Small circular glassmorphism button (`w-10 h-10 rounded-full glass-panel`), avatar image with fallback to `User` icon.
   - Fixed position: `top-3` + horizontally offset from the centered Island (e.g. RTL-aware: `right-3` for Arabic, `left-3` otherwise).
   - On click: stores its bounding rect (origin x/y) in a global context, then `navigate('/profile')`.
   - Hidden when already on `/profile` (since the orb visually "becomes" the page).
   - Reads avatar from `useAuth()` + `profiles` table.

2. **`src/components/ProfileTransitionProvider.tsx`** (new context)
   - Stores `originRect: { x, y } | null` and a `phase: 'idle' | 'expanding' | 'open' | 'collapsing'`.
   - Exposed via `useProfileTransition()` hook so the orb sets the origin and the page reads it.

3. **`src/components/ProfileExpansionShell.tsx`** (new)
   - Wraps `<Profile />` route element.
   - Uses **framer-motion** with a `clip-path: circle(R at X Y)` animation:
     - **Enter**: `clipPath: circle(20px at originX originY)` → `circle(150vmax at originX originY)` (covers screen).
     - **Exit** (on route change away): reverse to `circle(20px at originX originY)`.
   - Uses spring transition (`stiffness: 220, damping: 28, mass: 0.9`) for that elastic "balloon inflating" feel.
   - Inside the clipped layer renders the actual `<Profile />` content (already loaded — clip-path just reveals it).
   - Adds a subtle backdrop fade and a soft white ring at the expanding edge for premium polish.

4. **Route integration in `src/App.tsx`**
   - Wrap `ProfileTransitionProvider` around `AppContent` (above `IslandProvider` is fine).
   - Render `<ProfileOrb />` inside `AppContent` next to `<DynamicIsland />`.
   - Replace `<Route path="/profile" element={<Profile />} />` with `<Route path="/profile" element={<ProfileExpansionShell><Profile /></ProfileExpansionShell> />`.
   - Use `AnimatePresence mode="wait"` at the route level only for `/profile` so the collapse animation plays before unmount when navigating away.

5. **Remove duplicate Profile entry from `AppNavBar`**
   - Remove the `account → /profile` item from `NAV_ITEMS` (it's now the orb at the top). Keeps the bottom nav cleaner and avoids two entry points to the same page.

### Animation specifics

- **Origin tracking**: orb's `getBoundingClientRect()` center is captured on click; persisted via context so the shell knows where to "grow from".
- **Clip-path circle**: GPU-accelerated, smooth on mobile; doesn't trigger layout.
- **Reverse transition**: a `useEffect` in `ProfileExpansionShell` listens to route change away from `/profile` — sets `phase: 'collapsing'`, then unmounts after the animation completes.
- **Reduced-motion**: respects `prefers-reduced-motion` → falls back to a 150ms fade.
- **Interruptions**: if the user double-taps or navigates mid-animation, framer-motion's spring smoothly retargets.

### Visual polish

- Orb: `glass-panel rounded-full`, soft ring on hover, gentle scale down on press (`active:scale-95`), pulsing dot if there are pending notifications (optional, future).
- Expanding circle background: solid `bg-background` with a 1px inner glow `inset 0 0 0 1px hsl(var(--primary)/0.25)` so the leading edge feels premium.
- `z-index`: orb at `z-50`, expansion shell at `z-40` (under the Island so the Island stays on top during transition — feels "anchored").

### Files

- New: `src/components/ProfileOrb.tsx`, `src/components/ProfileTransitionProvider.tsx`, `src/components/ProfileExpansionShell.tsx`
- Edited: `src/App.tsx` (provider + orb + route wrap), `src/components/AppNavBar.tsx` (remove `/profile` nav item)

### Out of scope

- Redesigning the `/profile` page content itself (only its entry transition changes).
- Adding the same effect to other pages — easy to extend later by reusing `ProfileExpansionShell`.

