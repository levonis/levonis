import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd } from '@/lib/seo/structured';
import {
  FileText, UserCog, ShoppingCart, Tag, Truck, RotateCcw, ShieldCheck,
  Store, Gamepad2, Wallet, Copyright, AlertTriangle, Scale, RefreshCw, Mail,
  Crown, Trophy, Printer, Wrench, Bell, Cookie, Lock, MessageSquare,
  Users, Gift, Ticket, Image as ImageIcon, Globe, BadgeCheck, Ban,
  CreditCard, Eye, Megaphone, ScrollText, Building2, FileWarning,
} from 'lucide-react';

const Terms = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'الشروط والأحكام',
      desc: 'الإطار القانوني الكامل لاستخدام موقع وتطبيق LEVONIS وشراء المنتجات.',
      updated: 'آخر تحديث: 2025-04-25',
      intro: 'باستخدامك لموقع أو تطبيق LEVONIS، فإنك تُقرّ بأنك قرأت ووافقت على هذه الشروط والأحكام. إذا لم توافق، يُرجى التوقف عن استخدام خدماتنا. تطبَّق هذه الشروط على جميع المستخدمين والزوّار والمشترين والتجار.',
      sections: [
        { icon: FileText, h: '1. التعريفات', p: '"المنصة" تعني موقع levonisiq.com وتطبيق LEVONIS الرسمي. "نحن/الشركة" تعني LEVONIS وفريقها. "المستخدم" يشمل أي زائر أو مسجّل أو مشتري أو تاجر. "المنتج" يشمل السلع والخدمات الرقمية والمادية المعروضة.' },
        { icon: UserCog, h: '2. الحساب والتسجيل', p: 'يجب أن تكون 13 سنة فأكبر للتسجيل. تُقدّم بياناتك الصحيحة وتُحدّثها عند تغيرها. أنت مسؤول عن سرية كلمة المرور وعن أي نشاط يتم من حسابك. نحتفظ بحق إيقاف أي حساب يُخالف الشروط أو يقوم بنشاط احتيالي.' },
        { icon: ShoppingCart, h: '3. الطلبات والقبول', p: 'إضافة منتج للسلة لا يُعدّ عقد بيع. الطلب يُعتبر مقبولاً فقط بعد تأكيده من فريقنا (هاتفياً أو عبر إشعار). نحتفظ بحق رفض أو إلغاء أي طلب لأسباب فنية، خطأ في السعر، نفاد المخزون، أو شك في الاحتيال.' },
        { icon: Tag, h: '4. الأسعار والعروض', p: 'الأسعار بالدينار العراقي وتشمل الضرائب المعمول بها (إن وجدت). تكلفة التوصيل تُحتسب منفصلة وتظهر قبل تأكيد الطلب. الأسعار قابلة للتغيير دون إشعار مسبق، لكن السعر المؤكَّد في الطلب لا يتغير. العروض والقسائم سارية حتى تاريخ انتهائها أو نفاد الكمية، وتخضع لشروط كل عرض.' },
        { icon: Wallet, h: '5. طرق الدفع', p: 'الطرق المتاحة: (أ) الدفع عند الاستلام (COD)، (ب) رصيد المحفظة الإلكترونية، (ج) القسائم وأكواد الخصم، (د) أي طرق دفع إلكترونية يتم إعلانها لاحقاً. لا نحفظ أرقام بطاقاتك — تُعالَج عبر بوابات دفع معتمدة.' },
        { icon: Truck, h: '6. التوصيل والاستلام', p: 'مدة التوصيل تقديرية وتختلف حسب المحافظة والمنتج (1-3 أيام لبغداد، 3-7 لباقي المحافظات). نوفّر ثلاثة خيارات: استلام من المخزن، توصيل اعتيادي، توصيل شخصي. التأخيرات الناتجة عن ظروف خارجة عن سيطرتنا (أحوال جوية، إغلاق طرق، أحداث طارئة) لا تُعدّ إخلالاً بالعقد.' },
        { icon: RotateCcw, h: '7. الإرجاع والاستبدال', p: 'يحق لك إرجاع/استبدال المنتج خلال 7 أيام من الاستلام إذا: (1) كان معيباً مصنعياً، (2) مختلفاً عن الموصوف، (3) غير مستخدم وفي تغليفه الأصلي. لا تشمل سياسة الإرجاع: المنتجات المخصّصة، البرامج المُفعّلة، المنتجات الاستهلاكية المفتوحة. تكلفة الإرجاع تتحملها الشركة إذا كان السبب يتعلق بنا، وتتحملها أنت إذا كان لتغيير رأي.' },
        { icon: ShieldCheck, h: '8. الضمان', p: 'يخضع كل منتج لضمان رسمي محدد المدة (يظهر في صفحته). يُغطّي الضمان عيوب التصنيع فقط ولا يشمل: سوء الاستخدام، الكسر العرضي، الفتح من جهات غير معتمدة، تلف السوائل، التعرض لتيار كهربائي غير مناسب. لتفعيل الضمان احتفظ بفاتورة الشراء.' },
        { icon: Store, h: '9. مجتمع التجار', p: 'يخضع التجار المسجّلون لاتفاقية شراكة منفصلة. هم مسؤولون قانونياً عن منتجاتهم، أوصافها، أسعارها، وضماناتها. تعمل LEVONIS كوسيط تقني وتأخذ نسبة عمولة على كل عملية. نحتفظ بحق إيقاف أي تاجر يُخالف الجودة أو السياسات.' },
        { icon: Gamepad2, h: '10. الألعاب والمسابقات', p: 'الألعاب والمسابقات لأغراض ترفيهية ومكافآت تسويقية. الجوائز تُمنح وفق آلية معلنة وعادلة. يُمنع استخدام أي برمجيات أو حسابات متعددة للاحتيال — أي مخالفة تُلغي الجائزة وتُغلق الحساب. النقاط والتذاكر ليست عملة قانونية ولا تُستبدل بنقد.' },
        { icon: Wallet, h: '11. المحفظة والنقاط', p: 'الرصيد في محفظتك ليس وديعة بنكية — يُستخدم فقط داخل المنصة. يمكن استخدامه لدفع الطلبات أو الاحتفاظ به. النقاط تُكتسب من الشراء والألعاب وتُستبدل بقسائم. لا يُسحب رصيد المحفظة نقداً إلا في حالات استثنائية يقررها فريقنا.' },
        { icon: Copyright, h: '12. الملكية الفكرية', p: 'جميع المحتويات (الشعار، التصميم، النصوص، الصور، الكود) ملك حصري لـ LEVONIS أو مرخّصة لها. يُمنع نسخ، تعديل، أو إعادة استخدام أي محتوى دون إذن كتابي. صور المنتجات قد تكون من المُصنّعين وتُستخدم بحقوق الاستخدام العادل.' },
        { icon: AlertTriangle, h: '13. الاستخدام المحظور', p: 'يُمنع: (أ) استخدام المنصة لأغراض غير قانونية، (ب) محاولات اختراق أو هجمات DOS، (ج) تجريف البيانات (scraping)، (د) إنشاء حسابات وهمية، (ه) إساءة استخدام أنظمة المكافآت، (و) نشر محتوى مسيء أو خاطئ، (ز) انتحال هويات.' },
        { icon: AlertTriangle, h: '14. حدود المسؤولية', p: 'تُقدَّم خدماتنا "كما هي". لا نضمن خلوّ المنصة من أعطال أو أخطاء طارئة. مسؤوليتنا القصوى لأي ضرر مباشر تقتصر على قيمة الطلب المعني. لا نتحمل مسؤولية الأضرار غير المباشرة (فقدان أرباح، فرص، بيانات).' },
        { icon: Scale, h: '15. القانون الحاكم وتسوية النزاعات', p: 'تخضع هذه الشروط للقوانين النافذة في جمهورية العراق. نسعى لحل أي نزاع بشكل ودّي عبر التواصل أولاً. في حال تعذّر ذلك، تختص المحاكم العراقية في بغداد بالنظر في النزاع.' },
        { icon: RefreshCw, h: '16. تعديل الشروط', p: 'نحتفظ بحق تعديل هذه الشروط في أي وقت. التعديلات الجوهرية يُعلَن عنها داخل المنصة. استمرارك في استخدام الخدمات بعد النشر يُعدّ موافقة على التعديلات.' },
        { icon: Mail, h: '17. التواصل', p: 'لأي استفسار قانوني أو شكوى رسمية: WhatsApp: +964 783 845 5220 — البريد: legal@levonisiq.com.' },
      ],
    },
    en: {
      title: 'Terms of Use',
      desc: 'Complete legal framework for using LEVONIS and purchasing products.',
      updated: 'Last updated: 2025-04-25',
      intro: 'By using the LEVONIS website or app you acknowledge that you have read and agreed to these Terms. If you do not agree, please stop using our services. These terms apply to all users, visitors, buyers, and merchants.',
      sections: [
        { icon: FileText, h: '1. Definitions', p: '"Platform" means levonisiq.com and the official LEVONIS app. "We/Company" means LEVONIS and its team. "User" includes any visitor, registered user, buyer, or merchant. "Product" includes physical and digital goods and services offered.' },
        { icon: UserCog, h: '2. Account & Registration', p: 'You must be 13+ to register. You provide accurate data and update it when changed. You are responsible for password confidentiality and any activity from your account. We may suspend any account violating terms or engaging in fraud.' },
        { icon: ShoppingCart, h: '3. Orders & Acceptance', p: 'Adding a product to the cart is not a sales contract. An order is considered accepted only after our team confirms it (by phone or notification). We may decline or cancel any order for technical, pricing, stock, or fraud-prevention reasons.' },
        { icon: Tag, h: '4. Prices & Offers', p: 'Prices are in IQD and include applicable taxes (if any). Delivery cost is calculated separately and shown before order confirmation. Prices may change without notice, but a confirmed order keeps its price. Offers and coupons are valid until expiry or stock-out and follow each offer’s terms.' },
        { icon: Wallet, h: '5. Payment Methods', p: 'Available: (a) Cash on Delivery, (b) e-wallet balance, (c) coupons and discount codes, (d) any electronic payment methods announced later. We never store card numbers — they are processed via certified payment gateways.' },
        { icon: Truck, h: '6. Delivery & Pickup', p: 'Delivery time is an estimate and varies by governorate and product (1-3 days for Baghdad, 3-7 for others). Three options: warehouse pickup, standard delivery, personal delivery. Delays caused by force majeure (weather, road closures, emergencies) are not contract breaches.' },
        { icon: RotateCcw, h: '7. Returns & Exchanges', p: 'You may return/exchange within 7 days of receipt if: (1) defective from manufacturing, (2) different from description, (3) unused in original packaging. Excluded: custom products, activated software, opened consumables. Return cost is on us if our fault, on you if change of mind.' },
        { icon: ShieldCheck, h: '8. Warranty', p: 'Each product has an official warranty period (shown on its page). Covers manufacturing defects only — excludes misuse, accidental breakage, unauthorized opening, liquid damage, or improper voltage. Keep your invoice to activate warranty.' },
        { icon: Store, h: '9. Merchant Marketplace', p: 'Registered merchants are bound by a separate partnership agreement. They are legally responsible for their products, descriptions, prices, and warranties. LEVONIS acts as a technical intermediary and takes a commission per transaction. We may suspend any non-compliant merchant.' },
        { icon: Gamepad2, h: '10. Games & Competitions', p: 'Games and competitions are entertainment and marketing rewards. Prizes are awarded by an announced fair mechanism. Use of bots or multi-accounts is prohibited — any violation cancels the prize and closes the account. Points and tickets are not legal currency and cannot be exchanged for cash.' },
        { icon: Wallet, h: '11. Wallet & Points', p: 'Your wallet balance is not a bank deposit — usable only within the platform. It can be used to pay for orders or kept. Points are earned via purchases and games and exchanged for coupons. Wallet balance is not withdrawable except in exceptional cases decided by our team.' },
        { icon: Copyright, h: '12. Intellectual Property', p: 'All content (logo, design, text, images, code) is the exclusive property of LEVONIS or licensed to it. Copying, modification, or reuse of any content without written permission is prohibited. Product images may be from manufacturers and used under fair use.' },
        { icon: AlertTriangle, h: '13. Prohibited Use', p: 'Forbidden: (a) using the platform for illegal purposes, (b) hacking or DOS attempts, (c) data scraping, (d) creating fake accounts, (e) abusing reward systems, (f) posting harmful or false content, (g) impersonation.' },
        { icon: AlertTriangle, h: '14. Limitation of Liability', p: 'Our services are provided "as is". We do not guarantee the platform is free from outages or incidental errors. Our maximum liability for any direct damage is limited to the value of the relevant order. We are not liable for indirect damages (lost profits, opportunities, data).' },
        { icon: Scale, h: '15. Governing Law & Disputes', p: 'These terms are governed by the laws of the Republic of Iraq. We aim to resolve any dispute amicably first. Otherwise, the courts of Baghdad have jurisdiction.' },
        { icon: RefreshCw, h: '16. Modification', p: 'We may modify these terms anytime. Material changes are announced on the platform. Continued use after publication is acceptance.' },
        { icon: Mail, h: '17. Contact', p: 'For legal questions or formal complaints: WhatsApp: +964 783 845 5220 — Email: legal@levonisiq.com.' },
      ],
    },
    ku: {
      title: 'مەرجەکانی بەکارهێنان',
      desc: 'چوارچێوەی یاسایی تەواوی بەکارهێنانی LEVONIS.',
      updated: 'دوایین نوێکردنەوە: 2025-04-25',
      intro: 'بە بەکارهێنانی LEVONIS ڕەزامەندی دەدەیت لەسەر ئەم مەرجانە.',
      sections: [
        { icon: FileText, h: '١. پێناسەکان', p: 'پلاتفۆڕم: levonisiq.com و ئەپی LEVONIS. ئێمە: LEVONIS و تیمەکەی.' },
        { icon: UserCog, h: '٢. هەژمار', p: 'دەبێت ١٣ ساڵ بەرەو سەرە بیت. بەرپرسی نهێنیی ووشەی نهێنی تۆ هەیە.' },
        { icon: ShoppingCart, h: '٣. داواکاری', p: 'داواکاری دوای دڵنیاکردنەوە وەردەگیرێت.' },
        { icon: Tag, h: '٤. نرخ و پێشکەشکراوەکان', p: 'نرخ بە دینار. تێچووی گەیاندن جیاوازە. پێشکەشکراوەکان بۆ ماوەیەکی دیاریکراون.' },
        { icon: Wallet, h: '٥. ڕێگاکانی پارەدان', p: 'پارەدان لە کاتی وەرگرتن، باڵانسی جزدان و کوپۆن.' },
        { icon: Truck, h: '٦. گەیاندن', p: 'گەیاندن لە ١-٣ ڕۆژدا بۆ بەغدا و ٣-٧ بۆ پارێزگاکانی تر.' },
        { icon: RotateCcw, h: '٧. گەڕاندنەوە', p: '٧ ڕۆژ بۆ گەڕاندنەوەی بەرهەمی عەیبدار یان جیاواز.' },
        { icon: ShieldCheck, h: '٨. گەرەنتی', p: 'گەرەنتی فەرمی لە لاپەڕەی هەر بەرهەمێک.' },
        { icon: Store, h: '٩. بازرگانان', p: 'بازرگانان بەرپرسن لە بەرهەمەکانیان.' },
        { icon: Gamepad2, h: '١٠. یاری', p: 'یاری بۆ خۆشی و خەڵاتە بازرگانیەکانە. خاڵ پارە نییە.' },
        { icon: Wallet, h: '١١. جزدان و خاڵ', p: 'جزدان بۆ بەکارهێنانی ناو پلاتفۆڕم تەنها.' },
        { icon: Copyright, h: '١٢. مافی نووسەر', p: 'هەموو ناوەڕۆکەکان موڵکی LEVONIS ن.' },
        { icon: AlertTriangle, h: '١٣. بەکارهێنانی قەدەغە', p: 'هەکینگ، حسابی ساختە و خراپ بەکارهێنانی خەڵات.' },
        { icon: AlertTriangle, h: '١٤. سنووری بەرپرسیاریەتی', p: 'خزمەتگوزاری "وەک ئێستا" پێشکەش دەکرێت.' },
        { icon: Scale, h: '١٥. یاسای فەرمانڕەوا', p: 'یاسای عێراق و دادگاکانی بەغدا.' },
        { icon: RefreshCw, h: '١٦. گۆڕانکاری', p: 'دەکرێت مەرجەکان بنوێکرێنەوە.' },
        { icon: Mail, h: '١٧. پەیوەندی', p: 'WhatsApp: +964 783 845 5220 — legal@levonisiq.com' },
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
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="glass-icon-btn w-11 h-11" aria-hidden="true">
              <Scale className="w-5 h-5 text-primary" />
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
          <Link to="/privacy" className="text-primary hover:underline">{language === 'en' ? 'Privacy' : language === 'ku' ? 'تایبەتمەندی' : 'سياسة الخصوصية'}</Link>
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

export default Terms;
