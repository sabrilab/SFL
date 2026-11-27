// La page publique getbola.app/club : Bola Club présenté aux clubs amateurs,
// le point d'arrivée de la campagne de mails (27/11/2026). Ouverte à tous
// (AuthGate, lib/sfl/routes-publiques.ts, estPageClub), sans barre d'onglets,
// sans accueil de l'app ni guide d'installation, comme /sfl.
//
// Ce fichier reste un composant serveur : il porte l'aperçu du lien, la
// police des titres (Instrument Serif, choisie par Bola le 27/11, chargée ici seulement : le reste de l'app
// n'en paie pas le poids), et le HTML servi contient tout le texte. La page
// est dans components/sfl/page-club/page-club.tsx, ses textes dans
// lib/sfl/page-club.ts.

import type { Metadata } from "next";
import { Instrument_Serif } from "next/font/google";
import { PageClub } from "@/components/sfl/page-club/page-club";
import { METADONNEES_CLUB } from "@/lib/sfl/page-club";

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-club-titre",
});

export const metadata: Metadata = METADONNEES_CLUB;

export default function PageClubRoute() {
  return <PageClub police={instrument.variable} />;
}
