import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd, faqLd } from '@/lib/seo/structured';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Printer, Zap, Wrench, DollarSign, ShieldCheck,
  Cpu, Layers, Users, Award, ArrowRight, CheckCircle2, XCircle,
} from 'lucide-react';

const SITE = 'https://levonisiq.com';
const URL = `${SITE}/guides/bambu-lab-vs-creality`;

type Lang = 'ar' | 'en' | 'ku';

const CONTENT = {
  ar: {
    title: 'Bambu Lab مقابل Creality: دليل المقارنة الشامل 2026',
    description:
      'مقارنة تفصيلية بين طابعات Bambu Lab و Creality ثلاثية الأبعاد — السهولة، السرعة، الجودة، السعر، قطع الغيار، وأيهما يناسبك في العراق. دليل من LEVONIS.',
    breadcrumbHome: 'الرئيسية',
    breadcrumbGuides: 'الأدلة',
    heroBadge: 'دليل شراء طابعات 3D',
    heroSub: 'اختر بثقة بين سهولة Bambu Lab وقيمة Creality — مقارنة محايدة من فريق LEVONIS التقني.',
    ctaBambu: 'تسوّق طابعات Bambu Lab',
    ctaCreality: 'تسوّق طابعات Creality',
    ctaAllPrinters: 'استعرض جميع الطابعات',
    tocTitle: 'محتويات الدليل',
    toc: [
      'نظرة سريعة',
      'جدول المقارنة',
      'سهولة الاستخدام',
      'الأداء والسرعة',
      'جودة الطباعة',
      'السعر والقيمة',
      'قطع الغيار والتعديل',
      'البرمجيات والنظام',
      'الموديلات الشائعة',
      'أيهما تختار؟',
      'الأسئلة الشائعة',
    ],
    quickTake: {
      title: 'الخلاصة السريعة',
      bambu:
        'Bambu Lab = تجربة "افتح الصندوق واطبع" — أسرع، أنظف، وأقل صداعاً، لكن السعر أعلى وحرية التعديل أقل.',
      creality:
        'Creality = قيمة ممتازة مقابل السعر + مجتمع ضخم وقطع غيار وفيرة، لكن تحتاج صبراً وتعديلات لإخراج أفضل ما فيها.',
    },
    tableTitle: 'جدول المقارنة السريع',
    table: {
      headers: ['المعيار', 'Bambu Lab', 'Creality'],
      rows: [
        ['سهولة الإعداد', 'ممتاز (15 دقيقة)', 'متوسط (1-2 ساعة)'],
        ['السرعة القصوى', 'حتى 500 mm/s', 'حتى 250 mm/s (مع تعديلات)'],
        ['جودة الطباعة الافتراضية', 'عالية جداً', 'جيدة (تتحسن بالضبط)'],
        ['نظام AMS متعدد الألوان', 'مدمج (AMS / AMS Lite)', 'متاح في موديلات حديثة فقط'],
        ['مستوى الضجيج', 'هادئ', 'متوسط إلى عالي'],
        ['نطاق السعر', '$$ - $$$', '$ - $$'],
        ['قطع الغيار', 'حصرية من Bambu', 'متوفرة عالمياً + توافق واسع'],
        ['التعديل (Modding)', 'محدود', 'مفتوح بالكامل'],
        ['البرنامج', 'Bambu Studio (سهل)', 'Creality Print / Cura'],
        ['المجتمع والدعم', 'متنامي + رسمي قوي', 'الأكبر عالمياً'],
        ['الأنسب لـ', 'المبتدئ والمحترف الذي يقدّر وقته', 'الهاوي والمعدِّل وذو الميزانية'],
      ],
    },
    sections: [
      {
        icon: Zap,
        title: 'سهولة الاستخدام: من يفوز؟',
        body: [
          'إذا فتحت صندوق Bambu Lab X1C أو A1، ستبدأ الطباعة خلال 15-20 دقيقة. المعايرة التلقائية الكاملة (Bed Leveling + Flow + Vibration Compensation) تحدث بضغطة واحدة، وكل المعايرات تنفّذ قبل كل طباعة بصمت.',
          'في المقابل، Creality Ender 3 / K1 / K2 تحتاج إعداد يدوي أطول: تركيب الإطار، شد الأحزمة، معايرة المنصة (Manual أو Auto حسب الموديل)، وضبط Z-offset. الموديلات الأحدث (K1، K1 Max، K2 Plus) تقلّصت فيها هذه الفجوة لكنها لم تختفِ.',
          'النتيجة: لو وقتك أثمن من المال، Bambu يفوز. لو الإعداد جزء من المتعة، Creality يعطيك ذلك.',
        ],
      },
      {
        icon: Cpu,
        title: 'الأداء والسرعة',
        body: [
          'Bambu X1 Carbon وP1S يطبعان بشكل مستقر عند 300-500 mm/s مع تسارع 20,000 mm/s²، بفضل CoreXY الصلب ونظام Active Vibration Compensation الذي يقيس الاهتزازات لحظياً.',
          'Creality K1 / K2 Plus قطعت شوطاً كبيراً ووصلت لـ 600 mm/s نظرياً، لكن الجودة عند هذه السرعات تتأثر أكثر مقارنةً بـ Bambu. Ender 3 V3 SE / KE معدّلة للسرعة المتوسطة (250 mm/s) وتؤدي بشكل ممتاز.',
          'في الاستخدام الفعلي: نموذج Benchy 3D يطبعه Bambu X1C في ~16 دقيقة بجودة مرتفعة، بينما Creality K1 يقاربه في ~18-20 دقيقة.',
        ],
      },
      {
        icon: Award,
        title: 'جودة الطباعة',
        body: [
          'Bambu يخرج جودة "Out of the box" مرتفعة جداً — الطبقات نظيفة، الجسور صلبة، والـ Overhangs ممتازة بفضل التبريد المساعد وغرفة محكمة.',
          'Creality يمكن أن يصل لنفس الجودة (أحياناً أفضل في موديلات Ender المعدّلة بالكامل)، لكنه يحتاج ضبط شخصي للسلايسر، أنوزل عالية الجودة، وأحياناً ترقيات ميكانيكية.',
          'للمحترف الذي يبيع قطعاً مطبوعة، Bambu يوفر اتساقاً أعلى من طباعة لأخرى دون تدخل.',
        ],
      },
      {
        icon: DollarSign,
        title: 'السعر والقيمة',
        body: [
          'Creality Ender 3 V3 SE يبدأ من حوالي ~$200، و K1 من ~$430 — أرخص نقطة دخول لطباعة 3D عالمياً.',
          'Bambu A1 Mini يبدأ من ~$300، A1 من ~$400، P1S من ~$700، و X1C يصل لـ ~$1200+. يبدو أعلى لكن مع AMS وسهولة الاستخدام يكون "تكلفة إجمالية" أفضل لمن لا يريد العبث.',
          'في العراق، السعر مع التوصيل والكمارك يصبح عاملاً حاسماً — استعرض الأسعار الحالية في صفحة الطابعات لدينا.',
        ],
      },
      {
        icon: Wrench,
        title: 'قطع الغيار والتعديل',
        body: [
          'Creality هي ملك التعديل بلا منازع. كل قطعة قابلة للاستبدال، وآلاف الـ Mods على Printables و Thingiverse، وقطع الغيار رخيصة ومتوفرة في كل مكان.',
          'Bambu نظام شبه مغلق — قطع الغيار رسمية فقط (Hotend، Nozzle، Belt، Glass Plate). إذا تعطلت اللوحة الأم بعد سنتين، الإصلاح أصعب.',
          'إذا كنت تحب التعديل والتطوير المستمر، Creality. إذا تريد جهاز "يشتغل وخلاص"، Bambu.',
        ],
      },
      {
        icon: Layers,
        title: 'البرمجيات والنظام البيئي',
        body: [
          'Bambu Studio (مبني على PrusaSlicer/Slic3r) من أفضل السلايسرات حالياً — Profiles جاهزة لكل خيط، Auto-Calibration، ومكتبة MakerWorld فيها أكثر من 200,000 موديل قابل للطباعة بضغطة.',
          'Creality Print تحسّن كثيراً، لكن معظم المستخدمين يفضّلون Cura أو OrcaSlicer مع Creality. الحرية أكبر، لكن منحنى التعلم أعلى.',
          'للمراقبة عن بُعد: Bambu Handy تطبيق رسمي مع كاميرا داخلية. Creality لها Creality Cloud + Klipper/Fluidd للمتقدمين.',
        ],
      },
      {
        icon: Printer,
        title: 'الموديلات الشائعة في 2026',
        body: [
          'Bambu Lab: A1 Mini (مبتدئ، ميزانية)، A1 (متوسط، AMS Lite)، P1S (محترف، مغلق)، X1 Carbon (الأعلى، Lidar + AI).',
          'Creality: Ender 3 V3 SE (أرخص بداية)، Ender 3 V3 KE (Klipper مدمج)، K1 / K1 Max (سرعة عالية)، K2 Plus (CoreXY مع AMS).',
          'لكل موديل صفحته في متجرنا — اضغط على CTA أعلاه لرؤية الأسعار والمواصفات الكاملة.',
        ],
      },
      {
        icon: Users,
        title: 'أيهما تختار؟ التوصية حسب نوع المستخدم',
        body: [
          '👤 مبتدئ تماماً، يريد يطبع فوراً → Bambu A1 Mini أو A1.',
          '🛠️ هاوي يحب التعديل والتعلم → Creality Ender 3 V3 KE أو K1.',
          '🏢 محترف / ورشة صغيرة تبيع قطعاً → Bambu P1S أو X1 Carbon.',
          '💰 ميزانية محدودة جداً → Creality Ender 3 V3 SE.',
          '🎨 يحتاج طباعة متعددة الألوان → Bambu (AMS هو الأفضل في الصناعة).',
          '⚙️ يبني فارم طباعة (عدة أجهزة) → الخيار يعتمد على ميزانية الصيانة طويلة الأمد.',
        ],
      },
    ],
    faqTitle: 'الأسئلة الشائعة',
    faq: [
      {
        q: 'هل Bambu Lab أفضل من Creality فعلاً؟',
        a: 'Bambu أفضل في السهولة والسرعة والجودة من أول طباعة، لكن Creality يقدّم قيمة أعلى بالنسبة للسعر ومجتمعاً ضخماً للتعديل. "الأفضل" يعتمد على أولوياتك.',
      },
      {
        q: 'هل تتوفر قطع غيار Bambu Lab في العراق؟',
        a: 'نعم — LEVONIS يوفر فئة كاملة لصيانة Bambulab تشمل النوزل، الهوت إند، الأحزمة، وقطع AMS الأصلية مع ضمان.',
      },
      {
        q: 'ما أرخص طابعة 3D للمبتدئين؟',
        a: 'Creality Ender 3 V3 SE هي الأرخص عالمياً للمبتدئ الجاد. Bambu A1 Mini خيار أغلى قليلاً لكنه "Plug & Print" بدون أي إعداد.',
      },
      {
        q: 'هل أستطيع طباعة عدة ألوان بـ Creality؟',
        a: 'بعض موديلات Creality الحديثة (K2 Plus) تدعم نظام CFS متعدد الألوان، لكن AMS من Bambu أكثر نضجاً وانتشاراً واستقراراً.',
      },
      {
        q: 'كم عمر طابعة 3D متوسطة؟',
        a: 'بصيانة جيدة (تنظيف، تشحيم، استبدال نوزل دوري) تعيش 3-5 سنوات بسهولة. Creality أسهل في الصيانة الذاتية، Bambu أسهل في "لا صيانة" لكن أصعب عند العطل الكبير.',
      },
      {
        q: 'هل تقدّم LEVONIS ضماناً على الطابعات؟',
        a: 'نعم، جميع طابعات Bambu Lab و Creality في LEVONIS تأتي بضمان رسمي + دعم تقني محلي بالعربية. اطّلع على تفاصيل الضمان في صفحة كل منتج.',
      },
    ],
    closing: {
      title: 'جاهز للاختيار؟',
      sub: 'استعرض موديلات Bambu Lab و Creality المتوفرة الآن في LEVONIS مع ضمان رسمي وتوصيل لكل المحافظات.',
    },
  },
  en: {
    title: 'Bambu Lab vs Creality: The Complete 2026 Comparison',
    description:
      'A detailed comparison of Bambu Lab and Creality 3D printers — ease, speed, quality, price, parts, and which one is right for you. A LEVONIS buying guide.',
    breadcrumbHome: 'Home',
    breadcrumbGuides: 'Guides',
    heroBadge: '3D Printer Buying Guide',
    heroSub:
      'Choose confidently between Bambu Lab\'s ease and Creality\'s value — a neutral comparison from the LEVONIS technical team.',
    ctaBambu: 'Shop Bambu Lab printers',
    ctaCreality: 'Shop Creality printers',
    ctaAllPrinters: 'Browse all 3D printers',
    tocTitle: 'In this guide',
    toc: [
      'Quick take',
      'Comparison table',
      'Ease of use',
      'Performance & speed',
      'Print quality',
      'Price & value',
      'Parts & modding',
      'Software & ecosystem',
      'Popular models',
      'Which should you pick?',
      'FAQ',
    ],
    quickTake: {
      title: 'TL;DR',
      bambu:
        'Bambu Lab = open-the-box-and-print experience — faster, cleaner, fewer headaches, but higher price and less freedom to mod.',
      creality:
        'Creality = unbeatable value + a huge community and parts catalog, but requires patience and tinkering to get the best out of it.',
    },
    tableTitle: 'Quick comparison',
    table: {
      headers: ['Criterion', 'Bambu Lab', 'Creality'],
      rows: [
        ['Setup time', 'Excellent (15 min)', 'Moderate (1-2 hours)'],
        ['Max speed', 'Up to 500 mm/s', 'Up to 250 mm/s (tuned)'],
        ['Out-of-box quality', 'Very high', 'Good (improves with tuning)'],
        ['Multi-color (AMS)', 'Built-in (AMS / AMS Lite)', 'Newer models only'],
        ['Noise level', 'Quiet', 'Medium to loud'],
        ['Price range', '$$ - $$$', '$ - $$'],
        ['Spare parts', 'OEM only', 'Globally available + universal fit'],
        ['Modding', 'Limited', 'Fully open'],
        ['Slicer', 'Bambu Studio (easy)', 'Creality Print / Cura'],
        ['Community', 'Growing + strong official', 'Largest worldwide'],
        ['Best for', 'Beginners & time-poor pros', 'Tinkerers & budget builds'],
      ],
    },
    sections: [
      {
        icon: Zap,
        title: 'Ease of use: who wins?',
        body: [
          'Open a Bambu Lab X1C or A1 box and you can start printing in 15-20 minutes. Full auto-calibration (bed leveling + flow + vibration compensation) runs with one tap, and re-runs silently before every print.',
          'Creality Ender 3 / K1 / K2 take longer to set up: frame assembly, belt tensioning, manual or auto bed leveling depending on model, and Z-offset tuning. Newer models (K1, K1 Max, K2 Plus) narrow the gap but haven\'t closed it.',
          'Bottom line: if your time is worth more than the money, Bambu wins. If setup is part of the fun, Creality gives you that.',
        ],
      },
      {
        icon: Cpu,
        title: 'Performance & speed',
        body: [
          'Bambu X1 Carbon and P1S print reliably at 300-500 mm/s with 20,000 mm/s² acceleration, thanks to a rigid CoreXY frame and Active Vibration Compensation that measures resonance in real-time.',
          'Creality K1 / K2 Plus have closed the gap and reach a theoretical 600 mm/s, but quality at those speeds drops more than on Bambu. Ender 3 V3 SE / KE are tuned for mid-range speed (250 mm/s) and perform very well.',
          'In practice: a 3D Benchy prints on a Bambu X1C in ~16 minutes at high quality, while a Creality K1 lands at ~18-20 minutes.',
        ],
      },
      {
        icon: Award,
        title: 'Print quality',
        body: [
          'Bambu delivers very high out-of-box quality — clean layers, strong bridges, and excellent overhangs thanks to auxiliary cooling and an enclosed chamber.',
          'Creality can match (sometimes exceed) that quality on a fully modded Ender, but it needs personal slicer tuning, premium nozzles, and occasionally mechanical upgrades.',
          'For a pro selling printed parts, Bambu offers more consistency print-to-print without intervention.',
        ],
      },
      {
        icon: DollarSign,
        title: 'Price & value',
        body: [
          'Creality Ender 3 V3 SE starts around $200, K1 around $430 — the cheapest serious entry into 3D printing.',
          'Bambu A1 Mini starts at ~$300, A1 at ~$400, P1S at ~$700, and X1C tops at ~$1200+. Higher up front, but with AMS and ease of use the total cost of ownership is lower for someone who just wants to print.',
          'In Iraq, shipping and customs become a deciding factor — check current pricing on our printers page.',
        ],
      },
      {
        icon: Wrench,
        title: 'Spare parts & modding',
        body: [
          'Creality is the undisputed king of modding. Every part is replaceable, thousands of mods on Printables and Thingiverse, and parts are cheap and available everywhere.',
          'Bambu is a semi-closed ecosystem — official parts only (hotend, nozzle, belt, glass plate). If the mainboard dies after two years, repair is harder.',
          'Love tinkering and upgrading? Creality. Want a machine that just works? Bambu.',
        ],
      },
      {
        icon: Layers,
        title: 'Software & ecosystem',
        body: [
          'Bambu Studio (forked from PrusaSlicer/Slic3r) is one of the best slicers right now — ready-made profiles per filament, auto-calibration, and a MakerWorld library with 200,000+ ready-to-print models.',
          'Creality Print has improved a lot, but most users prefer Cura or OrcaSlicer with their Creality. More freedom, steeper learning curve.',
          'Remote monitoring: Bambu Handy is an official app with built-in camera. Creality has Creality Cloud + Klipper/Fluidd for advanced users.',
        ],
      },
      {
        icon: Printer,
        title: 'Popular 2026 models',
        body: [
          'Bambu Lab: A1 Mini (beginner, budget), A1 (mid + AMS Lite), P1S (pro, enclosed), X1 Carbon (flagship, Lidar + AI).',
          'Creality: Ender 3 V3 SE (cheapest entry), Ender 3 V3 KE (Klipper-native), K1 / K1 Max (high speed), K2 Plus (CoreXY with AMS).',
          'Each model has its own page in our store — tap a CTA above to see live pricing and full specs.',
        ],
      },
      {
        icon: Users,
        title: 'Which should you pick? By user type',
        body: [
          '👤 Total beginner, wants to print today → Bambu A1 Mini or A1.',
          '🛠️ Hobbyist who loves to tinker → Creality Ender 3 V3 KE or K1.',
          '🏢 Pro / small shop selling parts → Bambu P1S or X1 Carbon.',
          '💰 Very tight budget → Creality Ender 3 V3 SE.',
          '🎨 Multi-color printing → Bambu (AMS is the industry best).',
          '⚙️ Building a print farm → depends on long-term maintenance budget.',
        ],
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        q: 'Is Bambu Lab really better than Creality?',
        a: 'Bambu is better at ease, speed, and out-of-box quality. Creality offers higher value per dollar and a massive modding community. "Better" depends on your priorities.',
      },
      {
        q: 'Are Bambu Lab spare parts available in Iraq?',
        a: 'Yes — LEVONIS stocks a full Bambulab maintenance category including nozzles, hotends, belts, and genuine AMS parts with warranty.',
      },
      {
        q: 'What\'s the cheapest 3D printer for beginners?',
        a: 'Creality Ender 3 V3 SE is the cheapest serious starter. Bambu A1 Mini costs a bit more but is truly plug-and-print.',
      },
      {
        q: 'Can I print multi-color on a Creality?',
        a: 'Some newer Creality models (K2 Plus) support a CFS multi-color system, but Bambu\'s AMS is more mature, widespread, and reliable.',
      },
      {
        q: 'How long does an average 3D printer last?',
        a: 'With good maintenance (cleaning, lubrication, periodic nozzle changes) 3-5 years is easy. Creality is easier to self-service; Bambu is easier "no-service" but harder on big failures.',
      },
      {
        q: 'Does LEVONIS offer warranty on printers?',
        a: 'Yes, every Bambu Lab and Creality printer at LEVONIS comes with official warranty + local Arabic-speaking technical support. See each product page for details.',
      },
    ],
    closing: {
      title: 'Ready to choose?',
      sub: 'Browse Bambu Lab and Creality models available now at LEVONIS with official warranty and delivery to all governorates.',
    },
  },
  ku: {
    title: 'Bambu Lab بەرامبەر Creality: ڕێبەری بەراوردکردن 2026',
    description:
      'بەراوردێکی وردی نێوان چاپکەری Bambu Lab و Creality — ئاسانی، خێرایی، کوالێتی، نرخ، و کام بۆ تۆ گونجاوە. ڕێبەری LEVONIS.',
    breadcrumbHome: 'ماڵەوە',
    breadcrumbGuides: 'ڕێبەرەکان',
    heroBadge: 'ڕێبەری کڕینی چاپکەری 3D',
    heroSub:
      'بە متمانە هەڵبژێرە لە نێوان ئاسانی Bambu Lab و بەهای Creality — بەراوردێکی بێلایەن لە تیمی LEVONIS.',
    ctaBambu: 'کڕینی چاپکەری Bambu Lab',
    ctaCreality: 'کڕینی چاپکەری Creality',
    ctaAllPrinters: 'بینینی هەموو چاپکەرەکان',
    tocTitle: 'ناوەڕۆکی ڕێبەر',
    toc: [
      'پوختە',
      'خشتەی بەراورد',
      'ئاسانی بەکارهێنان',
      'پەرفۆرمانس و خێرایی',
      'کوالێتی چاپ',
      'نرخ و بەها',
      'پارچە و دەستکاری',
      'سۆفتوێر',
      'مۆدێلە بەناوبانگەکان',
      'کام هەڵبژێرین؟',
      'پرسیارە دووبارەکان',
    ],
    quickTake: {
      title: 'پوختە',
      bambu: 'Bambu Lab = "سندوقەکە بکەرەوە و چاپ بکە" — خێراتر و ئاسانتر، بەڵام نرختر.',
      creality: 'Creality = بەهای زۆر باش بۆ نرخ + کۆمەڵگەی گەورە، بەڵام پێویستی بە ئارامی و دەستکاری هەیە.',
    },
    tableTitle: 'بەراوردی خێرا',
    table: {
      headers: ['پێوەر', 'Bambu Lab', 'Creality'],
      rows: [
        ['کاتی دامەزراندن', 'نایاب (15 خولەک)', 'مامناوەند (1-2 کاتژمێر)'],
        ['خێرایی بەرز', 'تا 500 mm/s', 'تا 250 mm/s'],
        ['کوالێتی سەرەتایی', 'زۆر بەرز', 'باش (بە ڕێکخستن باشتر)'],
        ['سیستەمی فرە-ڕەنگ', 'بەشێک لە بنیات (AMS)', 'تەنیا مۆدێلە نوێیەکان'],
        ['ئاستی دەنگ', 'بێدەنگ', 'مامناوەند بۆ بەرز'],
        ['نرخ', '$$ - $$$', '$ - $$'],
        ['پارچەی یەدەگ', 'تەنیا فەرمی', 'بەردەست لە هەموو شوێنێک'],
        ['دەستکاری', 'سنووردار', 'تەواو کراوە'],
        ['سۆفتوێر', 'Bambu Studio', 'Creality Print / Cura'],
        ['کۆمەڵگە', 'گەشەسەندوو', 'گەورەترین لە جیهان'],
        ['گونجاو بۆ', 'سەرەتاکار و پسپۆڕ', 'هۆبیست و کەسانی بودجە'],
      ],
    },
    sections: [
      {
        icon: Zap,
        title: 'ئاسانی بەکارهێنان',
        body: [
          'Bambu Lab A1 یان X1C لە 15-20 خولەکدا ئامادە دەبێت بۆ چاپ. هەموو کالیبراسیۆن ئۆتۆماتیکی پێش هەر چاپێک.',
          'Creality پێویستی بە کاتێکی زیاتر هەیە بۆ کۆکردنەوە، تاقیکردنەوەی belt، و ڕێکخستنی Z-offset.',
        ],
      },
      {
        icon: Cpu,
        title: 'پەرفۆرمانس',
        body: [
          'Bambu X1C و P1S بە 300-500 mm/s چاپ دەکەن بە کوالێتی بەرز.',
          'Creality K1 و K2 Plus گەیشتوون بە 600 mm/s، بەڵام کوالێتی لێرە کەمێک کەمتر دەبێت.',
        ],
      },
      {
        icon: DollarSign,
        title: 'نرخ',
        body: [
          'Creality Ender 3 V3 SE لە $200 دەست پێدەکات.',
          'Bambu A1 Mini لە $300، X1C تا $1200+.',
        ],
      },
      {
        icon: Wrench,
        title: 'پارچە و دەستکاری',
        body: [
          'Creality پاشای دەستکاریە — هەموو پارچەیەک گۆڕاوە.',
          'Bambu سیستەمێکی نیمچە-داخراوە — تەنیا پارچەی فەرمی.',
        ],
      },
      {
        icon: Users,
        title: 'کام هەڵبژێرین؟',
        body: [
          'سەرەتاکار → Bambu A1 Mini.',
          'هۆبیست → Creality Ender 3 V3 KE.',
          'پسپۆڕ → Bambu P1S یان X1C.',
          'بودجەی کەم → Creality Ender 3 V3 SE.',
        ],
      },
    ],
    faqTitle: 'پرسیارە دووبارەکان',
    faq: [
      { q: 'ئایا Bambu Lab باشترە لە Creality؟', a: 'Bambu لە ئاسانی و خێرایی باشترە، Creality لە بەها باشترە.' },
      { q: 'پارچەی یەدەگی Bambu لە عێراق هەیە؟', a: 'بەڵێ، LEVONIS هەموو پارچەی سەنتراڵی Bambulab ڕاست دەکات.' },
      { q: 'هەرزانترین چاپکەر بۆ سەرەتاکار؟', a: 'Creality Ender 3 V3 SE هەرزانترینە.' },
    ],
    closing: {
      title: 'ئامادەی هەڵبژاردن؟',
      sub: 'بینینی مۆدێلەکانی Bambu Lab و Creality لە LEVONIS.',
    },
  },
} as const;

