import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  ExternalLink, 
  Maximize2, 
  X, 
  Copy, 
  Check, 
  AlertCircle,
  Store
} from 'lucide-react';
import { toast } from 'sonner';
import type { SourceCountry } from '@/hooks/useShippingCalculator';

interface WarehouseAddress {
  name: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

interface StoreConfig {
  name: string;
  nameAr: string;
  baseUrl: string;
  sourceCountry: SourceCountry;
  logoUrl: string;
  warehouseAddress: WarehouseAddress;
}

interface PopupOverlayManagerProps {
  storeKey: string;
  storeConfig: StoreConfig;
  onClose: () => void;
  children?: React.ReactNode;
}

export function PopupOverlayManager({ 
  storeKey, 
  storeConfig, 
  onClose,
  children 
}: PopupOverlayManagerProps) {
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (popupWindow) {
      popupCheckInterval.current = setInterval(() => {
        if (popupWindow.closed) {
          setIsPopupOpen(false);
          setPopupWindow(null);
        }
      }, 500);
    }

    return () => {
      if (popupCheckInterval.current) {
        clearInterval(popupCheckInterval.current);
      }
    };
  }, [popupWindow]);

  useEffect(() => {
    handleOpenPopup();
  }, []);

  const handleOpenPopup = () => {
    const width = Math.min(window.screen.width * 0.8, 1200);
    const height = Math.min(window.screen.height * 0.8, 800);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      storeConfig.baseUrl,
      `store_${storeKey}_${Date.now()}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (popup) {
      setPopupWindow(popup);
      setIsPopupOpen(true);
      popup.focus();
    } else {
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح للنوافذ المنبثقة');
    }
  };

  const handleFocusPopup = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus();
    } else {
      handleOpenPopup();
    }
  };

  const handleClosePopup = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    setIsPopupOpen(false);
  };

  const formatAddress = () => {
    const addr = storeConfig.warehouseAddress;
    return `${addr.name}\n${addr.street}\n${addr.city}, ${addr.state} ${addr.zipCode}\n${addr.country}`;
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(formatAddress());
    setCopiedAddress(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Popup Status */}
      <Card className={`border-2 ${isPopupOpen ? 'border-green-500/50 bg-green-500/5' : 'border-amber-500/50 bg-amber-500/5'}`}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isPopupOpen ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <p className="font-medium">
                  {isPopupOpen ? `المتجر مفتوح: ${storeConfig.nameAr}` : 'النافذة مغلقة'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isPopupOpen ? 'تصفح، اختر المنتج، ثم انسخ الرابط' : 'اضغط لإعادة فتح المتجر'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {isPopupOpen ? (
                <>
                  <Button variant="outline" size="sm" onClick={handleFocusPopup} className="gap-1">
                    <Maximize2 className="w-4 h-4" />
                    إظهار
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClosePopup}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleOpenPopup} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  فتح المتجر
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warehouse Address */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Store className="w-4 h-4" />
              عنوان المستودع
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyAddress} className="gap-2">
              {copiedAddress ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedAddress ? 'تم' : 'نسخ'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-3 bg-muted/50 rounded-lg font-mono text-sm" dir="ltr">
            <p className="font-semibold">{storeConfig.warehouseAddress.name}</p>
            <p>{storeConfig.warehouseAddress.street}</p>
            <p>{storeConfig.warehouseAddress.city}, {storeConfig.warehouseAddress.state} {storeConfig.warehouseAddress.zipCode}</p>
            <p>{storeConfig.warehouseAddress.country}</p>
          </div>
          
          <div className="mt-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>استخدم هذا العنوان عند الدفع في المتجر</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {children}
    </div>
  );
}
