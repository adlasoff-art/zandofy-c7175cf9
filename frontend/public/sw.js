const CACHE_NAME = "zandofy-v8";
const STATIC_CACHE = "zandofy-static-v8";
const API_CACHE = "zandofy-api-v2";
const IMG_CACHE = "zandofy-images-v2";
const CATALOG_CACHE = "zandofy-catalog-v1";

const PRECACHE_URLS = ["/", "/index.html", "/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"];
const API_CACHE_MAX = 50;
const IMG_CACHE_MAX = 100;

// Install — precache shell + offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Do NOT call self.skipWaiting() here — let the app prompt the user first
});

// Activate — clean old caches immediately
self.addEventListener("activate", (event) => {
  const keepCaches = [STATIC_CACHE, API_CACHE, IMG_CACHE, CATALOG_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !keepCaches.includes(k)).map((k) => caches.delete(k)))
    ).then(() => cacheTopProducts())
  );
  self.clients.claim();
});

// Cache top products for offline catalog
async function cacheTopProducts() {
  try {
    // Dynamically determine Supabase URL from env or fallback
    const supabaseUrl = "https://uogkklwfvwoxkifpkzpu.supabase.co";
    const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvZ2trbHdmdndveGtpZnBrenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODY0MzcsImV4cCI6MjA4NzQ2MjQzN30.9NhIOytfsQ7Gdufs0goV6Lk97IyMkda362jh3IGMVi4";

    const url = `${supabaseUrl}/rest/v1/products_public?select=id,name,name_fr,price,rating,product_images(image_url)&publish_status=eq.published&order=rating.desc.nullslast&limit=50`;
    const response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });

    if (response.ok) {
      const cache = await caches.open(CATALOG_CACHE);
      await cache.put("offline-catalog", response.clone());

      // Cache product images
      const products = await response.json();
      const imgCache = await caches.open(IMG_CACHE);
      for (const p of products) {
        const imgUrl = p.product_images?.[0]?.image_url;
        if (imgUrl) {
          try {
            const imgRes = await fetch(imgUrl);
            if (imgRes.ok) await imgCache.put(new Request(imgUrl), imgRes);
          } catch {}
        }
      }
    }
  } catch {}
}

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

  // Navigation: NETWORK-FIRST with cache fallback
  // This prevents stale HTML from being served after deployments
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put("/index.html", clone));
          }
          return response;
        })
        .catch(() =>
          caches.open(STATIC_CACHE).then((cache) =>
            cache.match("/index.html")
          ).then((cached) =>
            cached || caches.match("/offline.html") || new Response("Offline", { status: 503 })
          )
        )
    );
    return;
  }

  // API calls (Supabase): network-first with cache fallback
  // Skip caching API calls with auth tokens to avoid stale user data
  if (url.hostname.includes("supabase") || url.pathname.startsWith("/rest/") || url.pathname.startsWith("/functions/")) {
    const hasAuth = request.headers.get("authorization") || request.headers.get("apikey");
    // Only cache unauthenticated public API requests
    if (hasAuth) {
      // Network-only for authenticated requests
      event.respondWith(fetch(request));
      return;
    }
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
    // Sync failed, will retry on next sync event
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

// Listen for messages from the app to trigger cache clearing
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CLEAR_CACHES") {
    caches.keys().then((names) => names.forEach((n) => caches.delete(n)));
  }
  if (event.data && event.data.type === "GET_OFFLINE_CATALOG") {
    caches.open("zandofy-catalog-v1").then((cache) =>
      cache.match("offline-catalog").then((response) => {
        if (response) {
          response.json().then((data) => {
            event.source.postMessage({ type: "OFFLINE_CATALOG", products: data });
          });
        }
      })
    );
  }
  if (event.data && event.data.type === "REFRESH_CATALOG") {
    cacheTopProducts();
  }
});
