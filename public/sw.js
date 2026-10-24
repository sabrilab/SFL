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

const CACHE_NAME = "sfl-cache-v8";
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

// L'app peut demander un nettoyage complet (bouton « Réparer l'app »), ou,
// juste avant de se recharger sur une nouvelle version (`mise-a-jour.tsx`),
// l'oubli des fichiers gardés : les photos et vidéos du dossier public n'ont
// pas d'empreinte dans leur nom, une nouvelle version peut les avoir changés.
// La page hors ligne est remise aussitôt.
self.addEventListener("message", (event) => {
  if (event.data?.type === "sfl-vider-cache") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))));
  } else if (event.data?.type === "sfl-nouvelle-version") {
    event.waitUntil(
      caches
        .delete(CACHE_NAME)
        .then(() => caches.open(CACHE_NAME))
        .then((cache) => cache.add(OFFLINE_URL))
        .catch(() => {})
        // La page attend cette réponse pour se recharger.
        .then(() => event.ports[0]?.postMessage("ok"))
    );
  }
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

// Les notifications (web push, voir lib/server/web-push.ts) : le message
// arrive chiffré, le navigateur le déchiffre et nous le passe en JSON
// { titre, texte, url, tag?, pastille?, id? }. Au toucher, on ramène l'app au premier plan sur la
// bonne page, ou on l'ouvre.
//
// `id` est la trace de la notification (push_envois) : on dit au serveur
// qu'elle est arrivée, puis qu'elle a été touchée (/api/push/suivi), pour la
// page Activité de l'admin. Ce signal part après l'affichage et ne le
// retarde jamais ; perdu, il ne coûte rien.
function signaler(id, quoi) {
  if (typeof id !== "string") return Promise.resolve();
  return fetch("/api/push/suivi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, quoi }),
    keepalive: true,
  }).catch(() => {});
}

self.addEventListener("push", (event) => {
  let n = {};
  try {
    n = event.data ? event.data.json() : {};
  } catch {}
  // La pastille rouge sur l'icône de l'app (iOS 16.4+, Android) : le nombre
  // de messages non lus que le serveur a compté pour ce joueur.
  const pastille =
    typeof n.pastille === "number" && n.pastille > 0 && self.navigator.setAppBadge
      ? self.navigator.setAppBadge(Math.min(n.pastille, 99)).catch(() => {})
      : Promise.resolve();
  // Ses réponses (une invitation d'équipe : Oui, Non), en boutons là où le
  // téléphone sait les montrer ; chacune garde sa page de l'app.
  const actions = Array.isArray(n.actions)
    ? n.actions
        .filter((a) => a && typeof a.action === "string" && typeof a.titre === "string" && typeof a.url === "string" && a.url.startsWith("/"))
        .slice(0, 2)
    : [];
  // Même étiquette : l'ancienne s'efface d'abord. Le téléphone qui ne sait
  // pas remplacer par l'étiquette seule (l'iPhone) garde ainsi une seule
  // notification du Vestiaire, qui compte les messages (Sabri, 24/10).
  const avant =
    typeof n.tag === "string" && self.registration.getNotifications
      ? self.registration
          .getNotifications({ tag: n.tag })
          .then((vieilles) => vieilles.forEach((v) => v.close()))
          .catch(() => {})
      : Promise.resolve();
  event.waitUntil(
    Promise.all([pastille, avant])
      .then(() => self.registration.showNotification(n.titre || "Bola", {
        body: n.texte || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: {
          url: typeof n.url === "string" && n.url.startsWith("/") ? n.url : "/",
          id: typeof n.id === "string" ? n.id : null,
          actions: Object.fromEntries(actions.map((a) => [a.action, a.url])),
        },
        ...(actions.length > 0 ? { actions: actions.map((a) => ({ action: a.action, title: a.titre })) } : {}),
        // Même étiquette (le Vestiaire) : la nouvelle remplace l'ancienne au
        // lieu de s'empiler, et le téléphone sonne quand même.
        ...(typeof n.tag === "string" ? { tag: n.tag, renotify: true } : {}),
      }))
      .then(() => signaler(n.id, "recue"))
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // Seulement une page de l'app : un lien qui mènerait ailleurs ouvre l'accueil.
  // Un bouton touché (Oui, Non) ouvre la sienne.
  const parAction = event.action && event.notification.data?.actions?.[event.action];
  const cible = new URL(parAction || event.notification.data?.url || "/", self.location.origin);
  const url = cible.origin === self.location.origin ? cible.href : new URL("/", self.location.origin).href;
  event.waitUntil(
    Promise.all([
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((fenetres) => {
        for (const f of fenetres) {
          if ("focus" in f) return f.navigate(url).then((g) => (g || f).focus());
        }
        return self.clients.openWindow(url);
      }),
      signaler(event.notification.data?.id, "ouverte"),
    ])
  );
});
