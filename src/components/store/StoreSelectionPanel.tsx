/**
 * Store Selection Panel - لوحة اختيار المتجر
 * 
 * تعرض المتاجر المتاحة للتصفح مع إمكانية الوصول السريع
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Store, Globe, Plane, Ship, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface StoreConfig {
  name_ar: string;
  logo_url: string;
  base_url: string;
  address: {
    country: string;
    state: string;
    city: string;
    zip_code: string;
    street: string;
  };
}

interface StoreSettings {
  amazon: StoreConfig;
  newegg: StoreConfig;
  bestbuy: StoreConfig;
}

interface StoreSelectionPanelProps {
  storeSettings: StoreSettings | null | undefined;
  isLoading: boolean;
  onSelectStore: (storeKey: string) => void;
}

// معلومات المتاجر الافتراضية
const defaultStores = [
  {
    key: 'amazon',
    name: 'أمازون',
    nameEn: 'Amazon',
    description: 'أكبر متجر إلكتروني في العالم',
    color: 'bg-orange-500',
    icon: '🛒',
    country: 'usa',
    shippingTypes: ['air'],
  },
  {
    key: 'newegg',
    name: 'نيو إيج',
    nameEn: 'Newegg',
    description: 'متخصص في الإلكترونيات والكمبيوتر',
    color: 'bg-blue-600',
    icon: '💻',
    country: 'usa',
    shippingTypes: ['air'],
  },
  {
    key: 'bestbuy',
    name: 'بست باي',
    nameEn: 'BestBuy',
    description: 'إلكترونيات وأجهزة منزلية',
    color: 'bg-yellow-500',
    icon: '🏪',
    country: 'usa',
    shippingTypes: ['air'],
  },
];

export default function StoreSelectionPanel({
  storeSettings,
  isLoading,
  onSelectStore,
}: StoreSelectionPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Store className="w-5 h-5" />
            المتاجر الشهيرة
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Info className="w-4 h-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs" side="left">
                <p className="text-sm">
                  سيتم فتح المتجر في نافذة منفصلة. تصفح واختر المنتج، ثم انسخ الرابط لحساب التكلفة.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {defaultStores.map((store) => {
            const storeConfig = storeSettings?.[store.key as keyof StoreSettings];
            const isAvailable = !!storeConfig;

            return (
              <Button
                key={store.key}
                variant="outline"
                className="h-auto py-4 flex-col gap-2 hover:border-primary/50 hover:bg-primary/5 transition-all"
                onClick={() => onSelectStore(store.key)}
                disabled={isLoading || !isAvailable}
              >
                <div className="flex items-center gap-2 w-full justify-center">
                  <span className="text-2xl">{store.icon}</span>
                  <div className="text-center">
                    <p className="font-bold">{store.name}</p>
                    <p className="text-xs text-muted-foreground">{store.nameEn}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 flex-wrap justify-center">
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Globe className="w-3 h-3" />
                    {store.country === 'usa' ? 'أمريكا' : 'الصين'}
                  </Badge>
                  {store.shippingTypes.includes('air') && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Plane className="w-3 h-3" />
                      جوي
                    </Badge>
                  )}
                  {store.shippingTypes.includes('sea') && (
                    <Badge variant="outline" className="text-xs gap-1">
                      <Ship className="w-3 h-3" />
                      بحري
                    </Badge>
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        {/* تنبيه بخصوص العنوان */}
        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                ملاحظة مهمة عن العنوان
              </p>
              <p className="text-amber-600 dark:text-amber-500 text-xs mt-1">
                لضمان دقة أسعار الشحن، يُفضل تغيير عنوان التوصيل داخل المتجر لعنوان المخزن الخاص بنا 
                (سيظهر لك عند فتح المتجر). لا يمكننا تغييره تلقائياً بسبب قيود المتصفح.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
