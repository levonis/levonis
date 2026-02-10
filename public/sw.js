const CACHE_NAME = 'levonis-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy for API calls, cache-first for static assets
  if (event.request.url.includes('/rest/') || event.request.url.includes('/functions/')) {
    return; // Let API calls pass through
  }
});
