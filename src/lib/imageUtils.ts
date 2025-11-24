/**
 * Resize Supabase storage images by modifying the URL parameters
 * @param url - Original Supabase storage URL
 * @param width - Target width in pixels
 * @returns Original URL (transformations disabled due to 400 errors)
 */
export function resizeSupabaseImage(url: string | undefined, width: number): string | undefined {
  if (!url) return url;
  
  // Check if it's a Supabase storage URL
  if (!url.includes('supabase.co/storage')) return url;
  
  // Remove existing invalid resize parameters if present
  const baseUrl = url.split('__op__')[0];
  
  // Return original URL without transformations
  // The __op__ syntax was causing 400 Bad Request errors
  return baseUrl;
}
