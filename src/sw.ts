/// <reference lib="webworker" />

import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, StaleWhileRevalidate } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

declare global {
  interface ServiceWorkerGlobalScope {
    __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
  }
}

precacheAndRoute(self.__WB_MANIFEST);

self.skipWaiting();
clientsClaim();

// Airline logos served from gstatic: cache-first, they rarely change.
registerRoute(
  ({ url }) => url.href.startsWith("https://www.gstatic.com/flights/"),
  new CacheFirst({
    cacheName: "airline-logos",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 60,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
    ],
  })
);

// Same-origin static images: stale-while-revalidate.
// API responses are intentionally NOT cached (IndexedDB is the source of truth).
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin && request.destination === "image",
  new StaleWhileRevalidate({
    cacheName: "static-images",
  })
);

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/#/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          return;
        }
      }

      await self.clients.openWindow(url);
    })()
  );
});
