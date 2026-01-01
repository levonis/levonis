import { useEffect, useRef } from 'react';
import { syncProductAvailability, needsSync } from '@/lib/api/taobaoSync';

interface UseTaobaoAutoSyncOptions {
  productId: string | undefined;
  taobaoUrl: string | null | undefined;
  lastSyncAt: string | null | undefined;
  maxAgeHours?: number;
  onSyncComplete?: () => void;
}

/**
 * Hook to automatically sync Taobao availability when viewing a product
 * Syncs in background without blocking UI
 */
export function useTaobaoAutoSync({
  productId,
  taobaoUrl,
  lastSyncAt,
  maxAgeHours = 24,
  onSyncComplete
}: UseTaobaoAutoSyncOptions) {
  const hasSyncedRef = useRef(false);
  
  useEffect(() => {
    // Reset sync flag when product changes
    hasSyncedRef.current = false;
  }, [productId]);
  
  useEffect(() => {
    // Skip if no URL or already synced this session
    if (!productId || !taobaoUrl || hasSyncedRef.current) return;
    
    // Check if sync is needed
    if (!needsSync(lastSyncAt || null, maxAgeHours)) {
      return;
    }
    
    // Mark as synced to prevent duplicate calls
    hasSyncedRef.current = true;
    
    // Sync in background without blocking
    const syncAsync = async () => {
      try {
        console.log('[TaobaoAutoSync] Starting background sync for product:', productId);
        const result = await syncProductAvailability(productId, taobaoUrl);
        
        if (result.success) {
          console.log('[TaobaoAutoSync] Sync completed successfully');
          onSyncComplete?.();
        } else {
          console.warn('[TaobaoAutoSync] Sync failed:', result.error);
        }
      } catch (error) {
        console.error('[TaobaoAutoSync] Error during sync:', error);
      }
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => syncAsync(), { timeout: 5000 });
    } else {
      setTimeout(syncAsync, 1000);
    }
  }, [productId, taobaoUrl, lastSyncAt, maxAgeHours, onSyncComplete]);
}

export default useTaobaoAutoSync;
