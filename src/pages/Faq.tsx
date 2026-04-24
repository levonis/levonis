import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd, faqLd } from '@/lib/seo/structured';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const Faq = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'الأسئلة الشائعة',
      desc: 'إجابات سريعة عن أكثر الأسئلة شيوعاً حول LEVONIS — التوصيل، الدفع، الضمان، والإرجاع.',
      qa: [
        { q: 'كم تستغرق مدة التوصيل؟', a: 'التوصيل عادة 1-3 أيام عمل لبغداد و3-5 لباقي المحافظات. مدة كل منتج موضحة في صفحته.' },
        { q: 'ما طرق الدفع المتاحة؟', a: 'الدفع عند الاستلام (COD) هو الأساسي. يمكن استخدام رصيد المحفظة جزئياً أو كلياً عند الدفع.' },
        { q: 'هل المنتجات أصلية ولها ضمان؟', a: 'نعم، جميع منتجاتنا أصلية بضمان رسمي. تفاصيل الضمان موضحة في صفحة كل منتج.' },
        { q: 'كيف أرجع منتجاً؟', a: 'تواصل معنا عبر WhatsApp خلال 7 أيام من الاستلام إذا كان المنتج معيباً أو مختلفاً عن الموصوف.' },
        { q: 'كيف أتابع طلبي؟', a: 'من صفحة "طلباتي" يمكنك متابعة كل المراحل، أو عبر إشعارات Telegram إذا فعّلتها.' },
        { q: 'كيف أكسب نقاط ومكافآت؟', a: 'كل عملية شراء تمنحك نقاطاً. كذلك يمكنك اللعب في صفحة الألعاب لربح نقاط وتذاكر وقسائم.' },
        { q: 'هل يمكنني البيع على LEVONIS؟', a: 'نعم — قسم "مجتمع التجار" يتيح للتجار المعتمدين بيع منتجاتهم على المنصة.' },
        { q: 'كيف أتواصل مع الدعم؟', a: 'WhatsApp: +964 783 845 5220 — متاحون يومياً.' },
      ],
    },
    en: {
      title: 'FAQ',
      desc: 'Quick answers to common questions about LEVONIS — delivery, payment, warranty, and returns.',
      qa: [
        { q: 'How long does delivery take?', a: '1-3 business days in Baghdad, 3-5 in other governorates. Each product page shows its estimate.' },
        { q: 'What payment methods do you accept?', a: 'Cash on Delivery (COD) is primary. Wallet balance can also be used partially or fully.' },
        { q: 'Are products original with warranty?', a: 'Yes, all our products are original with official warranty. Details are on each product page.' },
        { q: 'How do I return a product?', a: 'Contact us on WhatsApp within 7 days if defective or different from description.' },
        { q: 'How do I track my order?', a: 'From "My Orders" page or via Telegram notifications if enabled.' },
        { q: 'How do I earn rewards?', a: 'Every purchase earns points. You can also play games to win points, tickets, and coupons.' },
        { q: 'Can I sell on LEVONIS?', a: 'Yes — the Merchant Marketplace allows approved merchants to sell on the platform.' },
        { q: 'How do I contact support?', a: 'WhatsApp: +964 783 845 5220 — available daily.' },
      ],
    },
    ku: {
      title: 'پرسیارە دووبارەکان',
      desc: 'وەڵامی خێرا بۆ پرسیارە بەردەوامەکان دەربارەی LEVONIS.',
      qa: [
        { q: 'گەیاندن چەند دەخایەنێت؟', a: '1-3 ڕۆژ بۆ بەغدا و 3-5 بۆ پارێزگاکانی تر.' },
        { q: 'چ ڕێگەی پارەدان هەیە؟', a: 'پارەدان لە کاتی وەرگرتن (COD).' },
        { q: 'بەرهەمەکان ڕەسەنن؟', a: 'بەڵێ، هەموو بەرهەمەکان ڕەسەنن و گەرەنتییان هەیە.' },
        { q: 'چۆن بەرهەم بگەڕێنمەوە؟', a: 'لە ماوەی 7 ڕۆژدا پەیوەندی بکە لە WhatsApp.' },
        { q: 'چۆن داواکاریم شوێن بکەم؟', a: 'لە لاپەڕەی "داواکارییەکانم".' },
        { q: 'چۆن خەڵات بەدەست بهێنم؟', a: 'بە کڕین یان یاریکردن.' },
        { q: 'دەتوانم بفرۆشم؟', a: 'بەڵێ، لە بازاڕی بازرگانان.' },
        { q: 'پەیوەندی', a: 'WhatsApp: +964 783 845 5220.' },
      ],
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';

  return (
    <div className="min-h-screen" dir={dir}>
      <SEO
        title={c.title}
        description={c.desc}
        url="https://levonisiq.com/faq"
        jsonLd={[
          breadcrumbLd([
            { name: 'Home', url: '/' },
            { name: c.title, url: '/faq' },
          ]),
          faqLd(c.qa),
        ]}
      />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">{c.title}</h1>
        <p className="text-muted-foreground mb-8">{c.desc}</p>
        <div className="rounded-2xl glass-panel p-2 md:p-4">
          <Accordion type="single" collapsible className="w-full">
            {c.qa.map((it, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-start font-bold text-foreground">{it.q}</AccordionTrigger>
                <AccordionContent className="text-foreground/80 leading-relaxed">{it.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Faq;
