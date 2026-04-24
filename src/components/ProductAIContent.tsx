import { useMemo } from 'react';
import { Sparkles, CheckCircle2, Wrench, ListChecks, Users, Lightbulb } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { type AIContent, normalizeAIContent, pickLocalized, hasAIContent } from '@/lib/aiContent';

interface Props {
  aiContent: any;
  productName?: string;
}

const Section = ({
  icon: Icon,
  title,
  children,
}: {
  icon: any;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm p-4">
    <div className="flex items-center gap-2 mb-3">
      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
    </div>
    <div className="text-sm text-foreground/85 leading-relaxed">{children}</div>
  </div>
);

const ProductAIContent = ({ aiContent, productName }: Props) => {
  const { t, language } = useLanguage();
  const lang = (language || 'ar') as 'ar' | 'en' | 'ku';
  const content: AIContent = useMemo(() => normalizeAIContent(aiContent), [aiContent]);

  if (!hasAIContent(content)) return null;

  const benefits = (content.benefits || []).map(b => pickLocalized(b, lang)).filter(Boolean);
  const usage = (content.usage || []).map(b => pickLocalized(b, lang)).filter(Boolean);
  const specs = (content.specifications || [])
    .map(s => ({ k: pickLocalized(s.key, lang), v: pickLocalized(s.value, lang) }))
    .filter(s => s.k && s.v);
  const audience = pickLocalized(content.target_audience, lang);
  const problem = pickLocalized(content.problem_solved, lang);

  const headings = {
    ar: {
      why: 'لماذا هذا المنتج؟',
      benefits: 'الفوائد الرئيسية',
      usage: 'طريقة الاستخدام',
      specs: 'المواصفات',
      audience: 'مناسب لـ',
      problem: 'يحل مشكلة',
    },
    en: {
      why: 'Why this product?',
      benefits: 'Key Benefits',
      usage: 'How to Use',
      specs: 'Specifications',
      audience: 'Best For',
      problem: 'Solves',
    },
    ku: {
      why: 'بۆچی ئەم بەرهەمە؟',
      benefits: 'سوودە سەرەکیەکان',
      usage: 'چۆنیەتی بەکارهێنان',
      specs: 'تایبەتمەندیەکان',
      audience: 'گونجاوە بۆ',
      problem: 'چارەسەری',
    },
  }[lang];

  return (
    <section
      className="mt-6 space-y-4"
      itemScope
      itemType="https://schema.org/Product"
      aria-label={headings.why}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-extrabold text-foreground">
          {headings.why}{productName ? ` — ${productName}` : ''}
        </h2>
      </div>

      {problem && (
        <Section icon={Lightbulb} title={headings.problem}>
          <p itemProp="description">{problem}</p>
        </Section>
      )}

      {benefits.length > 0 && (
        <Section icon={CheckCircle2} title={headings.benefits}>
          <ul className="space-y-2">
            {benefits.map((b, i) => (
              <li key={i} className="flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {usage.length > 0 && (
        <Section icon={Wrench} title={headings.usage}>
          <ol className="space-y-2 list-decimal list-inside marker:text-primary marker:font-bold">
            {usage.map((u, i) => (
              <li key={i}>{u}</li>
            ))}
          </ol>
        </Section>
      )}

      {specs.length > 0 && (
        <Section icon={ListChecks} title={headings.specs}>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {specs.map((s, i) => (
              <div
                key={i}
                className="flex justify-between gap-3 px-3 py-2 rounded-xl bg-background/50 border border-border/30"
                itemProp="additionalProperty"
                itemScope
                itemType="https://schema.org/PropertyValue"
              >
                <dt className="text-foreground/70 font-medium" itemProp="name">{s.k}</dt>
                <dd className="text-foreground font-semibold text-end" itemProp="value">{s.v}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {audience && (
        <Section icon={Users} title={headings.audience}>
          <p>{audience}</p>
        </Section>
      )}
    </section>
  );
};

export default ProductAIContent;
