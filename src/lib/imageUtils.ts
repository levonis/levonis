/**
 * Image compression and optimization utilities
 */

// Module-level LRU caches to avoid recomputing identical URLs/srcsets
// across many product cards. Bounded to prevent unbounded memory growth.
const RESIZE_CACHE = new Map<string, string | undefined>();
const SRCSET_CACHE = new Map<string, string | undefined>();
const CACHE_MAX = 500;

function cacheGet<T>(map: Map<string, T>, key: string): T | undefined {
  if (!map.has(key)) return undefined;
  const v = map.get(key) as T;
  map.delete(key);
  map.set(key, v);
  return v;
}

function cacheSet<T>(map: Map<string, T>, key: string, value: T): T {
  if (map.size >= CACHE_MAX) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  map.set(key, value);
  return value;
}

/**
 * Resize Supabase storage images by modifying the URL parameters
 */
export function resizeSupabaseImage(
  url: string | undefined,
  width: number,
  quality: number = 75,
  format: 'webp' | 'avif' | 'origin' = 'webp'
): string | undefined {
  if (!url) return url;

  const cacheKey = `${url}|${width}|${quality}|${format}`;
  const cached = cacheGet(RESIZE_CACHE, cacheKey);
  if (cached !== undefined) return cached;

  if (!url.includes('supabase.co/storage')) return cacheSet(RESIZE_CACHE, cacheKey, url);

  let base = url;
  if (url.includes('/storage/v1/object/public/')) {
    base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  } else if (!url.includes('/storage/v1/render/image/public/')) {
    return cacheSet(RESIZE_CACHE, cacheKey, url);
  }

  const [path, query = ''] = base.split('?');
  const params = new URLSearchParams(query);
  params.delete('width');
  params.delete('height');
  params.delete('quality');
  params.delete('resize');
  params.delete('format');
  params.set('width', String(width));
  params.set('quality', String(Math.max(1, Math.min(100, Math.round(quality)))));
  params.set('resize', 'contain');
  if (format !== 'origin') params.set('format', format);
  return cacheSet(RESIZE_CACHE, cacheKey, `${path}?${params.toString()}`);
}

/**
 * Build a responsive srcset for a Supabase image at multiple widths.
 */
export function buildResponsiveSrcSet(
  url: string | undefined,
  widths: number[],
  quality: number = 75
): string | undefined {
  if (!url) return undefined;
  const cacheKey = `${url}|${widths.join(',')}|${quality}`;
  const cached = cacheGet(SRCSET_CACHE, cacheKey);
  if (cached !== undefined) return cached;

  const result = widths
    .map((w) => {
      const u = resizeSupabaseImage(url, w, quality);
      return u ? `${u} ${w}w` : null;
    })
    .filter(Boolean)
    .join(', ');
  return cacheSet(SRCSET_CACHE, cacheKey, result || undefined);
}

/**
 * Get optimal image size based on viewport
 * @param containerWidth - Width of the container element
 * @param devicePixelRatio - Device pixel ratio (default 2 for retina)
 * @returns Optimal width for the image
 */
export function getOptimalImageWidth(
  containerWidth: number, 
  devicePixelRatio: number = 2
): number {
  // Cap at 2x for performance (3x is often overkill)
  const dpr = Math.min(devicePixelRatio, 2);
  const optimalWidth = Math.ceil(containerWidth * dpr);
  
  // Snap to standard sizes for better caching
  const standardSizes = [100, 200, 300, 400, 600, 800, 1000, 1200, 1600, 2000];
  return standardSizes.find(size => size >= optimalWidth) || standardSizes[standardSizes.length - 1];
}

/**
 * Generate srcset for responsive images
 * @param url - Base image URL
 * @param sizes - Array of widths
 * @param quality - Image quality
 * @returns srcset string
 */
export function generateSrcSet(
  url: string | undefined,
  sizes: number[] = [200, 400, 600, 800],
  quality: number = 75
): string {
  if (!url) return '';
  
  return sizes
    .map(size => `${resizeSupabaseImage(url, size, quality)} ${size}w`)
    .join(', ');
}

/**
 * Default image quality presets
 */
export const IMAGE_QUALITY = {
  low: 50,      // For thumbnails, previews
  medium: 70,   // For product cards
  high: 85,     // For product detail pages
  lossless: 100 // For logos, icons
} as const;

/**
 * Standard image sizes for the app
 */
export const IMAGE_SIZES = {
  thumbnail: 100,
  card: 300,
  cardRetina: 600,
  detail: 800,
  detailRetina: 1600,
  banner: 1200,
  bannerRetina: 2400
} as const;
