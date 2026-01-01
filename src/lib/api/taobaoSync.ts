import { supabase } from '@/integrations/supabase/client';

interface VariantAvailability {
  name: string;
  name_ar?: string;
  available: boolean;
  sku_id?: string;
}

interface SyncResult {
  success: boolean;
  product_available: boolean;
  variants: VariantAvailability[];
  last_sync_at: string;
  error?: string;
}

/**
 * Sync availability for a single product from Taobao
 */
export async function syncProductAvailability(
  productId: string, 
  taobaoUrl: string
): Promise<SyncResult> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-taobao-availability', {
      body: { product_id: productId, taobao_url: taobaoUrl }
    });
    
    if (error) {
      console.error('Sync error:', error);
      return {
        success: false,
        product_available: false,
        variants: [],
        last_sync_at: new Date().toISOString(),
        error: error.message
      };
    }
    
    return data;
  } catch (err) {
    console.error('Sync request failed:', err);
    return {
      success: false,
      product_available: false,
      variants: [],
      last_sync_at: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error'
    };
  }
}

/**
 * Sync availability for all products with Taobao URLs
 */
export async function syncAllProductsAvailability(): Promise<{
  success: boolean;
  synced: number;
  results: Array<{ product_id: string; name: string; success: boolean; available: boolean }>;
}> {
  try {
    const { data, error } = await supabase.functions.invoke('sync-taobao-availability', {
      body: { sync_all: true }
    });
    
    if (error) {
      console.error('Bulk sync error:', error);
      return { success: false, synced: 0, results: [] };
    }
    
    return data;
  } catch (err) {
    console.error('Bulk sync request failed:', err);
    return { success: false, synced: 0, results: [] };
  }
}

/**
 * Check if a product needs sync (older than specified hours)
 */
export function needsSync(lastSyncAt: string | null, maxAgeHours: number = 24): boolean {
  if (!lastSyncAt) return true;
  
  const lastSync = new Date(lastSyncAt).getTime();
  const now = Date.now();
  const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
  
  return (now - lastSync) > maxAgeMs;
}

/**
 * Get cached availability for a product
 */
export function getCachedAvailability(product: any): {
  isAvailable: boolean;
  variants: VariantAvailability[];
  lastSync: string | null;
  syncStatus: string;
} {
  const cache = product.taobao_availability_cache || {};
  
  return {
    isAvailable: product.in_stock ?? true,
    variants: cache.variants || [],
    lastSync: product.taobao_last_sync_at,
    syncStatus: product.taobao_sync_status || 'pending'
  };
}

/**
 * Check if a specific variant/color is available
 */
export function isVariantAvailable(
  product: any,
  variantName: string
): boolean {
  const cache = product.taobao_availability_cache || {};
  const variants = cache.variants || [];
  
  // If no variant data, assume available
  if (variants.length === 0) return product.in_stock ?? true;
  
  // Find matching variant
  const variant = variants.find((v: VariantAvailability) => 
    v.name === variantName || 
    v.name_ar === variantName ||
    variantName.includes(v.name) ||
    v.name.includes(variantName)
  );
  
  // If found, return its availability; otherwise, use product availability
  return variant ? variant.available : (product.in_stock ?? true);
}
