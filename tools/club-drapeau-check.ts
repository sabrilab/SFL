// Bola Club : le drapeau en PRODUCTION (bola-app#14, lib/sfl/club/drapeau.ts).
// Le banc du club (tools/club-check.ts) tourne drapeau levé, comme l'aperçu ;
// celui-ci pose d'abord l'environnement de la production, puis charge le
// code : rien du club ne doit y paraître.
//   1 · BOLA_CLUB est faux, et le marqueur posé à la main sur le téléphone
//       ne fait pas apparaître le club dans le menu des ligues ; il n'est
//       pas posé non plus ;
//   2 · toutes les pages du club sont sous app/club/, dont la mise en page
//       répond « introuvable » hors du drapeau, avant tout contenu ;
//   3 · le menu des ligues, chargé par tous les joueurs, ne tire du club que
//       le drapeau et le marqueur : la démo, le moteur et l'état ne sont
//       chargés qu'à part, marqueur posé.
//   npx tsx tools/club-drapeau-check.ts
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let n = 0;
const ok = (cond: unknown, quoi: string) => {
  assert.ok(cond, quoi);
  n++;
};

async function main() {
// 1 · la production
process.env.NEXT_PUBLIC_BOLA_ENV = "production";
const garde = new Map<string, string>([["bola-club-demo", "2026-11-12T00:00:00.000Z"]]);
const stockage = {
  getItem: (k: string) => garde.get(k) ?? null,
  setItem: (k: string, v: string) => void garde.set(k, v),
  removeItem: (k: string) => void garde.delete(k),
};
Object.assign(globalThis, { window: globalThis, localStorage: stockage });
const { BOLA_CLUB, MARQUEUR_CLUB } = await import("../src/lib/sfl/club/drapeau");
const { clubOuvert, marquerClubOuvert } = await import("../src/lib/sfl/club/marqueur");
ok(BOLA_CLUB === false, "en production, le drapeau est baissé");
ok(MARQUEUR_CLUB === "bola-club-demo" && garde.has(MARQUEUR_CLUB), "le marqueur est posé à la main sur ce téléphone");
ok(clubOuvert() === false, "en production, le marqueur posé à la main n'ouvre pas le club");
garde.clear();
marquerClubOuvert();
ok(garde.size === 0, "en production, le marqueur n'est jamais posé");

// 2 · les pages du club, toutes derrière la mise en page qui les ferme
const SRC = new URL("../src/", import.meta.url).pathname;
const lire = (p: string) => readFileSync(join(SRC, p), "utf8");
const fichiers = (dossier: string): string[] =>
  readdirSync(join(SRC, dossier)).flatMap((f) => (statSync(join(SRC, dossier, f)).isDirectory() ? fichiers(join(dossier, f)) : [join(dossier, f)]));
const layout = lire("app/club/layout.tsx");
ok(/if \(!BOLA_CLUB\) notFound\(\);/.test(layout), "la mise en page du club répond introuvable hors du drapeau");
ok(layout.indexOf("if (!BOLA_CLUB) notFound();") < layout.indexOf("return ("), "avant tout contenu");
ok(/import \{ BOLA_CLUB \} from "@\/lib\/sfl\/club\/drapeau";/.test(layout), "elle lit le drapeau lui-même");
const pages = fichiers("app").filter((f) => /(^|\/)(page|route|layout)\.tsx?$/.test(f));
const duClub = (f: string) => /@\/(components\/sfl\/club\/|lib\/sfl\/club\/(?!drapeau|marqueur)|hooks\/use-club")/.test(lire(f));
ok(pages.filter((f) => f.startsWith("app/club/")).length >= 8, "les pages du club sont là");
for (const f of pages) if (!f.startsWith("app/club/")) ok(!duClub(f), `${f} : hors de /club, aucune page ne tire le club`);
ok(!existsSync(join(SRC, "app/club/not-found.tsx")) || !duClub("app/club/not-found.tsx"), "pas de page introuvable qui montrerait le club");

// 3 · ce que le reste de l'app tire du club : le drapeau et le marqueur, rien d'autre
const ailleurs = [...fichiers("components"), ...fichiers("hooks"), ...fichiers("lib"), ...fichiers("app")].filter(
  (f) => /\.tsx?$/.test(f) && !f.startsWith("components/sfl/club/") && !f.startsWith("lib/sfl/club/") && !f.startsWith("app/club/") && f !== "hooks/use-club.ts",
);
const tirent = ailleurs.filter((f) => /from "@\/(lib\/sfl\/club\/|components\/sfl\/club\/|hooks\/use-club)/.test(lire(f)));
assert.deepStrictEqual(tirent.sort(), ["components/sfl/choix-ligue.tsx", "hooks/use-club-menu.ts"], "seuls le menu des ligues et son hook connaissent le club");
n++;
ok(!/from "@\/(lib\/sfl\/club\/|components\/sfl\/club\/|hooks\/use-club")/.test(lire("components/sfl/choix-ligue.tsx")), "le menu des ligues ne passe que par son hook léger");
const menu = lire("hooks/use-club-menu.ts");
const statiques = [...menu.matchAll(/^import (?!type)[^;]*from "(@\/lib\/sfl\/club\/[^"]+)";/gm)].map((m) => m[1]).sort();
assert.deepStrictEqual(statiques, ["@/lib/sfl/club/drapeau", "@/lib/sfl/club/marqueur"], "le hook du menu ne charge d'office que le drapeau et le marqueur");
n++;
ok(/import\("@\/lib\/sfl\/club\/store"\)/.test(menu) && /if \(!ouvert\) return;/.test(menu), "l'état du club n'est chargé qu'à part, marqueur posé");
const marqueur = lire("lib/sfl/club/marqueur.ts");
ok([...marqueur.matchAll(/from "([^"]+)"/g)].every((m) => m[1] === "./drapeau"), "le marqueur ne tire que le drapeau");
ok([...lire("lib/sfl/club/drapeau.ts").matchAll(/^import /gm)].length === 0, "le drapeau ne tire rien");

console.log(`club-drapeau: ok (${n} vérifications)`);
}
void main();
