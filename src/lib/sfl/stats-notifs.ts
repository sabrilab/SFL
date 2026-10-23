// Les notifications, analysées pour Admin → Activité & rétention →
// Notifications (src/app/admin/activite/notifications.tsx). Sabri, 23/10 :
// « combien ont activé la notification et ce à quoi ils ont répondu suite à
// un motif […] Range bien pour qu'on arrive encore bien à s'y retrouver dans
// l'analyse pour améliorer ».
//
// Trois questions, dans l'ordre de la page :
//   1. qui les a activées : aujourd'hui, jour après jour (push_historique),
//      et pourquoi pas les autres joueurs actifs (l'état que chaque
//      téléphone note à l'ouverture : app pas installée sur iPhone,
//      refusées dans les réglages, pas encore décidé…) ;
//   2. ce que donne l'invitation de l'ouverture (journal d'usage, kind
//      'notifs') ;
//   3. motif par motif, rangés par famille (lib/sfl/motifs-notif.ts) :
//      combien partent, arrivent, sont touchées, et suivies du geste
//      qu'elles attendaient (push_envois).
// Puis le détail par joueur, et ce qu'il faut en retenir.
//
// Les taux se lisent sur les notifications parties : une notification
// qu'aucun téléphone n'a prise (service de push en panne) est comptée à part.
//
// Module pur : la page lit, ce module compte. Les données d'exemple des
// aperçus sont dans ./stats-notifs-demo.ts.

import { DAY, debutJour, pct } from "@/lib/sfl/retention";
import { defMotif, estMotif, FAMILLES_NOTIF, MOTIFS_NOTIF, type FamilleNotif } from "@/lib/sfl/motifs-notif";

/* -------------------------------- entrées -------------------------------- */

/** Une notification envoyée à un joueur (push_envois). */
export interface EnvoiLu {
  nom: string;
  motif: string;
  /** Ses téléphones qui l'ont prise : 0 si aucun, null si l'envoi ne l'a pas encore dit. */
  acceptes: number | null;
  envoyee: number;
  recue: number | null;
  ouverte: number | null;
  /** Le geste attendu, une fois fait : message, reaction, accepte, refuse, suivi. */
  effet: string | null;
}

/** Un téléphone qui s'abonne ou s'en va (push_historique). */
export interface MouvementLu {
  nom: string;
  appareil: string;
  service: string;
  evenement: "ajout" | "retrait";
  le: number;
}

/** Une ligne du journal d'usage, kind 'notifs' (lib/sfl/notifications.ts). */
export interface GesteNotifs {
  nom: string;
  /** proposee, plus-tard, etat, ou ce que le téléphone a répondu (actives, refusees…). */
  geste: string;
  /** Où la demande a été vue : ouverture, reglages, vestiaire. */
  ou: string | null;
  /** Pour « etat » : l'état des notifications sur le téléphone ce jour-là. */
  etat: string | null;
  at: number;
}

export interface DonneesNotifs {
  envois: EnvoiLu[];
  /** L'historique des abonnements ; null s'il n'est pas lisible (on part alors des abonnements présents). */
  mouvements: MouvementLu[] | null;
  /** Les abonnements présents, un par téléphone. */
  abonnements: { nom: string; depuis: number }[];
  gestes: GesteNotifs[];
}

/* -------------------------------- sorties -------------------------------- */

export interface Taux {
  /** Parties vers au moins un téléphone. */
  envoyees: number;
  /** Prises par aucun téléphone. */
  echouees: number;
  joueurs: number;
  arrivees: number;
  touchees: number;
  /** Celles qui attendaient un geste, et celles qui l'ont eu. */
  attendues: number;
  suivies: number;
  /** Les réponses attendues (invitation à un match, missions) : oui, non. */
  oui: number;
  non: number;
  /** Délai médian entre l'envoi et le toucher (ms). */
  delai: number | null;
}

export interface LigneMotif extends Taux {
  motif: string;
  label: string;
  famille: FamilleNotif;
  /** Le geste attendu, en clair ; null quand la toucher suffit. */
  effet: string | null;
}

export interface FamilleNotifs extends Taux {
  id: FamilleNotif;
  label: string;
  motifs: LigneMotif[];
}

