"use strict";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => {
      try {
        const fd = await e.request.formData();
        const files = fd.getAll("media");
        const db = await new Promise((res, rej) => {
          const q = indexedDB.open("mulakhas-share", 1);
          q.onupgradeneeded = () => q.result.createObjectStore("files", { autoIncrement: true });
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
        const tx = db.transaction("files", "readwrite");
        for (const f of files) tx.objectStore("files").add({ name: f.name, type: f.type, blob: f, t: Date.now() });
        await new Promise(res => { tx.oncomplete = res; });
      } catch {}
      return Response.redirect("./?shared=1", 303);
    })());
  }
});
