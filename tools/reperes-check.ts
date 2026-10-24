// Vérifie les repères sous les courbes (lib/sfl/reperes.ts), « Qui ramène du
// monde » (lib/sfl/rassembleurs.ts) et les mises en ligne
// (lib/sfl/mises-en-ligne.ts), sur des cas écrits à la main :
//   npx tsx tools/reperes-check.ts
import assert from "node:assert/strict";
import { decouperCommit, misesEnLigne, sujetEtDetail } from "../src/lib/sfl/mises-en-ligne";
import { analyserLiens, entourage, parCanal, sourceDevinee, type EnvoiLien, type Indices } from "../src/lib/sfl/rassembleurs";
import {
  ecartDuJour,
  instantJournee,
  marquesDuJour,
  pics,
  reperesNotifs,
  reperesParJour,
  type EnvoiRepere,
} from "../src/lib/sfl/reperes";
import type { PointJour } from "../src/lib/sfl/retention";

const H = 3600_000;
const MIN = 60_000;
const t0 = new Date(2026, 9, 19, 12, 0).getTime(); // dimanche 19/10, 12 h (heure locale)

/* ------------------------------ mises en ligne ---------------------------- */

assert.deepEqual(decouperCommit("Parrainage : chaque joueur invite (#143)\n\n- détail"), {
  titre: "Parrainage : chaque joueur invite",
  pr: 143,
});
assert.deepEqual(decouperCommit("Merge pull request #17 from sabrilab/x\n\nLa carte en grand"), { titre: "La carte en grand", pr: 17 });
assert.deepEqual(decouperCommit("Merge branch 'main' into x"), { titre: null, pr: null });
assert.deepEqual(sujetEtDetail("Map : trouver un match d'un coup d'œil"), { sujet: "Map", detail: "Trouver un match d'un coup d'œil" });
assert.deepEqual(sujetEtDetail("La carte de Sabri en noir"), { sujet: "La carte de Sabri en noir", detail: null });
{
  const toutes = misesEnLigne([{ sha: "abcdef0123", titre: "Nouvelle", pr: 150, le: Date.parse("2026-10-24T20:00:00Z") }]);
  assert.ok(toutes.length > 200, "l'historique est généré");
  assert.equal(toutes.at(-1)!.titre, "Nouvelle", "la table complète l'historique, du plus ancien au plus récent");
  const doublon = toutes.find((m) => m.sha.startsWith("1abe4b0"))!;
  const remplace = misesEnLigne([{ sha: "1abe4b0aaaaaaa", titre: "Parrainage (build)", pr: 143, le: doublon.le + 60_000 }]);
  assert.equal(remplace.filter((m) => m.sha.slice(0, 7) === "1abe4b0").length, 1, "un commit des deux sources ne compte qu'une fois");
  assert.equal(remplace.find((m) => m.sha.startsWith("1abe4b0"))!.titre, "Parrainage (build)", "la table l'emporte");
}

/* -------------------------------- les repères ----------------------------- */

const envoi = (a: string, motif: string, t: number, extra: Partial<EnvoiRepere> = {}): EnvoiRepere => ({
  a,
  motif,
  ref: null,
  envoyee: t,
  ouverte: null,
  ...extra,
});
{
  const admins = new Set(["Sabri"]);
  const garde = (n: string) => !admins.has(n);
  const r = reperesNotifs(
    [
      // Une annonce à toute la ligue, partie en deux minutes : un seul repère.
      envoi("Kader", "annonce", t0, { ouverte: t0 + 5 * MIN }),
      envoi("Miken", "annonce", t0 + 2 * MIN),
      envoi("Sabri", "annonce", t0 + 2 * MIN),
      // L'essai de l'admin à lui seul : pas un repère.
      envoi("Sabri", "annonce", t0 - 3 * H),
      // Entre joueurs : un compte pour la journée.
      envoi("Kader", "vestiaire-message", t0 + H),
      envoi("Miken", "vestiaire-message", t0 + H),
      envoi("Miken", "suivi", t0 + 2 * H),
    ],
    garde,
    admins
  );
  const annonces = r.filter((x) => x.titre === "Annonce à toute la ligue");
  assert.equal(annonces.length, 1);
  assert.equal(annonces[0].detail, "2 joueurs prévenus · 1 l'a touchée");
  assert.ok(annonces[0].fort);
  const entre = r.find((x) => x.titre === "Entre joueurs")!;
  assert.equal(entre.detail, "3 notifications : Vestiaire 2, suivis 1");
  const jours = reperesParJour(r);
  assert.equal(jours.size, 1);
  assert.deepEqual(marquesDuJour(jours.get(new Date(2026, 9, 19).getTime())), { terrain: 0, notif: 2, appli: 0, journee: null });
}
{
  const maintenant = new Date(2026, 9, 24, 20, 0).getTime();
  assert.equal(instantJournee({ date: "19 oct.", heure: "13h30" }, maintenant), new Date(2026, 9, 19, 13, 30).getTime());
  // Une journée de décembre relue en janvier : l'année d'avant.
  assert.equal(instantJournee({ date: "28 déc." }, new Date(2027, 0, 5).getTime()), new Date(2026, 11, 28, 13, 0).getTime());
}
{
  const point = (i: number, actifs: number): PointJour => ({
    t: t0 + i * 24 * H,
    actifs,
    hebdo: actifs,
    nouveaux: 0,
    cumul: i,
    sessions: actifs,
    minutes: actifs * 10,
  });
  const serie = [10, 11, 9, 10, 12, 10, 11, 31, 10, 12].map((v, i) => point(i, v));
  const e = ecartDuJour(serie, 7, "actifs");
  assert.equal(e.ordinaire, 10);
  assert.ok(Math.abs(e.fois! - 3.1) < 1e-9);
  assert.deepEqual(pics(serie, 0, "actifs"), [7], "le pic de 31 sort, les jours ordinaires non");
}

