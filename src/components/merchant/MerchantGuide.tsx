import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  X, Store, Package, FileText, MessageCircle, Star, Settings, Gift, 
  DollarSign, ShoppingBag, Truck, Shield,
  ChevronDown, ChevronUp, BookOpen, ArrowLeft,
  Camera, Tag, MapPin, Clock, CheckCircle2,
  BarChart3, Zap, Users, Wallet, Eye, 
  Paintbrush, LayoutGrid, List, Grid3X3, Image,
  HandCoins, CreditCard, BadgePercent, TrendingUp,
  Award, ShieldCheck, MessageSquare, Send,
  PenSquare, Layers, ToggleLeft, Palette,
  Globe, Instagram, Facebook, Share2,
  CircleDollarSign, Receipt, PiggyBank,
  ThumbsUp, Medal, Crown,
  Megaphone, Lightbulb, Rocket, Target,
  Info, HelpCircle, ChevronLeft, ZoomIn
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface MerchantGuideProps {
  open: boolean;
  onClose: () => void;
  onDismissForever: () => void;
}

interface GuideStep {
  icon: React.ElementType;
  text: string;
  tip?: string;
}

interface GuideSection {
  icon: React.ElementType;
  title: string;
  emoji: string;
  sectionKey: string;
  color: string;
  bgColor: string;
  borderColor: string;
  gradientFrom: string;
  gradientTo: string;
  description: string;
  steps: GuideStep[];
  proTips: string[];
  example?: {
    title: string;
    text: string;
    icon: React.ElementType;
  };
}

