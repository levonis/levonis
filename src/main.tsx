// Main entry point - v7 (PWA + Telegram Mini App support)
import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker kill-switch removed — it was wiping caches on every load,
// forcing every asset to be re-downloaded and making the site very slow.
// Old stuck users have already self-healed via the index.html one-shot cleaner.

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

// Capacitor: initialize native platform UI (status bar, splash, back button, keyboard)
import('@capacitor/core').then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
  // Mark the document so CSS can target native vs web
  document.documentElement.classList.add('is-native', `platform-${Capacitor.getPlatform()}`);

  import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: '#103d33' }).catch(() => {});
    StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
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

  // Push the layout up when keyboard opens, restore on close
  import('@capacitor/keyboard').then(({ Keyboard }) => {
    Keyboard.addListener('keyboardWillShow', (info) => {
      document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`);
      document.body.classList.add('keyboard-open');
    });
    Keyboard.addListener('keyboardWillHide', () => {
      document.documentElement.style.setProperty('--keyboard-height', '0px');
      document.body.classList.remove('keyboard-open');
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

// Remove initial HTML loader container after first paint
requestAnimationFrame(() => {
  const loader = document.getElementById('initial-loader');
  if (loader) loader.remove();
});
