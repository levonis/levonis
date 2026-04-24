import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd } from '@/lib/seo/structured';

const Terms = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'الشروط والأحكام',
      desc: 'شروط استخدام موقع LEVONIS وشراء المنتجات.',
      sections: [
        { h: 'استخدام الموقع', p: 'باستخدامك لموقع LEVONIS، فإنك توافق على هذه الشروط. يحق لنا تحديثها في أي وقت.' },
        { h: 'الطلبات والدفع', p: 'تُقبل الطلبات بعد تأكيدها من فريقنا. الدفع متاح عبر الدفع عند الاستلام (COD) ووسائل الدفع المتاحة على الموقع.' },
        { h: 'الأسعار والعروض', p: 'الأسعار بالدينار العراقي وقد تتغير. العروض سارية حتى نفاد الكمية.' },
        { h: 'التوصيل', p: 'يتم التوصيل خلال المدة المذكورة لكل منتج. التأخيرات الناتجة عن ظروف خارجة عن سيطرتنا غير مضمونة.' },
        { h: 'الإرجاع والاستبدال', p: 'يحق لك إرجاع المنتج خلال 7 أيام إذا كان معيباً أو مختلفاً عن الموصوف، شريطة الحفاظ على التغليف الأصلي.' },
        { h: 'الضمان', p: 'الضمان الرسمي مذكور في صفحة كل منتج. لا يشمل سوء الاستخدام.' },
        { h: 'مجتمع التجار', p: 'التجار المسجّلون مسؤولون عن منتجاتهم. تحتفظ LEVONIS بحق الإيقاف لأي تجاوز.' },
      ],
    },
    en: {
      title: 'Terms of Use',
      desc: 'Terms for using LEVONIS and purchasing products.',
      sections: [
        { h: 'Site Usage', p: 'By using LEVONIS you agree to these terms. We may update them anytime.' },
        { h: 'Orders & Payment', p: 'Orders are accepted after confirmation. Payment via Cash on Delivery (COD) and other available methods.' },
        { h: 'Prices & Offers', p: 'Prices are in IQD and may change. Offers are valid while supplies last.' },
        { h: 'Delivery', p: 'Delivery within the stated timeframe per product. Delays beyond our control are not guaranteed.' },
        { h: 'Returns', p: 'You may return products within 7 days if defective or different from description, with original packaging.' },
        { h: 'Warranty', p: 'Official warranty stated on each product page. Misuse is not covered.' },
        { h: 'Merchant Marketplace', p: 'Registered merchants are responsible for their products. LEVONIS reserves the right to suspend violators.' },
      ],
    },
    ku: {
      title: 'مەرجەکانی بەکارهێنان',
      desc: 'مەرجەکانی بەکارهێنانی LEVONIS.',
      sections: [
        { h: 'بەکارهێنان', p: 'بە بەکارهێنانی LEVONIS ڕەزامەندی دەدەیت لەسەر مەرجەکان.' },
        { h: 'داواکاری', p: 'داواکاری دوای دڵنیاکردنەوە وەردەگیرێت. پارەدان لە کاتی وەرگرتن.' },
        { h: 'نرخ', p: 'نرخ بە دینار و دەکرێت بگۆڕێت.' },
        { h: 'گەیاندن', p: 'گەیاندن لە ماوەی دیاریکراودا.' },
        { h: 'گەڕاندنەوە', p: '7 ڕۆژ بۆ گەڕاندنەوەی بەرهەمی عەیبدار.' },
        { h: 'گەرەنتی', p: 'گەرەنتی فەرمی لە لاپەڕەی هەر بەرهەمێک.' },
        { h: 'بازرگانان', p: 'بازرگانان بەرپرسن لە بەرهەمەکانیان.' },
      ],
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';

  return (
    <div className="min-h-screen" dir={dir}>
      <SEO
        title={c.title}
        description={c.desc}
        url="https://levonisiq.com/terms"
        jsonLd={breadcrumbLd([
          { name: 'Home', url: '/' },
          { name: c.title, url: '/terms' },
        ])}
      />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <h1 className="text-3xl md:text-4xl font-extrabold text-foreground mb-2">{c.title}</h1>
        <p className="text-muted-foreground mb-8">{c.desc}</p>
        <div className="space-y-5">
          {c.sections.map((s, i) => (
            <section key={i} className="rounded-2xl glass-panel p-5">
              <h2 className="text-lg font-bold text-foreground mb-2">{s.h}</h2>
              <p className="text-foreground/80 leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
        <Footer />
      </main>
    </div>
  );
};

export default Terms;
