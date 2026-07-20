const CACHE_NAME = 'geogive-v5';
const OFFLINE_URL = '/index.html';
var PRECACHE_URLS = [
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/layout.css',
  '/css/components.css',
  '/css/map.css',
  '/js/config.js',
  '/js/utils.js',
  '/js/geo.js',
  '/js/map.js',
  '/js/auth.js',
  '/js/items.js',
  '/js/chats.js',
  '/js/requests.js',
  '/js/images.js',
  '/js/ui.js',
  '/js/profile.js',
  '/js/notifications.js',
  '/js/offline.js',
  '/js/router.js',
  '/js/feed.js',
  '/js/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Skip caching for API/backend endpoints — always fetch fresh
var NO_CACHE_PATTERNS = [
  /supabase\.co/i,
  /firebaseio\.com/i,
  /firebaseapp\.com/i,
  /googleapis\.com/i
];

function shouldSkipCache(url) {
  return NO_CACHE_PATTERNS.some(function(pattern) { return pattern.test(url); });
}

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_URLS).catch(function(err) {
        console.warn('SW: Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// ===== WEB PUSH API (M16) =====
self.addEventListener('push', function(event) {
  var data = { title: 'GeoGive', body: 'You have a new notification', icon: '/geogive/icon-192.png', badge: '/geogive/icon-192.png', tag: 'geogive-notification' };
  try {
    if (event.data) {
      var payload = event.data.json();
      data.title = payload.title || data.title;
      data.body = payload.body || data.body;
      data.url = payload.url || '/geogive/';
      data.tag = payload.tag || data.tag;
    }
  } catch(e) {
    data.body = event.data ? event.data.text() : data.body;
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: { url: data.url },
      actions: [{ action: 'open', title: 'Open' }, { action: 'dismiss', title: 'Dismiss' }]
    })
  );
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/geogive/';
  if (event.action === 'dismiss') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf('/geogive/') !== -1 && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ===== BACKGROUND SYNC (M34) =====
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});

function syncChatMessages() {
  // Client will handle replay on next sync trigger via postMessage
  return clients.matchAll().then(function(clientList) {
    clientList.forEach(function(client) {
      client.postMessage({ type: 'SYNC_CHAT_MESSAGES' });
    });
  });
}

self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;

  // Never cache API/backend requests — always go network-only
  if (shouldSkipCache(event.request.url)) {
    event.respondWith(
      fetch(event.request).catch(function() {
        return new Response(JSON.stringify({ error: 'Offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Network-first for HTML, cache-first for assets
  if (event.request.destination === 'document') {
    event.respondWith(
      fetch(event.request).catch(function() {
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match(OFFLINE_URL);
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for CSS/JS/images (M35)
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      var fetchPromise = fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) { cache.put(event.request, clone); });
        }
        return response;
      }).catch(function() { return cached; });
      return cached || fetchPromise;
    })
  );
});
