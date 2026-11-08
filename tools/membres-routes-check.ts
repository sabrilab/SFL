// Les routes « membre » et le mot de passe à changer (08/11/2026) : un compte
// qui doit encore changer son mot de passe (une ligne dans
// mot_de_passe_a_changer, d'origine ou provisoire) n'envoie rien, n'écrit
// rien avec la clé secrète et ne lance aucun appel payant par le serveur.
//   · motDePasseChoisi (serveur-ligue.server.ts), sur un faux client : sans
//     ligne oui ; avec une ligne non ; panne non (fermé par défaut) ; table
//     absente oui (aperçu pas migré) ; journal sans identifiant ;
//   · l'inventaire : chaque route de INVENTAIRE passe par son garde
//     (estMembre, ou motDePasseChoisi là où la route ne demandait pas
//     valide), après la session et AVANT son premier effet (envoi, écriture,
//     appel payant, y compris dans une fonction locale qu'elle appelle), avec
//     le refus qu'elle donnait déjà (même message, même code) ;
//   · l'inventaire est fermé : toute route qui ouvre la session d'un appelant
//     puis agit est dans INVENTAIRE, passe par estAdmin avant d'agir, ou est
//     dans EXEMPTES avec sa raison. Une route nouvelle sans garde fait échouer
//     le banc.
//   npx tsx tools/membres-routes-check.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { motDePasseChoisi } from "../src/lib/sfl/serveur-ligue.server";

let verifs = 0;
const ok = (c: boolean, m: string) => {
  assert.ok(c, m);
  verifs++;
};

