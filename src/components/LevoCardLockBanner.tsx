import { useNavigate } from "react-router-dom";
import { Lock, Sparkles, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";

export default function LevoCardLockBanner() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  return (
    <section className="container mx-auto px-3 py-3">
      <div className="group relative w-full overflow-hidden rounded-3xl glass-panel text-right transition-all duration-300 hover:border-primary/40">
        {/* Blur backdrop simulating locked content */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background/80 backdrop-blur-sm" />

        {/* Top highlight */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent z-20 pointer-events-none" />

        {/* Shimmer accent */}
        <div className="pointer-events-none absolute -top-16 -left-16 size-40 rounded-full bg-primary/20 blur-3xl" />

        <div className="relative p-5 sm:p-6 flex flex-col items-center gap-4 text-center">
          {/* Lock icon */}
          <div className="size-16 rounded-2xl bg-primary/15 backdrop-blur-md flex items-center justify-center shrink-0 ring-1 ring-primary/30">
            <Lock className="size-8 text-primary drop-shadow" />
          </div>

          {/* Text */}
          <div className="space-y-1.5 max-w-md">
            <h3 className="text-base sm:text-lg font-extrabold text-foreground">
              {language === "en"
                ? "Levo Card Required"
                : language === "ku"
                ? "کارتی لێڤۆ پێویستە"
                : "بطاقة ليفو مطلوبة"}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {language === "en"
                ? "Activate your Levo Card to unlock exclusive Bundles and Random Filament sections."
                : language === "ku"
                ? "کارتەکەی لێڤۆ چالاک بکە بۆ کردنەوەی بەشە تایبەتەکانی باندڵ و فیلامێنتی هەڕەمەکی."
                : "فعّل بطاقة ليفو لفتح قسمي البندل والفلمنت العشوائي الحصريين."}
            </p>
          </div>

          {/* CTA */}
          <Button
            size="sm"
            className="gap-1.5 rounded-full px-5"
            onClick={() => navigate("/rewards?tab=cards")}
          >
            <Sparkles className="size-4" />
            {language === "en"
              ? "Activate Levo Card"
              : language === "ku"
              ? "چالاککردنی کارتی لێڤۆ"
              : "فعّل بطاقة ليفو"}
            <ArrowLeft className="size-3.5" />
          </Button>
        </div>
      </div>
    </section>
  );
}
