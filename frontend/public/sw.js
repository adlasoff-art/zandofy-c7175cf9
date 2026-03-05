const CACHE_NAME = "zandofy-v6";
const STATIC_CACHE = "zandofy-static-v6";
const API_CACHE = "zandofy-api-v1";
const IMG_CACHE = "zandofy-images-v1";

const PRECACHE_URLS = ["/", "/index.html", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const API_CACHE_MAX = 50;
const IMG_CACHE_MAX = 100;

// Install — precache shell + offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate — clean old caches immediately
self.addEventListener("activate", (event) => {
  const keepCaches = [STATIC_CACHE, API_CACHE, IMG_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Helper: limit cache size
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    await trimCache(cacheName, maxItems);
  }
}

// Fetch handler
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Skip cross-origin except images
  if (url.origin !== self.location.origin && request.destination !== "image") return;

  // Skip OAuth paths
  if (url.pathname.startsWith("/~oauth")) return;

  // Navigation: stale-while-revalidate — show cached shell instantly, update in background
  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match("/index.html");
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok) cache.put("/index.html", response.clone());
            return response;
          })
          .catch(() => null);

        // Return cached shell immediately if available, otherwise wait for network
        if (cached) {
          // Fire-and-forget update
          networkFetch;
          return cached;
        }
        const networkResponse = await networkFetch;
        return networkResponse || caches.match("/offline.html") || new Response("Offline", { status: 503 });
      })
    );
    return;
  }

  // API calls (Supabase): network-first with cache fallback
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/functions/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(API_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(API_CACHE, API_CACHE_MAX);
            });
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Images: cache-first
  if (request.destination === "image" || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(IMG_CACHE).then((cache) => {
              cache.put(request, clone);
              trimCache(IMG_CACHE, IMG_CACHE_MAX);
            });
          }
          return response;
        }).catch(() => new Response("", { status: 404 }));
      })
    );
    return;
  }

  // Static assets (JS/CSS): stale-while-revalidate
  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Background sync for failed cart/order submissions
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-cart") {
    event.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions() {
  try {
    const cache = await caches.open("zandofy-pending");
    const requests = await cache.keys();
    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const body = await response.json();
        await fetch(request.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        await cache.delete(request);
      }
    }
  } catch (e) {
    console.log("Sync failed, will retry:", e);
  }
}

// Push notification handler
self.addEventListener("push", (event) => {
  let data = { title: "Zandofy", body: "Nouvelle notification", url: "/" };

  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    data: { url: data.url || "/" },
    tag: data.tag || "default",
    renotify: true,
    actions: [
      { action: "open", title: "Voir" },
      { action: "close", title: "Fermer" },
    ],
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  if (event.action === "close") return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
