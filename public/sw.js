const CACHE_NAME = 'levonis-v6';
const STATIC_EXTENSIONS = /\.(js|css|woff2?|ttf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i;

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))
      );
    }).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip API calls and non-GET requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.includes('/rest/') || url.pathname.includes('/functions/') || url.pathname.includes('/auth/')) return;
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return;

  // Static assets: cache-first
  if (STATIC_EXTENSIONS.test(url.pathname) || url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => cached);
      })
    );
    return;
  }

  // HTML: network-first with cache fallback
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
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
