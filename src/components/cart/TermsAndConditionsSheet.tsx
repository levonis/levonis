import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetDescription,
} from "@/components/ui/sheet";
import { FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { TERMS_BY_LANG, type Lang } from "./termsContent";

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
  const { language } = useLanguage();
  const lang: Lang = (['ar', 'en', 'ku'].includes(language) ? language : 'ar') as Lang;
  const t = TERMS_BY_LANG[lang];

  const handleAccept = () => {
    onAccept();
    onOpenChange(false);
  };

  // Sections 1-20 are part one; 21-28 are part two
  const partOne = t.sections.slice(0, 20);
  const partTwo = t.sections.slice(20);

  // Padding side based on direction
  const padSide = t.dir === 'rtl' ? 'pr-8' : 'pl-8';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] sm:h-[80vh] p-0 flex flex-col">
        <SheetHeader className="p-4 sm:p-6 border-b bg-card flex-shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            {t.sheetTitle}
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t.sheetDescription}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 min-h-0 px-4 sm:px-6 overflow-y-auto">
          <div
            className="py-4 space-y-6 text-sm leading-relaxed text-foreground"
            dir={t.dir}
          >
            {/* Title */}
            <div className="text-center pb-4 border-b">
              <h2 className="text-lg font-bold text-primary mb-2">
                {t.mainHeading}
              </h2>
              <p className="text-muted-foreground text-xs">
                {t.mainSubheading}
              </p>
            </div>

            {/* Part one — sections 1..20 */}
            {partOne.map((section, idx) => (
              <div key={idx} className="space-y-2">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">
                    {idx + 1}
                  </span>
                  {section.title}
                </h3>
                {section.paragraphs.map((p, pi) => (
                  <p key={pi} className={`${padSide} text-muted-foreground`}>
                    {p}
                  </p>
                ))}
              </div>
            ))}

            {/* Separator */}
            <div className="border-t border-border/50 my-6 pt-6">
              <h2 className="text-lg font-bold text-primary mb-4 text-center">
                {t.secondaryHeading}
              </h2>
            </div>

            {/* Part two — sections 21..28 */}
            {partTwo.map((section, idx) => (
              <div key={idx + 20} className="space-y-2">
                <h3 className="font-bold text-primary flex items-center gap-2">
                  <span className="bg-primary text-primary-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs">
                    {idx + 21}
                  </span>
                  {section.title}
                </h3>
                {section.paragraphs.map((p, pi) => (
                  <p key={pi} className={`${padSide} text-muted-foreground`}>
                    {p}
                  </p>
                ))}
              </div>
            ))}

            {/* Warning */}
            <div className="mt-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-amber-700 dark:text-amber-400 text-sm font-medium">
                  {t.warning}
                </p>
              </div>
            </div>

            <div className="h-4" />
          </div>
        </div>

        <SheetFooter className="p-4 sm:p-6 border-t bg-card flex-shrink-0">
          <div className="w-full flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              {t.closeBtn}
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleAccept}
              disabled={isLoading}
            >
              <CheckCircle className="h-4 w-4" />
              {t.acceptBtn}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default TermsAndConditionsSheet;
