// Le point fort « Impact » de la fiche d'un joueur (Ilyes, 03/11/2026 : « pour
// les Impact dans les points forts de la fiche joueur, tu peux les ajouter »).
// Anas, 1er de la ligue en Impact (le Joueur Impact de son équipe, élu à
// chaque match), ne le voyait jamais : fiche-joueur.ts n'avait que les buts,
// les passes, le MVP, Le Mur et le Pépite d'Or.
//
// Ce que le banc vérifie, sur une ligue inventée de six joueurs :
//   1 · le 1er en Impact voit « 3 fois Impact · 1er en Impact », et sa phrase
//       commence par « Le Joueur Impact de la ligue. » ;
//   2 · sur le podium : « 2e en Impact », « Sur le podium des Joueurs Impact. » ;
//   3 · ex æquo : deux joueurs à égalité sont tous deux « 1er en Impact » ;
//       une place partagée vaut la dernière du groupe (rang + ex æquo − 1) :
//       un MVP que trois joueurs partagent passe derrière un 2e passeur seul,
//       « Le … de la ligue. » ne se dit que seul en tête, et « Sur le
//       podium » qu'à trois ex æquo au plus (deux 3es buteurs y sont) ;
//   3 bis · la vraie saison au 04/11 : un seul titre Impact, que 17 joueurs
//       partagent, ne passe pas devant un vrai 3e buteur, ni dans ses points
//       forts ni dans sa phrase ;
//   4 · un joueur sans Impact n'a pas ce point fort ;
//   5 · l'ordre et le nombre : trois points forts au plus, les meilleurs rangs
//       d'abord, la présence entière (« toujours là ») garde sa place ;
//   6 · Bola Agent : le dossier porte le point fort et le classement Impact,
//       et le débrief cite l'Impact et Le Mur du jour.
//   npx tsx tools/points-forts-check.ts
import assert from "node:assert/strict";
import { dossierJoueur, questionDebrief } from "../src/lib/sfl/agent";
import type { Player } from "../src/lib/sfl/engine";
import { ficheJoueur } from "../src/lib/sfl/fiche-joueur";
import { definirArbitres } from "../src/lib/sfl/hidden";
import type { MatchEntry, Saison } from "../src/lib/sfl/saisie/types";

definirArbitres([]);

type Chiffres = Partial<Pick<Player, "buts" | "passes" | "mvp" | "impact" | "def" | "pp">> & { presences?: number };

const joueur = (name: string, c: Chiffres): Player => ({
  name,
  poste: "MIL",
  pp: c.pp ?? 0,
  matchs: c.presences ?? 4,
  buts: c.buts ?? 0,
  passes: c.passes ?? 0,
  statut: "Actif",
  stats: { VIT: 70, TIR: 70, PAS: 70, DRI: 70, DEF: 70, PHY: 70 },
  mvp: c.mvp ?? 0,
  impact: c.impact ?? 0,
  def: c.def ?? 0,
});

const ligne = (j: number, player: string, autre: Partial<MatchEntry> = {}): MatchEntry => ({
  j, player, team: null, statut: "Présent", result: "Victoire", sflTime: false,
  buts: 0, passes: 0, cleanSheet: false, mvp: false, impact: false, def: false, retard: false, ...autre,
});

const DATES = ["11 oct.", "18 oct.", "25 oct.", "1 nov."];
/** Une saison de quatre dimanches : chacun présent à ses `presences` premiers dimanches. */
function saisonDe(joueurs: Player[], j4: Partial<Record<string, Partial<MatchEntry>>> = {}): Saison {
  return {
    numero: 1,
    journees: DATES.map((date, i) => ({ j: i + 1, date, sflTime: false })),
    roster: [],
    entries: joueurs.flatMap((p) =>
      [1, 2, 3, 4].filter((j) => j <= p.matchs).map((j) => ligne(j, p.name, j === 4 ? j4[p.name] : {}))
    ),
    convocations: [],
  } as Saison;
}

const fiche = (nom: string, joueurs: Player[], s = saisonDe(joueurs)) => ficheJoueur(s, joueurs.find((p) => p.name === nom)!, joueurs);
const forts = (nom: string, joueurs: Player[]) => fiche(nom, joueurs).forts.map((f) => `${f.chiffre} ${f.quoi} · ${f.rang}`);