interface GuideImage {
  id: string;
  section_key: string;
  image_url: string;
  caption: string | null;
  display_order: number;
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    icon: Store,
    title: "متجرك الخاص",
    emoji: "🏪",
    sectionKey: "store",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    gradientFrom: "from-primary/20",
    gradientTo: "to-primary/5",
    description: "متجرك هو واجهتك أمام العملاء. اجعله احترافياً ومكتملاً لزيادة ثقة العملاء وجذب المزيد من الزوار.",
    steps: [
      { icon: PenSquare, text: "اختر اسماً مميزاً وقصيراً لمتجرك — مثال: \"مطبعة النور\" أو \"ستوديو الإبداع\"", tip: "الاسم القصير يسهّل تذكره" },
      { icon: Image, text: "ارفع شعار احترافي (Logo) بجودة عالية — يظهر بجانب اسمك في كل مكان" },
      { icon: FileText, text: "أضف وصفاً تعريفياً يشرح تخصصك — مثال: \"متخصصون في الطباعة ثلاثية الأبعاد والمجسمات الفنية\"" },
      { icon: Globe, text: "ربط حسابات التواصل (فيسبوك، انستغرام، تيك توك) — ليتمكن العملاء من متابعتك والتعرف عليك" },
      { icon: Paintbrush, text: "اختيار إطار مميز لصورة المتجر — الإطارات المميزة تلفت الانتباه وتُميّزك عن المنافسين" },
      { icon: Eye, text: "متجرك يظهر في قائمة التجار — كلما كان مكتملاً ظهرت في مراتب أعلى في نتائج البحث" },
      { icon: MapPin, text: "حدد موقعك الجغرافي (المحافظة) — ليجدك العملاء القريبون بسهولة" },
    ],
    proTips: [
      "أكمل 100% من معلومات متجرك لتظهر في أعلى القائمة",
      "غيّر الشعار كل فترة لتجديد مظهر المتجر",
      "أضف رابط انستغرام لأنه الأكثر استخداماً من العملاء",
    ],
    example: {
      title: "قصة نجاح",
      text: "تاجر أكمل ملف متجره بالكامل (شعار + وصف + روابط تواصل) → زادت زيارات متجره بنسبة 40% خلال أسبوع واحد! 📈",
      icon: TrendingUp,
    },
  },
  {
    icon: ShoppingBag,
    title: "إدارة المنتجات",
    emoji: "🛍️",
    sectionKey: "products",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    gradientFrom: "from-amber-500/20",
    gradientTo: "to-amber-500/5",
    description: "أضف منتجاتك بصور جذابة وأسعار تنافسية. العملاء يتصفحون منتجاتك ويتواصلون معك مباشرة أو يضيفونها للسلة.",
    steps: [
      { icon: Camera, text: "إضافة حتى 5 صور لكل منتج من زوايا مختلفة — الصور الواضحة تزيد المبيعات بنسبة 60%" },
      { icon: DollarSign, text: "تحديد السعر الأصلي وسعر العرض — مثال: 30,000 بدلاً من 25,000 (يظهر خط على السعر القديم)" },
      { icon: Tag, text: "تصنيف المنتجات في فئات — مثال: مجسمات، إكسسوارات، هدايا، حسب الطلب" },
      { icon: ToggleLeft, text: "تفعيل/إيقاف المنتج مؤقتاً — أوقفه عند نفاد المخزون دون حذفه" },
      { icon: Palette, text: "إضافة خيارات متعددة (ألوان، أحجام) — مثال: قلادة متوفرة بـ 3 ألوان و 2 حجم" },
      { icon: BadgePercent, text: "تطبيق خصومات وعروض خاصة — خصم 20% لأول 10 مشترين" },
      { icon: Layers, text: "ترتيب المنتجات حسب الأولوية — اجعل أفضل منتجاتك في المقدمة" },
      { icon: Share2, text: "مشاركة رابط المنتج مباشرة على وسائل التواصل — وصول أكبر لعملاء جدد" },
    ],
    proTips: [
      "صوّر المنتج على خلفية بيضاء بإضاءة طبيعية",
      "أضف وصفاً تفصيلياً يشمل المواد والأبعاد والاستخدام",
      "حدّث الأسعار بانتظام حسب السوق",
      "أضف فيديو قصير للمنتج إن أمكن",
    ],
    example: {
      title: "نصيحة ذهبية",
      text: "المنتجات التي تحتوي على 3+ صور واضحة + وصف تفصيلي تحقق مبيعات أعلى بـ 3 أضعاف من المنتجات ذات صورة واحدة! 📸",
      icon: Camera,
    },
  },
  {
    icon: FileText,
    title: "طلبات العملاء المخصصة",
    emoji: "📋",
    sectionKey: "custom_requests",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    gradientFrom: "from-blue-500/20",
    gradientTo: "to-blue-500/5",
    description: "العملاء ينشرون طلبات مخصصة (مثل تصميم معين أو طباعة حسب المواصفات). تصفّح الطلبات وقدم عرضك للفوز بالعمل.",
    steps: [
      { icon: Eye, text: "تصفح الطلبات الجديدة في تبويب \"طلبات العملاء\" — شاهد الطلبات المتاحة في منطقتك" },
      { icon: CircleDollarSign, text: "تقديم عرض سعر مفصّل — حدد السعر + وقت التسليم + وصف العرض بوضوح" },
      { icon: Users, text: "التنافس مع تجار آخرين — العميل يقارن العروض ويختار الأفضل (سعر + تقييم + سرعة)" },
      { icon: MessageCircle, text: "عند قبول عرضك تُفتح محادثة مباشرة — تواصل مع العميل لتوضيح كل التفاصيل" },
      { icon: CheckCircle2, text: "متابعة حالة الطلب حتى التسليم — من \"قيد التنفيذ\" → \"جاهز\" → \"تم التسليم\"" },
      { icon: HandCoins, text: "استلام المبلغ في محفظتك تلقائياً — بعد تأكيد العميل للاستلام" },
      { icon: Image, text: "إرفاق صور العمل النهائي — اثبت جودة عملك وارفع تقييمك" },
    ],
    proTips: [
      "قدم عرضاً تنافسياً مع وقت تسليم واقعي",
      "أرفق صوراً لأعمال سابقة مشابهة في العرض",
      "استجب بسرعة — أول عرض يصل غالباً ما يُقبل",
      "اسأل العميل عن التفاصيل قبل تقديم العرض",
    ],
    example: {
      title: "مثال عملي",
      text: "عميل طلب مجسم شخصية أنمي → قدمت عرض 15,000 د.ع مع تسليم 3 أيام + صور أعمال سابقة → تم قبول عرضك! 🎉",
      icon: Target,
    },
  },
  {
    icon: Package,
    title: "إدارة الطلبات",
    emoji: "📦",
    sectionKey: "orders",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    gradientFrom: "from-emerald-500/20",
    gradientTo: "to-emerald-500/5",
    description: "لوحة تحكم شاملة لمتابعة جميع طلباتك. من الطلب الجديد حتى التسليم والدفع.",
    steps: [
      { icon: LayoutGrid, text: "عرض جميع الطلبات في مكان واحد — مصنفة حسب الحالة (جديد، قيد التنفيذ، جاهز، مُسلّم)" },
      { icon: BarChart3, text: "تحديث حالة كل طلب بنقرة واحدة — (جديد → قيد التنفيذ → جاهز → تم التسليم)" },
      { icon: MessageSquare, text: "إنشاء طلب مباشر من المحادثة — اتفقت مع عميل في الدردشة؟ أنشئ طلباً رسمياً فوراً" },
      { icon: Receipt, text: "تفاصيل كل طلب — المنتج، الكمية، السعر، العنوان، ملاحظات العميل" },
      { icon: CreditCard, text: "متابعة المدفوعات — حالة الدفع (مدفوع، جزئي، عند الاستلام)" },
      { icon: Wallet, text: "العمولة تُحسب تلقائياً — 1.7% فقط من كل طلب مكتمل" },
    ],
    proTips: [
      "حدّث حالة الطلب فوراً ليعرف العميل التقدم",
      "استخدم الملاحظات لتسجيل أي اتفاق مع العميل",
      "أرسل صورة المنتج النهائي قبل التسليم",
    ],
    example: {
      title: "سير العمل",
      text: "عميل طلب منتج → تحديث الحالة \"قيد التنفيذ\" → إنهاء العمل → تغيير الحالة \"تم التسليم\" → المبلغ يُحوّل لمحفظتك تلقائياً ✅",
      icon: CheckCircle2,
    },
  },
  {
    icon: MessageCircle,
    title: "المحادثات والتواصل",
    emoji: "💬",
    sectionKey: "messages",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    gradientFrom: "from-violet-500/20",
    gradientTo: "to-violet-500/5",
    description: "نظام محادثات متكامل للتواصل المباشر مع العملاء. أرسل صور وملفات وأنشئ طلبات من داخل المحادثة.",
    steps: [
      { icon: Send, text: "رسائل فورية مع العملاء — ردود سريعة تبني الثقة وتزيد المبيعات" },
      { icon: Image, text: "إرسال صور وملفات — شارك تصاميم، عينات، أو صور تقدم العمل" },
      { icon: ShoppingBag, text: "إنشاء طلب من المحادثة — حدد المنتج والسعر والكمية مباشرة" },
      { icon: MessageSquare, text: "رسائل ترحيب تلقائية — تُرسل للعملاء الجدد عند أول تواصل" },
      { icon: Clock, text: "وضع الغياب — رسالة تلقائية عند عدم تواجدك" },
      { icon: Eye, text: "إشعارات الرسائل الجديدة — لا تفوّت أي رسالة من عملائك" },
    ],
    proTips: [
      "فعّل رسالة الترحيب التلقائية — انطباع أول ممتاز!",
      "استجب خلال أقل من ساعة — سرعة الرد تزيد فرصة البيع 70%",
      "أرسل صوراً لأعمالك السابقة لإقناع العميل",
      "استخدم رسالة الغياب عند عدم تواجدك",
    ],
    example: {
      title: "رسالة ترحيب مقترحة",
      text: "\"أهلاً بك في متجري! 👋 تصفح المنتجات واختر ما يعجبك، وأنا جاهز لأي استفسار. وقت التسليم عادة 2-3 أيام ⏰\"",
      icon: Megaphone,
    },
  },
  {
    icon: DollarSign,
    title: "الإيرادات والمحفظة",
    emoji: "💰",
    sectionKey: "revenue",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    gradientFrom: "from-green-500/20",
    gradientTo: "to-green-500/5",
    description: "تابع إيراداتك ومبيعاتك بالتفصيل. المحفظة الإلكترونية تسهّل عمليات الدفع والاستلام.",
    steps: [
      { icon: BarChart3, text: "لوحة إحصائيات شاملة — إجمالي الإيرادات، عدد الطلبات، معدل المبيعات" },
      { icon: Receipt, text: "سجل مفصّل لكل معاملة — تاريخ، المبلغ، العميل، نوع الطلب" },
      { icon: BadgePercent, text: "عمولة المنصة 1.7% فقط — تُخصم تلقائياً من كل طلب مكتمل" },
      { icon: CreditCard, text: "خيارات دفع متعددة للعميل — كامل، نصف المبلغ (+5%)، ربع المبلغ (+10%)، عند الاستلام" },
      { icon: PiggyBank, text: "المحفظة الإلكترونية — رصيدك المتاح + سجل التحويلات" },
      { icon: TrendingUp, text: "تقارير مالية — يومية، أسبوعية، شهرية لمتابعة أدائك" },
      { icon: HandCoins, text: "نظام الديون للدفع عند الاستلام — عمولة إضافية تُحسب تلقائياً" },
    ],
    proTips: [
      "تابع إحصائياتك يومياً لمعرفة أكثر المنتجات مبيعاً",
      "شجّع العملاء على الدفع الكامل — أسرع في الاستلام",
      "راقب رصيد الديون وسددها بانتظام لتجنب إيقاف الحساب",
    ],
    example: {
      title: "حساب العمولة",
      text: "طلب 50,000 د.ع → عمولة 1.7% = 850 د.ع → تحصل على 49,150 د.ع في محفظتك. عند اختيار الدفع نصف المبلغ: يدفع العميل 52,500 (25,000 + 5% رسوم) 💵",
      icon: CircleDollarSign,
    },
  },
  {
    icon: Star,
    title: "التقييمات والسمعة",
    emoji: "⭐",
    sectionKey: "ratings",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    gradientFrom: "from-yellow-500/20",
    gradientTo: "to-yellow-500/5",
    description: "سمعتك هي رأس مالك! تقييم عالي يعني ظهوراً أفضل وثقة أكبر من العملاء.",
    steps: [
      { icon: Star, text: "تقييم 1-5 نجوم بعد كل طلب — العميل يقيّمك بعد الاستلام" },
      { icon: Eye, text: "معدل التقييم يظهر في ملفك — العملاء يرونه قبل التعامل معك" },
      { icon: TrendingUp, text: "التقييم يؤثر على ترتيبك — أعلى تقييم = ظهور أول في القائمة" },
      { icon: Medal, text: "شارات للتجار المتميزين — ذهبية (4.8+) ، فضية (4.5+)، برونزية (4.0+)" },
      { icon: ShieldCheck, text: "شارة التحقق — توثيق هويتك يزيد ثقة العملاء بنسبة 80%" },
      { icon: Crown, text: "لقب \"تاجر مميز\" — يُمنح لأفضل التجار أداءً شهرياً" },
      { icon: ThumbsUp, text: "تقييمات مكتوبة — العملاء يكتبون تجربتهم ليراها الآخرون" },
    ],
    proTips: [
      "استجب بسرعة (أقل من ساعة) = تقييم أعلى",
      "التزم بوقت التسليم المتفق عليه دائماً",
      "صوّر المنتج النهائي وأرسله للعميل قبل التسليم",
      "اسأل العميل إن كان راضياً وشجّعه على التقييم",
    ],
    example: {
      title: "كيف تحصل على 5 نجوم",
      text: "سرعة استجابة (< ساعة) + التزام بالموعد + صور قبل التسليم + تغليف جميل = ⭐⭐⭐⭐⭐ مضمونة!",
      icon: Award,
    },
  },
  {
    icon: Truck,
    title: "إعدادات التوصيل",
    emoji: "🚚",
    sectionKey: "delivery",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    gradientFrom: "from-orange-500/20",
    gradientTo: "to-orange-500/5",
    description: "إعدادات مرنة للتوصيل. حدد أسعاراً مختلفة لكل محافظة وقدّم توصيلاً مجانياً لزيادة المبيعات.",
    steps: [
      { icon: MapPin, text: "سعر توصيل لكل محافظة — مثال: بغداد 5,000 | البصرة 10,000 | أربيل 8,000" },
      { icon: ToggleLeft, text: "إيقاف التوصيل لمحافظات معينة — لا تريد التوصيل لمنطقة بعيدة؟ أوقفها" },
      { icon: Gift, text: "توصيل مجاني عند مبلغ معين — مثال: مجاني للطلبات فوق 50,000 د.ع" },
      { icon: Zap, text: "شحن سريع وعادي — خيارات متعددة حسب حاجة العميل" },
      { icon: Clock, text: "وقت التوصيل المتوقع — مثال: 1-3 أيام لبغداد، 3-5 أيام للمحافظات" },
    ],
    proTips: [
      "توصيل مجاني للطلبات الكبيرة → العملاء يشترون أكثر!",
      "حدّد أسعاراً واقعية لتجنب الخسارة في التوصيل",
      "وضّح وقت التوصيل المتوقع لكل محافظة",
    ],
    example: {
      title: "استراتيجية ذكية",
      text: "فعّل التوصيل المجاني للطلبات فوق 40,000 → العملاء يضيفون منتجات إضافية للحصول على التوصيل المجاني → مبيعات أعلى! 📦🎁",
      icon: Lightbulb,
    },
  },
  {
    icon: Settings,
    title: "إعدادات المتجر المتقدمة",
    emoji: "⚙️",
    sectionKey: "settings",
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
    gradientFrom: "from-muted/30",
    gradientTo: "to-muted/10",
    description: "تحكم كامل في مظهر متجرك وتجربة العملاء. خصّص كل شيء ليناسب علامتك التجارية.",
    steps: [
      { icon: LayoutGrid, text: "تخطيط عرض المنتجات — شبكة 2×2 (مدمج)، قائمة (تفصيلي)، أو عرض كبير (بارز)" },
      { icon: Layers, text: "أنواع الأقسام — كلاسيكي (قائمة)، حديث (بطاقات)، مصغر (أيقونات) — كل نوع له شكل مختلف" },
      { icon: Tag, text: "إنشاء فئات مخصصة — مثال: \"عروض اليوم\"، \"وصل حديثاً\"، \"الأكثر مبيعاً\"" },
      { icon: MessageSquare, text: "رسائل تلقائية — ترحيب + استفسار + خارج أوقات العمل — كل رسالة قابلة للتخصيص" },
      { icon: Clock, text: "وضع الغياب — فعّله عند السفر أو الإجازة ليعرف العملاء" },
      { icon: Palette, text: "تخصيص مظهر المتجر — اختر الألوان والأيقونات المناسبة لعلامتك" },
      { icon: ToggleLeft, text: "تفعيل/إيقاف ميزات محددة — تحكم بما يظهر وما يختفي في متجرك" },
    ],
    proTips: [
      "جرّب أنواع الأقسام المختلفة واختر الأنسب لمنتجاتك",
      "التخطيط الشبكي مناسب للمنتجات الكثيرة، والقائمة للمنتجات القليلة",
      "أضف رسالة خارج أوقات العمل — العملاء يقدّرون الشفافية",
    ],
    example: {
      title: "رسالة خارج العمل مقترحة",
      text: "\"شكراً لتواصلك! 🌙 أنا حالياً خارج أوقات العمل. سأرد عليك في أقرب وقت عند عودتي. أوقات عملي: 9 صباحاً - 9 مساءً\"",
      icon: Clock,
    },
  },
];

