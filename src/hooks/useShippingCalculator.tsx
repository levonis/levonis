import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const SHIPPING_QUERY_KEY = ['shipping-settings'];

/**
 * Keys that depend on USD-to-IQD rate or shipping prices.
 * When admin updates shipping_settings, these need to refresh so
 * product cards, cart totals, bundles, etc. recompute instantly.
 */
const RATE_DEPENDENT_KEYS = [
  ['shipping-settings'],
  ['products'],
  ['product'],
  ['featured-products'],
  ['bundles'],
  ['home-bundles'],
  ['cart'],
  ['cod-default-settings-global'],
  ['live-direct-prices'],
];

interface ProductDimensions {
  length: number; // cm
  width: number;  // cm
  height: number; // cm
}

interface ShippingCalculation {
  shippingCost: number;
  cbm?: number;
  volumetricWeight?: number;
  actualWeight?: number;
  usedWeight?: number; // The weight used for calculation (max of volumetric/actual)
  commission: number;
  totalCost: number;
  notes: string[];
  breakdown: {
    label: string;
    value: number | string;
  }[];
}

type SourceCountry = 'china' | 'usa';
type ShippingType = 'sea' | 'air' | 'land';

interface ShippingSettings {
  sea_cbm_price: number;
  sea_padding_cm: number;
  air_china_volumetric_price: number;
  air_china_volumetric_divider: number;
  air_china_weight_safety_margin: number;
  local_delivery_baghdad: number;
  local_delivery_provinces: number;
  usd_to_iqd_rate: number;
  cny_to_usd_rate: number;
  /** USD per kg for land shipping (uses actual weight only). */
  land_price_per_kg_usd: number;
  /** 1 = use max(volumetric, actual) for air; 0 = use actual weight only. */
  air_use_volumetric_weight: number;
}

