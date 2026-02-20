import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { 
  Bot, X, ChevronLeft, ArrowRight, MessageCircle, Compass, 
  Wallet, ShoppingCart, Trophy, Star, Shield, CreditCard, 
  Users, Store, Package, FileText, HelpCircle,
  Eye, Search, Heart, Bell, MapPin, Tag, Ticket, Gift,
  Crown, Zap, ExternalLink, Send, Clock, Sparkles
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
  elementFinder?: () => HTMLElement | null;
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

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type HideDuration = "1h" | "12h" | "1d" | "1w";

const HIDE_DURATIONS: { key: HideDuration; label: string; ms: number }[] = [
  { key: "1h", label: "ساعة", ms: 60 * 60 * 1000 },
  { key: "12h", label: "١٢ ساعة", ms: 12 * 60 * 60 * 1000 },
  { key: "1d", label: "يوم", ms: 24 * 60 * 60 * 1000 },
  { key: "1w", label: "أسبوع", ms: 7 * 24 * 60 * 60 * 1000 },
];

// ─── Element Finders ──────────────────────────────────────────
const finders = {
  searchBar: () => document.querySelector('input[type="search"], input[placeholder*="ابحث"]') as HTMLElement | null,
  cartBtn: () => document.querySelector('button[aria-label="سلة التسوق"]') as HTMLElement | null,
  userMenuBtn: () => document.querySelector('button[aria-label="قائمة المستخدم"]') as HTMLElement | null,
  rewardsBtn: () => document.querySelector('button[aria-label="مركز المكافآت"]') as HTMLElement | null,
  customRequestBtn: () => document.querySelector('button[aria-label="طلب منتج مخصص"]') as HTMLElement | null,
  categoriesLink: () => {
    const links = document.querySelectorAll('a');
    for (const l of links) { if (l.getAttribute('href') === '/categories') return l as HTMLElement; }
    return null;
  },
  communityLink: () => {
    const links = document.querySelectorAll('a');
    for (const l of links) { if (l.getAttribute('href') === '/community') return l as HTMLElement; }
    return null;
  },
  pageHeading: () => document.querySelector('main h1, h1') as HTMLElement | null,
  rewardsTabByText: (text: string) => () => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent?.trim() === text && b.closest('[class*="grid-cols-4"]')) return b as HTMLElement;
    }
    return null;
  },
  rewardsSubTabByText: (text: string) => () => {
    const btns = document.querySelectorAll('button');
    for (const b of btns) {
      if (b.textContent?.trim() === text && b.closest('[class*="flex"][class*="overflow"]')) return b as HTMLElement;
    }
    return null;
  },
  newRequestBtn: () => {
    const btns = document.querySelectorAll('a, button');
    for (const b of btns) {
      if (b.textContent?.includes('طلب جديد') || b.textContent?.includes('إضافة طلب')) return b as HTMLElement;
    }
    return null;
  },
  couponInput: () => document.querySelector('input[placeholder*="كود"], input[placeholder*="خصم"], input[placeholder*="كوبون"]') as HTMLElement | null,
  addAddressBtn: () => {
    const btns = document.querySelectorAll('a, button');
    for (const b of btns) {
      if (b.textContent?.includes('إضافة عنوان') || b.textContent?.includes('عنوان جديد')) return b as HTMLElement;
    }
    return null;
  },
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
  { category: "general", icon: MessageCircle, question: "كيف يمكنني التواصل مع الدعم؟", answer: "يمكنك التواصل مع فريق الدعم عبر زر المحادثة العائم (أيقونة الدردشة) الموجود في أسفل يسار الشاشة. سيتم فتح محادثة مباشرة مع فريق الدعم الذي سيساعدك في أي استفسار." },
  { category: "general", icon: Search, question: "كيف أبحث عن منتج؟", answer: "استخدم شريط البحث في أعلى الصفحة الرئيسية. يمكنك البحث بالاسم أو الوصف. كما يمكنك تصفح الأقسام والفئات للعثور على ما تبحث عنه.",
    guideSteps: [{ path: "/", description: "هذا شريط البحث — اكتب اسم المنتج هنا", elementFinder: finders.searchBar }]
  },
  { category: "general", icon: Heart, question: "كيف أضيف منتج للمفضلة؟", answer: "عند تصفح أي منتج، اضغط على أيقونة القلب ♡ لإضافته للمفضلة. يمكنك الوصول لقائمة المفضلة من قائمة المستخدم في الشريط العلوي.",
    guideSteps: [{ path: "/", description: "اضغط على أيقونة المستخدم هنا ← ثم اختر 'المفضلة'", elementFinder: finders.userMenuBtn }]
  },
  { category: "general", icon: Bell, question: "كيف أتابع الإشعارات؟", answer: "اضغط على أيقونة المستخدم في الشريط العلوي ثم اختر 'الإشعارات' لعرض جميع إشعاراتك.",
    guideSteps: [{ path: "/", description: "اضغط على أيقونة المستخدم ← ثم اختر 'الإشعارات'", elementFinder: finders.userMenuBtn }]
  },
  { category: "general", icon: MapPin, question: "كيف أضيف عنوان توصيل؟", answer: "اذهب إلى ملفك الشخصي ← العناوين ← إضافة عنوان جديد. أدخل تفاصيل العنوان (المحافظة، المنطقة، الشارع، رقم الهاتف).",
    guideSteps: [{ path: "/addresses", description: "هذه صفحة العناوين — يمكنك إضافة عنوان جديد من هنا", elementFinder: finders.addAddressBtn }]
  },
  { category: "orders", icon: ShoppingCart, question: "كيف يمكنني وضع طلبي؟", answer: "1. تصفح المنتجات واختر المنتج المناسب\n2. حدد الخيارات (اللون، الحجم، الكمية)\n3. اضغط 'أضف للسلة'\n4. اذهب للسلة وأكمل الشراء",
    guideSteps: [
      { path: "/", description: "تصفح المنتجات من الصفحة الرئيسية واختر ما يناسبك", elementFinder: finders.searchBar },
      { path: "/cart", description: "هذه سلة المشتريات — راجع طلبك وأكمل الشراء", elementFinder: finders.pageHeading },
    ]
  },
  { category: "orders", icon: Eye, question: "كيف يمكنني تتبع طلبي؟", answer: "اذهب إلى 'طلباتي'. ستجد جميع طلباتك مع حالة كل طلب:\n• قيد المراجعة\n• قيد التجهيز\n• تم الشحن\n• تم التوصيل",
    guideSteps: [{ path: "/my-orders", description: "هذه صفحة طلباتي — يمكنك تتبع جميع طلباتك هنا", elementFinder: finders.pageHeading }]
  },
  { category: "orders", icon: Tag, question: "كيف أستخدم كود الخصم؟", answer: "عند إتمام الطلب في صفحة السلة، ستجد حقل 'كود الخصم'. أدخل الكود واضغط 'تطبيق'. سيتم خصم المبلغ تلقائياً.",
    guideSteps: [{ path: "/cart", description: "في صفحة السلة، ابحث عن حقل كود الخصم وأدخل الكود", elementFinder: finders.couponInput }]
  },
  { category: "orders", icon: Package, question: "هل يمكنني إلغاء طلبي؟", answer: "يمكنك إلغاء الطلب إذا كان في حالة 'قيد المراجعة' فقط. بعد بدء التجهيز لا يمكن الإلغاء. تواصل مع الدعم لأي حالات استثنائية." },
  { category: "wallet", icon: Wallet, question: "كيف يمكنني شحن محفظتي؟", answer: "اضغط على أيقونة المستخدم في الشريط العلوي ← المحفظة ← شحن. اختر المبلغ وطريقة الدفع.",
    guideSteps: [{ path: "/", description: "اضغط على أيقونة المستخدم ← ثم اختر 'المحفظة'", elementFinder: finders.userMenuBtn }]
  },
  { category: "wallet", icon: CreditCard, question: "كيف أدفع من المحفظة؟", answer: "عند إتمام أي طلب، اختر 'الدفع من المحفظة' كطريقة دفع. سيتم خصم المبلغ مباشرة. تأكد من وجود رصيد كافٍ." },
  { category: "wallet", icon: ExternalLink, question: "هل يمكنني سحب رصيد المحفظة؟", answer: "رصيد المحفظة مخصص للشراء من منصة ليفو فقط ولا يمكن سحبه نقداً." },
  { category: "points", icon: Star, question: "ماذا تعني النقاط وما فائدتها؟", answer: "النقاط هي نظام مكافآت ليفو:\n• استبدالها بمنتجات مجانية\n• الحصول على خصومات\n• شراء تذاكر المسابقات\n• ترقية مستوى العضوية",
    guideSteps: [
      { path: "/", description: "اضغط على أيقونة المكافآت للذهاب لمركز المكافآت", elementFinder: finders.rewardsBtn },
      { path: "/rewards?tab=points", description: "هذا تبويب 'النقاط' — هنا تجد رصيدك وكل ما يتعلق بنقاطك", elementFinder: finders.rewardsTabByText('النقاط') },
    ]
  },
  { category: "points", icon: Zap, question: "كيف أحصل على النقاط؟", answer: "طرق كسب النقاط:\n• الشراء من المتجر\n• المهام اليومية\n• المشاركة في الفعاليات\n• إحالة أصدقاء",
    guideSteps: [
      { path: "/rewards?tab=points&sub=daily-tasks", description: "تبويب 'النقاط' — اضغط على 'المهام' لرؤية المهام اليومية", elementFinder: finders.rewardsTabByText('النقاط') },
      { path: "/rewards?tab=points&sub=daily-tasks", description: "هذه المهام اليومية — أكملها لكسب النقاط", elementFinder: finders.rewardsSubTabByText('المهام') },
    ]
  },
  { category: "points", icon: Gift, question: "كيف أستبدل النقاط؟", answer: "اذهب إلى مركز المكافآت ← متجر النقاط. تصفح المكافآت المتاحة واستبدلها بنقاطك.",
    guideSteps: [
      { path: "/rewards?tab=points&sub=store", description: "اذهب لتبويب 'النقاط'", elementFinder: finders.rewardsTabByText('النقاط') },
      { path: "/rewards?tab=points&sub=store", description: "اضغط على 'متجر النقاط' لاستبدال نقاطك بمكافآت", elementFinder: finders.rewardsSubTabByText('متجر النقاط') },
    ]
  },
  { category: "points", icon: Star, question: "هل تنتهي صلاحية النقاط؟", answer: "النقاط لا تنتهي صلاحيتها طالما حسابك نشط." },
  { category: "tickets", icon: Ticket, question: "ماذا تعني التذاكر وما فائدتها؟", answer: "التذاكر عملة خاصة للمشاركة في المسابقات والسحوبات. كل تذكرة = فرصة للفوز." },
  { category: "tickets", icon: Gift, question: "كيف أحصل على التذاكر؟", answer: "• شراؤها من متجر النقاط\n• مكافأة يومية على المهام\n• هدية مع بعض المشتريات\n• حزم تذاكر بأسعار مخفضة" },
  { category: "tickets", icon: Trophy, question: "كيف أستخدم التذاكر؟", answer: "مركز المكافآت ← المسابقات ← اختر مسابقة ← حدد عدد التذاكر ← اضغط 'شارك'.",
    guideSteps: [
      { path: "/rewards?tab=competitions", description: "اذهب لتبويب 'المسابقات'", elementFinder: finders.rewardsTabByText('المسابقات') },
      { path: "/rewards?tab=competitions", description: "اختر مسابقة نشطة واستخدم تذاكرك للمشاركة", elementFinder: finders.pageHeading },
    ]
  },
  { category: "competitions", icon: Trophy, question: "ما هي المسابقات؟", answer: "فعاليات تنافسية متنوعة: سحوبات عشوائية، أول فائز، جمع أحرف، فريقية. الجوائز: منتجات، خصومات، أرصدة!" },
  { category: "competitions", icon: Zap, question: "كيف أشارك بالمسابقات؟", answer: "1. مركز المكافآت ← المسابقات\n2. اختر المسابقة النشطة\n3. حدد عدد التذاكر\n4. اضغط 'شارك الآن'",
    guideSteps: [
      { path: "/", description: "اضغط على أيقونة المكافآت أولاً", elementFinder: finders.rewardsBtn },
      { path: "/rewards?tab=competitions", description: "اضغط على تبويب 'المسابقات'", elementFinder: finders.rewardsTabByText('المسابقات') },
    ]
  },
  { category: "competitions", icon: Crown, question: "كيف أعرف إذا فزت؟", answer: "• إشعار فوري عند الفوز 🎉\n• ظهورك في قائمة الفائزين\n• الجائزة تُضاف تلقائياً" },
  { category: "membership", icon: Crown, question: "ما هي عضوية ليفو؟", answer: "نظام ولاء بأربع مستويات:\n🥈 فضي - خصم 5%\n🥇 ذهبي - خصم 10%\n💎 ماسي - خصم 15%\n💚 زمردي - خصم 20%",
    guideSteps: [
      { path: "/rewards?tab=cards", description: "اضغط على تبويب 'العضوية'", elementFinder: finders.rewardsTabByText('العضوية') },
    ]
  },
  { category: "membership", icon: CreditCard, question: "كيف أشتري عضوية؟", answer: "مركز المكافآت ← البطاقات ← اختر المستوى ← أتمم الشراء.",
    guideSteps: [
      { path: "/", description: "اضغط على أيقونة المكافآت أولاً", elementFinder: finders.rewardsBtn },
      { path: "/rewards?tab=cards&sub=purchase", description: "اضغط على تبويب 'العضوية'", elementFinder: finders.rewardsTabByText('العضوية') },
    ]
  },
  { category: "membership", icon: Tag, question: "ماذا يعني خصم الأعضاء؟", answer: "خصم إضافي تلقائي على مشترياتك حسب مستوى العضوية. يُحسب قبل الكوبونات." },
  { category: "membership", icon: Shield, question: "كيف أؤمّن طابعتي؟", answer: "مركز المكافآت ← التأمين ← اختر خطة الحماية.",
    guideSteps: [
      { path: "/rewards?tab=insurance", description: "اضغط على تبويب 'الحماية'", elementFinder: finders.rewardsTabByText('الحماية') },
    ]
  },
  { category: "community", icon: Users, question: "ما هو مجتمع ليفو؟", answer: "سوق يجمع العملاء مع تجار الطباعة المعتمدين. اطلب تصميمك، احصل على عروض، قارن واختر الأنسب.",
    guideSteps: [{ path: "/", description: "اضغط هنا للذهاب لمجتمع ليفو", elementFinder: finders.communityLink }]
  },
  { category: "community", icon: FileText, question: "كيف أضع طلب طباعة؟", answer: "1. اذهب لمجتمع ليفو\n2. اضغط 'طلب جديد'\n3. أدخل التفاصيل\n4. أرفق الصور\n5. انشر الطلب", customerOnly: true,
    guideSteps: [{ path: "/community", description: "اضغط 'طلب جديد' لإنشاء طلب طباعة", elementFinder: finders.newRequestBtn }]
  },
  { category: "community", icon: Tag, question: "لماذا الأسعار مختلفة بين التجار؟", answer: "كل تاجر لديه معدات وتكاليف مختلفة. هذا يمنحك حرية المقارنة واختيار الأنسب.", customerOnly: true },
  { category: "community", icon: MessageCircle, question: "كيف أتواصل مع التاجر؟", answer: "بعد قبول عرض تاجر، تُفتح محادثة مباشرة تلقائياً.", customerOnly: true },
  { category: "community", icon: Shield, question: "ماذا لو حدثت مشكلة مع تاجر؟", answer: "تفاصيل الطلب ← 'تقديم شكوى'. فريق ليفو يراجع ويتدخل. أموالك محمية حتى تأكيد الاستلام.", customerOnly: true },
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات'", answer: "يفتح قائمة محادثاتك مع التجار والدعم.", customerOnly: true },
  { category: "buttons", icon: FileText, question: "زر 'طلب جديد'", answer: "ينقلك لنموذج إنشاء طلب طباعة جديد.", customerOnly: true },
  { category: "buttons", icon: Package, question: "زر 'طلباتي'", answer: "يعرض جميع طلباتك في المجتمع مع حالاتها.", customerOnly: true,
    guideSteps: [{ path: "/community/customer/requests", description: "هذه صفحة طلباتك في المجتمع", elementFinder: finders.pageHeading }]
  },
  { category: "buttons", icon: Users, question: "زر 'ملفي'", answer: "ملفك الشخصي: تعديل الاسم والصورة والنبذة.", customerOnly: true,
    guideSteps: [{ path: "/profile", description: "صفحة ملفك الشخصي", elementFinder: finders.pageHeading }]
  },
  { category: "community", icon: Store, question: "كيف أدير متجري؟", answer: "لوحة إدارة المتجر: إضافة/تعديل المنتجات، إدارة المخزون والأسعار.", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/store", description: "لوحة إدارة متجرك", elementFinder: finders.pageHeading }]
  },
  { category: "community", icon: FileText, question: "كيف أقدم عرض سعر؟", answer: "طلبات الزبائن ← تصفح ← اختر الطلب ← تقديم عرض.", merchantOnly: true,
    guideSteps: [{ path: "/community/requests", description: "طلبات الزبائن — تصفح وقدم عروضك", elementFinder: finders.pageHeading }]
  },
  { category: "buttons", icon: Store, question: "زر 'إدارة المتجر'", answer: "لوحة تحكم متجرك الكاملة.", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/store", description: "هنا يمكنك إدارة متجرك", elementFinder: finders.pageHeading }]
  },
  { category: "buttons", icon: Package, question: "زر 'الطلبات' (تاجر)", answer: "طلبات الشراء من عملائك.", merchantOnly: true,
    guideSteps: [{ path: "/community/merchant/orders", description: "صفحة طلبات عملائك", elementFinder: finders.pageHeading }]
  },
  { category: "buttons", icon: FileText, question: "زر 'طلبات الزبائن'", answer: "طلبات الطباعة المخصصة من العملاء.", merchantOnly: true,
    guideSteps: [{ path: "/community/requests", description: "تصفح طلبات الزبائن وقدم عروضك", elementFinder: finders.pageHeading }]
  },
  { category: "buttons", icon: MessageCircle, question: "زر 'المحادثات' (تاجر)", answer: "جميع محادثاتك مع العملاء. الرد السريع يرفع تقييمك!", merchantOnly: true },
  { category: "general", icon: Tag, question: "ما هي العروض الخاصة؟", answer: "صفقات محدودة بكميات وأوقات وأسعار استثنائية.",
    guideSteps: [{ path: "/offers", description: "صفحة العروض الخاصة — تصفح الصفقات المتاحة", elementFinder: finders.pageHeading }]
  },
];

