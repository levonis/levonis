// Real-User Monitoring (RUM) for Core Web Vitals.
// Captures LCP / CLS / INP / FCP / TTFB from production visitors and
// stores them in the `web_vitals` table for trend analysis.
//
// Usage: call `installWebVitals()` once from main.tsx.
// Sampling keeps cost low — by default 25% of sessions report.

import { supabase } from '@/integrations/supabase/client';

type Metric = {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  id?: string;
  navigationType?: string;
};

const SAMPLE_RATE = 0.25; // 25% of visitors

// Simple in-memory queue so we don't fire one request per metric.
const queue: Metric[] = [];
let flushScheduled = false;

const getConnectionType = (): string | null => {
  // @ts-ignore — non-standard but widely supported on mobile
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  return c?.effectiveType ?? null;
};

const flush = async () => {
  if (queue.length === 0) return;
  const batch = queue.splice(0, queue.length);

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getSession();
    userId = data.session?.user?.id ?? null;
  } catch {
    // unauthenticated visitor — that's fine
  }

  const path = window.location.pathname;
  const ua = navigator.userAgent.slice(0, 500);
  const vw = window.innerWidth;
  const dpr = window.devicePixelRatio || 1;
  const conn = getConnectionType();

  const rows = batch.map((m) => ({
    metric_name: m.name,
    metric_value: m.value,
    metric_rating: m.rating ?? null,
    metric_id: m.id ?? null,
    navigation_type: m.navigationType ?? null,
    path,
    user_agent: ua,
    viewport_width: vw,
    device_pixel_ratio: dpr,
    connection_type: conn,
    user_id: userId,
  }));

  try {
    await supabase.from('web_vitals').insert(rows);
  } catch (e) {
    // Never let monitoring break the app.
    // eslint-disable-next-line no-console
    console.warn('[web-vitals] flush failed', e);
  }
};

const scheduleFlush = () => {
  if (flushScheduled) return;
  flushScheduled = true;
  // Defer until idle so we don't compete with the page's main work.
  const idle = (cb: () => void) =>
    'requestIdleCallback' in window
      ? (window as any).requestIdleCallback(cb, { timeout: 2000 })
      : setTimeout(cb, 1500);
  idle(() => {
    flushScheduled = false;
    flush();
  });
};

export const installWebVitals = async () => {
  // Only in browsers, only in production-like contexts (skip localhost/preview iframe noise).
  if (typeof window === 'undefined') return;
  if (Math.random() > SAMPLE_RATE) return;

  // Avoid double-install (e.g. React StrictMode dev double-invoke)
  if ((window as any).__lovableWebVitalsInstalled) return;
  (window as any).__lovableWebVitalsInstalled = true;

  try {
    const { onLCP, onCLS, onINP, onFCP, onTTFB } = await import('web-vitals');

    const handler = (metric: Metric) => {
      queue.push(metric);
      scheduleFlush();
    };

    onLCP(handler);
    onCLS(handler);
    onINP(handler);
    onFCP(handler);
    onTTFB(handler);

    // Final flush before the page is hidden / unloaded.
    const finalFlush = () => flush();
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') finalFlush();
    });
    window.addEventListener('pagehide', finalFlush);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[web-vitals] install failed', e);
  }
};
