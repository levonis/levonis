import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
type ShippingType = 'sea' | 'air';

interface ShippingSettings {
  sea_cbm_price: number;
  sea_padding_cm: number;
  air_china_volumetric_price: number;
  air_china_volumetric_divider: number;
  air_china_weight_safety_margin: number;
  local_delivery_baghdad: number;
  local_delivery_provinces: number;
  usd_to_iqd_rate: number;
}

export const useShippingSettings = () => {
  return useQuery({
    queryKey: ['shipping-settings'],
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
      notes: ['الشحن البحري متاح فقط من الصين'],
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
      breakdown.push({ label: 'تكلفة الشحن البحري', value: Math.round(shippingCost) });
    }
    notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
  } else if (shippingType === 'air') {
    if (sourceCountry === 'usa') {
      // Air shipping from USA - weight-based
      if (weight) {
        const bufferPercent = settings.air_usa_weight_buffer_percent / 100;
        actualWeight = weight * (1 + bufferPercent);
        shippingCost = actualWeight * settings.air_usa_kg_price;
        
        // Only show final weight with packaging
        breakdown.push({ label: 'الوزن مع التغليف', value: `${actualWeight.toFixed(2)} كغ` });
        breakdown.push({ label: 'تكلفة الشحن الجوي', value: Math.round(shippingCost) });
      }
      notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
    } else if (sourceCountry === 'china') {
      // Air shipping from China - use the GREATER of volumetric weight or actual weight
      const padding = settings.sea_padding_cm;
      
      // Calculate volumetric weight if dimensions provided
      if (dimensions && dimensions.length > 0) {
        const length = dimensions.length + padding;
        const width = dimensions.width + padding;
        const height = dimensions.height + padding;
        volumetricWeight = (length * width * height) / settings.air_china_volumetric_divider;
      }
      
      // Actual weight
      if (weight && weight > 0) {
        actualWeight = weight;
      }
      
      // Use the greater weight
      const volWeight = volumetricWeight || 0;
      const actWeight = actualWeight || 0;
      
      if (volWeight > 0 || actWeight > 0) {
        usedWeight = Math.max(volWeight, actWeight);
        
        // Add safety margin
        const safetyMargin = settings.air_china_weight_safety_margin / 100;
        const weightWithSafety = usedWeight * (1 + safetyMargin);
        
        // Only show final weight with packaging (which includes safety margin)
        breakdown.push({ label: 'الوزن مع التغليف', value: `${weightWithSafety.toFixed(2)} كغ` });
        
        shippingCost = weightWithSafety * settings.air_china_volumetric_price;
        breakdown.push({ label: 'تكلفة الشحن الجوي', value: Math.round(shippingCost) });
      }
      
      notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
    }
  }

  // Commission is separate - show it as "عمولتنا"
  const commission = settings.commission_fee;
  breakdown.push({ label: 'عمولتنا', value: commission });
  
  // Total = shipping cost + commission (but we keep them separate for display)
  const totalCost = Math.round(shippingCost) + commission;
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
