import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Ship, Plane, Calculator, ShoppingBag, Package } from 'lucide-react';
import { useShippingSettings, calculateShippingCost } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';

interface AdminProductPricingSectionProps {
  editingProduct: any;
}

const AdminProductPricingSection = ({ editingProduct }: AdminProductPricingSectionProps) => {
  const { data: shippingSettings } = useShippingSettings();
  
  // Sale type: 'pre_order' or 'direct'
  const [saleType, setSaleType] = useState<'pre_order' | 'direct'>('pre_order');
  const [priceUsd, setPriceUsd] = useState<number>(editingProduct?.price_usd || 0);
  const [shippingType, setShippingType] = useState<'sea' | 'air'>(editingProduct?.shipping_type || 'sea');
  const [weightKg, setWeightKg] = useState<number>(editingProduct?.weight_kg || 0);
  const [lengthCm, setLengthCm] = useState<number>(editingProduct?.length_cm || 0);
  const [widthCm, setWidthCm] = useState<number>(editingProduct?.width_cm || 0);
  const [heightCm, setHeightCm] = useState<number>(editingProduct?.height_cm || 0);
  const [commissionIqd, setCommissionIqd] = useState<number>(editingProduct?.commission_iqd || 0);
  const [otherCostsIqd, setOtherCostsIqd] = useState<number>(editingProduct?.other_costs_iqd || 0);

  useEffect(() => {
    if (editingProduct) {
      setPriceUsd(editingProduct.price_usd || 0);
      setShippingType(editingProduct.shipping_type || 'sea');
      setWeightKg(editingProduct.weight_kg || 0);
      setLengthCm(editingProduct.length_cm || 0);
      setWidthCm(editingProduct.width_cm || 0);
      setHeightCm(editingProduct.height_cm || 0);
      setCommissionIqd(editingProduct.commission_iqd || 0);
      setOtherCostsIqd(editingProduct.other_costs_iqd || 0);
      
      // Determine sale type from existing data
      if (editingProduct.has_in_stock && !editingProduct.has_pre_order) {
        setSaleType('direct');
      } else {
        setSaleType('pre_order');
      }
    }
  }, [editingProduct]);

  const calculation = useMemo(() => {
    if (!shippingSettings || !priceUsd) return null;

    const priceIqd = Math.round(priceUsd * shippingSettings.usd_to_iqd_rate);

    if (saleType === 'direct') {
      const finalPrice = priceIqd + otherCostsIqd + commissionIqd;
      return {
        priceIqd,
        shippingCost: 0,
        otherCosts: otherCostsIqd,
        commission: commissionIqd,
        finalPrice,
        rate: shippingSettings.usd_to_iqd_rate,
      };
    }

    // Pre-order calculation
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

    // Use manual commission instead of global commission_fee
    const finalPrice = priceIqd + shippingCalc.shippingCost + commissionIqd;

    return {
      priceIqd,
      shippingCost: shippingCalc.shippingCost,
      otherCosts: 0,
      commission: commissionIqd,
      finalPrice,
      breakdown: shippingCalc.breakdown,
      rate: shippingSettings.usd_to_iqd_rate,
    };
  }, [priceUsd, saleType, shippingType, weightKg, lengthCm, widthCm, heightCm, commissionIqd, otherCostsIqd, shippingSettings]);

  return (
    <div className="space-y-4 border-t pt-4">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="commission_iqd" value={commissionIqd} />
      <input type="hidden" name="other_costs_iqd" value={otherCostsIqd} />
      <input type="hidden" name="sale_type" value={saleType} />

      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <DollarSign className="h-4 w-4" />
        <span>التسعير بالدولار</span>
        {shippingSettings && (
          <Badge variant="outline" className="text-xs">
            سعر الصرف: {shippingSettings.usd_to_iqd_rate.toLocaleString()} د.ع
          </Badge>
        )}
      </div>

      <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
        {/* Sale Type Toggle */}
        <div className="space-y-2">
          <Label>نوع البيع</Label>
          <div className="flex gap-3">
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                saleType === 'pre_order'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="sale_type_radio"
                value="pre_order"
                checked={saleType === 'pre_order'}
                onChange={() => setSaleType('pre_order')}
                className="sr-only"
              />
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">حجز مسبق</span>
            </label>
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                saleType === 'direct'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <input
                type="radio"
                name="sale_type_radio"
                value="direct"
                checked={saleType === 'direct'}
                onChange={() => setSaleType('direct')}
                className="sr-only"
              />
              <ShoppingBag className="h-4 w-4" />
              <span className="text-sm font-medium">بيع مباشر</span>
            </label>
          </div>
        </div>

        {/* USD Price - common for both */}
        <div className="space-y-2">
          <Label htmlFor="price_usd">سعر تكلفة المنتج بالدولار ($) *</Label>
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

        {/* ===== PRE-ORDER SECTION ===== */}
        {saleType === 'pre_order' && (
          <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
            <Label className="text-sm font-medium">إعدادات الشحن</Label>
            
            {/* Shipping Type */}
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

            {/* Sea: dimensions for CBM */}
            {shippingType === 'sea' && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">أبعاد القطعة (سم) - لحساب CBM</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label htmlFor="length_cm" className="text-xs">الطول</Label>
                    <Input id="length_cm" name="length_cm" type="number" step="0.1" min="0"
                      value={lengthCm || ''} onChange={(e) => setLengthCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                  <div>
                    <Label htmlFor="width_cm" className="text-xs">العرض</Label>
                    <Input id="width_cm" name="width_cm" type="number" step="0.1" min="0"
                      value={widthCm || ''} onChange={(e) => setWidthCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                  <div>
                    <Label htmlFor="height_cm" className="text-xs">الارتفاع</Label>
                    <Input id="height_cm" name="height_cm" type="number" step="0.1" min="0"
                      value={heightCm || ''} onChange={(e) => setHeightCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                </div>
              </div>
            )}

            {/* Air: weight */}
            {shippingType === 'air' && (
              <div className="space-y-2">
                <Label htmlFor="weight_kg">الوزن (كغ) *</Label>
                <Input id="weight_kg" name="weight_kg" type="number" step="0.01" min="0"
                  value={weightKg || ''} onChange={(e) => setWeightKg(Number(e.target.value))} placeholder="كغ" />
                <div>
                  <Label className="text-xs text-muted-foreground">الأبعاد (اختياري - للحساب الحجمي)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <Input name="length_cm" type="number" step="0.1" min="0"
                      value={lengthCm || ''} onChange={(e) => setLengthCm(Number(e.target.value))} placeholder="الطول" />
                    <Input name="width_cm" type="number" step="0.1" min="0"
                      value={widthCm || ''} onChange={(e) => setWidthCm(Number(e.target.value))} placeholder="العرض" />
                    <Input name="height_cm" type="number" step="0.1" min="0"
                      value={heightCm || ''} onChange={(e) => setHeightCm(Number(e.target.value))} placeholder="الارتفاع" />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== DIRECT SALE SECTION ===== */}
        {saleType === 'direct' && (
          <div className="space-y-2">
            <Label htmlFor="other_costs_iqd">تكاليف أخرى (د.ع)</Label>
            <Input
              id="other_costs_iqd"
              type="number"
              min="0"
              value={otherCostsIqd || ''}
              onChange={(e) => setOtherCostsIqd(Number(e.target.value))}
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">تكاليف إضافية مثل الشحن الداخلي أو التغليف</p>
          </div>
        )}

        {/* Commission - always visible */}
        <div className="space-y-2">
          <Label htmlFor="commission_iqd">العمولة (د.ع) *</Label>
          <Input
            id="commission_iqd"
            type="number"
            min="0"
            value={commissionIqd || ''}
            onChange={(e) => setCommissionIqd(Number(e.target.value))}
            placeholder="1000"
          />
          <p className="text-xs text-muted-foreground">عمولة الموقع لهذا المنتج</p>
        </div>

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
              {saleType === 'pre_order' && calculation.shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تكلفة الشحن ({shippingType === 'sea' ? 'بحري' : 'جوي'})</span>
                  <span>{formatPrice(calculation.shippingCost)}</span>
                </div>
              )}
              {saleType === 'direct' && calculation.otherCosts > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">تكاليف أخرى</span>
                  <span>{formatPrice(calculation.otherCosts)}</span>
                </div>
              )}
              {commissionIqd > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">العمولة</span>
                  <span>{formatPrice(commissionIqd)}</span>
                </div>
              )}
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
