// Main entry point - v7 (PWA + Telegram Mini App support)
import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker: enable only for real production, never on Lovable preview hosts
const isLovablePreview =
  window.location.hostname.includes('lovableproject.com') ||
  window.location.hostname.startsWith('id-preview--') ||
  window.location.search.includes('__lovable_token=');

if ('serviceWorker' in navigator) {
  const shouldRegisterSW = import.meta.env.PROD && !isLovablePreview;

  if (shouldRegisterSW) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update();
        });
      }).catch(() => {});
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  } else {
    // Aggressively clean stale SW/cache in preview to prevent blank-screen chunk mismatches
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      await Promise.all(regs.map((reg) => reg.unregister()));
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
    }).catch(() => {});
  }
}

// Telegram Mini App: expand viewport to full height
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        expand: () => void;
        ready: () => void;
        isExpanded?: boolean;
        viewportHeight?: number;
        viewportStableHeight?: number;
        headerColor?: string;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

// Capacitor: initialize native platform UI (status bar, splash, back button)
import('@capacitor/core').then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#103d33' }).catch(() => {});
  }).catch(() => {});
  import('@capacitor/splash-screen').then(({ SplashScreen }) => {
    setTimeout(() => SplashScreen.hide().catch(() => {}), 500);
  }).catch(() => {});
  import('@capacitor/app').then(({ App }) => {
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
  }).catch(() => {});
}).catch(() => {});

// Telegram WebApp SDK is loaded only inside Telegram (see index.html).
// Poll briefly, then give up so we never keep timers alive on regular browsers.
const initTelegramWebApp = (attempts = 0) => {
  if (window.Telegram?.WebApp) {
    const tg = window.Telegram.WebApp;
    try {
      tg.ready();
      tg.expand();
      tg.setHeaderColor?.('#09090b');
      tg.setBackgroundColor?.('#09090b');
    } catch {}
    return;
  }
  if (attempts >= 15) return; // ~3s max
  setTimeout(() => initTelegramWebApp(attempts + 1), 200);
};
if (typeof window !== 'undefined' && /Telegram/i.test(navigator.userAgent)) {
  if (document.readyState === 'complete') initTelegramWebApp();
  else window.addEventListener('load', () => initTelegramWebApp());
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Signal mount IMMEDIATELY (synchronously) to clear the safety-net timers
// so slow phones don't trigger a false-positive cache wipe before first paint.
try {
  window.dispatchEvent(new Event('levo:mounted'));
  sessionStorage.removeItem('__levo_auto_recovered');
  localStorage.removeItem('__levo_recovery_attempts');
} catch {}

// Remove initial HTML loader after first paint
requestAnimationFrame(() => {
  const loader = document.getElementById('initial-loader');
  if (loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader.remove(), 300);
  }
});
