import { useState } from "react";
import { 
  X, Store, Package, FileText, MessageCircle, Star, Settings, 
  DollarSign, ShoppingBag, Truck, Shield,
  ChevronDown, ChevronUp, Sparkles, BookOpen, ArrowLeft,
  Camera, Tag, MapPin, Clock, CheckCircle2, AlertTriangle,
  Palette, BarChart3, Heart, Zap, Gift, Users, Bell
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface MerchantGuideProps {
  open: boolean;
  onClose: () => void;
  onDismissForever: () => void;
}

const GUIDE_SECTIONS = [
  {
    icon: Store,
    title: "متجرك الخاص",
    emoji: "🏪",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    description: "لديك متجر مخصص يظهر للعملاء في المجتمع. يمكنك تخصيص اسم المتجر، الشعار، الوصف، وروابط التواصل الاجتماعي.",
    details: [
      "تخصيص اسم المتجر والشعار — اختر اسماً مميزاً وقصيراً (مثال: \"مطبعة النور\")",
      "إضافة وصف تعريفي لمتجرك — اشرح تخصصك بوضوح (مثال: \"متخصصون في طباعة ثلاثية الأبعاد وتصميم المجسمات\")",
      "ربط حسابات التواصل الاجتماعي (فيسبوك، انستغرام) — ليتمكن العملاء من متابعتك",
      "اختيار إطار مميز لصورة المتجر — الإطارات المميزة تجذب انتباه العملاء أكثر",
      "المتجر يظهر في قائمة التجار بالمجتمع — كلما كان متجرك مكتملاً ظهر في مراتب أعلى",
    ],
    example: {
      title: "💡 مثال عملي",
      text: "تاجر أضاف شعاراً احترافياً ووصفاً واضحاً → زادت زيارات متجره بنسبة 40% خلال أسبوع!",
    },
  },
  {
    icon: ShoppingBag,
    title: "إدارة المنتجات",
    emoji: "🛍️",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    description: "أضف منتجاتك مع الصور والأسعار والتفاصيل. يمكن للعملاء تصفح منتجاتك وإضافتها للسلة والتواصل معك.",
    details: [
      "إضافة منتجات مع صور متعددة 📸 — أضف حتى 5 صور لكل منتج من زوايا مختلفة",
      "تحديد الأسعار والخصومات 💰 — يمكنك وضع سعر أصلي وسعر مخفض (مثال: 25,000 بدلاً من 30,000)",
      "تصنيف المنتجات حسب الفئات 🏷️ — نظّم منتجاتك في أقسام (مثال: مجسمات، إكسسوارات، هدايا)",
      "تفعيل/إيقاف المنتجات ⚡ — أوقف المنتج مؤقتاً دون حذفه عند نفاد المخزون",
      "خيارات المنتج المتعددة — أضف ألوان وأحجام مختلفة لنفس المنتج",
    ],
    example: {
      title: "💡 نصيحة ذهبية",
      text: "الصور الواضحة بإضاءة جيدة تزيد المبيعات بنسبة 60%. صوّر المنتج على خلفية بيضاء أو خلفية بسيطة.",
    },
  },
  {
    icon: FileText,
    title: "طلبات العملاء المخصصة",
    emoji: "📋",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description: "يمكن للعملاء نشر طلبات مخصصة (مثل طباعة تصميم معين). تصفح الطلبات وقدم عروضك عليها للفوز بالعمل.",
    details: [
      "تصفح طلبات العملاء الجديدة 🔍 — شاهد الطلبات المتاحة في منطقتك وتخصصك",
      "تقديم عرض سعر على الطلب 💵 — حدد السعر ووقت التسليم المتوقع ووصف العرض",
      "التنافس مع تجار آخرين 🏆 — العميل يختار أفضل عرض من بين العروض المقدمة",
      "عند قبول عرضك يتم فتح محادثة مباشرة 💬 — تواصل مع العميل لتوضيح التفاصيل",
      "متابعة حالة الطلب حتى التسليم ✅ — من \"قيد التنفيذ\" إلى \"تم التسليم\"",
    ],
    example: {
      title: "💡 مثال",
      text: "عميل طلب طباعة مجسم شخصية أنمي → قدمت عرض 15,000 د.ع مع تسليم خلال 3 أيام → تم قبول عرضك! 🎉",
    },
  },
  {
    icon: Package,
    title: "إدارة الطلبات",
    emoji: "📦",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description: "تابع جميع طلباتك المقبولة والمكتملة. غيّر حالة الطلب وتواصل مع العميل مباشرة.",
    details: [
      "عرض الطلبات قيد التنفيذ 🔄 — جميع الطلبات النشطة في مكان واحد",
      "تحديث حالة الطلب 📊 — (جديد → قيد التنفيذ → جاهز → تم التسليم)",
      "إنشاء طلبات مباشرة من المحادثة 💬 — اتفقت مع عميل؟ أنشئ طلباً رسمياً فوراً",
      "متابعة المدفوعات والعمولات 💳 — شاهد تفاصيل كل معاملة مالية",
      "أرشيف الطلبات المكتملة 📁 — سجل كامل لجميع طلباتك السابقة",
    ],
    example: {
      title: "💡 كيف يعمل",
      text: "عميل طلب منتج → تحدث حالة الطلب إلى \"قيد التنفيذ\" → عند الانتهاء غيّرها إلى \"تم التسليم\" → يتم تحويل المبلغ لمحفظتك تلقائياً",
    },
  },
  {
    icon: MessageCircle,
    title: "المحادثات",
    emoji: "💬",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    description: "تواصل مباشرة مع عملائك عبر نظام المحادثات المدمج. أرسل صور وملفات وأنشئ طلبات من داخل المحادثة.",
    details: [
      "محادثات فورية مع العملاء ⚡ — ردود سريعة تزيد ثقة العملاء",
      "إرسال صور وملفات 📎 — شارك تصاميم أو عينات مع العميل",
      "إنشاء طلبات مباشرة من المحادثة 🛒 — حدد المنتج والسعر والكمية",
      "إشعارات الرسائل غير المقروءة 🔔 — لا تفوّت أي رسالة من عملائك",
      "رسائل ترحيب تلقائية 🤖 — إعداد رسالة ترحيب تُرسل تلقائياً للعملاء الجدد",
    ],
    example: {
      title: "💡 نصيحة",
      text: "فعّل الرسائل التلقائية من إعدادات المتجر! رسالة ترحيب مثل \"أهلاً بك! كيف أقدر أساعدك؟\" تعطي انطباعاً احترافياً",
    },
  },
  {
    icon: DollarSign,
    title: "الإيرادات والمحفظة",
    emoji: "💰",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    description: "تابع إيراداتك ومبيعاتك وعمولة المنصة. المحفظة الإلكترونية تسهّل عملية الدفع والاستلام.",
    details: [
      "متابعة إجمالي الإيرادات 📈 — لوحة تحكم بالأرقام والإحصائيات",
      "عرض تفاصيل كل معاملة 🧾 — سجل شامل لكل عملية بيع",
      "عمولة المنصة تُخصم تلقائياً ✂️ — نسبة بسيطة من كل طلب مكتمل",
      "خيارات دفع متعددة للعملاء 💳 — دفع كامل، نصف المبلغ، ربع المبلغ، أو عند الاستلام",
      "تقارير مالية مفصلة 📊 — تابع أداءك المالي يومياً وأسبوعياً وشهرياً",
    ],
    example: {
      title: "💡 مثال على العمولة",
      text: "طلب بقيمة 50,000 د.ع → عمولة المنصة 1.7% = 850 د.ع → تحصل على 49,150 د.ع في محفظتك",
    },
  },
  {
    icon: Star,
    title: "التقييمات والسمعة",
    emoji: "⭐",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    description: "يقيّمك العملاء بعد كل طلب مكتمل. تقييم عالي يعني ظهور أفضل في نتائج البحث وثقة أكبر من العملاء الجدد.",
    details: [
      "تقييم من 1-5 نجوم ⭐ — بعد كل طلب مكتمل يُطلب من العميل تقييمك",
      "معدل التقييم يظهر في ملفك 📊 — العملاء يرون تقييمك قبل التعامل معك",
      "التقييم يؤثر على ترتيبك 🔝 — تقييم أعلى = ظهور أفضل في القائمة",
      "شارات مميزة للتجار المتميزين 🏅 — شارة ذهبية، فضية، أو برونزية حسب أدائك",
      "التحقق من الهوية ✅ — شارة التحقق تزيد ثقة العملاء بشكل كبير",
    ],
    example: {
      title: "💡 كيف ترفع تقييمك",
      text: "استجب بسرعة (أقل من ساعة) + التزم بوقت التسليم + صور المنتج النهائي قبل الإرسال = تقييم 5 نجوم! ⭐⭐⭐⭐⭐",
    },
  },
  {
    icon: Truck,
    title: "إعدادات التوصيل",
    emoji: "🚚",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    description: "حدد أسعار التوصيل لكل محافظة. أسعار مرنة تناسب موقعك الجغرافي ونوع منتجاتك.",
    details: [
      "تحديد سعر توصيل لكل محافظة 🗺️ — مثال: بغداد 5,000 | البصرة 10,000 | أربيل 8,000",
      "استثناءات لمحافظات معينة ⛔ — أوقف التوصيل لمحافظات بعيدة إن أردت",
      "توصيل مجاني عند مبلغ معين 🎁 — مثال: توصيل مجاني للطلبات فوق 50,000 د.ع",
      "أسعار توصيل مرنة حسب المنطقة 📍 — حدد أسعاراً مختلفة حسب المسافة",
      "إعدادات متقدمة للشحن ⚙️ — خيارات الشحن السريع والعادي",
    ],
    example: {
      title: "💡 نصيحة للتوصيل",
      text: "حدد توصيل مجاني للطلبات الكبيرة → العملاء يشترون أكثر للحصول على التوصيل المجاني!",
    },
  },
  {
    icon: Settings,
    title: "إعدادات المتجر",
    emoji: "⚙️",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    description: "تحكم في مظهر متجرك، تخطيط المنتجات، نوع الأقسام، والرسائل التلقائية.",
    details: [
      "اختيار تخطيط عرض المنتجات 🎨 — شبكة 2×2، قائمة، أو عرض كبير",
      "تغيير نوع الأقسام 📂 — (كلاسيكي، حديث، بطاقات) اختر الأنسب لمنتجاتك",
      "إدارة الفئات والأقسام 🏷️ — أنشئ أقساماً مخصصة (مثال: عروض، جديد، الأكثر مبيعاً)",
      "الرسائل التلقائية 🤖 — رسالة ترحيب + رسالة استفسار + رسالة خارج أوقات العمل",
      "وضع الغياب 🌙 — فعّله عند عدم تواجدك ليعرف العملاء أنك غير متاح حالياً",
    ],
    example: {
      title: "💡 مثال على رسالة تلقائية",
      text: "رسالة ترحيب: \"أهلاً بك في متجري! 👋 تصفح المنتجات واختر ما يعجبك، وأنا جاهز لأي استفسار\"",
    },
  },
];

export default function MerchantGuide({ open, onClose, onDismissForever }: MerchantGuideProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="container mx-auto px-4 max-w-2xl">
          <div className="h-14 flex items-center justify-between">
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">دليل التاجر الشامل</span>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-2xl py-6 pb-32 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto border border-primary/20">
            <span className="text-4xl">🚀</span>
          </div>
          <h1 className="text-2xl font-black">مرحباً بك كتاجر في ليفو!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            هذا الدليل الشامل يشرح لك جميع مميزات لوحة التاجر خطوة بخطوة مع أمثلة عملية لمساعدتك على النجاح.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-3 text-center">
              <span className="text-2xl">📦</span>
              <p className="text-[10px] font-bold mt-1">إدارة المنتجات</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20 bg-amber-500/5">
            <CardContent className="p-3 text-center">
              <span className="text-2xl">💰</span>
              <p className="text-[10px] font-bold mt-1">تتبع الإيرادات</p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="p-3 text-center">
              <span className="text-2xl">⭐</span>
              <p className="text-[10px] font-bold mt-1">بناء السمعة</p>
            </CardContent>
          </Card>
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {GUIDE_SECTIONS.map((section, idx) => {
            const Icon = section.icon;
            const isExpanded = expandedIndex === idx;
            return (
              <Card
                key={idx}
                className={`overflow-hidden transition-all border ${isExpanded ? section.borderColor : "border-border/40"}`}
              >
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="w-full p-4 flex items-center gap-3 text-right"
                >
                  <div className={`h-10 w-10 rounded-xl ${section.bgColor} flex items-center justify-center shrink-0`}>
                    <span className="text-lg">{section.emoji}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">{section.title}</p>
                    {!isExpanded && (
                      <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <CardContent className="px-4 pb-4 pt-0 space-y-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">{section.description}</p>
                    
                    <div className="space-y-2">
                      {section.details.map((detail, dIdx) => (
                        <div key={dIdx} className="flex items-start gap-2">
                          <div className={`h-5 w-5 rounded-full ${section.bgColor} flex items-center justify-center shrink-0 mt-0.5`}>
                            <span className={`text-[10px] font-bold ${section.color}`}>{dIdx + 1}</span>
                          </div>
                          <p className="text-xs leading-relaxed">{detail}</p>
                        </div>
                      ))}
                    </div>

                    {/* Example Box */}
                    {section.example && (
                      <div className={`rounded-lg ${section.bgColor} border ${section.borderColor} p-3 space-y-1`}>
                        <p className="text-xs font-bold">{section.example.title}</p>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{section.example.text}</p>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Getting Started Steps */}
        <Card className="border-emerald-500/20 bg-emerald-500/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-emerald-500" />
              <p className="text-sm font-bold">خطوات البداية السريعة</p>
            </div>
            <div className="space-y-2">
              {[
                { step: "1", text: "أكمل إعداد متجرك (الاسم، الشعار، الوصف)", emoji: "🏪" },
                { step: "2", text: "أضف أول 3 منتجات مع صور واضحة وأسعار", emoji: "📸" },
                { step: "3", text: "فعّل الرسائل التلقائية للترحيب بالعملاء", emoji: "🤖" },
                { step: "4", text: "حدد أسعار التوصيل لمحافظتك والمحافظات المجاورة", emoji: "🚚" },
                { step: "5", text: "تصفح طلبات العملاء وقدم أول عرض لك!", emoji: "🎯" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-bold text-emerald-600">{item.step}</span>
                  </div>
                  <span className="text-xs">{item.emoji} {item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold">🌟 نصائح للنجاح</p>
            </div>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Camera className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>أضف صور واضحة وجذابة لمنتجاتك — الإضاءة الطبيعية هي الأفضل</span>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>استجب بسرعة لرسائل العملاء — أقل من ساعة = انطباع ممتاز</span>
              </li>
              <li className="flex items-start gap-2">
                <Star className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>حافظ على تقييم عالي من خلال خدمة ممتازة والتزام بالمواعيد</span>
              </li>
              <li className="flex items-start gap-2">
                <Tag className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>استخدم العروض والخصومات لجذب المزيد من العملاء</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                <span>حدّث إعدادات التوصيل بانتظام لتغطية أكبر عدد من المحافظات</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card className="border-violet-500/20 bg-violet-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-violet-500" />
              <p className="text-sm font-bold">❓ أسئلة شائعة</p>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <p className="font-bold">كم عمولة المنصة؟</p>
                <p className="text-muted-foreground">1.7% فقط من كل طلب مكتمل. مثال: طلب 100,000 د.ع → عمولة 1,700 د.ع فقط</p>
              </div>
              <div>
                <p className="font-bold">متى أحصل على أموالي؟</p>
                <p className="text-muted-foreground">فوراً بعد تأكيد العميل لاستلام الطلب، يُحوّل المبلغ لمحفظتك</p>
              </div>
              <div>
                <p className="font-bold">هل يمكنني إيقاف متجري مؤقتاً؟</p>
                <p className="text-muted-foreground">نعم! فعّل وضع الغياب من الإعدادات وسيظهر للعملاء أنك غير متاح</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/40 p-4 z-10">
        <div className="container mx-auto max-w-2xl flex flex-col gap-2">
          <Button className="w-full h-11" onClick={onClose}>
            فهمت، أغلق الدليل ✅
          </Button>
          <Button
            variant="ghost"
            className="w-full h-9 text-xs text-muted-foreground"
            onClick={onDismissForever}
          >
            أنا على دراية بكل ذلك — لا تعرض هذا مجدداً
          </Button>
        </div>
      </div>
    </div>
  );
}
