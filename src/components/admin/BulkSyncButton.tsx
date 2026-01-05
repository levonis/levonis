import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Loader2 } from 'lucide-react';
import { syncAllProductsAvailability } from '@/lib/api/taobaoSync';
import { toast } from 'sonner';

interface BulkSyncButtonProps {
  products: any[];
  onSyncComplete?: () => void;
}

export function BulkSyncButton({ products, onSyncComplete }: BulkSyncButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false);

  const productsWithUrl = products?.filter(p => p.taobao_url).length || 0;

  const handleBulkSync = async () => {
    if (productsWithUrl === 0) {
      toast.error('لا توجد منتجات مرتبطة بروابط Taobao/JD');
      return;
    }

    setIsSyncing(true);
    toast.info(`جاري مزامنة ${productsWithUrl} منتج...`);

    try {
      const result = await syncAllProductsAvailability();
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length;
        const failedCount = result.results.filter(r => !r.success).length;
        const availableCount = result.results.filter(r => r.available).length;
        
        toast.success(
          `تم مزامنة ${successCount} منتج بنجاح (${availableCount} متوفر)${failedCount > 0 ? ` - ${failedCount} فشل` : ''}`
        );
        onSyncComplete?.();
      } else {
        toast.error('فشل في المزامنة الجماعية');
      }
    } catch (error) {
      console.error('Bulk sync error:', error);
      toast.error('حدث خطأ أثناء المزامنة الجماعية');
    } finally {
      setIsSyncing(false);
    }
  };

  if (productsWithUrl === 0) {
    return null;
  }

  return (
    <Button
      variant="outline"
      onClick={handleBulkSync}
      disabled={isSyncing}
      className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/30"
    >
      {isSyncing ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          جاري المزامنة...
        </>
      ) : (
        <>
          <RefreshCw className="h-4 w-4" />
          مزامنة الكل ({productsWithUrl})
        </>
      )}
    </Button>
  );
}

export default BulkSyncButton;
