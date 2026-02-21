import { useState } from "react";
import { 
  X, Store, Package, FileText, MessageCircle, Star, Settings, 
  Eye, DollarSign, ShoppingBag, Truck, Image, Users, Shield,
  ChevronDown, ChevronUp, Sparkles, BookOpen, ArrowLeft
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
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/20",
    description: "لديك متجر مخصص يظهر للعملاء في المجتمع. يمكنك تخصيص اسم المتجر، الشعار، الوصف، وروابط التواصل الاجتماعي.",
    details: [
      "تخصيص اسم المتجر والشعار",
      "إضافة وصف تعريفي لمتجرك",
      "ربط حسابات التواصل الاجتماعي (فيسبوك، انستغرام)",
      "اختيار إطار مميز لصورة المتجر",
      "المتجر يظهر في قائمة التجار بالمجتمع",
    ],
  },
  {
    icon: ShoppingBag,
    title: "إدارة المنتجات",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/20",
    description: "أضف منتجاتك مع الصور والأسعار والتفاصيل. يمكن للعملاء تصفح منتجاتك وإضافتها للسلة والتواصل معك.",
    details: [
      "إضافة منتجات مع صور متعددة",
      "تحديد الأسعار والخصومات",
      "تصنيف المنتجات حسب الفئات",
      "تفعيل/إيقاف المنتجات",
      "عرض المنتجات في متجرك وفي صفحة المجتمع",
    ],
  },
  {
    icon: FileText,
    title: "طلبات العملاء",
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
    description: "يمكن للعملاء نشر طلبات مخصصة (مثل طباعة تصميم معين). تصفح الطلبات وقدم عروضك عليها.",
    details: [
      "تصفح طلبات العملاء الجديدة",
      "تقديم عرض سعر على الطلب",
      "التنافس مع تجار آخرين",
      "عند قبول عرضك يتم فتح محادثة مباشرة",
      "متابعة حالة الطلب حتى التسليم",
    ],
  },
  {
    icon: Package,
    title: "إدارة الطلبات",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    description: "تابع جميع طلباتك المقبولة والمكتملة. غيّر حالة الطلب وتواصل مع العميل.",
    details: [
      "عرض الطلبات قيد التنفيذ",
      "تحديث حالة الطلب (قيد التنفيذ → تم التسليم)",
      "إنشاء طلبات مباشرة من المحادثة",
      "متابعة المدفوعات والعمولات",
      "أرشيف الطلبات المكتملة",
    ],
  },
  {
    icon: MessageCircle,
    title: "المحادثات",
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    description: "تواصل مباشرة مع عملائك عبر نظام المحادثات. أرسل صور، ملفات، وأنشئ طلبات من داخل المحادثة.",
    details: [
      "محادثات فورية مع العملاء",
      "إرسال صور وملفات",
      "إنشاء طلبات مباشرة من المحادثة",
      "إشعارات الرسائل غير المقروءة",
      "أرشيف المحادثات السابقة",
    ],
  },
  {
    icon: DollarSign,
    title: "الإيرادات والمحفظة",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
    description: "تابع إيراداتك ومبيعاتك. العمولة الحالية للمنصة هي نسبة بسيطة من كل طلب مكتمل.",
    details: [
      "متابعة إجمالي الإيرادات",
      "عرض تفاصيل كل معاملة",
      "عمولة المنصة تُخصم تلقائياً",
      "خيارات دفع متعددة للعملاء",
      "تقارير مالية مفصلة",
    ],
  },
  {
    icon: Star,
    title: "التقييمات والسمعة",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
    description: "يقيّمك العملاء بعد كل طلب مكتمل. تقييم عالي يعني ظهور أفضل وثقة أكبر من العملاء.",
    details: [
      "تقييم من 1-5 نجوم",
      "معدل التقييم يظهر في ملفك",
      "التقييم يؤثر على ترتيبك في نتائج البحث",
      "شارات مميزة للتجار المتميزين",
      "التحقق من الهوية يزيد الموثوقية",
    ],
  },
  {
    icon: Truck,
    title: "إعدادات التوصيل",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/20",
    description: "حدد أسعار التوصيل لكل محافظة. أضف استثناءات وخصومات تلقائية على التوصيل.",
    details: [
      "تحديد سعر توصيل لكل محافظة",
      "استثناءات لمحافظات معينة",
      "توصيل مجاني عند مبلغ معين",
      "أسعار توصيل مرنة حسب المنطقة",
      "إعدادات متقدمة للشحن",
    ],
  },
  {
    icon: Settings,
    title: "إعدادات المتجر",
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
    borderColor: "border-border",
    description: "تحكم في تخطيط متجرك، نوع عرض الأقسام، والإعدادات العامة.",
    details: [
      "اختيار تخطيط عرض المنتجات",
      "تغيير نوع الأقسام (كلاسيكي، حديث...)",
      "إدارة الفئات والأقسام",
      "إعدادات الخصوصية والظهور",
      "تخصيص صفحة المتجر",
    ],
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
              <span className="text-sm font-bold">دليل التاجر</span>
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
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-black">مرحباً بك كتاجر في ليفو!</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto">
            هذا الدليل يشرح لك جميع مميزات لوحة التاجر وكيفية الاستفادة القصوى من متجرك.
          </p>
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
                    <Icon className={`h-5 w-5 ${section.color}`} />
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
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {/* Tips */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold">نصائح للنجاح</p>
            </div>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li>• أضف صور واضحة وجذابة لمنتجاتك</li>
              <li>• استجب بسرعة لرسائل العملاء</li>
              <li>• حافظ على تقييم عالي من خلال خدمة ممتازة</li>
              <li>• استخدم العروض والخصومات لجذب المزيد من العملاء</li>
              <li>• حدّث إعدادات التوصيل بانتظام</li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border/40 p-4 z-10">
        <div className="container mx-auto max-w-2xl flex flex-col gap-2">
          <Button className="w-full h-11" onClick={onClose}>
            فهمت، أغلق الدليل
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
