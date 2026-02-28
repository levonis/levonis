import { useState, useEffect, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { DollarSign, Ship, Plane, Calculator, ShoppingBag, Package, ArrowUp } from 'lucide-react';
import { useShippingSettings, calculateShippingCost } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';

interface AdminProductPricingSectionProps {
  editingProduct: any;
}

const AdminProductPricingSection = ({ editingProduct }: AdminProductPricingSectionProps) => {
  const { data: shippingSettings } = useShippingSettings();
  
  // Sale types (multi-select)
  const [hasPreOrder, setHasPreOrder] = useState(false);
  const [hasDirectSale, setHasDirectSale] = useState(false);
  
  // Shipping types (multi-select for pre-order)
  const [hasSea, setHasSea] = useState(false);
  const [hasAir, setHasAir] = useState(false);

  // Common fields
  const [priceUsd, setPriceUsd] = useState<number>(0);
  const [originalPriceUsd, setOriginalPriceUsd] = useState<number>(0);

  // Dimensions & weight
  const [lengthCm, setLengthCm] = useState<number>(0);
  const [widthCm, setWidthCm] = useState<number>(0);
  const [heightCm, setHeightCm] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<string>('');

  // Commissions per type
  const [commissionSeaIqd, setCommissionSeaIqd] = useState<number>(0);
  const [commissionAirIqd, setCommissionAirIqd] = useState<number>(0);
  const [commissionDirectIqd, setCommissionDirectIqd] = useState<number>(0);

  // Direct sale
  const [otherCostsIqd, setOtherCostsIqd] = useState<number>(0);
  const [roundUp, setRoundUp] = useState<boolean>(false);

  useEffect(() => {
    if (editingProduct) {
      setPriceUsd(editingProduct.price_usd || 0);
      setOriginalPriceUsd(editingProduct.original_price_usd || 0);
      setLengthCm(editingProduct.length_cm || 0);
      setWidthCm(editingProduct.width_cm || 0);
      setHeightCm(editingProduct.height_cm || 0);
      setWeightKg(editingProduct.weight_kg ? String(editingProduct.weight_kg) : '');
      setOtherCostsIqd(editingProduct.other_costs_iqd || 0);
      setRoundUp(editingProduct.round_up_price ?? false);

      // Determine sale types
      setHasPreOrder(editingProduct.has_pre_order ?? false);
      setHasDirectSale(editingProduct.has_in_stock ?? false);
      
      // Determine shipping types
      const st = editingProduct.shipping_type;
      if (st === 'both') {
        setHasSea(true);
        setHasAir(true);
      } else if (st === 'air') {
        setHasAir(true);
        setHasSea(false);
      } else {
        setHasSea(st === 'sea' || editingProduct.has_pre_order);
        setHasAir(false);
      }

      // Commissions - support per-type or single legacy
      setCommissionSeaIqd(editingProduct.commission_sea_iqd || editingProduct.commission_iqd || 0);
      setCommissionAirIqd(editingProduct.commission_air_iqd || editingProduct.commission_iqd || 0);
      setCommissionDirectIqd(editingProduct.commission_direct_iqd || editingProduct.commission_iqd || 0);
    }
  }, [editingProduct]);

  // Derive shipping_type value for hidden input
  const shippingTypeValue = useMemo(() => {
    if (hasSea && hasAir) return 'both';
    if (hasAir) return 'air';
    if (hasSea) return 'sea';
    return '';
  }, [hasSea, hasAir]);

  // Calculations
  const roundUpToNearest = (value: number, nearest: number) => Math.ceil(value / nearest) * nearest;

  const calculations = useMemo(() => {
    if (!shippingSettings || !priceUsd) return null;
    const rate = shippingSettings.usd_to_iqd_rate;
    const priceIqd = Math.round(priceUsd * rate);
    const results: Array<{ label: string; type: string; priceIqd: number; shipping: number; commission: number; final: number; finalRounded: number; breakdown?: any[]; actualWeight?: number; volumetricWeight?: number; usedWeight?: number }> = [];

    if (hasPreOrder && hasSea) {
      const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
        ? { length: lengthCm, width: widthCm, height: heightCm } : null;
      const calc = calculateShippingCost('china', 'sea', dims, null, shippingSettings);
      const finalPrice = priceIqd + calc.shippingCost + commissionSeaIqd;
      results.push({
        label: 'حجز مسبق - بحري',
        type: 'sea',
        priceIqd,
        shipping: calc.shippingCost,
        commission: commissionSeaIqd,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
      });
    }

    if (hasPreOrder && hasAir) {
      const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
        ? { length: lengthCm, width: widthCm, height: heightCm } : null;
      const weightNum = parseFloat(weightKg) || 0;
      const calc = calculateShippingCost('china', 'air', dims, weightNum > 0 ? weightNum : null, shippingSettings);
      const finalPrice = priceIqd + calc.shippingCost + commissionAirIqd;
      results.push({
        label: 'حجز مسبق - جوي',
        type: 'air',
        priceIqd,
        shipping: calc.shippingCost,
        commission: commissionAirIqd,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
        breakdown: calc.breakdown,
        actualWeight: calc.actualWeight,
        volumetricWeight: calc.volumetricWeight,
        usedWeight: calc.usedWeight,
      });
    }

    if (hasDirectSale) {
      const finalPrice = priceIqd + otherCostsIqd + commissionDirectIqd;
      results.push({
        label: 'بيع مباشر',
        type: 'direct',
        priceIqd,
        shipping: 0,
        commission: commissionDirectIqd,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
      });
    }

    return { rate, priceIqd, results };
  }, [priceUsd, hasPreOrder, hasDirectSale, hasSea, hasAir, lengthCm, widthCm, heightCm, weightKg, commissionSeaIqd, commissionAirIqd, commissionDirectIqd, otherCostsIqd, shippingSettings]);

  return (
    <div className="space-y-4 border-t pt-4">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="has_pre_order_pricing" value={hasPreOrder ? 'true' : 'false'} />
      <input type="hidden" name="has_in_stock_pricing" value={hasDirectSale ? 'true' : 'false'} />
      <input type="hidden" name="shipping_type" value={shippingTypeValue} />
      <input type="hidden" name="commission_sea_iqd" value={commissionSeaIqd} />
      <input type="hidden" name="commission_air_iqd" value={commissionAirIqd} />
      <input type="hidden" name="commission_direct_iqd" value={commissionDirectIqd} />
      <input type="hidden" name="commission_iqd" value={Math.max(commissionSeaIqd, commissionAirIqd, commissionDirectIqd)} />
      <input type="hidden" name="other_costs_iqd" value={otherCostsIqd} />
      <input type="hidden" name="round_up_price" value={roundUp ? 'true' : 'false'} />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <DollarSign className="h-4 w-4" />
          <span>التسعير بالدولار</span>
          {shippingSettings && (
            <Badge variant="outline" className="text-xs">
              سعر الصرف: {shippingSettings.usd_to_iqd_rate.toLocaleString()} د.ع
            </Badge>
          )}
        </div>
        <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
          roundUp ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
        }`}>
          <Checkbox checked={roundUp} onCheckedChange={(checked) => setRoundUp(!!checked)} />
          <ArrowUp className="h-3.5 w-3.5" />
          <span className="text-xs font-medium">تقريب لأقرب 250</span>
        </label>
      </div>

      <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
        {/* USD Price Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="price_usd">سعر تكلفة المنتج ($) *</Label>
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
          <div className="space-y-2">
            <Label htmlFor="original_price_usd">السعر الأصلي قبل التخفيض ($)</Label>
            <Input
              id="original_price_usd"
              name="original_price_usd"
              type="number"
              step="0.01"
              min="0"
              value={originalPriceUsd || ''}
              onChange={(e) => setOriginalPriceUsd(Number(e.target.value))}
              placeholder="اختياري"
            />
          </div>
        </div>

        {/* Sale Type Checkboxes */}
        <div className="space-y-2">
          <Label>نوع البيع (يمكن اختيار أكثر من خيار)</Label>
          <div className="flex gap-4">
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
              hasPreOrder ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
            }`}>
              <Checkbox
                checked={hasPreOrder}
                onCheckedChange={(checked) => {
                  setHasPreOrder(!!checked);
                  if (checked && !hasSea && !hasAir) setHasSea(true);
                }}
              />
              <Package className="h-4 w-4" />
              <span className="text-sm font-medium">حجز مسبق</span>
            </label>
            <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
              hasDirectSale ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
            }`}>
              <Checkbox
                checked={hasDirectSale}
                onCheckedChange={(checked) => setHasDirectSale(!!checked)}
              />
              <ShoppingBag className="h-4 w-4" />
              <span className="text-sm font-medium">بيع مباشر</span>
            </label>
          </div>
        </div>

        {/* ===== PRE-ORDER SECTION ===== */}
        {hasPreOrder && (
          <div className="space-y-4 p-3 rounded-lg bg-card border border-border">
            <Label className="text-sm font-medium">إعدادات الشحن (يمكن اختيار أكثر من خيار)</Label>
            
            {/* Shipping Type Checkboxes */}
            <div className="flex gap-3">
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                hasSea ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
              }`}>
                <Checkbox
                  checked={hasSea}
                  onCheckedChange={(checked) => setHasSea(!!checked)}
                />
                <Ship className="h-4 w-4" />
                <span className="text-sm font-medium">بحري</span>
              </label>
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                hasAir ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
              }`}>
                <Checkbox
                  checked={hasAir}
                  onCheckedChange={(checked) => setHasAir(!!checked)}
                />
                <Plane className="h-4 w-4" />
                <span className="text-sm font-medium">جوي</span>
              </label>
            </div>

            {/* Sea: CBM dimensions */}
            {hasSea && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Ship className="h-3 w-3" />
                  <span>الشحن البحري - أبعاد القطعة (سم) لحساب CBM</span>
                </div>
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
                <div className="space-y-2">
                  <Label htmlFor="commission_sea_iqd">العمولة - بحري (د.ع)</Label>
                  <Input id="commission_sea_iqd" type="number" min="0"
                    value={commissionSeaIqd || ''} onChange={(e) => setCommissionSeaIqd(Number(e.target.value))} placeholder="0" />
                </div>
              </div>
            )}

            {/* Air: weight */}
            {hasAir && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Plane className="h-3 w-3" />
                  <span>الشحن الجوي</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight_kg">الوزن (كغ) *</Label>
                  <Input id="weight_kg" name="weight_kg" type="number" step="any" min="0"
                    value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="مثال: 0.5" />
                </div>
                {!hasSea && (
                  <div>
                    <Label className="text-xs text-muted-foreground">الأبعاد (اختياري - للحساب الحجمي)</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      <Input type="number" step="0.1" min="0"
                        value={lengthCm || ''} onChange={(e) => setLengthCm(Number(e.target.value))} placeholder="الطول" />
                      <Input type="number" step="0.1" min="0"
                        value={widthCm || ''} onChange={(e) => setWidthCm(Number(e.target.value))} placeholder="العرض" />
                      <Input type="number" step="0.1" min="0"
                        value={heightCm || ''} onChange={(e) => setHeightCm(Number(e.target.value))} placeholder="الارتفاع" />
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="commission_air_iqd">العمولة - جوي (د.ع)</Label>
                  <Input id="commission_air_iqd" type="number" min="0"
                    value={commissionAirIqd || ''} onChange={(e) => setCommissionAirIqd(Number(e.target.value))} placeholder="0" />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ===== DIRECT SALE SECTION ===== */}
        {hasDirectSale && (
          <div className="space-y-3 p-3 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-3 w-3" />
              <span>إعدادات البيع المباشر</span>
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="commission_direct_iqd">العمولة - بيع مباشر (د.ع)</Label>
              <Input
                id="commission_direct_iqd"
                type="number"
                min="0"
                value={commissionDirectIqd || ''}
                onChange={(e) => setCommissionDirectIqd(Number(e.target.value))}
                placeholder="0"
              />
            </div>
          </div>
        )}

        {/* Calculation Preview */}
        {calculations && priceUsd > 0 && calculations.results.length > 0 && (
          <div className="mt-4 p-3 rounded-lg bg-card border border-border space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calculator className="h-4 w-4 text-primary" />
              <span>معاينة الأسعار النهائية</span>
            </div>
            {calculations.results.map((r, i) => (
              <div key={i} className="space-y-1 text-sm border-b last:border-b-0 pb-2 last:pb-0">
                <div className="font-medium text-primary text-xs">{r.label}</div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">سعر القطعة ({priceUsd}$ × {calculations.rate.toLocaleString()})</span>
                  <span>{formatPrice(r.priceIqd)}</span>
                </div>
                {r.shipping > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تكلفة الشحن</span>
                    <span>{formatPrice(r.shipping)}</span>
                  </div>
                )}
                {r.type === 'air' && r.usedWeight && (
                  <div className="text-xs text-muted-foreground space-y-0.5 bg-muted/30 rounded p-1.5">
                    {r.actualWeight && <div>الوزن الفعلي: {r.actualWeight.toFixed(2)} كغ</div>}
                    {r.volumetricWeight && <div>الوزن الحجمي: {r.volumetricWeight.toFixed(2)} كغ</div>}
                    <div className="font-medium text-foreground">الوزن المستخدم (الأكبر + هامش أمان): {(r.usedWeight * 1.05).toFixed(2)} كغ</div>
                  </div>
                )}
                {r.type === 'direct' && otherCostsIqd > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">تكاليف أخرى</span>
                    <span>{formatPrice(otherCostsIqd)}</span>
                  </div>
                )}
                {r.commission > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">العمولة</span>
                    <span>{formatPrice(r.commission)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-primary pt-1">
                  <span>السعر النهائي</span>
                  <span className={roundUp && r.final !== r.finalRounded ? 'line-through text-muted-foreground font-normal text-xs' : ''}>
                    {formatPrice(r.final)}
                  </span>
                </div>
                {roundUp && r.final !== r.finalRounded && (
                  <div className="flex justify-between font-bold text-green-600 dark:text-green-400">
                    <span className="flex items-center gap-1">
                      <ArrowUp className="h-3 w-3" />
                      السعر بعد التقريب
                    </span>
                    <span>{formatPrice(r.finalRounded)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProductPricingSection;