/* ------------------------------ La ligue A ------------------------------ */
const A = [
  joueur("Anas", { buts: 3, passes: 2, impact: 3, pp: 20 }),
  joueur("Youss", { buts: 9, passes: 6, mvp: 2, impact: 2, def: 2, pp: 40 }),
  joueur("Selim", { buts: 5, passes: 1, mvp: 1, impact: 1, pp: 30 }),
  joueur("Ilyes", { buts: 4, passes: 7, mvp: 1, def: 1, pp: 25 }),
  joueur("Karim", { buts: 1, def: 3, pp: 10, presences: 2 }),
  joueur("Nolan", { pp: 4 }),
];

// 1 · Le 1er en Impact.
{
  const f = fiche("Anas", A);
  assert.deepEqual(forts("Anas", A), ["3 fois Impact · 1er en Impact", "4/4 dimanches · toujours là", "2 passes · 3e passeur"]);
  assert.deepEqual(
    { ...f.forts[0] },
    { chiffre: "3", quoi: "fois Impact", rang: "1er en Impact", classement: "impact", place: 1, titre: "en Impact" }
  );
  assert.equal(f.synthese, "Le Joueur Impact de la ligue. Un but tous les deux matchs, et jamais absent un dimanche.");
}

// 5 · L'ordre et le nombre : Youss est 1er buteur, en MVP et au Pépite d'Or ;
// son Impact (2e) ne pousse aucun meilleur rang, il reste trois points forts.
assert.deepEqual(forts("Youss", A), ["9 buts · 1er buteur", "2 MVP · 1er en MVP", "40 pts Pépite · 1er au Pépite d'Or"]);
for (const p of A) assert.ok(fiche(p.name, A).forts.length <= 3, `${p.name} : trois points forts au plus`);

// 4 · Sans Impact, pas de point fort Impact (Ilyes, Karim, Nolan).
for (const nom of ["Ilyes", "Karim", "Nolan"]) {
  assert.ok(!fiche(nom, A).forts.some((f) => f.classement === "impact"), `${nom} : pas d'Impact`);
}

/* ------------------------------ Le podium ------------------------------ */
// 2 · Mehdi, 2e en Impact, absent deux dimanches : son meilleur rang est l'Impact.
{
  const B = [
    joueur("Anas", { buts: 3, impact: 3, pp: 20 }),
    joueur("Mehdi", { impact: 2, pp: 5, presences: 2 }),
    joueur("Selim", { buts: 5, impact: 1, pp: 30 }),
    joueur("Ilyes", { buts: 4, pp: 25 }),
  ];
  assert.deepEqual(forts("Mehdi", B), ["2 fois Impact · 2e en Impact", "5 pts Pépite · 4e au Pépite d'Or", "2/4 dimanches · 50 % présent"]);
  assert.match(fiche("Mehdi", B).synthese, /^Sur le podium des Joueurs Impact\. /);
  // Selim, 3e en Impact : ses trois meilleurs rangs passent devant.
  assert.equal(fiche("Selim", B).forts.find((f) => f.classement === "impact")?.rang, undefined, "Selim : 3e en Impact, mais trois meilleurs rangs devant");
}

/* ------------------------------ Les ex æquo ------------------------------ */
// 3 · Anas et Youss, deux fois Impact chacun : tous deux 1ers, à deux. Anas
// est aussi 1er en MVP, mais à trois : ce MVP vaut une 3e place, derrière son
// Impact (1er à deux), sa 2e place de passeur et de défenseur, seul. Sa phrase
// : « Sur le podium », pas « Le Joueur Impact de la ligue. » (ils sont deux).
{
  const C = [
    joueur("Anas", { buts: 5, passes: 4, mvp: 1, impact: 2, def: 1, pp: 20 }),
    joueur("Youss", { buts: 6, passes: 7, mvp: 1, impact: 2, def: 2, pp: 30 }),
    joueur("Selim", { buts: 8, passes: 1, mvp: 1, impact: 1, pp: 35 }),
    joueur("Ilyes", { buts: 2, passes: 2, pp: 10 }),
  ];
  for (const nom of ["Anas", "Youss"]) {
    assert.equal(fiche(nom, C).forts.find((f) => f.classement === "impact")?.rang, "1er en Impact", `${nom} : 1er ex æquo`);
  }
  assert.deepEqual(forts("Anas", C), ["2 fois Impact · 1er en Impact", "4 passes · 2e passeur", "1 fois le Mur · 2e défenseur"]);
  assert.match(fiche("Anas", C).synthese, /^Sur le podium des Joueurs Impact\. /);
  // Seul en tête : « Le … de la ligue. »
  assert.match(fiche("Selim", C).synthese, /^Le buteur de la ligue\. /);
}