const GETTING_STARTED = [
  { step: "1", text: "أكمل إعداد متجرك — الاسم، الشعار، الوصف، وروابط التواصل", icon: Store, emoji: "🏪" },
  { step: "2", text: "أضف أول 3 منتجات — بصور واضحة وأسعار وأوصاف تفصيلية", icon: ShoppingBag, emoji: "📸" },
  { step: "3", text: "فعّل الرسائل التلقائية — ترحيب + غياب + استفسار", icon: MessageCircle, emoji: "🤖" },
  { step: "4", text: "حدد أسعار التوصيل — لمحافظتك والمحافظات المجاورة", icon: Truck, emoji: "🚚" },
  { step: "5", text: "تصفح طلبات العملاء — وقدم أول عرض لك!", icon: FileText, emoji: "🎯" },
  { step: "6", text: "شارك متجرك — على حساباتك في وسائل التواصل", icon: Share2, emoji: "📢" },
];

const FAQ_ITEMS = [
  { q: "كم عمولة المنصة؟", a: "1.7% فقط من كل طلب مكتمل. مثال: طلب 100,000 د.ع → عمولة 1,700 د.ع فقط.", icon: BadgePercent },
  { q: "متى أحصل على أموالي؟", a: "فوراً بعد تأكيد العميل لاستلام الطلب، يُحوّل المبلغ مباشرة لمحفظتك.", icon: Wallet },
  { q: "ما الفرق بين خيارات الدفع؟", a: "دفع كامل (بدون رسوم)، نصف المبلغ (+5%)، ربع المبلغ (+10%)، عند الاستلام (عمولة إضافية).", icon: CreditCard },
  { q: "هل يمكنني إيقاف متجري مؤقتاً؟", a: "نعم! فعّل وضع الغياب من الإعدادات.", icon: ToggleLeft },
  { q: "ما هو نظام الديون؟", a: "عند \"الدفع عند الاستلام\" تُحسب عمولة إضافية. إن لم يكن رصيدك كافياً تُسجل كدين يُسدد تلقائياً.", icon: HandCoins },
  { q: "كيف أرفع تقييمي؟", a: "سرعة الاستجابة + الالتزام بالمواعيد + جودة المنتج + تغليف جيد = 5 نجوم!", icon: Star },
];

