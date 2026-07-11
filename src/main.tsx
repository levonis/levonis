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
  if (typeof document !== 'undefined' && document.hidden) return;
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
    if (isStaleChunkError(msg)) {
      if (document.hidden) return;
      recoverFromStaleChunk();
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    const msg = String((e as any)?.reason?.message || (e as any)?.reason || '');
    if (isStaleChunkError(msg)) {
      if (document.hidden) return;
      recoverFromStaleChunk();
    }
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

// Native (Capacitor) initialization removed — web-only build.

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

