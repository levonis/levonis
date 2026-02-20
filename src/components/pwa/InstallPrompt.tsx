import { useState, useEffect } from 'react';
import { X, Download, Bell, Share, Plus, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNotificationPermission } from '@/hooks/useNotificationPermission';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

const isInStandaloneMode = () => {
  return window.matchMedia('(display-mode: standalone)').matches || 
    (window.navigator as any).standalone === true;
};

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showNotifBanner, setShowNotifBanner] = useState(false);
  const { permission, requestPermission } = useNotificationPermission();

  const iosDevice = isIOS();

  useEffect(() => {
    if (isInStandaloneMode()) {
      setIsInstalled(true);
      return;
    }

    // --- Notification banner logic ---
    const notifDismissed = localStorage.getItem('notif-prompt-dismissed');
    const notifSupported = 'Notification' in window;
    
    if (notifSupported) {
      if (notifDismissed) {
        const dismissedAt = parseInt(notifDismissed, 10);
        if (Date.now() - dismissedAt >= 7 * 24 * 60 * 60 * 1000 && Notification.permission === 'default') {
          setTimeout(() => setShowNotifBanner(true), 5000);
        }
      } else if (Notification.permission === 'default') {
        setTimeout(() => setShowNotifBanner(true), 8000);
      }
    }

    // --- Install prompt logic ---
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    // Listen for beforeinstallprompt (Chromium browsers)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // Show the card for ALL browsers after 3s
    setTimeout(() => setShowPrompt(true), 3000);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setDeferredPrompt(null);
    handleDismiss();
  };

  const handleDismiss = () => {
    setIsClosing(true);
    setTimeout(() => {
      setShowPrompt(false);
      setIsClosing(false);
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
    }, 300);
  };

  const handleAllowNotifications = async () => {
    const result = await requestPermission();
    setShowNotifBanner(false);
    localStorage.setItem('notif-prompt-dismissed', Date.now().toString());
    if (result === 'granted' && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification('🔔 LEVONIS', {
        body: 'تم تفعيل الإشعارات بنجاح!',
        icon: '/icons/icon-192.png',
        dir: 'rtl',
        lang: 'ar',
      } as NotificationOptions);
    }
  };

  const handleDismissNotif = () => {
    setShowNotifBanner(false);
    localStorage.setItem('notif-prompt-dismissed', Date.now().toString());
  };

  const showInstallCard = !isInstalled && showPrompt;

  return (
    <>
      {/* Notification Permission Banner */}
      {showNotifBanner && (
        <div className={cn(
          "fixed top-4 left-4 right-4 z-[70] mx-auto max-w-sm transition-all duration-300",
          "animate-in slide-in-from-top-4"
        )}>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10">
            <div className="h-1 w-full bg-gradient-to-l from-primary via-primary/70 to-primary/40" />
            <button onClick={handleDismissNotif} className="absolute left-2 top-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="p-4 pt-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">تفعيل الإشعارات</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5">احصل على تنبيهات فورية للرسائل والطلبات</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <Button onClick={handleAllowNotifications} size="sm" className="flex-1 h-8 gap-1.5 text-xs font-bold rounded-xl">
                  <Bell className="h-3.5 w-3.5" />
                  السماح
                </Button>
                <Button onClick={handleDismissNotif} variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground rounded-xl px-3">
                  لاحقاً
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Install Prompt */}
      {showInstallCard && (
        <div className={cn(
          "fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm transition-all duration-300",
          isClosing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-4"
        )}>
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10">
            <div className="h-1 w-full bg-gradient-to-l from-primary via-primary/70 to-primary/40" />
            <button onClick={handleDismiss} className="absolute left-2 top-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
            <div className="p-4 pt-3">
              <div className="flex items-start gap-3">
                <div className="shrink-0 h-12 w-12 rounded-xl overflow-hidden border border-primary/20 shadow-sm bg-background">
                  <img src="/icons/icon-192.png" alt="LEVONIS" className="h-full w-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-foreground">أضف LEVONIS للشاشة الرئيسية</h3>
                  {iosDevice ? (
                    <div className="mt-1 space-y-1">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>1. اضغط على</span>
                        <Share className="h-3 w-3 inline text-primary" />
                        <span>(مشاركة)</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>2. اختر</span>
                        <Plus className="h-3 w-3 inline text-primary" />
                        <span>"إضافة إلى الشاشة الرئيسية"</span>
                      </p>
                    </div>
                  ) : !deferredPrompt ? (
                    <div className="mt-1 space-y-1">
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>1. اضغط على</span>
                        <MoreVertical className="h-3 w-3 inline text-primary" />
                        <span>(قائمة المتصفح)</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <span>2. اختر</span>
                        <Download className="h-3 w-3 inline text-primary" />
                        <span>"تثبيت التطبيق" أو "إضافة للشاشة"</span>
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground mt-0.5">وصول سريع • إشعارات فورية • تجربة تطبيق كاملة</p>
                  )}
                </div>
              </div>
              {deferredPrompt ? (
                <div className="flex gap-2 mt-3">
                  <Button onClick={handleInstall} size="sm" className="flex-1 h-8 gap-1.5 text-xs font-bold rounded-xl">
                    <Download className="h-3.5 w-3.5" />
                    تثبيت التطبيق
                  </Button>
                  <Button onClick={handleDismiss} variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground rounded-xl px-3">
                    لاحقاً
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end mt-2">
                  <Button onClick={handleDismiss} variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground rounded-xl px-3">
                    فهمت
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
