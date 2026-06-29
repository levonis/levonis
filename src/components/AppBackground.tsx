/**
 * AppBackground — disabled.
 *
 * The previous animated dark-green wallpaper (≈ #234d3f) was removed per
 * product request. This component is intentionally a no-op so existing
 * imports/usages stay valid without painting any background. The page
 * background now comes solely from `--background` defined in index.css.
 */
export default function AppBackground() {
  return null;
}
