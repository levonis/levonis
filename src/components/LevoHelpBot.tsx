import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
  Bot, X, ChevronLeft, ArrowRight, MessageCircle, Compass, 
  Wallet, ShoppingCart, Trophy, Star, Shield, CreditCard, 
  Users, Store, Package, FileText, HelpCircle,
  Eye, Search, Heart, Bell, MapPin, Tag, Ticket, Gift,
  Crown, Zap, ExternalLink
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────
interface GuideStep {
  path: string;
  description: string;
  elementFinder?: () => HTMLElement | null; // function to find element dynamically
}

interface FAQ {
  question: string;
  answer: string;
  category: string;
  merchantOnly?: boolean;
  customerOnly?: boolean;
  guideSteps?: GuideStep[];
  icon?: any;
}

interface SpotlightState {
  active: boolean;
  stepIndex: number;
  steps: GuideStep[];
  rect: DOMRect | null;
}

// ─── Element Finders ──────────────────────────────────────────
// These functions find real DOM elements reliably
const finders = {
  // Header elements
  searchBar: () => document.querySelector('input[placeholder*="ابحث"]') as HTMLElement | null,
  cartIcon: () => document.querySelector('a[href="/cart"], [href="/cart"]') as HTMLElement | null,
  favIcon: () => document.querySelector('a[href="/favorites"], [href="/favorites"]') as HTMLElement | null,
  bellIcon: () => document.querySelector('a[href="/notifications"], [href="/notifications"]') as HTMLElement | null,
  profileIcon: () => document.querySelector('a[href="/user-info"], [href="/user-info"]') as HTMLElement | null,
  // Page headings - fallback finders for specific pages
  pageHeading: () => document.querySelector('main h1, h1') as HTMLElement | null,
  pageMainContent: () => document.querySelector('main, [class*="container"]') as HTMLElement | null,
  // Community
  communityBadge: () => document.querySelector('a[href="/community"], [href="/community"]') as HTMLElement | null,
  newRequestBtn: () => {
    const btns = document.querySelectorAll('a, button');
    for (const b of btns) {
      if (b.textContent?.includes('طلب جديد') || b.textContent?.includes('إضافة طلب')) return b as HTMLElement;
    }
    return null;
  },
  // Rewards
  rewardsHeading: () => document.querySelector('h1') as HTMLElement | null,
  // Cart
  cartContent: () => document.querySelector('main') as HTMLElement | null,
  couponInput: () => document.querySelector('input[placeholder*="كود"], input[placeholder*="خصم"], input[placeholder*="كوبون"]') as HTMLElement | null,
  // Orders
  ordersContent: () => document.querySelector('main h1, main') as HTMLElement | null,
  // Addresses
  addAddressBtn: () => {
    const btns = document.querySelectorAll('a, button');
    for (const b of btns) {
      if (b.textContent?.includes('إضافة عنوان') || b.textContent?.includes('عنوان جديد')) return b as HTMLElement;
    }
    return document.querySelector('main') as HTMLElement | null;
  },
  // Merchant
  storeLink: () => document.querySelector('a[href*="merchant/store"]') as HTMLElement | null,
  ordersLink: () => document.querySelector('a[href*="merchant/orders"]') as HTMLElement | null,
  requestsLink: () => document.querySelector('a[href*="/requests"]') as HTMLElement | null,
  // Offers
  offersContent: () => document.querySelector('main') as HTMLElement | null,
};

// ─── Categories ───────────────────────────────────────────────
const CATEGORIES = [
  { id: "general", label: "عام", icon: HelpCircle, emoji: "💡" },
  { id: "orders", label: "الطلبات", icon: ShoppingCart, emoji: "🛒" },
  { id: "points", label: "النقاط", icon: Star, emoji: "⭐" },
  { id: "tickets", label: "التذاكر", icon: Ticket, emoji: "🎟️" },
  { id: "competitions", label: "المسابقات", icon: Trophy, emoji: "🏆" },
  { id: "membership", label: "العضوية", icon: Crown, emoji: "👑" },
  { id: "wallet", label: "المحفظة", icon: Wallet, emoji: "💰" },
  { id: "community", label: "المجتمع", icon: Users, emoji: "👥" },
  { id: "buttons", label: "الأزرار", icon: Zap, emoji: "⚡" },
];

