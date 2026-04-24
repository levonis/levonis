/**
 * Universal helper to pick the right translated field from a DB row.
 *
 * Convention: rows store columns like `<field>_ar`, `<field>_en`, `<field>_ku`.
 * Some legacy rows also have a plain `<field>` column treated as English.
 *
 * Fallback order: requested lang → ar → en → '' .
 */
export type Lang = 'ar' | 'en' | 'ku';

export function pickI18n<T extends Record<string, any>>(
  row: T | null | undefined,
  field: string,
  lang: Lang | string | undefined
): string {
  if (!row) return '';
  const l = (lang || 'ar') as Lang;
  const v =
    (row[`${field}_${l}`] as string | undefined) ||
    (l === 'en' ? (row[field] as string | undefined) : undefined) ||
    (row[`${field}_ar`] as string | undefined) ||
    (row[`${field}_en`] as string | undefined) ||
    (row[field] as string | undefined) ||
    '';
  return (v || '').toString();
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
