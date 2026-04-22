// Pure helper used by AdminCustomRequests.handleRetryColors and covered by unit tests.
//
// Rules:
//  - mode === 'replace': discard prior colors; every returned color receives default flags
//    where the extractor didn't already specify them.
//  - mode === 'upsert' (default): merge by case-insensitive name. Brand-new entries
//    inherit defaults; pre-existing entries keep their previously stored flags
//    untouched (only their non-flag fields like image/hex are overwritten by the
//    freshly extracted data).

export interface ProductDefaults {
  default_color_available_for_pre_order?: boolean;
  default_color_available_for_direct_sale?: boolean;
  has_in_stock?: boolean;
}

export interface ColorEntry {
  name: string;
  name_ar?: string;
  hex_code?: string | null;
  image_url?: string | null;
  available_for_pre_order?: boolean;
  available_for_direct_sale?: boolean;
  in_stock?: boolean;
  [k: string]: unknown;
}

export function applyDefaultsToColor(c: ColorEntry, defaults: ProductDefaults): ColorEntry {
  return {
    ...c,
    available_for_pre_order:
      c?.available_for_pre_order ?? defaults.default_color_available_for_pre_order ?? true,
    available_for_direct_sale:
      c?.available_for_direct_sale ?? defaults.default_color_available_for_direct_sale ?? false,
    in_stock: c?.in_stock ?? defaults.has_in_stock ?? false,
  };
}

export function mergeRetryColors(params: {
  existingColors: ColorEntry[] | null | undefined;
  addedColors: ColorEntry[] | null | undefined;
  mode: 'replace' | 'upsert' | string | undefined;
  defaults: ProductDefaults | null | undefined;
}): ColorEntry[] {
  const defaults = params.defaults ?? {};
  const added = params.addedColors ?? [];

  if (params.mode === 'replace') {
    return added.map((c) => applyDefaultsToColor(c, defaults));
  }

  const existing = Array.isArray(params.existingColors) ? params.existingColors : [];
  const map = new Map<string, ColorEntry>();
  for (const c of existing) {
    const key = (c?.name || '').toLowerCase().trim();
    if (key) map.set(key, c);
  }
  for (const c of added) {
    const key = (c?.name || '').toLowerCase().trim();
    if (!key) continue;
    const prev = map.get(key);
    const merged = { ...prev, ...c } as ColorEntry;
    // Only apply defaults to brand-new colors. Existing entries keep their
    // previously stored availability flags exactly as-is.
    map.set(key, prev ? merged : applyDefaultsToColor(merged, defaults));
  }
  return Array.from(map.values());
}
