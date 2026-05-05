import { describe, it, expect, vi } from 'vitest';
import {
  readBooleanFlag,
  isGiftItem,
  isLockedItem,
  isRandomFilamentItem,
  isRandomFilamentRevealed,
  hasValidSaleType,
  isDirectSaleItem,
  isPreorderItem,
  isDiscountEligibleItem,
  readNumericField,
  readQuantity,
} from '../cartItemGuards';

describe('readBooleanFlag', () => {
  it('returns true/false directly', () => {
    expect(readBooleanFlag({ x: true }, 'x')).toBe(true);
    expect(readBooleanFlag({ x: false }, 'x')).toBe(false);
  });
  it('treats null/undefined as default', () => {
    expect(readBooleanFlag({}, 'x')).toBe(false);
    expect(readBooleanFlag({ x: null }, 'x', true)).toBe(true);
  });
  it('coerces 0/1 and "true"/"false"', () => {
    expect(readBooleanFlag({ x: 1 }, 'x')).toBe(true);
    expect(readBooleanFlag({ x: 0 }, 'x')).toBe(false);
    expect(readBooleanFlag({ x: 'true' }, 'x')).toBe(true);
    expect(readBooleanFlag({ x: 'false' }, 'x')).toBe(false);
  });
});

describe('flag shortcuts', () => {
  it('isGiftItem / isLockedItem / RF flags', () => {
    expect(isGiftItem({ is_gift: true })).toBe(true);
    expect(isGiftItem({})).toBe(false);
    expect(isLockedItem({ is_locked: true })).toBe(true);
    expect(isRandomFilamentItem({ is_random_filament: 1 })).toBe(true);
    expect(isRandomFilamentRevealed({ is_random_filament_revealed: false })).toBe(false);
  });
});

describe('sale_type guards', () => {
  it('hasValidSaleType', () => {
    expect(hasValidSaleType({ sale_type: 'direct' })).toBe(true);
    expect(hasValidSaleType({ sale_type: 'preorder' })).toBe(true);
    expect(hasValidSaleType({ sale_type: 'weird' })).toBe(false);
    expect(hasValidSaleType({})).toBe(false);
    expect(hasValidSaleType(null)).toBe(false);
  });
  it('isDirectSaleItem requires explicit direct', () => {
    expect(isDirectSaleItem({ sale_type: 'direct' })).toBe(true);
    expect(isDirectSaleItem({ sale_type: 'preorder' })).toBe(false);
    // Missing → false (no silent fallback to direct)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isDirectSaleItem({})).toBe(false);
    warn.mockRestore();
  });
  it('isPreorderItem requires explicit preorder', () => {
    expect(isPreorderItem({ sale_type: 'preorder' })).toBe(true);
    expect(isPreorderItem({ sale_type: 'direct' })).toBe(false);
  });
});

describe('isDiscountEligibleItem', () => {
  it('rejects gift items', () => {
    expect(isDiscountEligibleItem({ is_gift: true, sale_type: 'direct' })).toBe(false);
  });
  it('rejects locked items', () => {
    expect(isDiscountEligibleItem({ is_locked: true, sale_type: 'direct' })).toBe(false);
  });
  it('rejects sealed RF items', () => {
    expect(
      isDiscountEligibleItem({ is_random_filament: true, is_random_filament_revealed: false }),
    ).toBe(false);
  });
  it('accepts revealed RF items', () => {
    expect(
      isDiscountEligibleItem({ is_random_filament: true, is_random_filament_revealed: true }),
    ).toBe(true);
  });
  it('accepts plain product item', () => {
    expect(isDiscountEligibleItem({ product_id: 'p1', sale_type: 'direct' })).toBe(true);
  });
  it('rejects null/undefined', () => {
    expect(isDiscountEligibleItem(null)).toBe(false);
    expect(isDiscountEligibleItem(undefined)).toBe(false);
  });
});

describe('numeric guards', () => {
  it('readNumericField', () => {
    expect(readNumericField({ x: 5 }, 'x')).toBe(5);
    expect(readNumericField({ x: '7' }, 'x')).toBe(7);
    expect(readNumericField({}, 'x', 3)).toBe(3);
    expect(readNumericField({ x: NaN }, 'x', 9)).toBe(9);
  });
  it('readQuantity floors and defaults to 1', () => {
    expect(readQuantity({ quantity: 3 })).toBe(3);
    expect(readQuantity({ quantity: 2.7 })).toBe(2);
    expect(readQuantity({})).toBe(1);
    expect(readQuantity({ quantity: 0 })).toBe(1);
    expect(readQuantity({ quantity: -2 })).toBe(1);
  });
});
