import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Loader2, Store, ExternalLink, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useShippingSettings, calculateShippingCost, type SourceCountry, type ShippingType } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';
import { PopupOverlayManager } from './PopupOverlayManager';
import { LinkCapturePanel } from './LinkCapturePanel';
import { CostBreakdownCard } from './CostBreakdownCard';
import { detectStore, extractProductIdentity, type ProductIdentity, type StoreAdapter } from '@/lib/stores/storeAdapters';
import { calculateFullCost, type ProductSpecs, type CostBreakdown } from '@/lib/stores/costEngine';

// Store configurations
const STORE_CONFIGS = {
  amazon: {
    name: 'Amazon',
    nameAr: 'أمازون',
    baseUrl: 'https://www.amazon.com',
    sourceCountry: 'usa' as SourceCountry,
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a9/Amazon_logo.svg',
    warehouseAddress: {
      name: 'Levonis Warehouse',
      street: '3865 Wilson Blvd',
      city: 'Arlington',
      state: 'VA',
      zipCode: '22203',
      country: 'USA',
    }
  },
  newegg: {
    name: 'Newegg',
    nameAr: 'نيو إيج',
    baseUrl: 'https://www.newegg.com',
    sourceCountry: 'usa' as SourceCountry,
    logoUrl: 'https://c1.neweggimages.com/WebResource/Themes/Starter/images/logo.png',
    warehouseAddress: {
      name: 'Levonis Warehouse',
      street: '3865 Wilson Blvd',
      city: 'Arlington',
      state: 'VA',
      zipCode: '22203',
      country: 'USA',
    }
  },
  bestbuy: {
    name: 'Best Buy',
    nameAr: 'بست باي',
    baseUrl: 'https://www.bestbuy.com',
    sourceCountry: 'usa' as SourceCountry,
    logoUrl: 'https://www.bestbuy.com/favicon.ico',
    warehouseAddress: {
      name: 'Levonis Warehouse',
      street: '3865 Wilson Blvd',
      city: 'Arlington',
      state: 'VA',
      zipCode: '22203',
      country: 'USA',
    }
  }
};

type StoreKey = keyof typeof STORE_CONFIGS;

export function StoreBrowserFlow() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();
  
  const [selectedStoreKey, setSelectedStoreKey] = useState<StoreKey | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [productUrl, setProductUrl] = useState<string | null>(null);
  const [productName, setProductName] = useState<string | null>(null);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);

  const selectedConfig = selectedStoreKey ? STORE_CONFIGS[selectedStoreKey] : null;

  const handleCloseStore = useCallback(() => {
    setSelectedStoreKey(null);
    setProductUrl(null);
    setProductName(null);
    setCostBreakdown(null);
  }, []);

  const handleLinkSubmit = useCallback(async (url: string) => {
    if (!shippingSettings) {
      toast.error('جاري تحميل إعدادات الشحن...');
      return;
    }

    setIsCalculating(true);
    setProductUrl(url);
    setCostBreakdown(null);

    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: url,
          sourceCountry: selectedConfig?.sourceCountry || 'usa',
          shippingType: 'air' as ShippingType
        }
      });

      if (error) throw error;

      if (!data?.success || !data?.data) {
        toast.error(data?.error || 'لم يتم العثور على معلومات المنتج');
        setIsCalculating(false);
        return;
      }

      const extracted = data.data;
      setProductName(extracted.product_name || 'منتج');

      const specs: ProductSpecs = {
        productName: extracted.product_name || 'منتج',
        priceUsd: extracted.price_usd ?? null,
        priceOriginal: extracted.price_original ?? null,
        originalCurrency: extracted.currency || 'USD',
        dimensions: extracted.dimensions ?? null,
        weight: extracted.weight ?? null,
        internalShipping: null,
        tax: null,
        estimated: extracted.estimated ?? true,
        source: extracted.source || '',
        notes: extracted.notes || null,
      };

      const breakdown = calculateFullCost(specs, selectedConfig?.sourceCountry || 'usa', 'air', shippingSettings);
      setCostBreakdown(breakdown);
      toast.success('تم حساب التكلفة بنجاح');

    } catch (error) {
      console.error('Calculation error:', error);
      toast.error('حدث خطأ في حساب التكلفة');
    } finally {
      setIsCalculating(false);
    }
  }, [shippingSettings, selectedConfig]);

  const handleAddToRequests = useCallback(async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      navigate('/auth');
      return;
    }

    if (!productUrl || !costBreakdown) {
      toast.error('يرجى حساب التكلفة أولاً');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.from('custom_product_requests').insert({
        user_id: user.id,
        product_link: productUrl,
        product_name: productName || 'منتج',
        quantity: 1,
        source_country: selectedConfig?.sourceCountry || 'usa',
        shipping_type: 'air',
        estimated_shipping_cost: costBreakdown.shippingCost + costBreakdown.commission,
        suggested_price: costBreakdown.subtotalIqd,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('تم إضافة المنتج لطلباتك!');
      navigate('/my-requests');

    } catch (error) {
      console.error('Error adding to requests:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    } finally {
      setIsSubmitting(false);
    }
  }, [user, productUrl, productName, costBreakdown, selectedConfig, navigate]);

  // Store Selection
  if (!selectedStoreKey || !selectedConfig) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            المتاجر الشهيرة
          </CardTitle>
          <CardDescription>
            اختر متجراً لتصفح المنتجات. سيفتح في نافذة منبثقة
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(STORE_CONFIGS).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setSelectedStoreKey(key as StoreKey)}
                className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
              >
                <div className="w-20 h-12 flex items-center justify-center">
                  <img 
                    src={config.logoUrl} 
                    alt={config.nameAr}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/placeholder.svg';
                    }}
                  />
                </div>
                <span className="font-medium">{config.nameAr}</span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  يفتح في نافذة منبثقة
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={handleCloseStore} className="gap-2">
        <ArrowRight className="w-4 h-4" />
        العودة لاختيار المتجر
      </Button>

      <PopupOverlayManager
        storeKey={selectedStoreKey}
        storeConfig={selectedConfig}
        onClose={handleCloseStore}
      >
        <LinkCapturePanel
          onLinkSubmit={handleLinkSubmit}
          isProcessing={isCalculating}
          expectedStore={selectedStoreKey}
        />

        {isCalculating && (
          <div className="flex items-center justify-center p-8">
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 animate-spin mx-auto text-primary" />
              <p className="text-muted-foreground">جاري حساب التكلفة...</p>
            </div>
          </div>
        )}

        {costBreakdown && !isCalculating && (
          <CostBreakdownCard
            breakdown={costBreakdown}
            productName={productName || undefined}
            onAddToRequests={handleAddToRequests}
            isSubmitting={isSubmitting}
          />
        )}
      </PopupOverlayManager>
    </div>
  );
}
