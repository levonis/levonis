import { useState, useMemo, useCallback, useEffect } from "react";
import { 
  Bot, X, ChevronLeft, ArrowRight, MessageCircle, Compass, 
  Wallet, ShoppingCart, Trophy, Star, Shield, CreditCard, 
  Users, Store, Package, FileText, HelpCircle, Sparkles,
  Eye, Search, Heart, Bell, MapPin, Tag, Ticket, Gift,
  Crown, Zap, ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface FAQ {
  question: string;
  answer: string;
  category: string;
  merchantOnly?: boolean;
  customerOnly?: boolean;
  guidePath?: string;        // route to navigate to
  guideSelector?: string;    // CSS selector to spotlight
  guideLabel?: string;       // label for spotlight tooltip
  icon?: any;
}

interface SpotlightState {
  active: boolean;
  selector: string;
  label: string;
  rect: DOMRect | null;
}

// ─── Categories ───────────────────────────────────────────────
const CATEGORIES = [
  { id: "general", label: "عام", icon: HelpCircle },
  { id: "orders", label: "الطلبات", icon: ShoppingCart },
  { id: "points", label: "النقاط", icon: Star },
  { id: "tickets", label: "التذاكر", icon: Ticket },
  { id: "competitions", label: "المسابقات", icon: Trophy },
  { id: "membership", label: "العضوية", icon: Crown },
  { id: "wallet", label: "المحفظة", icon: Wallet },
  { id: "community", label: "المجتمع", icon: Users },
  { id: "buttons", label: "الأزرار", icon: Zap },
];

// ─── FAQs ─────────────────────────────────────────────────────
const FAQS: FAQ[] = [
  // ── عام ──
  { category: "general", icon: MessageCircle, question: "كيف يمكنني التواصل مع الدعم؟", answer: "يمكنك التواصل مع فريق الدعم عبر زر المحادثة العائم (أيقونة الدردشة) الموجود في أسفل يسار الشاشة. سيتم فتح محادثة مباشرة مع فريق الدعم الذي سيساعدك في أي استفسار." },
  { category: "general", icon: Search, question: "كيف أبحث عن منتج؟", answer: "استخدم شريط البحث في أعلى الصفحة الرئيسية. يمكنك البحث بالاسم أو الوصف. كما يمكنك تصفح الأقسام والفئات للعثور على ما تبحث عنه.", guidePath: "/", guideSelector: "[data-search-bar]", guideLabel: "اضغط هنا للبحث" },
  { category: "general", icon: Heart, question: "كيف أضيف منتج للمفضلة؟", answer: "عند تصفح أي منتج، اضغط على أيقونة القلب ♡ لإضافته للمفضلة. يمكنك الوصول لقائمة المفضلة من خلال أيقونة القلب في الشريط العلوي.", guidePath: "/favorites", guideLabel: "صفحة المفضلة" },
  { category: "general", icon: Bell, question: "كيف أتابع الإشعارات؟", answer: "اضغط على أيقونة الجرس 🔔 في الشريط العلوي لعرض جميع إشعاراتك. تشمل: تحديثات الطلبات، العروض الجديدة، نتائج المسابقات، ورسائل الدعم.", guidePath: "/notifications", guideLabel: "صفحة الإشعارات" },
  { category: "general", icon: MapPin, question: "كيف أضيف عنوان توصيل؟", answer: "اذهب إلى ملفك الشخصي ← العناوين ← إضافة عنوان جديد. أدخل تفاصيل العنوان (المحافظة، المنطقة، الشارع، رقم الهاتف). يمكنك حفظ عدة عناوين واختيار الافتراضي.", guidePath: "/addresses", guideLabel: "إدارة العناوين" },

  // ── الطلبات ──
  { category: "orders", icon: ShoppingCart, question: "كيف يمكنني وضع طلبي؟", answer: "1. تصفح المنتجات واختر المنتج المناسب\n2. حدد الخيارات (اللون، الحجم، الكمية)\n3. اضغط 'أضف للسلة'\n4. اذهب للسلة من الأيقونة العلوية\n5. راجع الطلب وأدخل عنوان التوصيل\n6. اختر طريقة الدفع وأكمل الشراء", guidePath: "/cart", guideLabel: "سلة المشتريات" },
  { category: "orders", icon: Eye, question: "كيف يمكنني تتبع طلبي؟", answer: "اذهب إلى 'طلباتي' من القائمة. ستجد جميع طلباتك مرتبة بالأحدث مع حالة كل طلب:\n• قيد المراجعة - تم استلام طلبك\n• قيد التجهيز - جاري تحضير طلبك\n• تم الشحن - في الطريق إليك\n• تم التوصيل - وصل بنجاح", guidePath: "/my-orders", guideLabel: "طلباتي" },
  { category: "orders", icon: Tag, question: "كيف أستخدم كود الخصم؟", answer: "عند إتمام الطلب في صفحة السلة، ستجد حقل 'كود الخصم'. أدخل الكود واضغط 'تطبيق'. سيتم خصم المبلغ تلقائياً من إجمالي الطلب إذا كان الكود صالحاً." },
  { category: "orders", icon: Package, question: "هل يمكنني إلغاء طلبي؟", answer: "يمكنك إلغاء الطلب إذا كان في حالة 'قيد المراجعة' فقط. بعد بدء التجهيز لا يمكن الإلغاء. تواصل مع الدعم لأي حالات استثنائية." },

  // ── المحفظة ──
  { category: "wallet", icon: Wallet, question: "كيف يمكنني شحن محفظتي؟", answer: "اذهب إلى ملفك الشخصي ← المحفظة ← شحن. اختر المبلغ المراد شحنه وطريقة الدفع المتاحة. سيتم إضافة الرصيد فوراً بعد تأكيد الدفع.", guidePath: "/user-info", guideLabel: "صفحة الملف الشخصي" },
  { category: "wallet", icon: CreditCard, question: "كيف أدفع من المحفظة؟", answer: "عند إتمام أي طلب، اختر 'الدفع من المحفظة' كطريقة دفع. سيتم خصم المبلغ مباشرة من رصيد محفظتك. تأكد من وجود رصيد كافٍ." },
  { category: "wallet", icon: ExternalLink, question: "هل يمكنني سحب رصيد المحفظة؟", answer: "رصيد المحفظة مخصص للشراء من منصة ليفو فقط ولا يمكن سحبه نقداً. يمكنك استخدامه لشراء المنتجات والخدمات المتاحة." },

  // ── النقاط ──
  { category: "points", icon: Star, question: "ماذا تعني النقاط وما فائدتها؟", answer: "النقاط هي نظام مكافآت ليفو. تحصل عليها عند الشراء وإتمام المهام اليومية. الفوائد:\n• استبدالها بمنتجات مجانية\n• الحصول على خصومات\n• شراء تذاكر المسابقات\n• ترقية مستوى العضوية", guidePath: "/rewards", guideLabel: "مركز المكافآت" },
  { category: "points", icon: Zap, question: "كيف أحصل على النقاط؟", answer: "طرق كسب النقاط:\n• الشراء من المتجر (نقاط لكل عملية شراء)\n• المهام اليومية: تسجيل الدخول، مشاركة المنتجات، تقييم المنتجات\n• المشاركة في الفعاليات والمسابقات\n• إحالة أصدقاء جدد\n• إتمام ملفك الشخصي", guidePath: "/rewards", guideLabel: "مركز المكافآت" },
  { category: "points", icon: Gift, question: "كيف أستبدل النقاط؟", answer: "اذهب إلى مركز المكافآت ← متجر النقاط. تصفح المنتجات والمكافآت المتاحة، اختر ما يناسبك واستبدله بنقاطك. يتم تحديث رصيدك فوراً.", guidePath: "/rewards", guideLabel: "متجر النقاط" },
  { category: "points", icon: Star, question: "هل تنتهي صلاحية النقاط؟", answer: "النقاط لا تنتهي صلاحيتها طالما حسابك نشط. لكن بعض العروض الخاصة في متجر النقاط قد تكون محدودة بوقت معين." },

  // ── التذاكر ──
  { category: "tickets", icon: Ticket, question: "ماذا تعني التذاكر وما فائدتها؟", answer: "التذاكر هي عملة خاصة تستخدم حصراً للمشاركة في المسابقات والسحوبات. كل تذكرة = فرصة للفوز. كلما زادت تذاكرك في مسابقة، زادت احتمالات فوزك بالجوائز القيّمة." },
  { category: "tickets", icon: Gift, question: "كيف أحصل على التذاكر؟", answer: "طرق الحصول على التذاكر:\n• شراءها من متجر النقاط (استبدال نقاط بتذاكر)\n• كمكافأة يومية على المهام\n• هدية مع بعض المشتريات\n• حزم التذاكر الخاصة بأسعار مخفضة\n• جوائز المسابقات السابقة" },
  { category: "tickets", icon: Trophy, question: "كيف أستخدم التذاكر؟", answer: "اذهب إلى مركز المكافآت ← المسابقات. اختر المسابقة النشطة، حدد عدد التذاكر التي تريد استخدامها، واضغط 'شارك'. ستحصل على أرقام تذاكر خاصة بك.", guidePath: "/rewards", guideLabel: "المسابقات" },

  // ── المسابقات ──
  { category: "competitions", icon: Trophy, question: "ما هي المسابقات؟", answer: "المسابقات هي فعاليات تنافسية متنوعة:\n• سحوبات عشوائية - فائز عشوائي\n• أول فائز - أول من يحصل على الرقم الصحيح\n• جمع أحرف - اجمع الأحرف لتكوين كلمة\n• مسابقات فريقية - انضم لفريق وتنافس\n\nالجوائز تشمل: منتجات، خصومات، أرصدة، وأكثر!" },
  { category: "competitions", icon: Zap, question: "كيف يمكنني المشاركة بالمسابقات؟", answer: "1. اذهب إلى مركز المكافآت ← المسابقات\n2. اختر المسابقة النشطة\n3. اقرأ تفاصيل الجائزة والشروط\n4. حدد عدد التذاكر للمشاركة\n5. اضغط 'شارك الآن'\n\nكلما زادت تذاكرك، زادت فرصتك!", guidePath: "/rewards", guideLabel: "المسابقات" },
  { category: "competitions", icon: Crown, question: "كيف أعرف إذا فزت؟", answer: "عند الفوز:\n• ستصلك إشعار فوري 🎉\n• ستظهر في قائمة الفائزين\n• الجائزة تُضاف تلقائياً (رصيد/خصم) أو يُطلب منك تأكيد الشحن (منتج)\n\nيمكنك مراجعة جوائزك من: مركز المكافآت ← سجل المسابقات" },

  // ── العضوية والتأمين ──
  { category: "membership", icon: Crown, question: "ما هي عضوية ليفو الخاصة؟", answer: "عضوية ليفو هي نظام ولاء بأربع مستويات:\n🥈 فضي - خصم 5% + نقاط مضاعفة 1.5x\n🥇 ذهبي - خصم 10% + نقاط مضاعفة 2x\n💎 ماسي - خصم 15% + نقاط مضاعفة 2.5x\n💚 زمردي - خصم 20% + نقاط مضاعفة 3x + أولوية دعم VIP", guidePath: "/rewards", guideLabel: "بطاقات العضوية" },
  { category: "membership", icon: CreditCard, question: "كيف يمكنني شراء عضوية؟", answer: "اذهب إلى مركز المكافآت ← البطاقات ← اختر مستوى العضوية المناسب ← أتمم عملية الشراء. تُفعّل البطاقة فوراً وتبدأ بالاستفادة من المزايا.", guidePath: "/rewards", guideLabel: "البطاقات" },
  { category: "membership", icon: Tag, question: "ماذا يعني خصم خاص للأعضاء؟", answer: "هو خصم إضافي يُطبق تلقائياً على جميع مشترياتك. النسبة تعتمد على مستوى بطاقتك:\n• فضي: 5%\n• ذهبي: 10%\n• ماسي: 15%\n• زمردي: 20%\n\nالخصم يُحسب قبل أي كوبونات إضافية." },
  { category: "membership", icon: Shield, question: "كيف يمكنني تأمين طابعتي؟", answer: "من مركز المكافآت ← التأمين:\n1. اختر خطة الحماية المناسبة\n2. أدخل بيانات الطابعة\n3. أكمل الدفع\n\nالتغطية تشمل: الأعطال الميكانيكية، مشاكل الطباعة، والصيانة الدورية لفترة محددة حسب الخطة.", guidePath: "/rewards", guideLabel: "التأمين" },

  // ── المجتمع ──
  { category: "community", icon: Users, question: "ما هو مجتمع ليفو؟", answer: "مجتمع ليفو هو سوق يجمع العملاء مع تجار الطباعة المعتمدين. الفوائد:\n• اطلب تصميمك الخاص واحصل على عروض أسعار متعددة\n• قارن بين التجار واختر الأنسب\n• تواصل مباشر مع التاجر\n• حماية حقوقك عبر نظام الضمان\n• تقييمات حقيقية من عملاء سابقين", guidePath: "/community", guideLabel: "مجتمع ليفو" },
  { category: "community", icon: FileText, question: "كيف أضع طلب طباعة؟", answer: "1. اذهب إلى مجتمع ليفو\n2. اضغط 'طلب جديد'\n3. أدخل: العنوان، الوصف، الألوان، الحجم، الكمية\n4. أرفق صور التصميم\n5. اضغط 'نشر الطلب'\n\nسيتلقى التجار طلبك ويقدمون عروضهم خلال ساعات.", customerOnly: true, guidePath: "/community", guideLabel: "مجتمع ليفو" },
  { category: "community", icon: Tag, question: "لماذا الأسعار مختلفة بين التجار؟", answer: "كل تاجر لديه:\n• معدات وتقنيات طباعة مختلفة\n• تكاليف تشغيل متفاوتة\n• خبرات ومهارات متنوعة\n\nهذا يمنحك حرية المقارنة واختيار الأنسب من حيث: السعر، الجودة، مدة التسليم، وتقييمات العملاء السابقين.", customerOnly: true },
  { category: "community", icon: MessageCircle, question: "كيف أتواصل مع التاجر؟", answer: "بعد قبول عرض تاجر على طلبك، تُفتح محادثة مباشرة بينكما تلقائياً. يمكنك:\n• مناقشة تفاصيل التصميم\n• إرسال صور إضافية\n• الاتفاق على التسليم\n\nالوصول: اضغط 'المحادثات' من القائمة السريعة.", customerOnly: true },
  { category: "community", icon: Shield, question: "ماذا لو حدثت مشكلة مع تاجر؟", answer: "نظام حماية ليفو يحميك:\n1. اذهب لتفاصيل الطلب ← 'تقديم شكوى'\n2. اشرح المشكلة وأرفق أدلة\n3. فريق ليفو يراجع الشكوى\n4. يتم التواصل مع الطرفين\n5. حل المشكلة بعدالة\n\nأموالك محمية حتى تأكيد استلامك الطلب.", customerOnly: true },

  // ── أزرار العميل ──
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات'", answer: "يفتح قائمة جميع محادثاتك النشطة مع التجار وفريق الدعم. يمكنك:\n• متابعة الردود الجديدة\n• إرسال رسائل وصور\n• مراجعة تاريخ المحادثة\n\n💡 النقطة الحمراء تعني وجود رسائل جديدة لم تُقرأ.", customerOnly: true },
  { category: "buttons", icon: FileText, question: "زر 'طلب جديد'", answer: "ينقلك مباشرة لنموذج إنشاء طلب طباعة جديد في مجتمع ليفو. ستحتاج لتعبئة:\n• عنوان الطلب\n• وصف التصميم المطلوب\n• الألوان والحجم والكمية\n• صور مرجعية (اختياري)", customerOnly: true },
  { category: "buttons", icon: Package, question: "زر 'طلباتي'", answer: "يعرض جميع طلباتك في مجتمع ليفو مع حالة كل طلب:\n• 🆕 جديد - بانتظار عروض التجار\n• 💰 مُسعّر - وصلتك عروض أسعار\n• ✅ مقبول - تم قبول عرض تاجر\n• 🏁 مكتمل - تم التسليم بنجاح", customerOnly: true },
  { category: "buttons", icon: Users, question: "زر 'ملفي'", answer: "ينقلك لصفحة ملفك الشخصي حيث يمكنك:\n• تعديل اسمك وصورتك\n• كتابة نبذة عنك\n• اختيار إطار للصورة\n• مراجعة إحصائياتك\n• إدارة إعداداتك", customerOnly: true },

  // ── أسئلة التاجر ──
  { category: "community", icon: Store, question: "كيف أدير متجري؟", answer: "من لوحة إدارة المتجر يمكنك:\n• إضافة وتعديل المنتجات\n• تنظيم المنتجات بالفئات\n• إدارة المخزون والأسعار\n• تخصيص مظهر المتجر\n• إيقاف/تشغيل المتجر مؤقتاً\n• مراجعة التقييمات والتحليلات", merchantOnly: true, guidePath: "/community/merchant/store", guideLabel: "إدارة المتجر" },
  { category: "community", icon: FileText, question: "كيف أقدم عرض سعر؟", answer: "1. اذهب إلى 'طلبات الزبائن'\n2. تصفح الطلبات الجديدة\n3. اختر الطلب المناسب لخبرتك\n4. اضغط 'تقديم عرض'\n5. حدد: السعر، مدة التسليم\n6. أضف ملاحظاتك ونماذج أعمالك\n\n💡 العروض التنافسية والسريعة تحظى بفرصة أعلى للقبول.", merchantOnly: true },

  // ── أزرار التاجر ──
  { category: "buttons", icon: Store, question: "زر 'إدارة المتجر'", answer: "ينقلك للوحة تحكم متجرك الكاملة:\n• إضافة/تعديل/حذف المنتجات\n• إدارة الفئات والتصنيفات\n• تعديل الأسعار والمخزون\n• تخصيص وصف وصورة المتجر\n• إيقاف المتجر مؤقتاً مع رسالة مخصصة", merchantOnly: true, guidePath: "/community/merchant/store", guideLabel: "إدارة المتجر" },
  { category: "buttons", icon: Package, question: "زر 'الطلبات'", answer: "يعرض طلبات الشراء من عملائك:\n• طلبات جديدة بانتظار التأكيد\n• طلبات قيد التجهيز\n• طلبات تم شحنها\n• طلبات مكتملة\n\nيمكنك تحديث حالة كل طلب ومتابعة التفاصيل.", merchantOnly: true, guidePath: "/community/merchant/orders", guideLabel: "الطلبات" },
  { category: "buttons", icon: FileText, question: "زر 'طلبات الزبائن'", answer: "يعرض طلبات الطباعة المخصصة من العملاء في مجتمع ليفو.\n• تصفح الطلبات الجديدة\n• قدم عروض أسعار تنافسية\n• تابع حالة عروضك السابقة\n• تواصل مع العملاء المهتمين", merchantOnly: true, guidePath: "/community/requests", guideLabel: "طلبات الزبائن" },
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات' (تاجر)", answer: "يفتح جميع محادثاتك مع العملاء:\n• الرد على استفسارات العملاء\n• مناقشة تفاصيل الطلبات\n• إرسال صور وملفات\n• متابعة جميع المحادثات في مكان واحد\n\n💡 الرد السريع يرفع تقييمك!", merchantOnly: true },

  // ── العروض ──
  { category: "general", icon: Tag, question: "ما هي العروض الخاصة؟", answer: "العروض الخاصة هي صفقات محدودة بكميات وأوقات معينة:\n• أسعار استثنائية لا تتوفر في المتجر العادي\n• كميات محدودة - الأسرع يفوز\n• عد تنازلي لنهاية العرض\n• منتجات مختارة بعناية\n\nتابع قسم العروض لعدم تفويت الفرص!", guidePath: "/offers", guideLabel: "العروض الخاصة" },
];

// ─── Component ────────────────────────────────────────────────
export default function LevoHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("general");
  const [spotlight, setSpotlight] = useState<SpotlightState>({ active: false, selector: "", label: "", rect: null });
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: merchantApp } = useQuery({
    queryKey: ["help-bot-merchant-status", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("merchant_applications")
        .select("id, status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
    staleTime: 300_000,
  });

  const isMerchant = !!merchantApp;

  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      if (faq.merchantOnly && !isMerchant) return false;
      if (faq.customerOnly && isMerchant) return false;
      return faq.category === activeCategory;
    });
  }, [isMerchant, activeCategory]);

  const filteredCategories = useMemo(() => {
    return CATEGORIES.filter(cat => {
      // check if any FAQ exists for this category for this user
      return FAQS.some(faq => {
        if (faq.category !== cat.id) return false;
        if (faq.merchantOnly && !isMerchant) return false;
        if (faq.customerOnly && isMerchant) return false;
        return true;
      });
    });
  }, [isMerchant]);

  const handleGuide = useCallback((faq: FAQ) => {
    if (!faq.guidePath) return;
    setIsOpen(false);
    navigate(faq.guidePath);
    
    // After navigation, try to find and spotlight the element
    if (faq.guideSelector) {
      setTimeout(() => {
        const el = document.querySelector(faq.guideSelector!);
        if (el) {
          const rect = el.getBoundingClientRect();
          setSpotlight({ active: true, selector: faq.guideSelector!, label: faq.guideLabel || "", rect });
          el.scrollIntoView({ behavior: "smooth", block: "center" });
        } else {
          // No specific element, just show a general label
          setSpotlight({ active: true, selector: "", label: faq.guideLabel || "تم الانتقال للصفحة المطلوبة", rect: null });
        }
      }, 800);
    } else {
      // Just navigate, show brief spotlight message
      setTimeout(() => {
        setSpotlight({ active: true, selector: "", label: faq.guideLabel || "تم الانتقال للصفحة المطلوبة", rect: null });
      }, 500);
    }
  }, [navigate]);

  const exitSpotlight = useCallback(() => {
    setSpotlight({ active: false, selector: "", label: "", rect: null });
  }, []);

  // Update spotlight rect on scroll/resize
  useEffect(() => {
    if (!spotlight.active || !spotlight.selector) return;
    const update = () => {
      const el = document.querySelector(spotlight.selector);
      if (el) {
        setSpotlight(prev => ({ ...prev, rect: el.getBoundingClientRect() }));
      }
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [spotlight.active, spotlight.selector]);

  const handleDirectChat = () => {
    setIsOpen(false);
    // Find and click the unified chat button
    const chatBtn = document.querySelector("[data-unified-chat]") as HTMLButtonElement;
    if (chatBtn) chatBtn.click();
  };

  if (isHidden && !isOpen && !spotlight.active) return null;

  return (
    <>
      {/* ─── Spotlight Overlay ─── */}
      {spotlight.active && (
        <div className="fixed inset-0 z-[9999]" dir="rtl">
          {/* Dark overlay with hole */}
          <div className="absolute inset-0 bg-black/70 transition-opacity duration-300" onClick={exitSpotlight} />
          
          {/* Spotlight cutout */}
          {spotlight.rect && (
            <div
              className="absolute rounded-xl border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-[10000] pointer-events-none transition-all duration-500"
              style={{
                top: spotlight.rect.top - 8,
                left: spotlight.rect.left - 8,
                width: spotlight.rect.width + 16,
                height: spotlight.rect.height + 16,
              }}
            />
          )}

          {/* Label tooltip */}
          <div
            className="absolute z-[10001] flex flex-col items-center gap-2 animate-fade-in"
            style={spotlight.rect ? {
              top: spotlight.rect.bottom + 20,
              left: spotlight.rect.left + spotlight.rect.width / 2,
              transform: "translateX(-50%)",
            } : {
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {spotlight.rect && (
              <div className="text-primary text-2xl animate-bounce">↑</div>
            )}
            <div className="bg-card border border-primary/30 rounded-xl px-4 py-2.5 shadow-xl max-w-[250px]">
              <p className="text-sm font-bold text-foreground text-center">{spotlight.label}</p>
            </div>
          </div>

          {/* Exit button */}
          <button
            onClick={exitSpotlight}
            className="fixed top-6 left-6 z-[10002] flex items-center gap-2 bg-destructive text-destructive-foreground px-4 py-2.5 rounded-full shadow-xl hover:bg-destructive/90 transition-colors text-sm font-bold"
          >
            <X className="h-4 w-4" />
            إغلاق المساعد
          </button>
        </div>
      )}

      {/* ─── Floating Icon Button ─── */}
      {!isOpen && !isHidden && (
        <div className="fixed bottom-24 right-3 z-[60] flex flex-col items-center gap-1">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
          >
            <Bot className="h-5 w-5" />
            {/* Pulse ring */}
            <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" style={{ animationDuration: "3s" }} />
          </button>
          <button 
            onClick={() => setIsHidden(true)}
            className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div className="fixed bottom-20 right-3 z-[60] w-[340px] max-h-[75vh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl animate-scale-in overflow-hidden" dir="rtl">
          
          {/* Header */}
          <div className="relative shrink-0 bg-gradient-to-l from-primary via-primary/95 to-primary/85 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center">
                  <Bot className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-primary-foreground">مساعد ليفو</h3>
                  <p className="text-[10px] text-primary-foreground/70">كيف يمكنني مساعدتك؟</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-full hover:bg-white/15 transition-colors">
                <X className="h-4 w-4 text-primary-foreground" />
              </button>
            </div>
          </div>

          {/* Category Tabs - horizontal scroll */}
          {!selectedFaq && (
            <div className="shrink-0 border-b border-border/50 bg-muted/30">
              <div className="flex overflow-x-auto scrollbar-hide gap-1 p-2">
                {filteredCategories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all shrink-0",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "bg-background text-muted-foreground hover:bg-accent hover:text-foreground border border-border/50"
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {!selectedFaq ? (
              <div className="p-2.5 space-y-1.5">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    لا توجد أسئلة في هذا القسم
                  </div>
                ) : (
                  filteredFaqs.map((faq, idx) => {
                    const FaqIcon = faq.icon || HelpCircle;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedFaq(faq)}
                        className="w-full flex items-center gap-2.5 text-right px-3 py-2.5 rounded-xl bg-background hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-all group"
                      >
                        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                          <FaqIcon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="flex-1 text-[11px] font-medium leading-relaxed text-foreground">{faq.question}</span>
                        <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-3 space-y-3">
                {/* Question */}
                <div className="bg-primary/10 rounded-xl px-3.5 py-2.5 border border-primary/20">
                  <p className="text-xs font-bold text-primary leading-relaxed">{selectedFaq.question}</p>
                </div>
                {/* Answer */}
                <div className="bg-muted/40 rounded-xl px-3.5 py-3 border border-border/40">
                  <p className="text-[11px] leading-[1.8] text-foreground whitespace-pre-line">{selectedFaq.answer}</p>
                </div>
                {/* Guide button */}
                {selectedFaq.guidePath && (
                  <button
                    onClick={() => handleGuide(selectedFaq)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-primary to-primary/90 text-primary-foreground text-xs font-bold hover:shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Compass className="h-4 w-4" />
                    قم بتوجيهي إليه
                  </button>
                )}
                {/* Back */}
                <button
                  onClick={() => setSelectedFaq(null)}
                  className="flex items-center gap-1.5 text-[11px] text-primary font-semibold hover:underline"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  العودة للأسئلة
                </button>
              </div>
            )}
          </div>

          {/* Footer: Direct chat + hide */}
          <div className="shrink-0 border-t border-border/50 bg-muted/20 px-3 py-2.5 flex items-center gap-2">
            <button
              onClick={handleDirectChat}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-[11px] font-semibold transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              محادثة مباشرة مع الدعم
            </button>
            <button
              onClick={() => { setIsOpen(false); setIsHidden(true); }}
              className="px-2.5 py-2 rounded-xl text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              إخفاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}
