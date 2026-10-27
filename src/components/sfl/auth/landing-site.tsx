"use client";

// La page d'accueil de getbola.app pour un visiteur sans compte : le site de
// la marque (sabrilab/bola-site, le ballon puis la carte qui monte), posé
// plein écran dans un cadre. Ses boutons « Se connecter » et « Créer ma
// carte » ouvrent l'app dans la page entière (/connexion, /inscription).
//
// Un cadre plutôt qu'une réécriture d'adresse (27/10, Sabri : « que ça ne
// devienne pas une charge pour l'app ») : le site ne se charge que pour un
// visiteur sans session, à l'adresse « / », hors de l'app installée
// (AuthGate) ; un joueur connecté n'en télécharge pas un octet, et le site,
// sur son origine à lui, ne lit jamais la session de l'app.

/** Le site de la marque ; une préversion peut en viser une autre. */
const SITE = (process.env.NEXT_PUBLIC_SITE_BOLA || "https://bola-site.vercel.app").replace(/\/+$/, "");

export function LandingSite() {
  // L'app dit au site où renvoyer ses boutons (getbola.app, sfl-eight, une préversion).
  const src = `${SITE}/?app=${encodeURIComponent(window.location.origin)}`;
  return (
    <iframe
      src={src}
      title="Bola"
      allow="fullscreen"
      className="fixed inset-0 z-[60] h-dvh w-full border-0 bg-white"
    />
  );
}
