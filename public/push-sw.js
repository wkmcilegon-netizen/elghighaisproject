/* Service worker khusus notifikasi (web push) — bukan cache app shell. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function buildNotification(event) {
  let title = "Berita baru dari Pusat";
  let body = "Ketuk untuk membaca berita terbaru KAS RT 06/04.";

  try {
    if (event.data) {
      const payload = event.data.json();
      if (payload && payload.title) title = payload.title;
      if (payload && payload.body) body = payload.body;
    } else {
      const res = await fetch("/api/public/latest-news", { cache: "no-store" });
      if (res.ok) {
        const news = await res.json();
        if (news && news.title) {
          title = "Berita: " + news.title;
          body = news.body || body;
        }
      }
    }
  } catch (err) {
    // biarkan teks default
  }

  return self.registration.showNotification(title, {
    body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "berita-rt",
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: { url: "/?tab=berita" },
  });
}

self.addEventListener("push", (event) => {
  event.waitUntil(buildNotification(event));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
