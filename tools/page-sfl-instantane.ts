// L'instantané de la page publique getbola.app/sfl (13/11/2026, retour de
// Sabri sur bola-app#6 : « Si sfl avec vrais joueurs ») : les vraies cartes
// de la ligue, et seulement celles des joueurs qui ont dit oui à l'usage de
// leur carte hors de l'app.
//
// La page reste statique (ni base, ni saison, ni joueur connecté) : elle
// montre des images, que cet outil fabrique d'une lecture de la base faite
// à la main, en lecture seule, puis contrôlée image par image. Ce qui est
// publié est exactement ce qui a été relu.
//
// Ce que l'outil fait :
//   1. il lit un dossier de lecture HORS DU DÉPÔT (--lecture) : la saison
//      (roster.txt, entrees.txt, journees.json), les votes (votes.txt), les
//      joueurs (joueurs.txt : nom, nom affiché, compte validé, joueur,
//      arbitre, dernier accord hors-app et sa version, majeur oui/non) et la
//      date de la lecture (lecture.txt). Ces fichiers viennent de « select »
//      en lecture seule, écrits plus bas (--requetes les affiche). Une
//      lecture de plus de 24 h est refusée ;
//   2. il rejoue la saison dans le moteur de l'app (deriveSeason,
//      appliquerVotes, titresFaibles, decouper) et en tire les blocs de la
//      page, avec leurs règles (choisirBlocs, plus bas) ;
//   3. il refuse tout joueur qui ne remplit pas les conditions (conditions,
//      plus bas : accord, compte, majeur, photo du studio), en ne le nommant
//      que sur la sortie d'erreur ;
//   4. il dessine chaque carte avec le vrai composant (banc
//      tools/page-sfl-instantane/banc.tsx, esbuild et le Chromium de
//      Playwright, déjà installés) et la photo du studio lue à son adresse
//      publique ;
//   5. il écrit public/sfl/cartes/<nom>-<bloc>.webp (fond transparent, 3 px
//      par px affiché), src/lib/sfl/page-sfl-instantane.ts (généré : la date
//      de lecture, les blocs, les images et leurs empreintes, ACCORDS), et,
//      hors du dépôt (--rendu), accords.md : la preuve, joueur par joueur.
// Rien d'autre n'entre dans le dépôt public : ni la lecture, ni les refus, ni
// les pseudos (ils servent à se connecter), ni les dates d'accord.
//
// Limites, dites dans le compte rendu : les cartes portent la finition de
// base, sans badge, ni cran, ni rang (comme la carte du lien d'un parrain,
// app/p/[code]). Ce que le joueur porte (profiles.habillage, badge, la passe)
// et l'XP de la ligue ne sont pas dans la lecture.
//
// Usage :
//   npx tsx tools/page-sfl-instantane.ts --requetes
//   npx tsx tools/page-sfl-instantane.ts --lecture <dossier> --rendu <dossier> --polices <dossier>
//   npx tsx tools/page-sfl-instantane.ts --verifier --lecture <dossier>
// --polices : un dossier qui tient polices.css et ses woff2 (Inter, Anton,
// Barlow Condensed, ceux de next/font) ; la carte se dessine avec.
// --verifier ne réécrit rien : il compare les joueurs de l'instantané à une
// lecture fraîche, et échoue en nommant celui qui n'a plus l'accord. À jouer
// le jour de la fusion, puis après chaque dimanche révélé.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { VERSION_ACCEPTEE } from "../src/lib/sfl/confidentialite";
import { decouper, rangDansDivision } from "../src/lib/sfl/divisions";
import { ovr, type Journee, type Stats } from "../src/lib/sfl/engine";
import { HIDDEN_PLAYERS } from "../src/lib/sfl/hidden";
import type { Camp } from "../src/lib/sfl/maillots";
import { deriveSeason } from "../src/lib/sfl/saisie/engine";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";
import { appliquerVotes, titresFaibles, type VoteFigure } from "../src/lib/sfl/votes";

const RACINE = join(__dirname, "..");
const SUPABASE = "https://tpfusliksgxcvfrodchk.supabase.co";
const SORTIE_IMAGES = join(RACINE, "public/sfl/cartes");
const SORTIE_TS = join(RACINE, "src/lib/sfl/page-sfl-instantane.ts");
/** Une lecture plus vieille n'est plus la base : l'accord a pu se retirer. */
const FRAICHEUR_H = 24;

// ─────────────────────────── Les requêtes ───────────────────────────

