import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { LogIn, UserPlus, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, LANGUAGE_LABELS, type Language } from "@/lib/i18n";
import levonisLogo from "@/assets/levonis-logo.png";

const GUEST_SESSION_KEY = "__levo_native_guest_session";

/**
 * NativeAuthGate
 * --------------
 * On native (Capacitor) only, blocks access to the app for unauthenticated
 * users until they either sign in or explicitly continue as guest.
 *
 * The "guest" decision is stored in `sessionStorage` so it persists for the
 * current launch only — closing & reopening the app re-shows the gate, as
 * requested by the product owner.
 *
 * On the web (PWA / browser) this component renders nothing.
 */
const NativeAuthGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, dir } = useLanguage();

  // Detect native synchronously so the very first render of the app already
  // hides the children behind the gate (avoids any flash of the home page).
  const [isNative] = useState<boolean>(() => {
    try {
      return Capacitor.isNativePlatform();
    } catch {
      return false;
    }
  });

  const [guestAccepted, setGuestAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(GUEST_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  // Once authenticated, clear the guest flag so re-launching after logout
  // shows the gate again.
  useEffect(() => {
    if (user) {
      try {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
      } catch {}
    }
  }, [user]);

  const labels = {
    ar: {
      welcome: "أهلاً بك في Levonis",
      sub: "سجّل الدخول للوصول إلى السلة، الطلبات، والمكافآت — أو تابع كضيف لتصفّح المتجر.",
      login: "تسجيل الدخول",
      signup: "إنشاء حساب جديد",
      guest: "متابعة كضيف",
    },
    en: {
      welcome: "Welcome to Levonis",
      sub: "Sign in to access your cart, orders and rewards — or continue as a guest to browse.",
      login: "Sign in",
      signup: "Create an account",
      guest: "Continue as guest",
    },
    ku: {
      welcome: "بەخێربێیت بۆ Levonis",
      sub: "بچۆرە ژوورەوە بۆ گەیشتن بە سەبەتەکەت، داواکارییەکانت و خەڵاتەکانت — یان وەک میوان بەردەوام بە.",
      login: "چوونەژوورەوە",
      signup: "دروستکردنی هەژمار",
      guest: "بەردەوامبوون وەک میوان",
    },
  }[language === "en" ? "en" : language === "ku" ? "ku" : "ar"];

  const continueAsGuest = () => {
    try {
      sessionStorage.setItem(GUEST_SESSION_KEY, "1");
    } catch {}
    setGuestAccepted(true);
  };

  // Web / not native / auth page: pass-through.
  if (!isNative || location.pathname === "/auth") return <>{children}</>;

  // Still resolving auth state — show nothing (avoid flash).
  if (loading) return null;

  // Authenticated or guest accepted for this launch — show the app.
  if (user || guestAccepted) return <>{children}</>;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
      }}
    >
      {/* Language switcher */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              language === lang
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-transparent text-muted-foreground border-border/50 hover:text-foreground"
            }`}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center gap-6">
        <div className="w-24 h-24 rounded-3xl border border-border/50 bg-[#103D33] flex items-center justify-center shadow-xl p-3">
          <img src={levonisLogo} alt="Levonis" className="h-full w-full object-contain" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-foreground">{labels.welcome}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">{labels.sub}</p>
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          <Button
            size="lg"
            className="w-full h-12 rounded-2xl text-base font-bold gap-2"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-5 h-5" />
            {labels.login}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 rounded-2xl text-base font-bold gap-2"
            onClick={() => navigate("/auth?mode=signup")}
          >
            <UserPlus className="w-5 h-5" />
            {labels.signup}
          </Button>

          <button
            type="button"
            onClick={continueAsGuest}
            className="mt-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <UserIcon className="w-4 h-4" />
            {labels.guest}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NativeAuthGate;