// ─── FAQs ─────────────────────────────────────────────────────
const FAQS: FAQ[] = [
  // ── عام ──
  { category: "general", icon: MessageCircle, question: "كيف يمكنني التواصل مع الدعم؟", answer: "يمكنك التواصل مع فريق الدعم عبر زر المحادثة العائم (أيقونة الدردشة) الموجود في أسفل يسار الشاشة. سيتم فتح محادثة مباشرة مع فريق الدعم الذي سيساعدك في أي استفسار." },
  { category: "general", icon: Search, question: "كيف أبحث عن منتج؟", answer: "استخدم شريط البحث في أعلى الصفحة الرئيسية. يمكنك البحث بالاسم أو الوصف. كما يمكنك تصفح الأقسام والفئات للعثور على ما تبحث عنه.",
    guideSteps: [
      { path: "/", description: "هذا شريط البحث — اكتب اسم المنتج هنا", elementFinder: finders.searchBar },
    ]
  },
  { category: "general", icon: Heart, question: "كيف أضيف منتج للمفضلة؟", answer: "عند تصفح أي منتج، اضغط على أيقونة القلب ♡ لإضافته للمفضلة. يمكنك الوصول لقائمة المفضلة من الشريط العلوي.",
    guideSteps: [
      { path: "/", description: "اضغط هنا للوصول لقائمة المفضلة", elementFinder: finders.favIcon },
    ]
  },
  { category: "general", icon: Bell, question: "كيف أتابع الإشعارات؟", answer: "اضغط على أيقونة الجرس 🔔 في الشريط العلوي لعرض جميع إشعاراتك.",
    guideSteps: [
      { path: "/", description: "أيقونة الإشعارات — اضغط هنا لعرضها", elementFinder: finders.bellIcon },
    ]
  },
  { category: "general", icon: MapPin, question: "كيف أضيف عنوان توصيل؟", answer: "اذهب إلى ملفك الشخصي ← العناوين ← إضافة عنوان جديد. أدخل تفاصيل العنوان (المحافظة، المنطقة، الشارع، رقم الهاتف).",
    guideSteps: [
      { path: "/addresses", description: "هذه صفحة العناوين — يمكنك إضافة عنوان جديد من هنا", elementFinder: finders.addAddressBtn },
    ]
  },

  // ── الطلبات ──
  { category: "orders", icon: ShoppingCart, question: "كيف يمكنني وضع طلبي؟", answer: "1. تصفح المنتجات واختر المنتج المناسب\n2. حدد الخيارات (اللون، الحجم، الكمية)\n3. اضغط 'أضف للسلة'\n4. اذهب للسلة وأكمل الشراء",
    guideSteps: [
      { path: "/", description: "تصفح المنتجات من الصفحة الرئيسية واختر ما يناسبك", elementFinder: finders.searchBar },
      { path: "/cart", description: "هذه سلة المشتريات — راجع طلبك وأكمل الشراء", elementFinder: finders.cartContent },
    ]
  },
  { category: "orders", icon: Eye, question: "كيف يمكنني تتبع طلبي؟", answer: "اذهب إلى 'طلباتي'. ستجد جميع طلباتك مع حالة كل طلب:\n• قيد المراجعة\n• قيد التجهيز\n• تم الشحن\n• تم التوصيل",
    guideSteps: [
      { path: "/my-orders", description: "هذه صفحة طلباتي — يمكنك تتبع جميع طلباتك هنا", elementFinder: finders.ordersContent },
    ]
  },
  { category: "orders", icon: Tag, question: "كيف أستخدم كود الخصم؟", answer: "عند إتمام الطلب في صفحة السلة، ستجد حقل 'كود الخصم'. أدخل الكود واضغط 'تطبيق'. سيتم خصم المبلغ تلقائياً.",
    guideSteps: [
      { path: "/cart", description: "في صفحة السلة، ابحث عن حقل كود الخصم وأدخل الكود", elementFinder: finders.couponInput },
    ]
  },
  { category: "orders", icon: Package, question: "هل يمكنني إلغاء طلبي؟", answer: "يمكنك إلغاء الطلب إذا كان في حالة 'قيد المراجعة' فقط. بعد بدء التجهيز لا يمكن الإلغاء. تواصل مع الدعم لأي حالات استثنائية." },

  // ── المحفظة ──
  { category: "wallet", icon: Wallet, question: "كيف يمكنني شحن محفظتي؟", answer: "اذهب إلى ملفك الشخصي ← المحفظة ← شحن. اختر المبلغ وطريقة الدفع. سيتم إضافة الرصيد فوراً.",
    guideSteps: [
      { path: "/user-info", description: "اذهب لملفك الشخصي — ستجد خيار المحفظة هنا", elementFinder: finders.profileIcon },
    ]
  },
  { category: "wallet", icon: CreditCard, question: "كيف أدفع من المحفظة؟", answer: "عند إتمام أي طلب، اختر 'الدفع من المحفظة' كطريقة دفع. سيتم خصم المبلغ مباشرة. تأكد من وجود رصيد كافٍ." },
  { category: "wallet", icon: ExternalLink, question: "هل يمكنني سحب رصيد المحفظة؟", answer: "رصيد المحفظة مخصص للشراء من منصة ليفو فقط ولا يمكن سحبه نقداً." },

  // ── النقاط ──
  { category: "points", icon: Star, question: "ماذا تعني النقاط وما فائدتها؟", answer: "النقاط هي نظام مكافآت ليفو:\n• استبدالها بمنتجات مجانية\n• الحصول على خصومات\n• شراء تذاكر المسابقات\n• ترقية مستوى العضوية",
    guideSteps: [{ path: "/rewards", description: "هذا مركز المكافآت — يمكنك إدارة نقاطك من هنا", elementFinder: finders.rewardsHeading }]
  },
  { category: "points", icon: Zap, question: "كيف أحصل على النقاط؟", answer: "طرق كسب النقاط:\n• الشراء من المتجر\n• المهام اليومية (تسجيل دخول، مشاركة، تقييم)\n• المشاركة في الفعاليات\n• إحالة أصدقاء\n• إتمام الملف الشخصي",
    guideSteps: [{ path: "/rewards", description: "مركز المكافآت — تابع نقاطك والمهام اليومية", elementFinder: finders.rewardsHeading }]
  },
  { category: "points", icon: Gift, question: "كيف أستبدل النقاط؟", answer: "اذهب إلى مركز المكافآت ← متجر النقاط. تصفح المكافآت المتاحة واستبدلها بنقاطك.",
    guideSteps: [{ path: "/rewards", description: "متجر النقاط — اختر المكافأة واستبدلها", elementFinder: finders.rewardsHeading }]
  },
  { category: "points", icon: Star, question: "هل تنتهي صلاحية النقاط؟", answer: "النقاط لا تنتهي صلاحيتها طالما حسابك نشط. بعض عروض متجر النقاط قد تكون محدودة بوقت." },

  // ── التذاكر ──
  { category: "tickets", icon: Ticket, question: "ماذا تعني التذاكر وما فائدتها؟", answer: "التذاكر عملة خاصة للمشاركة في المسابقات والسحوبات. كل تذكرة = فرصة للفوز. كلما زادت تذاكرك، زادت احتمالات الفوز!" },
  { category: "tickets", icon: Gift, question: "كيف أحصل على التذاكر؟", answer: "• شراؤها من متجر النقاط\n• مكافأة يومية على المهام\n• هدية مع بعض المشتريات\n• حزم تذاكر بأسعار مخفضة\n• جوائز مسابقات سابقة" },
  { category: "tickets", icon: Trophy, question: "كيف أستخدم التذاكر؟", answer: "مركز المكافآت ← المسابقات ← اختر مسابقة ← حدد عدد التذاكر ← اضغط 'شارك'.",
    guideSteps: [{ path: "/rewards", description: "اذهب للمسابقات واستخدم تذاكرك للمشاركة" }]
  },

  // ── المسابقات ──
  { category: "competitions", icon: Trophy, question: "ما هي المسابقات؟", answer: "فعاليات تنافسية متنوعة:\n• سحوبات عشوائية\n• أول فائز\n• جمع أحرف\n• مسابقات فريقية\n\nالجوائز: منتجات، خصومات، أرصدة!" },
  { category: "competitions", icon: Zap, question: "كيف أشارك بالمسابقات؟", answer: "1. مركز المكافآت ← المسابقات\n2. اختر المسابقة النشطة\n3. اقرأ التفاصيل والشروط\n4. حدد عدد التذاكر\n5. اضغط 'شارك الآن'",
    guideSteps: [{ path: "/rewards", description: "صفحة المسابقات — اختر مسابقة وشارك بتذاكرك" }]
  },
  { category: "competitions", icon: Crown, question: "كيف أعرف إذا فزت؟", answer: "• إشعار فوري عند الفوز 🎉\n• ظهورك في قائمة الفائزين\n• الجائزة تُضاف تلقائياً أو يُطلب تأكيد الشحن\n• مراجعة: مركز المكافآت ← سجل المسابقات" },

  // ── العضوية ──
  { category: "membership", icon: Crown, question: "ما هي عضوية ليفو؟", answer: "نظام ولاء بأربع مستويات:\n🥈 فضي - خصم 5% + نقاط 1.5x\n🥇 ذهبي - خصم 10% + نقاط 2x\n💎 ماسي - خصم 15% + نقاط 2.5x\n💚 زمردي - خصم 20% + نقاط 3x + دعم VIP",
    guideSteps: [{ path: "/rewards", description: "بطاقات العضوية — اختر المستوى المناسب" }]
  },
  { category: "membership", icon: CreditCard, question: "كيف أشتري عضوية؟", answer: "مركز المكافآت ← البطاقات ← اختر المستوى ← أتمم الشراء. تُفعّل فوراً!",
    guideSteps: [{ path: "/rewards", description: "صفحة البطاقات — اختر واشترِ عضويتك" }]
  },
  { category: "membership", icon: Tag, question: "ماذا يعني خصم الأعضاء؟", answer: "خصم إضافي تلقائي على مشترياتك:\n• فضي: 5%\n• ذهبي: 10%\n• ماسي: 15%\n• زمردي: 20%\n\nيُحسب قبل الكوبونات." },
  { category: "membership", icon: Shield, question: "كيف أؤمّن طابعتي؟", answer: "مركز المكافآت ← التأمين:\n1. اختر خطة الحماية\n2. أدخل بيانات الطابعة\n3. أكمل الدفع\n\nالتغطية: أعطال، مشاكل طباعة، صيانة دورية.",
    guideSteps: [{ path: "/rewards", description: "صفحة التأمين — اختر خطة حماية لطابعتك" }]
  },

  // ── المجتمع ──
  { category: "community", icon: Users, question: "ما هو مجتمع ليفو؟", answer: "سوق يجمع العملاء مع تجار الطباعة المعتمدين:\n• اطلب تصميمك الخاص\n• احصل على عروض أسعار متعددة\n• قارن واختر الأنسب\n• تواصل مباشر مع التاجر\n• حماية عبر نظام الضمان",
    guideSteps: [{ path: "/community", description: "هذا مجتمع ليفو — تصفح المنتجات والطلبات" }]
  },
  { category: "community", icon: FileText, question: "كيف أضع طلب طباعة؟", answer: "1. اذهب لمجتمع ليفو\n2. اضغط 'طلب جديد'\n3. أدخل: العنوان، الوصف، الألوان، الحجم، الكمية\n4. أرفق صور التصميم\n5. انشر الطلب\n\nسيقدم التجار عروضهم خلال ساعات.", customerOnly: true,
    guideSteps: [
      { path: "/community", description: "اذهب لمجتمع ليفو أولاً", elementFinder: finders.communityBadge },
      { path: "/community", description: "اضغط 'طلب جديد' لإنشاء طلب طباعة", elementFinder: finders.newRequestBtn },
    ]
  },
  { category: "community", icon: Tag, question: "لماذا الأسعار مختلفة بين التجار؟", answer: "كل تاجر لديه معدات وتكاليف مختلفة. هذا يمنحك حرية المقارنة واختيار الأنسب من حيث: السعر، الجودة، مدة التسليم، والتقييمات.", customerOnly: true },
  { category: "community", icon: MessageCircle, question: "كيف أتواصل مع التاجر؟", answer: "بعد قبول عرض تاجر، تُفتح محادثة مباشرة تلقائياً. يمكنك مناقشة التفاصيل وإرسال صور. الوصول: اضغط 'المحادثات'.", customerOnly: true },
  { category: "community", icon: Shield, question: "ماذا لو حدثت مشكلة مع تاجر؟", answer: "نظام حماية ليفو:\n1. تفاصيل الطلب ← 'تقديم شكوى'\n2. اشرح المشكلة وأرفق أدلة\n3. فريق ليفو يراجع ويتدخل\n\nأموالك محمية حتى تأكيد الاستلام.", customerOnly: true },

  // ── أزرار العميل ──
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات'", answer: "يفتح قائمة محادثاتك مع التجار والدعم:\n• متابعة الردود الجديدة\n• إرسال رسائل وصور\n• مراجعة التاريخ\n\n💡 النقطة الحمراء = رسائل جديدة", customerOnly: true },
  { category: "buttons", icon: FileText, question: "زر 'طلب جديد'", answer: "ينقلك لنموذج إنشاء طلب طباعة جديد. ستحتاج:\n• عنوان الطلب\n• وصف التصميم\n• الألوان والحجم والكمية\n• صور مرجعية (اختياري)", customerOnly: true },
  { category: "buttons", icon: Package, question: "زر 'طلباتي'", answer: "يعرض طلباتك في المجتمع:\n• 🆕 جديد - بانتظار عروض\n• 💰 مُسعّر - وصلتك عروض\n• ✅ مقبول - تم قبول عرض\n• 🏁 مكتمل - تم التسليم", customerOnly: true,
    guideSteps: [{ path: "/community/customer/requests", description: "هذه صفحة طلباتك في المجتمع" }]
  },
  { category: "buttons", icon: Users, question: "زر 'ملفي'", answer: "ملفك الشخصي:\n• تعديل الاسم والصورة\n• كتابة نبذة\n• اختيار إطار\n• مراجعة الإحصائيات", customerOnly: true,
    guideSteps: [{ path: "/profile", description: "صفحة ملفك الشخصي" }]
  },

  // ── التاجر ──
  { category: "community", icon: Store, question: "كيف أدير متجري؟", answer: "لوحة إدارة المتجر:\n• إضافة/تعديل المنتجات\n• تنظيم الفئات\n• إدارة المخزون والأسعار\n• تخصيص المتجر\n• إيقاف/تشغيل مؤقت\n• مراجعة التحليلات", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/store", description: "لوحة إدارة متجرك" }]
  },
  { category: "community", icon: FileText, question: "كيف أقدم عرض سعر؟", answer: "1. 'طلبات الزبائن'\n2. تصفح الطلبات الجديدة\n3. اختر الطلب المناسب\n4. اضغط 'تقديم عرض'\n5. حدد: السعر، مدة التسليم\n6. أضف ملاحظاتك\n\n💡 العروض السريعة والتنافسية تحظى بفرصة أعلى.", merchantOnly: true,
    guideSteps: [{ path: "/community/requests", description: "طلبات الزبائن — تصفح وقدم عروضك" }]
  },
  { category: "buttons", icon: Store, question: "زر 'إدارة المتجر'", answer: "لوحة تحكم متجرك الكاملة:\n• إضافة/تعديل/حذف المنتجات\n• إدارة الفئات\n• تعديل الأسعار والمخزون\n• تخصيص الوصف والصورة\n• إيقاف مؤقت مع رسالة مخصصة", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/store", description: "هنا يمكنك إدارة متجرك" }]
  },
  { category: "buttons", icon: Package, question: "زر 'الطلبات' (تاجر)", answer: "طلبات الشراء من عملائك:\n• طلبات جديدة\n• قيد التجهيز\n• تم الشحن\n• مكتملة\n\nيمكنك تحديث حالة كل طلب.", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/orders", description: "صفحة طلبات عملائك" }]
  },
  { category: "buttons", icon: FileText, question: "زر 'طلبات الزبائن'", answer: "طلبات الطباعة المخصصة من العملاء:\n• تصفح الطلبات الجديدة\n• قدم عروض أسعار تنافسية\n• تابع عروضك السابقة\n• تواصل مع المهتمين", merchantOnly: true,
    guideSteps: [{ path: "/community/requests", description: "تصفح طلبات الزبائن وقدم عروضك" }]
  },
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات' (تاجر)", answer: "جميع محادثاتك مع العملاء:\n• الرد على الاستفسارات\n• مناقشة تفاصيل الطلبات\n• إرسال صور وملفات\n\n💡 الرد السريع يرفع تقييمك!", merchantOnly: true },

  // ── عروض ──
  { category: "general", icon: Tag, question: "ما هي العروض الخاصة؟", answer: "صفقات محدودة بكميات وأوقات:\n• أسعار استثنائية\n• كميات محدودة\n• عد تنازلي\n• منتجات مختارة\n\nتابع قسم العروض لعدم تفويتها!",
    guideSteps: [{ path: "/offers", description: "صفحة العروض الخاصة — تصفح الصفقات المتاحة" }]
  },
];

