/* Service worker de @caricas_metalicas
   - Página e caricas.json: rede primeiro (para veres sempre as caricas mais recentes); sem ligação usa a cópia guardada.
   - Fotos das caricas (pasta caricas/): ficam guardadas depois de vistas, até um máximo, para abrirem mais depressa.
   - Ícones e restantes ficheiros do site: cache primeiro.
   - Anúncios, Instagram e outros endereços externos passam direto, sem serem guardados.
   Quando mudares ficheiros da app (index, ícones, manifesto), sobe o número da VERSAO para limpar caches antigas. */
const VERSAO = 'v2';
const CACHE_APP = 'caricas-app-' + VERSAO;
const CACHE_FOTOS = 'caricas-fotos-v1';   // não depende da VERSAO: as fotos mantêm-se entre versões
const MAX_FOTOS = 150;
const FICHEIROS_APP = [
  './', 'index.html', 'manifest.webmanifest', 'caricas.json',
  'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_APP)
      // um ficheiro em falta não deve impedir a instalação
      .then(function (c) { return Promise.all(FICHEIROS_APP.map(function (f) { return c.add(f).catch(function () {}); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (chaves) {
        return Promise.all(chaves
          .filter(function (k) { return k.indexOf('caricas-') === 0 && k !== CACHE_APP && k !== CACHE_FOTOS; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

function limitar(cache, max) {
  return cache.keys().then(function (chaves) {
    if (chaves.length <= max) return null;
    return Promise.all(chaves.slice(0, chaves.length - max).map(function (k) { return cache.delete(k); }));
  });
}

function redePrimeiro(req, chave) {
  return fetch(req).then(function (r) {
    if (r && r.ok) {
      const copia = r.clone();
      caches.open(CACHE_APP).then(function (c) { c.put(chave || req, copia); });
    }
    return r;
  }).catch(function () {
    return caches.match(chave || req).then(function (r) { return r || Response.error(); });
  });
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;           // anúncios, Instagram, etc.: direto

  // Páginas: rede primeiro
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (r) {
        if (r && r.ok) {
          const copia = r.clone();
          caches.open(CACHE_APP).then(function (c) { c.put('index.html', copia); });
        }
        return r;
      }).catch(function () {
        return caches.match('index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  // Lista das caricas: rede primeiro
  if (url.pathname.slice(-12) === 'caricas.json') {
    e.respondWith(redePrimeiro(req));
    return;
  }

  // Fotos das caricas: cache primeiro, com limite
  if (url.pathname.indexOf('/caricas/') !== -1) {
    e.respondWith(
      caches.open(CACHE_FOTOS).then(function (c) {
        return c.match(req).then(function (guardada) {
          if (guardada) return guardada;
          return fetch(req).then(function (r) {
            if (r && r.ok) { c.put(req, r.clone()).then(function () { return limitar(c, MAX_FOTOS); }); }
            return r;
          });
        });
      })
    );
    return;
  }

  // Restantes ficheiros do site: cache primeiro
  e.respondWith(
    caches.match(req).then(function (r) {
      return r || fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE_APP).then(function (c) { c.put(req, copia); });
        }
        return resp;
      });
    })
  );
});
