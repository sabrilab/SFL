// Le PACK AFRIQUE 2027 (lib/sfl/pack-afrique.ts, components/sfl/afrique/,
// 01/11/2026) :
//   · la liste : codes ISO uniques, chacun dans le registre ; une nation
//     dessinée a son skin dessiné, une phrase et des sources ; seul un skin
//     « valide » se tire ; le solde ne passe jamais sous zéro ;
//   · ce qui ne s'écrit nulle part : aucun nom, sigle ni surnom de la CAF ou
//     des sélections (MOTS_INTERDITS) dans les noms, les phrases, les sources,
//     ni dans les textes de l'écran du pack ; jamais « qualifié » ;
//   · le dessin : du SVG pur (ni <image>, ni filtre, ni adresse http), face et
//     dos ; la palette n'approche ni l'or (MVP), ni le cobalt (Défensive), ni
//     le rouge laqué (Impact).
//   npx tsx tools/pack-afrique-check.ts
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MotifAfriqueSvg } from "../src/components/sfl/afrique/motifs-afrique";
import { SKINS_AFRIQUE } from "../src/components/sfl/afrique/registre";
import { MATIERES } from "../src/components/sfl/finitions-carte";
import {
  etatOuverture,
  MOTS_INTERDITS,
  NATIONS as LISTE,
  nationDeFinition,
  nationsEnJeu,
  nationsMontrees,
  numeroSerieNation,
  PACK_AFRIQUE,
  soldeXp,
  type CodeNation,
  type NationPack,
} from "../src/lib/sfl/pack-afrique";

// La liste, lue comme n'importe quelle liste future (une nation peut être à dessiner, dessinée ou validée).
const NATIONS: readonly NationPack[] = LISTE;

// 1 · La liste.
const codes = NATIONS.map((n) => n.id);
assert.equal(new Set(codes).size, codes.length, "codes uniques");
for (const n of NATIONS) {
  assert.match(n.id, /^[a-z]{2}$/);
  assert.ok(SKINS_AFRIQUE[n.id as CodeNation], `${n.id} au registre`);
  assert.equal(SKINS_AFRIQUE[n.id as CodeNation].nation, n.id);
  assert.ok(`afrique-${n.id}` in MATIERES, `afrique-${n.id} est une matière`);
  assert.equal(nationDeFinition(`afrique-${n.id}`), n.id);
  if (n.etat !== "a-dessiner") {
    const s = SKINS_AFRIQUE[n.id as CodeNation];
    assert.ok(s.dessine, `${n.id} dessiné`);
    assert.ok(s.quoi.trim().length > 10, `${n.id} a sa phrase`);
    assert.ok(s.sources.length >= 1, `${n.id} a ses sources`);
    assert.ok(s.nom.trim().length > 0 && s.nom !== "À dessiner", `${n.id} a son nom`);
  }
}
assert.deepEqual(["ke", "ug", "tz"].every((c) => (NATIONS.find((n) => n.id === c) as { hote?: true }).hote), true, "les trois pays hôtes");
assert.equal(nationDeFinition("afrique-zz"), null);
assert.equal(nationDeFinition("afrique-KE"), null);
for (const n of nationsEnJeu()) assert.equal(NATIONS.find((x) => x.id === n)?.etat, "valide", `${n} se tire : validé`);
assert.ok(nationsMontrees().every((n) => NATIONS.find((x) => x.id === n)?.etat !== "a-dessiner"));
assert.equal(soldeXp(1000, 1200), 0);
assert.equal(soldeXp(3700, 1200), 2500);
assert.equal(soldeXp(-5, 0), 0);
assert.equal(numeroSerieNation(42), "n° 0042");
assert.equal(numeroSerieNation(12345), "n° 12345");
assert.ok(PACK_AFRIQUE.prix >= 1 && Number.isInteger(PACK_AFRIQUE.prix));

// L'état du bouton : fermé tant que rien n'est validé ; sinon ouvrir, manque, complet.
{
  const enJeu = nationsEnJeu();
  if (!enJeu.length) assert.deepEqual(etatOuverture(99999, []), { t: "ferme" });
  else {
    assert.deepEqual(etatOuverture(PACK_AFRIQUE.prix, []), { t: "ouvrir", prix: PACK_AFRIQUE.prix });
    assert.deepEqual(etatOuverture(860, []), { t: "manque", solde: 860, prix: PACK_AFRIQUE.prix });
    assert.equal(etatOuverture(99999, enJeu).t, "complet");
  }
}