export const useShippingSettings = () => {
  const qc = useQueryClient();

  // Realtime sync: when admin updates shipping rates / USD rate / CNY rate,
  // invalidate all queries that derive prices from them so product cards,
  // cart totals, and detail pages refresh immediately.
  useEffect(() => {
    // Unique channel name per hook instance — supabase-js reuses channels by
    // name and throws "cannot add postgres_changes callbacks after subscribe()"
    // when multiple components mount the same channel name concurrently.
    let channel: ReturnType<typeof supabase.channel> | null = null;
    const invalidateRates = () => {
      RATE_DEPENDENT_KEYS.forEach((key) => {
        qc.invalidateQueries({ queryKey: key });
      });
    };
    const subscribe = () => {
      if (channel || document.hidden) return;
      channel = supabase
        .channel(`shipping-settings-sync-${Math.random().toString(36).slice(2)}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'shipping_settings' },
          invalidateRates,
        )
        .subscribe();
    };
    const unsubscribe = () => {
      if (!channel) return;
      try { supabase.removeChannel(channel); } catch {}
      channel = null;
    };
    const onVisibility = () => {
      if (document.hidden) {
        unsubscribe();
      } else {
        subscribe();
        invalidateRates();
      }
    };

    subscribe();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', unsubscribe);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', unsubscribe);
      unsubscribe();
    };
  }, [qc]);


  return useQuery({
    queryKey: SHIPPING_QUERY_KEY,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shipping_settings')
        .select('setting_key, setting_value');

      if (error) throw error;

      const settings: ShippingSettings = {
        sea_cbm_price: 350000,
        sea_padding_cm: 5,
        air_china_volumetric_price: 15000,
        air_china_volumetric_divider: 5000,
        air_china_weight_safety_margin: 20,
        local_delivery_baghdad: 6000,
        local_delivery_provinces: 5000,
        usd_to_iqd_rate: 1410,
        cny_to_usd_rate: 6.7,
        land_price_per_kg_usd: 4,
        air_use_volumetric_weight: 1,
      };

      data?.forEach((item) => {
        if (item.setting_key in settings) {
          (settings as any)[item.setting_key] = Number(item.setting_value);
        }
      });

      return settings;
    },
  });
};




export const calculateShippingCost = (
  sourceCountry: SourceCountry,
  shippingType: ShippingType,
  dimensions: ProductDimensions | null,
  weight: number | null,
  settings: ShippingSettings
): ShippingCalculation => {
  const notes: string[] = [];
  const breakdown: { label: string; value: number | string }[] = [];
  let shippingCost = 0;
  let cbm: number | undefined;
  let volumetricWeight: number | undefined;
  let actualWeight: number | undefined;
  let usedWeight: number | undefined;

  // Sea shipping is only available from China
  if (shippingType === 'sea' && sourceCountry === 'usa') {
    return {
      shippingCost: 0,
      commission: 0,
      totalCost: 0,
      notes: ['الشحن الاقتصادي متاح فقط من الصين'],
      breakdown: [],
    };
  }

  if (shippingType === 'sea') {
    // Sea shipping from China - CBM calculation
    if (dimensions) {
      const padding = settings.sea_padding_cm;
      const length = (dimensions.length + padding) / 100; // convert to meters
      const width = (dimensions.width + padding) / 100;
      const height = (dimensions.height + padding) / 100;
      cbm = length * width * height;
      shippingCost = cbm * settings.sea_cbm_price;
      
      breakdown.push({ label: 'الحجم CBM', value: cbm.toFixed(4) });
      breakdown.push({ label: 'تكلفة الشحن الاقتصادي', value: Math.round(shippingCost) });
    }
    notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
  } else if (shippingType === 'air') {
    if (sourceCountry === 'china') {
      const useVolumetric = (settings.air_use_volumetric_weight ?? 1) >= 1;
      const padding = settings.sea_padding_cm;

      // Volumetric weight only if toggle is enabled
      if (useVolumetric && dimensions && dimensions.length > 0) {
        const length = dimensions.length + padding;
        const width = dimensions.width + padding;
        const height = dimensions.height + padding;
        volumetricWeight = (length * width * height) / settings.air_china_volumetric_divider;
      }

      if (weight && weight > 0) {
        actualWeight = weight;
      }

      const volWeight = volumetricWeight || 0;
      const actWeight = actualWeight || 0;
      usedWeight = useVolumetric ? Math.max(volWeight, actWeight) : actWeight;

      if (usedWeight > 0) {
        const safetyMargin = settings.air_china_weight_safety_margin / 100;
        const weightWithSafety = usedWeight * (1 + safetyMargin);

        breakdown.push({ label: 'الوزن مع التغليف', value: `${weightWithSafety.toFixed(2)} كغ` });

        shippingCost = weightWithSafety * settings.air_china_volumetric_price;
        breakdown.push({ label: 'تكلفة الشحن السريع', value: Math.round(shippingCost) });
      }

      notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
    }
  } else if (shippingType === 'land') {
    // Land shipping: actual weight only × USD/kg × USD->IQD rate.
    if (weight && weight > 0) {
      actualWeight = weight;
      usedWeight = weight;
      const usd = weight * settings.land_price_per_kg_usd;
      shippingCost = usd * settings.usd_to_iqd_rate;
      breakdown.push({ label: 'الوزن الفعلي', value: `${weight.toFixed(2)} كغ` });
      breakdown.push({ label: 'السعر/كغ', value: `${settings.land_price_per_kg_usd}$ × ${settings.usd_to_iqd_rate.toLocaleString()}` });
      breakdown.push({ label: 'تكلفة الشحن القياسي', value: Math.round(shippingCost) });
    } else {
      notes.push('الشحن القياسي يحتاج الوزن الفعلي للقطعة');
    }
    notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
  }

  const commission = 0;
  const totalCost = Math.round(shippingCost);
  breakdown.push({ label: 'إجمالي الشحن', value: totalCost });

  return {
    shippingCost: Math.round(shippingCost),
    cbm,
    volumetricWeight,
    actualWeight,
    usedWeight,
    commission,
    totalCost,
    notes,
    breakdown,
  };
};

export type { ProductDimensions, ShippingCalculation, SourceCountry, ShippingType, ShippingSettings };
