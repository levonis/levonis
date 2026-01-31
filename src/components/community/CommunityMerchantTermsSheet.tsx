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

interface CommunityMerchantTermsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: () => void;
}

const CommunityMerchantTermsSheet = ({
  open,
  onOpenChange,
  onAccept,
}: CommunityMerchantTermsSheetProps) => {
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
            شروط وأحكام التجار في مجتمع ليفو
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            شروط وأحكام التجار ومزودي خدمات الطباعة ثلاثية الأبعاد
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 sm:px-6 overflow-y-auto">
          <div className="py-4 space-y-5 text-sm leading-relaxed text-foreground" dir="rtl">
            
            {/* Section 1 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                صفة التاجر
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقر التاجر بأنه مزود خدمة مستقل يعمل لحسابه الخاص، وأن المنصة لا تمثله ولا تُعد شريكاً أو وكيلاً عنه، ولا تتحمل أي مسؤولية قانونية أو مالية عن التزاماته تجاه العملاء.
              </p>
            </div>

            {/* Section 2 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                التسجيل والبيانات
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم التاجر بتقديم بيانات صحيحة ومحدثة عند التسجيل، وتشمل معلومات التواصل ونوع المعدات والخدمات المقدمة. ويُعد التاجر مسؤولاً مسؤولية كاملة عن صحة هذه البيانات.
              </p>
            </div>

            {/* Section 3 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">3</span>
                عرض الخدمات والأسعار
              </h3>
              <p className="pr-8 text-muted-foreground">
                يجب على التاجر عرض خدماته وأسعاره بشكل واضح وصادق، ويمنع تقديم أسعار وهمية أو عروض مضللة بقصد جذب العملاء ثم تغييرها لاحقاً. وأي مخالفة لذلك تُعد إخلالاً جوهرياً بشروط المجتمع.
              </p>
            </div>

            {/* Section 4 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">4</span>
                الالتزام بالمواصفات
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم التاجر بتنفيذ الطلبات وفق الملفات والمواصفات المعتمدة داخل المنصة، ولا يجوز له تعديل السعر أو المواصفات بعد قبول الطلب إلا بموافقة صريحة من العميل عبر النظام الداخلي.
              </p>
            </div>

            {/* Section 5 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">5</span>
                جودة التنفيذ
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقر التاجر بأن جودة الطباعة تعتمد على خبرته التقنية وإعداداته التشغيلية، ويلتزم ببذل العناية المهنية المتعارف عليها في تنفيذ الطلب، دون تقديم ضمانات تتجاوز ما هو متفق عليه داخل المنصة.
              </p>
            </div>

            {/* Section 6 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">6</span>
                التواصل داخل المنصة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم التاجر بإجراء جميع المحادثات والاتفاقات مع العملاء داخل نظام الرسائل الخاص بالمنصة فقط. ويمنع منعاً باتاً تحويل العملاء للتعامل خارج المنصة بأي وسيلة مباشرة أو غير مباشرة.
              </p>
            </div>

            {/* Section 7 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">7</span>
                الدفع والتحصيل
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتم تحصيل المدفوعات حصراً من خلال المنصة، ولا يحق للتاجر طلب أو قبول أي مبالغ خارجها. وأي محاولة للتحايل على نظام الدفع تُعد مخالفة جسيمة.
              </p>
            </div>

            {/* Section 8 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">8</span>
                السلوك المهني
              </h3>
              <p className="pr-8 text-muted-foreground">
                يلتزم التاجر بالتعامل باحترام ومهنية مع العملاء، ويمنع استخدام أي أسلوب مسيء، تهديدي، أو غير لائق. ويحق للمنصة اتخاذ إجراءات فورية في حال ثبوت إساءة السلوك.
              </p>
            </div>

            {/* Section 9 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">9</span>
                المحتوى والإعلانات
              </h3>
              <p className="pr-8 text-muted-foreground">
                يمنع على التاجر نشر أي محتوى كاذب، مضلل، أو مخالف للأنظمة، سواء في وصف الخدمات أو في الرسائل أو في الملفات التعريفية.
              </p>
            </div>

            {/* Section 10 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">10</span>
                الالتزام بالأنظمة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يتحمل التاجر المسؤولية الكاملة عن الالتزام بالأنظمة المحلية المعمول بها، بما في ذلك ما يتعلق بالضرائب، التراخيص، والملكية الفكرية، ولا تتحمل المنصة أي مسؤولية عن مخالفاته النظامية.
              </p>
            </div>

            {/* Section 11 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">11</span>
                النزاعات مع العملاء
              </h3>
              <p className="pr-8 text-muted-foreground">
                في حال نشوء نزاع، يلتزم التاجر بالتعاون مع نظام حل النزاعات داخل المنصة، وتقديم ما يثبت التزامه بالمواصفات المتفق عليها.
              </p>
            </div>

            {/* Section 12 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">12</span>
                التقييمات والسمعة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يقر التاجر بأن التقييمات والمراجعات تعكس تجارب العملاء، ولا يحق له التلاعب بنظام التقييم أو الضغط على العملاء لتعديله. ويُعد التقييم جزءاً من سمعته داخل المجتمع.
              </p>
            </div>

            {/* Section 13 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">13</span>
                تعليق أو إيقاف الحساب
              </h3>
              <p className="pr-8 text-muted-foreground">
                يحق للمنصة تعليق أو إيقاف حساب التاجر مؤقتاً أو دائماً في حال مخالفة هذه الشروط، أو الإضرار بسمعة المجتمع، أو تكرار الشكاوى المثبتة، دون أي التزام بالتعويض.
              </p>
            </div>

            {/* Section 14 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">14</span>
                إنهاء العلاقة
              </h3>
              <p className="pr-8 text-muted-foreground">
                يحق لأي من الطرفين إنهاء العلاقة وفق سياسات المنصة، مع تسوية الطلبات القائمة وحقوق العملاء قبل الإغلاق النهائي للحساب.
              </p>
            </div>

            {/* Section 15 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">15</span>
                حدود مسؤولية المنصة
              </h3>
              <p className="pr-8 text-muted-foreground">
                تقتصر مسؤولية المنصة على تنظيم البيئة الرقمية وحفظ السجلات، ولا تتحمل أي التزامات مالية أو فنية ناتجة عن أعمال التاجر أو تقصيره.
              </p>
            </div>

            {/* Section 16 */}
            <div className="space-y-2">
              <h3 className="font-bold text-primary flex items-center gap-2">
                <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">16</span>
                القبول النهائي
              </h3>
              <p className="pr-8 text-muted-foreground">
                باستمرار التاجر في استخدام مجتمع ليفو أو قبول أي طلب، يقر بأنه قرأ وفهم ووافق على هذه الشروط والأحكام كاملةً دون تحفظ.
              </p>
            </div>

            {/* Final Notice */}
            <div className="mt-6 p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary text-center">
                بإكمال تسجيل المتجر، يقرّ التاجر بأنه قرأ وفهم ووافق على جميع ما ورد أعلاه دون أي تحفظ.
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

export default CommunityMerchantTermsSheet;