// 3 bis · Dix joueurs à un Impact, Tarik en a deux ; Abdel est 3e buteur, seul.
// Les dix sont « 2e en Impact », à dix : une 11e place. Abdel garde son 3e
// rang de buteur devant (après sa présence entière, comme avant), et sa
// phrase de buteur.
{
  const D = [
    joueur("Tarik", { buts: 2, impact: 2, pp: 12 }),
    joueur("Rayan", { buts: 15, pp: 40 }),
    joueur("Yanis", { buts: 13, pp: 35 }),
    joueur("Abdel", { buts: 12, impact: 1, pp: 30 }),
    ...["Adel", "Bilal", "Driss", "Farid", "Hakim", "Malik", "Nassim", "Omar", "Samir"].map((n, i) =>
      joueur(n, { buts: 1 + (i % 3), impact: 1, pp: 10 + i, presences: 1 + (i % 4) })
    ),
  ];
  const f = fiche("Abdel", D);
  assert.deepEqual(forts("Abdel", D), ["4/4 dimanches · toujours là", "12 buts · 3e buteur", "30 pts Pépite · 3e au Pépite d'Or"]);
  assert.match(f.synthese, /^Sur le podium des buteurs\. /);
  assert.equal(f.forts.find((x) => x.classement === "impact")?.rang, undefined, "Abdel : son Impact partagé à dix passe derrière");
  // Aucun des dix n'a de phrase « Impact » : ni « Le Joueur Impact », ni le podium.
  for (const p of D.filter((x) => x.impact === 1)) {
    assert.ok(!/Impact/.test(fiche(p.name, D).synthese), `${p.name} : ${fiche(p.name, D).synthese}`);
  }
  // Tarik, seul à deux : « Le Joueur Impact de la ligue. »
  assert.match(fiche("Tarik", D).synthese, /^Le Joueur Impact de la ligue\. /);
  // Abdel et Zakaria, 3es à égalité (la vraie saison au 04/11) : tous deux sur
  // le podium des buteurs. À quatre au 3e rang, plus personne.
  const E = [...D, joueur("Zakaria", { buts: 12, pp: 5 })];
  assert.match(fiche("Zakaria", E).synthese, /^Sur le podium des buteurs\. /);
  assert.ok(forts("Abdel", E).includes("12 buts · 3e buteur"));
  const F = [...E, joueur("Ryad", { buts: 12, pp: 2 }), joueur("Souley", { buts: 12, pp: 3 })];
  assert.ok(!/podium/.test(fiche("Zakaria", F).synthese), fiche("Zakaria", F).synthese);
}

/* ------------------------------ Bola Agent ------------------------------ */
// 6 · Le dossier : le point fort, le classement Impact, le débrief du jour.
{
  const MARDI = new Date(2026, 10, 3, 12);
  const s = saisonDe(A, { Anas: { impact: true, def: true, buts: 1 } });
  const anas = A.find((p) => p.name === "Anas")!;
  const d = dossierJoueur(s, anas, A, MARDI);
  assert.equal(d.pointsForts[0], "3 fois Impact (1er en Impact)");
  const impact = d.classements.find((c) => c.classement === "Impact");
  assert.deepEqual(impact && { valeur: impact.valeur, rang: impact.rang, devant: impact.devant }, { valeur: 3, rang: 1, devant: null });
  // L'ordre des classements : celui de la Ligue (MVP, Impact, Défenseurs).
  const noms = d.classements.map((c) => c.classement);
  assert.ok(noms.indexOf("MVP") < noms.indexOf("Impact") && noms.indexOf("Impact") < noms.indexOf("Défenseurs"), noms.join(", "));
  assert.equal(questionDebrief(d.dernierMatch!), "J4 : victoire, 1 but, Impact et Le Mur. Alors, c'était comment ?");
  // Sans Impact : ni point fort ni classement à part, juste son rang à zéro.
  const nolan = dossierJoueur(saisonDe(A), A.find((p) => p.name === "Nolan")!, A, MARDI);
  assert.ok(!nolan.pointsForts.some((x) => x.includes("Impact")));
}

console.log("points-forts-check: ok");
