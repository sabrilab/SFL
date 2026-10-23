// Vérifie qu'aucune place ne touche une autre sur le terrain d'un match
// (lib/sfl/places-terrain.ts), de 2 à 22 joueurs :
//   npx tsx tools/places-terrain-check.ts
// Chaque carte (pastille et étiquette) est une boîte à l'écran ; deux boîtes
// ne se recouvrent jamais, aucune ne mord sur le logo du rond central, aucune
// pastille sur la ligne du rond, et chaque carte a les pieds sur le terrain.
import assert from "node:assert/strict";
import {
  boitesDeCarte,
  CERCLE,
  hautDeCarte,
  logoProjete,
  PASTILLE,
  placerTerrain,
  VUE_PLACES,
} from "../src/lib/sfl/places-terrain";

const logo = logoProjete();
for (let n = 2; n <= 22; n++) {
  const d = placerTerrain(n);
  assert.equal(d.places.length, n, `${n} joueurs : ${d.places.length} places`);
  const boites = d.places.map((p) => {
    const demi = ((PASTILLE + (p.i === 0 ? CERCLE : 0)) / 2) * p.k;
    const etiquette = (p.etiquette / 2) * p.k;
    const l = Math.max(demi, etiquette);
    return { p, gauche: p.x - l, droite: p.x + l, haut: hautDeCarte(p), bas: p.y };
  });
  for (const a of boites) {
    assert.ok(a.p.v >= 10 && a.p.v <= VUE_PLACES.h - 10, `${n} joueurs : la place ${a.p.i} hors du terrain (v = ${a.p.v})`);
    assert.ok(a.haut >= d.haut - 0.5 && a.bas <= d.bas + 0.5, `${n} joueurs : la place ${a.p.i} sort du cadre`);
    // Le logo : devant, le haut des cartes reste dessous ; au fond, leurs pieds restent dessus.
    if (a.p.chezMoi) assert.ok(a.haut >= logo.bas, `${n} joueurs : la place ${a.p.i} mord sur le logo`);
    else assert.ok(a.bas <= logo.haut, `${n} joueurs : la place ${a.p.i} mord sur le logo`);
    assert.ok(!boitesDeCarte(a.p).surLeRond, `${n} joueurs : la place ${a.p.i} mord sur la ligne du rond central`);
    for (const b of boites) {
      if (a === b) continue;
      const touche = a.gauche < b.droite && b.gauche < a.droite && a.haut < b.bas && b.haut < a.bas;
      assert.ok(!touche, `${n} joueurs : les places ${a.p.i} et ${b.p.i} se touchent`);
    }
  }
  console.log(
    `${String(n).padStart(2)} joueurs · cadre ${Math.round(d.bas - d.haut)} px · cartes ×${d.reduction.toFixed(2)}`
  );
}
console.log("Aucune place ne se chevauche, de 2 à 22 joueurs.");
