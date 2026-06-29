// One-release cleanup worker.
// The old app-shell cache caused returning Android Chrome visitors to briefly
// see stale screens/colors. Keep this file at the same /sw.js path so browsers
// that already installed it receive the replacement, clear LEVONIS caches, then
// unregister. Push/browser notifications fall back to the page code.
function isLevonisAppCache(name) {
  return /^levonis-(static|html|img)-/.test(name) ||
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
}

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const names = await caches.keys();
      await Promise.allSettled(names.filter(isLevonisAppCache).map((name) => caches.delete(name)));
      await clients.claim();
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
    } finally {
      await self.registration.unregister();
    }
  })());
});

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
