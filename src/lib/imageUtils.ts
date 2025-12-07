/**
 * Resize Supabase storage images by modifying the URL parameters
 * @param url - Original Supabase storage URL
 * @param width - Target width in pixels
 * @returns Original URL unchanged (transformations disabled)
 */
export function resizeSupabaseImage(url: string | undefined, width: number): string | undefined {
  // Return the URL as-is, no transformations
  return url;
}
