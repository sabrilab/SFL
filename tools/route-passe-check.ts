// La route des paliers du mode Passe (lib/sfl/route-passe.ts, 01/11/2026) :
// un clic du 9 vers le 16 arrive au 16 et y reste, la flèche ← n'est pas
// annulée, la molette fait un palier par cran, un petit glissé reste un clic.
//   npx tsx tools/route-passe-check.ts
import assert from "node:assert/strict";
import {
  CRAN_MOLETTE,
  FIN_DU_PILOTAGE,
  PAS_ROUTE,
  REPOS_MOLETTE,
  borner,
  estUnClic,
  molette,
  palierAuCentre,
  piloter,
  piloteExpire,
  positionDe,
  sansPilote,
  surDefilement,
  surMolette,
  toucheRoute,
} from "../src/lib/sfl/route-passe";

// 1 · Le palier au centre, et la position d'un palier.
assert.equal(palierAuCentre(0, 16), 1);
assert.equal(palierAuCentre(positionDe(9), 16), 9);
assert.equal(palierAuCentre(positionDe(9) + PAS_ROUTE / 2 - 1, 16), 9);
assert.equal(palierAuCentre(positionDe(9) + PAS_ROUTE / 2 + 1, 16), 10);
assert.equal(palierAuCentre(99_999, 16), 16);
assert.equal(palierAuCentre(-50, 16), 1);
assert.equal(borner(0, 12), 1);
assert.equal(borner(13, 12), 12);

/**
 * Le cas qui cassait : un défilement doux de `de` vers `vers`, avec ses
 * événements (une courbe d'accélération), et l'ancienne règle « chaque
 * événement choisit le palier du centre, chaque choix relance un défilement ».
 * La nouvelle règle : pendant le pilotage, rien ne se choisit.
 */
function simuler(de: number, vers: number, n = 16): number {
  let choisi = vers;
  let p = piloter(sansPilote(), vers, 0);
  const a = positionDe(de);
  const b = positionDe(vers);
  for (let i = 1; i <= 30; i++) {
    const k = i / 30;
    const x = a + (b - a) * (1 - (1 - k) ** 3);
    const r = surDefilement(p, x, i * 16);
    p = r.pilote;
    if (r.choisit) choisi = palierAuCentre(x, n);
  }
  assert.equal(p.cible, null, "le pilotage se lâche à l'arrivée");
  return choisi;
}
assert.equal(simuler(9, 16), 16, "clic 9 → 16");
assert.equal(simuler(16, 9), 9, "clic 16 → 9");
assert.equal(simuler(14, 13), 13, "flèche ← depuis le 14");
assert.equal(simuler(1, 12, 12), 12, "Fin");

// 2 · Le pilotage expire après un silence, même sans atteindre la cible (Safari, un défilement interrompu).
{
  let p = piloter(sansPilote(), 16, 1000);
  p = surDefilement(p, positionDe(12), 1100).pilote;
  assert.equal(p.cible, 16);
  assert.equal(piloteExpire(p, 1100 + FIN_DU_PILOTAGE - 1).cible, 16);
  assert.equal(piloteExpire(p, 1100 + FIN_DU_PILOTAGE).cible, null);
  // Sans pilote, un défilement choisit (le doigt, le trackpad).
  assert.equal(surDefilement(sansPilote(), 300, 0).choisit, true);
}

// 3 · La molette : un cran de 40 px = un palier, puis 250 ms de repos ; l'horizontal reste natif.
{
  let m = molette();
  let r = surMolette(m, 0, 20, 0);
  assert.deepEqual([r.pris, r.pas], [true, 0]);
  m = r.molette;
  r = surMolette(m, 0, CRAN_MOLETTE - 20, 10);
  assert.deepEqual([r.pris, r.pas], [true, 1]);
  m = r.molette;
  r = surMolette(m, 0, 120, 20);
  assert.deepEqual([r.pris, r.pas], [true, 0], "au repos, la molette ne fait rien de plus");
  m = r.molette;
  r = surMolette(m, 0, -120, 10 + REPOS_MOLETTE);
  assert.deepEqual([r.pris, r.pas], [true, -1]);
  r = surMolette(molette(), 80, 10, 0);
  assert.equal(r.pris, false, "le trackpad horizontal défile tout seul");
  // Cinq crans de souris, espacés : cinq paliers.
  let k = molette();
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const x = surMolette(k, 0, 100, i * (REPOS_MOLETTE + 10));
    k = x.molette;
    total += x.pas;
  }
  assert.equal(total, 5);
}

// 4 · Un glissé à la souris de moins de 5 px est un clic.
assert.equal(estUnClic(4), true);
assert.equal(estUnClic(3, 3), true);
assert.equal(estUnClic(5), false);

// 5 · Le clavier : ← →, Début et Fin.
assert.equal(toucheRoute("ArrowLeft", 14, 16), 13);
assert.equal(toucheRoute("ArrowLeft", 1, 16), 1);
assert.equal(toucheRoute("ArrowRight", 16, 16), 16);
assert.equal(toucheRoute("Home", 9, 16), 1);
assert.equal(toucheRoute("End", 9, 12), 12);
assert.equal(toucheRoute("a", 9, 12), null);

console.log("route-passe : ok");
