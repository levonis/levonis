import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInStandaloneMode = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
};

const isMobileBrowser = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/* ─── Install Card ─── */
function InstallCard({ onDismiss }: { onDismiss: () => void }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (isInStandaloneMode()) { setIsInstalled(true); return; }
    const handler = (e: Event) => { e.preventDefault(); setDeferredPrompt(e as BeforeInstallPromptEvent); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setIsInstalled(true);
      setDeferredPrompt(null);
    } else if (isIOS()) {
      toast.info(t('pwa_install_ios_step1') + '\n' + t('pwa_install_ios_step2'));
    } else {
      toast.info(t('pwa_install_generic_step1') + '\n' + t('pwa_install_generic_step2'));
    }
  };

  // Hide if installed or not a mobile browser (and no deferred prompt)
  if (isInstalled) return null;
  // Show on mobile browsers OR when we have a deferred prompt
  if (!deferredPrompt && !isIOS() && !isMobileBrowser()) return null;

  return (
    <div className="relative rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl p-4">
      <button
        onClick={onDismiss}
        className="absolute top-2 end-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Smartphone className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{t('pwa_install_title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('pwa_install_desc')}</p>
        </div>
      </div>
      <Button
        onClick={handleInstall}
        className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        size="sm"
      >
        <Download className="h-4 w-4" />
        {t('pwa_install_button')}
      </Button>
    </div>
  );
}

/* ─── Notification Card ─── */
function NotificationCard({ onDismiss }: { onDismiss: () => void }) {
  const { permission, requestPermission } = useNotificationPermission();
  const { t } = useLanguage();

  // Hide if notifications not supported, already granted, or denied
  if (permission === 'unsupported' || permission === 'granted' || permission === 'denied') return null;

  const handleAllow = async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      toast.success(t('pwa_notif_success'));
      onDismiss();
    }
  };

  return (
    <div className="relative rounded-2xl border border-border bg-background/95 backdrop-blur-xl shadow-2xl p-4">
      <button
        onClick={onDismiss}
        className="absolute top-2 end-2 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Close"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bell className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-foreground">{t('pwa_notif_title')}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{t('pwa_notif_desc')}</p>
        </div>
      </div>
      <Button
        onClick={handleAllow}
        className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        size="sm"
      >
        <Bell className="h-4 w-4" />
        {t('pwa_notif_allow')}
      </Button>
    </div>
  );
}

/* ─── Combined Prompt ─── */
export default function InstallPrompt() {
  const [installDismissed, setInstallDismissed] = useState(false);
  const [notifDismissed, setNotifDismissed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check session dismissals
    if (sessionStorage.getItem('install-prompt-dismissed')) setInstallDismissed(true);
    if (sessionStorage.getItem('notif-prompt-dismissed')) setNotifDismissed(true);
    // Delay showing for 3 seconds
    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  const dismissInstall = () => {
    setInstallDismissed(true);
    sessionStorage.setItem('install-prompt-dismissed', 'true');
  };

  const dismissNotif = () => {
    setNotifDismissed(true);
    sessionStorage.setItem('notif-prompt-dismissed', 'true');
  };

  if (!show) return null;
  if (installDismissed && notifDismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-[9999] mx-auto max-w-sm animate-in slide-in-from-bottom-4 duration-500 flex flex-col gap-3">
      {!notifDismissed && <NotificationCard onDismiss={dismissNotif} />}
      {!installDismissed && <InstallCard onDismiss={dismissInstall} />}
    </div>
  );
}
