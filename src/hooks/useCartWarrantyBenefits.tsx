/**
 * Deprecated: printer warranty benefits (discount + free shipping tied to an
 * active printer warranty) have been removed. Loyalty card benefits remain.
 * This stub keeps the existing Cart imports compiling and returns null so all
 * downstream branches short-circuit.
 */
export interface WarrantyBenefitsResult {
  userPrinterId: string;
  totalDiscount: number;
  percentageRate: number;
  percentageRemaining: number;
  freeShipping: boolean;
  freeShippingMethods: string[] | null;
  freeShippingMinOrder: number;
  freeShippingRemainingUses: number;
  freeShippingApplicableCategoryIds: string[] | null;
  activationDay: number;
}

export function useActiveWarrantyBenefits() {
  return { data: [] as any[], isLoading: false };
}

export function useCartWarrantyBenefits(
  _items: any,
  _getCartItemPrice: any,
  _total: number,
): { warrantyBenefits: WarrantyBenefitsResult | null; isLoading: boolean } {
  return { warrantyBenefits: null, isLoading: false };
}
