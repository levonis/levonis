import { useState } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { syncProductAvailability } from '@/lib/api/taobaoSync';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TaobaoSyncStatusProps {
  productId: string;
  taobaoUrl: string | null | undefined;
  lastSyncAt: string | null | undefined;
  syncStatus: string | null | undefined;
  onSyncComplete?: () => void;
}

export function TaobaoSyncStatus({
  productId,
  taobaoUrl,
  lastSyncAt,
  syncStatus,
  onSyncComplete
}: TaobaoSyncStatusProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  
  if (!taobaoUrl) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <AlertCircle className="h-3 w-3 ml-1" />
        بدون رابط Taobao
      </Badge>
    );
  }
  
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncProductAvailability(productId, taobaoUrl);
      
      if (result.success) {
        toast.success('تم مزامنة التوفر بنجاح');
        onSyncComplete?.();
      } else {
        toast.error(result.error || 'فشل في مزامنة التوفر');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء المزامنة');
    } finally {
      setIsSyncing(false);
    }
  };
  
  const getStatusIcon = () => {
    if (syncStatus === 'success') {
      return <CheckCircle className="h-3 w-3 text-green-500" />;
    } else if (syncStatus === 'error') {
      return <AlertCircle className="h-3 w-3 text-red-500" />;
    }
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  };
  
  const getStatusText = () => {
    if (!lastSyncAt) return 'لم تتم المزامنة بعد';
    
    try {
      return `آخر مزامنة: ${formatDistanceToNow(new Date(lastSyncAt), { 
        addSuffix: true, 
        locale: ar 
      })}`;
    } catch {
      return 'آخر مزامنة: غير معروف';
    }
  };
  
  return (
    <div className="flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={syncStatus === 'success' ? 'default' : syncStatus === 'error' ? 'destructive' : 'secondary'}
              className="cursor-default"
            >
              {getStatusIcon()}
              <span className="mr-1 text-xs">{getStatusText()}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>حالة مزامنة Taobao</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={handleSync}
        disabled={isSyncing}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}

export default TaobaoSyncStatus;