/* -------------------------------- la source ------------------------------- */

const indices: Indices = {
  noms: new Map([["u-kader", "Kader"]]),
  vestiaire: [
    { auteur: "Ilyes", at: t0 - 20 * MIN },
    { auteur: "Miken", at: t0 - 1 * MIN },
  ],
  reactions: [{ de: "Isma", auteur: "Kader", at: t0 - 30_000 }],
  felicitations: [{ de: "Sebovic", a: "Kader", exploit: "1-3-mvp-Kader" }],
  organisateurs: new Map([[12, "Ilyes"]]),
  equipes: [
    { equipe: 3, joueur: "Kader", invitePar: "Miken", signe: null },
    { equipe: 3, joueur: "Isma", invitePar: "Miken", signe: t0 - 2 * MIN },
  ],
};
assert.equal(sourceDevinee(envoi("Kader", "vestiaire-message", t0), indices), "Miken", "le dernier message juste avant");
assert.equal(sourceDevinee(envoi("Miken", "vestiaire-message", t0), indices), null, "jamais lui-même, ni un message trop ancien");
assert.equal(sourceDevinee(envoi("Kader", "vestiaire-reaction", t0), indices), "Isma");
assert.equal(sourceDevinee(envoi("Miken", "suivi", t0, { ref: "joueur:u-kader" }), indices), "Kader");
assert.equal(sourceDevinee(envoi("Kader", "felicitation", t0, { ref: "exploit:1-3-mvp-Kader" }), indices), "Sebovic");
assert.equal(sourceDevinee(envoi("Kader", "match-invitation", t0, { ref: "match:12" }), indices), "Ilyes");
assert.equal(sourceDevinee(envoi("Kader", "equipe-invitation", t0, { ref: "equipe:3" }), indices), "Miken");
assert.equal(sourceDevinee(envoi("Miken", "equipe-signature", t0, { ref: "equipe:3" }), indices), "Isma");
assert.equal(sourceDevinee(envoi("Kader", "match-message", t0, { ref: "match:12" }), indices), null, "privé : inconnu");

/* --------------------------------- les liens ------------------------------ */
{
  const lien = (a: string, motif: string, t: number, de: string | null, ouverte: number | null = null): EnvoiLien => ({
    ...envoi(a, motif, t, { ouverte }),
    de,
  });
  const instants = new Map<string, number[]>([
    // Kader : absent depuis 3 h, revient 20 min après deux notifications ; il a touché la première.
    ["Kader", [t0 - 3 * H, t0 + 20 * MIN, t0 + 25 * MIN]],
    // Miken : dans l'app quand elle part, rien à créditer.
    ["Miken", [t0 - 10 * MIN, t0 + 5 * MIN]],
    // Isma : revient 3 h après, trop tard.
    ["Isma", [t0 - 5 * H, t0 + 3 * H]],
    // Awa : revenue après une annonce de l'app.
    ["Awa", [t0 - 26 * H, t0 + 10 * MIN]],
  ]);
  const a = analyserLiens({
    envois: [
      lien("Kader", "vestiaire-message", t0, "Ilyes", t0 + 19 * MIN),
      lien("Kader", "suivi", t0 + 10 * MIN, "Miken"),
      lien("Miken", "vestiaire-message", t0, "Ilyes"),
      lien("Isma", "vestiaire-message", t0, "Ilyes"),
      lien("Awa", "annonce", t0, null),
      lien("Awa", "match-message", t0 - H, null),
    ],
    instants,
    autres: [
      { de: "Ilyes", a: "Nolan", canal: "parrainage", genre: "venu", at: t0 },
      { de: "Ilyes", a: "Ilyes", canal: "match", genre: "inscrit", at: t0 },
      { de: "Miken", a: "Sabri", canal: "equipe", genre: "signe", at: t0 },
      { de: "Miken", a: "Kader", canal: "equipe", genre: "signe", at: t0 - 40 * 24 * H },
    ],
    depuis: t0 - 24 * H,
    garde: (n) => n !== "Sabri",
  });
  const ilyes = a.rassembleurs.find((r) => r.nom === "Ilyes")!;
  assert.equal(a.rassembleurs[0].nom, "Ilyes", "Kader revenu par lui (touchée) et Nolan venu par lui");
  assert.equal(ilyes.joueurs, 2);
  assert.equal(ilyes.retours, 1);
  assert.equal(ilyes.envoyees, 3);
  assert.equal(a.rassembleurs.find((r) => r.nom === "Miken"), undefined, "son suivi n'est pas celui qui a été touché ; Sabri hors du public ; la signature d'avant la période ne compte pas");
  assert.deepEqual(a.app, { retours: 1, joueurs: 1, envoyees: 1 });
  assert.equal(a.sansSource, 0, "la notification privée d'Awa, plus ancienne, cède devant l'annonce");
  assert.deepEqual(
    entourage(ilyes).map((p) => [p.nom, p.canal, p.nouveau]),
    [
      ["Kader", "vestiaire", false],
      ["Nolan", "parrainage", true],
    ]
  );
  assert.deepEqual(parCanal(ilyes).map((c) => `${c.label} ${c.n}`), ["Vestiaire 1", "Parrainage 1"]);
}

console.log("Repères, mises en ligne et « Qui ramène du monde » : tout est bon ✓");
