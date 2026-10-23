// Vérifie que, sur le terrain d'une journée (lib/sfl/places-journee.ts),
// aucune carte ne cache la carte ou l'étiquette d'une autre, de 1 à 10
// joueurs par équipe, avec ou sans gardien, prénoms courts, longs ou mêlés :
//   npx tsx tools/places-journee-check.ts
// Chaque carte et chaque étiquette est une boîte à l'écran ; deux boîtes ne
// se recouvrent jamais, chaque carte tient dans le cadre, et un prénom qui
// prend la place de ses voisins ne sort pas du terrain d'un téléphone.
import assert from "node:assert/strict";
import { boitesDe, chevauchement, hauteurCarte, placerJournee, type EquipeAPlacer } from "../src/lib/sfl/places-journee";

// Un hasard qui se répète d'un lancement à l'autre.
let graine = 23102026;
const hasard = () => ((graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648);

const PRENOMS = {
  courts: () => 36 + hasard() * 20,
  longs: () => 110 + hasard() * 40,
  meles: () => 36 + hasard() * 110,
};

let cas = 0;
let plusPetite = 1;
for (const [genre, largeur] of Object.entries(PRENOMS))
  for (let na = 1; na <= 10; na++)
    for (let nb = 1; nb <= 10; nb++)
      for (const [ga, gb] of [
        [false, false],
        [true, true],
        [true, false],
        [false, true],
      ]) {
        const equipe = (nombre: number, gardien: boolean): EquipeAPlacer => ({
          nombre,
          gardien,
          vedette: hasard() < 0.2 ? -1 : Math.floor(hasard() * nombre),
          etiquettes: Array.from({ length: nombre }, largeur),
        });
        const a = equipe(na, ga);
        const b = equipe(nb, gb);
        const d = placerJournee(a, b);
        const nom = `${na}${ga ? "+G" : ""} contre ${nb}${gb ? "+G" : ""}, prénoms ${genre}`;
        assert.equal(d.places.length, na + nb, `${nom} : ${d.places.length} places`);
        const touche = chevauchement(d.places);
        assert.equal(touche, null, `${nom} : ${touche?.map((p) => `${p.equipe}/${p.i}`).join(" et ")} se touchent`);
        for (const p of d.places) {
          const [carte] = boitesDe(p);
          assert.ok(p.y - hauteurCarte(p.taille) * p.k >= d.haut - 0.5 && p.y <= d.bas + 0.5, `${nom} : ${p.equipe}/${p.i} sort du cadre`);
          assert.ok(carte.haut < carte.bas, `${nom} : ${p.equipe}/${p.i} sans carte`);
          const voulue = (p.equipe === 0 ? a : b).etiquettes![p.i];
          assert.ok(p.etiquette >= 28, `${nom} : l'étiquette de ${p.equipe}/${p.i} n'a que ${p.etiquette.toFixed(0)} px`);
          // Une étiquette ne dépasse ni son prénom entier (au-delà de sa part) ni le terrain d'un téléphone de 375 px.
          if (p.etiquette > 84.01) assert.ok(p.etiquette <= Math.max(voulue, 120) + 0.01, `${nom} : l'étiquette de ${p.equipe}/${p.i} plus large que son prénom`);
          assert.ok(Math.abs(p.x) + (p.etiquette * p.k) / 2 <= 150.5, `${nom} : l'étiquette de ${p.equipe}/${p.i} sort du terrain (${(Math.abs(p.x) + (p.etiquette * p.k) / 2).toFixed(1)} px)`);
        }
        plusPetite = Math.min(plusPetite, d.reduction);
        cas++;
      }
console.log(`${cas} terrains, cartes ×${plusPetite.toFixed(2)} au plus serré : aucune carte ne cache une autre carte ni un prénom.`);
