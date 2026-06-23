const VERSION = 'v20';
const STATIC_CACHE = `levonis-static-${VERSION}`;
const HTML_CACHE = `levonis-html-${VERSION}`;
const IMG_CACHE = `levonis-img-${VERSION}`;
const IMG_CACHE_MAX = 220;

const STATIC_EXTENSIONS = /\.(woff2?|ttf|eot|png|jpe?g|gif|svg|webp|avif|ico|mp3|mp4|webm)$/i;
const HASHED_ASSET_PATH = /^\/assets\/.+\.(js|css)$/i;

const IS_PREVIEW_HOST =
  self.location.hostname.includes('lovableproject.com') ||
  self.location.hostname.startsWith('id-preview--') ||
  (self.location.hostname.includes('lovable.app') && !self.location.hostname.includes('levonis.lovable.app'));

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((n) => n !== STATIC_CACHE && n !== HTML_CACHE && n !== IMG_CACHE)
        .map((n) => caches.delete(n))
    );
    if (IS_PREVIEW_HOST) {
      await self.registration.unregister();
    }
    await clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
  if (event.data === 'KILL_SW') {
    event.waitUntil((async () => {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
      await self.registration.unregister();
    })());
  }
});

self.addEventListener('fetch', (event) => {
  if (IS_PREVIEW_HOST) return;

  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;
  if (url.search.includes('_swkill=1')) return;

  // Stale-while-revalidate for Supabase transformed images (cross-origin).
  // Huge win on repeat visits: home page reuses cached thumbnails instantly
  // while a background fetch refreshes them.
  if (
    url.origin !== self.location.origin &&
    url.hostname.endsWith('.supabase.co') &&
    (url.pathname.includes('/storage/v1/render/image/public/') ||
     url.pathname.includes('/storage/v1/object/public/'))
  ) {
    event.respondWith(staleWhileRevalidateImage(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  if (
    url.pathname.includes('/rest/') ||
    url.pathname.includes('/functions/') ||
    url.pathname.includes('/auth/') ||
    url.pathname.includes('/storage/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/node_modules/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.includes('/.vite/')
  ) {
    return;
  }

  const isHtml =
    request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    event.respondWith(networkFirstHtml(request));
    return;
  }

  if (HASHED_ASSET_PATH.test(url.pathname) || STATIC_EXTENSIONS.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok && (response.type === 'basic' || response.type === 'default')) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

async function networkFirstHtml(request) {
  const cache = await caches.open(HTML_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const fallback = await cache.match('/');
    if (fallback) return fallback;
    throw err;
  }
}

async function staleWhileRevalidateImage(request) {
  const cache = await caches.open(IMG_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === 'opaque')) {
        cache.put(request, response.clone()).then(() => trimCache(IMG_CACHE, IMG_CACHE_MAX)).catch(() => {});
      }
      return response;
    })
    .catch(() => null);
  if (cached) {
    // Refresh in the background; serve cached immediately.
    networkPromise.catch(() => {});
    return cached;
  }
  const fresh = await networkPromise;
  if (fresh) return fresh;
  return new Response('', { status: 504 });
}

async function trimCache(name, max) {
  try {
    const cache = await caches.open(name);
    const keys = await cache.keys();
    if (keys.length <= max) return;
    const excess = keys.length - max;
    for (let i = 0; i < excess; i++) {
      await cache.delete(keys[i]);
    }
  } catch {}
}

self.addEventListener('push', (event) => {
  let data = { title: 'LEVONIS', body: 'لديك إشعار جديد' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {}

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png?v=levo-20260428',
    badge: '/icons/icon-192.png?v=levo-20260428',
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

  event.waitUntil(self.registration.showNotification(data.title, options));
});

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
