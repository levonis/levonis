/**
 * Popup Status Bar - شريط حالة النافذة المنبثقة
 * 
 * يعرض حالة نافذة المتجر مع أزرار التحكم
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { X, Maximize2, RefreshCw, Copy, Check, Truck } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

interface StoreAddress {
  country: string;
  state: string;
  city: string;
  zip_code: string;
  street: string;
}

interface PopupStatusBarProps {
  isOpen: boolean;
  storeName: string;
  storeAddress: StoreAddress;
  onFocus: () => void;
  onClose: () => void;
  onReopen: () => void;
}

export default function PopupStatusBar({
  isOpen,
  storeName,
  storeAddress,
  onFocus,
  onClose,
  onReopen,
}: PopupStatusBarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    const address = `${storeAddress.street}, ${storeAddress.city}, ${storeAddress.state} ${storeAddress.zip_code}, ${storeAddress.country}`;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Card className="border-green-500/50 bg-green-500/5">
      <CardContent className="py-3 space-y-3">
        {/* Status Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium">{storeName} مفتوح في نافذة منفصلة</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onFocus} className="gap-1">
              <Maximize2 className="w-3 h-3" />
              عرض المتجر
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Warehouse Address */}
        <div className="p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <Truck className="w-3 h-3 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">عنوان المخزن (انسخه للمتجر):</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium" dir="ltr">
              {storeAddress.street}, {storeAddress.city}, {storeAddress.state} {storeAddress.zip_code}
            </p>
            <Button variant="ghost" size="sm" onClick={handleCopyAddress} className="h-7 px-2">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Tip */}
        <p className="text-xs text-muted-foreground">
          💡 حدد عنوان التوصيل في المتجر لهذا العنوان لرؤية تكاليف الشحن الداخلي الصحيحة
        </p>
      </CardContent>
    </Card>
  );
}
