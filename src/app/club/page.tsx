// La page publique getbola.app/club : Bola Club présenté aux clubs amateurs,
// le point d'arrivée de la campagne de mails (27/11/2026). Ouverte à tous
// (AuthGate, lib/sfl/routes-publiques.ts, estPageClub), sans barre d'onglets,
// sans accueil de l'app ni guide d'installation, comme /sfl.
//
// Ce fichier reste un composant serveur : il porte l'aperçu du lien, la
// police des titres (Libre Caslon Condensed, choisie par Bola le 27/11 ;
// absente de next/font, elle vient de Google Fonts par une feuille de style
// que React place dans le <head>, chargée ici seulement : le reste de l'app
// n'en paie pas le poids), et le HTML servi contient tout le texte. La page
// est dans components/sfl/page-club/page-club.tsx, ses textes dans
// lib/sfl/page-club.ts.

import type { Metadata } from "next";
import { PageClub } from "@/components/sfl/page-club/page-club";
import { METADONNEES_CLUB } from "@/lib/sfl/page-club";

const POLICE_TITRE = "https://fonts.googleapis.com/css2?family=Libre+Caslon+Condensed:wght@400..700&display=swap";

export const metadata: Metadata = METADONNEES_CLUB;

export default function PageClubRoute() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={POLICE_TITRE} precedence="default" />
      <PageClub />
    </>
  );
}
