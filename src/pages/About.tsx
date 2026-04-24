import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { organizationLd, breadcrumbLd } from '@/lib/seo/structured';
import { Package, Truck, ShieldCheck, Users, Gamepad2, Printer } from 'lucide-react';

const About = () => {
  const { language } = useLanguage();

  const t = {
    ar: {
      title: 'من نحن',
      desc: 'LEVONIS — متجر عراقي رائد متخصص في طابعات 3D، الأجهزة الذكية، الإلكترونيات، ومجتمع التجار. ضمان رسمي وتوصيل لجميع المحافظات.',
      hero: 'مرحباً بك في LEVONIS',
      sub: 'وجهتك الأولى للتقنية في العراق',
      story: 'قصتنا',
      storyText:
        'انطلق LEVONIS برؤية واضحة: تقديم منتجات تقنية أصلية بأسعار منافسة لكل بيت عراقي. نجمع بين تجربة تسوق سلسة، ضمان رسمي، وتوصيل سريع لجميع المحافظات. نحن أكثر من متجر — نحن منصة متكاملة تضم متجر التجار، الألعاب، طابعات 3D، نظام الولاء، والكثير.',
      what: 'ماذا نقدّم',
      services: [
        { icon: Printer, title: 'طابعات 3D', text: 'طابعات Bambu Lab وغيرها مع خيوط، إكسسوارات، وضمان كامل.' },
        { icon: Package, title: 'إلكترونيات وأجهزة ذكية', text: 'هواتف، إكسسوارات، أجهزة منزلية بأسعار تنافسية.' },
        { icon: Users, title: 'مجتمع التجار', text: 'منصة تربط المشترين بتجار محليين موثوقين بنظام دفع آمن.' },
        { icon: Gamepad2, title: 'ألعاب ومكافآت', text: 'العب لتربح نقاط وتذاكر وقسائم خصم حقيقية.' },
        { icon: Truck, title: 'توصيل لكل العراق', text: 'استلام من المخزن، توصيل اعتيادي، أو توصيل شخصي.' },
        { icon: ShieldCheck, title: 'ضمان وأمان', text: 'ضمان رسمي على المنتجات وحماية للمدفوعات والبيانات.' },
      ],
      vision: 'رؤيتنا',
      visionText:
        'أن نكون المنصة التقنية الأولى في العراق، نمكّن الأفراد والتجار، ونقدم تجربة شراء تليق بطموحاتهم.',
      contact: 'تواصل معنا',
      contactText: 'WhatsApp: +964 783 845 5220 — متوفرون يومياً للرد على استفساراتك.',
    },
    en: {
      title: 'About Us',
      desc: 'LEVONIS — Iraq’s leading store for 3D printers, smart devices, electronics, and merchant marketplace. Official warranty & nationwide delivery.',
      hero: 'Welcome to LEVONIS',
      sub: 'Your #1 tech destination in Iraq',
      story: 'Our Story',
      storyText:
        'LEVONIS was built on a clear vision: deliver authentic tech products at competitive prices to every Iraqi home. We combine a smooth shopping experience, official warranty, and fast nationwide delivery. We are more than a store — we are a full platform with a merchant marketplace, games, 3D printers, loyalty program, and much more.',
      what: 'What We Offer',
      services: [
        { icon: Printer, title: '3D Printers', text: 'Bambu Lab and other printers with filaments, accessories, and full warranty.' },
        { icon: Package, title: 'Electronics & Smart Devices', text: 'Phones, accessories, and home appliances at competitive prices.' },
        { icon: Users, title: 'Merchant Marketplace', text: 'Platform connecting buyers with trusted local merchants and secure payments.' },
        { icon: Gamepad2, title: 'Games & Rewards', text: 'Play to earn real points, tickets, and discount coupons.' },
        { icon: Truck, title: 'Iraq-wide Delivery', text: 'Pickup, standard delivery, or personal delivery options.' },
        { icon: ShieldCheck, title: 'Warranty & Safety', text: 'Official product warranty and secure payments & data.' },
      ],
      vision: 'Our Vision',
      visionText:
        'To be Iraq’s #1 tech platform, empowering people and merchants with a shopping experience worthy of their ambition.',
      contact: 'Contact Us',
      contactText: 'WhatsApp: +964 783 845 5220 — available daily for your inquiries.',
    },
    ku: {
      title: 'دەربارەی ئێمە',
      desc: 'LEVONIS — فرۆشگای پێشەنگ لە عێراق بۆ پرینتەری 3D، ئامێری زیرەک، ئەلیکترۆنیات و بازاڕی بازرگانان. گەرەنتی فەرمی و گەیاندن بۆ هەموو پارێزگاکان.',
      hero: 'بەخێربێیت بۆ LEVONIS',
      sub: 'یەکەم شوێنی تەکنەلۆجیات لە عێراق',
      story: 'چیرۆکمان',
      storyText:
        'LEVONIS بە بینایەکی ڕوون دەستی پێکرد: پێشکەشکردنی بەرهەمی ڕەسەن بە نرخی گونجاو بۆ هەر ماڵێکی عێراقی. ئێمە تەنها فرۆشگا نین — پلاتفۆڕمێکی تەواوین.',
      what: 'چی پێشکەش دەکەین',
      services: [
        { icon: Printer, title: 'پرینتەری 3D', text: 'Bambu Lab و پرینتەری دیکە لەگەڵ خشتە و گەرەنتی تەواو.' },
        { icon: Package, title: 'ئەلیکترۆنیات', text: 'مۆبایل و ئامێری ماڵ بە نرخی گونجاو.' },
        { icon: Users, title: 'بازاڕی بازرگانان', text: 'پلاتفۆڕمێک بۆ بەستنەوەی کڕیار بە بازرگانانی متمانەپێکراو.' },
        { icon: Gamepad2, title: 'یاری و خەڵات', text: 'یاری بکە بۆ بەدەستهێنانی خاڵ و تکێت و کوپۆن.' },
        { icon: Truck, title: 'گەیاندن', text: 'وەرگرتن لە کۆگا، گەیاندنی ئاسایی یان تایبەت.' },
        { icon: ShieldCheck, title: 'گەرەنتی', text: 'گەرەنتی فەرمی و پاراستنی پارە و زانیاری.' },
      ],
      vision: 'بینایمان',
      visionText: 'ببینە یەکەم پلاتفۆڕمی تەکنەلۆجی لە عێراق.',
      contact: 'پەیوەندیمان پێوە بکە',
      contactText: 'WhatsApp: +964 783 845 5220',
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';

  return (
    <div className="min-h-screen" dir={dir}>
      <SEO
        title={t.title}
        description={t.desc}
        url="https://levonisiq.com/about"
        jsonLd={[
          organizationLd(),
          breadcrumbLd([
            { name: 'Home', url: '/' },
            { name: t.title, url: '/about' },
          ]),
        ]}
      />
      <main className="container mx-auto px-4 py-10 max-w-5xl">
        <header className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-extrabold text-foreground mb-3">{t.hero}</h1>
          <p className="text-lg text-muted-foreground">{t.sub}</p>
        </header>

        <section className="rounded-2xl glass-panel p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t.story}</h2>
          <p className="text-foreground/80 leading-relaxed">{t.storyText}</p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-5 text-center">{t.what}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.services.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-2xl glass-panel p-5 hover:border-primary/40 transition-colors">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl glass-panel p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t.vision}</h2>
          <p className="text-foreground/80 leading-relaxed">{t.visionText}</p>
        </section>

        <section className="rounded-2xl glass-panel p-6 md:p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t.contact}</h2>
          <p className="text-foreground/80">{t.contactText}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/privacy" className="text-primary hover:underline">{language === 'en' ? 'Privacy Policy' : language === 'ku' ? 'سیاسەتی تایبەتمەندی' : 'سياسة الخصوصية'}</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/terms" className="text-primary hover:underline">{language === 'en' ? 'Terms of Use' : language === 'ku' ? 'مەرجەکانی بەکارهێنان' : 'الشروط والأحكام'}</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/faq" className="text-primary hover:underline">{language === 'en' ? 'FAQ' : language === 'ku' ? 'پرسیارە دووبارەکان' : 'الأسئلة الشائعة'}</Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default About;