// Section screenshots gallery component
function SectionScreenshots({ sectionKey, images }: { sectionKey: string; images: GuideImage[] }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const sectionImages = images.filter(img => img.section_key === sectionKey && img.image_url);

  if (sectionImages.length === 0) return null;

  return (
    <>
      <div className="space-y-2">
        <p className="text-[10px] font-bold flex items-center gap-1.5 text-muted-foreground">
          <Camera className="h-3 w-3" />
          صور توضيحية من الموقع
        </p>
        <div className={`grid gap-2 ${sectionImages.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {sectionImages.map((img) => (
            <button
              key={img.id}
              onClick={() => setSelectedImage(img.image_url)}
              className="group relative rounded-lg overflow-hidden border border-border/50 hover:border-primary/30 transition-all"
            >
              <img
                src={img.image_url}
                alt={img.caption || "صورة توضيحية"}
                className="w-full h-auto object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                <ZoomIn className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
              </div>
              {img.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                  <p className="text-[9px] text-white leading-tight">{img.caption}</p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Full screen image viewer */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-1 bg-black/95 border-none">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="صورة مكبرة"
              className="w-full h-auto max-h-[90vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function MerchantGuide({ open, onClose, onDismissForever }: MerchantGuideProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  // Fetch guide images from DB
  const { data: guideImages } = useQuery({
    queryKey: ["merchant-guide-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_guide_images")
        .select("*")
        .neq("image_url", "")
        .order("display_order");
      if (error) throw error;
      return data as GuideImage[];
    },
    enabled: open,
    staleTime: 10 * 60 * 1000,
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="h-14 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-bold">دليل التاجر</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-56px-80px)]">
        <div className="container mx-auto px-4 max-w-2xl py-5 space-y-5">
          {/* Hero */}
          <div className="text-center space-y-3 py-2">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto border border-primary/10">
              <Rocket className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-black">مرحباً بك كتاجر في ليفو!</h1>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed max-w-sm mx-auto">
                دليل شامل يشرح جميع المميزات مع أمثلة عملية وصور توضيحية لمساعدتك على النجاح.
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { icon: Package, label: "إدارة الطلبات", color: "text-emerald-500", bg: "bg-emerald-500/10" },
              { icon: ShoppingBag, label: "المنتجات", color: "text-amber-500", bg: "bg-amber-500/10" },
              { icon: DollarSign, label: "الإيرادات", color: "text-green-500", bg: "bg-green-500/10" },
              { icon: Star, label: "التقييمات", color: "text-yellow-500", bg: "bg-yellow-500/10" },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center gap-1 p-2.5 rounded-xl bg-card border border-border/50">
                <div className={`h-8 w-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                </div>
                <p className="text-[9px] font-bold text-center leading-tight">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Sections */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
              <Layers className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold">المميزات والشروحات</h2>
              <Badge variant="secondary" className="text-[9px] h-5">{GUIDE_SECTIONS.length} أقسام</Badge>
            </div>

            {GUIDE_SECTIONS.map((section, idx) => {
              const Icon = section.icon;
              const isExpanded = expandedIndex === idx;
              return (
                <Card
                  key={idx}
                  className={`overflow-hidden transition-all duration-200 ${isExpanded ? `border ${section.borderColor} shadow-sm` : "border border-border/40"}`}
                >
                  <button
                    onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                    className="w-full p-3.5 flex items-center gap-3 text-right"
                  >
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${section.gradientFrom} ${section.gradientTo} flex items-center justify-center shrink-0 border ${section.borderColor}`}>
                      <Icon className={`h-5 w-5 ${section.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold">{section.title}</p>
                        <span className="text-sm">{section.emoji}</span>
                      </div>
                      {!isExpanded && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{section.description}</p>
                      )}
                    </div>
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${isExpanded ? section.bgColor : "bg-muted/50"}`}>
                      {isExpanded ? (
                        <ChevronUp className={`h-3.5 w-3.5 ${section.color}`} />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </button>

                  {isExpanded && (
                    <CardContent className="px-3.5 pb-4 pt-0 space-y-3">
                      <p className="text-[11px] text-muted-foreground leading-relaxed border-r-2 border-primary/20 pr-2">{section.description}</p>
                      
                      {/* Screenshots from DB */}
                      {guideImages && (
                        <SectionScreenshots sectionKey={section.sectionKey} images={guideImages} />
                      )}

                      {/* Steps */}
                      <div className="space-y-1.5">
                        {section.steps.map((step, sIdx) => {
                          const StepIcon = step.icon;
                          return (
                            <div key={sIdx} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                              <div className={`h-7 w-7 rounded-lg ${section.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                                <StepIcon className={`h-3.5 w-3.5 ${section.color}`} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] leading-relaxed">{step.text}</p>
                                {step.tip && (
                                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                    <Lightbulb className="h-2.5 w-2.5 text-yellow-500 shrink-0" />
                                    {step.tip}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pro Tips */}
                      {section.proTips.length > 0 && (
                        <div className="rounded-lg bg-muted/30 border border-border/50 p-2.5 space-y-1.5">
                          <p className="text-[10px] font-bold flex items-center gap-1.5">
                            <Lightbulb className="h-3 w-3 text-yellow-500" />
                            نصائح احترافية
                          </p>
                          {section.proTips.map((tip, tIdx) => (
                            <p key={tIdx} className="text-[10px] text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                              <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0 mt-0.5" />
                              {tip}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Example */}
                      {section.example && (
                        <div className={`rounded-lg bg-gradient-to-br ${section.gradientFrom} ${section.gradientTo} border ${section.borderColor} p-3 space-y-1.5`}>
                          <p className="text-[11px] font-bold flex items-center gap-1.5">
                            <section.example.icon className={`h-3.5 w-3.5 ${section.color}`} />
                            {section.example.title}
                          </p>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{section.example.text}</p>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Getting Started */}
          <Card className="border-emerald-500/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Rocket className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-sm font-bold">خطوات البداية السريعة</p>
              </div>
              <div className="space-y-1.5">
                {GETTING_STARTED.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={item.step} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="h-7 w-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <ItemIcon className="h-3.5 w-3.5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] leading-relaxed">
                          <span className="font-bold text-emerald-600 ml-1">{item.step}.</span>
                          {item.text}
                        </p>
                      </div>
                      <span className="text-sm shrink-0">{item.emoji}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Success Tips */}
          <Card className="border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Award className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm font-bold">مفاتيح النجاح</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Camera, text: "صور واضحة بإضاءة طبيعية", color: "text-amber-500", bg: "bg-amber-500/10" },
                  { icon: Clock, text: "استجابة سريعة (< ساعة)", color: "text-blue-500", bg: "bg-blue-500/10" },
                  { icon: Star, text: "خدمة ممتازة = تقييم عالي", color: "text-yellow-500", bg: "bg-yellow-500/10" },
                  { icon: Tag, text: "عروض وخصومات منتظمة", color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { icon: MapPin, text: "توصيل سريع وأسعار واضحة", color: "text-orange-500", bg: "bg-orange-500/10" },
                  { icon: MessageCircle, text: "تواصل مستمر مع العميل", color: "text-violet-500", bg: "bg-violet-500/10" },
                ].map((tip, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/50">
                    <div className={`h-7 w-7 rounded-lg ${tip.bg} flex items-center justify-center shrink-0`}>
                      <tip.icon className={`h-3.5 w-3.5 ${tip.color}`} />
                    </div>
                    <p className="text-[10px] leading-tight font-medium">{tip.text}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
          <Card className="border-violet-500/20">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <HelpCircle className="h-4 w-4 text-violet-500" />
                </div>
                <p className="text-sm font-bold">أسئلة شائعة</p>
                <Badge variant="secondary" className="text-[9px] h-5">{FAQ_ITEMS.length}</Badge>
              </div>
              <div className="space-y-2">
                {FAQ_ITEMS.map((faq, i) => {
                  const FaqIcon = faq.icon;
                  return (
                    <div key={i} className="p-2.5 rounded-lg bg-muted/20 border border-border/30 space-y-1">
                      <p className="text-[11px] font-bold flex items-center gap-1.5">
                        <FaqIcon className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                        {faq.q}
                      </p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed pr-5">{faq.a}</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Contact Support */}
          <Card className="border-border/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold">تحتاج مساعدة إضافية؟</p>
                <p className="text-[10px] text-muted-foreground">تواصل مع فريق الدعم عبر المحادثات وسنساعدك في أي وقت.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-3 z-10">
        <div className="container mx-auto max-w-2xl flex gap-2">
          <Button className="flex-1 h-10 text-sm" onClick={onClose}>
            فهمت، أغلق الدليل ✅
          </Button>
          <Button
            variant="outline"
            className="h-10 text-[10px] text-muted-foreground px-3"
            onClick={onDismissForever}
          >
            لا تعرض مجدداً
          </Button>
        </div>
      </div>
    </div>
  );
}
