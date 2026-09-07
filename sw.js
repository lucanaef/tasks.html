"use strict";

// The list lives in a file on disk, so the network is only ever needed for the page
// itself. Holding the page in a cache is what lets the app window open with no
// network at all, and open at once when there is one.

// Bumping this empties the old cache on the next launch. Forgetting to is survivable:
// every response below is refreshed in the background as it is served.
const VERSION = "tasks-v1";

const SHELL = [
  "./",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION)
    .then(cache => cache.addAll(SHELL))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n !== VERSION).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Answer from the cache and refresh it behind the answer, so a launch never waits on
// the network and a deploy lands on the launch after the one that fetched it.
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    // A window opened at index.html asks for a URL the shell was not cached under.
    const held = await cache.match(req, { ignoreSearch: true })
      || (req.mode === "navigate" ? await cache.match("./") : null);
    const fresh = fetch(req)
      .then(res => { if (res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);
    return held || await fresh || Response.error();
  })());
});