export interface JoueurNotifs {
  nom: string;
  /** Ses téléphones abonnés aujourd'hui. */
  telephones: number;
  recues: number;
  touchees: number;
  attendues: number;
  suivies: number;
  /** Sa dernière notification touchée. */
  derniere: number | null;
}

export type RaisonId = "a-installer" | "inactives" | "refusees" | "perdues" | "indisponible" | "inconnu";

export interface Retenir {
  ton: "bon" | "alerte" | "idee";
  texte: string;
}

export interface AnalyseNotifs {
  /** Début de la période (minuit local). */
  depuis: number;
  /** La première notification suivie : avant, rien n'était compté. */
  suiviesDepuis: number | null;
  activees: {
    /** Joueurs qui ont au moins un téléphone abonné, et ces téléphones. */
    joueurs: number;
    telephones: number;
    /** Les joueurs actifs de la période, et combien d'entre eux les ont activées. */
    actifs: number;
    parmiActifs: number;
    /** Sur la période : joueurs qui les ont activées, joueurs qui les ont perdues. */
    gagnes: number;
    perdus: number;
  };
  /** Les téléphones abonnés par service (iPhone, Android…) ; vide sans historique. */
  services: { id: string; label: string; n: number }[];
  /** Les joueurs qui les ont activées, jour par jour. */
  courbe: { t: number; v: number }[];
  /** Les joueurs actifs sans notifications, et pourquoi. */
  raisons: { id: RaisonId; label: string; noms: string[] }[];
  invitation: {
    /** Joueurs à qui l'invitation de l'ouverture a été montrée sur la période. */
    proposes: number;
    issues: { id: IssueId; label: string; n: number }[];
    /** Joueurs qui les ont activées ailleurs (Réglages, Vestiaire). */
    ailleurs: { label: string; n: number }[];
  };
  total: Taux;
  familles: FamilleNotifs[];
  joueurs: JoueurNotifs[];
  retenir: Retenir[];
}

/* -------------------------------- libellés ------------------------------- */

const SERVICES: Record<string, string> = {
  apple: "iPhone",
  google: "Android",
  mozilla: "Firefox",
  microsoft: "Windows",
  autre: "Autre",
};

const RAISONS: { id: RaisonId; label: string }[] = [
  { id: "a-installer", label: "iPhone, app pas installée" },
  { id: "inactives", label: "Pas encore activées" },
  { id: "refusees", label: "Refusées dans les réglages" },
  { id: "perdues", label: "Abonnement perdu" },
  { id: "indisponible", label: "Navigateur qui ne les reçoit pas" },
  { id: "inconnu", label: "Pas revenu depuis le suivi" },
];

type IssueId = "activees" | "refusees" | "pas-abouties" | "plus-tard" | "sans-reponse";

const ISSUES: { id: IssueId; label: string }[] = [
  { id: "activees", label: "Activées" },
  { id: "refusees", label: "Refusées" },
  { id: "pas-abouties", label: "Oui, sans aboutir" },
  { id: "plus-tard", label: "Plus tard" },
  { id: "sans-reponse", label: "Sans réponse" },
];

const OU: Record<string, string> = { reglages: "Réglages", vestiaire: "Vestiaire" };

/** Les états du téléphone (lib/sfl/notifications.ts, EtatNotifications). */
const ETATS = new Set(["actives", "inactives", "refusees", "a-installer", "indisponible", "bientot"]);

/* --------------------------------- outils -------------------------------- */

/** Minuit local du lendemain (sûr aux changements d'heure). */
const lendemain = (jour: number) => debutJour(jour + 36 * 3600 * 1000);

/** Le plus petit et le plus grand, sans étaler un grand tableau en arguments. */
const plusPetit = (xs: number[]) => xs.reduce((a, b) => Math.min(a, b), Infinity);
const plusGrand = (xs: number[]) => xs.reduce((a, b) => Math.max(a, b), -Infinity);

