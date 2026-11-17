// Le parcours d'un joueur avant d'acheter Bola Plus (Sabri, 16/11/2026 :
// « suivre en direct les gens qui ont acheté, et comprendre aussi via ça la
// décision d'achat »). Sans table : le parcours se tient sur le téléphone
// (localStorage, par compte), puis part avec le paiement, dans les métadonnées
// de l'abonnement Stripe (bp_*). L'admin les relit chez Stripe
// (/api/bola-plus/ventes, admin/activite/ventes-bola-plus.tsx).
//
// Ce qu'on retient, et rien d'autre :
//   - d'où il est arrivé sur la page, chaque fois (la tuile de Ma carte, le
//     bandeau, l'écran du jour, la convocation payante, ou directement) ;
//   - les fiches ouvertes (maillots, matchs filmés…), et combien de fois ;
//   - la carte la plus loin vue dans le carrousel ;
//   - le nombre de visites, le temps passé sur la page, le premier jour ;
//   - au moment de payer : les heures qui restaient au compte à rebours.

export const SOURCES = ["tuile", "bandeau", "ecran-du-jour", "convocation", "direct"] as const;
export type Source = (typeof SOURCES)[number];
export const NOM_SOURCE: Record<Source, string> = {
  tuile: "Ma carte",
  bandeau: "Bandeau",
  "ecran-du-jour": "Écran du jour",
  convocation: "Convocation",
  direct: "Direct",
};
export const FICHES_SUIVIES = ["bola-27", "maillots", "matchs-filmes", "cadeaux", "ceremonies", "parrainage"] as const;
export const NOM_FICHE: Record<(typeof FICHES_SUIVIES)[number], string> = {
  "bola-27": "Bola 27",
  maillots: "Maillots",
  "matchs-filmes": "Matchs filmés",
  cadeaux: "Cadeaux",
  ceremonies: "Cérémonies",
  parrainage: "Ramène 5",
};

export interface Parcours {
  premiere: string;
  visites: number;
  entrees: Partial<Record<Source, number>>;
  derniere: Source | null;
  fiches: Partial<Record<string, number>>;
  carte: number;
  secondes: number;
}

export const vide = (maintenant: Date): Parcours => ({ premiere: maintenant.toISOString().slice(0, 10), visites: 0, entrees: {}, derniere: null, fiches: {}, carte: 0, secondes: 0 });

const estSource = (v: unknown): v is Source => typeof v === "string" && (SOURCES as readonly string[]).includes(v);
const entier = (v: unknown, max: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

/** Un parcours lu du téléphone (abîmé : vide). */
export function lire(brut: string | null, maintenant: Date): Parcours {
  try {
    const o = JSON.parse(brut ?? "") as Partial<Parcours>;
    if (!o || typeof o !== "object") return vide(maintenant);
    const entrees: Parcours["entrees"] = {};
    for (const s of SOURCES) if (o.entrees?.[s]) entrees[s] = entier(o.entrees[s], 9999);
    const fiches: Parcours["fiches"] = {};
    for (const f of FICHES_SUIVIES) if (o.fiches?.[f]) fiches[f] = entier(o.fiches[f], 9999);
    return {
      premiere: typeof o.premiere === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.premiere) ? o.premiere : vide(maintenant).premiere,
      visites: entier(o.visites, 99999),
      entrees,
      derniere: estSource(o.derniere) ? o.derniere : null,
      fiches,
      carte: entier(o.carte, 99),
      secondes: entier(o.secondes, 10_000_000),
    };
  } catch {
    return vide(maintenant);
  }
}

export const avecEntree = (p: Parcours, s: Source): Parcours => ({ ...p, visites: p.visites + 1, entrees: { ...p.entrees, [s]: (p.entrees[s] ?? 0) + 1 }, derniere: s });
export const avecFiche = (p: Parcours, id: string): Parcours => ((FICHES_SUIVIES as readonly string[]).includes(id) ? { ...p, fiches: { ...p.fiches, [id]: (p.fiches[id] ?? 0) + 1 } } : p);
export const avecCarte = (p: Parcours, i: number): Parcours => (i > p.carte ? { ...p, carte: i } : p);
export const avecTemps = (p: Parcours, s: number): Parcours => ({ ...p, secondes: p.secondes + Math.max(0, Math.floor(s)) });

