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
  commission: number;
  totalCost: number;
  notes: string[];
  breakdown: {
    label: string;
    value: number;
  }[];
}

type SourceCountry = 'china' | 'usa';
type ShippingType = 'sea' | 'air';

interface ShippingSettings {
  sea_cbm_price: number;
  sea_padding_cm: number;
  air_usa_kg_price: number;
  air_usa_weight_buffer_percent: number;
  air_china_volumetric_price: number;
  air_china_volumetric_divider: number;
  commission_fee: number;
  local_delivery_baghdad: number;
  local_delivery_provinces: number;
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
        air_usa_kg_price: 30000,
        air_usa_weight_buffer_percent: 20,
        air_china_volumetric_price: 15000,
        air_china_volumetric_divider: 5000,
        commission_fee: 1000,
        local_delivery_baghdad: 6000,
        local_delivery_provinces: 5000,
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
  const breakdown: { label: string; value: number }[] = [];
  let shippingCost = 0;
  let cbm: number | undefined;
  let volumetricWeight: number | undefined;
  let actualWeight: number | undefined;

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
      
      breakdown.push({ label: 'الأبعاد مع الهامش (متر)', value: Number((length).toFixed(3)) });
      breakdown.push({ label: 'الحجم CBM', value: Number(cbm.toFixed(4)) });
      breakdown.push({ label: 'سعر CBM الواحد', value: settings.sea_cbm_price });
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
        
        breakdown.push({ label: 'الوزن الأصلي (كغ)', value: weight });
        breakdown.push({ label: `الوزن مع التغليف (+${settings.air_usa_weight_buffer_percent}%)`, value: Number(actualWeight.toFixed(2)) });
        breakdown.push({ label: 'سعر الكيلو (جوي أمريكا)', value: settings.air_usa_kg_price });
        breakdown.push({ label: 'تكلفة الشحن الجوي', value: Math.round(shippingCost) });
      }
      notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
    } else if (sourceCountry === 'china') {
      // Air shipping from China - volumetric weight
      if (dimensions) {
        const padding = settings.sea_padding_cm;
        const length = dimensions.length + padding;
        const width = dimensions.width + padding;
        const height = dimensions.height + padding;
        volumetricWeight = (length * width * height) / settings.air_china_volumetric_divider;
        shippingCost = volumetricWeight * settings.air_china_volumetric_price;
        
        breakdown.push({ label: 'الأبعاد مع الهامش (سم)', value: `${length} x ${width} x ${height}` as any });
        breakdown.push({ label: 'المقسوم عليه', value: settings.air_china_volumetric_divider });
        breakdown.push({ label: 'الوزن الحجمي (كغ)', value: Number(volumetricWeight.toFixed(2)) });
        breakdown.push({ label: 'سعر الكيلو (جوي الصين)', value: settings.air_china_volumetric_price });
        breakdown.push({ label: 'تكلفة الشحن الجوي', value: Math.round(shippingCost) });
      }
      notes.push('تضاف تكلفة الشحن الداخلي إن وجدت لاحقاً');
    }
  }

  const commission = settings.commission_fee;
  breakdown.push({ label: 'العمولة', value: commission });
  
  const totalCost = Math.round(shippingCost) + commission;
  breakdown.push({ label: 'الإجمالي', value: totalCost });

  return {
    shippingCost: Math.round(shippingCost),
    cbm,
    volumetricWeight,
    actualWeight,
    commission,
    totalCost,
    notes,
    breakdown,
  };
};

export type { ProductDimensions, ShippingCalculation, SourceCountry, ShippingType, ShippingSettings };
