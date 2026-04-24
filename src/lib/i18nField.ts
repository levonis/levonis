/**
 * Universal helper to pick the right translated field from a DB row.
 *
 * Convention: rows store columns like `<field>_ar`, `<field>_en`, `<field>_ku`.
 * Some legacy rows also have a plain `<field>` column treated as English.
 *
 * Fallback order (per stage-12 spec):
 *   requested lang → ar → en → plain `<field>` → '' .
 *
 * Empty strings, null and undefined are all treated as "missing" so they fall
 * through to the next candidate (no blank fields in the UI when any other
 * language has content).
 */
export type Lang = 'ar' | 'en' | 'ku';

const isFilled = (v: unknown): v is string =>
  typeof v === 'string' ? v.trim().length > 0 : v != null && String(v).trim().length > 0;

export function pickI18n<T extends Record<string, any>>(
  row: T | null | undefined,
  field: string,
  lang: Lang | string | undefined
): string {
  if (!row) return '';
  const l = ((lang || 'ar') as Lang);

  const candidates: unknown[] = [
    row[`${field}_${l}`],
    row[`${field}_ar`],
    row[`${field}_en`],
    row[field],
  ];

  for (const c of candidates) {
    if (isFilled(c)) return String(c);
  }
  return '';
}

/** Build common helpers for a single object. */
export function localizeRow<T extends Record<string, any>>(
  row: T | null | undefined,
  lang: Lang | string | undefined
) {
  return {
    name: pickI18n(row, 'name', lang),
    title: pickI18n(row, 'title', lang),
    description: pickI18n(row, 'description', lang),
  };
}

// ---------------------------------------------------------------------------
// Lightweight self-tests (run only in dev). Surfaced via console.assert so any
// regression is visible during local development without breaking production.
// ---------------------------------------------------------------------------
if (import.meta.env?.DEV) {
  const tests: Array<[string, boolean]> = [
    ['ku missing → ar', pickI18n({ name_ar: 'مرحبا', name_en: 'Hello' }, 'name', 'ku') === 'مرحبا'],
    ['en missing → ar', pickI18n({ name_ar: 'مرحبا' }, 'name', 'en') === 'مرحبا'],
    ['ar present',      pickI18n({ name_ar: 'مرحبا', name_en: 'Hello' }, 'name', 'ar') === 'مرحبا'],
    ['en present',      pickI18n({ name_ar: 'مرحبا', name_en: 'Hello' }, 'name', 'en') === 'Hello'],
    ['ku present',      pickI18n({ name_ku: 'سڵاو', name_ar: 'مرحبا' }, 'name', 'ku') === 'سڵاو'],
    ['empty string falls back', pickI18n({ name_en: '', name_ar: 'مرحبا' }, 'name', 'en') === 'مرحبا'],
    ['whitespace falls back',   pickI18n({ name_en: '   ', name_ar: 'مرحبا' }, 'name', 'en') === 'مرحبا'],
    ['ar missing → en',   pickI18n({ name_en: 'Hello' }, 'name', 'ar') === 'Hello'],
    ['plain field used',  pickI18n({ name: 'Plain' }, 'name', 'en') === 'Plain'],
    ['nothing → empty',   pickI18n({}, 'name', 'en') === ''],
    ['null row → empty',  pickI18n(null as any, 'name', 'en') === ''],
  ];
  const failed = tests.filter(([, ok]) => !ok);
  if (failed.length) {
    // eslint-disable-next-line no-console
    console.warn('[pickI18n] fallback tests failed:', failed.map(([n]) => n));
  }
}
