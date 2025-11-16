/**
 * Resize Supabase storage images by modifying the URL parameters
 * @param url - Original Supabase storage URL
 * @param width - Target width in pixels
 * @returns Modified URL with resize parameters
 */
export function resizeSupabaseImage(url: string | undefined, width: number): string | undefined {
  if (!url) return url;
  
  // Check if it's a Supabase storage URL
  if (!url.includes('supabase.co/storage')) return url;
  
  // Remove existing resize parameters if present
  const baseUrl = url.split('__op__')[0];
  
  // Add new resize parameters optimized for the target width
  return `${baseUrl}__op__resize,m_lfit,w_${width}__op__format,f_auto__op__quality,q_80`;
}
