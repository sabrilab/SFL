"use client";

// « Réparer l'app » — la sortie de secours quand un appareil reste bloqué.
//
// Un service worker peut garder en mémoire une version cassée de l'app : un
// fragment JavaScript disparu après un déploiement, une page à moitié
// enregistrée. L'utilisateur, lui, ne voit qu'un écran d'erreur qui revient à
// chaque visite, et vider le cache d'un navigateur mobile n'est à la portée
// de personne.
//
// Cette fonction fait le ménage complet : tous les caches, tous les service
// workers, puis un rechargement propre depuis le réseau. Elle NE TOUCHE PAS
// au localStorage — la session, la saison et les Ballons sont préservés.

export async function reparerApp(): Promise<void> {
  try {
    if ("caches" in window) {
      const noms = await caches.keys();
      await Promise.all(noms.map((n) => caches.delete(n)));
    }
  } catch {
    // Un cache récalcitrant ne doit pas empêcher la suite.
  }

  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    // idem
  }

  // Rechargement depuis la racine : la page en cours est peut-être justement
  // celle qui ne sait plus s'afficher.
  window.location.replace("/");
}
