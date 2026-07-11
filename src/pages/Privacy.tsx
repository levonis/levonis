import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import Footer from '@/components/Footer';
import { breadcrumbLd } from '@/lib/seo/structured';
import {
  ShieldCheck, Database, Cookie, Lock, UserCheck, Globe, Bell, Baby, RefreshCw, Mail,
  Wallet, CreditCard, Gamepad2, Trophy, MessageCircle, Camera, MapPin, Smartphone,
  Share2, FileText, Eye, AlertTriangle, Server, Key, Users, Printer, Wrench, Gift,
  Megaphone, Search, Scale, Fingerprint, Building2, Phone, Cloud, Activity, Ban,
} from 'lucide-react';

const Privacy = () => {
  const { language } = useLanguage();

  const c = {
    ar: {
      title: 'سياسة الخصوصية',
      desc: 'كيف يجمع LEVONIS بياناتك ويستخدمها ويحميها — سياسة شاملة وشفافة.',
      updated: 'آخر تحديث: 2026-04-26',
      intro: 'في LEVONIS نُقدّر خصوصيتك ونتعامل مع بياناتك وفقاً لأعلى معايير الأمان والشفافية. توضّح هذه السياسة بالتفصيل الكامل ما نجمعه ولماذا، وكيف يُعالج، ومع من يُشارك، وما هي حقوقك القانونية، وكيف تتحكم بكل شيء يتعلق ببياناتك عبر منصة LEVONIS (الموقع، التطبيق، البوتات، والقنوات الرسمية).',
      sections: [
        { icon: FileText, h: '1. نطاق السياسة', p: 'تُطبَّق هذه السياسة على جميع خدمات LEVONIS بما فيها: الموقع (levonisiq.com)، تطبيق Android، حساب المستخدم، نظام المحفظة، الألعاب والمسابقات، خدمات الطباعة ثلاثية الأبعاد، الصيانة، المجتمع التجاري، عضوية VIP Plus، وبرامج الإحالة. باستخدامك أي من هذه الخدمات فإنك توافق على هذه السياسة.' },
        { icon: Database, h: '2. بيانات الحساب الأساسية', p: 'نجمع: الاسم الكامل، اسم المستخدم، رقم الهاتف، البريد الإلكتروني، كلمة المرور (مُشفّرة بـ bcrypt)، تاريخ الميلاد، الجنس (اختياري)، صورة البروفايل، إطار الأفاتار، السيرة الذاتية، اللغة المفضلة، والمنطقة الزمنية. هذه البيانات ضرورية لإنشاء وإدارة حسابك.' },
        { icon: MapPin, h: '3. بيانات العنوان والتوصيل', p: 'نخزّن: المحافظة، المنطقة، الحي، أقرب نقطة دالة، رقم المنزل، إحداثيات GPS (إن مُنحت)، أرقام هواتف بديلة للتوصيل، وملاحظات خاصة بالمندوب. تُستخدم حصراً لإيصال طلباتك وحماية حقوقك في حال النزاع.' },
        { icon: CreditCard, h: '4. بيانات الدفع والمعاملات', p: 'نجمع: طريقة الدفع المختارة (نقدي عند الاستلام، محفظة، تحويل)، إثبات الدفع (صور الإيصالات)، رقم المعاملة، المبلغ، تاريخ ووقت العملية. لا نخزّن أرقام بطاقاتك الائتمانية الكاملة — تُعالَج عبر بوابات دفع معتمدة وخاضعة لمعيار PCI-DSS.' },
        { icon: Wallet, h: '5. المحفظة الإلكترونية والـ PIN', p: 'محفظة LEVONIS تُسجّل: الرصيد، تاريخ كل عملية شحن/خصم، رمز PIN مُشفّر باستخدام pgcrypto + bcrypt، عدد محاولات الإدخال الفاشلة، وحالة القفل المؤقت. لا نطّلع أبداً على PIN الخاص بك بصيغته الواضحة، ولا نستطيع استرجاعه — يمكن إعادة تعيينه فقط عبر التحقق من الهوية.' },
        { icon: FileText, h: '6. بيانات الطلبات والمعاملات', p: 'لكل طلب نخزّن: المنتجات المختارة، الكميات، الأسعار، الخصومات، رمز الكوبون، عنوان التسليم، حالة الطلب (pending/confirmed/shipped/delivered)، تاريخ كل تحديث، ملاحظاتك، تقييمك، صور التغليف (إن لزم)، وسجل المراسلات مع الإدارة. نحتفظ بهذه البيانات لأغراض محاسبية وقانونية.' },
        { icon: Gamepad2, h: '7. بيانات الألعاب والمسابقات', p: 'نسجّل: نتائج كل جلسة لعب (Crossy Road، Stack، Mystery Case، Space Blaster، Tower)، الخطوات، النقاط، العملات المجمّعة، عدد التذاكر المستخدمة في المسابقات، الجوائز التي ربحتها، وقت اللعب، ولوحات الصدارة. تُعرض بعض هذه البيانات (الاسم والنتيجة) علناً عبر دالة آمنة (get_public_profiles) ضمن لوحات الصدارة.' },
        { icon: Trophy, h: '8. نظام الولاء والنقاط', p: 'نتتبّع: مجموع نقاط الولاء (XP) لكل دينار أُنفِق، المستوى الحالي، تقدمك ضمن المستوى، التذاكر المُكتسبة، المكافآت المُطالَب بها، سجل تغيير المستويات، واستخدام بطاقات الولاء (Bronze/Silver/Gold/Platinum) مع حدود الخصم لكل قسم.' },
        { icon: Gift, h: '9. الإحالات والإهداء', p: 'عند استخدامك لرمز إحالة أو إهداء بطاقة/طلب: نجمع المعرّف الخاص بك ومعرّف المستلم/المُحيل، قيمة المكافأة، تاريخ التفعيل، ورسائل الإهداء الاختيارية. هذه البيانات ضرورية لاحتساب عمولات الإحالة بشكل صحيح.' },
        { icon: MessageCircle, h: '10. المحادثات والدعم', p: 'محادثاتك مع الإدارة، الفنيين (الصيانة)، والتجار في المجتمع تُخزّن مع: محتوى النص، الصور المرفقة، التواريخ، حالة القراءة. تُستخدم لحل النزاعات وتحسين الخدمة. لا يطّلع عليها سوى الأطراف المعنية والإدارة المخوّلة.' },
        { icon: Printer, h: '11. خدمات الطباعة 3D والصيانة', p: 'لطلبات الطباعة 3D نجمع: ملفات النماذج المرفوعة، الأبعاد، اللون، نوع الفلامنت، الكمية، صور مرجعية، ومحادثات العروض. لطلبات الصيانة نخزّن: نوع المنتج، الرقم التسلسلي، حالة الضمان، صور العطل، وتقرير الفني.' },
        { icon: Building2, h: '12. حسابات التجار والمجتمع', p: 'إذا انضممت كتاجر أو مزوّد طباعة، نجمع إضافياً: اسم المتجر، الوصف، صورة الواجهة، فئات الخدمة، تقييمات العملاء، إجمالي الطلبات المُنجزة، الإيرادات، ومعدل الاستجابة. تظهر بعض هذه البيانات للعموم لمساعدة المشترين على الاختيار.' },
        { icon: Smartphone, h: '13. البيانات التقنية والجهاز', p: 'نلتقط تلقائياً: نوع الجهاز، الموديل، نظام التشغيل ونسخته، نسخة المتصفح، دقّة الشاشة، عنوان IP، مزوّد الإنترنت (ISP)، اللغة، المنطقة الزمنية، معرّفات الجلسة، وملفات تعريف الارتباط. تساعدنا على تحسين الأداء واكتشاف الاحتيال.' },
        { icon: Activity, h: '14. بيانات الاستخدام والسلوك', p: 'نسجّل: الصفحات التي تزورها، المنتجات التي تشاهدها أو تضيفها للمفضلة، نتائج البحث، النقرات على البنرات والإعلانات، مدة الجلسات، مسار التنقّل، السلال المهجورة، وتفاعلك مع الإشعارات. تُستخدم لتخصيص التوصيات والعروض.' },
        { icon: Camera, h: '15. الصور والملفات المرفوعة', p: 'نخزّن أي ملف ترفعه: صور البروفايل والإطارات، إثبات الدفع، صور المنتجات في مجتمع البيع، نماذج 3D، صور أعطال الصيانة، صور باركود الضمان، وصور الشكاوى. تُحفظ في مساحات تخزين سحابية مؤمّنة (Supabase Storage) بسياسات RLS صارمة.' },
        { icon: Bell, h: '16. الإشعارات والمراسلات', p: 'نُرسل لك: إشعارات الطلبات (شحن، توصيل، إلغاء)، إشعارات المسابقات والجوائز، تحديثات النظام، عروض ترويجية اختيارية، رسائل عبر التطبيق، البريد، WhatsApp، أو Telegram. يمكنك إيقاف الرسائل التسويقية من إعدادات الإشعارات في حسابك.' },
        { icon: Cookie, h: '17. ملفات تعريف الارتباط (Cookies)', p: 'نستخدم ثلاثة أنواع: (أ) ضرورية — للجلسات، السلة، تفضيل اللغة، الثيم، لا يمكن تعطيلها. (ب) تحليلية — لقياس الأداء وعدد الزوار. (ج) تسويقية — لتخصيص الإعلانات. يمكنك إدارتها من متصفحك. التعطيل قد يؤثر على بعض الميزات.' },
        { icon: Server, h: '18. مزوّدو الخدمة الخارجيون', p: 'نتعاون مع: Supabase (قاعدة البيانات والتخزين والمصادقة)، Cloudflare (الحماية وتسريع التحميل)، Lovable AI Gateway (الذكاء الاصطناعي)، Telegram Bot API (الإشعارات الإدارية)، خدمات Google (Maps لتحديد العنوان)، شركات شحن محلية. جميعهم خاضعون لاتفاقيات معالجة بيانات (DPA) صارمة.' },
        { icon: Share2, h: '19. مشاركة البيانات', p: 'لا نبيع بياناتك أبداً. نُشاركها فقط مع: (1) شركاء التوصيل لإيصال الطلب. (2) بوابات الدفع المعتمدة لإتمام المعاملات. (3) التجار/مزوّدي الطباعة الذين تتعامل معهم (الاسم والعنوان فقط). (4) السلطات الحكومية بموجب أمر قضائي رسمي. (5) في حالة اندماج/استحواذ مع إشعار مسبق.' },
        { icon: Lock, h: '20. حماية البيانات والأمان', p: 'نطبّق طبقات حماية متعددة: تشفير TLS 1.3 لكل الاتصالات، bcrypt + pgcrypto لكلمات المرور وأرقام PIN، Row-Level Security (RLS) لكل جدول في قاعدة البيانات، فصل صلاحيات الأدوار (Admin/User/Merchant)، نسخ احتياطية يومية مُشفّرة، جدران حماية، حماية DDoS عبر Cloudflare، ومراقبة لحظية للسلوك الشاذ.' },
        { icon: Eye, h: '21. الوصول الإداري', p: 'يقتصر الوصول إلى بياناتك الحساسة على عدد محدود من الموظفين المخوّلين الذين وقّعوا اتفاقيات سرية، ويتم تسجيل كل عملية وصول في سجلات تدقيق (audit logs) لا يمكن تعديلها.' },
        { icon: Fingerprint, h: '22. KYC والتحقق من الهوية', p: 'لبعض الخدمات الحساسة (المحفظة، عضوية VIP Plus، التجار) قد نطلب توثيق الهوية: صورة هوية، إثبات عنوان، وثائق تجارية. تُحفظ في تخزين مُشفّر معزول وتُستخدم حصراً لمنع الاحتيال وغسيل الأموال.' },
        { icon: Cloud, h: '23. النقل الدولي للبيانات', p: 'تُخزَّن بياناتك على خوادم سحابية عالمية (Supabase EU/US) قد تقع خارج العراق. جميع عمليات النقل محمية بتشفير end-to-end وعقود معالجة بيانات (Standard Contractual Clauses) وفقاً لمعايير GDPR.' },
        { icon: RefreshCw, h: '24. مدة الاحتفاظ بالبيانات', p: 'بيانات الحساب: طوال فترة استخدامك. الطلبات والمعاملات المالية: 7 سنوات (متطلب قانوني/ضريبي عراقي). محادثات الدعم: 3 سنوات. سجلات الألعاب: 2 سنة. ملفات تعريف الارتباط التحليلية: حتى 13 شهراً. عند الحذف الكامل نحتفظ فقط بالحد الأدنى الإلزامي قانونياً.' },
        { icon: UserCheck, h: '25. حقوقك القانونية', p: 'لك الحق المطلق في: (1) الاطلاع على بياناتك. (2) تصحيحها. (3) حذفها (الحق في النسيان). (4) تقييد المعالجة. (5) الاعتراض على المعالجة. (6) سحب الموافقة. (7) نقل بياناتك (Data Portability). (8) عدم الخضوع لقرارات آلية حصراً. للتنفيذ تواصل عبر privacy@levonisiq.com — نُجيب خلال 30 يوماً.' },
        { icon: Ban, h: '26. حذف الحساب', p: 'يمكنك حذف حسابك من إعدادات البروفايل أو بطلب عبر الدعم. خلال 30 يوماً نحذف: بياناتك الشخصية، المحادثات، الصور، المفضلة، السلة. نحتفظ فقط بسجلات الطلبات والمعاملات المالية لمدة 7 سنوات (التزام قانوني) دون ربطها بمعلوماتك الشخصية المباشرة.' },
        { icon: Baby, h: '27. خصوصية الأطفال', p: 'خدماتنا موجّهة لمن أعمارهم 13 سنة فأكبر. لا نجمع عمداً بيانات قاصرين دون 13. إذا اكتشفنا ذلك، نحذف الحساب فوراً. الأهالي الذين يكتشفون أن أطفالهم سجّلوا بدون إذن يمكنهم التواصل معنا للحذف الفوري.' },
        { icon: Users, h: '28. الملفات العامة والمجتمع', p: 'يمكن للمستخدمين الآخرين رؤية: اسم المستخدم، صورة البروفايل، إطار الأفاتار، السيرة، التقييمات العامة، إنجازات الألعاب، ومنشورات المجتمع. يمكنك التحكم بمستوى ظهور بعض هذه العناصر من إعدادات الخصوصية في حسابك.' },
        { icon: Megaphone, h: '29. التسويق والإعلانات', p: 'قد نعرض لك إعلانات مخصصة بناءً على اهتماماتك واستخدامك للمنصة. كما قد نُرسل عروضاً ترويجية. يمكنك إيقاف التسويق المخصص في أي وقت من إعدادات الإشعارات أو بالضغط على "إلغاء الاشتراك".' },
        { icon: Search, h: '30. التحليلات والتطوير', p: 'نستخدم بيانات مجمّعة ومُجهّلة الهوية (anonymized) لفهم سلوك المستخدمين، اختبار ميزات جديدة (A/B Testing)، تحسين تجربة المستخدم، واكتشاف الأعطال. لا تُربط هذه التحليلات بهويتك الشخصية.' },
        { icon: AlertTriangle, h: '31. الإبلاغ عن خروقات البيانات', p: 'في حال حدوث أي خرق أمني قد يُعرّض بياناتك للخطر، نلتزم بإعلامك خلال 72 ساعة من اكتشافه عبر البريد الإلكتروني وإشعار داخل التطبيق، مع توضيح طبيعة الخرق والإجراءات المتخذة.' },
        { icon: Key, h: '32. التحكم بالموافقة', p: 'موافقتك مطلوبة لـ: التسويق، تخزين Cookies غير الضرورية، مشاركة الموقع الجغرافي، استخدام الكاميرا/الميكروفون. يمكنك سحب الموافقة في أي وقت من الإعدادات دون التأثير على شرعية المعالجة السابقة.' },
        { icon: Globe, h: '33. الروابط لمواقع خارجية', p: 'قد يحتوي الموقع على روابط لمنصات خارجية (يوتيوب، إنستغرام، WhatsApp). لا نتحمّل مسؤولية ممارسات الخصوصية لتلك المواقع — نوصي بمراجعة سياساتها قبل المشاركة.' },
        { icon: Scale, h: '34. القانون المعمول به', p: 'تخضع هذه السياسة للقوانين العراقية المعمول بها بشأن حماية البيانات الشخصية والتجارة الإلكترونية. أي نزاع يُحسم في محاكم بغداد المختصة. نلتزم أيضاً بمبادئ GDPR للمستخدمين الأوروبيين.' },
        { icon: RefreshCw, h: '35. تحديثات السياسة', p: 'قد نُحدّث هذه السياسة دورياً لتعكس تغييرات في خدماتنا، التقنية، أو القوانين. سنُعلمك بأي تغيير جوهري عبر إشعار بارز في الموقع/التطبيق وبريد إلكتروني قبل 30 يوماً من السريان. استمرارك في الاستخدام يعني الموافقة على التحديث.' },
        { icon: Phone, h: '36. التواصل بشأن الخصوصية', p: 'لأي استفسار، شكوى، أو ممارسة لحقوقك: WhatsApp: +964 783 845 5220 — البريد: privacy@levonisiq.com — Telegram: @LevonisSupport — أو من صفحة "اتصل بنا" داخل التطبيق. يوجد لدينا مسؤول حماية البيانات (DPO) متخصص للرد على استفساراتك.' },
      ],
    },
    en: {
      title: 'Privacy Policy',
      desc: 'How LEVONIS collects, uses, and protects your data — a comprehensive, transparent policy.',
      updated: 'Last updated: 2026-04-26',
      intro: 'At LEVONIS we value your privacy and handle your data with the highest standards of security and transparency. This policy details exactly what we collect, why, how it is processed, with whom it is shared, your legal rights, and how you control everything related to your data across the LEVONIS platform (website, app, bots, and official channels).',
      sections: [
        { icon: FileText, h: '1. Scope', p: 'This policy applies to all LEVONIS services: website (levonisiq.com), Android app, accounts, wallet, games and competitions, 3D printing services, maintenance, merchant community, VIP Plus membership, and referral programs. Using any service means accepting this policy.' },
        { icon: Database, h: '2. Account Data', p: 'We collect: full name, username, phone, email, password (bcrypt-hashed), date of birth, gender (optional), profile picture, avatar frame, bio, preferred language, and timezone.' },
        { icon: MapPin, h: '3. Address & Delivery', p: 'Governorate, area, district, nearest landmark, house number, optional GPS coordinates, alternate phone numbers, and courier notes. Used solely to deliver orders.' },
        { icon: CreditCard, h: '4. Payment & Transactions', p: 'Payment method, payment proof images, transaction ID, amount, timestamp. We never store full credit card numbers — they are processed by PCI-DSS compliant gateways.' },
        { icon: Wallet, h: '5. Wallet & PIN', p: 'Wallet balance, transaction history, PIN encrypted with pgcrypto + bcrypt, failed-attempt counters, and lock state. We never see your PIN in plaintext and cannot recover it.' },
        { icon: FileText, h: '6. Order Data', p: 'Products, quantities, prices, discounts, coupon codes, delivery address, status, timestamps, notes, ratings, packaging photos, and admin chat history. Retained for accounting and legal purposes.' },
        { icon: Gamepad2, h: '7. Games & Competitions', p: 'Session results (Crossy Road, Stack, Mystery Case, Space Blaster, Tower), steps, points, coins, tickets used, prizes won, and leaderboards. Some data (name, score) is publicly shown via a secure RPC.' },
        { icon: Trophy, h: '8. Loyalty & Points', p: 'Total XP per IQD spent, current level, level progress, earned tickets, claimed rewards, level history, and loyalty card usage with per-category discount limits.' },
        { icon: Gift, h: '9. Referrals & Gifting', p: 'Your ID and the recipient/referrer ID, reward value, activation date, and optional gift messages. Required to track referral commissions.' },
        { icon: MessageCircle, h: '10. Chats & Support', p: 'Chats with admins, technicians, and merchants are stored with text, images, timestamps, and read state. Used to resolve disputes and improve service.' },
        { icon: Printer, h: '11. 3D Printing & Maintenance', p: 'For 3D requests: uploaded model files, dimensions, color, filament, quantity, references, offer chats. For maintenance: product type, serial, warranty, fault images, technician report.' },
        { icon: Building2, h: '12. Merchants & Community', p: 'For merchants/print providers we additionally collect: store name, description, banner, service categories, reviews, completed orders, revenue, and response rate. Some data is public to help buyers choose.' },
        { icon: Smartphone, h: '13. Device & Technical', p: 'Device type, model, OS, browser, screen resolution, IP, ISP, language, timezone, session IDs, and cookies. Helps performance and fraud detection.' },
        { icon: Activity, h: '14. Usage & Behavior', p: 'Pages visited, products viewed/favorited, search queries, banner clicks, session duration, navigation paths, abandoned carts, and notification engagement. Used for personalization.' },
        { icon: Camera, h: '15. Uploaded Files', p: 'Profile pictures, frames, payment proofs, community sale photos, 3D models, maintenance fault images, warranty barcodes, and complaint photos. Stored in secure cloud storage (Supabase) with strict RLS.' },
        { icon: Bell, h: '16. Notifications', p: 'Order updates, competition/prize notices, system updates, optional promotions. Sent via in-app, email, WhatsApp, or Telegram. Marketing can be disabled in settings.' },
        { icon: Cookie, h: '17. Cookies', p: 'Three types: (a) Essential — sessions, cart, language, theme (cannot be disabled). (b) Analytics — performance and visitor counts. (c) Marketing — ad personalization. Manage from your browser.' },
        { icon: Server, h: '18. Third-Party Providers', p: 'We work with Supabase (database/storage/auth), Cloudflare (security/CDN), Lovable AI Gateway (AI), Telegram Bot API (admin notifications), Google services (Maps), and local couriers. All under strict DPAs.' },
        { icon: Share2, h: '19. Data Sharing', p: 'We never sell data. We share only with: (1) couriers, (2) certified payment gateways, (3) merchants/printers you transact with (name and address only), (4) government authorities under valid court order, (5) in case of merger/acquisition with prior notice.' },
        { icon: Lock, h: '20. Data Protection', p: 'TLS 1.3, bcrypt + pgcrypto, Row-Level Security on every table, role separation, daily encrypted backups, firewalls, Cloudflare DDoS protection, and real-time anomaly monitoring.' },
        { icon: Eye, h: '21. Administrative Access', p: 'Sensitive-data access is limited to authorized personnel under NDAs, with every access recorded in immutable audit logs.' },
        { icon: Fingerprint, h: '22. KYC & Identity Verification', p: 'For sensitive services (wallet, VIP Plus, merchants) we may request ID, address proof, and business documents. Stored in encrypted isolated storage solely for fraud and AML prevention.' },
        { icon: Cloud, h: '23. International Transfers', p: 'Data is stored on global cloud servers (Supabase EU/US) outside Iraq. All transfers protected by end-to-end encryption and Standard Contractual Clauses per GDPR.' },
        { icon: RefreshCw, h: '24. Retention', p: 'Account: while active. Orders/financial: 7 years (Iraqi tax law). Support chats: 3 years. Game logs: 2 years. Analytics cookies: up to 13 months. After deletion only the legal minimum is kept.' },
        { icon: UserCheck, h: '25. Your Rights', p: '(1) Access, (2) rectify, (3) erase, (4) restrict, (5) object, (6) withdraw consent, (7) data portability, (8) not be subject to automated decisions. Contact privacy@levonisiq.com — we respond within 30 days.' },
        { icon: Ban, h: '26. Account Deletion', p: 'Delete from profile settings or via support. Within 30 days we erase personal data, chats, photos, favorites, cart. Order/financial records are kept 7 years (legal) without direct personal links.' },
        { icon: Baby, h: '27. Children\'s Privacy', p: 'Services are for users 13+. We do not knowingly collect data from under-13s. If discovered we delete the account immediately.' },
        { icon: Users, h: '28. Public Profiles & Community', p: 'Other users can see your username, picture, frame, bio, public reviews, game achievements, and community posts. You can control visibility for some fields in privacy settings.' },
        { icon: Megaphone, h: '29. Marketing & Advertising', p: 'We may show personalized ads based on your interests and usage, and send promotional offers. You can disable personalized marketing anytime from notification settings.' },
        { icon: Search, h: '30. Analytics & Development', p: 'We use aggregated, anonymized data to understand behavior, run A/B tests, improve UX, and detect bugs. This analytics is not linked to your personal identity.' },
        { icon: AlertTriangle, h: '31. Data Breach Notification', p: 'If any breach risks your data we will notify you within 72 hours of discovery via email and in-app alert, explaining the nature and steps taken.' },
        { icon: Key, h: '32. Consent Control', p: 'Consent is required for marketing, non-essential cookies, location sharing, camera/microphone use. You can withdraw anytime without affecting the lawfulness of prior processing.' },
        { icon: Globe, h: '33. External Links', p: 'The site may link to external platforms (YouTube, Instagram, WhatsApp). We are not responsible for their privacy practices — review their policies before sharing.' },
        { icon: Scale, h: '34. Governing Law', p: 'This policy is governed by applicable Iraqi laws on personal data protection and e-commerce. Disputes are resolved in competent Baghdad courts. We also adhere to GDPR principles for EU users.' },
        { icon: RefreshCw, h: '35. Policy Updates', p: 'We may update this policy periodically. Material changes will be announced via prominent notice and email 30 days before effect. Continued use means acceptance.' },
        { icon: Phone, h: '36. Privacy Contact', p: 'WhatsApp: +964 783 845 5220 — Email: privacy@levonisiq.com — Telegram: @LevonisSupport — or via "Contact Us". A dedicated Data Protection Officer (DPO) handles inquiries.' },
      ],
    },
    ku: {
      title: 'سیاسەتی تایبەتمەندی',
      desc: 'چۆن LEVONIS داتاکانت کۆدەکاتەوە و دەیپارێزێت — سیاسەتێکی تەواو و ڕوون.',
      updated: 'دوایین نوێکردنەوە: 2026-04-26',
      intro: 'لە LEVONIS داتاکانت بەرز ڕێز دەگرین و بە بەرزترین ستانداردی پاراستن مامەڵەی لەگەڵ دەکەین. ئەم سیاسەتە بە وردی ڕوون دەکاتەوە چی کۆدەکەینەوە و بۆچی، چۆن بەکاردێت و مافەکانت چین.',
      sections: [
        { icon: FileText, h: '١. بەرفراوانی سیاسەت', p: 'ئەم سیاسەتە بۆ هەموو خزمەتگوزاریەکانی LEVONIS بەکاردێت: ماڵپەڕ، ئەپ، حساب، جزدان، یاری، چاپی ٣D، چاکسازی، کۆمەڵگای بازرگانان، و VIP Plus.' },
        { icon: Database, h: '٢. داتای حساب', p: 'ناو، ناوی بەکارهێنەر، ژمارە، ئیمەیڵ، ووشەی نهێنی شفرەکراو، مێژووی لەدایکبوون، وێنە، چوارچێوە، زمان.' },
        { icon: MapPin, h: '٣. ناونیشان', p: 'پارێزگا، ناوچە، گەڕەک، نزیکترین خاڵی نیشاندەر، ژمارەی ماڵ، GPS (ئارەزوومەندانە) و ژمارەی پەیوەندی جێگرەوە.' },
        { icon: CreditCard, h: '٤. پارەدان', p: 'شێوازی پارەدان، وێنەی پسوولە، ژمارەی مامەڵە و بڕی پارە. ژمارەی کارتی ئەسڵی هەرگیز هەڵناگیرێت.' },
        { icon: Wallet, h: '٥. جزدان و PIN', p: 'باڵانس، مێژووی مامەڵەکان، PIN بە pgcrypto + bcrypt شفرەکراو. PIN بە شێوەی ڕوون نابینین.' },
        { icon: FileText, h: '٦. داتای داواکاری', p: 'بەرهەمەکان، بڕەکان، نرخ، داشکاندن، کۆد، ناونیشان، دۆخ، تێبینی، هەڵسەنگاندن و گفتوگۆی پشتگیری.' },
        { icon: Gamepad2, h: '٧. یاری و پێشبڕکێ', p: 'ئەنجامی یاریەکان، خاڵ، پارە، تیکێت، خەڵات، و لیستی پێشەنگ. هەندێ داتا بەشێوەی گشتی پیشاندەدرێت.' },
        { icon: Trophy, h: '٨. وەفاداری و خاڵ', p: 'کۆی XP، ئاست، تیکێتە بەدەستهاتووەکان، خەڵاتەکان، و بەکارهێنانی کارتی وەفاداری.' },
        { icon: Gift, h: '٩. ڕەفەرال و دیاری', p: 'ID، ID وەرگر/ناردکار، بڕی خەڵات، مێژوو و پەیامی دیاری.' },
        { icon: MessageCircle, h: '١٠. گفتوگۆ', p: 'گفتوگۆ لەگەڵ بەڕێوەبەران، تەکنیسیەنەکان، و بازرگانان دەهێڵدرێتەوە بۆ چارەسەری ناکۆکی.' },
        { icon: Printer, h: '١١. چاپ و چاکسازی', p: 'فایلی نمونە، ڕەنگ، فلامێنت، بڕ، وێنەی تێکچوون و ڕاپۆرتی تەکنیسیەن.' },
        { icon: Building2, h: '١٢. بازرگانان', p: 'ناوی فرۆشگا، وەسف، وێنە، هەڵسەنگاندن، داواکاری تەواوبوو و ڕێژەی وەڵامدانەوە.' },
        { icon: Smartphone, h: '١٣. تەکنیکی', p: 'جۆری ئامێر، OS، براوزەر، IP، ISP، زمان، ID جلسە و کوکیەکان.' },
        { icon: Activity, h: '١٤. بەکارهێنان', p: 'پەڕەی سەردان، بەرهەمەکان، گەڕانەکان، کلیک و سەبەتە بەجێهێشتراوەکان.' },
        { icon: Camera, h: '١٥. فایلە بارکراوەکان', p: 'وێنەی پرۆفایل، پسوولە، فرۆشتنی کۆمەڵگا، نموونەی ٣D، بارکۆد و سکاڵا.' },
        { icon: Bell, h: '١٦. ئاگادارکردنەوە', p: 'نوێکردنەوەی داواکاری، پێشبڕکێ، خەڵات، نوێکاریەکان، و بانگەشەی هەڵبژاردە.' },
        { icon: Cookie, h: '١٧. کوکیەکان', p: 'پێویست، شیکاری، و بازرگانی. لە براوزەر دەتوانیت کۆنترۆڵیان بکەیت.' },
        { icon: Server, h: '١٨. دابینکەرە دەرەکیەکان', p: 'Supabase, Cloudflare, Lovable AI, Telegram, Google Maps و کۆمپانیای گەیاندنی ناوخۆیی.' },
        { icon: Share2, h: '١٩. هاوبەشکردن', p: 'داتاکانت نافرۆشین. تەنها لەگەڵ گەیاندنکار، گەیتوەی پارەدان، بازرگانان و دەسەڵاتە یاسایەکان لەو کاتەی کە داوای فەرمی هەبێت.' },
        { icon: Lock, h: '٢٠. پاراستن', p: 'TLS 1.3، bcrypt، RLS، نوسخەی پاشەکەوت، Cloudflare DDoS و چاودێری بەردەوام.' },
        { icon: Eye, h: '٢١. دەستڕاگەیشتنی بەڕێوەبەران', p: 'تەنها بۆ کارمەندە مۆڵەتدارەکان و هەموو دەستڕاگەیشتنێک تۆمار دەکرێت.' },
        { icon: Fingerprint, h: '٢٢. KYC', p: 'بۆ خزمەتگوزارییە هەستیارەکان لەوانەیە داوای ناسنامە و بەڵگەی ناونیشان بکەین.' },
        { icon: Cloud, h: '٢٣. گواستنەوەی نێودەوڵەتی', p: 'سێرڤەرە جیهانیەکانی Supabase EU/US بە end-to-end شفرەکراو.' },
        { icon: RefreshCw, h: '٢٤. ماوەی هەڵگرتن', p: 'حساب: لە کاتی چالاکی. مالی: ٧ ساڵ. گفتوگۆ: ٣ ساڵ. یاری: ٢ ساڵ.' },
        { icon: UserCheck, h: '٢٥. مافەکانت', p: 'بینین، چاککردن، سڕینەوە، گواستنەوە، و گەڕاندنەوەی ڕەزامەندی. وەڵام لە ٣٠ ڕۆژدا.' },
        { icon: Ban, h: '٢٦. سڕینەوەی حساب', p: 'لە ڕێگەی ڕێکخستن یان پشتگیری. لە ٣٠ ڕۆژدا داتای کەسی دەسڕێتەوە.' },
        { icon: Baby, h: '٢٧. منداڵان', p: 'خزمەتگوزاریەکان بۆ ١٣ ساڵ بەرەو سەرە.' },
        { icon: Users, h: '٢٨. پرۆفایلی گشتی', p: 'بەکارهێنەرانی تر دەتوانن ناو، وێنە، چوارچێوە و دەستکەوتەکانت ببینن.' },
        { icon: Megaphone, h: '٢٩. بازاڕکردن', p: 'لەوانەیە بانگەشەی تایبەت پیشانبدەین. دەتوانیت لێی ڕابگریت.' },
        { icon: Search, h: '٣٠. شیکاری', p: 'داتای کۆکراوە و ناشکراوە بۆ باشترکردنی ئەزموون.' },
        { icon: AlertTriangle, h: '٣١. ئاگادارکردنەوەی داتا', p: 'لە ٧٢ کاتژمێردا ئاگادارت دەکەینەوە لە کاتی هەر شکاندنێک.' },
        { icon: Key, h: '٣٢. کۆنترۆڵی ڕەزامەندی', p: 'دەتوانیت ڕەزامەندیت بکێشیتەوە لە هەر کاتێکدا.' },
        { icon: Globe, h: '٣٣. لینکە دەرەکیەکان', p: 'بەرپرسیار نین لە سیاسەتی ماڵپەڕە دەرەکیەکان.' },
        { icon: Scale, h: '٣٤. یاسای پەیوەندیدار', p: 'یاسای عێراق بەکاردێت. ناکۆکیەکان لە دادگاکانی بەغداد.' },
        { icon: RefreshCw, h: '٣٥. نوێکردنەوە', p: 'گۆڕانکارییە سەرەکیەکان ٣٠ ڕۆژ پێش جێبەجێکردن ڕادەگەیەنرێن.' },
        { icon: Phone, h: '٣٦. پەیوەندی', p: 'WhatsApp: +964 783 845 5220 — privacy@levonisiq.com — Telegram: @LevonisSupport' },
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
        </div>

        <Footer />
      </main>
    </div>
  );
};

export default Privacy;
