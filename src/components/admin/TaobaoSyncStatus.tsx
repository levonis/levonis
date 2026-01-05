import { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Link2, Unlink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { syncProductAvailability } from '@/lib/api/taobaoSync';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

interface TaobaoVariant {
  name: string;
  name_ar?: string;
  available: boolean;
  sku_id?: string;
}

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

// New component for individual option/color sync status with mapping
interface OptionSyncBadgeProps {
  itemName: string;
  itemNameAr: string;
  cachedVariants: TaobaoVariant[];
  linkedTaobaoName?: string | null;
  onLinkChange?: (taobaoName: string | null) => void;
  hasTaobaoUrl: boolean;
}

export function OptionSyncBadge({
  itemName,
  itemNameAr,
  cachedVariants,
  linkedTaobaoName,
  onLinkChange,
  hasTaobaoUrl
}: OptionSyncBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!hasTaobaoUrl) return null;

  // Find matching variant
  const findMatchingVariant = (): TaobaoVariant | undefined => {
    if (linkedTaobaoName) {
      return cachedVariants.find(v => v.name === linkedTaobaoName);
    }
    
    // Auto-match by name similarity
    return cachedVariants.find(v => {
      const variantName = v.name.toLowerCase();
      const localName = itemName.toLowerCase();
      const localNameAr = itemNameAr.toLowerCase();
      
      return variantName === localName || 
             variantName === localNameAr ||
             localName.includes(variantName) || 
             variantName.includes(localName) ||
             localNameAr.includes(variantName) ||
             variantName.includes(localNameAr);
    });
  };

  const matchedVariant = findMatchingVariant();
  const isLinked = !!matchedVariant || !!linkedTaobaoName;
  const isAvailable = matchedVariant?.available ?? true;
  const linkedName = linkedTaobaoName || matchedVariant?.name;

  const handleLinkChange = (value: string) => {
    const newLink = value === '__none__' ? null : value;
    onLinkChange?.(newLink);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isLinked ? (isAvailable ? "default" : "destructive") : "secondary"}
              className="text-[10px] gap-1 cursor-pointer"
              onClick={() => cachedVariants.length > 0 && setIsOpen(!isOpen)}
            >
              {isLinked ? (
                isAvailable ? (
                  <><CheckCircle className="h-3 w-3" /> متزامن</>
                ) : (
                  <><AlertCircle className="h-3 w-3" /> نفذ</>
                )
              ) : (
                <><Unlink className="h-3 w-3" /> غير مرتبط</>
              )}
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="text-xs space-y-1">
              {isLinked ? (
                <>
                  <p>مرتبط بـ: <strong>{linkedName}</strong></p>
                  <p>الحالة: {isAvailable ? '✅ متوفر' : '❌ غير متوفر'} في Taobao</p>
                </>
              ) : (
                <p>اضغط لربط هذا الخيار مع خيار من Taobao</p>
              )}
              {cachedVariants.length === 0 && (
                <p className="text-muted-foreground">قم بتحديث المزامنة للحصول على الخيارات</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Dropdown for manual linking */}
      {isOpen && cachedVariants.length > 0 && (
        <div className="mt-1 p-2 bg-popover border rounded-md shadow-md z-10">
          <Label className="text-[10px] text-muted-foreground mb-1 block">
            <Link2 className="h-3 w-3 inline ml-1" />
            ربط مع:
          </Label>
          <Select
            value={linkedTaobaoName || '__none__'}
            onValueChange={handleLinkChange}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="اختر خيار Taobao" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__" className="text-xs">
                <span className="text-muted-foreground">إلغاء الربط</span>
              </SelectItem>
              {cachedVariants.map((variant, idx) => (
                <SelectItem key={idx} value={variant.name} className="text-xs">
                  <span className="flex items-center gap-2">
                    {variant.name}
                    <Badge 
                      variant="outline" 
                      className={`text-[8px] py-0 h-4 ${
                        variant.available 
                          ? 'bg-green-50 text-green-600 border-green-200' 
                          : 'bg-red-50 text-red-600 border-red-200'
                      }`}
                    >
                      {variant.available ? 'متوفر' : 'نفذ'}
                    </Badge>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

export default TaobaoSyncStatus;