// ─── Component ────────────────────────────────────────────────
export default function LevoHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("general");
  const [spotlight, setSpotlight] = useState<SpotlightState>({ active: false, stepIndex: 0, steps: [], rect: null });
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
    return CATEGORIES.filter(cat =>
      FAQS.some(faq => {
        if (faq.category !== cat.id) return false;
        if (faq.merchantOnly && !isMerchant) return false;
        if (faq.customerOnly && isMerchant) return false;
        return true;
      })
    );
  }, [isMerchant]);

  // ─── Spotlight Logic ────────────────────────────────────────
  const currentStep = spotlight.active ? spotlight.steps[spotlight.stepIndex] : null;

  const findAndSpotlight = useCallback((step: GuideStep) => {
    if (retryRef.current) clearTimeout(retryRef.current);
    
    const tryFind = (attempt = 0) => {
      let el: HTMLElement | null = null;
      
      // Try the specific element finder first
      if (step.elementFinder) {
        el = step.elementFinder();
      }
      
      // Fallback: try to find the page heading or main content
      if (!el) {
        el = document.querySelector('main h1') as HTMLElement | null;
      }
      if (!el) {
        el = document.querySelector('h1') as HTMLElement | null;
      }
      if (!el) {
        el = document.querySelector('main > div:first-child') as HTMLElement | null;
      }
      
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const rect = el!.getBoundingClientRect();
          setSpotlight(prev => ({ ...prev, rect }));
        }, 400);
      } else if (attempt < 8) {
        // Retry — page might still be loading
        retryRef.current = setTimeout(() => tryFind(attempt + 1), 600);
      } else {
        // No element found, show centered message
        setSpotlight(prev => ({ ...prev, rect: null }));
      }
    };
    
    tryFind();
  }, []);

  const startGuide = useCallback((faq: FAQ) => {
    if (!faq.guideSteps || faq.guideSteps.length === 0) return;
    setIsOpen(false);
    setSelectedFaq(null);
    
    const steps = faq.guideSteps;
    const firstStep = steps[0];
    
    setSpotlight({ active: true, stepIndex: 0, steps, rect: null });
    
    // Navigate if needed
    if (firstStep.path && firstStep.path !== location.pathname) {
      navigate(firstStep.path);
      // Wait longer for page to fully render
      setTimeout(() => findAndSpotlight(firstStep), 1500);
    } else {
      findAndSpotlight(firstStep);
    }
  }, [navigate, location.pathname, findAndSpotlight]);

  const nextStep = useCallback(() => {
    const nextIdx = spotlight.stepIndex + 1;
    if (nextIdx >= spotlight.steps.length) {
      exitSpotlight();
      return;
    }
    
    const step = spotlight.steps[nextIdx];
    setSpotlight(prev => ({ ...prev, stepIndex: nextIdx, rect: null }));
    
    if (step.path && step.path !== location.pathname) {
      navigate(step.path);
      setTimeout(() => findAndSpotlight(step), 1500);
    } else {
      findAndSpotlight(step);
    }
  }, [spotlight.stepIndex, spotlight.steps, navigate, location.pathname, findAndSpotlight]);

  const exitSpotlight = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    setSpotlight({ active: false, stepIndex: 0, steps: [], rect: null });
  }, []);

  // Update rect on scroll/resize
  useEffect(() => {
    if (!spotlight.active || !currentStep?.elementFinder) return;
    const update = () => {
      const el = currentStep.elementFinder!();
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
  }, [spotlight.active, currentStep]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  const handleDirectChat = () => {
    setIsOpen(false);
    // Find the chat button by searching for the component
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      // Look for the unified chat floating button (usually has MessageCircle icon and is fixed position)
      const style = window.getComputedStyle(btn);
      if (style.position === 'fixed' && btn.closest('[class*="bottom-"]') && btn !== document.querySelector('[class*="LevoHelpBot"]')) {
        // Check if it's not our own bot button
        if (!btn.closest('.levo-help-bot-trigger')) {
          btn.click();
          return;
        }
      }
    }
  };

  if (isHidden && !isOpen && !spotlight.active) return null;

  const hasMultipleSteps = spotlight.steps.length > 1;
  const isLastStep = spotlight.stepIndex >= spotlight.steps.length - 1;

  return (
    <>
      {/* ─── Spotlight Overlay (uses SVG clip for true cutout) ─── */}
      {spotlight.active && (
        <div className="fixed inset-0 z-[9999]" dir="rtl">
          {/* SVG overlay with cutout */}
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                {spotlight.rect && (
                  <rect
                    x={spotlight.rect.left - 10}
                    y={spotlight.rect.top - 10}
                    width={spotlight.rect.width + 20}
                    height={spotlight.rect.height + 20}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect 
              width="100%" 
              height="100%" 
              fill="rgba(0,0,0,0.75)" 
              mask="url(#spotlight-mask)" 
              style={{ pointerEvents: "all" }}
              onClick={exitSpotlight}
            />
          </svg>

          {/* Highlight border around target */}
          {spotlight.rect && (
            <div
              className="absolute rounded-xl border-2 border-primary pointer-events-none z-[10000]"
              style={{
                top: spotlight.rect.top - 10,
                left: spotlight.rect.left - 10,
                width: spotlight.rect.width + 20,
                height: spotlight.rect.height + 20,
                boxShadow: "0 0 20px hsl(var(--primary) / 0.4), 0 0 40px hsl(var(--primary) / 0.2)",
              }}
            />
          )}

          {/* Tooltip with description */}
          <div
            className="absolute z-[10001] flex flex-col items-center gap-1.5 animate-fade-in pointer-events-none"
            style={spotlight.rect ? {
              top: Math.min(spotlight.rect.bottom + 16, window.innerHeight - 120),
              left: Math.max(20, Math.min(spotlight.rect.left + spotlight.rect.width / 2, window.innerWidth - 180)),
              transform: "translateX(-50%)",
            } : {
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {spotlight.rect && (
              <div className="text-primary text-xl animate-bounce">▲</div>
            )}
            <div className="bg-card border border-primary/40 rounded-2xl px-5 py-3 shadow-2xl max-w-[280px] pointer-events-auto">
              <p className="text-sm font-bold text-foreground text-center leading-relaxed">
                {currentStep?.description}
              </p>
              {/* Step controls */}
              <div className="flex items-center justify-center gap-2 mt-3">
                {hasMultipleSteps && (
                  <span className="text-[10px] text-muted-foreground">
                    {spotlight.stepIndex + 1} / {spotlight.steps.length}
                  </span>
                )}
                {hasMultipleSteps && !isLastStep ? (
                  <button
                    onClick={nextStep}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                  >
                    التالي ←
                  </button>
                ) : (
                  <button
                    onClick={exitSpotlight}
                    className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors"
                  >
                    فهمت ✓
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Exit button - always visible */}
          <button
            onClick={exitSpotlight}
            className="fixed top-4 left-4 z-[10002] flex items-center gap-1.5 bg-card border border-border text-foreground px-3 py-2 rounded-full shadow-xl hover:bg-accent transition-colors text-xs font-bold"
          >
            <X className="h-3.5 w-3.5" />
            خروج
          </button>
        </div>
      )}

      {/* ─── Floating Icon Button ─── */}
      {!isOpen && !isHidden && (
        <div className="fixed bottom-24 right-3 z-[60] flex flex-col items-center gap-1 levo-help-bot-trigger">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
          >
            <Bot className="h-4.5 w-4.5" />
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "4s" }} />
          </button>
          <button 
            onClick={() => setIsHidden(true)}
            className="text-[8px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            إخفاء
          </button>
        </div>
      )}

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div className="fixed bottom-20 right-3 z-[60] w-[330px] max-h-[72vh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl animate-scale-in overflow-hidden" dir="rtl">
          
          {/* Header */}
          <div className="shrink-0 bg-gradient-to-l from-primary via-primary/95 to-primary/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary-foreground">مساعد ليفو</h3>
                  <p className="text-[9px] text-primary-foreground/60">اختر سؤالك وسأوجهك</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/15 transition-colors">
                <X className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
          </div>

          {/* Category Tabs */}
          {!selectedFaq && (
            <div className="shrink-0 border-b border-border/40 bg-muted/20">
              <div className="flex overflow-x-auto scrollbar-hide gap-1 p-1.5">
                {filteredCategories.map((cat) => {
                  const isActive = activeCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold whitespace-nowrap transition-all shrink-0",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-sm" 
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      <span>{cat.emoji}</span>
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
              <div className="p-2 space-y-1">
                {filteredFaqs.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-muted-foreground">لا توجد أسئلة في هذا القسم</div>
                ) : (
                  filteredFaqs.map((faq, idx) => {
                    const FaqIcon = faq.icon || HelpCircle;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedFaq(faq)}
                        className="w-full flex items-center gap-2 text-right px-2.5 py-2 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/15 transition-all group"
                      >
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15">
                          <FaqIcon className="h-3 w-3 text-primary" />
                        </div>
                        <span className="flex-1 text-[10.5px] font-medium leading-relaxed text-foreground">{faq.question}</span>
                        <ChevronLeft className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="p-3 space-y-2.5">
                {/* Question */}
                <div className="bg-primary/10 rounded-xl px-3 py-2 border border-primary/20">
                  <p className="text-[11px] font-bold text-primary leading-relaxed">{selectedFaq.question}</p>
                </div>
                {/* Answer */}
                <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/30">
                  <p className="text-[10.5px] leading-[1.9] text-foreground whitespace-pre-line">{selectedFaq.answer}</p>
                </div>
                {/* Guide button */}
                {selectedFaq.guideSteps && selectedFaq.guideSteps.length > 0 && (
                  <button
                    onClick={() => startGuide(selectedFaq)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-l from-primary to-primary/90 text-primary-foreground text-[11px] font-bold hover:shadow-lg transition-all active:scale-[0.98]"
                  >
                    <Compass className="h-3.5 w-3.5" />
                    قم بتوجيهي إليه
                  </button>
                )}
                {/* Back */}
                <button
                  onClick={() => setSelectedFaq(null)}
                  className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline"
                >
                  <ArrowRight className="h-3 w-3" />
                  العودة للأسئلة
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border/40 bg-muted/15 px-2.5 py-2 flex items-center gap-1.5">
            <button
              onClick={handleDirectChat}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-[10px] font-semibold transition-colors"
            >
              <MessageCircle className="h-3 w-3" />
              محادثة مع الدعم
            </button>
            <button
              onClick={() => { setIsOpen(false); setIsHidden(true); }}
              className="px-2 py-1.5 rounded-xl text-[9px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              إخفاء
            </button>
          </div>
        </div>
      )}
    </>
  );
}
