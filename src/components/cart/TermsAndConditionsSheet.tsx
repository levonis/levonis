import { Button } from "@/components/ui/button";
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetFooter,
  SheetDescription 
} from "@/components/ui/sheet";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";

interface TermsAndConditionsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
  isLoading?: boolean;
}

const TermsAndConditionsSheet = ({
  open,
  onOpenChange,
  onAccept,
  isLoading = false,
}: TermsAndConditionsSheetProps) => {

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] p-0">
        <SheetHeader className="p-4 sm:p-6 border-b bg-card">
          <SheetTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            الشروط والأحكام
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            يرجى قراءة الشروط والأحكام بعناية قبل إتمام عملية الشراء
          </SheetDescription>
        </SheetHeader>

        <div 
          className="flex-1 px-4 sm:px-6 overflow-y-auto"
        >
          <div className="py-4 space-y-6 text-sm leading-relaxed text-foreground" dir="rtl">
            
            {/* Title */}
            <div className="text-center pb-4 border-b">
              <h2 className="text-lg font-bold text-primary mb-2">
                شروط وأحكام متجر الطابعات ثلاثية الأبعاد
              </h2>
              <p className="text-muted-foreground text-xs">
                (الطلب المسبق، الدفع، الشحن، الضمان)
              </p>
            </div>

            {/* Section 1 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                نظام الطلب المسبق
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقرّ المستخدم ويوافق على أن جميع الطابعات ثلاثية الأبعاد المعروضة في المتجر تُباع بنظام الطلب المسبق (Pre-Order)، وأن مدة التجهيز والتوريد والتسليم هي مدة تقديرية تصل إلى خمسة وأربعين (45) يوماً من تاريخ تأكيد الطلب، وقد تزيد أو تنقص تبعاً لظروف الشحن، الجمارك، أو توفر المنتج لدى الموردين.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                الدفع وتثبيت الطلب
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتم تثبيت الطلب بعد قيام المستخدم بدفع كامل قيمة المنتج أو دفع دفعة جزئية محددة بوضوح في صفحة المنتج. ويُعد أي مبلغ مدفوع، كلياً أو جزئياً، موافقة صريحة ونهائية من المستخدم على تنفيذ الطلب وفق هذه الشروط والأحكام، ولا يمكن إلغاء الطلب إلا وفق سياسة الإلغاء المعتمدة.
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                الإلغاء والاسترجاع
              </h3>
              <p className="pr-8 text-muted-foreground">
                في حال رغبة المستخدم في إلغاء الطلب أو استرجاع المبلغ دون وجود سبب فني جوهري أو عيب مصنعي مثبت، يحق للمنصة خصم رسوم إدارية وتشغيلية تشمل – على سبيل المثال لا الحصر – تكاليف معالجة الطلب، التحويلات البنكية، حجز المنتج لدى المورد، وأي التزامات لوجستية مترتبة.
              </p>
              <p className="pr-8 text-muted-foreground">
                تختلف قيمة الخصم حسب مرحلة تنفيذ الطلب، ويوافق المستخدم على أن هذه الرسوم غير قابلة للاعتراض أو الطعن بعد الموافقة على الشروط.
              </p>
            </div>

            {/* Section 4 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                الشحن والتسليم
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتم شحن الطابعات والملحقات عبر شركات شحن معتمدة، وقد يتم شحن بعض القطع أو الإكسسوارات جواً خلال مدة تقديرية لا تتجاوز أسبوعين، وبحد أدنى للشحن الجوي (1) كيلوجرام.
              </p>
              <p className="pr-8 text-muted-foreground">
                لا تتحمل المنصة مسؤولية أي تأخير ناتج عن الجهات الخارجية مثل شركات الشحن أو الجمارك.
              </p>
            </div>

            {/* Section 5 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                الضمان الأساسي
              </h3>
              <p className="pr-8 text-muted-foreground">
                يبدأ الضمان الأساسي للطابعة من تاريخ إتمام عملية الشراء وليس من تاريخ الاستلام.
              </p>
              <p className="pr-8 text-muted-foreground">
                يشمل الضمان استبدال القطع التالفة فقط خلال فترة الضمان المعتمدة، ولا يشمل الأعطال الناتجة عن سوء الاستخدام، الإهمال، التعديل غير المصرّح به، أو التشغيل المخالف لتعليمات الشركة المصنعة.
              </p>
            </div>

            {/* Section 6 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">6</span>
                الاستبدال الكامل
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتم استبدال الطابعة كاملة فقط في حال ثبوت وجود ضرر ناتج عن الشحن أو النقل، وذلك بعد فحص المنتج وإصدار تقرير فني معتمد يثبت أن الضرر لم يكن نتيجة استخدام المستخدم.
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">7</span>
                التأمين
              </h3>
              <p className="pr-8 text-muted-foreground">
                قيمة التأمين والضمان الأساسي مشمولة ضمن سعر المنتج، ولا يتم احتسابها أو استردادها بشكل منفصل.
              </p>
            </div>

            {/* Section 8 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">8</span>
                الضمان الإضافي (الاشتراك الشهري)
              </h3>
              <p className="pr-8 text-muted-foreground">
                توفر المنصة خيار الاشتراك الشهري في خدمة تأمين إضافي يمنح المستخدم تغطية موسعة وأطول للطابعة وفق الشروط المعلنة لخدمة الاشتراك.
              </p>
              <p className="pr-8 text-muted-foreground">
                الاشتراك اختياري، وتخضع تفاصيل التغطية والاستثناءات لبنود خدمة التأمين الإضافي.
              </p>
            </div>

            {/* Section 9 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">9</span>
                القبول النهائي
              </h3>
              <p className="pr-8 text-muted-foreground font-medium">
                بإتمام عملية الشراء أو الدفع، يقرّ المستخدم بأنه قرأ وفهم ووافق على جميع ما ورد أعلاه دون أي تحفظ.
              </p>
            </div>

            {/* Section 10 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">10</span>
                دقة المعلومات والمواصفات
              </h3>
              <p className="pr-8 text-muted-foreground">
                تعرض المنصة مواصفات الطابعات والمنتجات بناءً على المعلومات الواردة من الشركات المصنعة أو الموردين. قد تطرأ تغييرات طفيفة على الشكل أو المواصفات التقنية دون إشعار مسبق، ولا يُعد ذلك سبباً للإلغاء أو الاسترجاع ما لم يؤثر التغيير بشكل جوهري على الأداء الأساسي للمنتج.
              </p>
            </div>

            {/* Section 11 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">11</span>
                مسؤولية الاستخدام
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتحمل المستخدم كامل المسؤولية عن تشغيل الطابعة واستخدامها وفق دليل الشركة المصنعة وتعليمات السلامة. ولا تتحمل المنصة أي أضرار مباشرة أو غير مباشرة ناتجة عن الاستخدام الخاطئ، أو تحميل ملفات غير متوافقة، أو تشغيل الطابعة بمواد غير معتمدة.
              </p>
            </div>

            {/* Section 12 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">12</span>
                المواد الاستهلاكية
              </h3>
              <p className="pr-8 text-muted-foreground">
                لا يشمل الضمان أي مواد استهلاكية مثل الفوهات، الأسرّة، الأحزمة، الفلاتر، أو أي أجزاء تتعرض للاستهلاك الطبيعي مع مرور الوقت، إلا في حال ثبوت وجود عيب مصنعي عند الاستلام.
              </p>
            </div>

            {/* Section 13 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">13</span>
                الدعم الفني
              </h3>
              <p className="pr-8 text-muted-foreground">
                توفر المنصة دعماً فنياً عن بُعد خلال فترة الضمان لمساعدة المستخدم في الإعداد الأولي أو تشخيص الأعطال. ولا يشمل الدعم الفني الزيارات الميدانية أو التدريب المتقدم إلا بعقد منفصل أو خدمة مدفوعة.
              </p>
            </div>

            {/* Section 14 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">14</span>
                التأخير القهري (القوة القاهرة)
              </h3>
              <p className="pr-8 text-muted-foreground">
                لا تتحمل المنصة أي مسؤولية عن التأخير أو عدم التنفيذ الناتج عن ظروف خارجة عن الإرادة، مثل الكوارث الطبيعية، الأوبئة، القيود الحكومية، تعطل سلاسل الإمداد، أو القرارات الجمركية.
              </p>
            </div>

            {/* Section 15 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">15</span>
                الرسوم والضرائب
              </h3>
              <p className="pr-8 text-muted-foreground">
                جميع الأسعار المعروضة لا تشمل – ما لم يُذكر خلاف ذلك – الرسوم الجمركية أو الضرائب المحلية التي قد تُفرض من قبل الجهات الرسمية، ويتحمل المستخدم سدادها عند الاستلام إن وُجدت.
              </p>
            </div>

            {/* Section 16 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">16</span>
                الفحص عند الاستلام
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم المستخدم بفحص المنتج فور الاستلام، والإبلاغ عن أي ضرر ظاهر أو نقص خلال مدة لا تتجاوز 48 ساعة من تاريخ الاستلام، مع تقديم صور أو فيديو يوضح الحالة. وفي حال عدم الإبلاغ خلال المدة المحددة، يُعتبر المنتج مستلماً بحالة سليمة.
              </p>
            </div>

            {/* Section 17 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">17</span>
                الملكية والمخاطر
              </h3>
              <p className="pr-8 text-muted-foreground">
                تنتقل مسؤولية المخاطر إلى المستخدم فور تسليم الشحنة لشركة الشحن، بينما تبقى ملكية المنتج للمنصة حتى سداد كامل قيمة الطلب.
              </p>
            </div>

            {/* Section 18 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">18</span>
                التحديثات البرمجية
              </h3>
              <p className="pr-8 text-muted-foreground">
                قد تتطلب بعض الطابعات تحديثات برمجية (Firmware / Software) دورية من الشركة المصنعة. ولا تتحمل المنصة أي مسؤولية عن أعطال ناتجة عن عدم تحديث النظام أو استخدام نسخ غير رسمية.
              </p>
            </div>

            {/* Section 19 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">19</span>
                حدود المسؤولية
              </h3>
              <p className="pr-8 text-muted-foreground">
                تقتصر مسؤولية المنصة – في جميع الأحوال – على قيمة المنتج المدفوعة فقط، ولا تتحمل أي خسائر تبعية، أو فقدان أرباح، أو توقف أعمال ناتج عن استخدام الطابعة.
              </p>
            </div>

            {/* Section 20 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">20</span>
                أولوية التفسير
              </h3>
              <p className="pr-8 text-muted-foreground">
                في حال وجود تعارض بين هذه الشروط وأي محتوى تسويقي أو تفسيري آخر، تكون الأولوية دائماً لما ورد في هذه الشروط والأحكام.
              </p>
            </div>

            {/* Separator */}
            <div className="border-t border-border/50 my-6 pt-6">
              <h2 className="text-lg font-bold text-primary mb-4 text-center">
                ثانياً: شروط استخدام الموقع والشراء
              </h2>
            </div>

            {/* Section 21 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">21</span>
                التسجيل وحساب المستخدم
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتعهد المستخدم بتقديم معلومات صحيحة ودقيقة عند التسجيل، ويتحمل مسؤولية الحفاظ على سرية بيانات حسابه وكلمة المرور. المنصة غير مسؤولة عن أي استخدام غير مصرح به ناتج عن إفشاء بيانات الدخول.
              </p>
            </div>

            {/* Section 22 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">22</span>
                استخدام المحفظة الإلكترونية
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقرّ المستخدم بأن رصيد المحفظة غير قابل للاسترداد نقداً ويُستخدم حصرياً للشراء من المنصة. لا تتحمل المنصة أي فوائد أو عوائد على الأرصدة المودعة.
              </p>
            </div>

            {/* Section 23 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">23</span>
                سياسة الأسعار
              </h3>
              <p className="pr-8 text-muted-foreground">
                الأسعار المعروضة قابلة للتغيير دون إشعار مسبق. السعر المعتمد هو السعر المثبت وقت تأكيد الطلب. قد تختلف الأسعار بناءً على العروض الترويجية أو تقلبات أسعار الصرف.
              </p>
            </div>

            {/* Section 24 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">24</span>
                الخصوصية وحماية البيانات
              </h3>
              <p className="pr-8 text-muted-foreground">
                تلتزم المنصة بحماية بيانات المستخدمين وعدم مشاركتها مع أطراف ثالثة إلا لأغراض تنفيذ الطلب أو بموجب متطلبات قانونية. قد تُستخدم البيانات لتحسين الخدمات وإرسال إشعارات ترويجية.
              </p>
            </div>

            {/* Section 25 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">25</span>
                الملكية الفكرية
              </h3>
              <p className="pr-8 text-muted-foreground">
                جميع المحتويات المعروضة على الموقع (صور، نصوص، شعارات، تصاميم) محمية بموجب حقوق الملكية الفكرية، ولا يحق للمستخدم نسخها أو استخدامها لأغراض تجارية دون إذن كتابي مسبق.
              </p>
            </div>

            {/* Section 26 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">26</span>
                التواصل والإشعارات
              </h3>
              <p className="pr-8 text-muted-foreground">
                يوافق المستخدم على استلام الإشعارات والتحديثات عبر البريد الإلكتروني، الرسائل النصية، أو إشعارات التطبيق. يمكنه إلغاء الاشتراك في الإشعارات الترويجية في أي وقت.
              </p>
            </div>

            {/* Section 27 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">27</span>
                تعديل الشروط
              </h3>
              <p className="pr-8 text-muted-foreground">
                تحتفظ المنصة بحق تعديل هذه الشروط والأحكام في أي وقت. يُعتبر استمرار استخدام الموقع بعد نشر التعديلات موافقة ضمنية عليها.
              </p>
            </div>

            {/* Section 28 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">28</span>
                القانون الواجب التطبيق
              </h3>
              <p className="pr-8 text-muted-foreground">
                تخضع هذه الشروط والأحكام للقوانين المحلية المعمول بها، وتختص المحاكم المحلية بالفصل في أي نزاع ينشأ عنها.
              </p>
            </div>

            {/* Warning Box */}
            <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                  بإتمام عملية الشراء، أنت تقر بأنك قرأت وفهمت ووافقت على جميع الشروط والأحكام المذكورة أعلاه.
                </p>
              </div>
            </div>

            {/* Spacer */}
            <div className="h-4" />
          </div>
        </div>

        <SheetFooter className="p-4 sm:p-6 border-t bg-card">
          <div className="w-full flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              إغلاق
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleAccept}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4" />
              موافق
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default TermsAndConditionsSheet;
