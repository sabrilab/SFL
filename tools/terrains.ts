// Le catalogue des terrains (lib/sfl/terrains.ts) : la France du
// Recensement des équipements sportifs (tools/terrains-france.ts), le reste
// d'OpenStreetMap (tools/terrains-osm.ts), coupé en cases d'un degré.
//
// Sabri, 23/10 : le Nord ; 26/10 : « la France, la Belgique, la Hollande,
// l'Allemagne, l'Italie, l'Angleterre, l'Espagne, la Suisse […] même le
// Maghreb ».
//
// Écrit :
//   public/terrains/index.json   les sources (citées dans l'app), et par case
//                                son nombre de complexes et ses communes
//   public/terrains/c/<case>.json  les complexes d'une case (« 50_3 » : de
//                                50° à 51° de latitude, de 3° à 4° de longitude)
// L'id d'un complexe commence par sa case (« 50_3:I593780006 ») : un lien
// qui le désigne sait quelle case lire.
//
//   npx tsx tools/terrains.ts                       tout télécharger, puis écrire
//   npx tsx tools/terrains.ts --france=data-es.json --osm=dossier/
//       des tirages déjà faits : l'export du recensement, et pour chaque
//       pays p_XX.json (terrains), s_XX.json (centres), v_XX.json (villes),
//       les réponses aux requêtes de terrains-osm.ts (requetes()).
//
// Le réseau peut couper (les serveurs Overpass sont souvent pleins) : chaque
// requête est retentée, de plus en plus espacée.

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { IndexTerrains, SourceTerrains, TerrainRecense } from "../src/lib/sfl/terrains";
import { EXPORT, SOURCE_FRANCE, complexesFrance, type Equipement } from "./terrains-france";
import { PAYS_OSM, SOURCE_OSM, complexesOsm, requetes, type ReponseOverpass } from "./terrains-osm";

const DOSSIER = join(import.meta.dirname, "..", "public", "terrains");
const OVERPASS = ["https://maps.mail.ru/osm/tools/overpass/api/interpreter", "https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const arg = (nom: string) => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

async function avecRelances<T>(quoi: string, essai: (n: number) => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try {
      return await essai(n);
    } catch (e) {
      if (n >= 30) throw e;
      console.warn(`${quoi} : ${(e as Error).message}, on relance`);
      await new Promise((r) => setTimeout(r, Math.min(60_000, 3_000 * 1.5 ** n)));
    }
  }
}

async function overpass(q: string, quoi: string): Promise<string> {
  return avecRelances(quoi, async (n) => {
    const res = await fetch(OVERPASS[n % OVERPASS.length], {
      method: "POST",
      body: new URLSearchParams({ data: q }),
      headers: { "User-Agent": "BolaTerrains/1.0 (github.com/sabrilab)" },
      signal: AbortSignal.timeout(600_000),
    });
    const texte = await res.text();
    if (!res.ok || /^\s*</.test(texte) || /"remark"\s*:\s*"runtime error/.test(texte)) throw new Error(`Overpass ${res.status}`);
    return texte;
  });
}

async function france(): Promise<{ terrains: TerrainRecense[]; date: string }> {
  const depuis = arg("france");
  if (depuis) return { terrains: complexesFrance(JSON.parse(readFileSync(depuis, "utf8")) as Equipement[]), date: statSync(depuis).mtime.toISOString().slice(0, 10) };
  const lignes = await avecRelances("recensement", async () => {
    const res = await fetch(EXPORT, { signal: AbortSignal.timeout(300_000) });
    if (!res.ok) throw new Error(`recensement ${res.status}`);
    return (await res.json()) as Equipement[];
  });
  return { terrains: complexesFrance(lignes), date: aujourdhui() };
}

async function unPays(pays: string): Promise<{ terrains: TerrainRecense[]; date: string }> {
  const dossier = arg("osm");
  const lire = async (k: "p" | "s" | "v", q: string) =>
    dossier && existsSync(join(dossier, `${k}_${pays}.json`)) ? readFileSync(join(dossier, `${k}_${pays}.json`), "utf8") : overpass(q, `${pays} ${k}`);
  const q = requetes(pays);
  const p = JSON.parse(await lire("p", q.terrains)) as ReponseOverpass;
  const s = JSON.parse(await lire("s", q.centres)) as ReponseOverpass;
  const v = await lire("v", q.villes);
  return { terrains: complexesOsm(pays, p, s, v), date: p.osm3s?.timestamp_osm_base?.slice(0, 10) ?? aujourdhui() };
}

const caseDe = (t: { lat: number; lng: number }) => `${Math.floor(t.lat)}_${Math.floor(t.lng)}`;

async function main() {
  const choisis = arg("pays")?.split(",").filter(Boolean) ?? PAYS_OSM;
  const fr = await france();
  console.log(`FR : ${fr.terrains.length} complexes`);
  const sources: SourceTerrains[] = [{ ...SOURCE_FRANCE, date: fr.date }];
  const tous: TerrainRecense[] = [...fr.terrains];
  const osm: { pays: string[]; date: string } = { pays: [], date: "" };
  for (const pays of choisis) {
    const r = await unPays(pays);
    console.log(`${pays} : ${r.terrains.length} complexes`);
    tous.push(...r.terrains);
    osm.pays.push(pays);
    if (r.date > osm.date) osm.date = r.date;
  }
  if (osm.pays.length) sources.push({ pays: osm.pays, ...SOURCE_OSM, date: osm.date });

  const cases = new Map<string, TerrainRecense[]>();
  for (const t of tous) {
    const c = caseDe(t);
    (cases.get(c) ?? cases.set(c, []).get(c)!).push({ ...t, id: `${c}:${t.id}` });
  }
  rmSync(join(DOSSIER, "c"), { recursive: true, force: true });
  rmSync(join(DOSSIER, "nord.json"), { force: true });
  mkdirSync(join(DOSSIER, "c"), { recursive: true });
  const index: IndexTerrains = { sources, cases: {} };
  for (const [c, terrains] of [...cases.entries()].sort()) {
    terrains.sort((a, b) => a.commune.localeCompare(b.commune, "fr") || a.nom.localeCompare(b.nom, "fr"));
    writeFileSync(join(DOSSIER, "c", `${c}.json`), JSON.stringify(terrains) + "\n");
    const communes = [...new Set(terrains.map((t) => t.commune).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
    index.cases[c] = [terrains.length, ...communes];
  }
  writeFileSync(join(DOSSIER, "index.json"), JSON.stringify(index) + "\n");
  const n = tous.reduce((s, t) => s + t.formats.length, 0);
  console.log(`${tous.length} complexes, ${n} terrains, ${cases.size} cases → ${DOSSIER}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
