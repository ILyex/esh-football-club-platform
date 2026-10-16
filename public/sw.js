/* ESH match push notifications. This worker intentionally avoids caching or
 * intercepting requests so it cannot change the website's loading behavior. */
self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let message = {};
    try {
      message = event.data ? event.data.json() : {};
    } catch {
      message = { body: event.data?.text() || "" };
    }
    const isArabic = message.url?.startsWith("/ar/");
    const title = typeof message.title === "string" ? message.title : "ESH · Match";
    const options = {
      body: typeof message.body === "string" ? message.body : "",
      icon: "/branding/esh-logo-128.png",
      badge: "/branding/esh-logo-32.png",
      tag: typeof message.tag === "string" ? message.tag : undefined,
      renotify: false,
      dir: isArabic ? "rtl" : "ltr",
      vibrate: [100, 50, 100],
      data: { url: typeof message.url === "string" ? message.url : "/ar/matches" }
    };
    await self.registration.showNotification(title, options);
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const requested = new URL(event.notification.data?.url || "/ar/matches", self.location.origin);
    const target = requested.origin === self.location.origin ? requested : new URL("/ar/matches", self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin === self.location.origin && "focus" in client) {
        await client.navigate(target.href);
        return client.focus();
      }
    }
    return self.clients.openWindow(target.href);
  })());
});