/** Les « select » qui écrivent le dossier de lecture (une ligne par résultat, sans en-tête). */
export const REQUETES: Record<string, string> = {
  "joueurs.txt": `select concat_ws('|', p.name, coalesce(p.nom_affiche, ''), p.valide, p.joue, p.arbitre,
  coalesce(c.hors_app::text, ''), coalesce(c.version, ''),
  case when f.naissance is null then ''
       when f.naissance <= ((now() at time zone 'Europe/Paris')::date - interval '18 years')::date then 'true'
       else 'false' end) as ligne
from public.profiles p
left join lateral (select hors_app, version from public.consentements k
  where k.user_id = p.id order by k.created_at desc, k.id desc limit 1) c on true
left join public.fiches f on f.player_id = p.id
order by p.name;`,
  "roster.txt": `select string_agg(concat_ws('|', r->>'name', coalesce(r->>'poste', '~'), coalesce(r->>'statut', ''),
  coalesce((select string_agg(x, ',') from jsonb_array_elements_text(r->'base') x), '~')), ';')
from public.saison s, jsonb_array_elements(s.data->'roster') r;`,
  "entrees.txt": `select concat_ws('|', e->>'j', e->>'player', e->>'team', e->>'statut', e->>'result', e->>'sflTime',
  coalesce(e->>'buts','0'), coalesce(e->>'passes','0'), coalesce(e->>'cleanSheet','false'), coalesce(e->>'mvp','false'),
  coalesce(e->>'impact','false'), coalesce(e->>'def','false'), coalesce(e->>'retard','false'), coalesce(e->>'arrets','0'),
  coalesce(e->>'interceptions','0'), coalesce(e->>'pepiteBonus','0'), coalesce(e->>'extraTime','false'))
from public.saison s, jsonb_array_elements(s.data->'entries') e order by (e->>'j')::int, e->>'team', e->>'player';`,
  "journees.json": `select jsonb_pretty(s.data->'journees') from public.saison s;`,
  "votes.txt": `select string_agg(concat_ws('|', j, categorie, votant, candidat, match_id, jour), ';' order by j, categorie, votant)
from public.votes_figures where saison = 1;`,
  "lecture.txt": `-- à la main : « lu_le=<heure UTC de la lecture, ISO> »`,
};

// ─────────────────────────── La lecture ───────────────────────────

/** Un profil, tel que la lecture le donne. */
export interface LigneJoueur {
  nom: string;
  affiche: string;
  valide: boolean;
  joue: boolean;
  arbitre: boolean;
  /** La dernière ligne d'accord : true, false, ou null s'il n'y en a aucune. */
  horsApp: boolean | null;
  version: string;
  /** 18 ans révolus : true, false, ou null sans date de naissance. */
  majeur: boolean | null;
}

export interface Lecture {
  luLe: Date;
  saison: Saison;
  votes: VoteFigure[];
  joueurs: Map<string, LigneJoueur>;
}

const bool = (s: string | undefined) => s === "true";
const tri = (s: string | undefined) => (s === "true" ? true : s === "false" ? false : null);

export function lireLecture(dossier: string): Lecture {
  const f = (n: string) => readFileSync(join(dossier, n), "utf8");
  const lu = /^lu_le=(.+)$/m.exec(f("lecture.txt"))?.[1];
  const luLe = new Date(lu ?? "");
  if (Number.isNaN(luLe.getTime())) throw new Error("lecture.txt : « lu_le=… » manque");
  const entries = f("entrees.txt")
    .trim()
    .split("\n")
    .map((l): MatchEntry => {
      const c = l.split("|");
      // concat_ws saute un résultat nul : la colonne suivante est alors un booléen.
      if (c[4] === "true" || c[4] === "false") c.splice(4, 0, "");
      return {
        j: +c[0],
        player: c[1],
        team: c[2],
        statut: c[3] as MatchEntry["statut"],
        result: (c[4] || null) as MatchEntry["result"],
        sflTime: bool(c[5]),
        buts: +c[6],
        passes: +c[7],
        cleanSheet: bool(c[8]),
        mvp: bool(c[9]),
        impact: bool(c[10]),
        def: bool(c[11]),
        retard: bool(c[12]),
        arrets: +c[13],
        interceptions: +c[14],
        ...(+c[15] ? { pepiteBonus: +c[15] } : {}),
        ...(bool(c[16]) ? { extraTime: true } : {}),
      } as MatchEntry;
    });
  const roster = f("roster.txt")
    .trim()
    .split(";")
    .map((l) => {
      const c = l.split("|");
      return { name: c[0], poste: c[1] === "~" ? null : c[1], profil: c[2], base: c[3] === "~" ? null : c[3].split(",").map(Number) };
    });
  const votes = f("votes.txt")
    .trim()
    .split(";")
    .map((l) => {
      const c = l.split("|");
      return { saison: 1, j: +c[0], categorie: c[1], votant: c[2], candidat: c[3], match_id: c[4], jour: c[5] } as unknown as VoteFigure;
    });
  const journees = JSON.parse(f("journees.json")) as Saison["journees"];
  const joueurs = new Map<string, LigneJoueur>();
  for (const l of f("joueurs.txt").split("\n")) {
    if (!l.trim()) continue;
    const c = l.split("|");
    joueurs.set(c[0], {
      nom: c[0],
      affiche: c[1] || c[0],
      valide: bool(c[2]),
      joue: bool(c[3]),
      arbitre: bool(c[4]),
      horsApp: tri(c[5]),
      version: c[6] ?? "",
      majeur: tri(c[7]),
    });
  }
  const saison = { numero: 1, journees, roster, entries, convocations: [] } as unknown as Saison;
  return { luLe, saison, votes, joueurs };
}

