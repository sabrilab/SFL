// Service worker de la SFL.
//
// Le nom du cache est VERSIONNÉ : à chaque changement de ce fichier, on
// l'incrémente, et l'activation efface tous les caches qui ne portent pas ce
// nom. C'est la soupape de sécurité — un cache abîmé disparaît au premier
// chargement suivant, sans rien demander à personne.
//
// Règle absolue apprise à nos dépens : ON NE MET JAMAIS EN CACHE UNE RÉPONSE
// QUI N'EST PAS « ok ». La version précédente stockait tout, 404 comprises :
// après un déploiement, un ancien fragment JavaScript disparu était demandé,
// renvoyait 404, ce 404 était mis en cache — et l'appareil restait bloqué sur
// « Quelque chose a cassé » à chaque visite, indéfiniment.

const CACHE_NAME = "sfl-cache-v3";
const OFFLINE_URL = "/offline";

/** Une réponse digne d'être gardée : la nôtre, complète, et sans erreur. */
function cachable(response) {
  return (
    response &&
    response.ok &&
    response.status === 200 &&
    (response.type === "basic" || response.type === "default")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.add(OFFLINE_URL))
      // Un précache raté ne doit pas empêcher l'installation.
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

// L'app peut demander un nettoyage complet (bouton « Réparer l'app »).
self.addEventListener("message", (event) => {
  if (event.data?.type !== "sfl-vider-cache") return;
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Les pages : le réseau d'abord, le cache en secours, la page hors ligne en
  // dernier recours. Seule une vraie page reçue est gardée.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (cachable(response)) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }

  // Les fichiers de build Next portent leur empreinte dans leur nom : ils ne
  // changent jamais de contenu. Le cache d'abord est donc sûr — et si le
  // fichier manque au cache, on va simplement le chercher.
  const immuable = url.pathname.startsWith("/_next/static/");

  const statique = /\.(js|css|png|jpg|jpeg|svg|webp|avif|woff2?|mp4|webm)$/.test(url.pathname);
  if (!immuable && !statique) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const reseau = fetch(request)
          .then((response) => {
            if (cachable(response)) cache.put(request, response.clone());
            return response;
          })
          // Réseau injoignable : on rend ce qu'on avait, sinon on laisse
          // l'erreur remonter — mieux vaut une erreur franche qu'un 404 figé.
          .catch((e) => {
            if (cached) return cached;
            throw e;
          });

        // Immuable : le cache fait autorité. Sinon : on sert le cache et on
        // rafraîchit derrière.
        return cached || reseau;
      })
    )
  );
});
