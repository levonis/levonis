const CACHE_NAME = 'levonis-v3';

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
  if (event.request.url.includes('/rest/') || event.request.url.includes('/functions/')) {
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
    icon: '/icons/icon-512.png',
    badge: '/icons/icon-512.png',
    dir: 'rtl',
    lang: 'ar',
    vibrate: [200, 100, 200],
    data: data,
    actions: [
      { action: 'open', title: 'فتح' },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

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