// ─────────────────────────── Les conditions ───────────────────────────

/** Ce qui empêche un joueur de paraître, ou null : il passe. `photo` : sa photo du studio existe. */
export function empechement(j: LigneJoueur | undefined, photo: boolean): string | null {
  if (!j) return "aucun profil (compte parti ?) ou absent de la lecture";
  if (j.horsApp !== true) return j.horsApp === false ? "accord hors-app : non" : "aucun accord hors-app enregistré";
  if (!(j.version >= VERSION_ACCEPTEE)) return `accord d'une version périmée (${j.version})`;
  if (!j.valide) return "compte non validé";
  if (!j.joue || j.arbitre) return "ne joue pas (arbitre ou membre)";
  if ((HIDDEN_PLAYERS as readonly string[]).includes(j.nom)) return "joueur masqué";
  if (/^X\d+$/.test(j.nom)) return "place sans joueur";
  if (j.majeur !== true) return j.majeur === false ? "mineur" : "date de naissance inconnue";
  if (!photo) return "pas de photo du studio";
  return null;
}

// ─────────────────────────── Les blocs ───────────────────────────

export type Edition = "mvp" | "impact" | "def";

export interface ChoixCompo {
  j: number;
  date: string;
  match: number;
  camps: { camp: Camp; score: number; joueurs: string[] }[];
}
export interface ChoixTitre {
  edition: Edition;
  nom: string;
  note: number;
  poste: string;
  stats: Stats;
}
export interface ChoixPodium {
  division: "D1" | "D2" | "D3";
  places: { nom: string; place: number; points: number }[];
}
export interface ChoixCarte {
  nom: string;
  poste: string;
  depart: Stats;
  officielle: Stats;
}
export interface Blocs {
  compo: ChoixCompo;
  titres: { j: number; date: string; match: number; cartes: ChoixTitre[] };
  podiums: ChoixPodium[];
  carte: ChoixCarte;
  /** La carte de chacun aujourd'hui (poste, stats officielles), celle que l'app montre. */
  joueurs: Map<string, { poste: string; stats: Stats }>;
}

/**
 * Le haut d'un classement, places 1 à 3 : rang par rang, jusqu'au groupe
 * (ex æquo compris) où se trouve le premier joueur qui ne passe pas. Jamais
 * de trou : un 3e sans accord arrête le podium aux deux premiers.
 */
export function podiumSansTrou(places: { nom: string; place: number; points: number }[], passe: (nom: string) => boolean) {
  const garde: typeof places = [];
  const rangs = [...new Set(places.filter((p) => p.place <= 3).map((p) => p.place))].sort((a, b) => a - b);
  for (const r of rangs) {
    const groupe = places.filter((p) => p.place === r);
    if (!groupe.every((p) => passe(p.nom))) break;
    garde.push(...groupe);
  }
  return garde;
}

/** Les journées jouées (feuilles avec un résultat), de la dernière à la première. */
function jouees(journees: Journee[]): Journee[] {
  return journees.filter((j) => j.matches?.length && j.matches.some((m) => m.teamA.score + m.teamB.score > 0 || m.teamA.players.length)).reverse();
}

