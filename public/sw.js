"use strict";
// Mulakhas service worker.
// 1. Share-in: Android's share sheet POSTs voice notes and videos to ./share-target. They go into
//    the "mulakhas-share" inbox and the page reloads; the app moves them into the Thread on start.
// 2. App shell: the page and its assets are kept, so the reload after each share is near-instant
//    and the app opens offline. Only this origin is cached; Groq and Google calls never are.

const SHELL = "mulakhas-shell-v2";
const SCOPE = self.registration.scope;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL)
      .then(cache => cache.addAll([SCOPE, SCOPE + "manifest.webmanifest", SCOPE + "icons/icon-192.png", SCOPE + "icons/icon-512.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== SHELL) await caches.delete(key);
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
  if (request.mode === "navigate") event.respondWith(page(event));
  else if (url.pathname.includes("/assets/")) event.respondWith(cacheFirst(request)); // hashed names never change
  else event.respondWith(staleWhileRevalidate(event, request));
});

async function receiveShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("media").filter(f => f instanceof File);
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open("mulakhas-share", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("files", { autoIncrement: true });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    await new Promise((resolve, reject) => {
      const tx = db.transaction("files", "readwrite");
      const now = Date.now();
      files.forEach((f, i) => tx.objectStore("files").add({ name: f.name, type: f.type, blob: f, t: f.lastModified || now + i }));
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Nothing useful to show from here; the app opens either way.
  }
  return Response.redirect(SCOPE, 303);
}

// The page itself: answer from the cache at once (any query string), refresh it in the background.
async function page(event) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(SCOPE);
  const fresh = fetch(event.request).then(res => {
    if (res.ok) cache.put(SCOPE, res.clone());
    return res;
  }).catch(() => cached ?? Response.error());
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(event, request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  const fresh = fetch(request).then(res => {
    if (res.ok) cache.put(request, res.clone());
    return res;
  }).catch(() => cached ?? Response.error());
  if (cached) {
    event.waitUntil(fresh);
    return cached;
  }
  return fresh;
}
