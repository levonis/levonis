import { useNavigate } from "react-router-dom";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/lib/i18n";
import PriceProtectionSection from "@/components/profile/PriceProtectionSection";

export default function PriceProtection() {
  const { user } = useAuth();
  const { t, dir } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" dir={dir}>
      <header className="sticky top-0 z-20 backdrop-blur-xl bg-background/70 border-b border-border/40">
        <div className="container mx-auto max-w-lg px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-xl bg-muted/40 hover:bg-muted/60 flex items-center justify-center transition"
            aria-label="back"
          >
            <ChevronRight className={`h-5 w-5 text-foreground ${dir === "ltr" ? "rotate-180" : ""}`} />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-foreground leading-tight truncate">{t("pp_title")}</h1>
              <p className="text-[10px] text-muted-foreground truncate">{t("pp_subtitle")}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-lg px-4 py-4 pb-24 space-y-4">
        {user?.id ? (
          <PriceProtectionSection userId={user.id} />
        ) : (
          <div className="glass-card p-6 text-center text-sm text-muted-foreground">
            {t("pp_subtitle")}
          </div>
        )}
      </main>
    </div>
  );
}
