/* ---------- CONTINUUM ACADEMY — SERVICE WORKER ---------- */
/* Serves at the project root so its scope covers every page.

   Two rules, chosen because a signed-out visitor must never read a member page
   out of the cache:
     navigation  network first, cache only as an offline fallback
     assets      stale-while-revalidate, so CSS and JS update on the next visit

   Video files are deliberately never cached: they are large, they are served
   with Range requests for seeking, and in production they arrive from a signed
   streaming URL instead of this origin. */

const VERSION = "continuum-v10";

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
  "./assets/css/pages/login.css",
  "./assets/css/base/auth.css",
  "./assets/css/pages/home.css",
  "./assets/css/pages/explore.css",
  "./assets/css/pages/disciplines.css",
  "./assets/css/pages/discipline.css",
  "./assets/css/pages/library.css",
  "./assets/css/pages/search.css",
  "./assets/css/pages/clips.css",
  "./assets/css/pages/admin.css",
  "./assets/css/components/user-menu.css",
  "./assets/css/base/theme.css",
  "./assets/js/core/config.js",
  "./assets/js/core/mobile.js",
  "./assets/js/core/auth.js",
  "./assets/js/core/store.js",
  "./assets/js/core/theme.js",
  "./assets/js/core/user-menu.js",
  "./assets/js/data/catalogue.js",
  "./assets/js/core/content.js",
  "./assets/js/core/player.js",
  "./assets/js/pages/home.js",
  "./assets/js/pages/explore.js",
  "./assets/js/pages/disciplines.js",
  "./assets/js/pages/discipline.js",
  "./assets/js/pages/library.js",
  "./assets/js/pages/search.js",
  "./assets/js/pages/clips.js",
  "./assets/js/pages/profile.js",
  "./assets/js/auth/login.js",
  "./assets/js/auth/signup.js",
  "./assets/js/auth/forgot-password.js",
  "./assets/js/auth/reset-password.js",
  "./assets/js/pages/admin.js"
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
