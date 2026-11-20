// Service worker mínimo: permite instalar la app y abrirla rápido.
// Solo guarda los archivos propios; las llamadas a Google siempre van a la red.
const CACHE = "agenda-voz-v3";
const ARCHIVOS = ["./", "./index.html", "./manifest.webmanifest", "./interprete.js", "./calendario.js", "./config.js", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARCHIVOS)));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  // Red primero (para recibir siempre la última versión), caché si no hay conexión
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copia = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copia));
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});
