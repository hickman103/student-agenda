// Offline support. Everything is network-first, so a pushed update (new
// announcement, calendar fix, app change) reaches students on their next
// open; the cache only answers when the device is offline.

const CACHE = "student-agenda-v1";
const SHELL = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "data/config.js",
  "data/calendar.js",
  "data/announcements.json",
  "manifest.webmanifest",
  "icons/icon.svg",
  "icons/bomber-bob.png",
  "icons/icon-192.png",
  "icons/icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;

  e.respondWith(
    fetch(e.request, { cache: "no-cache" })
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
