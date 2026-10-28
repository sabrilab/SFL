// La confirmation des résultats d'un match Bola (Sabri, 28/10 : « dans le
// mode Bola, il n'y a pas de vote de la part des joueurs. Il n'y a qu'une
// confirmation des statistiques du match » ; « Par un écran qui s'affiche
// confirmer ou infirmer les résultats »).
//
// L'organisateur enregistre la feuille ; chaque joueur de la feuille qui a
// un compte reçoit le résultat (notification) et l'écran « Résultat du
// match » (components/sfl/matchs/resultat-a-confirmer.tsx) : Confirmer ou
// Infirmer, une fois par version de la feuille. Choix par défaut, 28/10
// (Sabri peut les changer ; la base les tient, supabase/schema.sql) :
//   · les destinataires sont figés dans chaque version (match_feuilles) ;
//   · le match compte dès que la moitié des destinataires confirme, ne
//     compte pas dès que la moitié infirme ; le premier seuil atteint fige
//     la décision ;
//   · 24 h après la version : il compte si personne n'a infirmé, sinon non
//     (un seul « infirme » suffit alors) ; sans destinataire, il attend
//     aussi ses 24 h ;
//   · une correction de l'organisateur remet tout à zéro (nouvelle version) ;
//   · les matchs saisis avant restent comptés tels quels.
//
// Module pur. Le client ne décide jamais : il affiche l'état que la base
// renvoie (ligue_vierge, bilans_feuilles). etatResultat n'est que le jumeau
// de etat_resultat (SQL), pour les tests et les aperçus : valeurs recopiées,
// changer l'un et l'autre ensemble.

import { mvpsDuMatch } from "@/lib/sfl/ligue-vierge";

export type EtatResultat =
  | "compte"
  | "en_attente"
  | "conteste"
  | "ne_compte_pas";
export type ReponseResultat = "confirme" | "infirme";

/** La fenêtre de réponse d'une version : 24 h, la même que la correction (bilan_feuille). */
export const DELAI_REPONSE_MS = 24 * 3600 * 1000;
/** Le motif d'un « Infirmer » : facultatif, une ligne. */
export const MOTIF_MAX = 140;

export interface ChiffresResultat {
  /** La feuille demande des confirmations (faux : saisie avant le 28/10). */
  requise: boolean;
  /** Destinataires, « confirme », « infirme » sur la version courante. */
  n: number;
  c: number;
  i: number;
  /** Heure de la version (ISO ou ms). */
  enregistreeLe: string | number | null;
  maintenant?: Date;
}

/** Le jumeau de etat_resultat (supabase/schema.sql) : le premier cas vrai l'emporte. */
export function etatResultat({
  requise,
  n,
  c,
  i,
  enregistreeLe,
  maintenant = new Date(),
}: ChiffresResultat): EtatResultat {
  if (!requise) return "compte";
  const t =
    enregistreeLe == null
      ? NaN
      : typeof enregistreeLe === "number"
        ? enregistreeLe
        : Date.parse(enregistreeLe);
  const echu =
    !Number.isFinite(t) || maintenant.getTime() >= t + DELAI_REPONSE_MS;
  if (n === 0) return echu ? "compte" : "en_attente";
  if (i * 2 >= n) return "ne_compte_pas";
  if (c * 2 >= n) return "compte";
  if (echu) return i === 0 ? "compte" : "ne_compte_pas";
  return i > 0 ? "conteste" : "en_attente";
}

/** Combien de « confirme » font compter le match : la moitié des destinataires. */
export const seuilConfirmation = (n: number) => Math.ceil(n / 2);

/**
 * L'état en toutes lettres, en mono sous le score. « Validé » et non
 * « Compte », qui se lisait « mon compte » ; en attente, les confirmations
 * vers le seuil (3/4 sur 8 destinataires), pas vers le total.
 */
export function libelleEtat(
  etat: EtatResultat,
  c?: number,
  n?: number,
): string {
  const vers = n ? ` · ${c ?? 0}/${seuilConfirmation(n)}` : "";
  switch (etat) {
    case "compte":
      return "Validé";
    case "ne_compte_pas":
      return "Non validé";
    case "conteste":
      return `Contesté${vers}`;
    case "en_attente":
      return `En attente${vers}`;
  }
}

const jourParis = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

/** « 0h46 », heure de Paris, comme « 19h30 » partout dans l'app ; et « demain » s'il le faut. */
export function heureLimite(
  iso: string,
  maintenant = new Date(),
): { h: string; demain: boolean; autreJour: string | null } {
  const d = new Date(iso);
  const [hh, mm] = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Paris",
  })
    .format(d)
    .split(":");
  const h = `${Number(hh)}h${mm}`;
  const j = jourParis(d);
  const auj = jourParis(maintenant);
  const lendemain = jourParis(new Date(maintenant.getTime() + 86_400_000));
  return {
    h,
    demain: j === lendemain,
    autreJour:
      j === auj || j === lendemain
        ? null
        : new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "short",
            timeZone: "Europe/Paris",
          }).format(d),
  };
}

