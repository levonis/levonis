import type { Language } from './types';

/**
 * Pick the localized field from a DB row that has _ar / _en / _ku suffixed columns.
 * Falls back to Arabic (the canonical/required column) if the requested locale is empty.
 *
 * Usage:
 *   const name = pickLocalized(row, 'name', language);
 *   const desc = pickLocalized(row, 'description', language);
 */
export function pickLocalized<T extends Record<string, any>>(
  row: T | null | undefined,
  base: string,
  language: Language,
): string {
  if (!row) return '';
  const key = `${base}_${language}` as keyof T;
  const fallback = `${base}_ar` as keyof T;
  const v = row[key];
  if (v != null && String(v).trim() !== '') return String(v);
  const f = row[fallback];
  return f != null ? String(f) : '';
}
