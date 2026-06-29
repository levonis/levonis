// Main entry point - v7 (PWA + Telegram Mini App support)
import { StrictMode } from 'react';
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installFriendlyFunctionErrorMessages } from "@/lib/functionErrors";

installFriendlyFunctionErrorMessages();

// Stale chunk recovery — after a new deploy, the old HTML still references
// JS chunks that no longer exist on the CDN. Detect that specific failure
// and reload once (guarded against loops).
const isStaleChunkError = (msg: string) =>
  /Importing a module script failed|Failed to fetch dynamically imported module|Loading chunk \d+ failed|ChunkLoadError|error loading dynamically imported module/i.test(msg);

const recoverFromStaleChunk = async () => {
  try {
    if (sessionStorage.getItem('__levo_chunk_reload_v1') === '1') return;
    sessionStorage.setItem('__levo_chunk_reload_v1', '1');
  } catch {}
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {}
  window.location.reload();
};

if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    const msg = e?.message || (e?.error && String(e.error?.message || e.error)) || '';
    if (isStaleChunkError(msg)) recoverFromStaleChunk();
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e as any)?.reason?.message || (e as any)?.reason || '');
    if (isStaleChunkError(msg)) recoverFromStaleChunk();
  });
  // Clear the guard after a successful first paint so future deploys can recover again.
  window.addEventListener('load', () => {
    setTimeout(() => {
      try { sessionStorage.removeItem('__levo_chunk_reload_v1'); } catch {}
    }, 4000);
  });
}

// Defer non-critical perf instrumentation until the browser is idle so it
// never competes with first paint on slow devices.
const idle = (cb: () => void) => {
  const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, opts?: any) => number);
  if (ric) ric(cb, { timeout: 2000 });
  else setTimeout(cb, 1500);
};
idle(() => {
  import("@/lib/scrollPerformance").then((m) => m.installScrollPerformance()).catch(() => {});
});

// Old app-shell Service Worker cleanup. Do not register a new app-shell SW:
// returning Android Chrome visitors were seeing stale cached screens during
// startup. The same-path public/sw.js now clears old LEVONIS caches once, then
// unregisters itself.
if ('serviceWorker' in navigator && typeof window !== 'undefined') {
  idle(async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {}
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.filter((name) => /^levonis-/.test(name)).map((name) => caches.delete(name)));
      }
    } catch {}
  });
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

// Capacitor: initialize native platform UI — deferred to idle so the web
// path never pays for downloading @capacitor/core during first paint.
idle(() => { import('@capacitor/core').then(({ Capacitor }) => {
  if (!Capacitor.isNativePlatform()) return;
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

    // Deep link handler — receives Android App Links such as
    // https://levonisiq.com/~oauth?code=... after Google sign-in. We close the
    // in-app system browser and route the WebView to /~oauth so the lovable
    // OAuth broker can complete the token exchange.
    App.addListener('appUrlOpen', async (event: { url: string }) => {
      try {
        const url = new URL(event.url);
        // Try to dismiss the OAuth browser tab (no-op if not opened).
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch {}
        // Navigate the in-app WebView to the path+query+hash. SPA router will
        // pick it up; /~oauth specifically is excluded from SW caching.
        const target = `${url.pathname}${url.search}${url.hash}` || '/';
        window.history.replaceState({}, '', target);
        window.dispatchEvent(new PopStateEvent('popstate'));
      } catch {}
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
}).catch(() => {}); });

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

import { HelmetProvider } from 'react-helmet-async';

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Signal mount IMMEDIATELY (synchronously) to clear the safety-net timers
// so slow phones don't trigger a false-positive cache wipe before first paint.
try {
  window.dispatchEvent(new Event('levo:mounted'));
  sessionStorage.removeItem('__levo_auto_recovered');
  localStorage.removeItem('__levo_recovery_attempts');
} catch {}

