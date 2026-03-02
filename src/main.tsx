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

if (window.Telegram?.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  try {
    tg.setHeaderColor?.('#09090b');
    tg.setBackgroundColor?.('#09090b');
  } catch {}
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
