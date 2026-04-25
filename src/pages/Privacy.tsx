import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd } from '@/lib/seo/structured';
import { ShieldCheck, Database, Cookie, Lock, UserCheck, Globe, Bell, Baby, RefreshCw, Mail } from 'lucide-react';

const Privacy = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'سياسة الخصوصية',
      desc: 'كيف يجمع LEVONIS بياناتك ويستخدمها ويحميها — سياسة شفافة ومفصّلة.',
      updated: 'آخر تحديث: 2025-04-25',
      intro: 'في LEVONIS نُقدّر خصوصيتك ونتعامل مع بياناتك وفقاً لأعلى معايير الأمان والشفافية. توضّح هذه الصفحة بالتفصيل ما نجمعه، ولماذا نجمعه، وكيف تُستخدم، ومن يطّلع عليها، وما هي حقوقك.',
      sections: [
        { icon: Database, h: '1. البيانات التي نجمعها', p: 'نجمع: (أ) بيانات الحساب — الاسم، رقم الهاتف، البريد الإلكتروني، كلمة مرور مُشفّرة، تاريخ الميلاد. (ب) بيانات الطلب — عنوان التوصيل، تاريخ الطلبات، طريقة الدفع، ملاحظات المنتج. (ج) بيانات تقنية — نوع الجهاز، نظام التشغيل، نسخة المتصفح، عنوان IP، اللغة، المنطقة الزمنية. (د) بيانات تفاعلية — صفحات تزورها، منتجات تشاهدها، نتائج الألعاب والمسابقات.' },
        { icon: UserCheck, h: '2. كيف نستخدم بياناتك', p: 'نستخدم بياناتك لـ: معالجة وتسليم الطلبات، التحقق من الهوية لمنع الاحتيال، إرسال إشعارات الشحن وحالة الطلب، تحسين تجربة التسوق وتخصيص العروض، الدعم الفني، المحاسبة الضريبية والامتثال القانوني، تحليلات إحصائية مجمّعة (دون كشف هويتك) لتطوير المنصة.' },
        { icon: Globe, h: '3. مشاركة البيانات', p: 'لا نبيع بياناتك لأي طرف ثالث — أبداً. نُشاركها فقط مع: شركاء التوصيل (لتسليم طلبك)، بوابات الدفع المعتمدة (لإتمام المعاملات)، مزوّدي البنية التقنية (Supabase, Cloudflare) ضمن اتفاقيات سرية صارمة، الجهات الحكومية عند طلب قانوني رسمي فقط.' },
        { icon: Cookie, h: '4. ملفات تعريف الارتباط (Cookies)', p: 'نستخدم Cookies ضرورية لتشغيل الموقع (الجلسات، السلة، تفضيل اللغة) وأخرى تحليلية لقياس الأداء. يمكنك إيقاف Cookies من إعدادات متصفحك، لكن قد يؤثر ذلك على عمل بعض الميزات (مثل تذكر تسجيل الدخول).' },
        { icon: Lock, h: '5. حماية البيانات', p: 'نطبّق طبقات حماية متعددة: تشفير TLS/HTTPS لكل الاتصالات، تشفير bcrypt لكلمات المرور، سياسات Row-Level Security (RLS) على قاعدة البيانات، نسخ احتياطية دورية، مراقبة لحظية للأنشطة المشبوهة، ومراجعات أمنية منتظمة.' },
        { icon: Bell, h: '6. الإشعارات والتسويق', p: 'نُرسل إشعارات تتعلق بطلبك (شحن، تسليم) دائماً. أما الرسائل التسويقية والعروض فهي اختيارية — يمكنك إيقافها من إعدادات الحساب أو زر "إلغاء الاشتراك" في كل رسالة.' },
        { icon: Baby, h: '7. خصوصية الأطفال', p: 'خدماتنا موجّهة لمن هم 13 سنة فأكبر. لا نجمع بيانات قاصرين عن قصد. إذا اكتشفنا ذلك سنحذف البيانات فوراً. الأهالي الذين يكتشفون أن طفلهم سجّل لدينا يمكنهم التواصل معنا للحذف.' },
        { icon: Globe, h: '8. النقل الدولي للبيانات', p: 'تُخزَّن بياناتك على خوادم سحابية آمنة قد تقع خارج العراق (ضمن مزوّدين عالميين معتمدين مثل Supabase). جميع عمليات النقل محمية بتشفير وعقود معالجة بيانات قياسية.' },
        { icon: RefreshCw, h: '9. الاحتفاظ بالبيانات', p: 'نحتفظ ببياناتك طوال فترة استخدامك للحساب وحتى 5 سنوات بعد آخر نشاط (لأسباب محاسبية وقانونية)، إلا إذا طلبت الحذف الكامل — في هذه الحالة نحتفظ فقط بالحد الأدنى المطلوب قانونياً.' },
        { icon: UserCheck, h: '10. حقوقك', p: 'لك الحق في: (1) الاطلاع على بياناتك، (2) تصحيحها، (3) حذفها (الحق في النسيان)، (4) الاعتراض على المعالجة، (5) سحب الموافقة في أي وقت، (6) نقل بياناتك لمزوّد آخر. للتنفيذ تواصل معنا عبر WhatsApp: +964 783 845 5220 خلال 30 يوماً نُجيب طلبك.' },
        { icon: RefreshCw, h: '11. تحديثات السياسة', p: 'قد نُحدّث هذه السياسة لتعكس تغييرات في خدماتنا أو القوانين. سنُعلمك بأي تغيير جوهري عبر إشعار في الموقع أو رسالة. استمرارك في الاستخدام بعد التحديث يعني الموافقة.' },
        { icon: Mail, h: '12. التواصل بشأن الخصوصية', p: 'لأي استفسار أو شكوى تتعلق بخصوصيتك: WhatsApp: +964 783 845 5220 — البريد: privacy@levonisiq.com — أو من صفحة "اتصل بنا".' },
      ],
    },
    en: {
      title: 'Privacy Policy',
      desc: 'How LEVONIS collects, uses, and protects your data — a transparent, detailed policy.',
      updated: 'Last updated: 2025-04-25',
      intro: 'At LEVONIS we value your privacy and handle your data with the highest standards of security and transparency. This page details what we collect, why, how it is used, who sees it, and what your rights are.',
      sections: [
        { icon: Database, h: '1. Data We Collect', p: '(a) Account: name, phone, email, hashed password, date of birth. (b) Order: delivery address, order history, payment method, product notes. (c) Technical: device type, OS, browser, IP, language, timezone. (d) Behavioral: pages visited, products viewed, game and competition outcomes.' },
        { icon: UserCheck, h: '2. How We Use Your Data', p: 'To process and deliver orders, verify identity to prevent fraud, send shipping/order updates, improve and personalize experience, technical support, accounting and legal compliance, aggregated analytics (no personal identification) for platform improvement.' },
        { icon: Globe, h: '3. Data Sharing', p: 'We never sell your data. We only share it with: delivery partners (to deliver your order), certified payment gateways (to process payments), infrastructure providers (Supabase, Cloudflare) under strict confidentiality agreements, government bodies only upon valid legal request.' },
        { icon: Cookie, h: '4. Cookies', p: 'We use essential cookies (sessions, cart, language) and analytics cookies to measure performance. You can disable cookies in your browser settings, but some features (like staying logged in) may stop working.' },
        { icon: Lock, h: '5. Data Protection', p: 'Multi-layer protection: TLS/HTTPS encryption for all traffic, bcrypt password hashing, Row-Level Security (RLS) policies on the database, regular backups, real-time anomaly monitoring, and periodic security audits.' },
        { icon: Bell, h: '6. Notifications & Marketing', p: 'Order-related notifications (shipping, delivery) are always sent. Marketing messages and offers are optional — you can turn them off from account settings or the "unsubscribe" link in each message.' },
        { icon: Baby, h: '7. Children’s Privacy', p: 'Our services are intended for users 13+. We do not knowingly collect minors’ data. If discovered we delete it immediately. Parents who find their child registered may contact us for deletion.' },
        { icon: Globe, h: '8. International Data Transfer', p: 'Your data is stored on secure cloud servers that may be located outside Iraq (with global certified providers like Supabase). All transfers are protected by encryption and standard data processing agreements.' },
        { icon: RefreshCw, h: '9. Data Retention', p: 'We keep your data for the duration of your account and up to 5 years after last activity (for accounting and legal reasons), unless you request full deletion — in which case we keep only the minimum legally required.' },
        { icon: UserCheck, h: '10. Your Rights', p: 'You have the right to: (1) access your data, (2) correct it, (3) delete it (right to be forgotten), (4) object to processing, (5) withdraw consent anytime, (6) port your data to another provider. Contact via WhatsApp: +964 783 845 5220 — we respond within 30 days.' },
        { icon: RefreshCw, h: '11. Policy Updates', p: 'We may update this policy to reflect changes in our services or laws. Material changes will be announced via in-site notice or message. Continued use after the update means acceptance.' },
        { icon: Mail, h: '12. Privacy Contact', p: 'For any privacy question or complaint: WhatsApp: +964 783 845 5220 — Email: privacy@levonisiq.com — or via the "Contact Us" page.' },
      ],
    },
    ku: {
      title: 'سیاسەتی تایبەتمەندی',
      desc: 'چۆن LEVONIS داتاکانت کۆدەکاتەوە و دەیپارێزێت.',
      updated: 'دوایین نوێکردنەوە: 2025-04-25',
      intro: 'لە LEVONIS داتاکانت بەرز ڕێز دەگرین و بە بەرزترین ستانداردی پاراستن مامەڵەی لەگەڵ دەکەین.',
      sections: [
        { icon: Database, h: '١. داتای کۆکراوە', p: 'ناو، ژمارە، ئیمەیڵ، ووشەی نهێنی شفرەکراو، ناونیشان، مێژووی داواکاری، زانیاری ئامێر و IP.' },
        { icon: UserCheck, h: '٢. چۆن بەکاری دەهێنین', p: 'بۆ پرۆسەکردنی داواکاری، ناردنی ئاگادارکردنەوە، باشترکردنی ئەزموون، پشتگیری و بەرپرسیاریەتی یاسایی.' },
        { icon: Globe, h: '٣. هاوبەشکردن', p: 'داتاکانت نافرۆشین. تەنها لەگەڵ هاوبەشانی گەیاندن و پارەدان دەیناردین.' },
        { icon: Cookie, h: '٤. کوکیەکان', p: 'بۆ بەکارهێنانی پێویست (جێگیری لۆگین، سەبەتە، زمان) و شیکاری.' },
        { icon: Lock, h: '٥. پاراستن', p: 'شفرەکردنی TLS/HTTPS، bcrypt بۆ ووشەی نهێنی، RLS لە دیتابەیس و چاودێری بەردەوام.' },
        { icon: Bell, h: '٦. ئاگادارکردنەوە', p: 'ئاگادارکردنەوەی داواکاری هەمیشە دەنێردرێن. پەیامی بازرگانی هەڵبژاردەیە.' },
        { icon: Baby, h: '٧. منداڵان', p: 'خزمەتگوزاریەکان بۆ ١٣ ساڵ بەرەو سەرە.' },
        { icon: Globe, h: '٨. گواستنەوەی نێودەوڵەتی', p: 'داتاکان لە سێرڤەرە جیهانییە متمانەپێکراوەکاندا دادەنرێن.' },
        { icon: RefreshCw, h: '٩. ماوەی هەڵگرتن', p: 'بۆ ماوەی بەکارهێنان و ٥ ساڵ دوای کۆتا چالاکی.' },
        { icon: UserCheck, h: '١٠. مافەکانت', p: 'مافی بینین، چاککردن، سڕینەوە، گەڕاندنەوەی ڕەزامەندی و گواستنەوەی داتا.' },
        { icon: RefreshCw, h: '١١. نوێکردنەوە', p: 'دەکرێت ئەم سیاسەتە بنوێکرێتەوە. ئاگادارت دەکەینەوە.' },
        { icon: Mail, h: '١٢. پەیوەندی', p: 'WhatsApp: +964 783 845 5220 — privacy@levonisiq.com' },
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
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="glass-icon-btn w-11 h-11" aria-hidden="true">
              <ShieldCheck className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{c.title}</h1>
          </div>
          <p className="text-muted-foreground mb-2">{c.desc}</p>
          <p className="text-xs text-foreground/60">{c.updated}</p>
        </header>

        <section className="rounded-2xl glass-tile glass-edge-top p-5 md:p-6 mb-6">
          <p className="text-foreground/80 leading-relaxed">{c.intro}</p>
        </section>

        <div className="space-y-4">
          {c.sections.map((s, i) => {
            const Icon = s.icon;
            return (
              <section key={i} className="rounded-2xl glass-tile p-5">
                <div className="flex items-start gap-3 mb-2">
                  <div className="glass-icon-btn w-9 h-9 shrink-0" aria-hidden="true">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold text-foreground pt-1.5">{s.h}</h2>
                </div>
                <p className="text-foreground/80 leading-relaxed">{s.p}</p>
              </section>
            );
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link to="/terms" className="text-primary hover:underline">{language === 'en' ? 'Terms' : language === 'ku' ? 'مەرجەکان' : 'الشروط والأحكام'}</Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/faq" className="text-primary hover:underline">{language === 'en' ? 'FAQ' : language === 'ku' ? 'پرسیار' : 'الأسئلة الشائعة'}</Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/about" className="text-primary hover:underline">{language === 'en' ? 'About' : language === 'ku' ? 'دەربارە' : 'من نحن'}</Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/download-app" className="text-primary hover:underline">{language === 'en' ? 'Download App' : language === 'ku' ? 'دابگرە' : 'تحميل التطبيق'}</Link>
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Privacy;