// ─── Component ────────────────────────────────────────────────
export default function LevoHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>("general");
  const [spotlight, setSpotlight] = useState<SpotlightState>({ active: false, stepIndex: 0, steps: [], rect: null });
  const [showHideMenu, setShowHideMenu] = useState(false);
  const [activeTab, setActiveTab] = useState<"faq" | "chat">("faq");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem("levo-ai-chat-messages");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [chatInput, setChatInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const { user } = useAuth();

  // Persist chat messages to localStorage
  useEffect(() => {
    if (chatMessages.length > 0) {
      localStorage.setItem("levo-ai-chat-messages", JSON.stringify(chatMessages.slice(-30)));
    }
  }, [chatMessages]);

  const startNewChat = useCallback(() => {
    setChatMessages([]);
    localStorage.removeItem("levo-ai-chat-messages");
  }, []);
  const navigate = useNavigate();
  const location = useLocation();

  // Check hide timer from localStorage
  const checkHideStatus = useCallback(() => {
    const hiddenUntil = localStorage.getItem("levo-help-hidden-until");
    if (hiddenUntil) {
      const until = parseInt(hiddenUntil, 10);
      if (Date.now() < until) return true;
      localStorage.removeItem("levo-help-hidden-until");
    }
    return false;
  }, []);

  const [isHidden, setIsHidden] = useState(checkHideStatus);

  // Re-check hide timer periodically so it auto-shows when expired
  // Also re-check on visibility change (when user returns to tab)
  useEffect(() => {
    const recheck = () => {
      const hidden = checkHideStatus();
      setIsHidden(hidden);
    };
    
    // Check every 10 seconds instead of 30
    const interval = setInterval(recheck, 10000);
    
    // Also check when tab becomes visible again
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") recheck();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkHideStatus]);

  const hideFor = (duration: HideDuration) => {
    const d = HIDE_DURATIONS.find(h => h.key === duration);
    if (d) {
      localStorage.setItem("levo-help-hidden-until", String(Date.now() + d.ms));
      setIsHidden(true);
      setShowHideMenu(false);
      setIsOpen(false);
    }
  };

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

  // ─── AI Chat ────────────────────────────────────────────────
  const streamChat = useCallback(async (userMessage: string) => {
    const userMsg: ChatMessage = { role: "user", content: userMessage };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setIsStreaming(true);

    let assistantContent = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/levo-assistant-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: newMessages }),
        }
      );

      if (!resp.ok) {
        const errData = await resp.json().catch(() => ({}));
        throw new Error(errData.error || "حدث خطأ");
      }

      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setChatMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: "assistant", content: err.message || "حدث خطأ، حاول مرة أخرى." }]);
    } finally {
      setIsStreaming(false);
    }
  }, [chatMessages]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ─── Spotlight Logic ────────────────────────────────────────
  const currentStep = spotlight.active ? spotlight.steps[spotlight.stepIndex] : null;

  const findAndSpotlight = useCallback((step: GuideStep) => {
    if (retryRef.current) clearTimeout(retryRef.current);
    const tryFind = (attempt = 0) => {
      let el: HTMLElement | null = step.elementFinder?.() ?? null;
      if (!el) el = document.querySelector('main h1') as HTMLElement | null;
      if (!el) el = document.querySelector('h1') as HTMLElement | null;
      if (!el) el = document.querySelector('main > div:first-child') as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const rect = el!.getBoundingClientRect();
          setSpotlight(prev => ({ ...prev, rect }));
        }, 400);
      } else if (attempt < 8) {
        retryRef.current = setTimeout(() => tryFind(attempt + 1), 600);
      } else {
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
    const currentFull = location.pathname + location.search;
    const needsNav = firstStep.path && firstStep.path !== currentFull && !currentFull.startsWith(firstStep.path);
    if (needsNav) {
      navigate(firstStep.path);
      setTimeout(() => findAndSpotlight(firstStep), 1500);
    } else {
      findAndSpotlight(firstStep);
    }
  }, [navigate, location.pathname, location.search, findAndSpotlight]);

  const nextStep = useCallback(() => {
    const nextIdx = spotlight.stepIndex + 1;
    if (nextIdx >= spotlight.steps.length) { exitSpotlight(); return; }
    const step = spotlight.steps[nextIdx];
    setSpotlight(prev => ({ ...prev, stepIndex: nextIdx, rect: null }));
    const currentFull = location.pathname + location.search;
    const needsNav = step.path && step.path !== currentFull && !currentFull.startsWith(step.path);
    if (needsNav) {
      navigate(step.path);
      setTimeout(() => findAndSpotlight(step), 1500);
    } else {
      findAndSpotlight(step);
    }
  }, [spotlight.stepIndex, spotlight.steps, navigate, location.pathname, location.search, findAndSpotlight]);

  const exitSpotlight = useCallback(() => {
    if (retryRef.current) clearTimeout(retryRef.current);
    setSpotlight({ active: false, stepIndex: 0, steps: [], rect: null });
  }, []);

  useEffect(() => {
    if (!spotlight.active || !currentStep?.elementFinder) return;
    const update = () => {
      const el = currentStep.elementFinder!();
      if (el) setSpotlight(prev => ({ ...prev, rect: el.getBoundingClientRect() }));
    };
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [spotlight.active, currentStep]);

  useEffect(() => { return () => { if (retryRef.current) clearTimeout(retryRef.current); }; }, []);

  const handleDirectChat = useCallback(() => {
    setIsOpen(false);
    setTimeout(() => {
      const allButtons = document.querySelectorAll('button');
      for (const btn of allButtons) {
        if (btn.classList.contains('fixed') || btn.className.includes('fixed')) {
          const rect = btn.getBoundingClientRect();
          if (rect.left < 100 && rect.top > window.innerHeight - 120 && !btn.closest('.levo-help-bot-trigger')) {
            btn.click();
            return;
          }
        }
      }
    }, 300);
  }, []);

  // Only show on community main page and main site pages, hide on settings/profile/orders/modals
  const restrictedPaths = [
    '/community/merchant/store',
    '/community/merchant/orders', 
    '/community/customer/track',
    '/user-info',
    '/settings',
    '/profile',
  ];
  const isOnRestrictedPage = restrictedPaths.some(p => location.pathname.startsWith(p));
  
  if (isHidden && !isOpen && !spotlight.active) return null;
  if (isOnRestrictedPage && !isOpen && !spotlight.active) return null;

  const hasMultipleSteps = spotlight.steps.length > 1;
  const isLastStep = spotlight.stepIndex >= spotlight.steps.length - 1;

  return (
    <>
      {/* ─── Spotlight Overlay ─── */}
      {spotlight.active && (
        <div className="fixed inset-0 z-[9999]" dir="rtl">
          <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }}>
            <defs>
              <mask id="spotlight-mask">
                <rect width="100%" height="100%" fill="white" />
                {spotlight.rect && (
                  <rect x={spotlight.rect.left - 10} y={spotlight.rect.top - 10} width={spotlight.rect.width + 20} height={spotlight.rect.height + 20} rx="12" fill="black" />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#spotlight-mask)" style={{ pointerEvents: "all" }} onClick={exitSpotlight} />
          </svg>
          {spotlight.rect && (
            <div className="absolute rounded-xl border-2 border-primary pointer-events-none z-[10000]" style={{ top: spotlight.rect.top - 10, left: spotlight.rect.left - 10, width: spotlight.rect.width + 20, height: spotlight.rect.height + 20, boxShadow: "0 0 20px hsl(var(--primary) / 0.4)" }} />
          )}
          <div className="absolute z-[10001] flex flex-col items-center gap-1.5 animate-fade-in pointer-events-none" style={spotlight.rect ? { top: Math.min(spotlight.rect.bottom + 16, window.innerHeight - 120), left: Math.max(20, Math.min(spotlight.rect.left + spotlight.rect.width / 2, window.innerWidth - 180)), transform: "translateX(-50%)" } : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>
            {spotlight.rect && <div className="text-primary text-xl animate-bounce">▲</div>}
            <div className="bg-card border border-primary/40 rounded-2xl px-5 py-3 shadow-2xl max-w-[280px] pointer-events-auto">
              <p className="text-sm font-bold text-foreground text-center leading-relaxed">{currentStep?.description}</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                {hasMultipleSteps && <span className="text-[10px] text-muted-foreground">{spotlight.stepIndex + 1} / {spotlight.steps.length}</span>}
                {hasMultipleSteps && !isLastStep ? (
                  <button onClick={nextStep} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">التالي ←</button>
                ) : (
                  <button onClick={exitSpotlight} className="px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors">فهمت ✓</button>
                )}
              </div>
            </div>
          </div>
          <button onClick={exitSpotlight} className="fixed top-4 left-4 z-[10002] flex items-center gap-1.5 bg-card border border-border text-foreground px-3 py-2 rounded-full shadow-xl hover:bg-accent transition-colors text-xs font-bold">
            <X className="h-3.5 w-3.5" />خروج
          </button>
        </div>
      )}

      {/* ─── Floating Icon Button — positioned ABOVE the chat button ─── */}
      {!isOpen && !isHidden && (
        <div className="fixed bottom-24 left-4 sm:left-6 z-40 flex flex-col items-center gap-1 levo-help-bot-trigger">
          <button
            onClick={() => setIsOpen(true)}
            className="group relative h-11 w-11 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center"
          >
            <Bot className="h-5 w-5" />
            <span className="absolute inset-0 rounded-full bg-primary/20 animate-ping" style={{ animationDuration: "4s" }} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowHideMenu(!showHideMenu); }}
            className="text-[8px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            إخفاء
          </button>
          {/* Hide duration menu - rendered above the button */}
          {showHideMenu && (
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-2xl p-2 min-w-[160px] animate-fade-in z-[9999]">
              <p className="text-[9px] text-muted-foreground font-bold mb-1.5 px-2">إخفاء المساعد لمدة:</p>
              {HIDE_DURATIONS.map(d => (
                <button
                  key={d.key}
                  onClick={() => hideFor(d.key)}
                  className="w-full text-right text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Chat Panel ─── */}
      {isOpen && (
        <div className="fixed bottom-20 left-4 sm:left-6 z-40 w-[330px] max-h-[75vh] flex flex-col rounded-2xl border border-border/80 bg-card shadow-2xl animate-scale-in overflow-hidden" dir="rtl">
          
          {/* Header */}
          <div className="shrink-0 bg-gradient-to-l from-primary via-primary/95 to-primary/85 px-3.5 py-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-white/15 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-primary-foreground">مساعد ليفو</h3>
                  <p className="text-[9px] text-primary-foreground/60">
                    {activeTab === "chat" ? "مدعوم بالذكاء الاصطناعي" : "اختر سؤالك وسأوجهك"}
                  </p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/15 transition-colors">
                <X className="h-3.5 w-3.5 text-primary-foreground" />
              </button>
            </div>
          </div>

          {/* Tab switcher */}
          <div className="shrink-0 border-b border-border/40 bg-muted/20 flex">
            <button
              onClick={() => setActiveTab("faq")}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold transition-colors flex items-center justify-center gap-1",
                activeTab === "faq" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <HelpCircle className="h-3 w-3" />
              الأسئلة الشائعة
            </button>
            <button
              onClick={() => setActiveTab("chat")}
              className={cn(
                "flex-1 py-2 text-[10px] font-bold transition-colors flex items-center justify-center gap-1",
                activeTab === "chat" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="h-3 w-3" />
              دردشة ذكية
            </button>
          </div>

          {/* ─── FAQ Tab ─── */}
          {activeTab === "faq" && (
            <>
              {/* Category Tabs */}
              {!selectedFaq && (
                <div className="shrink-0 border-b border-border/40 bg-muted/10">
                  <div className="flex overflow-x-auto scrollbar-hide gap-1 p-1.5">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveCategory(cat.id)}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-semibold whitespace-nowrap transition-all shrink-0",
                          activeCategory === cat.id 
                            ? "bg-primary text-primary-foreground shadow-sm" 
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        )}
                      >
                        <span>{cat.emoji}</span>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-y-auto">
                {!selectedFaq ? (
                  <div className="p-2 space-y-1">
                    {filteredFaqs.length === 0 ? (
                      <div className="text-center py-6 text-[11px] text-muted-foreground">لا توجد أسئلة في هذا القسم</div>
                    ) : (
                      filteredFaqs.map((faq, idx) => {
                        const FaqIcon = faq.icon || HelpCircle;
                        return (
                          <button key={idx} onClick={() => setSelectedFaq(faq)} className="w-full flex items-center gap-2 text-right px-2.5 py-2 rounded-xl hover:bg-primary/5 border border-transparent hover:border-primary/15 transition-all group">
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
                    <div className="bg-primary/10 rounded-xl px-3 py-2 border border-primary/20">
                      <p className="text-[11px] font-bold text-primary leading-relaxed">{selectedFaq.question}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl px-3 py-2.5 border border-border/30">
                      <p className="text-[10.5px] leading-[1.9] text-foreground whitespace-pre-line">{selectedFaq.answer}</p>
                    </div>
                    {selectedFaq.guideSteps && selectedFaq.guideSteps.length > 0 && (
                      <button onClick={() => startGuide(selectedFaq)} className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-l from-primary to-primary/90 text-primary-foreground text-[11px] font-bold hover:shadow-lg transition-all active:scale-[0.98]">
                        <Compass className="h-3.5 w-3.5" />
                        قم بتوجيهي إليه
                      </button>
                    )}
                    <button onClick={() => setSelectedFaq(null)} className="flex items-center gap-1 text-[10px] text-primary font-semibold hover:underline">
                      <ArrowRight className="h-3 w-3" />
                      العودة للأسئلة
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

           {/* ─── AI Chat Tab ─── */}
          {activeTab === "chat" && (
            <>
              {/* New chat button */}
              {chatMessages.length > 0 && (
                <div className="shrink-0 border-b border-border/40 bg-muted/10 px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">{chatMessages.filter(m => m.role === "user").length} رسالة</span>
                  <button
                    onClick={startNewChat}
                    className="flex items-center gap-1 text-[9px] font-semibold text-primary hover:text-primary/80 transition-colors"
                  >
                    <Sparkles className="h-2.5 w-2.5" />
                    محادثة جديدة
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px]">
                {chatMessages.length === 0 && (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground mb-1">مرحباً! أنا مساعد ليفو الذكي 🤖</p>
                    <p className="text-[10px] text-muted-foreground">اسألني أي شيء عن منصة ليفو</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={cn("flex", msg.role === "user" ? "justify-start" : "justify-end")}>
                  <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed",
                      msg.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-sm" 
                        : "bg-card border border-border/50 text-foreground rounded-tl-sm"
                    )}>
                      <p className="whitespace-pre-line">{msg.content}</p>
                    </div>
                  </div>
                ))}
                {isStreaming && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-end">
                    <div className="bg-card border border-border/50 rounded-2xl rounded-tl-sm px-3 py-2">
                      <div className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat input */}
              <div className="shrink-0 border-t border-border/40 bg-muted/15 p-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (chatInput.trim() && !isStreaming) {
                      streamChat(chatInput.trim());
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="اكتب سؤالك..."
                    className="flex-1 bg-background border border-border/50 rounded-xl px-3 py-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                    disabled={isStreaming}
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || isStreaming}
                    className="h-8 w-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            </>
          )}

          {/* Footer - only for FAQ tab */}
          {activeTab === "faq" && (
            <div className="shrink-0 border-t border-border/40 bg-muted/15 px-2.5 py-2 flex items-center gap-1.5 relative">
              <button onClick={handleDirectChat} className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl bg-accent hover:bg-accent/80 text-foreground text-[10px] font-semibold transition-colors">
                <MessageCircle className="h-3 w-3" />
                محادثة مع الدعم
              </button>
              <button onClick={() => setShowHideMenu(!showHideMenu)} className="px-2 py-1.5 rounded-xl text-[9px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                إخفاء
              </button>
              {/* Hide duration menu inside the panel */}
              {showHideMenu && (
                <div className="absolute bottom-full mb-1 right-2 bg-card border border-border rounded-xl shadow-2xl p-2 min-w-[160px] animate-fade-in z-[9999]">
                  <p className="text-[9px] text-muted-foreground font-bold mb-1.5 px-2">إخفاء المساعد لمدة:</p>
                  {HIDE_DURATIONS.map(d => (
                    <button
                      key={d.key}
                      onClick={() => hideFor(d.key)}
                      className="w-full text-right text-[10px] px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground transition-colors flex items-center gap-1.5"
                    >
                      <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