const BambuVsCreality = () => {
  const { language } = useLanguage();
  const lang = (['ar', 'en', 'ku'].includes(language) ? language : 'ar') as Lang;
  const t = CONTENT[lang];
  const isRtl = lang === 'ar' || lang === 'ku';

  const jsonLd = [
    breadcrumbLd([
      { name: t.breadcrumbHome, url: '/' },
      { name: t.breadcrumbGuides, url: '/guides/bambu-lab-vs-creality' },
      { name: 'Bambu Lab vs Creality', url: '/guides/bambu-lab-vs-creality' },
    ]),
    faqLd(t.faq.map((f) => ({ q: f.q, a: f.a }))),
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: t.title,
      description: t.description,
      author: { '@type': 'Organization', name: 'LEVONIS' },
      publisher: {
        '@type': 'Organization',
        name: 'LEVONIS',
        logo: { '@type': 'ImageObject', url: `${SITE}/logo-medium.png` },
      },
      datePublished: '2026-06-21',
      dateModified: '2026-06-21',
      mainEntityOfPage: URL,
      image: `${SITE}/og-image.jpg`,
      about: [
        { '@type': 'Brand', name: 'Bambu Lab' },
        { '@type': 'Brand', name: 'Creality' },
      ],
      inLanguage: lang === 'ar' ? 'ar-IQ' : lang === 'ku' ? 'ku-IQ' : 'en-US',
    },
  ];

  return (
    <div className="min-h-dvh bg-background" dir={isRtl ? 'rtl' : 'ltr'}>
      <SEO
        title={t.title}
        description={t.description}
        url={URL}
        canonical={URL}
        type="article"
        locale={lang === 'ar' ? 'ar_IQ' : lang === 'ku' ? 'ku_IQ' : 'en_US'}
        keywords={[
          'Bambu Lab vs Creality',
          'Bambu Lab',
          'Creality',
          '3D printer comparison',
          'مقارنة طابعات 3D',
          'Bambu Lab مقابل Creality',
          'أفضل طابعة 3D',
          'طابعة ثلاثية الأبعاد العراق',
          'LEVONIS',
        ]}
        jsonLd={jsonLd}
      />

      <main className="container max-w-4xl px-4 pt-6 pb-20">
        {/* Breadcrumb */}
        <nav className="mb-4 text-xs text-muted-foreground" aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1">
            <li><Link to="/" className="hover:underline">{t.breadcrumbHome}</Link></li>
            <li aria-hidden>›</li>
            <li className="text-foreground font-medium">Bambu Lab vs Creality</li>
          </ol>
        </nav>

        {/* Hero */}
        <header className="mb-8">
          <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {t.heroBadge}
          </span>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold leading-tight">
            {t.title}
          </h1>
          <p className="mt-3 text-base text-muted-foreground">{t.heroSub}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/category/printers">
                <Printer className="h-4 w-4" />
                {t.ctaAllPrinters}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/search?q=Bambu+Lab">
                {t.ctaBambu} <ArrowRight className={isRtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/search?q=Creality">
                {t.ctaCreality} <ArrowRight className={isRtl ? 'h-4 w-4 rotate-180' : 'h-4 w-4'} />
              </Link>
            </Button>
          </div>
        </header>

        {/* TOC */}
        <Card className="mb-8 p-4">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            {t.tocTitle}
          </h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">
            {t.toc.map((item, i) => (
              <li key={i} className="text-foreground/90">
                <span className="text-primary me-1">{i + 1}.</span>{item}
              </li>
            ))}
          </ul>
        </Card>

        {/* Quick take */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">{t.quickTake.title}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-5 border-l-4 border-l-primary">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <h3 className="font-bold">Bambu Lab</h3>
              </div>
              <p className="text-sm text-muted-foreground">{t.quickTake.bambu}</p>
            </Card>
            <Card className="p-5 border-l-4 border-l-accent">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-5 w-5 text-accent-foreground" />
                <h3 className="font-bold">Creality</h3>
              </div>
              <p className="text-sm text-muted-foreground">{t.quickTake.creality}</p>
            </Card>
          </div>
        </section>

        {/* Comparison table */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">{t.tableTitle}</h2>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {t.table.headers.map((h, i) => (
                    <th key={i} className={`p-3 font-bold ${isRtl ? 'text-right' : 'text-left'}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.table.rows.map((row, i) => (
                  <tr key={i} className="border-t border-border/60">
                    {row.map((cell, j) => (
                      <td key={j} className={`p-3 ${j === 0 ? 'font-semibold' : 'text-muted-foreground'}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>

        {/* Sections */}
        {t.sections.map((sec, i) => {
          const Icon = sec.icon;
          return (
            <section key={i} className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-lg bg-primary/10 p-2 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">{sec.title}</h2>
              </div>
              <div className="space-y-3 text-[15px] leading-relaxed text-foreground/90">
                {sec.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            </section>
          );
        })}

        {/* FAQ */}
        <section className="mb-10">
          <h2 className="mb-4 text-2xl font-bold">{t.faqTitle}</h2>
          <div className="space-y-3">
            {t.faq.map((f, i) => (
              <Card key={i} className="p-4">
                <h3 className="font-bold mb-1 flex items-start gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>{f.q}</span>
                </h3>
                <p className="text-sm text-muted-foreground ms-7">{f.a}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Closing CTA */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-primary/20">
          <h2 className="text-xl font-bold mb-2">{t.closing.title}</h2>
          <p className="text-sm text-muted-foreground mb-4">{t.closing.sub}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/category/printers">
                <Printer className="h-4 w-4" />
                {t.ctaAllPrinters}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/category/Maintain-bambulab">Bambu {lang === 'en' ? 'parts' : lang === 'ku' ? 'پارچە' : 'قطع غيار'}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/category/Creality-maintain">Creality {lang === 'en' ? 'parts' : lang === 'ku' ? 'پارچە' : 'قطع غيار'}</Link>
            </Button>
          </div>
        </Card>
      </main>

      <Footer />
    </div>
  );
};

export default BambuVsCreality;
