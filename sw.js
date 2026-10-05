// Permite abrir la página sin conexión: guarda una copia de los archivos propios.
// Siempre intenta primero la versión nueva de internet y, si no hay conexión, usa la copia.
// Los datos de la planilla no pasan por acá (los guarda la página en el dispositivo).
const CACHE = "revision-agua-uy-v31";
const ARCHIVOS = ["./", "index.html", "config.js", "app.js", "importar.js", "autocompletar.js", "prisma.js", "prioridad.js", "estudios.js", "extras.js", "cadenas.js", "buscador.js", "herramientas.js",
  "manifest.webmanifest", "img/logo-128.png", "img/logo-192.png", "img/apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request).then(r => {
      const copia = r.clone();
      caches.open(CACHE).then(c => c.put(e.request, copia));
      return r;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
