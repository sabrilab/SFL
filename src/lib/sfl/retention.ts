// Analyse de l'activité — tout ce que la page admin « Activité & rétention »
// affiche, calculé ici à partir des événements bruts du journal `activity`.
//
// Pur (aucun React, aucun appel réseau) : la page lit le journal, puis appelle
// `analyser()` à chaque changement de période. Les jours sont ceux du
// téléphone de l'admin (heure locale), pas ceux d'UTC : un match fini à 23 h
// reste le bon jour.
//
// Ce qu'on en tire :
//   · une série par jour sur tout l'historique (actifs du jour, actifs sur
//     7 jours glissants, nouveaux, joueurs cumulés, sessions, temps passé),
//     d'où les courbes de croissance ;
//   · les chiffres de la période et leur évolution par rapport à la période
//     d'avant de même durée ;
//   · les cohortes (les joueurs arrivés la même semaine, et la part encore là
//     les semaines suivantes) et la courbe de rétention (revenus après 1, 3,
//     7… jours) ;
//   · les gestes qui retiennent : la part des joueurs revenus après leur
//     première semaine, selon qu'ils ont fait tel geste ou non dans celle-ci ;
//   · les familles de joueurs aujourd'hui (nouveaux, fidèles, à risque,
//     décrochés…) et la liste de ceux à relancer ;
//   · les conclusions : des phrases calculées sur ces chiffres, chacune avec
//     ce qu'elle suggère de faire dans l'app. Rien n'y est écrit d'avance.

export const DAY = 24 * 3600 * 1000;

/* --------------------------------- types --------------------------------- */

export interface Evenement {
  name: string;
  kind: string;
  path: string | null;
  session: string | null;
  at: number;
}

export interface Profil {
  name: string;
  contact_email: string | null;
  /** Création du compte (ms), si connue. */
  created_at: number | null;
  /** Compte admin (Sabri, Ilyes) : ses connexions faussent les chiffres des joueurs. */
  admin?: boolean;
}

export interface PointJour {
  /** Minuit local du jour (ms). */
  t: number;
  actifs: number;
  /** Joueurs distincts venus sur les 7 derniers jours, ce jour compris. */
  hebdo: number;
  nouveaux: number;
  cumul: number;
  sessions: number;
  /** Minutes passées dans l'app (sessions commencées ce jour). */
  minutes: number;
}

export type MetriqueId = "hebdo" | "actifs" | "nouveaux" | "cumul" | "sessions" | "minutes";

export const METRIQUES: { id: MetriqueId; label: string; court: string }[] = [
  { id: "hebdo", label: "Joueurs actifs sur 7 jours", court: "Actifs 7 j" },
  { id: "actifs", label: "Joueurs actifs par jour", court: "Par jour" },
  { id: "nouveaux", label: "Nouveaux joueurs par jour", court: "Nouveaux" },
  { id: "cumul", label: "Joueurs venus au total", court: "Cumul" },
  { id: "sessions", label: "Sessions par jour", court: "Sessions" },
  { id: "minutes", label: "Minutes passées par jour", court: "Temps" },
];

export interface Chiffre {
  valeur: number;
  /** Valeur sur la période précédente de même durée (null : pas comparable). */
  avant: number | null;
}

export interface Cohorte {
  /** Lundi de la semaine d'arrivée (ms). */
  semaine: number;
  taille: number;
  /** Part (0–1) de la cohorte active la semaine k après son arrivée ; null = pas encore vécue. */
  parts: (number | null)[];
}

export interface PointRetention {
  jours: number;
  /** Joueurs arrivés il y a au moins `jours` jours. */
  eligibles: number;
  revenus: number;
}

export interface Levier {
  id: string;
  label: string;
  /** Verbe à l'infinitif pour les conclusions (« répondre à une convocation »). */
  geste: string;
  avec: number;
  avecRevenus: number;
  sans: number;
  sansRevenus: number;
}

export type FamilleId = "nouveaux" | "fideles" | "reguliers" | "risque" | "decroches" | "jamais";

export interface Famille {
  id: FamilleId;
  label: string;
  note: string;
  noms: string[];
}

export interface JoueurStat {
  name: string;
  premier: number;
  last: number;
  /** Jours actifs sur la période regardée. */
  jours: number;
  /** Jours actifs depuis toujours. */
  joursTotal: number;
  actions: number;
  sessions: number;
  temps: number;
  moyenne: number;
  email: string | null;
}