export function choisirBlocs(lecture: Lecture, passe: (nom: string) => boolean): Blocs {
  const { saison, votes, luLe } = lecture;
  const brut = deriveSeason(saison);
  const vote = appliquerVotes(saison, brut.journees, votes, luLe);
  const faibles = titresFaibles(saison, brut.journees, votes, luLe);
  const d = deriveSeason(vote, faibles);
  const journees = jouees(d.journees);
  const metaDe = (j: number) => saison.journees.find((x) => x.j === j);

  // Noirs contre Blancs : le premier match dont les dix joueurs passent, de la dernière journée vers la première.
  let compo: ChoixCompo | null = null;
  for (const jo of journees) {
    for (const [i, m] of (jo.matches ?? []).entries()) {
      const noms = [...m.teamA.players, ...m.teamB.players].map((p) => p.name);
      if (noms.length !== 10 || !noms.every(passe)) continue;
      compo = {
        j: jo.j,
        date: metaDe(jo.j)?.date ?? jo.date,
        match: i + 1,
        camps: [
          { camp: "Noirs", score: m.teamA.score, joueurs: m.teamA.players.map((p) => p.name).sort((a, b) => a.localeCompare(b, "fr")) },
          { camp: "Blancs", score: m.teamB.score, joueurs: m.teamB.players.map((p) => p.name).sort((a, b) => a.localeCompare(b, "fr")) },
        ],
      };
      break;
    }
    if (compo) break;
  }
  if (!compo) throw new Error("aucun match dont les dix joueurs ont l'accord");

  // Les trois titres de la même journée, à partir du même match : MVP, puis un Impact
  // (les Noirs d'abord) et une Défensive (les Blancs d'abord), jamais deux au même joueur ;
  // un élu qui ne passe pas cède au même titre du match suivant ; à défaut, la carte est retirée.
  const jour = d.journees.find((x) => x.j === compo.j);
  const matchs = jour?.matches ?? [];
  const lignes = vote.entries.filter((e) => e.j === compo.j);
  const cartes: ChoixTitre[] = [];
  const pris = new Set<string>();
  for (const edition of ["mvp", "impact", "def"] as const) {
    const ordreCamps: ("A" | "B")[] = edition === "def" ? ["B", "A"] : ["A", "B"];
    trouve: for (let k = compo.match - 1; k < matchs.length; k++) {
      const m = matchs[k];
      for (const cote of ordreCamps) {
        const equipe = cote === "A" ? m.teamA : m.teamB;
        for (const p of equipe.players) {
          const l = lignes.find((e) => e.player === p.name && e.team === equipe.name);
          if (!l?.[edition] || pris.has(p.name) || !passe(p.name)) continue;
          const boost = d.boostCards.find((c) => c.type === edition && c.player === p.name && c.date.startsWith(`J${compo.j}`));
          if (!boost) continue;
          cartes.push({ edition, nom: p.name, note: boost.ovr, poste: boost.poste, stats: boost.stats });
          pris.add(p.name);
          break trouve;
        }
      }
    }
  }

  // Le Pépite d'Or : le haut de chaque division, sans trou.
  const dec = decouper(vote);
  const podiums: ChoixPodium[] = (["D1", "D2", "D3"] as const).map((division, i) => {
    const places = dec.divisions[(i + 1) as 1 | 2 | 3].map((p) => ({ nom: p.nom, place: rangDansDivision(dec, p), points: p.pp }));
    return { division, places: podiumSansTrou(places, passe) };
  });

  // Ta carte : la plus forte hausse de la dernière mise à jour, parmi ceux qui passent et ne sont ni en titre ni sur un podium.
  const deja = new Set([...cartes.map((c) => c.nom), ...podiums.flatMap((p) => p.places.map((x) => x.nom))]);
  const somme = (g: Partial<Stats>) => Object.values(g).reduce((s: number, n) => s + (n ?? 0), 0);
  const hausses = [...d.evolution.joueurs.entries()]
    .map(([nom, ev]) => ({ nom, ev, gain: ovr(ev.officielles) - ovr(ev.depart), total: somme(ev.majs.at(-1)?.gains ?? {}) }))
    .filter((h) => h.gain > 0 && !deja.has(h.nom) && passe(h.nom))
    .sort((a, b) => b.gain - a.gain || b.total - a.total || a.nom.localeCompare(b.nom, "fr"));
  const elu = hausses[0];
  if (!elu) throw new Error("aucune carte qui a monté parmi les joueurs qui ont l'accord");
  const poste = d.players.find((p) => p.name === elu.nom)?.poste ?? "";

  return {
    compo,
    titres: { j: compo.j, date: compo.date, match: compo.match, cartes },
    podiums,
    carte: { nom: elu.nom, poste, depart: elu.ev.depart, officielle: elu.ev.officielles },
    joueurs: new Map(d.players.map((p) => [p.name, { poste: p.poste, stats: p.stats }])),
  };
}

