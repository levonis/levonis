import { describe, it, expect } from 'vitest';
import { mergeRetryColors, applyDefaultsToColor } from './mergeRetryColors';

const defaults = {
  default_color_available_for_pre_order: true,
  default_color_available_for_direct_sale: false,
  has_in_stock: false,
};

describe('mergeRetryColors', () => {
  it('upsert: brand-new colors inherit defaults', () => {
    const result = mergeRetryColors({
      existingColors: [],
      addedColors: [{ name: 'Titan Gray', hex_code: '#5F6367', image_url: 'a.png' }],
      mode: 'upsert',
      defaults,
    });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Titan Gray',
      available_for_pre_order: true,
      available_for_direct_sale: false,
      in_stock: false,
    });
  });

  it('upsert: existing colors keep their previous availability flags untouched', () => {
    const existing = [
      {
        name: 'Titan Gray',
        hex_code: '#000000',
        image_url: 'old.png',
        available_for_pre_order: false,
        available_for_direct_sale: true,
        in_stock: true,
      },
    ];
    const result = mergeRetryColors({
      existingColors: existing,
      addedColors: [{ name: 'Titan Gray', hex_code: '#5F6367', image_url: 'new.png' }],
      mode: 'upsert',
      defaults,
    });
    expect(result).toHaveLength(1);
    // Flags from existing must win
    expect(result[0].available_for_pre_order).toBe(false);
    expect(result[0].available_for_direct_sale).toBe(true);
    expect(result[0].in_stock).toBe(true);
    // Non-flag fields refreshed from the new extraction
    expect(result[0].hex_code).toBe('#5F6367');
    expect(result[0].image_url).toBe('new.png');
  });

  it('upsert: case-insensitive name matching', () => {
    const result = mergeRetryColors({
      existingColors: [{ name: 'titan gray', available_for_pre_order: false }],
      addedColors: [{ name: 'TITAN GRAY', hex_code: '#5F6367' }],
      mode: 'upsert',
      defaults,
    });
    expect(result).toHaveLength(1);
    expect(result[0].available_for_pre_order).toBe(false); // existing flag preserved
    expect(result[0].hex_code).toBe('#5F6367');
  });

  it('replace: every entry receives defaults, prior list is discarded', () => {
    const result = mergeRetryColors({
      existingColors: [
        { name: 'Old Color', available_for_pre_order: false, available_for_direct_sale: true },
      ],
      addedColors: [
        { name: 'White' },
        { name: 'Blue', available_for_pre_order: false }, // explicit override stays
      ],
      mode: 'replace',
      defaults,
    });
    expect(result).toHaveLength(2);
    expect(result.find((c) => c.name === 'Old Color')).toBeUndefined();
    expect(result[0]).toMatchObject({
      name: 'White',
      available_for_pre_order: true,
      available_for_direct_sale: false,
      in_stock: false,
    });
    // Explicit value from extractor must beat the default
    expect(result[1].available_for_pre_order).toBe(false);
  });

  it('falls back to safe defaults when product_defaults row is missing', () => {
    const result = mergeRetryColors({
      existingColors: [],
      addedColors: [{ name: 'Pink' }],
      mode: 'upsert',
      defaults: null,
    });
    expect(result[0]).toMatchObject({
      available_for_pre_order: true,
      available_for_direct_sale: false,
      in_stock: false,
    });
  });

  it('mixed: new + existing entries side by side', () => {
    const existing = [
      { name: 'Gold', available_for_pre_order: false, available_for_direct_sale: true, in_stock: true },
    ];
    const result = mergeRetryColors({
      existingColors: existing,
      addedColors: [
        { name: 'Gold', hex_code: '#F4A925' }, // existing — flags preserved
        { name: 'Mint', hex_code: '#96DCB9' }, // new — defaults applied
      ],
      mode: 'upsert',
      defaults,
    });
    const gold = result.find((c) => c.name.toLowerCase() === 'gold')!;
    const mint = result.find((c) => c.name.toLowerCase() === 'mint')!;
    expect(gold.available_for_pre_order).toBe(false);
    expect(gold.in_stock).toBe(true);
    expect(gold.hex_code).toBe('#F4A925');
    expect(mint.available_for_pre_order).toBe(true);
    expect(mint.available_for_direct_sale).toBe(false);
    expect(mint.in_stock).toBe(false);
  });

  it('applyDefaultsToColor leaves explicitly-set flags alone', () => {
    const c = applyDefaultsToColor(
      { name: 'X', available_for_pre_order: false, in_stock: true },
      defaults
    );
    expect(c.available_for_pre_order).toBe(false);
    expect(c.in_stock).toBe(true);
    expect(c.available_for_direct_sale).toBe(false); // from defaults
  });
});