function mediane(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** 40 s → « 40 s », 7 min, 1 h 05, 2 j. */
export function delaiCourt(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))} s`;
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  return `${Math.round(min / (24 * 60))} j`;
}

/** Une part qu'on peut lire : 0 sur 0 donne 0. */
export const part = (n: number, sur: number) => (sur > 0 ? n / sur : 0);

/** Une notification partie : au moins un téléphone l'a prise (ou on ne le sait pas encore). */
const partie = (e: EnvoiLu) => e.acceptes !== 0;

function taux(envois: EnvoiLu[]): Taux {
  const parties = envois.filter(partie);
  const touchees = parties.filter((e) => e.ouverte !== null);
  const attendues = parties.filter((e) => defMotif(e.motif).effet !== null);
  return {
    envoyees: parties.length,
    echouees: envois.length - parties.length,
    joueurs: new Set(parties.map((e) => e.nom)).size,
    // Touchée, elle est forcément arrivée.
    arrivees: parties.filter((e) => e.recue !== null || e.ouverte !== null).length,
    touchees: touchees.length,
    attendues: attendues.length,
    suivies: attendues.filter((e) => e.effet !== null).length,
    oui: parties.filter((e) => e.effet === "accepte").length,
    non: parties.filter((e) => e.effet === "refuse").length,
    delai: mediane(touchees.map((e) => Math.max(0, e.ouverte! - e.envoyee))),
  };
}

function grouper<T>(xs: T[], cle: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = cle(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}

/* --------------------------------- analyse ------------------------------- */

export function analyserNotifs(
  d: DonneesNotifs,
  {
    now,
    jours,
    actifs,
    garde,
  }: {
    now: number;
    /** La période du haut de la page ; null : depuis le début. */
    jours: number | null;
    /** Les joueurs venus sur la période (le public choisi). */
    actifs: string[];
    /** Le public choisi (joueurs, admins, tout le monde). */
    garde: (nom: string) => boolean;
  }
): AnalyseNotifs {
  const envois = d.envois.filter((e) => garde(e.nom));
  const abonnements = d.abonnements.filter((a) => garde(a.nom));
  const gestes = d.gestes.filter((g) => garde(g.nom)).sort((x, y) => x.at - y.at);
  // Sans historique lisible, les abonnements présents en tiennent lieu :
  // chacun arrivé à sa date, aucun parti.
  const mouvements = (
    d.mouvements ??
    d.abonnements.map((a, i): MouvementLu => ({ nom: a.nom, appareil: `present-${i}`, service: "autre", evenement: "ajout", le: a.depuis }))
  )
    .filter((m) => garde(m.nom))
    .sort((x, y) => x.le - y.le);

  /* ------------------------------ la période ----------------------------- */
  // Comme le reste de la page : aujourd'hui et les N − 1 jours d'avant.
  const aujourdhui = debutJour(now);
  const premier = Math.min(plusPetit(envois.map((e) => e.envoyee)), mouvements[0]?.le ?? Infinity, gestes[0]?.at ?? Infinity, now);
  const depuis = jours === null ? debutJour(premier) : debutJour(aujourdhui - (jours - 1) * DAY + DAY / 2);
  const suiviesDepuis = d.envois.length ? plusPetit(d.envois.map((e) => e.envoyee)) : null;

  /* ------------------------ qui les a activées ---------------------------- */
  const telephones = new Map<string, number>();
  for (const a of abonnements) telephones.set(a.nom, (telephones.get(a.nom) ?? 0) + 1);
  const actifsVus = [...new Set(actifs.filter(garde))];
  const parmiActifs = actifsVus.filter((n) => telephones.has(n)).length;

  // L'historique rejoué jour par jour : le téléphone suit le dernier joueur
  // qui s'y est abonné ; le retrait d'un autre joueur ne le touche pas.
  const etat = new Map<string, { nom: string; service: string }>();
  let k = 0;
  const appliquer = (jusqua: number) => {
    for (; k < mouvements.length && mouvements[k].le < jusqua; k++) {
      const m = mouvements[k];
      if (m.evenement === "ajout") etat.set(m.appareil, { nom: m.nom, service: m.service });
      else if (etat.get(m.appareil)?.nom === m.nom) etat.delete(m.appareil);
    }
  };
  const joignables = () => new Set([...etat.values()].map((v) => v.nom));
  appliquer(depuis);
  const auDebut = joignables();
  const courbe: { t: number; v: number }[] = [];
  for (let j = depuis; j <= aujourdhui; j = lendemain(j)) {
    appliquer(lendemain(j));
    courbe.push({ t: j, v: joignables().size });
  }
  appliquer(Infinity);
  const aLaFin = joignables();
  const gagnes = [...aLaFin].filter((n) => !auDebut.has(n)).length;
  const perdus = [...auDebut].filter((n) => !aLaFin.has(n)).length;

  const parService = new Map<string, number>();
  if (d.mouvements) for (const v of etat.values()) parService.set(v.service, (parService.get(v.service) ?? 0) + 1);
  const services = [...parService]
    .map(([id, n]) => ({ id, label: SERVICES[id] ?? id, n }))
    .sort((x, y) => y.n - x.n);

  /* ------------------------ et pourquoi pas les autres -------------------- */
  // Le dernier état connu de chaque joueur : celui que son téléphone note
  // chaque jour à l'ouverture, ou sa dernière réponse à une demande.
  const dernierEtat = new Map<string, string>();
  for (const g of gestes) {
    const e = g.geste === "etat" ? g.etat : ETATS.has(g.geste) ? g.geste : null;
    if (e) dernierEtat.set(g.nom, e);
  }
  const raisonDe = (nom: string): RaisonId => {
    const e = dernierEtat.get(nom);
    if (e === "a-installer" || e === "inactives" || e === "refusees" || e === "indisponible") return e;
    if (e === "actives") return "perdues";
    return "inconnu";
  };
  const sans = grouper(
    actifsVus.filter((n) => !telephones.has(n)),
    raisonDe
  );
  const raisons = RAISONS.map((r) => ({ ...r, noms: (sans.get(r.id) ?? []).sort((x, y) => x.localeCompare(y, "fr")) })).filter(
    (r) => r.noms.length > 0
  );

  /* ----------------------- l'invitation de l'ouverture -------------------- */
  const gestesPeriode = gestes.filter((g) => g.at >= depuis);
  const proposee = new Map<string, number>();
  for (const g of gestesPeriode)
    if (g.geste === "proposee" && g.ou === "ouverture" && !proposee.has(g.nom)) proposee.set(g.nom, g.at);
  const issueDe = (nom: string, des: number): IssueId => {
    const reponses = gestesPeriode.filter((g) => g.nom === nom && g.ou === "ouverture" && g.at >= des).map((g) => g.geste);
    if (reponses.includes("actives")) return "activees";
    if (reponses.includes("refusees")) return "refusees";
    if (reponses.some((r) => ETATS.has(r))) return "pas-abouties";
    if (reponses.includes("plus-tard")) return "plus-tard";
    return "sans-reponse";
  };
  const issues = grouper([...proposee], ([nom, des]) => issueDe(nom, des));
  const ailleurs = grouper(
    gestesPeriode.filter((g) => g.geste === "actives" && g.ou !== null && g.ou !== "ouverture"),
    (g) => g.ou!
  );
  const invitation = {
    proposes: proposee.size,
    issues: ISSUES.map((i) => ({ ...i, n: issues.get(i.id)?.length ?? 0 })),
    ailleurs: [...ailleurs]
      .map(([ou, gs]) => ({ label: OU[ou] ?? ou, n: new Set(gs.map((g) => g.nom)).size }))
      .sort((x, y) => y.n - x.n),
  };

  /* --------------------------- motif par motif ---------------------------- */
  const periode = envois.filter((e) => e.envoyee >= depuis);
  const parMotif = grouper(periode, (e) => e.motif);
  // L'ordre de lib/sfl/motifs-notif.ts, puis les motifs qu'elle ne connaît
  // pas encore (une version plus récente du serveur), rangés en Annonces.
  const ordre = [
    ...Object.keys(MOTIFS_NOTIF),
    ...[...parMotif.keys()].filter((m) => !estMotif(m)).sort(),
  ];
  const lignes = ordre
    .filter((m) => parMotif.has(m))
    .map((m): LigneMotif => {
      const def = defMotif(m);
      return { motif: m, label: def.label, famille: def.famille, effet: def.effet, ...taux(parMotif.get(m)!) };
    });
  const familles = FAMILLES_NOTIF.map(
    (f): FamilleNotifs => ({
      id: f.id,
      label: f.label,
      motifs: lignes.filter((l) => l.famille === f.id),
      ...taux(periode.filter((e) => defMotif(e.motif).famille === f.id)),
    })
  ).filter((f) => f.motifs.length > 0);
  const total = taux(periode);

  /* ------------------------------ par joueur ------------------------------ */
  const parJoueur = grouper(periode, (e) => e.nom);
  const joueurs = [...new Set([...parJoueur.keys(), ...telephones.keys()])]
    .map((nom): JoueurNotifs => {
      const siens = parJoueur.get(nom) ?? [];
      const t = taux(siens);
      const touchees = siens.filter((e) => e.ouverte !== null).map((e) => e.ouverte!);
      return {
        nom,
        telephones: telephones.get(nom) ?? 0,
        recues: t.envoyees,
        touchees: t.touchees,
        attendues: t.attendues,
        suivies: t.suivies,
        derniere: touchees.length ? plusGrand(touchees) : null,
      };
    })
    .sort((x, y) => y.recues - x.recues || y.touchees - x.touchees || x.nom.localeCompare(y.nom, "fr"));

  /* --------------------------- ce qu'on en retient ------------------------ */
  const retenir: Retenir[] = [];
  const nomFamille = new Map(FAMILLES_NOTIF.map((f) => [f.id, f.label]));
  const dire = (l: LigneMotif) => `« ${l.label} » (${nomFamille.get(l.famille)})`;

  if (actifsVus.length >= 5) {
    const p = part(parmiActifs, actifsVus.length);
    const frein = raisons.find((r) => r.id !== "inconnu" && r.noms.length >= 2);
    retenir.push({
      ton: p >= 0.6 ? "bon" : p < 0.35 ? "alerte" : "idee",
      texte:
        `${parmiActifs} joueurs actifs sur ${actifsVus.length} ont les notifications (${pct(p)}).` +
        (frein ? ` Premier frein : ${frein.label.charAt(0).toLowerCase()}${frein.label.slice(1)} (${frein.noms.length}).` : ""),
    });
  }
  if (invitation.proposes >= 5) {
    const oui = issues.get("activees")?.length ?? 0;
    const p = part(oui, invitation.proposes);
    retenir.push({
      ton: p >= 0.5 ? "bon" : p < 0.25 ? "alerte" : "idee",
      texte: `L'invitation de l'ouverture convainc ${oui} joueurs sur ${invitation.proposes} (${pct(p)}).`,
    });
  }
  const sourds = joueurs.filter((j) => j.recues >= 10 && j.touchees === 0).map((j) => j.nom);
  if (sourds.length > 0)
    retenir.push({
      ton: "alerte",
      texte: `${sourds.length > 1 ? `${sourds.length} joueurs reçoivent` : "1 joueur reçoit"} 10 notifications ou plus sans en toucher aucune : ${sourds.slice(0, 5).join(", ")}${sourds.length > 5 ? "…" : ""}.`,
    });
  const mesurables = lignes.filter((l) => l.envoyees >= 10);
  if (mesurables.length >= 2) {
    const tri = [...mesurables].sort((x, y) => part(y.touchees, y.envoyees) - part(x.touchees, x.envoyees));
    const haut = tri[0];
    const bas = tri.at(-1)!;
    if (part(haut.touchees, haut.envoyees) - part(bas.touchees, bas.envoyees) >= 0.15)
      retenir.push({
        ton: "idee",
        texte: `Les plus touchées : ${dire(haut)}, ${pct(part(haut.touchees, haut.envoyees))}. Les moins : ${dire(bas)}, ${pct(part(bas.touchees, bas.envoyees))}.`,
      });
  }
  const suivables = lignes.filter((l) => l.attendues >= 10);
  if (suivables.length > 0) {
    const meilleur = [...suivables].sort((x, y) => part(y.suivies, y.attendues) - part(x.suivies, x.attendues))[0];
    if (meilleur.suivies > 0)
      retenir.push({
        ton: "bon",
        texte: `Celle qui fait le plus agir : ${dire(meilleur)}, suivie d'effet ${pct(part(meilleur.suivies, meilleur.attendues))} du temps (${meilleur.effet}).`,
      });
  }
  if (total.touchees >= 10 && total.delai !== null)
    retenir.push({ ton: "idee", texte: `Une notification touchée l'est en ${delaiCourt(total.delai)} (médiane).` });

  return {
    depuis,
    suiviesDepuis,
    activees: {
      joueurs: telephones.size,
      telephones: abonnements.length,
      actifs: actifsVus.length,
      parmiActifs,
      gagnes,
      perdus,
    },
    services,
    courbe,
    raisons,
    invitation,
    total,
    familles,
    joueurs,
    retenir: retenir.slice(0, 4),
  };
}
