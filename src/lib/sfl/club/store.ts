// Bola Club : l'état de la démonstration, sur ce téléphone seulement. Le
// club de départ est le FC Démo (demo.ts) ; ce qu'on y change (un appel, des
// stats, une catégorie, une note) est gardé dans le localStorage du
// téléphone, avec le point de vue choisi (admin, entraîneur, joueur,
// parent). Rien ne sort du téléphone : ni base, ni réseau, ni notification.
// Un état d'une autre forme (une autre version de la démo) est jeté.

import { clubDemo, JOUR_DEMO } from "./demo";
import { BOLA_CLUB, CLE_ETAT_CLUB, CLE_ROLE_CLUB, MARQUEUR_CLUB } from "./drapeau";
import type { Resultat } from "./mutations";
import { ROLES, type Club, type Moi, type Role } from "./types";

export interface EtatClub {
  club: Club;
  role: Role;
}

/** Le point de vue à la première ouverture. */
export const ROLE_PAR_DEFAUT: Role = "entraineur";

// Le club de départ n'est tiré qu'à la première lecture : en production, où
// personne ne lit le club, il ne l'est jamais.
let depart: EtatClub | null = null;
const departClub = (): EtatClub => (depart ??= { club: clubDemo(), role: ROLE_PAR_DEFAUT });
let etat: EtatClub | null = null;
let lu = false;
const ecoutes = new Set<() => void>();

const estRole = (x: unknown): x is Role => ROLES.some((r) => r.id === x);

function lire(): EtatClub {
  const DEPART = departClub();
  if (lu || typeof window === "undefined") return etat ?? DEPART;
  lu = true;
  try {
    const role = localStorage.getItem(CLE_ROLE_CLUB);
    const brut = localStorage.getItem(CLE_ETAT_CLUB);
    const club = brut ? (JSON.parse(brut) as Club) : null;
    const bon = !!club && club.jour === JOUR_DEMO && Array.isArray(club.membres) && Array.isArray(club.seances) && Array.isArray(club.licences);
    etat = { club: bon ? club : DEPART.club, role: estRole(role) ? role : ROLE_PAR_DEFAUT };
  } catch {
    etat = DEPART;
  }
  return etat;
}

function poser(suivant: EtatClub) {
  etat = suivant;
  try {
    localStorage.setItem(CLE_ROLE_CLUB, suivant.role);
    if (suivant.club === departClub().club) localStorage.removeItem(CLE_ETAT_CLUB);
    else localStorage.setItem(CLE_ETAT_CLUB, JSON.stringify(suivant.club));
  } catch {}
  ecoutes.forEach((f) => f());
}

export function ecouterClub(f: () => void) {
  ecoutes.add(f);
  return () => {
    ecoutes.delete(f);
  };
}

export function etatClub(): EtatClub {
  return lire();
}

/** Le rendu du serveur : le club de départ, sous le point de vue par défaut. */
export const etatClubServeur = (): EtatClub => departClub();

export const moiDe = (e: EtatClub): Moi => ({ role: e.role, id: e.club.demo[e.role] });

export function choisirRole(role: Role) {
  const e = lire();
  if (e.role !== role) poser({ ...e, role });
}

/** Applique un changement (mutations.ts) ; rend le refus à afficher, ou null. */
export function agirSurLeClub(mutation: (club: Club, moi: Moi) => Resultat): string | null {
  const e = lire();
  const r = mutation(e.club, moiDe(e));
  if (!r.ok) return r.refus;
  if (r.club !== e.club) poser({ ...e, club: r.club });
  return null;
}

/** Revenir au club de départ. */
export function remettreLeClub() {
  poser({ ...lire(), club: departClub().club });
}

// Le marqueur : posé à la première visite de /club. Tant qu'il n'y est pas,
// l'app de l'aperçu est celle de la production.
const ecoutesMarqueur = new Set<() => void>();

export function ecouterMarqueur(f: () => void) {
  ecoutesMarqueur.add(f);
  return () => {
    ecoutesMarqueur.delete(f);
  };
}

export function clubOuvert(): boolean {
  if (!BOLA_CLUB || typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MARQUEUR_CLUB) !== null;
  } catch {
    return false;
  }
}

export function marquerClubOuvert() {
  if (!BOLA_CLUB) return;
  try {
    if (localStorage.getItem(MARQUEUR_CLUB) === null) localStorage.setItem(MARQUEUR_CLUB, new Date().toISOString());
  } catch {}
  ecoutesMarqueur.forEach((f) => f());
}
