// Bola Club : l'état de la démonstration, sur ce téléphone seulement. Le
// club de départ est le FC Démo (demo.ts) ; ce qu'on y change (un appel, des
// stats, une catégorie, une note) est gardé dans le localStorage du
// téléphone, avec le point de vue choisi (admin, entraîneur, joueur,
// parent). Rien ne sort du téléphone : ni base, ni réseau, ni notification.
// Un état d'une autre forme (une autre version de la démo, un état abîmé)
// est jeté tout entier : on repart du club de départ (formeDuClub).

import { lireBlason } from "@/lib/sfl/blason";
import { clubDemo, JOUR_DEMO } from "./demo";
import { CLE_ETAT_CLUB, CLE_ROLE_CLUB } from "./drapeau";
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

const objet = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const texte = (x: unknown): x is string => typeof x === "string";
const liste = (x: unknown, ligne: (l: Record<string, unknown>) => boolean): x is unknown[] => Array.isArray(x) && x.every((l) => objet(l) && ligne(l));

/** Ce qu'on a gardé a bien la forme du club d'aujourd'hui : tout ce que les écrans lisent sans regarder. */
export function formeDuClub(x: unknown): x is Club {
  if (!objet(x)) return false;
  const c = x;
  if (c.jour !== JOUR_DEMO || !texte(c.nom) || !texte(c.initiales) || !texte(c.palier) || typeof c.licencesTotal !== "number") return false;
  if (!objet(c.blason) || !lireBlason(c.blason as never)) return false;
  const bon =
    liste(c.categories, (l) => texte(l.id) && texte(l.nom) && typeof l.ordre === "number" && Array.isArray(l.entraineurs)) &&
    liste(c.membres, (l) => texte(l.id) && texte(l.prenom) && texte(l.nom) && texte(l.naissance) && texte(l.poste) && texte(l.categorie) && objet(l.base)) &&
    liste(c.staff, (l) => texte(l.id) && texte(l.prenom) && texte(l.nom) && texte(l.role)) &&
    liste(c.parents, (l) => texte(l.id) && texte(l.prenom) && texte(l.nom) && texte(l.enfant)) &&
    liste(c.licences, (l) => texte(l.id) && texte(l.statut)) &&
    liste(c.seances, (l) => texte(l.id) && texte(l.genre) && texte(l.categorie) && texte(l.jour) && texte(l.heure) && Array.isArray(l.convoques) && objet(l.reponses) && objet(l.appel) && objet(l.stats)) &&
    liste(c.notes, (l) => texte(l.id) && texte(l.membre) && texte(l.texte)) &&
    liste(c.annonces, (l) => texte(l.id) && texte(l.texte));
  if (!bon || !objet(c.demo)) return false;
  // « Moi », sous chaque point de vue, existe encore.
  const d = c.demo;
  const a = (t: unknown, id: unknown) => (t as { id: string }[]).some((l) => l.id === id);
  return a(c.staff, d.admin) && a(c.staff, d.entraineur) && a(c.membres, d.joueur) && a(c.parents, d.parent);
}

function lire(): EtatClub {
  const DEPART = departClub();
  if (lu || typeof window === "undefined") return etat ?? DEPART;
  lu = true;
  try {
    const role = localStorage.getItem(CLE_ROLE_CLUB);
    const brut = localStorage.getItem(CLE_ETAT_CLUB);
    const club: unknown = brut ? JSON.parse(brut) : null;
    etat = { club: formeDuClub(club) ? club : DEPART.club, role: estRole(role) ? role : ROLE_PAR_DEFAUT };
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
