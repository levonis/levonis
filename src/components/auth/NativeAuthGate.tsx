import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LogIn, UserPlus, User as UserIcon } from "lucide-react";

// Web-safe native detection: Capacitor injects `window.Capacitor` on native
// builds before our bundle runs. Avoiding the `@capacitor/core` static import
// keeps the heavy `vendor-capacitor` chunk OUT of the entry's critical chain
// (saves ~6 KiB + a network roundtrip on every web page load).
const isNativePlatform = (): boolean => {
  try {
    const cap = (typeof window !== "undefined" ? (window as any).Capacitor : null);
    return !!(cap && typeof cap.isNativePlatform === "function"
      ? cap.isNativePlatform()
      : cap?.isNative);
  } catch {
    return false;
  }
};
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage, LANGUAGE_LABELS, type Language } from "@/lib/i18n";
import AppBackground from "@/components/AppBackground";
import levonisLogo from "@/assets/levonis-logo.png";

const GUEST_SESSION_KEY = "__levo_native_guest_session";

/**
 * NativeAuthGate
 * --------------
 * On native (Capacitor) only, blocks access to the app for unauthenticated
 * users until they either sign in or explicitly continue as guest.
 */
const NativeAuthGate = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, dir, t } = useLanguage();

  const [isNative] = useState<boolean>(() => isNativePlatform());

  const [guestAccepted, setGuestAccepted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(GUEST_SESSION_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (user) {
      try {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
      } catch {}
    }
  }, [user]);

  const continueAsGuest = () => {
    try {
      sessionStorage.setItem(GUEST_SESSION_KEY, "1");
    } catch {}
    setGuestAccepted(true);
  };

  if (!isNative || location.pathname === "/auth") return <>{children}</>;
  if (loading) return null;
  if (user || guestAccepted) return <>{children}</>;

  return (
    <div
      dir={dir}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center px-6 overflow-hidden"
      style={{
        paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 2rem)",
      }}
    >
      {/* Site's main background */}
      <AppBackground />

      {/* Language switcher */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex justify-center gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
      >
        {(Object.keys(LANGUAGE_LABELS) as Language[]).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLanguage(lang)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border backdrop-blur-xl ${
              language === lang
                ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_12px_-2px_hsl(var(--primary)/0.6)]"
                : "bg-white/5 text-foreground/80 border-white/15 hover:text-foreground"
            }`}
          >
            {LANGUAGE_LABELS[lang]}
          </button>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center text-center gap-6">
        <div className="w-24 h-24 rounded-3xl flex items-center justify-center p-3 bg-white/5 backdrop-blur-xl border border-white/15 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5),inset_0_1px_0_0_hsl(0_0%_100%/0.15)]">
          <img src={levonisLogo} alt="Levonis" className="h-full w-full object-contain" loading="lazy" decoding="async" />
        </div>

        <div className="space-y-2" lang={language} dir={dir}>
          <h1 className="text-2xl font-black text-foreground font-sans">{t('auth_native_welcome')}</h1>
          <p
            className="text-sm text-muted-foreground leading-relaxed font-sans"
            style={{ unicodeBidi: 'plaintext', wordSpacing: 'normal', letterSpacing: 'normal' }}
          >
            {t('auth_native_subtitle')}
          </p>
        </div>

        <div className="w-full flex flex-col gap-3 mt-2">
          <Button
            size="lg"
            className="w-full h-12 rounded-2xl text-base font-bold gap-2"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-5 h-5" />
            {t('auth_login')}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 rounded-2xl text-base font-bold gap-2 bg-white/5 backdrop-blur-xl border-white/20"
            onClick={() => navigate("/auth?mode=signup")}
          >
            <UserPlus className="w-5 h-5" />
            {t('auth_create_account')}
          </Button>

          <button
            type="button"
            onClick={continueAsGuest}
            className="mt-1 inline-flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <UserIcon className="w-4 h-4" />
            {t('auth_continue_as_guest')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NativeAuthGate;