// 2 · Ce qui ne s'écrit nulle part.
const interdit = (texte: string) => MOTS_INTERDITS.find((m) => m.test(texte));
const textes: [string, string][] = [["PACK_AFRIQUE.nom", PACK_AFRIQUE.nom]];
for (const n of NATIONS) {
  const s = SKINS_AFRIQUE[n.id as CodeNation];
  textes.push([`${n.id}.nom`, n.nom], [`${n.id}.skin`, s.nom], [`${n.id}.quoi`, s.quoi], [`${n.id}.titre`, s.matiere.titre]);
  for (const src of s.sources) textes.push([`${n.id}.source`, src.titre]);
}
// Les textes de l'écran du pack et de la cérémonie, sans les commentaires ; depuis la relecture du
// 02/11/2026, aussi ceux de chaque skin, de la cérémonie, de Personnaliser, du dos et du compteur.
const ecrans = [
  "../src/components/sfl/mode-passe-packs.tsx",
  "../src/lib/sfl/pack-afrique.ts",
  "../src/app/api/boutique-xp/route.ts",
  "../src/components/sfl/pack-opening.tsx",
  "../src/components/sfl/personnaliser-carte.tsx",
  "../src/components/sfl/mode-passe.tsx",
  "../src/components/sfl/dos-carte.tsx",
  "../src/components/sfl/finitions-carte.ts",
  "../src/components/sfl/compteur-xp.tsx",
  ...readdirSync(new URL("../src/components/sfl/afrique/", import.meta.url)).map((x) => `../src/components/sfl/afrique/${x}`),
];
for (const f of ecrans) {
  const code = readFileSync(new URL(f, import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/MOTS_INTERDITS[\s\S]*?\];/, "");
  for (const m of code.matchAll(/"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)) textes.push([f, m[1] ?? m[2] ?? m[3]]);
}
for (const [ou, t] of textes) {
  const m = interdit(t);
  assert.equal(m, undefined, `${ou} : « ${t} » contient ${m}`);
  assert.ok(!/qualifi/i.test(t), `${ou} : « ${t} » dit « qualifié »`);
}
// Les mots interdits attrapent bien ce qu'ils doivent.
for (const t of ["CAN 2027", "Coupe d'Afrique des Nations", "AFCON", "la CAF", "Les Lions", "Pharaons", "Super Eagles"]) assert.ok(interdit(t), t);
for (const t of ["Kanga", "Manjak", "Teleuk", "canevas", "Pays hôte"]) assert.ok(!interdit(t), t);

// 3 · Le dessin : du SVG pur, face et dos.
for (const n of NATIONS) {
  const s = SKINS_AFRIQUE[n.id as CodeNation];
  for (const dos of [false, true]) {
    const svg = renderToStaticMarkup(
      createElement(MotifAfriqueSvg, { motif: { type: "afrique", nation: n.id as CodeNation, ...s.matiere.motif }, graine: 12345, dos, nom: "Ilyes" })
    );
    assert.ok(svg.startsWith("<svg"), `${n.id} rend un svg`);
    assert.ok(!/<image\b/i.test(svg), `${n.id} sans <image>`);
    assert.ok(!/<filter\b|filter=/i.test(svg), `${n.id} sans filtre`);
    assert.ok(!/href="http/i.test(svg), `${n.id} sans adresse`);
    const elements = (svg.match(/<[a-zA-Z]/g) ?? []).length;
    assert.ok(elements <= 4000, `${n.id} ${dos ? "dos" : "face"} : ${elements} éléments`);
    // Stable pour une même graine.
    assert.equal(
      renderToStaticMarkup(createElement(MotifAfriqueSvg, { motif: { type: "afrique", nation: n.id as CodeNation, ...s.matiere.motif }, graine: 12345, dos, nom: "Ilyes" })).replace(/id="[^"]*"|url\(#[^)]*\)|href="#[^"]*"/g, ""),
      svg.replace(/id="[^"]*"|url\(#[^)]*\)|href="#[^"]*"/g, ""),
      `${n.id} stable`
    );
  }
}

// 4 · La palette n'approche pas les couleurs des cartes à titre.
function hsl(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => x / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}
const reservees = (["mvp", "def", "impact"] as const).map((k) => [k, hsl(MATIERES[k].vive)] as const);
const ecart = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const proches: string[] = [];
for (const n of NATIONS) {
  const json = JSON.stringify(SKINS_AFRIQUE[n.id as CodeNation].matiere);
  for (const hex of new Set(json.match(/#[0-9a-fA-F]{6}\b/g) ?? [])) {
    const [h, s, l] = hsl(hex);
    for (const [k, [rh, rs]] of reservees) {
      if (ecart(h, rh) > 15 || l < 0.25 || l > 0.8) continue;
      assert.ok(s < Math.min(0.55, rs - 0.08), `${n.id} : ${hex} approche la couleur ${k}`);
      if (s >= 0.45) proches.push(`${n.id} ${hex} (près de ${k})`);
    }
  }
}
if (proches.length) console.log(`  à trancher (Q2, terres) : ${proches.join(", ")}`);
console.log("pack-afrique : ok");
