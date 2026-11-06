/* ---------- CONTINUUM ACADEMY — SERVICE WORKER ---------- */
/* Serves at the project root so its scope covers every page.

   Two rules, chosen because a signed-out visitor must never read a member page
   out of the cache:
     navigation  network first, cache only as an offline fallback
     assets      stale-while-revalidate, so CSS and JS update on the next visit

   Video files are deliberately never cached: they are large, they are served
   with Range requests for seeking, and in production they arrive from a signed
   streaming URL instead of this origin. */

const VERSION = "continuum-v5";

const SHELL = [
  "./",
  "./login/",
  "./signup/",
  "./forgot-password/",
  "./reset-password/",
  "./home/",
  "./explore/",
  "./disciplines/",
  "./discipline/",
  "./library/",
  "./search/",
  "./clips/",
  "./profile/",
  "./admin/",
  "./manifest.webmanifest",
  "./assets/images/icon-192.png",
  "./assets/images/icon-512.png",
  "./assets/images/apple-touch-icon.png",
  "./assets/css/login.css",
  "./assets/css/auth.css",
  "./assets/css/home.css",
  "./assets/css/explore.css",
  "./assets/css/disciplines.css",
  "./assets/css/discipline.css",
  "./assets/css/library.css",
  "./assets/css/search.css",
  "./assets/css/clips.css",
  "./assets/css/admin.css",
  "./assets/css/user-menu.css",
  "./assets/css/theme.css",
  "./assets/js/config.js",
  "./assets/js/auth.js",
  "./assets/js/store.js",
  "./assets/js/theme.js",
  "./assets/js/user-menu.js",
  "./assets/js/data/catalogue.js",
  "./assets/js/content.js",
  "./assets/js/player.js",
  "./assets/js/home.js",
  "./assets/js/explore.js",
  "./assets/js/disciplines.js",
  "./assets/js/discipline.js",
  "./assets/js/library.js",
  "./assets/js/search.js",
  "./assets/js/clips.js",
  "./assets/js/profile.js",
  "./assets/js/login.js",
  "./assets/js/signup.js",
  "./assets/js/forgot-password.js",
  "./assets/js/reset-password.js",
  "./assets/js/admin.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      /* One missing file must not fail the whole install, so addAll is guarded. */
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  /* Range requests power video seeking and cannot be answered from a full cache. */
  if (request.headers.has("range")) return;
  if (url.pathname.indexOf("/assets/videos/") !== -1) return;

  /* Catalogue and library content change with the videos, never with a
     build. Serving a stale copy would show a deleted title, so these two
     data files bypass the worker entirely. catalogue.js and content.js are
     code, not content, and cache like everything else. */
  if (url.pathname.indexOf("/assets/js/data/disciplines.js") !== -1 ||
      url.pathname.indexOf("/assets/js/data/library.js") !== -1) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    /* Offline and never visited: the sign-in screen is the safe landing. */
    return (await cache.match("./login/")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);

  const network = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);

  return cached || (await network) || Response.error();
}
