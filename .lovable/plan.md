
User reports: when navigating back, the page returns to the wrong scroll position instead of where they were before.

Likely cause: The project has a `ScrollToTop` component that scrolls to top on every route change — including back navigation. This breaks browser-native scroll restoration.

Let me check.
<lov-tool-use id="toolu_vrtx_011vyYgsysUUocWHyJpLdSyE" name="code--search_files" integration-id="code" data="{\"query\": \"ScrollToTop|scrollRestoration|window.scrollTo\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015Ky7qzzY3eQeFpwrfRhQVB" name="code--search_files" integration-id="code" data="{\"query\": \"ScrollToTop|scrollRestoration|window.scrollTo\", \"include_patterns\": \"src/**/*.tsx,src/**/*.ts\"}">
</lov-tool-use>
No global ScrollToTop, but ProductCard force-scrolls to top on Link click. Let me check App.tsx routing setup and any back navigation patterns.
<lov-tool-use id="toolu_vrtx_01RNkMqDE1PqFAdjPaaXAgt4" name="code--search_files" integration-id="code" data="{\"include_patterns\": \"src/**/*.tsx\", \"query\": \"navigate\\\\(-1\\\\)|navigate\\\\(\\\\\\\"\\\\/\"}">
</lov-tool-use>
I have enough context. The issue: `ProductCard.tsx` always scrolls to top on click, AND there's no scroll restoration on back navigation. When user goes back from product page, they land at top instead of where they were.

<lov-plan>

## Issue
When user clicks a product card and then presses "back" (browser back or `navigate(-1)`), the page returns to the top instead of restoring to the previous scroll position (e.g. where the product card was in the grid).

## Root Cause
1. React Router does NOT restore scroll position automatically.
2. `src/components/ProductCard.tsx` line 119 calls `window.scrollTo({ top: 0 })` on every click — but since it fires on Link click, it doesn't directly affect back navigation. However, no mechanism saves/restores scroll on POP navigation, so the page renders at top (or wherever it lands).
3. There is no global scroll-restoration component.

## Fix

### 1. New component `src/components/ScrollRestoration.tsx`
A global scroll manager that:
- Listens to `useLocation()` + `useNavigationType()` from react-router-dom.
- On `PUSH`/`REPLACE` → scroll to top (smooth or instant).
- On `POP` (back/forward) → restore the saved scroll for that history key.
- Saves `window.scrollY` per `location.key` into a `Map` (in-memory) before navigation away (using `useEffect` cleanup + `beforeunload`).

```tsx
// pseudo
const positions = new Map<string, number>();
useEffect(() => {
  return () => { positions.set(location.key, window.scrollY); };
}, [location]);

useLayoutEffect(() => {
  if (navType === "POP") {
    const y = positions.get(location.key) ?? 0;
    window.scrollTo(0, y);
  } else {
    window.scrollTo(0, 0);
  }
}, [location, navType]);
```

### 2. Mount in `src/App.tsx` inside `<BrowserRouter>` above `<Routes>`.

### 3. Remove the forced scroll in `src/components/ProductCard.tsx`
Delete line 119 `onClick={() => window.scrollTo(...)}` — global handler now manages scroll for forward navigation too.

## Result
- Forward navigation (clicking a product, opening a page) → scrolls to top.
- Back navigation (browser back or `navigate(-1)`) → restores the exact scroll position the user was at.
- Works across all routes globally.

