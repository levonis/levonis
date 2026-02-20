import { useState, useEffect } from 'react';
import { X, Download, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    // Check if user dismissed within last 3 days
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < 3 * 24 * 60 * 60 * 1000) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show after a delay for better UX
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
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

  if (isInstalled || !showPrompt || !deferredPrompt) return null;

  return (
    <div className={cn(
      "fixed bottom-20 left-4 right-4 z-[60] mx-auto max-w-sm transition-all duration-300",
      isClosing ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0 animate-in slide-in-from-bottom-4"
    )}>
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10">
        {/* Decorative gradient top bar */}
        <div className="h-1 w-full bg-gradient-to-l from-primary via-primary/70 to-primary/40" />
        
        <button
          onClick={handleDismiss}
          className="absolute left-2 top-3 p-1 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="p-4 pt-3">
          <div className="flex items-start gap-3">
            {/* App Icon */}
            <div className="shrink-0 h-14 w-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-sm">
              <Smartphone className="h-7 w-7 text-primary" />
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-foreground leading-tight">
                أضف LEVONIS للشاشة الرئيسية
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                وصول سريع • إشعارات فورية • تجربة تطبيق كاملة
              </p>
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <Button
              onClick={handleInstall}
              size="sm"
              className="flex-1 h-9 gap-1.5 text-xs font-bold rounded-xl"
            >
              <Download className="h-3.5 w-3.5" />
              تثبيت التطبيق
            </Button>
            <Button
              onClick={handleDismiss}
              variant="ghost"
              size="sm"
              className="h-9 text-xs text-muted-foreground rounded-xl px-3"
            >
              لاحقاً
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