/** « à 0h46 », « demain à 0h46 » ; avant : « avant 0h46 », « avant demain 0h46 ». */
function quand(mot: "à" | "avant" | "jusqu'à", iso: string, maintenant: Date) {
  const { h, demain, autreJour } = heureLimite(iso, maintenant);
  const jour = demain ? "demain" : autreJour;
  if (!jour) return `${mot} ${h}`;
  return mot === "à" ? `${jour} à ${h}` : `${mot} ${jour} ${h}`;
}

/**
 * Ce qui se passe ensuite, à droite de l'état : « validé à 0h46 » quand
 * personne n'a infirmé ; pour l'organisateur, « à corriger avant 0h46 »
 * (contesté ou non validé, tant que sa fenêtre de correction est ouverte) ;
 * sinon l'heure limite des réponses. Rien une fois tout fermé.
 */
export function issueResultat(
  b: Pick<BilanFeuille, "etat" | "jusqua" | "i"> & { corrigerJusqua?: string | null },
  organise: boolean,
  maintenant = new Date(),
): string | null {
  const t = maintenant.getTime();
  const corrigeable =
    organise && !!b.corrigerJusqua && t < Date.parse(b.corrigerJusqua);
  if (corrigeable && (b.etat === "conteste" || b.etat === "ne_compte_pas"))
    return `à corriger ${quand("avant", b.corrigerJusqua!, maintenant)}`;
  if (reponseOuverte(b, maintenant) && b.jusqua)
    return b.i === 0
      ? `validé ${quand("à", b.jusqua, maintenant)}`
      : quand("jusqu'à", b.jusqua, maintenant);
  if (corrigeable) return `modifiable ${quand("jusqu'à", b.corrigerJusqua!, maintenant)}`;
  return null;
}

/** Une ligne de la version jugée (l'instantané de la base, avec les noms). */
export interface LigneResultat {
  id: string;
  name: string;
  equipe: "clairs" | "fonces" | "absent";
  buts: number;
  passes: number;
  poste?: string | null;
}

/** Un résultat à confirmer (mes_resultats_a_confirmer). */
export interface ResultatAConfirmer {
  id: number;
  version: number;
  jour: string;
  heure: string;
  lieu: string;
  organisateurId: string;
  organisateur: string;
  scoreClairs: number;
  scoreFonces: number;
  lignes: LigneResultat[];
  n: number;
  c: number;
  i: number;
  etat: EtatResultat;
  /** La fin des 24 h (ISO). */
  jusqua: string | null;
  /** En lecture (resultat_du_match) : déjà répondu, ou décidé ; ma réponse. */
  lecture?: boolean;
  mienne?: ReponseResultat | null;
  destinataire?: boolean;
}

/** Le bilan d'un match pour la fiche (bilans_feuilles) : son état et ma réponse. */
export interface BilanFeuille {
  etat: EtatResultat | null;
  version: number;
  n: number;
  c: number;
  i: number;
  jusqua: string | null;
  requise: boolean;
  /** La fin de la fenêtre de correction de l'organisateur (première saisie + 24 h). */
  corrigerJusqua?: string | null;
  destinataire: boolean;
  mienne: ReponseResultat | null;
}

/** Une réponse vue par l'organisateur (reponses_du_match). */
export interface ReponseDuJoueur {
  id: string;
  name: string;
  reponse: ReponseResultat | null;
  motif: string | null;
  le: string | null;
}

/** Les MVP de la version jugée (les présents seulement). */
export function mvpsDuResultat(
  r: Pick<ResultatAConfirmer, "lignes">,
): string[] {
  return mvpsDuMatch(r.lignes.filter((l) => l.equipe !== "absent"));
}

/** « 1 B · 2 P », la notation de Bola ; et sa lecture pour VoiceOver. */
export const statsCourtes = (l: Pick<LigneResultat, "buts" | "passes">) =>
  `${l.buts} B · ${l.passes} P`;
export const statsLues = (l: Pick<LigneResultat, "buts" | "passes">) =>
  `${l.buts} but${l.buts > 1 ? "s" : ""}, ${l.passes} passe${l.passes > 1 ? "s" : ""}`;

/** « 2 buts · 1 passe », « Absent », « 0 but ». */
export function maLigne(
  l: Pick<LigneResultat, "equipe" | "buts" | "passes"> | null | undefined,
): string {
  if (!l || l.equipe === "absent") return "Absent";
  const b = `${l.buts} but${l.buts > 1 ? "s" : ""}`;
  return l.passes > 0
    ? `${b} · ${l.passes} passe${l.passes > 1 ? "s" : ""}`
    : b;
}

/** Peut-on encore répondre ? (rien de décidé, fenêtre ouverte) — pour l'affichage seulement. */
export function reponseOuverte(
  b: Pick<BilanFeuille, "etat" | "jusqua">,
  maintenant = new Date(),
): boolean {
  if (b.etat !== "en_attente" && b.etat !== "conteste") return false;
  return !b.jusqua || maintenant.getTime() < Date.parse(b.jusqua);
}

/** « Match de Karim », « Match d'Ilyes ». */
export function matchDe(prenom: string): string {
  return /^[aeiouyhàâéèêëîïôöûü]/i.test(prenom)
    ? `Match d'${prenom}`
    : `Match de ${prenom}`;
}
