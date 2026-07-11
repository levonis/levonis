import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd, faqLd } from '@/lib/seo/structured';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import {
  ShoppingCart, Truck, Wallet, ShieldCheck, UserCog, Gamepad2,
  Store, Smartphone, HelpCircle, Search
} from 'lucide-react';

const Faq = () => {
  const { language } = useLanguage();
  const [query, setQuery] = useState('');

  const c = {
    ar: {
      title: 'الأسئلة الشائعة',
      desc: 'إجابات شاملة عن أكثر الأسئلة شيوعاً حول LEVONIS — التسوق، التوصيل، الدفع، الضمان، الحساب، الألعاب، والتطبيق.',
      searchPh: 'ابحث في الأسئلة...',
      noResults: 'لا توجد نتائج مطابقة. جرّب كلمة أخرى.',
      stillNeed: 'لم تجد إجابتك؟',
      contactBtn: 'تواصل عبر WhatsApp',
      groups: [
        {
          icon: ShoppingCart, title: 'الطلبات والشراء',
          qa: [
            { q: 'كيف أقدّم طلباً؟', a: 'اختر المنتج، أضِفه للسلة، اذهب لصفحة السلة، أكمل بيانات التوصيل، اختر طريقة الدفع، ثم اضغط "تأكيد الطلب". ستصلك رسالة تأكيد فور قبول الطلب.' },
            { q: 'هل يمكنني تعديل أو إلغاء طلب بعد إرساله؟', a: 'نعم، طالما أن الطلب لم يدخل مرحلة "قيد التحضير". تواصل معنا فوراً عبر WhatsApp مع رقم الطلب.' },
            { q: 'هل أحتاج لإنشاء حساب للشراء؟', a: 'نعم — إنشاء حساب يضمن متابعة طلباتك، تجميع نقاط، وتفعيل ضمان المنتجات.' },
            { q: 'هل يمكنني شراء كميات كبيرة (Wholesale)؟', a: 'نعم، تواصل معنا مباشرة لطلبات الجملة وسنُقدّم لك أسعاراً خاصة.' },
            { q: 'لماذا تم إلغاء طلبي تلقائياً؟', a: 'قد يحدث ذلك بسبب: نفاد المخزون فجأة، عدم القدرة على التواصل معك، أو خطأ في عنوان التوصيل. سنُعلمك بالسبب.' },
          ],
        },
        {
          icon: Truck, title: 'التوصيل والاستلام',
          qa: [
            { q: 'كم تستغرق مدة التوصيل؟', a: 'بغداد: 1-3 أيام عمل. باقي المحافظات: 3-7 أيام عمل. مدة كل منتج موضحة في صفحته. الطلبات الخاصة (طلب مسبق) قد تستغرق وقتاً أطول.' },
            { q: 'ما هي خيارات التوصيل المتاحة؟', a: '(1) الاستلام من المخزن مجاناً، (2) التوصيل الاعتيادي بسعر ثابت حسب المحافظة، (3) التوصيل الشخصي (سريع وبسعر أعلى).' },
            { q: 'هل يصلني الطلب خارج بغداد؟', a: 'نعم، نخدم جميع المحافظات العراقية الـ 18.' },
            { q: 'كيف أتابع حالة طلبي؟', a: 'من صفحة "طلباتي" ترى المراحل: جديد → قيد التحضير → في الطريق → مُسلَّم. تصلك أيضاً إشعارات Telegram إذا فعّلتها.' },
            { q: 'ماذا لو لم يتمكن المندوب من الوصول لي؟', a: 'سيتصل بك المندوب أولاً. في حال تعذّر الوصول، يُعاد الطلب للمستودع ويتم التواصل معك لجدولة محاولة جديدة.' },
          ],
        },
        {
          icon: Wallet, title: 'الدفع والمحفظة',
          qa: [
            { q: 'ما طرق الدفع المتاحة؟', a: 'الدفع عند الاستلام (COD) هو الأساسي. يمكن استخدام رصيد المحفظة جزئياً أو كلياً، بالإضافة إلى القسائم وأكواد الخصم.' },
            { q: 'هل بياناتي البنكية آمنة؟', a: 'لا نحفظ أي بيانات بطاقات. كل المدفوعات الإلكترونية تتم عبر بوابات معتمدة بتشفير كامل.' },
            { q: 'كيف تعمل المحفظة الإلكترونية؟', a: 'يمكنك شحن محفظتك بطرق متعددة واستخدام رصيدها لدفع أي طلب. الرصيد آمن ولا ينتهي.' },
            { q: 'كيف أستخدم كود خصم؟', a: 'في صفحة السلة، أدخل الكود في حقل "كود الخصم" واضغط "تطبيق". سيظهر الخصم فوراً قبل تأكيد الطلب.' },
            { q: 'هل يمكنني سحب رصيدي نقداً؟', a: 'الرصيد مخصص للاستخدام داخل المنصة. حالات السحب الاستثنائية تتطلب تواصل مباشر مع الدعم.' },
          ],
        },
        {
          icon: ShieldCheck, title: 'الضمان والإرجاع',
          qa: [
            { q: 'هل المنتجات أصلية ولها ضمان؟', a: 'نعم، 100% منتجاتنا أصلية بضمان رسمي. مدة الضمان وشروطه موضحة في صفحة كل منتج.' },
            { q: 'كيف أُفعّل الضمان؟', a: 'احتفظ بفاتورة الشراء (تصلك في حسابك). عند ظهور أي عطل خلال فترة الضمان، تواصل معنا لفحصه أو استبداله.' },
            { q: 'كيف أُرجع منتجاً؟', a: 'تواصل معنا عبر WhatsApp خلال 7 أيام من الاستلام إذا كان المنتج معيباً أو مختلفاً عن الموصوف. يجب أن يكون في تغليفه الأصلي.' },
            { q: 'ما المنتجات التي لا يمكن إرجاعها؟', a: 'المنتجات المخصّصة، البرامج المُفعّلة، المستهلكات المفتوحة (مثل خيوط طابعة 3D المفتوحة جزئياً).' },
            { q: 'كم تستغرق عملية الاسترداد؟', a: 'بعد استلام المنتج وفحصه، يُرد المبلغ خلال 3-7 أيام عمل (لرصيد المحفظة أو طريقة الدفع الأصلية).' },
          ],
        },
        {
          icon: UserCog, title: 'الحساب والأمان',
          qa: [
            { q: 'كيف أُغيّر كلمة المرور؟', a: 'من الإعدادات > الأمان > تغيير كلمة المرور. ستحتاج رمز تحقق يُرسل لبريدك.' },
            { q: 'نسيت كلمة المرور — ماذا أفعل؟', a: 'في صفحة تسجيل الدخول اضغط "نسيت كلمة المرور" وأدخل بريدك. سيصلك رابط لإعادة التعيين.' },
            { q: 'كيف أحذف حسابي؟', a: 'تواصل معنا عبر WhatsApp مع طلب الحذف. نُنفّذه خلال 30 يوماً مع الاحتفاظ ببيانات الطلبات الضرورية قانونياً.' },
            { q: 'هل بياناتي آمنة؟', a: 'نعم — نستخدم تشفير كامل (HTTPS، bcrypt للكلمات السرية)، Row-Level Security، ومراقبة لحظية. اطلع على سياسة الخصوصية للتفاصيل.' },
          ],
        },
        {
          icon: Gamepad2, title: 'الألعاب والمكافآت',
          qa: [
            { q: 'كيف أكسب نقاط ومكافآت؟', a: 'كل عملية شراء تمنحك نقاطاً. كذلك العب في صفحة الألعاب لربح نقاط وتذاكر وقسائم خصم وجوائز عينية.' },
            { q: 'ما الفرق بين النقاط والتذاكر؟', a: 'النقاط: عملة افتراضية تُستبدل بقسائم خصم. التذاكر: تُستخدم للدخول في المسابقات الكبرى للفوز بجوائز.' },
            { q: 'هل المسابقات حقيقية؟', a: 'نعم 100% — كل المسابقات لها مكاسب حقيقية وأسماء الفائزين معلنة.' },
            { q: 'كيف أعرف نتائج المسابقات؟', a: 'تظهر النتائج فور انتهاء المسابقة في صفحة المسابقة وعبر إشعار في حسابك.' },
            { q: 'هل يمكنني استبدال النقاط بنقد؟', a: 'لا، النقاط والتذاكر تُستبدل بقسائم وجوائز فقط، وليست عملة قانونية.' },
          ],
        },
        {
          icon: Store, title: 'مجتمع التجار',
          qa: [
            { q: 'كيف أصبح تاجراً معتمداً؟', a: 'تقدّم بطلب التسجيل من صفحة "كن تاجراً". بعد المراجعة من فريقنا (عادة 1-3 أيام) يتم تفعيل حسابك.' },
            { q: 'ما العمولة على المبيعات؟', a: 'العمولة تختلف حسب فئة التاجر والمنتج. تواصل معنا للتفاصيل الكاملة.' },
            { q: 'كيف أتلقى مدفوعاتي كتاجر؟', a: 'تُحوَّل الأرباح لمحفظتك بعد تأكيد استلام العميل. يمكن سحبها بعد فترة محددة وفق سياسة التجار.' },
            { q: 'هل يمكنني عرض خدمات (وليس منتجات)؟', a: 'نعم، نظام طلبات الطباعة المخصّصة وخدمات التجار مفتوح لكلا النوعين.' },
          ],
        },
        {
          icon: Smartphone, title: 'تطبيق الموبايل',
          qa: [
            { q: 'هل لديكم تطبيق رسمي؟', a: 'نعم، تطبيق LEVONIS متاح للأندرويد. يمكن تحميله من صفحة "تحميل التطبيق".' },
            { q: 'هل التطبيق مجاني؟', a: 'نعم، التطبيق مجاني تماماً ويعمل بدون إعلانات.' },
            { q: 'هل يوجد تطبيق iOS؟', a: 'حالياً متاح لأجهزة Android فقط. نسخة iOS قيد التطوير وستُعلَن قريباً.' },
            { q: 'لماذا أُحمّل التطبيق بدلاً من الموقع؟', a: 'التطبيق أسرع، يدعم الإشعارات الفورية للطلبات والعروض، ويوفر تجربة محسّنة للموبايل.' },
            { q: 'كيف أُحدّث التطبيق؟', a: 'ستصلك إشعار داخل التطبيق عند توفر تحديث، أو ارجع لصفحة التحميل لأخذ آخر نسخة.' },
          ],
        },
      ],
    },
    en: {
      title: 'FAQ',
      desc: 'Comprehensive answers to the most common questions about LEVONIS — shopping, delivery, payment, warranty, account, games, and the app.',
      searchPh: 'Search the FAQ...',
      noResults: 'No matching results. Try another keyword.',
      stillNeed: 'Didn’t find your answer?',
      contactBtn: 'Contact via WhatsApp',
      groups: [
        {
          icon: ShoppingCart, title: 'Orders & Shopping',
          qa: [
            { q: 'How do I place an order?', a: 'Pick the product, add to cart, go to cart, complete delivery info, choose payment, then "Confirm Order". You will receive a confirmation when accepted.' },
            { q: 'Can I edit or cancel an order after placing it?', a: 'Yes, as long as the order has not entered the "Preparing" stage. Contact us via WhatsApp with your order number.' },
            { q: 'Do I need an account to buy?', a: 'Yes — an account lets you track orders, earn points, and activate product warranty.' },
            { q: 'Can I order in wholesale quantities?', a: 'Yes, contact us directly for wholesale pricing.' },
            { q: 'Why was my order auto-cancelled?', a: 'Possible reasons: sudden stock-out, inability to reach you, or address error. We will notify you of the reason.' },
          ],
        },
        {
          icon: Truck, title: 'Delivery & Pickup',
          qa: [
            { q: 'How long does delivery take?', a: 'Baghdad: 1-3 business days. Other governorates: 3-7. Each product page shows its estimate. Pre-orders may take longer.' },
            { q: 'What delivery options are available?', a: '(1) Free warehouse pickup, (2) standard delivery at fixed governorate rates, (3) personal delivery (faster, higher cost).' },
            { q: 'Do you ship outside Baghdad?', a: 'Yes, we serve all 18 Iraqi governorates.' },
            { q: 'How do I track my order?', a: 'From "My Orders" you see stages: New → Preparing → Out for delivery → Delivered. Telegram notifications also available.' },
            { q: 'What if the courier cannot reach me?', a: 'The courier will call first. If unreachable, the order returns to warehouse and we contact you to reschedule.' },
          ],
        },
        {
          icon: Wallet, title: 'Payment & Wallet',
          qa: [
            { q: 'What payment methods do you accept?', a: 'Cash on Delivery (COD) is primary. Wallet balance can be used partially or fully, plus coupons and discount codes.' },
            { q: 'Is my payment data safe?', a: 'We never store card data. All electronic payments go through certified gateways with full encryption.' },
            { q: 'How does the e-wallet work?', a: 'You can top up your wallet via several methods and use the balance for any order. Balance is safe and never expires.' },
            { q: 'How do I use a discount code?', a: 'On the cart page, enter the code in the "Discount Code" field and click Apply. The discount appears immediately before confirmation.' },
            { q: 'Can I cash out my wallet?', a: 'Wallet balance is for in-platform use. Exceptional withdrawals require direct contact with support.' },
          ],
        },
        {
          icon: ShieldCheck, title: 'Warranty & Returns',
          qa: [
            { q: 'Are products original with warranty?', a: 'Yes, 100% original with official warranty. Period and conditions are on each product page.' },
            { q: 'How do I activate my warranty?', a: 'Keep your invoice (in your account). When a defect appears within the warranty period, contact us for inspection or replacement.' },
            { q: 'How do I return a product?', a: 'Contact us via WhatsApp within 7 days of receipt if defective or different from description. Must be in original packaging.' },
            { q: 'Which products cannot be returned?', a: 'Custom products, activated software, opened consumables (like partially used 3D printer filaments).' },
            { q: 'How long do refunds take?', a: 'After receiving and inspecting the product, refund is processed in 3-7 business days (to wallet or original payment method).' },
          ],
        },
        {
          icon: UserCog, title: 'Account & Security',
          qa: [
            { q: 'How do I change my password?', a: 'Settings > Security > Change Password. A verification code is sent to your email.' },
            { q: 'I forgot my password — what do I do?', a: 'On the login page click "Forgot Password" and enter your email. A reset link will be sent.' },
            { q: 'How do I delete my account?', a: 'Contact us via WhatsApp with a deletion request. We process within 30 days, keeping order data legally required.' },
            { q: 'Is my data safe?', a: 'Yes — full encryption (HTTPS, bcrypt for passwords), Row-Level Security, and real-time monitoring. See Privacy Policy for details.' },
          ],
        },
        {
          icon: Gamepad2, title: 'Games & Rewards',
          qa: [
            { q: 'How do I earn points and rewards?', a: 'Every purchase earns points. You can also play games for points, tickets, discount coupons, and physical prizes.' },
            { q: 'What is the difference between points and tickets?', a: 'Points: virtual currency exchanged for discount coupons. Tickets: used to enter big competitions for prizes.' },
            { q: 'Are competitions real?', a: 'Yes 100% — all competitions have real prizes and winner names are published.' },
            { q: 'How do I see competition results?', a: 'Results appear immediately after the competition ends on the competition page and via account notification.' },
            { q: 'Can I exchange points for cash?', a: 'No, points and tickets can be exchanged only for coupons and prizes — not legal tender.' },
          ],
        },
        {
          icon: Store, title: 'Merchant Marketplace',
          qa: [
            { q: 'How do I become a verified merchant?', a: 'Apply from the "Become a Merchant" page. After review by our team (typically 1-3 days) your account is activated.' },
            { q: 'What is the sales commission?', a: 'Commission varies by merchant tier and product. Contact us for full details.' },
            { q: 'How do merchants get paid?', a: 'Earnings are credited to your wallet after customer receipt confirmation. Withdrawable after a set period per merchant policy.' },
            { q: 'Can I offer services (not just products)?', a: 'Yes, the custom print request system and merchant services support both.' },
          ],
        },
        {
          icon: Smartphone, title: 'Mobile App',
          qa: [
            { q: 'Do you have an official app?', a: 'Yes, the LEVONIS app is available for Android. Download from the "Download App" page.' },
            { q: 'Is the app free?', a: 'Yes, the app is completely free with no ads.' },
            { q: 'Is there an iOS app?', a: 'Currently Android only. iOS version is in development and will be announced soon.' },
            { q: 'Why download the app instead of using the website?', a: 'The app is faster, supports instant push notifications for orders and offers, and provides a smoother mobile experience.' },
            { q: 'How do I update the app?', a: 'You will get an in-app notification when an update is available, or revisit the download page for the latest version.' },
          ],
        },
      ],
    },
    ku: {
      title: 'پرسیارە دووبارەکان',
      desc: 'وەڵامی تەواو بۆ پرسیارە بەردەوامەکان دەربارەی LEVONIS.',
      searchPh: 'گەڕان لە پرسیارەکاندا...',
      noResults: 'هیچ ئەنجامێک نەدۆزرایەوە.',
      stillNeed: 'وەڵامی پرسیارەکەت نەدۆزیتەوە؟',
      contactBtn: 'پەیوەندی لە WhatsApp',
      groups: [
        {
          icon: ShoppingCart, title: 'داواکاری و کڕین',
          qa: [
            { q: 'چۆن داواکاری دەکەم؟', a: 'بەرهەم هەڵبژێرە، زیادی بکە بۆ سەبەتە، و دڵنیایی بکە.' },
            { q: 'دەتوانم داواکاری بگۆڕم؟', a: 'بەڵێ، تا کاتێک نەچووەتە قۆناغی ئامادەکردن.' },
          ],
        },
        {
          icon: Truck, title: 'گەیاندن',
          qa: [
            { q: 'گەیاندن چەند دەخایەنێت؟', a: 'بەغدا: ١-٣ ڕۆژ. پارێزگاکانی تر: ٣-٧.' },
            { q: 'چ بژاردەی گەیاندن هەیە؟', a: 'وەرگرتن لە کۆگا، گەیاندنی ئاسایی، و گەیاندنی تایبەت.' },
          ],
        },
        {
          icon: Wallet, title: 'پارەدان',
          qa: [
            { q: 'چ ڕێگای پارەدان هەیە؟', a: 'پارەدان لە کاتی وەرگرتن و باڵانسی جزدان.' },
          ],
        },
        {
          icon: ShieldCheck, title: 'گەرەنتی',
          qa: [
            { q: 'بەرهەمەکان گەرەنتییان هەیە؟', a: 'بەڵێ، گەرەنتی فەرمی.' },
          ],
        },
        {
          icon: Smartphone, title: 'ئەپ',
          qa: [
            { q: 'ئەپتان هەیە؟', a: 'بەڵێ، بۆ ئەندرۆید لە لاپەڕەی دابەزاندنی ئەپ.' },
          ],
        },
      ],
    },
  }[language === 'en' ? 'en' : language === 'ku' ? 'ku' : 'ar'];

  const dir = language === 'en' ? 'ltr' : 'rtl';

  // Filter by query — searches both q and a across all groups
  const filtered = useMemo(() => {
    if (!query.trim()) return c.groups;
    const q = query.trim().toLowerCase();
    return c.groups
      .map(g => ({ ...g, qa: g.qa.filter(it => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q)) }))
      .filter(g => g.qa.length > 0);
  }, [query, c.groups]);

  // Flat list for FAQ schema
  const allQa = c.groups.flatMap(g => g.qa);

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
          faqLd(allQa),
        ]}
      />
      <main className="container mx-auto px-4 py-10 max-w-3xl">
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="glass-icon-btn w-11 h-11" aria-hidden="true">
              <HelpCircle className="w-5 h-5 text-primary" />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-foreground">{c.title}</h1>
          </div>
          <p className="text-muted-foreground">{c.desc}</p>
        </header>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute top-1/2 -translate-y-1/2 start-3 w-4 h-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={c.searchPh}
            className="ps-9"
            aria-label={c.searchPh}
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl glass-tile p-8 text-center text-foreground/70">
            {c.noResults}
          </div>
        ) : (
          <div className="space-y-5">
            {filtered.map((g, gi) => {
              const Icon = g.icon;
              return (
                <section key={gi} className="rounded-2xl glass-tile glass-edge-top p-4 md:p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="glass-icon-btn w-9 h-9" aria-hidden="true">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <h2 className="text-lg font-bold text-foreground">{g.title}</h2>
                  </div>
                  <Accordion type="single" collapsible className="w-full">
                    {g.qa.map((it, i) => (
                      <AccordionItem key={i} value={`g${gi}-q${i}`} className="border-border/40">
                        <AccordionTrigger className="text-start font-bold text-foreground hover:text-primary">
                          {it.q}
                        </AccordionTrigger>
                        <AccordionContent className="text-foreground/80 leading-relaxed">
                          {it.a}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </section>
              );
            })}
          </div>
        )}

        {/* Still need help CTA */}
        <section className="mt-8 rounded-2xl glass-tile glass-edge-top p-6 text-center">
          <h2 className="text-lg font-bold text-foreground mb-3">{c.stillNeed}</h2>
          <a
            href="https://wa.me/9647838455220"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold backdrop-blur-xl border border-primary/40 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_24px_-4px_hsl(var(--primary)/0.65)] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {c.contactBtn}
          </a>
        </section>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
          <Link to="/about" className="text-primary hover:underline">{language === 'en' ? 'About' : language === 'ku' ? 'دەربارە' : 'من نحن'}</Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/privacy" className="text-primary hover:underline">{language === 'en' ? 'Privacy' : language === 'ku' ? 'تایبەتمەندی' : 'سياسة الخصوصية'}</Link>
          <span className="text-muted-foreground">•</span>
          <Link to="/terms" className="text-primary hover:underline">{language === 'en' ? 'Terms' : language === 'ku' ? 'مەرجەکان' : 'الشروط والأحكام'}</Link>
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Faq;
