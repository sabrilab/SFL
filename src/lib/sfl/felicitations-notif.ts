// La notification d'un bravo (route /api/felicitations), sans la base : ce
// que la route lit et écrit reste dans la route ; ici, rien que le calcul.
//
// Un même bravo peut toucher plusieurs exploits d'un joueur : le Bravo d'une
// rubrique des titres d'un match les envoie d'un coup, et un même joueur peut
// être MVP, Impact et Défensive le même jour (Ilyes, 02/11/2026). Il reçoit
// alors UNE notification qui les dit tous, ses titres dans l'ordre des puces
// (« Pour tes titres de Joueur Impact et de meilleur défenseur · J4 · +20
// XP »), et l'XP de chacun de ceux qui comptent encore. Avant, la dernière
// seule restait.
//
// L'XP d'une félicitation reçue suit les plafonds de missions.ts : cinq
// comptées au plus par exploit, 100 XP au plus par joueur et par journée,
// dans l'ordre où elles sont arrivées.
//
// PUR (ni fenêtre, ni base) : tools/titres-cumul-check.ts le vérifie.

import { lireCle, quoiDesExploits, type Exploit } from "./exploits";
import { FELICITATIONS_PAR_EXPLOIT, XP_FELICITATION_RECUE, XP_FELICITATIONS_JOURNEE } from "./missions";

/**
 * Au plus, par appel : les exploits d'une rubrique des Actus, que le Bravo
 * envoie d'un coup. Celle des titres d'un match en compte un par titre, et un
 * même joueur peut en avoir trois (J3, Match 1 : 10 exploits pour 7 joueurs) ;
 * celle des badges, un par joueur du dimanche. À 10, le reste tombait sans un
 * mot, alors que le téléphone le croyait enregistré.
 */
export const MAX_EXPLOITS_PAR_BRAVO = 64;
/** Les félicitations comptées pour l'XP, par joueur et par journée. */
const PAR_JOURNEE = XP_FELICITATIONS_JOURNEE / XP_FELICITATION_RECUE;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Les clés d'exploit d'un appel : des chaînes de la bonne forme, sans doublon, MAX_EXPLOITS_PAR_BRAVO au plus. */
export function exploitsDemandes(corps: unknown): string[] {
  const liste = (corps as { exploits?: unknown } | null)?.exploits;
  if (!Array.isArray(liste)) return [];
  return [...new Set(liste.filter((x): x is string => typeof x === "string" && x.length <= 120 && !!lireCle(x)))].slice(0, MAX_EXPLOITS_PAR_BRAVO);
}

/** Une félicitation reçue, telle que la table la garde. */
export interface Recue {
  id: number;
  de: string;
  a: string;
  exploit: string;
  saison: number;
  j: number;
}

/**
 * Cette félicitation compte-t-elle pour l'XP ? Celles que son joueur a reçues
 * ce jour-là (`toutes`, triées par id), dans l'ordre où elles sont arrivées.
 */
export function compteXp(toutes: readonly Recue[], f: { id: number; a: string }, e: Pick<Exploit, "saison" | "j">): boolean {
  let jour = 0;
  const parExploit = new Map<string, number>();
  for (const x of toutes) {
    if (x.a !== f.a || x.saison !== e.saison || x.j !== e.j) continue;
    const n = parExploit.get(x.exploit) ?? 0;
    const retenue = n < FELICITATIONS_PAR_EXPLOIT && jour < PAR_JOURNEE;
    parExploit.set(x.exploit, n + 1);
    if (retenue) jour++;
    if (x.id === f.id) return retenue;
  }
  return false;
}

/** Ce que la notification d'un bravo porte. */
export interface NotifBravo {
  titre: string;
  texte: string;
  url: string;
  tag: string;
  /** La référence du suivi (push_envoyes) : l'exploit qu'elle ouvre. */
  ref: string;
}

/** L'ordre des exploits d'un joueur dans une notification : ses titres dans l'ordre des puces, puis le reste. */
const RANG: Partial<Record<Exploit["famille"], number>> = { mvp: 0, impact: 1, def: 2 };

/**
 * Une notification par joueur prévenu, avec tous ses exploits de l'appel.
 * `cibles` : les félicitations neuves de cet appel (une par exploit) ;
 * `exploits` : ceux de la saison, par clé ; `toutes` : ce que ces joueurs ont
 * reçu sur ces journées, triées par id ; `prenom` : celui qui félicite.
 */
export function notificationsDesBravos(
  cibles: readonly { id: number; a: string; exploit: string }[],
  exploits: ReadonlyMap<string, Exploit>,
  toutes: readonly Recue[],
  prenom: string,
): Map<string, NotifBravo> {
  const parJoueur = new Map<string, { id: number; a: string; e: Exploit }[]>();
  for (const f of cibles) {
    const e = exploits.get(f.exploit);
    if (e) parJoueur.set(f.a, [...(parJoueur.get(f.a) ?? []), { id: f.id, a: f.a, e }]);
  }
  const envois = new Map<string, NotifBravo>();
  for (const [a, fs0] of parJoueur) {
    // Stable : à rang égal (deux exploits hors titres), l'ordre de l'appel.
    const fs = [...fs0].sort((x, y) => (RANG[x.e.famille] ?? 9) - (RANG[y.e.famille] ?? 9));
    const es = fs.map((f) => f.e);
    const cles = es.map((e) => e.cle);
    const xp = fs.filter((f) => compteXp(toutes, f, f.e)).length * XP_FELICITATION_RECUE;
    // Ceux qui l'ont félicité pour ces exploits (moi compris : je viens de le faire).
    const autres = new Set(toutes.filter((x) => x.a === a && cles.includes(x.exploit)).map((x) => x.de)).size - 1;
    const jours = [...new Set(es.map((e) => `J${e.j}`))].join(", ");
    envois.set(a, {
      titre: couper(autres > 0 ? `${prenom} et ${autres} ${autres > 1 ? "autres" : "autre"} t'ont félicité` : `${prenom} t'a félicité`, 60),
      texte: couper(`Pour ${quoiDesExploits(es)} · ${jours}${xp ? ` · +${xp} XP` : ""}`, 180),
      url: `/ligue?exploit=${encodeURIComponent(cles[0])}`,
      tag: `felicitation-${[...cles].sort().join("+")}`,
      ref: `exploit:${cles[0]}`,
    });
  }
  return envois;
}
