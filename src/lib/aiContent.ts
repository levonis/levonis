// Helpers for the structured "Why this product" AI content stored on products.ai_content
export type Lang = 'ar' | 'en' | 'ku';

export interface LocalizedText {
  ar?: string;
  en?: string;
  ku?: string;
}

export interface AISpec {
  key: LocalizedText;
  value: LocalizedText;
}

export interface AIContent {
  benefits?: LocalizedText[];
  usage?: LocalizedText[];
  specifications?: AISpec[];
  target_audience?: LocalizedText;
  problem_solved?: LocalizedText;
}

export const pickLocalized = (t: LocalizedText | undefined | null, lang: Lang): string => {
  if (!t) return '';
  return (t[lang] || t.ar || t.en || t.ku || '').toString().trim();
};

export const normalizeAIContent = (raw: any): AIContent => {
  if (!raw || typeof raw !== 'object') return {};
  return {
    benefits: Array.isArray(raw.benefits) ? raw.benefits : [],
    usage: Array.isArray(raw.usage) ? raw.usage : [],
    specifications: Array.isArray(raw.specifications) ? raw.specifications : [],
    target_audience: raw.target_audience || undefined,
    problem_solved: raw.problem_solved || undefined,
  };
};

export const hasAIContent = (c: AIContent | null | undefined): boolean => {
  if (!c) return false;
  return Boolean(
    (c.benefits && c.benefits.length) ||
    (c.usage && c.usage.length) ||
    (c.specifications && c.specifications.length) ||
    (c.target_audience && (c.target_audience.ar || c.target_audience.en || c.target_audience.ku)) ||
    (c.problem_solved && (c.problem_solved.ar || c.problem_solved.en || c.problem_solved.ku))
  );
};

// Build a plain-text "additionalProperty" + description bullets for JSON-LD
export const buildAIContentForLd = (c: AIContent | null | undefined, lang: Lang) => {
  if (!c) return { additionalProperty: [] as any[], descriptionAppendix: '' };
  const benefits = (c.benefits || []).map(b => pickLocalized(b, lang)).filter(Boolean);
  const usage = (c.usage || []).map(b => pickLocalized(b, lang)).filter(Boolean);
  const specs = (c.specifications || [])
    .map(s => ({ name: pickLocalized(s.key, lang), value: pickLocalized(s.value, lang) }))
    .filter(s => s.name && s.value);
  const audience = pickLocalized(c.target_audience, lang);
  const problem = pickLocalized(c.problem_solved, lang);

  const additionalProperty: any[] = [];
  specs.forEach(s => additionalProperty.push({ '@type': 'PropertyValue', name: s.name, value: s.value }));
  benefits.forEach((b, i) => additionalProperty.push({ '@type': 'PropertyValue', name: `Benefit ${i + 1}`, value: b }));
  usage.forEach((u, i) => additionalProperty.push({ '@type': 'PropertyValue', name: `Usage ${i + 1}`, value: u }));
  if (audience) additionalProperty.push({ '@type': 'PropertyValue', name: 'Target Audience', value: audience });
  if (problem) additionalProperty.push({ '@type': 'PropertyValue', name: 'Problem Solved', value: problem });

  const parts: string[] = [];
  if (problem) parts.push(problem);
  if (benefits.length) parts.push(benefits.join(' • '));
  const descriptionAppendix = parts.join(' — ');

  return { additionalProperty, descriptionAppendix };
};
