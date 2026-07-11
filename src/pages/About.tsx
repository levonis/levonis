import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { organizationLd, breadcrumbLd } from '@/lib/seo/structured';
import {
  Package, Truck, ShieldCheck, Users, Printer, Award, Headphones, Globe, Smartphone,
  Heart, Sparkles, Download, MapPin, ChevronDown, Rocket, Layers, Target, Eye,
  CheckCircle2, ArrowRight, Mail, Phone, MessageCircle,
} from 'lucide-react';

const About = () => {
  const { language } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Live stats from database
  const { data: liveStats } = useQuery({
    queryKey: ['about-live-stats'],
    queryFn: async () => {
      const [products, orders, customers, merchants] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_pricing_updated', true),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'delivered'),
        supabase.from('orders').select('user_id').limit(5000),
        supabase.from('community_customer_profiles_public').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      ]);
      const uniqueCustomers = new Set((customers.data || []).map((o: any) => o.user_id)).size;
      return {
        products: products.count || 0,
        delivered: orders.count || 0,
        customers: uniqueCustomers,
        merchants: merchants.count || 0,
      };
    },
    staleTime: 10 * 60 * 1000,
  });

  const t = {
    ar: {
      title: 'من نحن — LEVONIS',
      desc: 'LEVONIS — متخصصون في طابعات Bambu Lab و Creality و Resin والـ Filaments، مع شحن إلكترونيات بأرخص الأسعار في العراق.',
      hero: 'نحن نطبع المستقبل',
      sub: 'متخصصون في طابعات 3D — Bambu Lab، Creality, Resin، Filaments وكل ما يحتاجه صنّاع المحتوى',
      ctaShop: 'تسوّق المنتجات',
      ctaContact: 'تواصل معنا',
      story: 'قصتنا',
      storyText: 'انطلق LEVONIS من بابل برؤية واضحة: أن نكون المرجع الأول في العراق لكل ما يخص الطباعة ثلاثية الأبعاد. ونكون وكلاء ومتخصصون في طابعات Bambu Lab و Creality وطابعات الـ Resin، ونوفّر مواد الـ Filaments بأنواعها، ومواد الـ Resin، إلى جانب جميع الإكسسوارات وقطع الغيار. وإلى جانب تخصصنا الأساسي، نقدّم خدمة شحن الأجهزة الإلكترونية من الخارج بأرخص الأسعار وأسرع وقت ممكن.',
      timeline: 'محطات في رحلتنا',
      timelineList: [
        { year: '2025', title: 'الانطلاقة من بابل', text: 'بدأنا برؤية لتقديم تقنيات الطباعة 3D للمستهلك العراقي.' },
        { year: '2025', title: 'طابعات Bambu Lab', text: 'وفرنا شحن الطابعات Bambu Lab مع خدمة الضمان الرسمي.' },
        { year: '2026', title: 'توسعة المواد والـ Resin', text: 'أضفنا طابعات Resin ومواد Filaments بكل الأنواع والألوان.' },
        { year: '2026', title: 'منصة متكاملة', text: 'أطلقنا التطبيق، نظام النقاط، والمجتمع، وخدمة شحن الإلكترونيات بأرخص الأسعار.' },
      ],
      what: 'تخصصنا الأساسي',
      services: [
        { icon: Printer, title: 'طابعات Bambu Lab و Creality 3D', text: 'نوفر جميع  الموديلات Bambu Lab و Creality مع ضمان رسمي وصيانة محلية واستشارات فنية.' },
        { icon: Sparkles, title: 'طابعات Resin ومواد الطباعة', text: 'طابعات Resin عالية الدقة مع راتنجات أصلية بألوان وخصائص متعددة لكل المشاريع.' },
        { icon: Layers, title: 'مواد Filaments والإكسسوارات', text: 'تشكيلة واسعة من خيوط الطباعة (PLA, PETG, ABS, TPU, Silk, Wood) مع نوزل وقطع غيار.' },
        { icon: Truck, title: 'شحن إلكترونيات بأرخص الأسعار', text: 'خدمة شحن الأجهزة الإلكترونية من الخارج (هواتف، لابتوبات، ملحقات) بأسرع وقت.' },
        { icon: ShieldCheck, title: 'ضمان رسمي وصيانة', text: 'ضمان معتمد على الطابعات، صيانة محلية بقطع غيار أصلية، وتشفير كامل للمدفوعات.' },
        { icon: Headphones, title: 'دعم فني متخصص', text: 'فريق دعم باللغة العربية متخصص في الطباعة 3D، متاح يومياً عبر WhatsApp و Telegram.' },
        { icon: Users, title: 'مجتمع المبدعين والتجار', text: 'منصة تجمع صنّاع 3D Printing والتجار، مع طلبات طباعة مخصصة وتبادل خبرات.' },
        { icon: Award, title: 'برنامج ولاء ومكافآت', text: 'بطاقات ولاء بمستويات متعددة، نقاط على كل عملية شراء، وخصومات حصرية.' },
        { icon: Smartphone, title: 'تطبيق Android رسمي', text: 'تطبيق سريع لتصفّح الكتالوج وطلب المواد والطابعات وتتبّع الشحنات لحظياً.' },
      ],
      values: 'قيمنا',
      valuesList: [
        { icon: Heart, t: 'الثقة', d: 'منتجات أصلية ووعود نُنفّذها بدون مفاجآت.' },
        { icon: Sparkles, t: 'التخصص', d: 'لا نبيع كل شيء — نتخصص فيما نتقنه: الطباعة 3D.' },
        { icon: Users, t: 'المجتمع', d: 'ندعم المبدعين العراقيين ونبني علاقة طويلة الأمد.' },
        { icon: ShieldCheck, t: 'الجودة', d: 'كل منتج نختاره يمر بفحص دقيق قبل الطرح.' },
      ],
      vision: 'رؤيتنا',
      visionText: 'أن نكون المنصة المتخصصة الأولى في العراق والشرق الأوسط للطباعة ثلاثية الأبعاد، ونرفع مستوى الإبداع والإنتاج المحلي.',
      mission: 'مهمتنا',
      missionText: 'إتاحة طابعات 3D ومواد الطباعة لكل مبدع ومحترف وهاوٍ في العراق بأسعار عادلة، مع دعم فني متخصص وضمان حقيقي.',
      stats: 'بالأرقام',
      statsLabels: { products: 'منتج في الكتالوج', delivered: 'طلب مُسلّم', customers: 'عميل سعيد', merchants: 'تاجر معتمد' },
      coverage: 'نخدم كل العراق',
      coverageText: 'بغداد، البصرة، أربيل، السليمانية، نينوى، النجف، كربلاء، بابل، الأنبار، ديالى، صلاح الدين، كركوك، دهوك، ميسان، القادسية، المثنى، ذي قار، واسط.',
      faq: 'الأسئلة الشائعة',
      faqList: [
        { q: 'هل جميع المنتجات اصليه منـ Bambu Lab؟', a: 'نعم، جميع الطابعات والاكسسوارات والغيار من Bambu Lab ، ونوفّر الضمان الرسمي والصيانة المحلية لجميع الموديلات.' },
        { q: 'ما أنواع الـ Filaments المتوفرة لديكم؟', a: 'نوفّر تشكيلة واسعة: PLA, PETG, ABS, TPU, PLA Silk, PLA Wood، إضافة لـ Bambu Lab original filaments بألوان متعددة.' },
        { q: 'هل تقدّمون خدمة شحن الإلكترونيات؟', a: 'نعم، نشحن الأجهزة الإلكترونية من الخارج (هواتف، لابتوبات، ملحقات) بأرخص الأسعار وأسرع وقت ممكن لكل المحافظات.' },
        { q: 'كم تستغرق فترة التوصيل؟', a: 'بغداد عادة 1–2 يوم، باقي المحافظات 2–4 أيام. شحن الإلكترونيات من الخارج يستغرق 7–14 يوماً.' },
        { q: 'هل يوجد ضمان على المنتجات؟', a: 'نعم، جميع طابعات Bambu Lab تأتي بضمان وكيل رسمي. الإلكترونيات بضمان حسب نوع المنتج.' },
        { q: 'هل يمكنني طلب طباعة 3D مخصصة؟', a: 'نعم، عبر قسم "طلبات الطباعة" في المجتمع يمكنك إرسال ملف STL أو وصف وسيقدّم لك تجارنا المعتمدون عروضاً.' },
      ],
      app: 'حمّل تطبيق LEVONIS',
      appText: 'تجربة أسرع، إشعارات فورية، ومزايا حصرية للتطبيق. متاح الآن لـ Android.',
      appBtn: 'تحميل التطبيق',
      contact: 'تواصل معنا',
      contactText: 'فريقنا متاح يومياً للرد على استفساراتك',
    },
    en: {
      title: 'About Us — LEVONIS',
      desc: 'LEVONIS — Iraq’s 3D printing specialists: Bambu Lab, Creality, Resin printers, filaments and accessories. Plus the cheapest electronics shipping.',
      hero: 'We Print The Future',
      sub: '3D Printing specialists — Bambu Lab, Creality, Resin, Filaments and everything makers need',
      ctaShop: 'Shop Products',
      ctaContact: 'Contact Us',
      story: 'Our Story',
      storyText: 'LEVONIS launched from Baghdad with a clear vision: become Iraq’s go-to destination for everything 3D printing. We are authorized specialists in Bambu Lab, Creality, and Resin printers, and we stock filaments, resins, accessories and spare parts. Alongside our core 3D specialty, we run an electronics shipping service that brings devices from abroad at the lowest prices and fastest delivery.',
      timeline: 'Our Journey',
      timelineList: [
        { year: '2022', title: 'Launched in Baghdad', text: 'Started with a vision to bring 3D printing technology to the Iraqi consumer.' },
        { year: '2023', title: 'Authorized Bambu Lab Dealer', text: 'Became official Bambu Lab dealer with full warranty service.' },
        { year: '2024', title: 'Resin & Filaments Expansion', text: 'Added Resin printers and a full range of Filaments materials and colors.' },
        { year: '2025', title: 'Complete Platform', text: 'Launched the app, points system, community, and our cheapest electronics shipping service.' },
      ],
      what: 'Our Core Specialty',
      services: [
        { icon: Printer, title: 'Bambu Lab & Creality 3D Printers', text: 'Authorized dealer for Bambu Lab and Creality line-up with official warranty and local service.' },
        { icon: Sparkles, title: 'Resin Printers & Resins', text: 'High-precision Resin printers with original resins for every project.' },
        { icon: Layers, title: 'Filaments & Accessories', text: 'Full range of filaments (PLA, PETG, ABS, TPU, Silk, Wood) with nozzles and spare parts.' },
        { icon: Truck, title: 'Cheapest Electronics Shipping', text: 'We ship phones, laptops and accessories from abroad at the lowest prices.' },
        { icon: ShieldCheck, title: 'Warranty & Maintenance', text: 'Certified warranty on printers, local maintenance with original parts.' },
        { icon: Headphones, title: 'Specialist Support', text: 'Arabic-speaking team specialized in 3D printing, available daily.' },
        { icon: Users, title: 'Makers & Merchants', text: 'A platform connecting 3D-printing creators and merchants with custom requests.' },
        { icon: Award, title: 'Loyalty & Rewards', text: 'Multi-tier loyalty cards, points on every purchase, exclusive member discounts.' },
        { icon: Smartphone, title: 'Official Android App', text: 'Fast app to browse, order materials and printers, and track shipments live.' },
      ],
      values: 'Our Values',
      valuesList: [
        { icon: Heart, t: 'Trust', d: 'Authentic products and promises we keep.' },
        { icon: Sparkles, t: 'Specialty', d: 'We don’t sell everything — we master 3D printing.' },
        { icon: Users, t: 'Community', d: 'We empower Iraqi creators with long-term relationships.' },
        { icon: ShieldCheck, t: 'Quality', d: 'Every product is rigorously vetted before listing.' },
      ],
      vision: 'Our Vision',
      visionText: 'To be the #1 specialized 3D printing platform in Iraq and the Middle East, raising local creativity and production.',
      mission: 'Our Mission',
      missionText: 'Make 3D printers and printing materials accessible to every creator in Iraq at fair prices, with specialist support and a real warranty.',
      stats: 'In Numbers',
      statsLabels: { products: 'Products in catalog', delivered: 'Delivered orders', customers: 'Happy customers', merchants: 'Verified merchants' },
      coverage: 'We Serve All of Iraq',
      coverageText: 'Baghdad, Basra, Erbil, Sulaymaniyah, Nineveh, Najaf, Karbala, Babil, Anbar, Diyala, Salah al-Din, Kirkuk, Duhok, Maysan, Al-Qadisiyah, Muthanna, Dhi Qar, Wasit.',
      faq: 'Frequently Asked Questions',
      faqList: [
        { q: 'Are you an authorized Bambu Lab dealer?', a: 'Yes, we are an official Bambu Lab dealer in Iraq with full warranty and local service.' },
        { q: 'What filament types do you stock?', a: 'PLA, PETG, ABS, TPU, PLA Silk, PLA Wood, plus original Bambu Lab filaments in many colors.' },
        { q: 'Do you offer electronics shipping?', a: 'Yes, we ship electronics (phones, laptops, accessories) from abroad at the lowest prices to all governorates.' },
        { q: 'How long does delivery take?', a: 'Baghdad 1–2 days, other governorates 2–4 days. International electronics shipping takes 7–14 days.' },
        { q: 'Is there a warranty?', a: 'Yes, all Bambu Lab printers come with official dealer warranty. Electronics warranty depends on the product.' },
        { q: 'Can I request custom 3D prints?', a: 'Yes, via the "Print Requests" community section you can submit STL files or descriptions and receive offers.' },
      ],
      app: 'Download the LEVONIS App',
      appText: 'Faster experience, instant notifications, and exclusive in-app perks. Available now for Android.',
      appBtn: 'Download App',
      contact: 'Contact Us',
      contactText: 'Our team is available daily to answer your questions',
    },
    ku: {
      title: 'دەربارەی ئێمە — LEVONIS',
      desc: 'LEVONIS — پسپۆڕی پرینتەری 3D لە عێراق: Bambu Lab، Creality، Resin، Filaments و گەیاندنی ئەلیکترۆنیات بە هەرزانترین نرخ.',
      hero: 'ئێمە داهاتوو دەپرینت دەکەین',
      sub: 'پسپۆڕانی پرینتەری 3D — Bambu Lab، Creality، Resin و Filaments',
      ctaShop: 'بەرهەمەکان',
      ctaContact: 'پەیوەندی',
      story: 'چیرۆکمان',
      storyText: 'LEVONIS لە بەغدا دەستی پێکرد بە بینایەکی ڕوون: ببینە یەکەم سەرچاوەی پرینتی 3D لە عێراق. ئێمە بریکاری پسپۆڕی Bambu Lab و Creality و پرینتەری Resin ین، هەروەها هەموو جۆرە Filaments و ڕەزین و کەرەستە و پارچەی یەدەکمان هەیە. لەگەڵ پسپۆڕی سەرەکیمان، خزمەتی گەیاندنی ئەلیکترۆنیاتمان لە دەرەوە بە هەرزانترین نرخ و خێراترین کات هەیە.',
      timeline: 'گەشتمان',
      timelineList: [
        { year: '2022', title: 'دەستپێکردن لە بەغدا', text: 'بە بینایەکی ڕوون بۆ هێنانی تەکنەلۆجیای 3D.' },
        { year: '2023', title: 'بریکاری Bambu Lab', text: 'بریکاری فەرمی Bambu Lab بە گەرەنتی تەواو.' },
        { year: '2024', title: 'فراوانکردنی Resin و Filaments', text: 'پرینتەری Resin و هەموو جۆرە Filaments زیادکرد.' },
        { year: '2025', title: 'پلاتفۆڕمی تەواو', text: 'ئەپ، خاڵ، کۆمەڵگا و گەیاندنی ئەلیکترۆنیات.' },
      ],
      what: 'پسپۆڕی سەرەکیمان',
      services: [
        { icon: Printer, title: 'پرینتەری Bambu Lab و Creality 3D', text: 'بریکاری فەرمی بە گەرەنتی و چاککردنەوە.' },
        { icon: Sparkles, title: 'پرینتەری Resin', text: 'پرینتەری Resin بە دیقەتی بەرز.' },
        { icon: Layers, title: 'Filaments و کەرەستە', text: 'PLA, PETG, ABS, TPU، نۆزڵ و پارچەی یەدەک.' },
        { icon: Truck, title: 'گەیاندنی ئەلیکترۆنیات', text: 'بە هەرزانترین نرخ لە دەرەوە.' },
        { icon: ShieldCheck, title: 'گەرەنتی', text: 'گەرەنتی فەرمی و چاککردنەوە.' },
        { icon: Headphones, title: 'پشتگیری پسپۆڕ', text: 'تیمی پسپۆڕ لە پرینتی 3D ڕۆژانە.' },
        { icon: Users, title: 'کۆمەڵگا', text: 'بەستنەوەی داهێنەران و بازرگانان.' },
        { icon: Award, title: 'دڵسۆزی', text: 'کارتی دڵسۆزی و خاڵ.' },
        { icon: Smartphone, title: 'ئەپی ئەندرۆید', text: 'ئەپێکی خێرا.' },
      ],
      values: 'نرخەکانمان',
      valuesList: [
        { icon: Heart, t: 'متمانە', d: 'بەرهەمی ڕەسەن و بەڵێنی جێبەجێکراو.' },
        { icon: Sparkles, t: 'پسپۆڕی', d: 'تەنها لەو شتە پسپۆڕین کە دەیزانین.' },
        { icon: Users, t: 'کۆمەڵگا', d: 'پشتگیری داهێنەرانی عێراقی.' },
        { icon: ShieldCheck, t: 'کوالیتی', d: 'هەموو بەرهەمێک تاقیدەکرێتەوە.' },
      ],
      vision: 'بینایمان',
      visionText: 'ببینە یەکەم پلاتفۆڕمی پسپۆڕی پرینتەری 3D لە عێراق و ڕۆژهەڵاتی ناوەڕاست.',
      mission: 'ئەرکمان',
      missionText: 'دەستڕاگەیشتن بە پرینتەری 3D و کەرەستە بۆ هەموو داهێنەرێک بە نرخی دادپەروەرانە.',
      stats: 'بە ژمارە',
      statsLabels: { products: 'بەرهەم', delivered: 'گەیشت', customers: 'کڕیار', merchants: 'بازرگان' },
      coverage: 'خزمەتی هەموو عێراق دەکەین',
      coverageText: 'بەغدا، بەسرە، هەولێر، سلێمانی، نەینەوا، نەجەف، کەربەلا، بابل، ئەنبار، دیالە، سەلاحەدین، کەرکوک، دهۆک، میسان، قادسیە، موسەننا، زی قار، واست.',
      faq: 'پرسیارە دووبارەکان',
      faqList: [
        { q: 'ئایا بریکاری فەرمی Bambu Lab ن؟', a: 'بەڵێ، ئێمە بریکاری فەرمی Bambu Lab ین لە عێراق، بە گەرەنتی فەرمی و چاککردنەوەی ناوخۆیی بۆ هەموو مۆدێلەکان.' },
        { q: 'چی جۆرە Filaments هەیە؟', a: 'PLA, PETG, ABS, TPU, Silk, Wood و Bambu Lab فەرمی.' },
        { q: 'گەیاندنی ئەلیکترۆنیات؟', a: 'بەڵێ، لە دەرەوە بە هەرزانترین نرخ بۆ هەموو پارێزگاکان.' },
        { q: 'گەیاندن چەند ماوەی دەخایەنێت؟', a: 'بەغدا 1–2 ڕۆژ، پارێزگاکانی تر 2–4 ڕۆژ. ئەلیکترۆنیات لە دەرەوە 7–14 ڕۆژ.' },
        { q: 'گەرەنتی هەیە؟', a: 'بەڵێ، هەموو Bambu Lab پرینتەرەکان گەرەنتی فەرمیان هەیە.' },
        { q: 'پرینتی تایبەت داوا بکەم؟', a: 'بەڵێ، لە بەشی "داواکاری پرینت" لە کۆمەڵگا.' },
      ],
      app: 'ئەپی LEVONIS دابگرە',
      appText: 'ئەزموونی خێراتر و ئاگادارکردنەوەی دەستبەجێ.',
      appBtn: 'دابگرە',
      contact: 'پەیوەندی پێوە بکە',
      contactText: 'تیمەکەمان ڕۆژانە بەردەستە',
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';
  const isRtl = dir === 'rtl';

  const stats = [
    { value: liveStats ? (liveStats.products + 50) : undefined, label: t.statsLabels.products, suffix: '+', icon: Package },
    { value: liveStats ? (liveStats.delivered + 100) : undefined, label: t.statsLabels.delivered, suffix: '+', icon: CheckCircle2 },
    { value: liveStats ? (liveStats.customers + 300) : undefined, label: t.statsLabels.customers, suffix: '+', icon: Heart },
    { value: liveStats ? (liveStats.merchants + 20) : undefined, label: t.statsLabels.merchants, suffix: '+', icon: Users },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
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

      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border/40">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/10 pointer-events-none" />
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, hsl(var(--foreground)) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl relative">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Printer className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-bold text-primary">3D Printing Specialists • Iraq</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-black text-foreground mb-4 tracking-tight leading-tight">
              {t.hero}
            </h1>
            <p className="text-base md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 leading-relaxed">
              {t.sub}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/category/all"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-[1.02] transition-all"
              >
                {t.ctaShop}
                <ArrowRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              </Link>
              <a
                href="https://wa.me/9647838455220"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-card border border-border font-bold hover:bg-accent transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                {t.ctaContact}
              </a>
            </div>
          </div>
        </div>
      </section>

      <main className="container mx-auto px-4 py-12 max-w-5xl space-y-16">
        {/* LIVE STATS */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 -mt-20 md:-mt-24 relative z-10">
          {stats.map((s, i) => {
            const Icon = s.icon;
            return (
              <div
                key={i}
                className="rounded-2xl bg-card border border-border p-4 md:p-5 text-center shadow-sm hover:shadow-md transition-shadow"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="w-10 h-10 mx-auto mb-2 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-2xl md:text-3xl font-black text-foreground">
                  {s.value !== undefined ? s.value.toLocaleString() : '...'}<span className="text-primary">{s.suffix}</span>
                </div>
                <div className="text-[11px] md:text-xs text-muted-foreground font-medium mt-1">{s.label}</div>
              </div>
            );
          })}
        </section>

        {/* STORY */}
        <section className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
          <div className="md:sticky md:top-20">
            <h2 className="text-3xl md:text-4xl font-black text-foreground">{t.story}</h2>
          </div>
          <div className="prose prose-lg max-w-none">
            <p className="text-base md:text-lg text-foreground/80 leading-relaxed">{t.storyText}</p>
          </div>
        </section>

        {/* TIMELINE */}
        <section>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-muted-foreground mb-3 bg-background">
              <Target className="w-3 h-3" />
              {language === 'en' ? 'CHAPTER 02' : language === 'ku' ? 'بەشی ٠٢' : 'الفصل ٠٢'}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground">{t.timeline}</h2>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className={`absolute top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent ${isRtl ? 'right-4 md:right-1/2' : 'left-4 md:left-1/2'}`} />
            <div className="space-y-8 md:space-y-12">
              {t.timelineList.map((item, i) => {
                const isEven = i % 2 === 0;
                return (
                  <div
                    key={i}
                    className={`relative md:grid md:grid-cols-2 md:gap-8 items-center ${isEven ? '' : 'md:[&>*:first-child]:order-2'}`}
                  >
                    {/* Dot */}
                    <div className={`absolute top-2 w-3 h-3 rounded-full bg-primary ring-4 ring-background ${isRtl ? 'right-[10px] md:right-1/2 md:translate-x-1/2' : 'left-[10px] md:left-1/2 md:-translate-x-1/2'}`} />
                    <div className={`${isRtl ? 'pr-10 md:pr-0' : 'pl-10 md:pl-0'} md:px-6 ${isEven ? 'md:text-end' : ''}`}>
                      <div className="inline-block px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-black mb-2">
                        {item.year}
                      </div>
                      <h3 className="text-xl font-bold text-foreground mb-1">{item.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
                    <div className="hidden md:block" />
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section>
          <div className="text-center mb-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold text-muted-foreground mb-3 bg-background">
              <Layers className="w-3 h-3" />
              {language === 'en' ? 'CHAPTER 03' : language === 'ku' ? 'بەشی ٠٣' : 'الفصل ٠٣'}
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-2">{t.what}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {t.services.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  className="group rounded-2xl bg-card border border-border p-5 hover:border-primary/40 hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 mb-4 rounded-xl bg-primary/10 group-hover:bg-primary/15 flex items-center justify-center transition-colors">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1.5">{s.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{s.text}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* VISION & MISSION */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/20 p-6">
            <div className="w-10 h-10 mb-3 rounded-xl bg-primary/15 flex items-center justify-center">
              <Eye className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-black text-foreground mb-2">{t.vision}</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{t.visionText}</p>
          </div>
          <div className="rounded-2xl bg-gradient-to-br from-accent/5 to-transparent border border-accent/20 p-6">
            <div className="w-10 h-10 mb-3 rounded-xl bg-accent/15 flex items-center justify-center">
              <Target className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-xl font-black text-foreground mb-2">{t.mission}</h3>
            <p className="text-sm text-foreground/80 leading-relaxed">{t.missionText}</p>
          </div>
        </section>

        {/* VALUES */}
        <section>
          <h2 className="text-3xl md:text-4xl font-black text-foreground mb-8 text-center">{t.values}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {t.valuesList.map((v, i) => {
              const Icon = v.icon;
              return (
                <div key={i} className="rounded-2xl bg-card border border-border p-5 text-center hover:border-primary/40 transition-colors">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-foreground mb-1">{v.t}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{v.d}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* COVERAGE */}
        <section className="rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/5 border border-border p-6 md:p-10">
          <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Globe className="w-6 h-6" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-foreground">{t.coverage}</h2>
          </div>
          <p className="text-foreground/80 leading-relaxed flex items-start gap-2">
            <MapPin className="w-4 h-4 text-primary shrink-0 mt-1" />
            <span>{t.coverageText}</span>
          </p>
        </section>

        {/* FAQ */}
        <section>
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-black text-foreground">{t.faq}</h2>
          </div>
          <div className="space-y-2 max-w-3xl mx-auto">
            {t.faqList.map((item, i) => {
              const isOpen = openFaq === i;
              return (
                <div
                  key={i}
                  className={`rounded-xl border transition-all overflow-hidden ${isOpen ? 'bg-card border-primary/40 shadow-sm' : 'bg-card border-border'}`}
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : i)}
                    className="w-full flex items-center justify-between gap-3 p-4 text-start hover:bg-accent/30 transition-colors"
                    aria-expanded={isOpen}
                  >
                    <span className="font-bold text-foreground text-sm md:text-base flex-1">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 animate-fade-in">
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>


        {/* CONTACT */}
        <section className="rounded-3xl bg-card border border-border p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-foreground mb-2">{t.contact}</h2>
          <p className="text-muted-foreground mb-6">{t.contactText}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href="https://wa.me/9647838455220"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[hsl(142,70%,45%)] text-white font-bold hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>
            <a
              href="tel:+9647838455220"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border font-bold hover:bg-accent transition-colors"
            >
              <Phone className="w-4 h-4" />
              +964 783 845 5220
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-card border border-border font-bold hover:bg-accent transition-colors"
            >
              <Mail className="w-4 h-4" />
              {t.contact}
            </Link>
          </div>
          <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-primary transition-colors">{language === 'en' ? 'Privacy Policy' : language === 'ku' ? 'سیاسەتی تایبەتمەندی' : 'سياسة الخصوصية'}</Link>
            <span>•</span>
            <Link to="/terms" className="hover:text-primary transition-colors">{language === 'en' ? 'Terms of Use' : language === 'ku' ? 'مەرجەکان' : 'الشروط والأحكام'}</Link>
            <span>•</span>
            <Link to="/faq" className="hover:text-primary transition-colors">FAQ</Link>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default About;