/** Tous les joueurs que montrent les blocs (noms de saison). */
export function nomsDesBlocs(b: Blocs): string[] {
  return [...new Set([...b.compo.camps.flatMap((c) => c.joueurs), ...b.titres.cartes.map((c) => c.nom), ...b.podiums.flatMap((p) => p.places.map((x) => x.nom)), b.carte.nom])];
}

// ─────────────────────────── Les images ───────────────────────────

/** Le nom d'un fichier : le nom affiché, sans accent ni signe. */
export function slug(nom: string): string {
  return nom
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** La largeur dessinée de chaque format (px CSS), la capture se fait à 3 px par px. */
const LARGEUR = { pastille: 64, compacte: 150, titre: 220, grande: 320 } as const;
const ECHELLE = 3;

const hex = (nom: string) => Buffer.from(nom, "utf8").toString("hex");
const urlPhoto = (nom: string) => `${SUPABASE}/storage/v1/object/public/photos/${hex(nom)}.jpg`;

/**
 * La photo du studio d'un joueur, à son adresse publique (le bucket « photos »
 * est public) ; null si elle n'existe pas. Par curl : il passe par le proxy
 * de la machine, que fetch de Node 22 ignore.
 */
function lirePhoto(nom: string): Buffer | null {
  const tmp = mkdtempSync(join(tmpdir(), "page-sfl-photo-"));
  try {
    const f = join(tmp, "p");
    const type = execFileSync("curl", ["-sS", "-f", "-o", f, "-w", "%{content_type}", urlPhoto(nom)], { encoding: "utf8" });
    return type.startsWith("image/") ? readFileSync(f) : null;
  } catch {
    return null;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

interface Commande {
  fichier: string;
  carte: { nom: string; affiche: string; poste: string; note: number; stats: Stats; edition: "base" | Edition; largeur: number; photo: string; camp?: Camp };
}

async function dessiner(commandes: Commande[], photos: Map<string, Buffer>, polices: string): Promise<Map<string, { webp: Buffer; l: number; h: number }>> {
  const tmp = mkdtempSync(join(tmpdir(), "page-sfl-banc-"));
  try {
    execFileSync(
      join(RACINE, "node_modules/.bin/esbuild"),
      [
        join(__dirname, "page-sfl-instantane/banc.tsx"),
        "--bundle",
        `--outfile=${join(tmp, "banc.js")}`,
        "--format=iife",
        "--jsx=automatic",
        "--loader:.png=file",
        "--loader:.svg=file",
        "--loader:.woff2=file",
        `--define:process.env.NODE_ENV="production"`,
        `--tsconfig=${join(RACINE, "tsconfig.json")}`,
        `--alias:@=${join(RACINE, "src")}`,
        `--alias:next/dynamic=${join(__dirname, "page-sfl-instantane/next-dynamic.tsx")}`,
        "--log-level=error",
      ],
      { stdio: "inherit" }
    );
    const cartes = commandes.map((c) => c.carte);
    const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/polices.css">
<style>html,body{margin:0;background:transparent}#cartes{display:flex;flex-direction:column;align-items:flex-start;gap:24px;padding:8px}.carte{display:inline-block;line-height:0}</style>
</head><body><div id="cartes"></div><script>window.process={env:{NODE_ENV:"production"}};window.__cartes=${JSON.stringify(cartes)}</script><script src="/banc.js"></script></body></html>`;
    writeFileSync(join(tmp, "index.html"), html);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { chromium } = require("playwright") as typeof import("playwright");
    // Le Chromium déjà installé (/opt/pw-browsers) ; CHROME pour en désigner un autre.
    const installe = existsSync("/opt/pw-browsers")
      ? readdirSync("/opt/pw-browsers")
          .filter((d) => /^chromium-\d+$/.test(d))
          .map((d) => join("/opt/pw-browsers", d, "chrome-linux64/chrome"))
          .find((f) => existsSync(f))
      : undefined;
    const navigateur = await chromium.launch({ executablePath: process.env.CHROME || installe });
    const sortie = new Map<string, { webp: Buffer; l: number; h: number }>();
    try {
      const page = await navigateur.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: ECHELLE });
      const erreurs: string[] = [];
      page.on("pageerror", (e) => erreurs.push(String(e)));
      const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2" };
      await page.route("http://banc.local/**", (r) => {
        const chemin = decodeURIComponent(new URL(r.request().url()).pathname);
        const photo = /^\/photo\/(.+)$/.exec(chemin);
        if (photo && photos.has(photo[1])) return r.fulfill({ status: 200, body: photos.get(photo[1]), contentType: "image/jpeg" });
        const f = [join(tmp, chemin === "/" ? "index.html" : chemin), join(polices, chemin), join(RACINE, "public", chemin)].find((x) => existsSync(x) && statSync(x).isFile());
        if (!f) return r.fulfill({ status: 404, body: "" });
        return r.fulfill({ status: 200, body: readFileSync(f), contentType: TYPES[extname(f)] ?? "application/octet-stream" });
      });
      await page.goto("http://banc.local/", { waitUntil: "load" });
      await page.waitForSelector("body[data-pret]", { timeout: 120_000 });
      await page.waitForTimeout(400);
      if (erreurs.length) throw new Error(`le banc a échoué :\n${erreurs.join("\n")}`);
      for (const [i, c] of commandes.entries()) {
        const el = await page.$(`#carte-${i} > *`);
        if (!el) throw new Error(`carte ${c.fichier} : rien n'est dessiné`);
        const png = await el.screenshot({ omitBackground: true, type: "png" });
        const webp = await page.evaluate(async (b64: string) => {
          const img = new Image();
          img.src = `data:image/png;base64,${b64}`;
          await img.decode();
          const toile = document.createElement("canvas");
          toile.width = img.naturalWidth;
          toile.height = img.naturalHeight;
          toile.getContext("2d")!.drawImage(img, 0, 0);
          const url = toile.toDataURL("image/webp", 0.86);
          if (!url.startsWith("data:image/webp")) throw new Error("WebP refusé par le navigateur");
          return { b64: url.slice(url.indexOf(",") + 1), l: img.naturalWidth, h: img.naturalHeight };
        }, png.toString("base64"));
        sortie.set(c.fichier, { webp: Buffer.from(webp.b64, "base64"), l: webp.l, h: webp.h });
      }
    } finally {
      await navigateur.close();
    }
    return sortie;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// ─────────────────────────── L'écriture ───────────────────────────

const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const NOMS_EDITION: Record<Edition, string> = { mvp: "MVP", impact: "Impact", def: "Défensive" };

function ecrireTs(contenu: Record<string, unknown>, luLe: Date) {
  const js = (v: unknown) => JSON.stringify(v, null, 2);
  const texte = `// GÉNÉRÉ par tools/page-sfl-instantane.ts : ne pas modifier à la main.
//
// L'instantané de la page publique getbola.app/sfl : les vraies cartes de la
// ligue, celles des joueurs dont l'accord hors-app était enregistré « oui » à
// la lecture de la base (LU_LE), et rien d'autre. Les blocs (la compo, la
// carte qui a monté, le haut des divisions, les trois titres) ont été tirés
// de la saison par le moteur de l'app, avec leurs règles (l'outil, choisirBlocs) ;
// chaque carte est une image de public/sfl/cartes, dessinée par le vrai
// composant, à l'empreinte écrite ici. ACCORDS : les noms affichés des
// joueurs montrés ; tools/page-sfl-check.ts refuse tout autre nom.
// Pour rafraîchir : refaire la lecture, relancer l'outil, relire les images.
// Pour vérifier qu'aucun accord ne s'est retiré : l'outil, --verifier.
//
// Pur : des données, ni React, ni base.

/** Une carte, en image : son adresse, sa taille en pixels, son empreinte, son poids, ce qu'en dit un lecteur d'écran. */
export interface ImageCarte {
  src: string;
  largeur: number;
  hauteur: number;
  sha256: string;
  octets: number;
  lue: string;
}

/** L'heure de la lecture de la base (UTC). */
export const LU_LE = ${js(luLe.toISOString())};

/** Les noms affichés des joueurs montrés : chacun avait dit oui. */
export const ACCORDS = ${js(contenu.accords)} as const;

/** Noirs contre Blancs : un vrai match, ses dix joueurs et son score. */
export const COMPO = ${js(contenu.compo)} as const;

/** La carte qui a monté : celle de départ, puis l'officielle. */
export const CARTE_MONTEE = ${js(contenu.carte)} as const;

/** Le haut de chaque division (D3 : personne n'y est encore classé, ou personne ne passe). */
export const PODIUMS = ${js(contenu.podiums)} as const;

/** Les trois titres d'un vrai match : la carte compacte (téléphone) et la complète. */
export const TITRES = ${js(contenu.titres)} as const;
`;
  writeFileSync(SORTIE_TS, texte);
}

async function construire(dossier: string, rendu: string, polices: string) {
  const lecture = lireLecture(dossier);
  const age = (Date.now() - lecture.luLe.getTime()) / 3_600_000;
  if (age > FRAICHEUR_H) throw new Error(`la lecture a ${Math.round(age)} h (plus de ${FRAICHEUR_H} h) : la refaire`);
  if (age < -0.1) throw new Error("la lecture est datée dans le futur");
  if (!existsSync(join(polices, "polices.css"))) throw new Error(`--polices ${polices} : polices.css manque`);

  // Les photos du studio, lues à leur adresse publique, pour qui pourrait paraître.
  const photos = new Map<string, Buffer>();
  const aPhoto = new Map<string, boolean>();
  for (const j of lecture.joueurs.values()) {
    if (empechement(j, true) !== null) continue;
    const p = lirePhoto(j.nom);
    if (p) photos.set(hex(j.nom), p);
    aPhoto.set(j.nom, !!p);
  }
  const passe = (nom: string) => empechement(lecture.joueurs.get(nom), aPhoto.get(nom) === true) === null;

  const blocs = choisirBlocs(lecture, passe);
  const noms = nomsDesBlocs(blocs);
  const refus = noms.filter((n) => !passe(n));
  if (refus.length) {
    for (const n of refus) console.error(`refusé : ${n} (${empechement(lecture.joueurs.get(n), aPhoto.get(n) === true)})`);
    throw new Error("un joueur des blocs ne remplit pas les conditions");
  }
  const affiche = (nom: string) => lecture.joueurs.get(nom)!.affiche;
  const posteDe = (nom: string) => blocs.joueurs.get(nom)?.poste ?? "";
  const statsDe = (nom: string) => blocs.joueurs.get(nom)!.stats;

  const commandes: Commande[] = [];
  const commande = (fichier: string, nom: string, c: Partial<Commande["carte"]> & { largeur: number }) => {
    const stats = c.stats ?? statsDe(nom);
    commandes.push({
      fichier,
      carte: { nom, affiche: affiche(nom), poste: c.poste ?? posteDe(nom), note: c.note ?? ovr(stats), stats, edition: c.edition ?? "base", largeur: c.largeur, photo: `/photo/${hex(nom)}`, camp: c.camp },
    });
    return fichier;
  };
  const img = (fichier: string, lue: string) => ({ fichier, lue });

  const compo = {
    journee: blocs.compo.j,
    date: blocs.compo.date,
    match: blocs.compo.match,
    camps: blocs.compo.camps.map((c) => ({
      camp: c.camp,
      score: c.score,
      joueurs: [...c.joueurs].sort((a, b) => affiche(a).localeCompare(affiche(b), "fr")).map((n) => ({ nom: affiche(n), note: ovr(statsDe(n)), image: img(commande(`${slug(affiche(n))}-compo.webp`, n, { largeur: LARGEUR.pastille, camp: c.camp }), affiche(n)) })),
    })),
  };
  const k = blocs.carte;
  const carte = {
    nom: affiche(k.nom),
    de: ovr(k.depart),
    a: ovr(k.officielle),
    depart: img(commande(`${slug(affiche(k.nom))}-depart.webp`, k.nom, { largeur: LARGEUR.compacte, stats: k.depart, poste: k.poste }), `${affiche(k.nom)}, ${ovr(k.depart)}`),
    officielle: img(commande(`${slug(affiche(k.nom))}-officielle.webp`, k.nom, { largeur: LARGEUR.grande, stats: k.officielle, poste: k.poste }), `${affiche(k.nom)}, ${ovr(k.officielle)}`),
  };
  const podiums = blocs.podiums.map((p) => ({
    division: p.division,
    places: p.places.map((x) => ({
      nom: affiche(x.nom),
      place: x.place,
      points: x.points,
      image: img(commande(`${slug(affiche(x.nom))}-${p.division.toLowerCase()}.webp`, x.nom, { largeur: LARGEUR.compacte }), `${affiche(x.nom)}, ${x.place}${x.place === 1 ? "er" : "e"}, ${x.points} pts`),
    })),
  }));
  const titres = {
    journee: blocs.titres.j,
    date: blocs.titres.date,
    match: blocs.titres.match,
    cartes: blocs.titres.cartes.map((t) => {
      const lue = `${affiche(t.nom)}, carte ${NOMS_EDITION[t.edition]}`;
      const base = { stats: t.stats, note: t.note, poste: t.poste, edition: t.edition };
      return {
        edition: t.edition,
        nom: affiche(t.nom),
        note: t.note,
        petite: img(commande(`${slug(affiche(t.nom))}-${t.edition}-petite.webp`, t.nom, { ...base, largeur: LARGEUR.compacte }), lue),
        complete: img(commande(`${slug(affiche(t.nom))}-${t.edition}.webp`, t.nom, { ...base, largeur: LARGEUR.titre }), lue),
      };
    }),
  };

  // Les images : dessinées, écrites, puis l'instantané les cite avec leur empreinte.
  const dessins = await dessiner(commandes, photos, polices);
  mkdirSync(SORTIE_IMAGES, { recursive: true });
  for (const f of readdirSync(SORTIE_IMAGES)) if (!dessins.has(f)) unlinkSync(join(SORTIE_IMAGES, f));
  const versImage = (i: { fichier: string; lue: string }) => {
    const d = dessins.get(i.fichier)!;
    writeFileSync(join(SORTIE_IMAGES, i.fichier), d.webp);
    return { src: `/sfl/cartes/${i.fichier}`, largeur: d.l, hauteur: d.h, sha256: sha256(d.webp), octets: d.webp.length, lue: i.lue };
  };
  const remplace = <T>(v: T): T =>
    v && typeof v === "object"
      ? "fichier" in (v as object) && "lue" in (v as object)
        ? (versImage(v as unknown as { fichier: string; lue: string }) as unknown as T)
        : Array.isArray(v)
          ? (v.map(remplace) as unknown as T)
          : (Object.fromEntries(Object.entries(v as object).map(([a, b]) => [a, remplace(b)])) as T)
      : v;
  const accords = [...new Set(noms.map(affiche))].sort((a, b) => a.localeCompare(b, "fr"));
  ecrireTs({ accords, compo: remplace(compo), carte: remplace(carte), podiums: remplace(podiums), titres: remplace(titres) }, lecture.luLe);

  // La preuve, hors du dépôt.
  mkdirSync(rendu, { recursive: true });
  const lignes = noms
    .map((n) => lecture.joueurs.get(n)!)
    .sort((a, b) => a.affiche.localeCompare(b.affiche, "fr"))
    .map((j) => `| ${j.affiche} | ${j.nom} | oui | ${j.version} | validé, joueur | majeur | oui |`);
  writeFileSync(
    join(rendu, "accords.md"),
    `# /sfl : les joueurs de l'instantané\n\nPRIVÉ (rendu, jamais dans le dépôt public). Lecture du ${lecture.luLe.toISOString()}, outil tools/page-sfl-instantane.ts.\n\n| Nom affiché | Nom de saison | Dernier accord hors-app | Version | Compte | Âge | Photo du studio |\n|---|---|---|---|---|---|---|\n${lignes.join("\n")}\n`
  );
  const poids = [...dessins.values()].reduce((s, d) => s + d.webp.length, 0);
  console.log(`instantané : ${noms.length} joueurs, ${dessins.size} images (${Math.round(poids / 1024)} ko), lu le ${lecture.luLe.toISOString()}`);
  console.log(`  ${accords.join(", ")}`);
}

async function verifierInstantane(dossier: string) {
  const lecture = lireLecture(dossier);
  const { ACCORDS } = await import("../src/lib/sfl/page-sfl-instantane");
  const parAffiche = new Map([...lecture.joueurs.values()].map((j) => [j.affiche, j]));
  const fautes: string[] = [];
  for (const nom of ACCORDS as readonly string[]) {
    const j = parAffiche.get(nom);
    const e = empechement(j, j ? lirePhoto(j.nom) !== null : false);
    if (e) fautes.push(`${nom} : ${e}`);
  }
  if (fautes.length) {
    console.error(`L'instantané montre des joueurs qui ne passent plus (lecture du ${lecture.luLe.toISOString()}) :\n${fautes.join("\n")}`);
    process.exit(1);
  }
  console.log(`instantané vérifié : ${ACCORDS.length} joueurs, tous avec l'accord (lecture du ${lecture.luLe.toISOString()})`);
}

async function main() {
  const args = process.argv.slice(2);
  const val = (n: string) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (args.includes("--requetes")) {
    for (const [f, q] of Object.entries(REQUETES)) console.log(`-- ${f}\n${q}\n`);
    return;
  }
  const lecture = val("--lecture");
  if (!lecture) throw new Error("--lecture <dossier> manque (voir l'en-tête)");
  if (args.includes("--verifier")) return verifierInstantane(lecture);
  const rendu = val("--rendu");
  const polices = val("--polices");
  if (!rendu || !polices) throw new Error("--rendu <dossier> et --polices <dossier> manquent (voir l'en-tête)");
  await construire(lecture, rendu, polices);
}

if (process.argv[1]?.endsWith("page-sfl-instantane.ts"))
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