/** « bandeau:2,tuile:1 » : une table courte en texte (les métadonnées Stripe ne prennent que du texte). */
const enTexte = (t: Partial<Record<string, number>>) =>
  Object.entries(t)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([k, n]) => `${k}:${n}`)
    .join(",");

/** Les métadonnées bp_* qui partent avec le paiement. `resteMs` : le temps qui restait au compte à rebours. */
export function versMetadata(p: Parcours, resteMs: number): Record<string, string> {
  return {
    bp_source: p.derniere ?? "direct",
    bp_entrees: enTexte(p.entrees),
    bp_fiches: enTexte(p.fiches),
    bp_carte: String(p.carte),
    bp_visites: String(p.visites),
    bp_secondes: String(p.secondes),
    bp_premiere: p.premiere,
    bp_rebours_h: String(Math.max(0, Math.round(resteMs / 3_600_000))),
  };
}

/** Côté serveur : on ne garde que les clés connues, en texte court et propre. */
export function nettoyer(brut: unknown): Record<string, string> {
  const o = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const table = (v: unknown, cles: readonly string[]) =>
    String(v ?? "")
      .split(",")
      .map((x) => x.split(":"))
      .filter(([k, n]) => cles.includes(k) && /^\d{1,4}$/.test(n ?? ""))
      .map(([k, n]) => `${k}:${Number(n)}`)
      .join(",");
  const nombre = (v: unknown, max: number) => (/^\d{1,8}$/.test(String(v ?? "")) ? String(Math.min(max, Number(v))) : "0");
  return {
    bp_source: estSource(o.bp_source) ? o.bp_source : "direct",
    bp_entrees: table(o.bp_entrees, SOURCES),
    bp_fiches: table(o.bp_fiches, FICHES_SUIVIES),
    bp_carte: nombre(o.bp_carte, 99),
    bp_visites: nombre(o.bp_visites, 99999),
    bp_secondes: nombre(o.bp_secondes, 10_000_000),
    bp_premiere: /^\d{4}-\d{2}-\d{2}$/.test(String(o.bp_premiere ?? "")) ? String(o.bp_premiere) : "",
    bp_rebours_h: nombre(o.bp_rebours_h, 9999),
  };
}

/** Relire « bandeau:2,tuile:1 » en table. */
export function table(texte: string | undefined): Record<string, number> {
  const t: Record<string, number> = {};
  for (const x of (texte ?? "").split(",")) {
    const [k, n] = x.split(":");
    if (k && /^\d+$/.test(n ?? "")) t[k] = Number(n);
  }
  return t;
}

/** Une vente, telle que l'admin la lit (/api/bola-plus/ventes). */
export interface Vente {
  id: string;
  nom: string;
  formule: string;
  statut: string;
  centimes: number;
  le: number;
  meta: Record<string, string>;
}

/** Ce qui a décidé, sur toutes les ventes vivantes : par source, par fiche, et les moyennes. */
export function decision(ventes: readonly Vente[]) {
  const n = ventes.length;
  const sources: Record<string, number> = {};
  const fiches: Record<string, number> = {};
  let visites = 0;
  let secondes = 0;
  let rebours = 0;
  let avecRebours = 0;
  for (const v of ventes) {
    const s = v.meta.bp_source || "direct";
    sources[s] = (sources[s] ?? 0) + 1;
    for (const f of Object.keys(table(v.meta.bp_fiches))) fiches[f] = (fiches[f] ?? 0) + 1;
    visites += Number(v.meta.bp_visites || 0);
    secondes += Number(v.meta.bp_secondes || 0);
    if (v.meta.bp_rebours_h !== undefined && v.meta.bp_rebours_h !== "") {
      rebours += Number(v.meta.bp_rebours_h);
      avecRebours++;
    }
  }
  return {
    n,
    sources,
    fiches,
    visitesMoy: n ? visites / n : 0,
    minutesMoy: n ? secondes / n / 60 : 0,
    reboursMoyH: avecRebours ? rebours / avecRebours : null,
  };
}

/** Le revenu du mois : les mensuels, plus le douzième des annuels. */
export const mrr = (ventes: readonly Vente[]) =>
  Math.round(ventes.filter((v) => v.statut === "active" || v.statut === "trialing").reduce((s, v) => s + (v.formule === "annuel" ? v.centimes / 12 : v.centimes), 0));
