// Service Worker for Web Push notifications + App Badging.
// Activated as soon as installed so badge updates work even on first run.
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Receive push payload from server and surface it as a system notification.
self.addEventListener("push", (event) => {
  let data = { title: "Zandofy", body: "Nouvelle notification", url: "/dashboard" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const tag = data.tag || `zandofy-${Date.now()}`;
  const options = {
    body: data.body,
    icon: data.icon || "/icon-192x192.png",
    badge: data.badge || "/icon-192x192.png",
    vibrate: [120, 60, 120],
    tag,
    renotify: true,
    requireInteraction: data.requireInteraction === true,
    silent: false,
    data: { url: data.url || "/dashboard" },
    actions: [{ action: "open", title: "Voir" }],
  };

  const tasks = [self.registration.showNotification(data.title, options)];

  // Update app badge (PWA icon dot).
  if (typeof self.navigator !== "undefined" && "setAppBadge" in self.navigator) {
    try {
      const next =
        typeof data.unreadCount === "number" && data.unreadCount >= 0
          ? data.unreadCount
          : undefined;
      tasks.push(
        next === undefined
          ? self.navigator.setAppBadge()
          : self.navigator.setAppBadge(next),
      );
    } catch (_) {
      // ignore
    }
  }

  // Tell open clients to refresh their unread count and badge.
  tasks.push(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => {
        list.forEach((c) => {
          try {
            c.postMessage({ type: "ZANDOFY_PUSH_RECEIVED", payload: data });
          } catch (_) {
            // ignore
          }
        });
      }),
  );

  event.waitUntil(Promise.all(tasks));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })(),
  );
});

// Allow the app to push badge updates from the foreground.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "ZANDOFY_SET_BADGE") {
    if ("setAppBadge" in self.navigator) {
      try {
        if (typeof msg.count === "number" && msg.count > 0) {
          self.navigator.setAppBadge(msg.count);
        } else {
          self.navigator.clearAppBadge?.();
        }
      } catch (_) {
        // ignore
      }
    }
  }
});
