/**
 * Link Capture Panel - لوحة التقاط رابط المنتج
 * 
 * توفر طرق متعددة للحصول على رابط المنتج:
 * 1. لصق يدوي (Paste)
 * 2. Web Share API (للموبايل)
 * 3. إرشادات للحصول على الرابط
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Link, ClipboardPaste, Share2, CheckCircle2, AlertCircle, 
  Loader2, Calculator, ExternalLink, Smartphone, Monitor
} from 'lucide-react';
import { toast } from 'sonner';
import { detectStore, extractProductIdentity, type ProductIdentity } from '@/lib/stores/storeAdapters';

interface LinkCapturePanelProps {
  onUrlSubmit: (url: string, productIdentity: ProductIdentity | null) => void;
  isCalculating: boolean;
  popupWindow: Window | null;
}

type UrlValidationStatus = 'idle' | 'valid' | 'invalid' | 'unsupported';

export default function LinkCapturePanel({
  onUrlSubmit,
  isCalculating,
  popupWindow,
}: LinkCapturePanelProps) {
  const [productUrl, setProductUrl] = useState('');
  const [validationStatus, setValidationStatus] = useState<UrlValidationStatus>('idle');
  const [detectedStore, setDetectedStore] = useState<string | null>(null);
  const [productIdentity, setProductIdentity] = useState<ProductIdentity | null>(null);
  const [supportsWebShare, setSupportsWebShare] = useState(false);

  // Check Web Share API support
  useEffect(() => {
    setSupportsWebShare(typeof navigator !== 'undefined' && 'share' in navigator && 'canShare' in navigator);
  }, []);

  // Validate URL on change
  useEffect(() => {
    if (!productUrl.trim()) {
      setValidationStatus('idle');
      setDetectedStore(null);
      setProductIdentity(null);
      return;
    }

    try {
      new URL(productUrl);
      const adapter = detectStore(productUrl);
      
      if (adapter) {
        setDetectedStore(adapter.nameAr);
        const identity = extractProductIdentity(productUrl);
        setProductIdentity(identity);
        setValidationStatus('valid');
      } else {
        setDetectedStore(null);
        setProductIdentity(null);
        // Still allow unknown stores
        setValidationStatus('unsupported');
      }
    } catch {
      setValidationStatus('invalid');
      setDetectedStore(null);
      setProductIdentity(null);
    }
  }, [productUrl]);

  // Handle paste from clipboard
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setProductUrl(text.trim());
        toast.success('تم لصق الرابط');
      }
    } catch (error) {
      toast.error('لا يمكن الوصول للحافظة. يرجى اللصق يدوياً');
    }
  };

  // Handle Web Share Target (receiving shared links)
  const handleWebShare = async () => {
    try {
      // This is for sharing TO this app, not FROM
      // For now, just show instructions
      toast.info('شارك رابط المنتج من المتصفح إلى هذا الموقع');
    } catch (error) {
      console.error('Web Share error:', error);
    }
  };

  // Handle calculate button click
  const handleCalculate = () => {
    if (validationStatus === 'invalid') {
      toast.error('رابط غير صالح');
      return;
    }

    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج');
      return;
    }

    onUrlSubmit(productUrl.trim(), productIdentity);
  };

  const getStatusIcon = () => {
    switch (validationStatus) {
      case 'valid':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'invalid':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'unsupported':
        return <AlertCircle className="w-4 h-4 text-amber-500" />;
      default:
        return null;
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Link className="w-5 h-5" />
          رابط المنتج
        </CardTitle>
        <CardDescription>
          {popupWindow && !popupWindow.closed
            ? 'انسخ رابط المنتج من نافذة المتجر وألصقه هنا'
            : 'أدخل رابط المنتج من أي متجر لحساب التكلفة'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* URL Input */}
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://www.amazon.com/dp/..."
                className="pr-10 text-sm"
                dir="ltr"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {getStatusIcon()}
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={handlePaste} title="لصق">
              <ClipboardPaste className="w-4 h-4" />
            </Button>
          </div>

          {/* Store Detection Badge */}
          {detectedStore && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {detectedStore}
              </Badge>
              {productIdentity && (
                <Badge variant="outline" className="text-xs" dir="ltr">
                  {productIdentity.productId}
                </Badge>
              )}
            </div>
          )}

          {validationStatus === 'unsupported' && (
            <p className="text-xs text-amber-600">
              متجر غير معروف. سنحاول استخراج المعلومات تلقائياً.
            </p>
          )}

          {validationStatus === 'invalid' && productUrl && (
            <p className="text-xs text-red-500">
              رابط غير صالح. تأكد من نسخ الرابط كاملاً.
            </p>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePaste}
            className="gap-1"
          >
            <ClipboardPaste className="w-3 h-3" />
            لصق من الحافظة
          </Button>
          
          {supportsWebShare && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleWebShare}
              className="gap-1"
            >
              <Share2 className="w-3 h-3" />
              استلام مشاركة
            </Button>
          )}
        </div>

        <Separator />

        {/* Calculate Button */}
        <Button
          onClick={handleCalculate}
          disabled={isCalculating || !productUrl.trim() || validationStatus === 'invalid'}
          className="w-full gap-2"
          size="lg"
        >
          {isCalculating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري حساب التكلفة...
            </>
          ) : (
            <>
              <Calculator className="w-4 h-4" />
              حساب التكلفة
            </>
          )}
        </Button>

        {/* Instructions */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-2">
          <p className="text-xs font-medium text-muted-foreground">كيفية الحصول على الرابط:</p>
          
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Monitor className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>الكمبيوتر:</strong> افتح المتجر، اختر المنتج والخيارات، ثم انسخ الرابط من شريط العنوان
            </span>
          </div>
          
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              <strong>الموبايل:</strong> افتح المتجر، اختر المنتج، اضغط على "مشاركة" ثم انسخ الرابط
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
