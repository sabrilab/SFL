// Les directions artistiques à l'essai pour les contrats, les missions et le
// passe (Sabri, 24/10 : « rendre ça plus branding Bola et toujours dans
// l'esprit de "on est mercenaires" […] propose-moi 4 variantes avant que je te
// dise de lancer »). La DA en ligne, la 0, reste celle de tout le monde :
// ?da=1 à 4 dans l'adresse en pose une sur <html data-da>, gardée sur le
// téléphone pour la suite de la visite (bola-da) ; ?da=0 revient à la DA en
// ligne. Chaque variante est dans components/sfl/da/ : sa feuille de style
// (tout est sous :root[data-da="n"]) et, pour l'insigne du rang et le viseur,
// son dessin (insigne-da.tsx).

import { useSyncExternalStore } from "react";

export type Da = 0 | 1 | 2 | 3 | 4;

export const DAS: { n: Da; nom: string; idee: string }[] = [
  { n: 0, nom: "En ligne", idee: "Les bandes de chantier, le quadrillage, le viseur" },
  { n: 1, nom: "Titre", idee: "Le contrat imprimé comme un billet : guilloché, microtexte, numéro de série" },
  { n: 2, nom: "Lune", idee: "Le symbole Bola : les phases de la lune, l'orbite de la balle" },
  { n: 3, nom: "Dossier", idee: "Le dossier tapé à la machine : lignes, onglets, tampons" },
  { n: 4, nom: "Affiche", idee: "L'affiche : aplats, grands chiffres, la pente du B de Bola" },
];

const CLE = "bola-da";
const abonnes = new Set<() => void>();

function lire(): Da {
  if (typeof document === "undefined") return 0;
  const n = Number(document.documentElement.dataset.da ?? 0);
  return (n >= 1 && n <= 4 ? n : 0) as Da;
}

export function poserDa(n: Da, essai = true) {
  if (essai) document.documentElement.dataset.daEssai = "1";
  if (n === 0) delete document.documentElement.dataset.da;
  else document.documentElement.dataset.da = String(n);
  try {
    if (n === 0) localStorage.removeItem(CLE);
    else localStorage.setItem(CLE, String(n));
  } catch {}
  abonnes.forEach((f) => f());
}

/** Au lancement : ?da=n d'abord, sinon le choix gardé. */
export function daDeDepart(): Da {
  const q = new URLSearchParams(window.location.search).get("da");
  let n = q !== null ? Number(q) : NaN;
  if (Number.isNaN(n)) {
    try {
      n = Number(localStorage.getItem(CLE) ?? 0);
    } catch {
      n = 0;
    }
  }
  return (n >= 1 && n <= 4 ? n : 0) as Da;
}

export function useDa(): Da {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    lire,
    () => 0
  );
}

/** Le sélecteur se montre dès qu'une adresse a porté ?da=, ou qu'une variante est posée. */
export function useDaEssai(): boolean {
  return useSyncExternalStore(
    (f) => {
      abonnes.add(f);
      return () => abonnes.delete(f);
    },
    () => document.documentElement.dataset.daEssai === "1",
    () => false
  );
}
