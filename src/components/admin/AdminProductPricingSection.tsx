import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Ship, Plane, Calculator } from 'lucide-react';
import { useShippingSettings, calculateShippingCost } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';

interface AdminProductPricingSectionProps {
  editingProduct: any;
}

const AdminProductPricingSection = ({ editingProduct }: AdminProductPricingSectionProps) => {
  const { data: shippingSettings } = useShippingSettings();
  
  const [priceUsd, setPriceUsd] = useState<number>(editingProduct?.price_usd || 0);
  const [shippingType, setShippingType] = useState<'sea' | 'air'>(editingProduct?.shipping_type || 'sea');
  const [weightKg, setWeightKg] = useState<number>(editingProduct?.weight_kg || 0);
  const [lengthCm, setLengthCm] = useState<number>(editingProduct?.length_cm || 0);
  const [widthCm, setWidthCm] = useState<number>(editingProduct?.width_cm || 0);
  const [heightCm, setHeightCm] = useState<number>(editingProduct?.height_cm || 0);

  useEffect(() => {
    if (editingProduct) {
      setPriceUsd(editingProduct.price_usd || 0);
      setShippingType(editingProduct.shipping_type || 'sea');
      setWeightKg(editingProduct.weight_kg || 0);
      setLengthCm(editingProduct.length_cm || 0);
      setWidthCm(editingProduct.width_cm || 0);
      setHeightCm(editingProduct.height_cm || 0);
    }
  }, [editingProduct]);

  const calculation = useMemo(() => {
    if (!shippingSettings || !priceUsd) return null;

    const dimensions = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
      ? { length: lengthCm, width: widthCm, height: heightCm }
      : null;

    const shippingCalc = calculateShippingCost(
      'china',
      shippingType,
      dimensions,
      weightKg > 0 ? weightKg : null,
      shippingSettings
    );

    const priceIqd = Math.round(priceUsd * shippingSettings.usd_to_iqd_rate);
    const finalPrice = priceIqd + shippingCalc.totalCost;

    return {
      priceIqd,
      shippingCost: shippingCalc.shippingCost,
      commission: shippingCalc.commission,
      totalShipping: shippingCalc.totalCost,
      finalPrice,
      breakdown: shippingCalc.breakdown,
      rate: shippingSettings.usd_to_iqd_rate,
    };
  }, [priceUsd, shippingType, weightKg, lengthCm, widthCm, heightCm, shippingSettings]);

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <DollarSign className="h-4 w-4" />
        <span>التسعير بالدولار (نظام جديد)</span>
        {shippingSettings && (
          <Badge variant="outline" className="text-xs">
            سعر الصرف: {shippingSettings.usd_to_iqd_rate.toLocaleString()} د.ع
          </Badge>
        )}
      </div>

      <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
        {/* USD Price */}
        <div className="space-y-2">
          <Label htmlFor="price_usd">سعر القطعة بالدولار ($) *</Label>
          <Input
            id="price_usd"
            name="price_usd"
            type="number"
            step="0.01"
            min="0"
            value={priceUsd || ''}
            onChange={(e) => setPriceUsd(Number(e.target.value))}
            placeholder="0.00"
          />
        </div>

        {/* Shipping Type */}
        <div className="space-y-2">
          <Label>نوع الشحن</Label>
          <div className="flex gap-3">
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                shippingType === 'sea'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="shipping_type"
                value="sea"
                checked={shippingType === 'sea'}
                onChange={() => setShippingType('sea')}
                className="sr-only"
              />
              <Ship className="h-4 w-4" />
              <span className="text-sm font-medium">بحري</span>
            </label>
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                shippingType === 'air'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="shipping_type"
                value="air"
                checked={shippingType === 'air'}
                onChange={() => setShippingType('air')}
                className="sr-only"
              />
              <Plane className="h-4 w-4" />
              <span className="text-sm font-medium">جوي</span>
            </label>
          </div>
        </div>

        {/* Sea Shipping Fields */}
        {shippingType === 'sea' && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">أبعاد القطعة (سم) - للشحن البحري CBM</Label>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="length_cm" className="text-xs">الطول</Label>
                <Input
                  id="length_cm"
                  name="length_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={lengthCm || ''}
                  onChange={(e) => setLengthCm(Number(e.target.value))}
                  placeholder="سم"
                />
              </div>
              <div>
                <Label htmlFor="width_cm" className="text-xs">العرض</Label>
                <Input
                  id="width_cm"
                  name="width_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={widthCm || ''}
                  onChange={(e) => setWidthCm(Number(e.target.value))}
                  placeholder="سم"
                />
              </div>
              <div>
                <Label htmlFor="height_cm" className="text-xs">الارتفاع</Label>
                <Input
                  id="height_cm"
                  name="height_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={heightCm || ''}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  placeholder="سم"
                />
              </div>
            </div>
          </div>
        )}

        {/* Air Shipping Fields */}
        {shippingType === 'air' && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="weight_kg">الوزن (كغ) *</Label>
              <Input
                id="weight_kg"
                name="weight_kg"
                type="number"
                step="0.01"
                min="0"
                value={weightKg || ''}
                onChange={(e) => setWeightKg(Number(e.target.value))}
                placeholder="كغ"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">الأبعاد (اختياري - للحساب الحجمي)</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <Input
                  name="length_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={lengthCm || ''}
                  onChange={(e) => setLengthCm(Number(e.target.value))}
                  placeholder="الطول"
                />
                <Input
                  name="width_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={widthCm || ''}
                  onChange={(e) => setWidthCm(Number(e.target.value))}
                  placeholder="العرض"
                />
                <Input
                  name="height_cm"
                  type="number"
                  step="0.1"
                  min="0"
                  value={heightCm || ''}
                  onChange={(e) => setHeightCm(Number(e.target.value))}
                  placeholder="الارتفاع"
                />
              </div>
            </div>
          </div>
        )}

        {/* Calculation Preview */}
        {calculation && priceUsd > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-card border border-border space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-primary" />
              <span>معاينة السعر النهائي</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">سعر القطعة ({priceUsd}$ × {calculation.rate.toLocaleString()})</span>
                <span>{formatPrice(calculation.priceIqd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تكلفة الشحن ({shippingType === 'sea' ? 'بحري' : 'جوي'})</span>
                <span>{formatPrice(calculation.shippingCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">عمولة الموقع</span>
                <span>{formatPrice(calculation.commission)}</span>
              </div>
              <div className="border-t pt-1 flex justify-between font-bold text-primary">
                <span>السعر النهائي للزبون</span>
                <span>{formatPrice(calculation.finalPrice)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductPricingSection;
