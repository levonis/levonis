/**
 * Cost Engine - محرك حساب التكلفة الشامل
 * 
 * يحسب:
 * - سعر المنتج (USD + IQD)
 * - الشحن الداخلي من المتجر (إن وجد)
 * - الضريبة (إن وجدت)
 * - تكلفة الشحن الجوي/البحري
 * - العمولة
 * - الإجمالي
 */

import type { ShippingSettings, ShippingType, SourceCountry, ProductDimensions } from '@/hooks/useShippingCalculator';

export interface ProductSpecs {
  productName: string;
  priceUsd: number | null;
  priceOriginal: number | null;
  originalCurrency: string;
  dimensions: ProductDimensions | null;
  weight: number | null;
  internalShipping: number | null; // Shipping from store (in USD)
  tax: number | null; // Tax (in USD)
  estimated: boolean;
  source: string;
  notes: string | null;
  variant?: {
    name: string;
    value: string;
    seller?: string;
    fulfillment?: string; // FBA, FBM, etc.
  };
}

export interface CostBreakdown {
  // Product
  productPriceUsd: number;
  productPriceIqd: number;
  
  // Internal shipping (from store)
  internalShippingUsd: number;
  internalShippingIqd: number;
  
  // Tax
  taxUsd: number;
  taxIqd: number;
  
  // Subtotal before international shipping
  subtotalUsd: number;
  subtotalIqd: number;
  
  // International shipping
  shippingCost: number; // IQD
  shippingDetails: {
    actualWeight?: number;
    volumetricWeight?: number;
    usedWeight?: number;
    weightWithPackaging?: number;
    cbm?: number;
  };
  
  // Commission
  commission: number; // IQD
  
  // Totals
  totalUsd: number;
  totalIqd: number;
  
  // Meta
  isEstimated: boolean;
  estimationReason?: string;
  exchangeRate: number;
  breakdown: BreakdownItem[];
}

export interface BreakdownItem {
  labelAr: string;
  labelEn: string;
  valueIqd: number;
  valueUsd?: number;
  type: 'price' | 'shipping' | 'tax' | 'commission' | 'total' | 'info';
  isEstimated?: boolean;
}

/**
 * Calculate full cost breakdown
 */
