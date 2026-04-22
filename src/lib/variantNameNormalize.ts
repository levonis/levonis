// Mirror of edge function `normalizeVariantName` for client-side debug/QA usage.
// Keep in sync with supabase/functions/retry-extract-colors/index.ts

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function normalizeVariantName(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw);
  // Decode common HTML entities + numeric entities
  s = s.replace(/&[a-z#0-9]+;/gi, (m) => {
    if (HTML_ENTITIES[m.toLowerCase()]) return HTML_ENTITIES[m.toLowerCase()];
    const num = m.match(/^&#(\d+);$/);
    if (num) {
      try { return String.fromCharCode(parseInt(num[1], 10)); } catch { return m; }
    }
    return m;
  });
  // Unify whitespace + trim + lowercase
  s = s.replace(/[\s\u00A0\u200B-\u200D\uFEFF]+/g, ' ').trim().toLowerCase();
  // Strip surrounding punctuation
  s = s.replace(/^[\-_/.,:;|]+|[\-_/.,:;|]+$/g, '');
  return s;
}

export function isSwatchUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return /\/swatch\//i.test(url);
}