export interface Conclusion {
  ton: "bon" | "alerte" | "idee";
  titre: string;
  detail: string;
  action: string;
}

export interface Analyse {
  now: number;
  /** Début de la période regardée (minuit local). */
  depuis: number;
  serie: PointJour[];
  /** Index du premier point de la période dans `serie`. */
  debutPeriode: number;
  /** Creux le plus marqué de l'historique, s'il y en a un (bornes en ms). */
  creux: { de: number; a: number; plancher: number; pic: number } | null;
  chiffres: {
    actifs: Chiffre;
    nouveaux: Chiffre;
    sessions: Chiffre;
    temps: Chiffre;
    joursParJoueur: Chiffre;
  };
  aujourdhui: number;
  semaine: number;
  comptes: number;
  dureeMoyenne: number;
  dureeMediane: number;
  actionsParSession: number;
  /** [jour de la semaine lundi=0][heure] = moments de présence. */
  carte: number[][];
  actions: { label: string; value: number }[];
  pages: { label: string; value: number }[];
  cohortes: Cohorte[];
  retention: PointRetention[];
  leviers: Levier[];
  familles: Famille[];
  aRelancer: { name: string; last: number; jours: number; email: string | null }[];
  joueurs: JoueurStat[];
  conclusions: Conclusion[];
  evenementsLus: number;
}

/* --------------------------------- libellés ------------------------------ */

export const KIND_FR: Record<string, string> = {
  login: "Connexions",
  open: "Ouvertures du jour",
  heartbeat: "Temps passé",
  close: "Mises en arrière-plan",
  view: "Pages vues",
  presence: "Réponses de présence",
  vote: "Votes",
  duel: "Duels",
  match: "Matchs d'Arène",
  pack: "Packs ouverts",
  achat: "Achats de cartes",
  recherche: "Recherches",
  compo: "Compositions",
};

export const PATH_FR: Record<string, string> = {
  "/": "Map",
  "/map": "Map",
  "/ligue": "Ligue",
  "/profil": "Ma carte",
  "/profil/saison": "Ma saison",
  "/profil/xp": "Niveau XP",
  "/profil/evolution": "Évolution",
  "/profil/badges": "Badges",
  "/profil/cartes": "Mes cartes",
  "/profil/flair": "Le Flair",
  "/duel": "Collection",
  "/collection": "Collection",
  "/discussions": "Discussions",
  "/boutique": "Boutique",
  "/carte": "Détail de la carte",
  "/vestiaire": "Vestiaire",
  "/agent": "Bola Agent",
  "/avatar": "Photo",
  "/stats": "Historique",
  "/recherche": "Recherche",
  "/ligue-vierge": "Ligue Bola",
  "/bola-team": "Bola Team",
  "/messages": "Messages",
  "/parrainage": "Parrainage",
  "/saisons": "Saisons",
  "/reglages": "Réglages",
  "/palmares": "Wall of Fame",
};

const JOURS_FR = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Les gestes dont on mesure l'effet sur le retour des joueurs. */
const GESTES: { id: string; label: string; geste: string; test: (e: Evenement) => boolean }[] = [
  {
    id: "presence",
    label: "Répondre à une convocation",
    geste: "répondent à une convocation",
    test: (e) => e.kind === "presence",
  },
  { id: "duel", label: "Jouer un duel", geste: "jouent un duel", test: (e) => e.kind === "duel" },
  { id: "vote", label: "Voter", geste: "votent", test: (e) => e.kind === "vote" },
  {
    id: "recherche",
    label: "Chercher un joueur",
    geste: "cherchent un joueur",
    test: (e) => e.kind === "recherche",
  },
  {
    id: "ligue",
    label: "Ouvrir la Ligue",
    geste: "ouvrent la Ligue",
    test: (e) => e.kind === "view" && !!e.path?.startsWith("/ligue"),
  },
  {
    id: "carte",
    label: "Ouvrir Ma carte",
    geste: "ouvrent leur carte",
    test: (e) => e.kind === "view" && !!e.path?.startsWith("/carte"),
  },
  {
    id: "collection",
    label: "Ouvrir la Collection",
    geste: "ouvrent la Collection",
    test: (e) => e.kind === "view" && !!e.path?.startsWith("/collection"),
  },
  {
    id: "palmares",
    label: "Ouvrir le Wall of Fame",
    geste: "ouvrent le Wall of Fame",
    test: (e) => e.kind === "view" && !!e.path?.startsWith("/palmares"),
  },
];

