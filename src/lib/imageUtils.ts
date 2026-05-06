/**
 * Image compression and optimization utilities
 */

/**
 * Resize Supabase storage images by modifying the URL parameters
 * @param url - Original Supabase storage URL
 * @param width - Target width in pixels
 * @param quality - Image quality (1-100), default 75
 * @returns Optimized URL with resize/quality parameters
 */
export function resizeSupabaseImage(
  url: string | undefined, 
  width: number,
  quality: number = 75
): string | undefined {
  if (!url) return url;

  // Only Supabase storage URLs support transforms
  if (!url.includes('supabase.co/storage')) return url;

  // If already pointed at the render endpoint, just (re)apply params
  // Otherwise rewrite /object/public/ → /render/image/public/ which is the
  // image transformation endpoint that actually honors width/quality.
  let base = url;
  if (url.includes('/storage/v1/object/public/')) {
    base = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  } else if (!url.includes('/storage/v1/render/image/public/')) {
    // Unknown storage URL shape (e.g. signed); leave untouched
    return url;
  }

  // Strip any pre-existing transform params so callers can re-resize safely
  const [path, query = ''] = base.split('?');
  const params = new URLSearchParams(query);
  params.delete('width');
  params.delete('height');
  params.delete('quality');
  params.delete('resize');
  params.delete('format');
  params.set('width', String(width));
  params.set('quality', String(Math.max(1, Math.min(100, Math.round(quality)))));
  // 'contain' preserves aspect ratio and never upscales beyond the source,
  // preventing the "zoomed/oversized" appearance caused by the default 'cover' mode.
  params.set('resize', 'contain');
  // Request WebP — ~25-35% smaller than JPEG at equal quality, supported by all modern browsers.
  params.set('format', 'webp');
  return `${path}?${params.toString()}`;
}

/**
 * Build a responsive srcset for a Supabase image at multiple widths.
 * Browser picks the smallest acceptable size based on `sizes` attribute.
 */
export function buildResponsiveSrcSet(
  url: string | undefined,
  widths: number[],
  quality: number = 75
): string | undefined {
  if (!url) return undefined;
  return widths
    .map((w) => {
      const u = resizeSupabaseImage(url, w, quality);
      return u ? `${u} ${w}w` : null;
    })
    .filter(Boolean)
    .join(', ');
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
