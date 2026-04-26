import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { organizationLd, breadcrumbLd } from '@/lib/seo/structured';
import {
  Package, Truck, ShieldCheck, Users, Gamepad2, Printer,
  Award, Headphones, Globe, Smartphone, Heart, Sparkles, Download, MapPin
} from 'lucide-react';

const About = () => {
  const { language } = useLanguage();

  const t = {
    ar: {
      title: 'من نحن',
      desc: 'LEVONIS — متجر عراقي متخصص في طابعات 3D (Bambu Lab وطابعات Resin) مع جميع المواد والملحقات، إضافة إلى شحن الأجهزة الإلكترونية بأرخص الأسعار. ضمان رسمي وتوصيل لكل المحافظات.',
      hero: 'مرحباً بك في LEVONIS',
      sub: 'متخصصون في طابعات 3D — Bambu Lab و Resin ومواد الطباعة',
      story: 'قصتنا',
      storyText:
        'انطلق LEVONIS من بغداد برؤية واضحة: أن نكون المرجع الأول في العراق لكل ما يخص الطباعة ثلاثية الأبعاد. نحن وكلاء ومتخصصون في طابعات Bambu Lab وطابعات الـ Resin، ونوفّر مواد الـ Filaments بأنواعها (PLA, PETG, ABS, TPU وغيرها)، ومواد الـ Resin، إلى جانب جميع الإكسسوارات وقطع الغيار التي يحتاجها صنّاع المحتوى والهواة والمحترفون. وإلى جانب تخصصنا الأساسي، نقدّم خدمة شحن الأجهزة الإلكترونية من الخارج بأرخص الأسعار وأسرع وقت ممكن. اليوم، LEVONIS منظومة متكاملة: طابعات ومواد، صيانة معتمدة، شحن إلكترونيات، نظام نقاط ومكافآت، ومجتمع نابض بالحياة.',
      what: 'ماذا نقدّم',
      services: [
        { icon: Printer, title: 'طابعات Bambu Lab 3D', text: 'وكلاء معتمدون لطابعات Bambu Lab بكل موديلاتها، مع ضمان رسمي وصيانة محلية واستشارات فنية.' },
        { icon: Sparkles, title: 'طابعات Resin ومواد الطباعة', text: 'طابعات Resin عالية الدقة مع راتنجات (Resin) أصلية بألوان وخصائص متعددة لكل المشاريع.' },
        { icon: Package, title: 'مواد Filaments والإكسسوارات', text: 'تشكيلة واسعة من خيوط الطباعة (PLA, PETG, ABS, TPU, Silk, Wood) مع نوزل، أحزمة، ألواح بناء، وقطع غيار.' },
        { icon: Truck, title: 'شحن إلكترونيات بأرخص الأسعار', text: 'خدمة شحن الأجهزة الإلكترونية من الخارج (هواتف، لابتوبات، ملحقات) بأرخص الأسعار وأسرع توصيل لكل المحافظات.' },
        { icon: ShieldCheck, title: 'ضمان رسمي وصيانة', text: 'ضمان معتمد على الطابعات، صيانة محلية بقطع غيار أصلية، وتشفير كامل للمدفوعات.' },
        { icon: Headphones, title: 'دعم فني متخصص', text: 'فريق دعم باللغة العربية متخصص في الطباعة 3D، متاح يومياً عبر WhatsApp و Telegram.' },
        { icon: Users, title: 'مجتمع المبدعين والتجار', text: 'منصة تجمع صنّاع الـ 3D Printing والتجار، مع طلبات طباعة مخصصة وخدمات تبادل الخبرات.' },
        { icon: Award, title: 'برنامج ولاء ومكافآت', text: 'بطاقات ولاء بمستويات متعددة، نقاط على كل عملية شراء، وخصومات حصرية للمشتركين.' },
        { icon: Smartphone, title: 'تطبيق Android رسمي', text: 'تطبيق سريع لتصفّح الكتالوج وطلب المواد والطابعات وتتبّع الشحنات لحظياً.' },
      ],
      values: 'قيمنا',
      valuesList: [
        { icon: Heart, t: 'الثقة', d: 'منتجات أصلية ووعود نُنفّذها — بدون مفاجآت.' },
        { icon: Sparkles, t: 'الابتكار', d: 'نُحدّث منصتنا باستمرار ونقدّم تجارب لم يسبقها متجر عراقي.' },
        { icon: Users, t: 'المجتمع', d: 'ندعم التجار المحليين ونبني علاقة طويلة الأمد مع كل عميل.' },
        { icon: ShieldCheck, t: 'الجودة', d: 'كل منتج نختاره يمر بفحص دقيق قبل الطرح.' },
      ],
      vision: 'رؤيتنا',
      visionText:
        'أن نكون المنصة التقنية الأولى في العراق والشرق الأوسط، نُمكّن الأفراد والتجار، ونرفع مستوى تجربة التسوق الإلكتروني لتواكب أرقى المعايير العالمية.',
      mission: 'مهمتنا',
      missionText:
        'نُتيح للجميع الوصول إلى أحدث المنتجات التقنية بأسعار عادلة، مع خدمة استثنائية وضمان حقيقي، وتمكين التجار المحليين من النمو في بيئة رقمية متقدمة وآمنة.',
      stats: 'بالأرقام',
      statsList: [
        { v: '+18', l: 'محافظة نخدمها' },
        { v: '+1000', l: 'منتج متوفر' },
        { v: '+500', l: 'تاجر معتمد' },
        { v: '24/7', l: 'متابعة الطلبات' },
      ],
      coverage: 'نخدم كل العراق',
      coverageText: 'بغداد، البصرة، أربيل، السليمانية، نينوى، النجف، كربلاء، بابل، الأنبار، ديالى، صلاح الدين، كركوك، دهوك، ميسان، القادسية، المثنى، ذي قار، واسط.',
      app: 'حمّل تطبيق LEVONIS',
      appText: 'تجربة أسرع، إشعارات فورية، ومزايا حصرية للتطبيق. متاح الآن لأجهزة Android.',
      appBtn: 'تحميل التطبيق (APK)',
      contact: 'تواصل معنا',
      contactText: 'WhatsApp: +964 783 845 5220 — متوفرون يومياً للرد على استفساراتك.',
    },
    en: {
      title: 'About Us',
      desc: 'LEVONIS — Iraq’s specialist for 3D printing: Bambu Lab printers, Resin printers, filaments, resins and accessories. Plus the cheapest electronics shipping in the country. Official warranty & nationwide delivery.',
      hero: 'Welcome to LEVONIS',
      sub: '3D Printing specialists — Bambu Lab, Resin printers & materials',
      story: 'Our Story',
      storyText:
        'LEVONIS launched from Baghdad with a clear vision: become Iraq’s go-to destination for everything 3D printing. We are authorized specialists in Bambu Lab and Resin printers, and we stock the full range of materials — filaments (PLA, PETG, ABS, TPU and more), resins, plus all the accessories and spare parts that makers, hobbyists and professionals need. Alongside our core 3D specialty, we run an electronics shipping service that brings devices from abroad at the lowest prices and fastest possible delivery. Today LEVONIS is a complete ecosystem: printers and materials, certified maintenance, electronics shipping, a points & rewards program, and a vibrant maker community.',
      what: 'What We Offer',
      services: [
        { icon: Printer, title: 'Bambu Lab 3D Printers', text: 'Authorized dealer for the full Bambu Lab line-up with official warranty, local service and expert advice.' },
        { icon: Sparkles, title: 'Resin Printers & Resins', text: 'High-precision Resin printers with a wide selection of original resins for every project.' },
        { icon: Package, title: 'Filaments & Accessories', text: 'Full range of filaments (PLA, PETG, ABS, TPU, Silk, Wood) with nozzles, belts, build plates and spare parts.' },
        { icon: Truck, title: 'Cheapest Electronics Shipping', text: 'We ship electronics from abroad — phones, laptops, accessories — at the lowest prices and fastest delivery to all governorates.' },
        { icon: ShieldCheck, title: 'Warranty & Maintenance', text: 'Certified warranty on printers, local maintenance with original parts, and full payment encryption.' },
        { icon: Headphones, title: 'Specialist Support', text: 'Arabic-speaking support team specialized in 3D printing, available daily via WhatsApp and Telegram.' },
        { icon: Users, title: 'Makers & Merchants Community', text: 'A platform that connects 3D-printing creators and merchants, with custom print requests and knowledge sharing.' },
        { icon: Award, title: 'Loyalty & Rewards', text: 'Multi-tier loyalty cards, points on every purchase and exclusive member discounts.' },
        { icon: Smartphone, title: 'Official Android App', text: 'Fast app to browse the catalog, order materials and printers, and track shipments live.' },
      ],
      values: 'Our Values',
      valuesList: [
        { icon: Heart, t: 'Trust', d: 'Authentic products and promises we keep — no surprises.' },
        { icon: Sparkles, t: 'Innovation', d: 'We constantly update our platform with experiences no Iraqi store had before.' },
        { icon: Users, t: 'Community', d: 'We empower local merchants and build long-term relationships with every customer.' },
        { icon: ShieldCheck, t: 'Quality', d: 'Every product is rigorously vetted before listing.' },
      ],
      vision: 'Our Vision',
      visionText:
        'To be the #1 tech platform in Iraq and the Middle East, empowering people and merchants and elevating e-commerce to global standards.',
      mission: 'Our Mission',
      missionText:
        'Make the latest tech accessible to everyone at fair prices, with exceptional service and a real warranty, while empowering local merchants to grow in a secure, advanced digital environment.',
      stats: 'In Numbers',
      statsList: [
        { v: '+18', l: 'Governorates served' },
        { v: '+1000', l: 'Products in stock' },
        { v: '+500', l: 'Verified merchants' },
        { v: '24/7', l: 'Order monitoring' },
      ],
      coverage: 'We serve all of Iraq',
      coverageText: 'Baghdad, Basra, Erbil, Sulaymaniyah, Nineveh, Najaf, Karbala, Babil, Anbar, Diyala, Salah al-Din, Kirkuk, Duhok, Maysan, Al-Qadisiyah, Muthanna, Dhi Qar, Wasit.',
      app: 'Download the LEVONIS App',
      appText: 'Faster experience, instant notifications, and exclusive in-app perks. Available now for Android.',
      appBtn: 'Download App (APK)',
      contact: 'Contact Us',
      contactText: 'WhatsApp: +964 783 845 5220 — available daily for your inquiries.',
    },
    ku: {
      title: 'دەربارەی ئێمە',
      desc: 'LEVONIS — پسپۆڕی پرینتەری 3D لە عێراق: Bambu Lab، پرینتەری Resin، Filaments و کەرەستە. هەروەها گەیاندنی ئەلیکترۆنیات بە هەرزانترین نرخ.',
      hero: 'بەخێربێیت بۆ LEVONIS',
      sub: 'پسپۆڕانی پرینتەری 3D — Bambu Lab، Resin و کەرەستە',
      story: 'چیرۆکمان',
      storyText:
        'LEVONIS لە بەغدا دەستی پێکرد بە بینایەکی ڕوون: ببینە یەکەم سەرچاوە لە عێراق بۆ هەموو شتێکی پرینتەری 3D. ئێمە پسپۆڕی Bambu Lab و پرینتەری Resin ئین، هەموو جۆرە Filaments (PLA, PETG, ABS, TPU) و Resins و ئەکسسوار و پارچەی یەدەکمان هەیە. لەگەڵ ئەوەشدا خزمەتگوزاری گەیاندنی ئەلیکترۆنیات لە دەرەوە بە هەرزانترین نرخ پێشکەش دەکەین.',
      what: 'چی پێشکەش دەکەین',
      services: [
        { icon: Printer, title: 'پرینتەری Bambu Lab 3D', text: 'بریکاری فەرمی Bambu Lab بە گەرەنتی و چاککردنەوەی ناوخۆیی.' },
        { icon: Sparkles, title: 'پرینتەری Resin و ڕەزین', text: 'پرینتەری Resin بە دیقەتی بەرز و ڕەزینی ڕەسەن.' },
        { icon: Package, title: 'Filaments و کەرەستە', text: 'PLA, PETG, ABS, TPU، نۆزڵ و پارچەی یەدەک.' },
        { icon: Truck, title: 'گەیاندنی ئەلیکترۆنیات بە هەرزانی', text: 'گەیاندنی مۆبایل و لاپتۆپ لە دەرەوە بە هەرزانترین نرخ.' },
        { icon: ShieldCheck, title: 'گەرەنتی و چاککردنەوە', text: 'گەرەنتی فەرمی و پاراستنی پارە و زانیاری.' },
        { icon: Headphones, title: 'پشتگیری پسپۆڕ', text: 'تیمی پشتگیری پسپۆڕ لە پرینتی 3D ڕۆژانە.' },
        { icon: Users, title: 'کۆمەڵگای داهێنەران', text: 'پلاتفۆڕم بۆ بەستنەوەی داهێنەران و بازرگانان.' },
        { icon: Award, title: 'بەرنامەی دڵسۆزی', text: 'کارتی دڵسۆزی و خاڵ لەسەر هەموو کڕینێک.' },
        { icon: Smartphone, title: 'ئەپی ئەندرۆید', text: 'ئەپێکی خێرا بۆ کڕینی ئاسانتر.' },
      ],
      values: 'نرخەکانمان',
      valuesList: [
        { icon: Heart, t: 'متمانە', d: 'بەرهەمی ڕەسەن و بەڵێنی جێبەجێکراو.' },
        { icon: Sparkles, t: 'داهێنان', d: 'پلاتفۆڕمی بەردەوام نوێبووەوە.' },
        { icon: Users, t: 'کۆمەڵگا', d: 'پشتگیری بازرگانانی ناوخۆیی.' },
        { icon: ShieldCheck, t: 'کوالیتی', d: 'هەموو بەرهەمێک بە دیقەت تاقیدەکرێتەوە.' },
      ],
      vision: 'بینایمان',
      visionText: 'ببینە یەکەم پلاتفۆڕمی تەکنەلۆجی لە عێراق و ڕۆژهەڵاتی ناوەڕاست.',
      mission: 'ئەرکمان',
      missionText: 'دەستڕاگەیشتن بە تەکنەلۆجیای نوێ بۆ هەمووان بە نرخی دادپەروەرانە.',
      stats: 'بە ژمارەکان',
      statsList: [
        { v: '+18', l: 'پارێزگا' },
        { v: '+1000', l: 'بەرهەم' },
        { v: '+500', l: 'بازرگان' },
        { v: '24/7', l: 'چاودێری' },
      ],
      coverage: 'خزمەتی هەموو عێراق دەکەین',
      coverageText: 'بەغدا، بەسرە، هەولێر، سلێمانی، نەینەوا، نەجەف، کەربەلا، بابل، ئەنبار، دیالە، سەلاحەدین، کەرکوک، دهۆک، میسان، قادسیە، موسەننا، زی قار، واست.',
      app: 'ئەپی LEVONIS دابگرە',
      appText: 'ئەزموونی خێراتر و ئاگادارکردنەوەی دەستبەجێ. بەردەستە بۆ ئەندرۆید.',
      appBtn: 'دابگرە (APK)',
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

        {/* Story */}
        <section className="rounded-2xl glass-tile glass-edge-top p-6 md:p-8 mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t.story}</h2>
          <p className="text-foreground/80 leading-relaxed">{t.storyText}</p>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {t.statsList.map((s, i) => (
            <div key={i} className="rounded-2xl glass-tile p-4 text-center">
              <div className="text-2xl md:text-3xl font-black text-primary mb-1">{s.v}</div>
              <div className="text-xs md:text-sm text-foreground/70 font-medium">{s.l}</div>
            </div>
          ))}
        </section>

        {/* Services */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-5 text-center">{t.what}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.services.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={i} className="rounded-2xl glass-tile glass-tile-interactive p-5">
                  <div className="glass-icon-btn w-11 h-11 mb-3" aria-hidden="true">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{s.title}</h3>
                  <p className="text-sm text-foreground/75 leading-relaxed">{s.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Vision & Mission */}
        <section className="grid md:grid-cols-2 gap-4 mb-8">
          <div className="rounded-2xl glass-tile glass-edge-top p-6">
            <h2 className="text-xl font-bold text-foreground mb-3">{t.vision}</h2>
            <p className="text-foreground/80 leading-relaxed">{t.visionText}</p>
          </div>
          <div className="rounded-2xl glass-tile glass-edge-top p-6">
            <h2 className="text-xl font-bold text-foreground mb-3">{t.mission}</h2>
            <p className="text-foreground/80 leading-relaxed">{t.missionText}</p>
          </div>
        </section>

        {/* Values */}
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-foreground mb-5 text-center">{t.values}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {t.valuesList.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={i} className="rounded-2xl glass-tile p-4 text-center">
                  <div className="glass-icon-btn w-10 h-10 mx-auto mb-2" aria-hidden="true">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground text-sm mb-1">{v.t}</h3>
                  <p className="text-xs text-foreground/70 leading-relaxed">{v.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Coverage */}
        <section className="rounded-2xl glass-tile glass-edge-top p-6 md:p-8 mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="glass-icon-btn w-10 h-10" aria-hidden="true">
              <Globe className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">{t.coverage}</h2>
          </div>
          <p className="text-foreground/80 leading-relaxed flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" aria-hidden="true" />
            <span>{t.coverageText}</span>
          </p>
        </section>

        {/* Download App CTA */}
        <section className="rounded-2xl glass-tile glass-edge-top p-6 md:p-8 mb-8 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent-red/5 pointer-events-none" aria-hidden="true" />
          <div className="relative">
            <div className="glass-icon-btn w-14 h-14 mx-auto mb-3" aria-hidden="true">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.app}</h2>
            <p className="text-foreground/80 mb-4 max-w-xl mx-auto">{t.appText}</p>
            <Link
              to="/download-app"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold backdrop-blur-xl border border-primary/40 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_24px_-4px_hsl(var(--primary)/0.65)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              {t.appBtn}
            </Link>
          </div>
        </section>

        {/* Contact */}
        <section className="rounded-2xl glass-tile p-6 md:p-8 text-center">
          <h2 className="text-2xl font-bold text-foreground mb-3">{t.contact}</h2>
          <p className="text-foreground/80">{t.contactText}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm">
            <Link to="/privacy" className="text-primary hover:underline">{language === 'en' ? 'Privacy Policy' : language === 'ku' ? 'سیاسەتی تایبەتمەندی' : 'سياسة الخصوصية'}</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/terms" className="text-primary hover:underline">{language === 'en' ? 'Terms of Use' : language === 'ku' ? 'مەرجەکانی بەکارهێنان' : 'الشروط والأحكام'}</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/faq" className="text-primary hover:underline">{language === 'en' ? 'FAQ' : language === 'ku' ? 'پرسیارە دووبارەکان' : 'الأسئلة الشائعة'}</Link>
            <span className="text-muted-foreground">•</span>
            <Link to="/download-app" className="text-primary hover:underline">{language === 'en' ? 'Download App' : language === 'ku' ? 'دابگرە' : 'تحميل التطبيق'}</Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default About;
