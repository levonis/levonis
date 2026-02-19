import { useState, useMemo } from "react";
import { Bot, X, ChevronRight, ArrowRight, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface FAQ {
  question: string;
  answer: string;
  merchantOnly?: boolean;
  customerOnly?: boolean;
}

const FAQS: FAQ[] = [
  // عام
  { question: "كيف يمكنني شحن محفظتي؟", answer: "يمكنك شحن محفظتك من خلال صفحة المحفظة عبر الذهاب إلى ملفك الشخصي ← المحفظة ← شحن. يمكنك الشحن عبر طرق الدفع المتاحة." },
  { question: "كيف يمكنني التواصل مع الدعم؟", answer: "يمكنك التواصل مع فريق الدعم عبر زر المحادثة الموجود في أسفل الشاشة (أيقونة الدردشة). سيتم ربطك مباشرة بفريق الدعم." },
  { question: "كيف يمكنني وضع طلبي؟", answer: "تصفح المنتجات واختر المنتج المناسب، حدد الخيارات (اللون، الحجم)، ثم أضفه للسلة. اذهب للسلة وأكمل عملية الشراء." },
  { question: "كيف يمكنني تتبع طلبي؟", answer: "اذهب إلى 'طلباتي' من القائمة الرئيسية أو ملفك الشخصي. ستجد جميع طلباتك مع حالة كل طلب محدّثة في الوقت الفعلي." },

  // النقاط
  { question: "ماذا تعني النقاط وما فائدتها؟", answer: "النقاط هي نظام مكافآت يمنحك نقاط عند الشراء وإتمام المهام اليومية. يمكنك استبدال النقاط بمنتجات أو خصومات أو تذاكر مسابقات." },
  { question: "كيف أحصل على النقاط؟", answer: "تحصل على النقاط عبر: الشراء من المتجر، إتمام المهام اليومية (تسجيل الدخول، مشاركة المنتجات، التقييم)، والمشاركة في الفعاليات." },
  { question: "كيف أستبدل النقاط؟", answer: "اذهب إلى مركز المكافآت ← متجر النقاط. اختر المنتج أو المكافأة التي تريدها واستبدلها بنقاطك المتاحة." },

  // التذاكر
  { question: "ماذا تعني التذاكر وما فائدتها؟", answer: "التذاكر هي عملة خاصة تستخدم للمشاركة في المسابقات والسحوبات. كل تذكرة تمنحك فرصة للفوز بجوائز قيّمة." },
  { question: "كيف أحصل على التذاكر؟", answer: "يمكنك الحصول على التذاكر عبر: شراءها من متجر النقاط، كمكافأة على المهام اليومية، أو كهدية مع بعض المشتريات." },
  { question: "كيف أستبدل التذاكر؟", answer: "اذهب إلى مركز المكافآت ← المسابقات، اختر المسابقة التي تريد المشاركة فيها وادخل عدد التذاكر." },

  // المسابقات
  { question: "ما هي المسابقات؟", answer: "المسابقات هي سحوبات وفعاليات تنافسية يمكنك المشاركة فيها باستخدام التذاكر للفوز بجوائز مثل منتجات مجانية وخصومات وأرصدة." },
  { question: "كيف يمكنني المشاركة بالمسابقات؟", answer: "اذهب إلى مركز المكافآت ← المسابقات، اختر المسابقة النشطة، وأدخل التذاكر للمشاركة. كلما زادت تذاكرك، زادت فرصتك بالفوز!" },
  { question: "كيف يمكنني الفوز بالمسابقة؟", answer: "الفوز يعتمد على نوع المسابقة: سحب عشوائي، أو أول فائز، أو جمع أحرف. تأكد من المشاركة بأكبر عدد ممكن من التذاكر لزيادة فرصك." },

  // التأمين والعضوية
  { question: "كيف يمكنني تأمين وحماية طابعتي؟", answer: "اذهب إلى مركز المكافآت ← التأمين. يمكنك شراء خطة حماية لطابعتك تغطي الأعطال والصيانة لفترة محددة." },
  { question: "ما هي عضوية ليفو الخاصة؟", answer: "عضوية ليفو هي بطاقة ولاء توفر لك مزايا حصرية مثل خصومات إضافية، أولوية في الدعم، وعروض خاصة للأعضاء فقط." },
  { question: "ما فائدة العضوية؟", answer: "العضوية تمنحك: خصومات حصرية على المنتجات، نقاط مضاعفة على المشتريات، أولوية في خدمة العملاء، وعروض خاصة لا تتوفر للجميع." },
  { question: "كيف يمكنني شراء عضوية؟", answer: "اذهب إلى مركز المكافآت ← البطاقات ← بطاقة العضوية. اختر مستوى العضوية المناسب وأتمم عملية الشراء." },
  { question: "ماذا يعني خصم خاص للأعضاء؟", answer: "هو خصم إضافي يُطبق تلقائياً على مشترياتك كونك عضواً في ليفو. يختلف نسبة الخصم حسب مستوى عضويتك (فضي، ذهبي، ماسي، زمردي)." },

  // العروض والمجتمع
  { question: "لماذا هناك عروض خاصة منفصلة عن الموقع؟", answer: "العروض الخاصة هي صفقات محدودة بكميات وأوقات معينة تقدم أسعاراً استثنائية. يتم عرضها في قسم منفصل لتسهيل الوصول إليها قبل نفادها." },

  // مجتمع ليفو - عام
  { question: "ما هو مجتمع ليفو وما الفائدة منه؟", answer: "مجتمع ليفو هو منصة تجمع بين العملاء والتجار. يمكنك طلب خدمات طباعة مخصصة، والحصول على عروض أسعار من تجار متعددين، واختيار الأنسب لك." },

  // أسئلة العميل فقط
  { question: "كيف يمكنني وضع طلب طباعة في المجتمع؟", answer: "اذهب إلى مجتمع ليفو ← 'طلب جديد'. أدخل تفاصيل التصميم (العنوان، الوصف، الألوان، الحجم، الكمية) وأرفق الصور. سيتلقى التجار طلبك ويقدمون عروضهم.", customerOnly: true },
  { question: "لماذا هناك أكثر من تاجر يعطوني سعراً مختلفاً؟", answer: "كل تاجر لديه تكاليف ومعدات مختلفة، لذلك تختلف الأسعار. هذا يمنحك حرية المقارنة واختيار العرض الأنسب من حيث السعر والجودة ومدة التسليم.", customerOnly: true },
  { question: "كيف يمكنني التواصل مع التاجر؟", answer: "بعد قبول عرض تاجر، يمكنك التواصل معه مباشرة عبر المحادثات في مجتمع ليفو. اضغط على زر 'المحادثات' من القائمة السريعة.", customerOnly: true },
  { question: "ماذا إن حدثت مشكلة مع تاجر معين؟", answer: "يمكنك تقديم شكوى من خلال صفحة تفاصيل الطلب ← 'تقديم شكوى'. فريق ليفو سيراجع الشكوى ويتدخل لحل المشكلة وحماية حقوقك.", customerOnly: true },

  // أزرار العميل
  { question: "ماذا يعمل زر 'المحادثات'؟", answer: "يفتح قائمة محادثاتك مع التجار أو الدعم. يمكنك متابعة جميع المحادثات النشطة والرد عليها.", customerOnly: true },
  { question: "ماذا يعمل زر 'طلب جديد'؟", answer: "يفتح نموذج إنشاء طلب طباعة جديد في مجتمع ليفو، حيث تحدد تفاصيل ما تريد طباعته.", customerOnly: true },
  { question: "ماذا يعمل زر 'طلباتي'؟", answer: "يعرض جميع طلباتك في مجتمع ليفو مع حالة كل طلب (جديد، مُسعّر، مقبول، منتهي).", customerOnly: true },
  { question: "ماذا يعمل زر 'ملفي'؟", answer: "ينقلك إلى صفحة ملفك الشخصي حيث يمكنك تعديل بياناتك وصورتك والاطلاع على إحصائياتك.", customerOnly: true },

  // أسئلة التاجر فقط
  { question: "كيف يمكنني إدارة متجري؟", answer: "اذهب إلى مجتمع ليفو ← 'إدارة المتجر'. يمكنك إضافة وتعديل المنتجات، تنظيمها بالفئات، وإدارة المخزون والأسعار.", merchantOnly: true },
  { question: "ماذا يعمل زر 'إدارة المتجر'؟", answer: "ينقلك إلى لوحة إدارة متجرك حيث يمكنك إضافة منتجات، تعديل الأسعار، إدارة الفئات، وتخصيص مظهر متجرك.", merchantOnly: true },
  { question: "ماذا يعمل زر 'الطلبات'؟", answer: "يعرض جميع طلبات الشراء من العملاء لمنتجاتك. يمكنك متابعة حالة كل طلب وتحديثها.", merchantOnly: true },
  { question: "ماذا يعمل زر 'طلبات الزبائن'؟", answer: "يعرض طلبات الطباعة المخصصة من العملاء في المجتمع. يمكنك تقديم عروض أسعار عليها والتنافس مع تجار آخرين.", merchantOnly: true },
  { question: "ماذا يعمل زر 'المحادثات' للتاجر؟", answer: "يفتح جميع محادثاتك مع العملاء. يمكنك الرد على استفساراتهم ومتابعة تفاصيل الطلبات.", merchantOnly: true },
  { question: "كيف أقدم عرض سعر على طلب عميل؟", answer: "اذهب إلى 'طلبات الزبائن'، اختر الطلب، واضغط 'تقديم عرض'. حدد السعر ومدة التسليم وأضف ملاحظاتك.", merchantOnly: true },
];

export default function LevoHelpBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFaq, setSelectedFaq] = useState<FAQ | null>(null);
  const [isBouncing, setIsBouncing] = useState(true);
  const { user } = useAuth();

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
      return true;
    });
  }, [isMerchant]);

  const handleOpen = () => {
    setIsOpen(true);
    setIsBouncing(false);
    setSelectedFaq(null);
  };

  return (
    <>
      {/* Floating Bot Button */}
      {!isOpen && (
        <button
          onClick={handleOpen}
          className={cn(
            "fixed bottom-24 right-4 z-[60] flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-xl px-4 py-3 hover:shadow-2xl transition-all duration-300 hover:scale-105",
            isBouncing && "animate-bounce"
          )}
          style={{ animationDuration: "2s" }}
        >
          <Bot className="h-5 w-5" />
          <span className="text-xs font-bold whitespace-nowrap">مساعد ليفو</span>
          <Sparkles className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-4 z-[60] w-[340px] max-h-[70vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl animate-scale-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-primary to-primary/90 text-primary-foreground shrink-0">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="text-sm font-bold">مساعد ليفو 🤖</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 rounded-full hover:bg-white/20 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2" dir="rtl">
            {!selectedFaq ? (
              <>
                <div className="bg-primary/5 rounded-xl p-3 mb-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    مرحباً! 👋 أنا مساعد ليفو. اختر سؤالك وسأساعدك فوراً:
                  </p>
                </div>
                {filteredFaqs.map((faq, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedFaq(faq)}
                    className="w-full flex items-center gap-2 text-right px-3 py-2.5 rounded-xl border border-border/60 bg-background hover:bg-primary/5 hover:border-primary/30 transition-all text-xs leading-relaxed group"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors rotate-180" />
                    <span className="flex-1">{faq.question}</span>
                  </button>
                ))}
              </>
            ) : (
              <div className="space-y-3">
                {/* Question bubble */}
                <div className="bg-primary/10 rounded-xl p-3">
                  <p className="text-xs font-semibold text-primary">{selectedFaq.question}</p>
                </div>
                {/* Answer bubble */}
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-xs leading-relaxed text-foreground">{selectedFaq.answer}</p>
                </div>
                <button
                  onClick={() => setSelectedFaq(null)}
                  className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline mt-2"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  أسئلة أخرى
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
