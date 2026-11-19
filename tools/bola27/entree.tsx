// Bola 27 (bola-app#33) : le point d'entrée du jeu seul, le site statique de bola27.vercel.app.
//
// Sabri, 18/11/2026 : « Est-ce que tu peux aussi publier l'adresse du jeu sur Vercel ? Bola27 ». Une adresse qu'on ouvre
// sans compte Vercel ni compte Bola, pour montrer le jeu : rien de l'app autour, ni Supabase, ni connexion, ni données
// ou photo d'un vrai joueur.
//
// On ne recopie pas la page du jeu : on monte LA page de l'app, src/app/jouer/page.tsx, telle qu'elle est. Ce que
// cette page emprunte à l'app (le joueur connecté, ses photos, le bouton de retour vers la Map, le lien du studio
// réservé aux admins) est remplacé à la construction par les modules de ./remplacants/ (tools/bola27/construire.mjs,
// qui refuse de construire si la page se met à importer autre chose de l'app). Ainsi, chaque passe sur le jeu
// (bola-app#32 et suivantes) arrive ici sans rien toucher : on reconstruit, c'est tout.
//
// La page s'ouvre donc comme /jouer dans l'app : le plateau, « Jouer » (et l'écran Manettes dès qu'une manette est
// vue). La même page est servie à / et à /jouer.
import { createRoot } from "react-dom/client";
import JouerPage from "@/app/jouer/page";

const racine = document.getElementById("bola27");
if (racine) createRoot(racine).render(<JouerPage />);
