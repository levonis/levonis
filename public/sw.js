const CACHE_NAME = 'levonis-v9';
const STATIC_EXTENSIONS = /\.(woff2?|ttf|eot|png|jpe?g|gif|svg|webp|avif|ico|mp3|mp4|webm)$/i;
const IS_PREVIEW_HOST =
  self.location.hostname.includes('lovableproject.com') ||
  self.location.hostname.startsWith('id-preview--');

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)));

    // Safety valve: preview hosts should never keep a controlling SW
    if (IS_PREVIEW_HOST) {
      await self.registration.unregister();
    }

    await clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (IS_PREVIEW_HOST) return;

  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.pathname.includes('/rest/') || url.pathname.includes('/functions/') || url.pathname.includes('/auth/')) return;

  // Never cache Vite/dev module paths (prevents stale chunk blank screens)
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.includes('/.vite/')
  ) {
    return;
  }

  const isHtml = request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
  if (isHtml) {
    // Network-first with 5s timeout, fall back to cache so mobile never hangs on a blank screen
    event.respondWith((async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const response = await fetch(request, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      } catch (e) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response('<!doctype html><meta charset="utf-8"><title>LEVONIS</title><body style="background:#103d33;color:#d8c887;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px"><div><p>تعذر الاتصال بالخادم</p><button onclick="location.reload()" style="background:#c7b46c;color:#0b3028;border:0;padding:12px 24px;border-radius:8px;font-weight:700;margin-top:12px">إعادة المحاولة</button></div>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  if (!STATIC_EXTENSIONS.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});

// Push notification handler
self.addEventListener('push', (event) => {
  let data = { title: 'LEVONIS', body: 'لديك إشعار جديد' };

  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    // fallback to default
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: data,
    tag: data.tag || 'levonis-notification',
    renotify: true,
    actions: [
      { action: 'open', title: 'فتح' },
      { action: 'dismiss', title: 'إغلاق' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const url = event.notification.data?.url || '/community/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
