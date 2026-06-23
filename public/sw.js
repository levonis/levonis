const VERSION = 'v20';
const STATIC_CACHE = `levonis-static-${VERSION}`;
const HTML_CACHE = `levonis-html-${VERSION}`;
const HTML_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour — never serve HTML older than this

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
        .filter((n) => n !== STATIC_CACHE && n !== HTML_CACHE)
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
  if (url.origin !== self.location.origin) return;

  if (url.search.includes('_swkill=1')) return;

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
      // Stash with a custom header so we can enforce TTL on fallback reads
      const cloned = response.clone();
      const headers = new Headers(cloned.headers);
      headers.set('x-levo-cached-at', String(Date.now()));
      const body = await cloned.blob();
      const stamped = new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
      });
      cache.put(request, stamped).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached && isFresh(cached)) return cached;
    const fallback = await cache.match('/');
    if (fallback && isFresh(fallback)) return fallback;
    throw err;
  }
}

function isFresh(response) {
  try {
    const ts = +(response.headers.get('x-levo-cached-at') || 0);
    if (!ts) return false;
    return Date.now() - ts < HTML_MAX_AGE_MS;
  } catch (e) {
    return false;
  }
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