// ── 1. Le garde partagé ────────────────────────────────────────────────────
type Reponse = { data: unknown; error: { code: string; message: string } | null };
function fauxClient(verrou: Reponse) {
  const lus: string[] = [];
  const sb = {
    from(table: string) {
      return {
        select() {
          return {
            in(_c: string, ids: string[]) {
              lus.push(table);
              if (Array.isArray(verrou.data))
                return Promise.resolve({ ...verrou, data: (verrou.data as { user_id: string }[]).filter((x) => ids.includes(x.user_id)) });
              return Promise.resolve(verrou);
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { sb, lus };
}
const ID = "6f1c2d3e-0000-4000-8000-000000000002";

async function garde() {
  const journal: unknown[][] = [];
  const avant = console.error;
  console.error = (...x: unknown[]) => void journal.push(x);
  try {
    {
      const { sb, lus } = fauxClient({ data: [], error: null });
      ok((await motDePasseChoisi(sb, ID)) === true, "sans ligne : mot de passe choisi");
      ok(lus.length === 1 && lus[0] === "mot_de_passe_a_changer", "une seule lecture, le verrou (pas profiles : valide n'est pas demandé)");
    }
    for (const motif of ["origine", "provisoire"])
      ok((await motDePasseChoisi(fauxClient({ data: [{ user_id: ID, motif }], error: null }).sb, ID)) === false, `ligne « ${motif} » : verrouillé`);
    ok((await motDePasseChoisi(fauxClient({ data: [{ user_id: "autre", motif: "origine" }], error: null }).sb, ID)) === true, "la ligne d'un autre ne compte pas");
    for (const code of ["57014", "08006", "42501", ""])
      ok((await motDePasseChoisi(fauxClient({ data: null, error: { code, message: `panne ${ID}` } }).sb, ID)) === false, `panne ${code} : non (fermé)`);
    for (const code of ["42P01", "PGRST205"])
      ok((await motDePasseChoisi(fauxClient({ data: null, error: { code, message: "absente" } }).sb, ID)) === true, `table absente ${code} : comme avant`);
  } finally {
    console.error = avant;
  }
  ok(journal.length === 4, "une ligne de journal par panne");
  for (const l of journal) {
    const t = l.map(String).join(" ");
    ok(!t.includes(ID) && !t.includes("panne"), `journal sans identifiant ni message : ${t}`);
    ok(/^\[session\] mot_de_passe_a_changer$/.test(String(l[0])), `journal étiqueté : ${t}`);
  }
}

// ── 2. Les routes ──────────────────────────────────────────────────────────
type Garde = "estMembre" | "motDePasseChoisi";
interface Entree {
  route: string;
  methode: "POST";
  garde: Garde;
  /** Le refus, tel que la route le donnait déjà à un compte non validé (ou sans session). */
  refus: string;
  code: 401 | 403;
}
const M = "Réservé aux joueurs de la ligue.";
const ACCEPTE = "Ton compte attend d'être accepté.";
export const INVENTAIRE: Entree[] = [
  // Clé secrète, profiles.valide seul : estMembre.
  { route: "ligue/annoncer", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  { route: "divisions/annoncer", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  { route: "outsider/annoncer", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  { route: "missions/annoncer", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  { route: "divisions/equipes", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  { route: "cartons/annoncer", methode: "POST", garde: "estMembre", refus: "Réservé à la ligue.", code: 403 },
  { route: "matchs/notifier", methode: "POST", garde: "estMembre", refus: M, code: 403 },
  // Jeton de l'appelant, appels payants : estMembre sur le même client.
  { route: "agent", methode: "POST", garde: "estMembre", refus: ACCEPTE, code: 403 },
  { route: "photo-studio", methode: "POST", garde: "estMembre", refus: ACCEPTE, code: 403 },
  { route: "equipes/couverture", methode: "POST", garde: "estMembre", refus: ACCEPTE, code: 403 },
  // Clé secrète, valide lu avec d'autres colonnes : le verrou à côté.
  { route: "suivis", methode: "POST", garde: "motDePasseChoisi", refus: "Compte pas encore accepté.", code: 403 },
  { route: "felicitations", methode: "POST", garde: "motDePasseChoisi", refus: "Compte pas encore accepté.", code: 403 },
  { route: "xp/bilan", methode: "POST", garde: "motDePasseChoisi", refus: M, code: 403 },
  { route: "boutique-xp", methode: "POST", garde: "motDePasseChoisi", refus: M, code: 403 },
  // Clé secrète, la session seule (joueurs Bola compris) : le verrou seul, refus de session.
  { route: "affiche", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "equipes/discussion", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "equipes/notifier", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "matchs/discussion", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "matchs/resultat", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "prives/notifier", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "vestiaire/notifier", methode: "POST", garde: "motDePasseChoisi", refus: "Session requise.", code: 401 },
  { route: "pseudo", methode: "POST", garde: "motDePasseChoisi", refus: "Reconnecte-toi.", code: 401 },
  { route: "identite", methode: "POST", garde: "motDePasseChoisi", refus: "Reconnecte-toi.", code: 401 },
];
/** Ouvrent une session puis agissent, sans être des routes « membre » : la raison. */
const EXEMPTES: Record<string, string> = {
  "inscription/sociale POST": "un compte encore provisoire (Google, Apple) finit son inscription ; un compte fini reçoit 409, et mot_de_passe_a_changer ne concerne que les comptes à mot de passe posés par l'admin",
};

const RACINE = join(import.meta.dirname, "..", "src", "app", "api");
const EFFETS = [
  /\bprevenir\(/,
  /\bnoterFilleul\(/,
  /\bfetch\(/,
  /\.auth\.admin\.\w+\(/,
  /\.insert\(/,
  /\.upsert\(/,
  /\.update\(/,
  /\.delete\(/,
  /\.rpc\(/,
  /\.storage\b/,
];
const SESSION = /\bappelant\(|\.auth\.getUser\(/;

/** Le texte sans commentaires (les « // » d'une URL restent : ils ne suivent pas une espace). */
const sansCommentaires = (s: string) =>
  s
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/^\s*\/\/.*$/gm, (m) => " ".repeat(m.length))
    .replace(/(\s)\/\/\s.*$/gm, (m, e: string) => e + " ".repeat(m.length - 1));

/** Le corps entre l'accolade ouvrante en `de` et sa fermante. */
function corps(s: string, de: number): [number, number] {
  let n = 0;
  for (let i = de; i < s.length; i++) {
    if (s[i] === "{") n++;
    else if (s[i] === "}" && --n === 0) return [de, i + 1];
  }
  throw new Error("accolade non fermée");
}

/** L'accolade qui ouvre le corps d'une fonction dont la liste de paramètres s'ouvre en `par` (types de retour sautés). */
function ouvrante(s: string, par: number): number {
  let i = par;
  for (let n = 0; i < s.length; i++) {
    if (s[i] === "(") n++;
    else if (s[i] === ")" && --n === 0) break;
  }
  // Le type de retour : un « { » qui suit « : », « | », « & », « , », « < » ou « ( » est un type.
  let prof = 0;
  for (i++; i < s.length; i++) {
    const c = s[i];
    if (c === "<" || c === "(" || c === "[") prof++;
    else if ((c === ">" && s[i - 1] !== "=") || c === ")" || c === "]") prof--;
    else if (c === "}") prof--;
    else if (c === "{") {
      const avant = s.slice(0, i).trimEnd().slice(-1);
      if (prof === 0 && !":|&,<(=".includes(avant)) return i;
      prof++;
    }
  }
  throw new Error("corps introuvable");
}

/** Les fonctions de premier niveau du fichier, et leur corps. */
function fonctions(s: string): Map<string, string> {
  const f = new Map<string, string>();
  for (const m of s.matchAll(/^(?:export )?(?:async )?function (\w+)\s*(?:<[^>]*>)?\(/gm)) {
    const [d, e] = corps(s, ouvrante(s, m.index! + m[0].length - 1));
    f.set(m[1], s.slice(d, e));
  }
  for (const m of s.matchAll(/^(?:export )?const (\w+)\s*=\s*(?:async\s*)?\(/gm)) {
    let i = m.index! + m[0].length - 1;
    for (let n = 0; i < s.length; i++) {
      if (s[i] === "(") n++;
      else if (s[i] === ")" && --n === 0) break;
    }
    // Une flèche à corps entre accolades (« ) => { », « ): T => { ») ; sinon une expression, lue jusqu'au bout de la ligne.
    const fleche = /^\)\s*(?::[^=\n]*)?=>\s*\{/.exec(s.slice(i));
    if (fleche) {
      const [d, e] = corps(s, i + fleche[0].length - 1);
      f.set(m[1], s.slice(d, e));
    } else f.set(m[1], s.slice(m.index!, s.indexOf("\n", m.index!)));
  }
  return f;
}

/** Le premier effet de `texte` : un motif d'EFFETS, ou l'appel d'une fonction locale qui en a un. */
function premierEffet(texte: string, agissantes: Set<string>): number {
  let min = Infinity;
  for (const r of EFFETS) {
    const i = texte.search(r);
    if (i >= 0) min = Math.min(min, i);
  }
  for (const n of agissantes) {
    const i = texte.search(new RegExp(`(?<![.\\w])${n}\\(`));
    if (i >= 0) min = Math.min(min, i);
  }
  return min;
}

function analyser(fichier: string) {
  const s = sansCommentaires(readFileSync(fichier, "utf8"));
  const locales = fonctions(s);
  // Les fonctions locales qui agissent, de proche en proche.
  const agissantes = new Set<string>();
  for (let change = true; change; ) {
    change = false;
    for (const [n, c] of locales)
      if (!agissantes.has(n) && premierEffet(c, agissantes) < Infinity) {
        agissantes.add(n);
        change = true;
      }
  }
  const handlers = new Map<string, string>();
  for (const m of s.matchAll(/^export async function (GET|POST|PUT|PATCH|DELETE)\(/gm)) {
    const [d, e] = corps(s, ouvrante(s, m.index! + m[0].length - 1));
    handlers.set(m[1], s.slice(d, e));
  }
  // Premier appel, dans `h`, d'un motif ou d'une fonction locale qui le contient.
  const premier = (h: string, motif: RegExp) => {
    let min = h.search(motif);
    if (min < 0) min = Infinity;
    for (const [n, c] of locales)
      if (motif.test(c)) {
        const i = h.search(new RegExp(`(?<![.\\w])${n}\\(`));
        if (i >= 0) min = Math.min(min, i);
      }
    return min;
  };
  return {
    handlers,
    effet: (h: string) => premierEffet(h, agissantes),
    session: (h: string) => premier(h, SESSION),
    admin: (h: string) => premier(h, /\bestAdmin\(sb, (moi|auth\.user)\.id\)/),
  };
}

function routes(): string[] {
  const out: string[] = [];
  const parcourir = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) parcourir(p);
      else if (n === "route.ts") out.push(relative(RACINE, d));
    }
  };
  parcourir(RACINE);
  return out.sort();
}

function inventaire() {
  const echapper = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const e of INVENTAIRE) {
    const { handlers, effet } = analyser(join(RACINE, e.route, "route.ts"));
    const h = handlers.get(e.methode);
    ok(!!h, `${e.route} : ${e.methode} présent`);
    const g = h!.search(new RegExp(`\\b${e.garde}\\(sb, (moi|auth\\.user|user)\\.id\\)|\\b${e.garde}\\(sb, moi\\)`));
    ok(g >= 0, `${e.route} : ${e.methode} passe par ${e.garde}`);
    const session = h!.search(SESSION);
    ok(session >= 0 && session < g, `${e.route} : la session avant le garde`);
    const f = effet(h!);
    ok(f === Infinity || g < f, `${e.route} : ${e.garde} avant le premier effet (garde ${g}, effet ${f})`);
    // Le refus suit le garde, avec le message et le code d'avant.
    const apres = h!.slice(g, g + 220);
    ok(new RegExp(`${echapper(e.refus)}["'][^]*?${e.code}`).test(apres), `${e.route} : refus « ${e.refus} » ${e.code}`);
    // Plus de test valide seul pour l'appelant là où estMembre le remplace.
    if (e.garde === "estMembre" && e.route !== "matchs/notifier")
      ok(!/select\("valide"\)\s*\.eq\("id",/.test(h!.replace(/\s+/g, " ").replace(/\(\s/g, "(")), `${e.route} : la lecture de valide seule est partie`);
  }
}

function ferme() {
  const dansInventaire = new Set(INVENTAIRE.map((e) => `${e.route} ${e.methode}`));
  const vus: string[] = [];
  for (const r of routes()) {
    const { handlers, effet, session: ouvre, admin: parAdmin } = analyser(join(RACINE, r, "route.ts"));
    for (const [methode, h] of handlers) {
      const cle = `${r} ${methode}`;
      const session = ouvre(h);
      const f = effet(h);
      if (session === Infinity || f === Infinity) continue;
      vus.push(cle);
      if (dansInventaire.has(cle) || EXEMPTES[cle]) continue;
      // Une route d'admin : estAdmin avant d'agir (estAdmin porte déjà le verrou, 04/11/2026).
      const admin = parAdmin(h);
      ok(admin < f, `${cle} : ouvre une session et agit, sans garde (ni inventaire, ni estAdmin avant d'agir, ni exemption)`);
    }
  }
  for (const cle of [...dansInventaire, ...Object.keys(EXEMPTES)]) ok(vus.includes(cle), `${cle} : toujours une route qui agit (sinon la sortir de la liste)`);
}

/** Les crons de vercel.json n'ouvrent aucune session et ne passent par aucun garde de l'inventaire. */
function crons() {
  const v = JSON.parse(readFileSync(join(import.meta.dirname, "..", "vercel.json"), "utf8")) as { crons: { path: string }[] };
  ok(v.crons.length >= 4, "les crons de vercel.json");
  for (const { path } of v.crons) {
    const r = path.replace(/^\/api\//, "");
    const { handlers } = analyser(join(RACINE, r, "route.ts"));
    const h = handlers.get("GET");
    ok(!!h, `cron ${path} : GET`);
    ok(!/\b(estMembre|motDePasseChoisi|appelant)\(/.test(h!), `cron ${path} : ni session ni garde « membre » sur son chemin`);
    ok(/CRON_SECRET/.test(h!), `cron ${path} : présente CRON_SECRET`);
  }
}

async function main() {
  await garde();
  inventaire();
  ferme();
  crons();
  console.log(`membres-routes : ok (${verifs} vérifications, ${INVENTAIRE.length} routes gardées)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
