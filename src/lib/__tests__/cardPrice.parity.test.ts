import { describe, it, expect } from 'vitest';
import { computeUnifiedCardPrice, computeUnifiedCardOriginalPrice } from '../cardPrice';

const USD = 1300;

describe('computeUnifiedCardPrice', () => {
  it('falls back to base price when nothing else applies', () => {
    const p = { price: 100000, has_in_stock: false, has_pre_order: false };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(100000);
  });

  it('uses direct_sale_price when in stock', () => {
    const p = {
      price: 200000,
      direct_sale_price: 150000,
      has_in_stock: true,
      direct_stock: 5,
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(150000);
  });

  it('uses the cheapest option override price (replaces base, not additive)', () => {
    const p = {
      direct_sale_price: 100000,
      has_in_stock: true,
      product_options: [
        { name_ar: 'A', price_adjustment: 50000, stock_quantity: 5, available_for_direct_sale: true },
        { name_ar: 'B', price_adjustment: 10000, stock_quantity: 3, available_for_direct_sale: true },
        { name_ar: 'C', price_adjustment: 80000, stock_quantity: 2, available_for_direct_sale: true },
      ],
    };
    // New semantics: cheapest override (10,000) wins, not base + adjustment.
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(10000);
  });

  it('skips out-of-stock options', () => {
    const p = {
      direct_sale_price: 100000,
      has_in_stock: true,
      product_options: [
        { name_ar: 'A', price_adjustment: 5000, stock_quantity: 0, available_for_direct_sale: true },
        { name_ar: 'B', price_adjustment: 20000, stock_quantity: 4, available_for_direct_sale: true },
      ],
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(20000);
  });

  it('falls back to base when all option overrides are 0/empty', () => {
    const p = {
      direct_sale_price: 100000,
      has_in_stock: true,
      product_options: [
        { name_ar: 'A', price_adjustment: 0, stock_quantity: 2, available_for_direct_sale: true },
        { name_ar: 'B', price_adjustment: 0, stock_quantity: 2, available_for_direct_sale: true },
      ],
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(100000);
  });

  it('uses live RPC price when product is linked to COD', () => {
    const p = {
      direct_sale_price: 999999,
      has_in_stock: true,
      direct_stock: 5,
      link_direct_commission_to_cod: true,
      id: 'p1',
    };
    const map = new Map([['p1', 123000]]);
    expect(computeUnifiedCardPrice(p, USD, {}, map)).toBe(123000);
  });

  it('uses pre-order price when only pre-order available', () => {
    const p = {
      has_in_stock: false,
      has_pre_order: true,
      shipping_type: 'both',
      sea_price: 50000,
      air_price: 80000,
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(50000);
  });

  it('picks min between direct and pre-order candidates', () => {
    const p = {
      has_in_stock: true,
      direct_sale_price: 90000,
      has_pre_order: true,
      shipping_type: 'sea',
      sea_price: 70000,
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(70000);
  });

  it('rounds up to 250 when round_up_price is true', () => {
    const p = {
      has_in_stock: true,
      direct_stock: 5,
      direct_sale_price: 100123,
      round_up_price: true,
    };
    expect(computeUnifiedCardPrice(p, USD, null)).toBe(100250);
  });
});

describe('computeUnifiedCardOriginalPrice', () => {
  it('returns null when no original_price', () => {
    const p = { price: 100000, has_in_stock: true, direct_sale_price: 90000 };
    expect(computeUnifiedCardOriginalPrice(p, USD, null)).toBeNull();
  });

  it('returns null when original ≤ final', () => {
    const p = { price: 100000, original_price: 80000, has_in_stock: true, direct_sale_price: 90000 };
    expect(computeUnifiedCardOriginalPrice(p, USD, null)).toBeNull();
  });

  it('returns rounded original when greater than final', () => {
    const p = {
      price: 100000,
      original_price: 150000,
      has_in_stock: true,
      direct_sale_price: 90000,
      round_up_price: true,
    };
    expect(computeUnifiedCardOriginalPrice(p, USD, null)).toBe(150000);
  });
});