/* --------------------------------- dates --------------------------------- */

/** Minuit local du jour de `ts`. */
export function debutJour(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Minuit local du lendemain (sûr aux changements d'heure). */
const lendemain = (jour: number) => debutJour(jour + 36 * 3600 * 1000);

/** Écart en jours entre deux minuits locaux. */
const ecartJours = (a: number, b: number) => Math.round((b - a) / DAY);

/** Lundi de la semaine de `ts` (minuit local). */
export function lundi(ts: number): number {
  const d = new Date(debutJour(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/** « 19/10 ». */
export function jjmm(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 0 → « — », 95 s → « 2 min », 3 900 s → « 1 h 05 ». */
export function duree(ms: number): string {
  if (!ms || ms < 30_000) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")}`;
}

/** Espace fine insécable tous les trois chiffres, sans dépendre de la locale. */
export const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/** Pourcentage arrondi : 0,456 → « 46 % ». */
export const pct = (x: number) => `${Math.round(x * 100)} %`;

/** Évolution relative, ou null si la base est nulle. */
export function evolution(c: Chiffre): number | null {
  if (c.avant === null || c.avant === 0) return null;
  return (c.valeur - c.avant) / c.avant;
}

/** Au-delà de cet écart entre deux événements, l'app n'était plus au premier plan. */
const TROU = 5 * 60 * 1000;

// Pas des gestes : les signes de vie, et l'invitation aux notifications
// (montrée, puis sa réponse), que la partie Notifications compte à part.
const neutre = (k: string) => k === "heartbeat" || k === "close" || k === "notifs";

/* -------------------------------- analyse -------------------------------- */

export function analyser(
  evenementsBruts: Evenement[],
  profils: Profil[],
  now: number,
  jours: number | null
): Analyse {
  const evenements = [...evenementsBruts].sort((a, b) => a.at - b.at);
  const aujourdhuiT = debutJour(now);

  /* ----------------------------- les sessions ---------------------------- */
  // Une session = un session_id. Les vieux événements n'en ont pas : on les
  // regroupe par joueur et par jour, ce qui reste une approximation honnête.
  const cleSession = (e: Evenement) => e.session ?? `legacy:${e.name}:${debutJour(e.at)}`;
  // Sa durée = le temps réellement passé au premier plan : la somme des
  // écarts entre événements successifs, sans ceux de plus de 5 minutes (l'app
  // émet un battement toutes les 90 s ; un écart plus long, c'est un onglet
  // resté ouvert en arrière-plan, pas du temps passé).
  const sessions = new Map<
    string,
    { name: string; debut: number; fin: number; ms: number; actions: number }
  >();
  for (const e of evenements) {
    const k = cleSession(e);
    const s = sessions.get(k);
    if (s) {
      const ecart = e.at - s.fin;
      if (ecart <= TROU) s.ms += ecart;
      s.fin = e.at;
      if (!neutre(e.kind)) s.actions += 1;
    } else {
      sessions.set(k, { name: e.name, debut: e.at, fin: e.at, ms: 0, actions: neutre(e.kind) ? 0 : 1 });
    }
  }
  const toutesSessions = [...sessions.values()];

  /* ------------------------- par joueur, depuis toujours ------------------ */
  const parJoueur = new Map<string, { premier: number; last: number; jours: Set<number> }>();
  for (const e of evenements) {
    const j = debutJour(e.at);
    const p = parJoueur.get(e.name);
    if (p) {
      p.last = e.at;
      p.jours.add(j);
    } else parJoueur.set(e.name, { premier: e.at, last: e.at, jours: new Set([j]) });
  }

  /* ------------------------------ série par jour -------------------------- */
  const premierJour = evenements.length ? debutJour(evenements[0].at) : aujourdhuiT;
  const nomsParJour = new Map<number, Set<string>>();
  for (const e of evenements) {
    const j = debutJour(e.at);
    if (!nomsParJour.has(j)) nomsParJour.set(j, new Set());
    nomsParJour.get(j)!.add(e.name);
  }
  const nouveauxParJour = new Map<number, number>();
  for (const p of parJoueur.values()) {
    const j = debutJour(p.premier);
    nouveauxParJour.set(j, (nouveauxParJour.get(j) ?? 0) + 1);
  }
  const sessionsParJour = new Map<number, { n: number; ms: number }>();
  for (const s of toutesSessions) {
    const j = debutJour(s.debut);
    const c = sessionsParJour.get(j) ?? { n: 0, ms: 0 };
    c.n += 1;
    c.ms += s.ms;
    sessionsParJour.set(j, c);
  }

  const serie: PointJour[] = [];
  const fenetre: Set<string>[] = [];
  let cumul = 0;
  for (let j = premierJour; j <= aujourdhuiT; j = lendemain(j)) {
    const noms = nomsParJour.get(j) ?? new Set<string>();
    fenetre.push(noms);
    if (fenetre.length > 7) fenetre.shift();
    const hebdo = new Set<string>();
    for (const f of fenetre) f.forEach((n) => hebdo.add(n));
    cumul += nouveauxParJour.get(j) ?? 0;
    const s = sessionsParJour.get(j);
    serie.push({
      t: j,
      actifs: noms.size,
      hebdo: hebdo.size,
      nouveaux: nouveauxParJour.get(j) ?? 0,
      cumul,
      sessions: s?.n ?? 0,
      minutes: Math.round((s?.ms ?? 0) / 60000),
    });
  }

  /* --------------------------- période et d'avant ------------------------- */
  // Une période de N jours = aujourd'hui et les N − 1 jours d'avant.
  const depuis = jours === null ? premierJour : debutJour(aujourdhuiT - (jours - 1) * DAY + DAY / 2);
  const avantDebut =
    jours === null ? null : debutJour(depuis - jours * DAY + DAY / 2);
  const debutPeriode = Math.max(0, serie.findIndex((p) => p.t >= depuis));
  const comparable = avantDebut !== null && avantDebut >= premierJour;

  const dansPeriode = (t: number) => t >= depuis;
  const dansAvant = (t: number) => avantDebut !== null && t >= avantDebut && t < depuis;
  const events = evenements.filter((e) => dansPeriode(e.at));
  const eventsAvant = evenements.filter((e) => dansAvant(e.at));

  const resume = (evs: Evenement[], dans: (t: number) => boolean) => {
    const noms = new Set(evs.map((e) => e.name));
    const joursJoueur = new Set(evs.map((e) => `${e.name}|${debutJour(e.at)}`));
    const ses = toutesSessions.filter((s) => dans(s.debut));
    let nouveaux = 0;
    for (const p of parJoueur.values()) if (dans(p.premier)) nouveaux += 1;
    return {
      actifs: noms.size,
      nouveaux,
      sessions: ses.length,
      temps: ses.reduce((a, s) => a + s.ms, 0),
      joursParJoueur: noms.size ? Math.round((joursJoueur.size / noms.size) * 10) / 10 : 0,
    };
  };
  const ici = resume(events, dansPeriode);
  const la = comparable ? resume(eventsAvant, dansAvant) : null;
  const chiffre = (k: keyof typeof ici): Chiffre => ({ valeur: ici[k], avant: la ? la[k] : null });

  /* ---------------------------- durées de session ------------------------- */
  const sesPeriode = toutesSessions.filter((s) => dansPeriode(s.debut));
  const durees = sesPeriode
    .map((s) => s.ms)
    .filter((d) => d >= 30_000)
    .sort((a, b) => a - b);
  const dureeMoyenne = durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : 0;
  const dureeMediane = durees.length ? durees[Math.floor(durees.length / 2)] : 0;
  const actionsPeriode = events.filter((e) => !neutre(e.kind)).length;

  /* ------------------------ carte des jours et des heures ----------------- */
  // Un « moment de présence » = un joueur, un jour, une heure. Compter les
  // événements bruts donnerait trop de poids aux longues sessions.
  const carte = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
  const vus = new Set<string>();
  for (const e of events) {
    const d = new Date(e.at);
    const k = `${e.name}|${debutJour(e.at)}|${d.getHours()}`;
    if (vus.has(k)) continue;
    vus.add(k);
    carte[(d.getDay() + 6) % 7][d.getHours()] += 1;
  }

  /* --------------------------- actions et pages --------------------------- */
  const parKind = new Map<string, number>();
  for (const e of events) if (!neutre(e.kind)) parKind.set(e.kind, (parKind.get(e.kind) ?? 0) + 1);
  const actions = [...parKind.entries()]
    .map(([k, v]) => ({ label: KIND_FR[k] ?? k, value: v }))
    .sort((a, b) => b.value - a.value);
  const parPage = new Map<string, number>();
  for (const e of events) {
    if (e.kind !== "view" || !e.path) continue;
    const racine = "/" + (e.path.split("/")[1] ?? "");
    parPage.set(racine, (parPage.get(racine) ?? 0) + 1);
  }
  const pages = [...parPage.entries()]
    .map(([p, v]) => ({ label: PATH_FR[p] ?? p, value: v }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  /* -------------------------------- cohortes ------------------------------ */
  const cohortesMap = new Map<number, string[]>();
  for (const [name, p] of parJoueur) {
    const s = lundi(p.premier);
    if (!cohortesMap.has(s)) cohortesMap.set(s, []);
    cohortesMap.get(s)!.push(name);
  }
  const semaineCourante = lundi(now);
  const cohortes: Cohorte[] = [...cohortesMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([semaine, noms]) => {
      const nbSemaines = Math.round((semaineCourante - semaine) / (7 * DAY)) + 1;
      const parts: (number | null)[] = [];
      for (let k = 0; k < nbSemaines; k++) {
        const de = semaine + k * 7 * DAY;
        const a = de + 7 * DAY;
        let n = 0;
        for (const name of noms) {
          const p = parJoueur.get(name)!;
          for (const j of p.jours) {
            if (j >= de - DAY / 2 && j < a - DAY / 2) {
              n += 1;
              break;
            }
          }
        }
        parts.push(n / noms.length);
      }
      return { semaine, taille: noms.length, parts };
    });

  /* -------------------------- courbe de rétention ------------------------- */
  // « Revenu après N jours » : le joueur a été vu au moins une fois N jours
  // ou plus après son premier jour. Seuls comptent ceux arrivés il y a au
  // moins N jours, sinon ils n'ont pas encore eu le temps de revenir.
  const retention: PointRetention[] = [1, 3, 7, 14, 30, 60].map((n) => {
    let eligibles = 0;
    let revenus = 0;
    for (const p of parJoueur.values()) {
      const j0 = debutJour(p.premier);
      if (ecartJours(j0, aujourdhuiT) < n) continue;
      eligibles += 1;
      for (const j of p.jours) {
        if (ecartJours(j0, j) >= n) {
          revenus += 1;
          break;
        }
      }
    }
    return { jours: n, eligibles, revenus };
  });

  /* --------------------------- les gestes qui retiennent ------------------- */
  // Joueurs arrivés il y a au moins 14 jours ; « revenu » = vu à J+7 ou plus.
  // On regarde ce qu'ils ont fait pendant leurs 7 premiers jours.
  const premiereSemaine = new Map<string, Evenement[]>();
  for (const e of evenements) {
    const p = parJoueur.get(e.name)!;
    if (e.at - p.premier >= 7 * DAY) continue;
    if (!premiereSemaine.has(e.name)) premiereSemaine.set(e.name, []);
    premiereSemaine.get(e.name)!.push(e);
  }
  const eligiblesLevier = [...parJoueur.entries()].filter(
    ([, p]) => ecartJours(debutJour(p.premier), aujourdhuiT) >= 14
  );
  const estRevenu = (p: { premier: number; jours: Set<number> }) => {
    const j0 = debutJour(p.premier);
    for (const j of p.jours) if (ecartJours(j0, j) >= 7) return true;
    return false;
  };
  const leviers: Levier[] = GESTES.map((g) => {
    const l: Levier = { id: g.id, label: g.label, geste: g.geste, avec: 0, avecRevenus: 0, sans: 0, sansRevenus: 0 };
    for (const [name, p] of eligiblesLevier) {
      const fait = (premiereSemaine.get(name) ?? []).some(g.test);
      const revenu = estRevenu(p);
      if (fait) {
        l.avec += 1;
        if (revenu) l.avecRevenus += 1;
      } else {
        l.sans += 1;
        if (revenu) l.sansRevenus += 1;
      }
    }
    return l;
  })
    .filter((l) => l.avec >= 5 && l.sans >= 5)
    .sort((a, b) => ecart(b) - ecart(a));

  /* ------------------------------- familles ------------------------------- */
  const emailDe = new Map(profils.map((p) => [p.name, p.contact_email]));
  const familles: Famille[] = [
    { id: "nouveaux", label: "Nouveaux", note: "arrivés cette semaine", noms: [] },
    { id: "fideles", label: "Fidèles", note: "3 jours ou plus sur les 7 derniers", noms: [] },
    { id: "reguliers", label: "De passage", note: "venus cette semaine, 1 ou 2 jours", noms: [] },
    { id: "risque", label: "À risque", note: "plus vus depuis 7 à 14 jours", noms: [] },
    { id: "decroches", label: "Décrochés", note: "plus vus depuis 14 jours", noms: [] },
    { id: "jamais", label: "Jamais venus", note: "compte créé, aucune visite", noms: [] },
  ];
  const fam = (id: FamilleId) => familles.find((f) => f.id === id)!.noms;
  for (const [name, p] of parJoueur) {
    const silence = now - p.last;
    if (silence >= 14 * DAY) fam("decroches").push(name);
    else if (silence >= 7 * DAY) fam("risque").push(name);
    else if (now - p.premier < 7 * DAY) fam("nouveaux").push(name);
    else {
      let j7 = 0;
      for (const j of p.jours) if (ecartJours(j, aujourdhuiT) < 7) j7 += 1;
      fam(j7 >= 3 ? "fideles" : "reguliers").push(name);
    }
  }
  for (const pr of profils) if (!parJoueur.has(pr.name)) fam("jamais").push(pr.name);

  const aRelancer = [...parJoueur.entries()]
    .filter(([, p]) => now - p.last >= 7 * DAY && now - p.last < 45 * DAY && p.jours.size >= 2)
    .map(([name, p]) => ({ name, last: p.last, jours: p.jours.size, email: emailDe.get(name) ?? null }))
    .sort((a, b) => b.jours - a.jours);

  /* ------------------------ détail par joueur (période) -------------------- */
  const detail = new Map<string, { jours: Set<number>; actions: number; sessions: number; temps: number; last: number }>();
  for (const e of events) {
    const d = detail.get(e.name) ?? { jours: new Set<number>(), actions: 0, sessions: 0, temps: 0, last: 0 };
    d.jours.add(debutJour(e.at));
    if (!neutre(e.kind)) d.actions += 1;
    d.last = Math.max(d.last, e.at);
    detail.set(e.name, d);
  }
  for (const s of sesPeriode) {
    const d = detail.get(s.name);
    if (!d) continue;
    d.sessions += 1;
    d.temps += s.ms;
  }
  const joueurs: JoueurStat[] = [...detail.entries()].map(([name, d]) => {
    const p = parJoueur.get(name)!;
    return {
      name,
      premier: p.premier,
      last: d.last,
      jours: d.jours.size,
      joursTotal: p.jours.size,
      actions: d.actions,
      sessions: d.sessions,
      temps: d.temps,
      moyenne: d.sessions ? d.temps / d.sessions : 0,
      email: emailDe.get(name) ?? null,
    };
  });

  /* --------------------------------- creux -------------------------------- */
  const creux = trouverCreux(serie);

  const base = {
    now,
    depuis,
    serie,
    debutPeriode,
    creux,
    chiffres: {
      actifs: chiffre("actifs"),
      nouveaux: chiffre("nouveaux"),
      sessions: chiffre("sessions"),
      temps: chiffre("temps"),
      joursParJoueur: chiffre("joursParJoueur"),
    },
    aujourdhui: serie.at(-1)?.actifs ?? 0,
    semaine: serie.at(-1)?.hebdo ?? 0,
    comptes: profils.length,
    dureeMoyenne,
    dureeMediane,
    actionsParSession: sesPeriode.length ? Math.round((actionsPeriode / sesPeriode.length) * 10) / 10 : 0,
    carte,
    actions,
    pages,
    cohortes,
    retention,
    leviers,
    familles,
    aRelancer,
    joueurs,
    evenementsLus: evenements.length,
  };
  return { ...base, conclusions: conclure(base) };
}

/** Écart de retour entre ceux qui font le geste et les autres (0–1). */
export function ecart(l: Levier): number {
  const a = l.avec ? l.avecRevenus / l.avec : 0;
  const s = l.sans ? l.sansRevenus / l.sans : 0;
  return a - s;
}

/**
 * Le creux le plus marqué : la plus longue suite de jours (au moins 10) où
 * les actifs sur 7 jours restent sous 40 % du pic atteint avant. Ignore les
 * premiers jours, quand le pic lui-même n'existait pas encore.
 */
export function trouverCreux(serie: PointJour[]): Analyse["creux"] {
  let pic = 0;
  let meilleur: Analyse["creux"] = null;
  let debut = -1;
  let plancher = Infinity;
  let picDuCreux = 0;
  const fermer = (fin: number) => {
    if (debut < 0) return;
    const long = fin - debut + 1;
    if (long >= 10 && (!meilleur || long > ecartJoursSerie(meilleur))) {
      meilleur = { de: serie[debut].t, a: serie[fin].t, plancher, pic: picDuCreux };
    }
    debut = -1;
    plancher = Infinity;
  };
  for (let i = 0; i < serie.length; i++) {
    const v = serie[i].hebdo;
    if (pic >= 8 && v < pic * 0.4) {
      if (debut < 0) {
        debut = i;
        picDuCreux = pic;
      }
      plancher = Math.min(plancher, v);
    } else {
      fermer(i - 1);
      pic = Math.max(pic, v);
    }
  }
  fermer(serie.length - 1);
  return meilleur;
}
const ecartJoursSerie = (c: NonNullable<Analyse["creux"]>) => Math.round((c.a - c.de) / DAY) + 1;

/* ------------------------------- conclusions ----------------------------- */

function conclure(a: Omit<Analyse, "conclusions">): Conclusion[] {
  const out: Conclusion[] = [];
  const serie = a.serie;
  const fin = serie.at(-1);
  if (!fin) return out;

  // 1. La tendance : les actifs sur 7 jours, aujourd'hui contre il y a 14 jours.
  const il14 = serie.at(-15);
  if (il14 && il14.hebdo > 0) {
    const d = (fin.hebdo - il14.hebdo) / il14.hebdo;
    if (d >= 0.15) {
      out.push({
        ton: "bon",
        titre: `La ligue repart : ${fin.hebdo} joueurs actifs sur 7 jours`,
        detail: `Contre ${il14.hebdo} il y a deux semaines (+${Math.round(d * 100)} %).`,
        action: "Profiter de l'élan : c'est le moment d'ouvrir des matchs et d'inviter de nouveaux joueurs.",
      });
    } else if (d <= -0.15) {
      out.push({
        ton: "alerte",
        titre: `L'activité baisse : ${fin.hebdo} joueurs actifs sur 7 jours`,
        detail: `Contre ${il14.hebdo} il y a deux semaines (${Math.round(d * 100)} %).`,
        action: "Redonner un rendez-vous : une journée, un défi, ou une notification aux joueurs à relancer.",
      });
    } else {
      out.push({
        ton: "idee",
        titre: `Activité stable : ${fin.hebdo} joueurs actifs sur 7 jours`,
        detail: `${il14.hebdo} il y a deux semaines.`,
        action: "La base tient : la croissance viendra des nouveaux joueurs, pas de ceux déjà là.",
      });
    }
  }

  // 2. Le creux : ce qui se passe quand il n'y a plus de rendez-vous.
  if (a.creux) {
    const c = a.creux;
    const jours = Math.round((c.a - c.de) / DAY) + 1;
    const dans = (t: number) => t >= c.de && t < c.a + DAY;
    out.push({
      ton: "alerte",
      titre: `Un trou de ${Math.round(jours / 7)} semaines, du ${jjmm(c.de)} au ${jjmm(c.a)}`,
      detail: `Les actifs sur 7 jours sont tombés à ${c.plancher}, contre ${c.pic} au plus haut. ${
        a.serie.filter((p) => dans(p.t)).reduce((s, p) => s + p.nouveaux, 0) === 0
          ? "Aucun nouveau joueur pendant ce temps."
          : ""
      }`.trim(),
      action:
        "L'app se vide quand il n'y a pas de match à préparer. Garder un rendez-vous chaque semaine, même sans journée : résultats, classement, duel de la semaine.",
    });
  }

  // 3. La première semaine : combien de nouveaux reviennent.
  const r7 = a.retention.find((r) => r.jours === 7);
  if (r7 && r7.eligibles >= 5) {
    const part = r7.revenus / r7.eligibles;
    const sur10 = Math.round(part * 10);
    out.push({
      ton: part >= 0.5 ? "bon" : "alerte",
      titre: `Sur 10 nouveaux, ${sur10} reviennent après une semaine`,
      detail: `${r7.revenus} joueurs sur ${r7.eligibles} ont rouvert l'app 7 jours ou plus après leur arrivée.`,
      action:
        part >= 0.5
          ? "L'accueil fonctionne : garder la même première expérience pour les prochains."
          : "Soigner la première semaine : un premier match proposé tout de suite, et un rappel à J+3.",
    });
  }

  // 4. Le geste qui retient le plus.
  const meilleur = a.leviers[0];
  if (meilleur && ecart(meilleur) >= 0.1) {
    const avec = meilleur.avecRevenus / meilleur.avec;
    const sans = meilleur.sans ? meilleur.sansRevenus / meilleur.sans : 0;
    out.push({
      ton: "idee",
      titre: `Ceux qui ${meilleur.geste} reviennent plus`,
      detail: `Dans leur première semaine : ${pct(avec)} reviennent s'ils le font (${meilleur.avec} joueurs), ${pct(sans)} sinon (${meilleur.sans} joueurs).`,
      action: `Pousser ce geste dès l'inscription : c'est le meilleur signe qu'un joueur restera.`,
    });
  }

  // 5. Les joueurs à relancer.
  if (a.aRelancer.length >= 2) {
    const avecMail = a.aRelancer.filter((j) => j.email).length;
    out.push({
      ton: "alerte",
      titre: `${a.aRelancer.length} habitués ne viennent plus`,
      detail: `Venus plusieurs jours, plus vus depuis une semaine ou plus. ${
        avecMail === 0 ? "Aucun n'a laissé d'email." : avecMail === 1 ? "Un seul a laissé un email." : `${avecMail} ont laissé un email.`
      }`,
      action: "Les relancer un par un (liste plus bas) : un message perso pour la prochaine journée.",
    });
  }

  // 6. Le meilleur moment : le jour le plus fort, puis son heure la plus forte.
  const parJour = a.carte.map((l) => l.reduce((s, v) => s + v, 0));
  const total = parJour.reduce((s, v) => s + v, 0);
  if (total >= 20) {
    const jourFort = parJour.indexOf(Math.max(...parJour));
    const heures = a.carte[jourFort];
    const heureForte = heures.indexOf(Math.max(...heures));
    out.push({
      ton: "idee",
      titre: `Le jour fort : le ${JOURS_FR[jourFort]}, surtout vers ${heureForte} h`,
      detail: `Le ${JOURS_FR[jourFort]} concentre ${pct(parJour[jourFort] / total)} de la présence de la période.`,
      action: `Envoyer annonces et notifications le ${JOURS_FR[jourFort]} vers ${Math.max(0, heureForte - 1)} h, juste avant ce pic.`,
    });
  }

  // 7. Une seule visite.
  const venus = a.familles.filter((f) => f.id !== "jamais").reduce((s, f) => s + f.noms.length, 0);
  const jamais = a.familles.find((f) => f.id === "jamais")!.noms.length;
  if (jamais >= 3) {
    out.push({
      ton: "alerte",
      titre: `${jamais} comptes créés n'ont jamais servi`,
      detail: `Sur ${a.comptes} comptes créés, ${venus} sont venus au moins une fois.`,
      action: "Leur renvoyer l'invitation et le lien d'installation, ou supprimer les comptes de test.",
    });
  }

  // 8. Ce qui ne sert presque pas.
  const nbActions = a.actions.reduce((s, x) => s + x.value, 0);
  if (nbActions >= 100) {
    const rares = a.actions
      .filter((x) => x.value / nbActions < 0.01 && x.label !== KIND_FR.login)
      .map((x) => x.label.toLowerCase());
    if (rares.length >= 2) {
      out.push({
        ton: "idee",
        titre: "Des fonctions presque jamais utilisées",
        detail: `${capitale(liste(rares))} : moins de 1 % des actions chacune.`,
        action: "Les mettre en avant là où les joueurs passent déjà, ou les retirer pour alléger l'app.",
      });
    }
  }

  // 9. Des sessions courtes.
  if (a.dureeMediane > 0 && a.dureeMediane < 3 * 60000) {
    out.push({
      ton: "idee",
      titre: `Des visites éclair : ${duree(a.dureeMediane)} en médiane`,
      detail: "Les joueurs ouvrent l'app pour une info précise, puis la referment.",
      action: "Mettre l'essentiel dès l'ouverture : le prochain match, qui vient, le dernier résultat.",
    });
  }

  return out;
}

const capitale = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
function liste(x: string[]): string {
  if (x.length <= 1) return x.join("");
  return `${x.slice(0, -1).join(", ")} et ${x.at(-1)}`;
}