export function calculateFullCost(
  specs: ProductSpecs,
  sourceCountry: SourceCountry,
  shippingType: ShippingType,
  settings: ShippingSettings
): CostBreakdown {
  const exchangeRate = settings.usd_to_iqd_rate;
  const breakdown: BreakdownItem[] = [];
  let isEstimated = specs.estimated;
  let estimationReason = specs.estimated ? 'بيانات تقديرية من الذكاء الاصطناعي' : undefined;
  
  // === Product Price ===
  const productPriceUsd = specs.priceUsd || 0;
  const productPriceIqd = Math.round(productPriceUsd * exchangeRate);
  
  if (productPriceUsd > 0) {
    breakdown.push({
      labelAr: 'سعر المنتج',
      labelEn: 'Product Price',
      valueIqd: productPriceIqd,
      valueUsd: productPriceUsd,
      type: 'price',
      isEstimated: specs.estimated,
    });
  }
  
  // === Internal Shipping (from store) ===
  const internalShippingUsd = specs.internalShipping || 0;
  const internalShippingIqd = Math.round(internalShippingUsd * exchangeRate);
  
  if (internalShippingUsd > 0) {
    breakdown.push({
      labelAr: 'الشحن الداخلي',
      labelEn: 'Store Shipping',
      valueIqd: internalShippingIqd,
      valueUsd: internalShippingUsd,
      type: 'shipping',
    });
  }
  
  // === Tax ===
  const taxUsd = specs.tax || 0;
  const taxIqd = Math.round(taxUsd * exchangeRate);
  
  if (taxUsd > 0) {
    breakdown.push({
      labelAr: 'الضريبة',
      labelEn: 'Tax',
      valueIqd: taxIqd,
      valueUsd: taxUsd,
      type: 'tax',
    });
  }
  
  // === Subtotal ===
  const subtotalUsd = productPriceUsd + internalShippingUsd + taxUsd;
  const subtotalIqd = productPriceIqd + internalShippingIqd + taxIqd;
  
  // === International Shipping ===
  let shippingCost = 0;
  const shippingDetails: CostBreakdown['shippingDetails'] = {};
  
  // Sea shipping only from China
  if (shippingType === 'sea' && sourceCountry === 'usa') {
    shippingType = 'air';
  }
  
  if (shippingType === 'sea') {
    // Sea shipping - CBM calculation
    if (specs.dimensions && specs.dimensions.length > 0) {
      const padding = settings.sea_padding_cm;
      const length = (specs.dimensions.length + padding) / 100;
      const width = (specs.dimensions.width + padding) / 100;
      const height = (specs.dimensions.height + padding) / 100;
      const cbm = length * width * height;
      
      shippingDetails.cbm = cbm;
      shippingCost = cbm * settings.sea_cbm_price;
      
      breakdown.push({
        labelAr: `الشحن البحري (${cbm.toFixed(3)} CBM)`,
        labelEn: `Sea Shipping (${cbm.toFixed(3)} CBM)`,
        valueIqd: Math.round(shippingCost),
        type: 'shipping',
      });
    }
  } else if (shippingType === 'air') {
    if (sourceCountry === 'usa') {
      // Air from USA - weight-based
      if (specs.weight && specs.weight > 0) {
        const bufferPercent = settings.air_usa_weight_buffer_percent / 100;
        const weightWithPackaging = specs.weight * (1 + bufferPercent);
        
        shippingDetails.actualWeight = specs.weight;
        shippingDetails.weightWithPackaging = weightWithPackaging;
        
        shippingCost = weightWithPackaging * settings.air_usa_kg_price;
        
        breakdown.push({
          labelAr: `الشحن الجوي (${weightWithPackaging.toFixed(2)} كغ)`,
          labelEn: `Air Shipping (${weightWithPackaging.toFixed(2)} kg)`,
          valueIqd: Math.round(shippingCost),
          type: 'shipping',
        });
      } else {
        isEstimated = true;
        estimationReason = 'الوزن غير متوفر - يُحسب لاحقاً';
      }
    } else if (sourceCountry === 'china') {
      // Air from China - max of volumetric or actual weight
      const padding = settings.sea_padding_cm;
      let volumetricWeight = 0;
      let actualWeight = specs.weight || 0;
      
      if (specs.dimensions && specs.dimensions.length > 0) {
        const length = specs.dimensions.length + padding;
        const width = specs.dimensions.width + padding;
        const height = specs.dimensions.height + padding;
        volumetricWeight = (length * width * height) / settings.air_china_volumetric_divider;
      }
      
      const usedWeight = Math.max(volumetricWeight, actualWeight);
      
      if (usedWeight > 0) {
        const safetyMargin = settings.air_china_weight_safety_margin / 100;
        const weightWithPackaging = usedWeight * (1 + safetyMargin);
        
        shippingDetails.actualWeight = actualWeight;
        shippingDetails.volumetricWeight = volumetricWeight;
        shippingDetails.usedWeight = usedWeight;
        shippingDetails.weightWithPackaging = weightWithPackaging;
        
        shippingCost = weightWithPackaging * settings.air_china_volumetric_price;
        
        const weightType = volumetricWeight > actualWeight ? 'حجمي' : 'فعلي';
        breakdown.push({
          labelAr: `الشحن الجوي (${weightWithPackaging.toFixed(2)} كغ ${weightType})`,
          labelEn: `Air Shipping (${weightWithPackaging.toFixed(2)} kg)`,
          valueIqd: Math.round(shippingCost),
          type: 'shipping',
        });
      } else {
        isEstimated = true;
        estimationReason = 'الوزن والأبعاد غير متوفرة - يُحسب لاحقاً';
      }
    }
  }
  
  // === Commission ===
  const commission = settings.commission_fee;
  breakdown.push({
    labelAr: 'عمولتنا',
    labelEn: 'Our Commission',
    valueIqd: commission,
    type: 'commission',
  });
  
  // === Total ===
  const totalIqd = subtotalIqd + Math.round(shippingCost) + commission;
  const totalUsd = totalIqd / exchangeRate;
  
  breakdown.push({
    labelAr: 'الإجمالي',
    labelEn: 'Total',
    valueIqd: totalIqd,
    valueUsd: totalUsd,
    type: 'total',
  });
  
  return {
    productPriceUsd,
    productPriceIqd,
    internalShippingUsd,
    internalShippingIqd,
    taxUsd,
    taxIqd,
    subtotalUsd,
    subtotalIqd,
    shippingCost: Math.round(shippingCost),
    shippingDetails,
    commission,
    totalUsd,
    totalIqd,
    isEstimated,
    estimationReason,
    exchangeRate,
    breakdown,
  };
}

/**
 * Format price for display
 */
export function formatCostDisplay(breakdown: CostBreakdown): {
  summary: string;
  details: string[];
} {
  const details: string[] = [];
  
  for (const item of breakdown.breakdown) {
    if (item.type === 'total') continue;
    
    const estimated = item.isEstimated ? ' (تقديري)' : '';
    if (item.valueUsd) {
      details.push(`${item.labelAr}: ${item.valueIqd.toLocaleString()} د.ع ($${item.valueUsd.toFixed(2)})${estimated}`);
    } else {
      details.push(`${item.labelAr}: ${item.valueIqd.toLocaleString()} د.ع${estimated}`);
    }
  }
  
  const estimatedNote = breakdown.isEstimated ? ' (تقديري)' : '';
  const summary = `الإجمالي: ${breakdown.totalIqd.toLocaleString()} د.ع${estimatedNote}`;
  
  return { summary, details };
}
