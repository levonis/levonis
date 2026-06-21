import { useState, useEffect, useMemo, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { DollarSign, Ship, Plane, Calculator, ShoppingBag, Package, ArrowUp, Truck, Lock, MapPin } from 'lucide-react';
import { useShippingSettings, calculateShippingCost } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface AdminProductPricingSectionProps {
  editingProduct: any;
  categoryId?: string;
}

const AdminProductPricingSection = ({ editingProduct, categoryId }: AdminProductPricingSectionProps) => {
  const { isAdmin } = useAuth();
  const { data: shippingSettings } = useShippingSettings();



  // Fetch delivery methods to determine which categories support personal delivery
  const { data: personalDeliveryCategoryIds = [] } = useQuery({
    queryKey: ['personal-delivery-categories'],
    queryFn: async () => {
      const { data } = await supabase
        .from('delivery_methods')
        .select('base_price_category_id')
        .not('base_price_category_id', 'is', null);
      return (data || []).map((d: any) => d.base_price_category_id).filter(Boolean);
    },
  });

  const isPrinterCategory = categoryId ? personalDeliveryCategoryIds.includes(categoryId) : false;

  // Global COD default settings (used when linking direct commission to COD %)
  const { data: codDefaults } = useQuery({
    queryKey: ['cod-default-settings-product-form'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'partial_payment_settings')
        .single();
      const v: any = data?.setting_value || {};
      const tiers = Array.isArray(v.fee_tiers)
        ? v.fee_tiers.map((t: any) => ({
            min_amount: Number(t.min_amount) || 0,
            max_amount: Number(t.max_amount) || 0,
            cod_fee_type: (t.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed',
            cod_fee_value: Number(t.cod_fee_value ?? 0) || 0,
          }))
        : undefined;
      return {
        type: (v.cod_default_fee_type || 'percentage') as 'percentage' | 'fixed',
        value: Number(v.cod_default_fee_value) || 0,
        tiers,
      };
    },
  });

  // Sale types (multi-select)
  const [hasPreOrder, setHasPreOrder] = useState(false);
  const [hasDirectSale, setHasDirectSale] = useState(false);
  
  // Shipping types (multi-select for pre-order)
  const [hasSea, setHasSea] = useState(false);
  const [hasAir, setHasAir] = useState(false);
  const [hasLand, setHasLand] = useState(false);

  // Common fields
  const [priceUsd, setPriceUsd] = useState<number>(0);
  const [originalPriceIqd, setOriginalPriceIqd] = useState<number>(0);

  // Dimensions & weight
  const [lengthCm, setLengthCm] = useState<number>(0);
  const [widthCm, setWidthCm] = useState<number>(0);
  const [heightCm, setHeightCm] = useState<number>(0);
  const [weightKg, setWeightKg] = useState<string>('');

  // Commissions per type
  const [commissionSeaIqd, setCommissionSeaIqd] = useState<number>(0);
  const [commissionAirIqd, setCommissionAirIqd] = useState<number>(0);
  const [commissionLandIqd, setCommissionLandIqd] = useState<number>(0);
  const [commissionDirectIqd, setCommissionDirectIqd] = useState<number>(0);

  // Direct sale
  const [personalDeliveryCost, setPersonalDeliveryCost] = useState<number>(0);
  const [referralEarningsIqd, setReferralEarningsIqd] = useState<number>(0);
  const [roundUp, setRoundUp] = useState<boolean>(true);
  const [linkDirectCommissionToCod, setLinkDirectCommissionToCod] = useState<boolean>(false);

  // Cash on Delivery (Pre-order only) — toggle only; fee comes from global settings
  const [codEnabled, setCodEnabled] = useState<boolean>(false);
  
  // CNY converter (only for cost price in USD)
  const [showCnyInput, setShowCnyInput] = useState(false);
  const [cnyValue, setCnyValue] = useState<string>('');

  const cnyToUsdRate = shippingSettings?.cny_to_usd_rate || 6.7;

  const handleCnyConvert = () => {
    const val = Number(cnyValue);
    if (!val || val <= 0) return;
    const usdVal = Math.round((val / cnyToUsdRate) * 100) / 100;
    setPriceUsd(usdVal);
    setCnyValue('');
    setShowCnyInput(false);
  };

  // Ref set when autofill event arrives, so we don't clobber freshly-extracted
  // dimensions/weight if the editingProduct init effect re-runs.
  const extractedRef = useRef<boolean>(false);

  useEffect(() => {
    // Reset extraction flag whenever a different product is opened/closed.
    extractedRef.current = false;
    if (editingProduct) {
      setPriceUsd(Number(editingProduct.price_usd) || 0);
      // Original price is now stored/edited directly in IQD.
      if (editingProduct.original_price && Number(editingProduct.original_price) > 0) {
        setOriginalPriceIqd(Number(editingProduct.original_price));
      } else {
        setOriginalPriceIqd(0);
      }
      setLengthCm(Number(editingProduct.length_cm) || 0);
      setWidthCm(Number(editingProduct.width_cm) || 0);
      setHeightCm(Number(editingProduct.height_cm) || 0);
      setWeightKg(editingProduct.weight_kg ? String(editingProduct.weight_kg) : '');
      // other_costs_iqd is deprecated for direct sale — kept at 0
      setPersonalDeliveryCost(Number(editingProduct.personal_delivery_cost) || 0);
      setReferralEarningsIqd(Number(editingProduct.referral_earnings_iqd) || 0);
      setRoundUp(editingProduct.round_up_price ?? true);

      // Determine sale types
      setHasPreOrder(editingProduct.has_pre_order ?? false);
      setHasDirectSale(editingProduct.has_in_stock ?? false);

      // Determine shipping types (supports legacy 'sea'/'air'/'both' and new comma list)
      const st: string = editingProduct.shipping_type || '';
      const tokens = st === 'both' ? ['sea', 'air'] : st.split(',').map((x: string) => x.trim());
      setHasSea(tokens.includes('sea'));
      setHasAir(tokens.includes('air'));
      setHasLand(tokens.includes('land'));
      // Backward compat: if a legacy product had no shipping_type but does have pre-order, default to sea
      if (!st && editingProduct.has_pre_order) {
        setHasSea(true);
      }

      // Commissions - support per-type or single legacy
      // Coerce to Number — Supabase returns numeric columns as strings, which would
      // cause string concatenation in price calculations instead of arithmetic addition.
      setCommissionSeaIqd(Number(editingProduct.commission_sea_iqd ?? editingProduct.commission_iqd) || 0);
      setCommissionAirIqd(Number(editingProduct.commission_air_iqd ?? editingProduct.commission_iqd) || 0);
      setCommissionLandIqd(Number(editingProduct.commission_land_iqd) || 0);
      setCommissionDirectIqd(Number(editingProduct.commission_direct_iqd ?? editingProduct.commission_iqd) || 0);

      // COD settings (toggle only)
      setCodEnabled(!!editingProduct.cod_enabled);

      // Persisted "link direct commission to COD %" toggle
      setLinkDirectCommissionToCod(!!editingProduct.link_direct_commission_to_cod);
    } else {
      setPriceUsd(0);
      setOriginalPriceIqd(0);
      setLengthCm(0);
      setWidthCm(0);
      setHeightCm(0);
      setWeightKg('');
      setCommissionSeaIqd(0);
      setCommissionAirIqd(0);
      setCommissionLandIqd(0);
      setCommissionDirectIqd(0);
      setPersonalDeliveryCost(0);
      setReferralEarningsIqd(0);
      setHasPreOrder(false);
      setHasDirectSale(false);
      setHasSea(false);
      setHasAir(false);
      setHasLand(false);
      setCodEnabled(false);
      setLinkDirectCommissionToCod(false);
      setRoundUp(true);
    }
    // Only depend on editingProduct — must NOT re-run when shippingSettings load,
    // otherwise freshly-extracted dimensions/weight get wiped back to 0.
  }, [editingProduct]);

  // Keep a ref to the latest USD->IQD rate so the autofill listener (registered once) can read it.
  const usdRateRef = useRef<number>(0);
  useEffect(() => {
    usdRateRef.current = shippingSettings?.usd_to_iqd_rate || 0;
    // Legacy backfill: convert old USD original price → IQD once the rate is known,
    // but only when the IQD value isn't already set on the row.
    if (
      editingProduct &&
      usdRateRef.current > 0 &&
      (!editingProduct.original_price || editingProduct.original_price <= 0) &&
      editingProduct.original_price_usd &&
      editingProduct.original_price_usd > 0
    ) {
      setOriginalPriceIqd((curr) =>
        curr > 0 ? curr : Math.round(Number(editingProduct.original_price_usd) * usdRateRef.current),
      );
    }
    // If we had a pending USD original price waiting for the rate, apply it now.
    if (usdRateRef.current > 0 && pendingOriginalPriceUsdRef.current && pendingOriginalPriceUsdRef.current > 0) {
      setOriginalPriceIqd(Math.round(pendingOriginalPriceUsdRef.current * usdRateRef.current));
      pendingOriginalPriceUsdRef.current = 0;
    }
  }, [shippingSettings?.usd_to_iqd_rate, editingProduct]);

  const pendingOriginalPriceUsdRef = useRef<number>(0);

  useEffect(() => {
    const handleAutofill = (event: Event) => {
      const detail = (event as CustomEvent<{
        originalPriceUsd?: number;
        originalPriceIqd?: number;
        priceUsd?: number;
        length_cm?: number;
        width_cm?: number;
        height_cm?: number;
        weight_kg?: number;
      }>).detail;
      const rate = usdRateRef.current;
      if (detail?.originalPriceIqd && detail.originalPriceIqd > 0) {
        setOriginalPriceIqd(Math.round(detail.originalPriceIqd));
      } else if (detail?.originalPriceUsd && detail.originalPriceUsd > 0) {
        if (rate > 0) {
          setOriginalPriceIqd(Math.round(detail.originalPriceUsd * rate));
        } else {
          // Rate not loaded yet — stash for later conversion.
          pendingOriginalPriceUsdRef.current = detail.originalPriceUsd;
        }
      }
      if (detail?.priceUsd && detail.priceUsd > 0) {
        setPriceUsd(detail.priceUsd);
      }
      // Packaging dimensions / gross weight from extraction
      const hasAnyDim =
        (typeof detail?.length_cm === 'number' && detail.length_cm > 0) ||
        (typeof detail?.width_cm === 'number' && detail.width_cm > 0) ||
        (typeof detail?.height_cm === 'number' && detail.height_cm > 0);
      const hasWeight = typeof detail?.weight_kg === 'number' && detail.weight_kg > 0;
      if (typeof detail?.length_cm === 'number' && detail.length_cm > 0) setLengthCm(detail.length_cm);
      if (typeof detail?.width_cm === 'number' && detail.width_cm > 0) setWidthCm(detail.width_cm);
      if (typeof detail?.height_cm === 'number' && detail.height_cm > 0) setHeightCm(detail.height_cm);
      if (hasWeight) setWeightKg(String(detail!.weight_kg));
      // Auto-enable Sea/Air toggles so the extracted values become visible & editable
      if (hasAnyDim) setHasSea((prev) => prev || true);
      if (hasWeight) setHasAir((prev) => prev || true);
      // Mark that extraction populated these fields, so the editingProduct init
      // effect won't blank them out on subsequent re-runs.
      if (hasAnyDim || hasWeight) extractedRef.current = true;
    };

    window.addEventListener('admin-product-pricing-autofill', handleAutofill);
    return () => window.removeEventListener('admin-product-pricing-autofill', handleAutofill);
  }, []);


  // Derive shipping_type value for hidden input (comma-separated tokens)
  const shippingTypeValue = useMemo(() => {
    const t: string[] = [];
    if (hasSea) t.push('sea');
    if (hasAir) t.push('air');
    if (hasLand) t.push('land');
    return t.join(',');
  }, [hasSea, hasAir, hasLand]);

  // Calculations
  const roundUpToNearest = (value: number, nearest: number) => Math.ceil(value / nearest) * nearest;

  const effectivePersonalDeliveryCost = isPrinterCategory ? personalDeliveryCost : 0;

  // Effective direct-sale commission: 
  // = pre-order sea commission + direct sale commission entered
  // If COD link toggle is on, the "direct" portion is computed from global COD settings
  // applied to the pre-order final price (sea preferred, else air)
  // Direct portion only (the user-entered or COD-derived part — without sea commission)
  const directCommissionPortion = useMemo(() => {
    if (linkDirectCommissionToCod && codDefaults && shippingSettings && priceUsd) {
      const priceIqd = Math.round(priceUsd * shippingSettings.usd_to_iqd_rate);
      const pdc = effectivePersonalDeliveryCost;
      let preorderFinal = priceIqd + pdc + referralEarningsIqd;
      if (hasPreOrder && hasSea) {
        const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
          ? { length: lengthCm, width: widthCm, height: heightCm } : null;
        const calc = calculateShippingCost('china', 'sea', dims, null, shippingSettings);
        preorderFinal = priceIqd + calc.shippingCost + commissionSeaIqd + pdc + referralEarningsIqd;
      } else if (hasPreOrder && hasAir) {
        const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
          ? { length: lengthCm, width: widthCm, height: heightCm } : null;
        const weightNum = parseFloat(weightKg) || 0;
        const calc = calculateShippingCost('china', 'air', dims, weightNum > 0 ? weightNum : null, shippingSettings);
        preorderFinal = priceIqd + calc.shippingCost + commissionAirIqd + pdc + referralEarningsIqd;
      } else if (hasPreOrder && hasLand) {
        const weightNum = parseFloat(weightKg) || 0;
        const calc = calculateShippingCost('china', 'land', null, weightNum > 0 ? weightNum : null, shippingSettings);
        preorderFinal = priceIqd + calc.shippingCost + commissionLandIqd + pdc + referralEarningsIqd;
      }

      // Pick matching tier; fall back to legacy default
      let codType: 'percentage' | 'fixed' = codDefaults.type;
      let codValue = codDefaults.value;
      const tiers = (codDefaults as any).tiers;
      if (Array.isArray(tiers) && tiers.length > 0) {
        const tier = tiers.find(
          (t: any) =>
            preorderFinal >= Number(t.min_amount || 0) &&
            preorderFinal <= Number(t.max_amount || 0)
        );
        if (tier && tier.cod_fee_value != null) {
          codType = (tier.cod_fee_type ?? 'percentage') as 'percentage' | 'fixed';
          codValue = Number(tier.cod_fee_value) || 0;
        }
      }

      if (codType === 'fixed') return Math.ceil(codValue);
      return Math.ceil(preorderFinal * codValue / 100);
    }
    return commissionDirectIqd;
  }, [linkDirectCommissionToCod, codDefaults, commissionDirectIqd, shippingSettings, priceUsd, hasPreOrder, hasSea, hasAir, hasLand, lengthCm, widthCm, heightCm, weightKg, commissionSeaIqd, commissionAirIqd, commissionLandIqd, effectivePersonalDeliveryCost, referralEarningsIqd]);

  // Effective commission for direct sale display/calc = pre-order sea commission + direct portion
  const effectiveCommissionDirect = useMemo(
    () => (hasPreOrder && hasSea ? commissionSeaIqd : 0) + directCommissionPortion,
    [hasPreOrder, hasSea, commissionSeaIqd, directCommissionPortion]
  );



  const calculations = useMemo(() => {
    if (!shippingSettings || !priceUsd) return null;
    // Defensive: coerce every numeric input — Supabase numeric columns arrive as strings,
    // and `+` would concatenate instead of add, producing absurd 20+ digit totals.
    const N = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const rate = N(shippingSettings.usd_to_iqd_rate);
    const priceIqd = Math.round(N(priceUsd) * rate);
    const pdc = N(effectivePersonalDeliveryCost);
    const refEarn = N(referralEarningsIqd);
    const commSea = N(commissionSeaIqd);
    const commAir = N(commissionAirIqd);
    const commLand = N(commissionLandIqd);
    const commDirect = N(effectiveCommissionDirect);
    const results: Array<{ label: string; type: string; priceIqd: number; shipping: number; commission: number; final: number; finalRounded: number; breakdown?: any[]; actualWeight?: number; volumetricWeight?: number; usedWeight?: number; personalDelivery?: number }> = [];

    if (hasPreOrder && hasSea) {
      const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
        ? { length: lengthCm, width: widthCm, height: heightCm } : null;
      const calc = calculateShippingCost('china', 'sea', dims, null, shippingSettings);
      const finalPrice = priceIqd + N(calc.shippingCost) + commSea + pdc + refEarn;
      results.push({
        label: 'حجز مسبق - بحري',
        type: 'sea',
        priceIqd,
        shipping: N(calc.shippingCost),
        commission: commSea,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
        personalDelivery: pdc,
      });
    }

    if (hasPreOrder && hasAir) {
      const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
        ? { length: lengthCm, width: widthCm, height: heightCm } : null;
      const weightNum = parseFloat(weightKg) || 0;
      const calc = calculateShippingCost('china', 'air', dims, weightNum > 0 ? weightNum : null, shippingSettings);
      const finalPrice = priceIqd + N(calc.shippingCost) + commAir + pdc + refEarn;
      results.push({
        label: 'حجز مسبق - جوي',
        type: 'air',
        priceIqd,
        shipping: N(calc.shippingCost),
        commission: commAir,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
        breakdown: calc.breakdown,
        actualWeight: calc.actualWeight,
        volumetricWeight: calc.volumetricWeight,
        usedWeight: calc.usedWeight,
        personalDelivery: pdc,
      });
    }

    if (hasPreOrder && hasLand) {
      const weightNum = parseFloat(weightKg) || 0;
      const calc = calculateShippingCost('china', 'land', null, weightNum > 0 ? weightNum : null, shippingSettings);
      const finalPrice = priceIqd + N(calc.shippingCost) + commLand + pdc + refEarn;
      results.push({
        label: 'حجز مسبق - بري',
        type: 'land',
        priceIqd,
        shipping: N(calc.shippingCost),
        commission: commLand,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
        breakdown: calc.breakdown,
        actualWeight: calc.actualWeight,
        usedWeight: calc.usedWeight,
        personalDelivery: pdc,
      });
    }

    if (hasDirectSale) {
      // Use the same shipping cost as pre-order (sea preferred, else air, else land)
      let directShipping = 0;
      if (hasPreOrder) {
        const dims = (lengthCm > 0 || widthCm > 0 || heightCm > 0)
          ? { length: lengthCm, width: widthCm, height: heightCm } : null;
        if (hasSea) {
          directShipping = calculateShippingCost('china', 'sea', dims, null, shippingSettings).shippingCost;
        } else if (hasAir) {
          const weightNum = parseFloat(weightKg) || 0;
          directShipping = calculateShippingCost('china', 'air', dims, weightNum > 0 ? weightNum : null, shippingSettings).shippingCost;
        } else if (hasLand) {
          const weightNum = parseFloat(weightKg) || 0;
          directShipping = calculateShippingCost('china', 'land', null, weightNum > 0 ? weightNum : null, shippingSettings).shippingCost;
        }
      }
      const finalPrice = priceIqd + directShipping + effectiveCommissionDirect + pdc + referralEarningsIqd;
      results.push({
        label: 'بيع مباشر',
        type: 'direct',
        priceIqd,
        shipping: directShipping,
        commission: effectiveCommissionDirect,
        final: finalPrice,
        finalRounded: roundUpToNearest(finalPrice, 250),
        personalDelivery: pdc,
      });
    }

    return { rate, priceIqd, results };
  }, [priceUsd, hasPreOrder, hasDirectSale, hasSea, hasAir, hasLand, lengthCm, widthCm, heightCm, weightKg, commissionSeaIqd, commissionAirIqd, commissionLandIqd, effectiveCommissionDirect, effectivePersonalDeliveryCost, referralEarningsIqd, shippingSettings]);


  return (
    <div className="space-y-4 border-t pt-4">
      {/* Hidden inputs for form submission */}
      <input type="hidden" name="has_pre_order_pricing" value={hasPreOrder ? 'true' : 'false'} />
      <input type="hidden" name="has_in_stock_pricing" value={hasDirectSale ? 'true' : 'false'} />
      <input type="hidden" name="shipping_type" value={shippingTypeValue} />
      <input type="hidden" name="commission_sea_iqd" value={commissionSeaIqd} />
      <input type="hidden" name="commission_air_iqd" value={commissionAirIqd} />
      <input type="hidden" name="commission_land_iqd" value={commissionLandIqd} />
      <input type="hidden" name="commission_direct_iqd" value={directCommissionPortion} />
      <input type="hidden" name="commission_iqd" value={Math.max(commissionSeaIqd, commissionAirIqd, directCommissionPortion)} />
      <input type="hidden" name="other_costs_iqd" value={0} />
      <input type="hidden" name="round_up_price" value={roundUp ? 'true' : 'false'} />
      <input type="hidden" name="personal_delivery_cost" value={personalDeliveryCost} />
      <input type="hidden" name="referral_earnings_iqd" value={referralEarningsIqd} />
      <input type="hidden" name="cod_enabled" value={codEnabled ? 'true' : 'false'} />
      <input type="hidden" name="link_direct_commission_to_cod" value={linkDirectCommissionToCod ? 'true' : 'false'} />
      <input type="hidden" name="price_usd" value={priceUsd || ''} />
      <input type="hidden" name="original_price_iqd" value={originalPriceIqd || ''} />
      <input type="hidden" name="length_cm" value={lengthCm || ''} />
      <input type="hidden" name="width_cm" value={widthCm || ''} />
      <input type="hidden" name="height_cm" value={heightCm || ''} />
      <input type="hidden" name="weight_kg" value={weightKg || ''} />

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
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={roundUp} onCheckedChange={(checked) => setRoundUp(!!checked)} className="data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
          <span className="text-xs font-medium">تقريب لأقرب 250</span>
        </label>
      </div>

      <div className="p-4 border border-primary/20 rounded-lg bg-primary/5 space-y-4">
        {/* USD Price Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="price_usd">سعر تكلفة المنتج ($) *</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                onClick={() => setShowCnyInput(!showCnyInput)}
              >
                <span className="font-bold">¥</span>
                {showCnyInput ? 'إخفاء' : 'تحويل من يوان'}
              </Button>
            </div>
            {showCnyInput && (
              <div className="flex gap-1.5 items-center p-2 rounded-md bg-amber-50 border border-amber-200">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cnyValue}
                  onChange={(e) => setCnyValue(e.target.value)}
                  placeholder="المبلغ بالـ ¥"
                  className="h-8 text-sm"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCnyConvert(); } }}
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-8 px-3 text-xs shrink-0"
                  onClick={() => handleCnyConvert()}
                  disabled={!cnyValue || Number(cnyValue) <= 0}
                >
                  تحويل
                </Button>
                {cnyValue && Number(cnyValue) > 0 && (
                  <span className="text-[10px] text-muted-foreground shrink-0 whitespace-nowrap">
                    = {(Number(cnyValue) / cnyToUsdRate).toFixed(2)}$
                  </span>
                )}
              </div>
            )}
            <Input
              id="price_usd"
              type="number"
              step="0.01"
              min="0"
              value={priceUsd || ''}
              onChange={(e) => setPriceUsd(Number(e.target.value))}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="original_price_iqd">السعر الأصلي (د.ع)</Label>
            <Input
              id="original_price_iqd"
              type="number"
              step="250"
              min="0"
              value={originalPriceIqd || ''}
              onChange={(e) => setOriginalPriceIqd(Number(e.target.value))}
              placeholder="اختياري — يظهر للمستخدم كسعر قبل التخفيض"
            />
            {originalPriceIqd > 0 && (
              <p className="text-[10px] text-muted-foreground">
                سيظهر للمستخدم: {Math.round(originalPriceIqd).toLocaleString()} د.ع
              </p>
            )}
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
              <label className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                hasLand ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:border-primary/50'
              }`}>
                <Checkbox
                  checked={hasLand}
                  onCheckedChange={(checked) => setHasLand(!!checked)}
                />
                <MapPin className="h-4 w-4" />
                <span className="text-sm font-medium">بري</span>
              </label>
            </div>

            {/* Dynamic hint: behavior of pre_order_shipping_options based on selection */}
            {hasPreOrder && (() => {
              const activeCount = (hasSea ? 1 : 0) + (hasAir ? 1 : 0) + (hasLand ? 1 : 0);
              if (activeCount === 0) {
                return (
                  <p className="text-[11px] text-muted-foreground bg-muted/40 border border-border rounded-md px-2 py-1.5">
                    اختر طريقة شحن واحدة على الأقل للحجز المسبق.
                  </p>
                );
              }
              if (activeCount === 1) {
                return (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md px-2 py-1.5">
                    خيار شحن واحد فقط — لن يتم إنشاء قائمة خيارات شحن للحجز المسبق (سيُحفظ بدون <code>pre_order_shipping_options</code>).
                  </p>
                );
              }
              return (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-md px-2 py-1.5">
                  {activeCount} طرق شحن مفعّلة — سيتم إنشاء <code>pre_order_shipping_options</code> تلقائياً مع حساب الفروقات.
                </p>
              );
            })()}

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
                    <Input id="length_cm" type="number" step="0.1" min="0"
                      value={lengthCm || ''} onChange={(e) => setLengthCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                  <div>
                    <Label htmlFor="width_cm" className="text-xs">العرض</Label>
                    <Input id="width_cm" type="number" step="0.1" min="0"
                      value={widthCm || ''} onChange={(e) => setWidthCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                  <div>
                    <Label htmlFor="height_cm" className="text-xs">الارتفاع</Label>
                    <Input id="height_cm" type="number" step="0.1" min="0"
                      value={heightCm || ''} onChange={(e) => setHeightCm(Number(e.target.value))} placeholder="سم" />
                  </div>
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="commission_sea_iqd">العمولة - بحري (د.ع)</Label>
                    <Input id="commission_sea_iqd" type="number" min="0"
                      value={commissionSeaIqd || ''} onChange={(e) => setCommissionSeaIqd(Number(e.target.value))} placeholder="0" />
                  </div>
                )}
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
                  <Input id="weight_kg" type="number" step="any" min="0"
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
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="commission_air_iqd">العمولة - جوي (د.ع)</Label>
                    <Input id="commission_air_iqd" type="number" min="0"
                      value={commissionAirIqd || ''} onChange={(e) => setCommissionAirIqd(Number(e.target.value))} placeholder="0" />
                  </div>
                )}
              </div>
            )}

            {/* Land: actual weight only */}
            {hasLand && (
              <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MapPin className="h-3 w-3" />
                  <span>الشحن البري — يعتمد على الوزن الفعلي فقط</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weight_kg_land">الوزن (كغ) *</Label>
                  <Input
                    id="weight_kg_land"
                    type="number"
                    step="any"
                    min="0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="مثال: 1.5"
                  />
                  {shippingSettings && (
                    <p className="text-[10px] text-muted-foreground">
                      السعر: {shippingSettings.land_price_per_kg_usd}$ لكل كغ — بدون وزن حجمي
                    </p>
                  )}
                </div>
                {isAdmin && (
                  <div className="space-y-2">
                    <Label htmlFor="commission_land_iqd">العمولة - بري (د.ع)</Label>
                    <Input
                      id="commission_land_iqd"
                      type="number"
                      min="0"
                      value={commissionLandIqd || ''}
                      onChange={(e) => setCommissionLandIqd(Number(e.target.value))}
                      placeholder="0"
                    />
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* ===== DELIVERY COST (printers only) — admin only ===== */}
        {isAdmin && isPrinterCategory && (hasPreOrder || hasDirectSale) && (
          <div className="space-y-2 p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <Label htmlFor="personal_delivery_cost" className="flex items-center gap-1.5">
              <Truck className="h-3 w-3 text-emerald-500" />
              تكلفة التوصيل الشخصي (د.ع)
            </Label>
            <Input
              id="personal_delivery_cost"
              type="number"
              min="0"
              value={personalDeliveryCost || ''}
              onChange={(e) => setPersonalDeliveryCost(Number(e.target.value))}
              placeholder="مثال: 38000"
            />
            <p className="text-xs text-muted-foreground">خاص بالطابعات — يُضاف للسعر النهائي ويُخصم من العائد في القسم المالي</p>
          </div>
        )}

        {/* ===== VIP+ REFERRAL EARNINGS — admin only ===== */}
        {isAdmin && (
        <div className="space-y-2 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
          <Label htmlFor="referral_earnings_iqd" className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-amber-500" />
            ربح صاحب بطاقة VIP Plus من كوبون الإحالة (د.ع لكل وحدة)
          </Label>
          <Input
            id="referral_earnings_iqd"
            type="number"
            min="0"
            value={referralEarningsIqd || ''}
            onChange={(e) => setReferralEarningsIqd(Number(e.target.value))}
            placeholder="مثال: 250"
          />
          <p className="text-xs text-muted-foreground">عند استخدام كود إحالة على هذا المنتج، يحصل صاحب الكود على هذا المبلغ × الكمية. يُخصم من العائد المالي.</p>
        </div>
        )}

        {/* ===== DIRECT SALE SECTION — admin only ===== */}
        {isAdmin && hasDirectSale && (
          <div className="space-y-3 p-3 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ShoppingBag className="h-3 w-3" />
              <span>إعدادات البيع المباشر</span>
            </div>

            <label className="flex items-start gap-2 cursor-pointer p-2 rounded-md bg-muted/30 border border-border">
              <Checkbox
                checked={linkDirectCommissionToCod}
                onCheckedChange={(checked) => setLinkDirectCommissionToCod(!!checked)}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-primary" />
                  ربط العمولة بنسبة الدفع عند الاستلام
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {codDefaults && Array.isArray((codDefaults as any).tiers) && (codDefaults as any).tiers.length > 0
                    ? 'يتم احتساب العمولة تلقائياً حسب شرائح الدفع عند الاستلام (بناءً على قيمة الطلب).'
                    : codDefaults
                      ? `يتم احتساب العمولة تلقائياً حسب الإعداد العام (${codDefaults.type === 'percentage' ? `${codDefaults.value}%` : `${codDefaults.value.toLocaleString()} د.ع`}).`
                      : 'سيتم احتساب العمولة تلقائياً حسب إعدادات الدفع عند الاستلام.'}
                </p>
                {linkDirectCommissionToCod && priceUsd > 0 && shippingSettings && (
                  <div className="text-xs mt-1 text-primary font-medium">
                    العمولة المحسوبة: {formatPrice(effectiveCommissionDirect)}
                  </div>
                )}
              </div>
            </label>

            <div className="space-y-2">
              <Label htmlFor="commission_direct_iqd">العمولة - بيع مباشر (د.ع)</Label>
              <Input
                id="commission_direct_iqd"
                type="number"
                min="0"
                value={linkDirectCommissionToCod ? effectiveCommissionDirect : (commissionDirectIqd || '')}
                onChange={(e) => setCommissionDirectIqd(Number(e.target.value))}
                placeholder="0"
                disabled={linkDirectCommissionToCod}
              />
              <p className="text-xs text-muted-foreground">
                تشمل تكاليف الشحن الداخلي والتغليف وأي تكاليف أخرى — هذه القيمة هي الوحيدة المستخدمة لحساب البيع المباشر.
              </p>
            </div>

            {/* COD toggle — only available when Direct Sale is enabled */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={codEnabled}
                  onCheckedChange={(checked) => setCodEnabled(!!checked)}
                />
                <Truck className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">تفعيل الدفع عند الاستلام لهذا المنتج</span>
              </label>
              <p className="text-xs text-muted-foreground pr-6">
                النسبة/القيمة تُؤخذ تلقائياً من إعدادات الدفع عند الاستلام الافتراضية في صفحة إعدادات الدفع الجزئي.
              </p>
            </div>
          </div>
        )}

        {/* Calculation Preview — admin only (shows commissions/profit) */}
        {isAdmin && calculations && priceUsd > 0 && calculations.results.length > 0 && (
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
                {/* تكاليف أخرى مدمجة الآن في العمولة */}
                {(r.personalDelivery || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span className="flex items-center gap-1"><Truck className="h-3 w-3" /> تكلفة التوصيل</span>
                    <span>{formatPrice(r.personalDelivery!)}</span>
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
