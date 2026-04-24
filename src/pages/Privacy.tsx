import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd } from '@/lib/seo/structured';

const Privacy = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'سياسة الخصوصية',
      desc: 'كيف يجمع LEVONIS بياناتك ويستخدمها ويحميها.',
      sections: [
        { h: 'البيانات التي نجمعها', p: 'الاسم، رقم الهاتف، البريد، عنوان التوصيل، وسجل الطلبات لتقديم الخدمة وتوصيل المنتجات.' },
        { h: 'كيف نستخدم بياناتك', p: 'لمعالجة الطلبات، إرسال إشعارات الشحن، تحسين تجربتك، والتواصل بخصوص العروض (يمكنك إيقاف ذلك في أي وقت).' },
        { h: 'مشاركة البيانات', p: 'لا نبيع بياناتك. نشاركها فقط مع شركاء التوصيل والدفع لإتمام طلبك.' },
        { h: 'حماية البيانات', p: 'نستخدم تشفيراً وسياسات أمنية صارمة (RLS) لحماية بياناتك على خوادمنا.' },
        { h: 'حقوقك', p: 'يمكنك طلب الاطلاع على بياناتك أو حذفها بالتواصل معنا عبر WhatsApp: +964 783 845 5220.' },
      ],
    },
    en: {
      title: 'Privacy Policy',
      desc: 'How LEVONIS collects, uses, and protects your data.',
      sections: [
        { h: 'Data We Collect', p: 'Name, phone, email, delivery address, and order history to provide service and deliver products.' },
        { h: 'How We Use Data', p: 'To process orders, send shipping notifications, improve your experience, and inform you about offers (opt-out anytime).' },
        { h: 'Data Sharing', p: 'We never sell your data. We share it only with delivery and payment partners to fulfill your order.' },
        { h: 'Data Protection', p: 'We use encryption and strict security policies (RLS) to protect your data on our servers.' },
        { h: 'Your Rights', p: 'You can request access or deletion of your data via WhatsApp: +964 783 845 5220.' },
      ],
    },
    ku: {
      title: 'سیاسەتی تایبەتمەندی',
      desc: 'چۆن LEVONIS داتاکانت کۆدەکاتەوە و دەیپارێزێت.',
      sections: [
        { h: 'داتای کۆکراوە', p: 'ناو، ژمارە، ئیمەیڵ، ناونیشان و مێژووی داواکاری.' },
        { h: 'چۆن بەکاری دەهێنین', p: 'بۆ پرۆسەکردنی داواکاری و ناردنی ئاگادارکردنەوە.' },
        { h: 'هاوبەشکردن', p: 'داتاکانت نافرۆشین. تەنها لەگەڵ هاوبەشانی گەیاندن.' },
        { h: 'پاراستن', p: 'بەکارهێنانی شفرەکردن و سیاسەتی توند.' },
        { h: 'مافەکانت', p: 'دەتوانیت داوای سڕینەوەی داتاکانت بکەیت لە WhatsApp: +964 783 845 5220.' },
      ],
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';

  return (
    <div className="min-h-screen" dir={dir}>
      <SEO
        title={c.title}
        description={c.desc}
        url="https://levonisiq.com/privacy"
        jsonLd={breadcrumbLd([
          { name: 'Home', url: '/' },
          { name: c.title, url: '/privacy' },
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

export default Privacy;
