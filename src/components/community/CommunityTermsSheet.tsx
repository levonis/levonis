import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { FileText, CheckCircle } from "lucide-react";

interface CommunityTermsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

const CommunityTermsSheet = ({
  open,
  onOpenChange,
  onAccept,
}: CommunityTermsSheetProps) => {
  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] p-0 flex flex-col">
        <SheetHeader className="p-4 sm:p-6 border-b bg-card flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            شروط وأحكام مجتمع ليفو
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            منصة ربط العملاء بمزودي خدمات الطباعة ثلاثية الأبعاد
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 sm:px-6 overflow-y-auto">
          <div className="py-4 space-y-5 text-sm leading-relaxed text-foreground" dir="rtl">
            
            {/* Section 1 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                تعريف المجتمع ودوره
              </h3>
              <p className="pr-8 text-muted-foreground">
                مجتمع ليفو هو منصة رقمية وسيطة تهدف إلى ربط العملاء الراغبين بطلب خدمات طباعة ثلاثية الأبعاد مع تجار ومزودي خدمة مستقلين يمتلكون الطابعات والمعدات اللازمة. ولا تُعد المنصة طرفاً مباشراً في تنفيذ عملية الطباعة، وإنما تنظّم عملية التواصل والدفع وحفظ الحقوق.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                التسجيل واستخدام المجتمع
              </h3>
              <p className="pr-8 text-muted-foreground">
                يشترط لاستخدام مجتمع ليفو إنشاء حساب صحيح يتضمن بيانات دقيقة ومحدثة. ويقر المستخدم بأن أي استخدام للحساب يتم على مسؤوليته الكاملة، ولا تتحمل المنصة أي مسؤولية عن إساءة استخدام الحساب من قبل الغير.
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                التزامات العميل
              </h3>
              <p className="pr-8 text-muted-foreground mb-2">
                يلتزم العميل عند طلب أي خدمة طباعة بما يلي:
              </p>
              <ul className="pr-10 text-muted-foreground space-y-1 list-disc list-inside">
                <li>الالتزام بإرشادات المجتمع وسياسات الطلب المعتمدة.</li>
                <li>تقديم ملفات الطباعة والمواصفات الفنية بشكل واضح ودقيق.</li>
                <li>سداد كامل قيمة الطلب مقدماً من خلال نظام الدفع داخل المنصة فقط.</li>
                <li>اختيار التجار المصنفين أو الموثوقين داخل المجتمع.</li>
                <li>إجراء جميع المحادثات والاتفاقات من خلال نظام الرسائل الداخلي للمنصة.</li>
              </ul>
            </div>

            {/* Section 4 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                الدفع داخل المنصة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يُعد الدفع داخل المنصة شرطاً أساسياً للاستفادة من خدمات الحماية وحل النزاعات. ولا تتحمل المنصة أي مسؤولية عن المدفوعات أو الاتفاقات التي تتم خارجها، ويسقط حق العميل في المطالبة بأي تعويض في هذه الحالة.
              </p>
            </div>

            {/* Section 5 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                التواصل وحفظ الحقوق
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقر العميل بأن التواصل خارج المنصة (مثل الهاتف، البريد الشخصي، أو تطبيقات خارجية) يعرضه لفقدان حقه في إثبات أي اتفاق أو نزاع، وتخلي المنصة عن أي التزام بالتدخل أو الوساطة.
              </p>
            </div>

            {/* Section 6 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">6</span>
                الملفات والتصاميم
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتحمل العميل المسؤولية الكاملة عن ملكية التصاميم المرسلة وحقوق استخدامها، ويقر بعدم انتهاك أي حقوق فكرية أو صناعية للغير. ولا تتحمل المنصة أي مسؤولية قانونية عن النزاعات المتعلقة بالملكية الفكرية.
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">7</span>
                نتائج الطباعة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقر العميل بأن الطباعة ثلاثية الأبعاد عملية تقنية تعتمد على ملفات رقمية وإعدادات تشغيل، وقد تظهر فروقات بسيطة في الأبعاد أو الجودة لا تُعد عيباً ما لم تخالف المواصفات المتفق عليها بشكل جوهري.
              </p>
            </div>

            {/* Section 8 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">8</span>
                النزاعات والشكاوى
              </h3>
              <p className="pr-8 text-muted-foreground">
                في حال حدوث نزاع بين العميل والتاجر، يلتزم العميل بتقديم شكوى رسمية عبر النظام المخصص داخل المنصة خلال المدة المحددة. وتقتصر صلاحية المنصة على الوساطة أو اتخاذ الإجراءات التنظيمية وفق السياسات المعلنة.
              </p>
            </div>

            {/* Section 9 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">9</span>
                حدود مسؤولية المنصة
              </h3>
              <p className="pr-8 text-muted-foreground">
                لا تضمن المنصة جودة التنفيذ النهائية، ولا تتحمل أي أضرار مباشرة أو غير مباشرة ناتجة عن استخدام المنتج المطبوع، ويقتصر دورها على تنظيم العلاقة وحفظ السجلات الرقمية.
              </p>
            </div>

            {/* Section 10 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">10</span>
                الإلغاء ورفض الطلب
              </h3>
              <p className="pr-8 text-muted-foreground">
                يحق للتاجر رفض تنفيذ الطلب في حال عدم وضوح المواصفات أو مخالفة الطلب لسياسات المجتمع، ويتم التعامل مع المبالغ المدفوعة وفق سياسة النزاعات المعتمدة.
              </p>
            </div>

            {/* Section 11 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">11</span>
                السلوك داخل المجتمع
              </h3>
              <p className="pr-8 text-muted-foreground">
                يمنع على العملاء نشر أي محتوى مسيء، مضلل، غير قانوني، أو محاولة الضغط أو الابتزاز للتجار. ويحق للمنصة اتخاذ إجراءات تشمل التحذير أو إيقاف الحساب.
              </p>
            </div>

            {/* Section 12 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">12</span>
                التقييمات والمراجعات
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم العميل بتقديم تقييمات حقيقية وعادلة مبنية على تجربة فعلية، ويمنع إساءة استخدام نظام التقييم للإضرار بسمعة التجار.
              </p>
            </div>

            {/* Section 13 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">13</span>
                تعليق أو إيقاف الحساب
              </h3>
              <p className="pr-8 text-muted-foreground">
                يحق للمنصة تعليق أو إيقاف حساب العميل مؤقتاً أو دائماً في حال مخالفة هذه الشروط أو إساءة استخدام المجتمع، دون التزام بتعويض.
              </p>
            </div>

            {/* Section 14 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">14</span>
                تحديث الشروط
              </h3>
              <p className="pr-8 text-muted-foreground">
                تحتفظ المنصة بحق تعديل شروط مجتمع ليفو في أي وقت، ويُعد استمرار الاستخدام بعد التعديل موافقة ضمنية على الشروط المحدثة.
              </p>
            </div>

            {/* Final Notice */}
            <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary text-center">
                بإكمال الملف الشخصي، يقرّ المستخدم بأنه قرأ وفهم ووافق على جميع ما ورد أعلاه دون أي تحفظ.
              </p>
            </div>
          </div>
        </div>

        <SheetFooter className="p-4 sm:p-6 border-t bg-card flex-shrink-0">
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

export default CommunityTermsSheet;
