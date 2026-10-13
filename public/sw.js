"use strict";
// Mulakhas service worker.
// 1. Share-in: Android's share sheet POSTs voice notes and videos to ./share-target. They go into
//    the "mulakhas-share" inbox (read by src/engine/share-inbox.ts) and the page reloads; the app
//    moves them into the Thread on start.
// 2. App shell: the page, its script and styles are kept, so the reload after each share is
//    near-instant. Only this origin is cached; Groq and Google calls never are.

// Filled in by the build (vite.config.ts): a name unique to the build, and its script and styles.
const BUILD = { version: "dev", files: [] };

const SHELL_CACHE = "mulakhas-shell-" + BUILD.version;
const SCOPE = self.registration.scope;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // One by one, and never failing the install: without this worker, a share would go nowhere.
    const shell = [SCOPE, SCOPE + "theme.js", SCOPE + "manifest.webmanifest", SCOPE + "icons/icon-192.png", SCOPE + "icons/icon-512.png"];
    await Promise.allSettled([...shell, ...BUILD.files.map(f => SCOPE + f)].map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    // Earlier builds' files go, so old versions don't pile up.
    for (const key of await caches.keys()) if (key !== SHELL_CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(receiveShare(request));
    return;
  }
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Every visit to the page, whatever its query string, is the one cached page.
  if (request.mode === "navigate") event.respondWith(staleWhileRevalidate(event, request, SCOPE));
  else if (url.pathname.includes("/assets/")) event.respondWith(cacheFirst(request)); // hashed names never change
  else event.respondWith(staleWhileRevalidate(event, request, request));
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("media").filter(f => typeof f !== "string");
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("mulakhas-share", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("files", { autoIncrement: true });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      const now = Date.now();
      files.forEach((f, i) => tx.objectStore("files").add({ name: f.name, type: f.type, blob: f, lastModified: f.lastModified || now + i }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // The app opens either way, and tells the person this share didn't come through.
    return Response.redirect(SCOPE + "?share-failed", 303);
  }
  return Response.redirect(SCOPE, 303);
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

// Answers from the cache at once and refreshes it in the background; the network only when nothing is cached.
async function staleWhileRevalidate(event, request, cacheKey) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(cacheKey);
  const fresh = fetch(request).then(res => {
    if (res.ok) cache.put(cacheKey, res.clone());
    return res;
  }).catch(() => cached ?? Response.error());
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}
