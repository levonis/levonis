/**
 * Cost Engine - محرك حساب التكلفة الشامل
 * 
 * يحسب:
 * - سعر المنتج (USD + IQD)
 * - الشحن الداخلي من المتجر (إن وجد) - Actual/Estimated
 * - الضريبة (إن وجدت) - Actual/Estimated
 * - تكلفة الشحن الجوي/البحري
 * - العمولة
 * - الإجمالي
 * 
 * مع تمييز واضح بين القيم الفعلية والتقديرية
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
  internalShippingEstimated: boolean;
  
  // Tax
  taxUsd: number;
  taxIqd: number;
  taxEstimated: boolean;
  
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
    bufferPercent?: number;
  };
  
  // Commission
  commission: number; // IQD
  
  // Totals
  totalUsd: number;
  totalIqd: number;
  
  // Meta
  isEstimated: boolean;
  estimationReasons: string[];
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
  estimationReason?: string;
}

/**
 * Calculate full cost breakdown with Actual/Estimated distinction
 */
export function calculateFullCost(
  specs: ProductSpecs,
  sourceCountry: SourceCountry,
  shippingType: ShippingType,
  settings: ShippingSettings
): CostBreakdown {
  const exchangeRate = settings.usd_to_iqd_rate;
  const breakdown: BreakdownItem[] = [];
  const estimationReasons: string[] = [];
  let isEstimated = specs.estimated;
  
  // === Product Price ===
  const productPriceUsd = specs.priceUsd || 0;
  const productPriceIqd = Math.round(productPriceUsd * exchangeRate);
  
  if (productPriceUsd > 0) {
    const priceEstimated = specs.estimated;
    breakdown.push({
      labelAr: 'سعر المنتج',
      labelEn: 'Product Price',
      valueIqd: productPriceIqd,
      valueUsd: productPriceUsd,
      type: 'price',
      isEstimated: priceEstimated,
      estimationReason: priceEstimated ? 'تم استخراجه بالذكاء الاصطناعي' : undefined,
    });
    if (priceEstimated) {
      estimationReasons.push('سعر المنتج تقديري');
    }
  }
  
  // === Internal Shipping (from store) ===
  // Note: We can't reliably extract this from cross-origin pages
  // So we mark it as estimated if we got it from AI, or 0 if not available
  const internalShippingUsd = specs.internalShipping || 0;
  const internalShippingIqd = Math.round(internalShippingUsd * exchangeRate);
  const internalShippingEstimated = internalShippingUsd > 0 ? true : false; // Always estimated from AI
  
  if (internalShippingUsd > 0) {
    breakdown.push({
      labelAr: 'الشحن الداخلي',
      labelEn: 'Store Shipping',
      valueIqd: internalShippingIqd,
      valueUsd: internalShippingUsd,
      type: 'shipping',
      isEstimated: true,
      estimationReason: 'تقديري - قد يختلف حسب العنوان المحدد في المتجر',
    });
    estimationReasons.push('الشحن الداخلي تقديري');
    isEstimated = true;
  } else {
    // Add note that internal shipping wasn't detected
    breakdown.push({
      labelAr: 'الشحن الداخلي',
      labelEn: 'Store Shipping',
      valueIqd: 0,
      valueUsd: 0,
      type: 'shipping',
      isEstimated: true,
      estimationReason: 'غير متوفر - قد يضاف لاحقاً إن وجد',
    });
  }
  
  // === Tax ===
  const taxUsd = specs.tax || 0;
  const taxIqd = Math.round(taxUsd * exchangeRate);
  const taxEstimated = taxUsd > 0 ? true : false;
  
  if (taxUsd > 0) {
    breakdown.push({
      labelAr: 'الضريبة',
      labelEn: 'Tax',
      valueIqd: taxIqd,
      valueUsd: taxUsd,
      type: 'tax',
      isEstimated: true,
      estimationReason: 'تقديري - قد يختلف حسب الولاية',
    });
    estimationReasons.push('الضريبة تقديرية');
    isEstimated = true;
  }
  
  // === Subtotal ===
  const subtotalUsd = productPriceUsd + internalShippingUsd + taxUsd;
  const subtotalIqd = productPriceIqd + internalShippingIqd + taxIqd;
  
  // === International Shipping ===
  let shippingCost = 0;
  const shippingDetails: CostBreakdown['shippingDetails'] = {};
  
  // Sea shipping only from China
  let effectiveShippingType = shippingType;
  if (shippingType === 'sea' && sourceCountry === 'usa') {
    effectiveShippingType = 'air';
  }
  
  if (effectiveShippingType === 'sea') {
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
    } else {
      isEstimated = true;
      estimationReasons.push('الأبعاد غير متوفرة للشحن البحري');
    }
  } else if (effectiveShippingType === 'air') {
    if (sourceCountry === 'usa') {
      // Air from USA - weight-based
      if (specs.weight && specs.weight > 0) {
        const bufferPercent = settings.air_usa_weight_buffer_percent;
        const weightWithPackaging = specs.weight * (1 + bufferPercent / 100);
        
        shippingDetails.actualWeight = specs.weight;
        shippingDetails.weightWithPackaging = weightWithPackaging;
        shippingDetails.bufferPercent = bufferPercent;
        
        shippingCost = weightWithPackaging * settings.air_usa_kg_price;
        
        breakdown.push({
          labelAr: `الشحن الجوي (${weightWithPackaging.toFixed(2)} كغ)`,
          labelEn: `Air Shipping (${weightWithPackaging.toFixed(2)} kg)`,
          valueIqd: Math.round(shippingCost),
          type: 'shipping',
          estimationReason: `الوزن ${specs.weight.toFixed(2)} كغ + ${bufferPercent}% للتغليف`,
        });
      } else {
        isEstimated = true;
        estimationReasons.push('الوزن غير متوفر - سيُحسب لاحقاً');
        breakdown.push({
          labelAr: 'الشحن الجوي',
          labelEn: 'Air Shipping',
          valueIqd: 0,
          type: 'shipping',
          isEstimated: true,
          estimationReason: 'الوزن غير متوفر - سيُحسب لاحقاً',
        });
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
        const safetyMargin = settings.air_china_weight_safety_margin;
        const weightWithPackaging = usedWeight * (1 + safetyMargin / 100);
        
        shippingDetails.actualWeight = actualWeight;
        shippingDetails.volumetricWeight = volumetricWeight;
        shippingDetails.usedWeight = usedWeight;
        shippingDetails.weightWithPackaging = weightWithPackaging;
        shippingDetails.bufferPercent = safetyMargin;
        
        shippingCost = weightWithPackaging * settings.air_china_volumetric_price;
        
        const weightType = volumetricWeight > actualWeight ? 'حجمي' : 'فعلي';
        breakdown.push({
          labelAr: `الشحن الجوي (${weightWithPackaging.toFixed(2)} كغ ${weightType})`,
          labelEn: `Air Shipping (${weightWithPackaging.toFixed(2)} kg)`,
          valueIqd: Math.round(shippingCost),
          type: 'shipping',
          estimationReason: `الوزن المستخدم: ${usedWeight.toFixed(2)} كغ + ${safetyMargin}% للتغليف`,
        });
      } else {
        isEstimated = true;
        estimationReasons.push('الوزن والأبعاد غير متوفرة');
        breakdown.push({
          labelAr: 'الشحن الجوي',
          labelEn: 'Air Shipping',
          valueIqd: 0,
          type: 'shipping',
          isEstimated: true,
          estimationReason: 'الوزن والأبعاد غير متوفرة - سيُحسب لاحقاً',
        });
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
    isEstimated,
  });
  
  return {
    productPriceUsd,
    productPriceIqd,
    internalShippingUsd,
    internalShippingIqd,
    internalShippingEstimated,
    taxUsd,
    taxIqd,
    taxEstimated,
    subtotalUsd,
    subtotalIqd,
    shippingCost: Math.round(shippingCost),
    shippingDetails,
    commission,
    totalUsd,
    totalIqd,
    isEstimated,
    estimationReasons,
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

/**
 * Validate product specs completeness
 */
export function validateProductSpecs(specs: ProductSpecs): {
  isComplete: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];
  
  if (!specs.priceUsd || specs.priceUsd <= 0) {
    missingFields.push('سعر المنتج');
  }
  
  if (!specs.weight || specs.weight <= 0) {
    missingFields.push('الوزن');
  }
  
  if (!specs.dimensions || specs.dimensions.length <= 0) {
    missingFields.push('الأبعاد');
  }
  
  return {
    isComplete: missingFields.length === 0,
    missingFields,
  };
}
