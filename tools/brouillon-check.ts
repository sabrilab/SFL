// La journée en brouillon (saisie/brouillon.ts, 30/10/2026) : rien d'elle ne
// sort de l'admin tant qu'elle n'est pas publiée.
//   npx tsx tools/brouillon-check.ts
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  apercuPublication,
  coupDEnvoi,
  estBrouillon,
  jeterBrouillon,
  peutRemettreEnBrouillon,
  publierJournee,
  remettreEnBrouillon,
  sansBrouillons,
} from "../src/lib/sfl/saisie/brouillon";
import { computeJournees, deriveSeason } from "../src/lib/sfl/saisie/engine";
import { cloturerSaison, newEntry, poserEquipes } from "../src/lib/sfl/saisie/mutations";
import { seedSaison } from "../src/lib/sfl/saisie/store";
import { lireSaisonServeur } from "../src/lib/sfl/saison-serveur.server";
import { destinatairesPublication, textePublication } from "../src/lib/sfl/annonce-publication";
import type { Saison } from "../src/lib/sfl/saisie/types";

const s0 = seedSaison();
const jMax = Math.max(...s0.journees.map((m) => m.j));
const J = jMax + 1;
const noms = s0.roster.map((r) => r.name).filter((n) => n !== "Sabri").slice(0, 10);
const teams = [
  { name: "Noirs 1", players: noms.slice(0, 5) },
  { name: "Blancs 1", players: noms.slice(5, 10) },
];
const le = new Date("2026-11-04T18:42:00Z");
const s = poserEquipes(s0, J, teams, "8 nov.", { brouillon: { par: "Ilyes", le } });
const meta = s.journees.find((m) => m.j === J)!;
assert.ok(estBrouillon(meta), "posée en brouillon");
assert.equal(estBrouillon({ brouillon: undefined }), false);
assert.equal(estBrouillon({ brouillon: false as never }), false);
s.events = [...(s.events ?? []), { j: J, minute: 3, team: "Noirs 1", player: noms[0] }];

// 1 · La ligue ne la voit nulle part.
const lue = sansBrouillons(s);
assert.ok(!lue.journees.some((m) => m.j === J));
assert.ok(!lue.entries.some((e) => e.j === J));
assert.ok(!(lue.events ?? []).some((e) => e.j === J));
assert.equal(sansBrouillons(s0), s0, "même référence sans brouillon");
const d = deriveSeason(lue);
assert.ok(!d.journees.some((x) => x.j === J), "ni dans les journées dérivées");
assert.deepEqual(deriveSeason(lue).players, deriveSeason(s0).players, "ni dans les points ni les joueurs");
assert.ok(!computeJournees(lue).some((x) => x.j === J));

// 2 · L'aperçu : exactement ce que verra la ligue.
const apercu = apercuPublication(s, J)!;
assert.equal(apercu.matches!.length, 1);
assert.deepEqual(apercu.matches![0].teamA.players.map((p) => p.name), noms.slice(0, 5));

// 3 · Publier, puis remettre en brouillon : la même journée revient.
const pub = publierJournee(s, J, "Ilyes", le);
assert.ok(!estBrouillon(pub.journees.find((m) => m.j === J)!));
assert.deepEqual(pub.journees.find((m) => m.j === J)!.publiee, { le: le.toISOString(), par: "Ilyes" });
assert.ok(sansBrouillons(pub).journees.some((m) => m.j === J), "la ligue la voit");
const avant = new Date("2026-11-05T10:00:00Z");
const remis = remettreEnBrouillon(pub, J, "Ilyes", avant);
assert.ok("saison" in remis);
if ("saison" in remis) {
  assert.ok(estBrouillon(remis.saison.journees.find((m) => m.j === J)!));
  assert.deepEqual(sansBrouillons(remis.saison), sansBrouillons(s), "la même journée revient, cachée");
  assert.ok(remis.saison.journees.find((m) => m.j === J)!.publiee, "sa publication est gardée");
}

// 4 · Impossible après un but, ou après le coup d'envoi.
const avecBut: Saison = { ...pub, entries: pub.entries.map((e, i) => (e.j === J && i === pub.entries.findIndex((x) => x.j === J) ? { ...e, buts: 1 } : e)) };
assert.deepEqual(remettreEnBrouillon(avecBut, J, "Ilyes", avant), { refus: "jouee" });
const heure: Saison = { ...pub, journees: pub.journees.map((m) => (m.j === J ? { ...m, heure: "12h30" } : m)) };
const envoi = coupDEnvoi(heure.journees.find((m) => m.j === J)!, avant)!;
assert.equal(envoi.toISOString(), "2026-11-08T11:30:00.000Z", "12h30 à Paris, l'hiver");
assert.equal(peutRemettreEnBrouillon(heure, J, avant), true);
assert.deepEqual(remettreEnBrouillon(heure, J, "Ilyes", new Date("2026-11-08T11:31:00Z")), { refus: "coup-d-envoi" });

// 5 · Jeter un brouillon ; une journée publiée ne se jette pas.
const jete = jeterBrouillon(s, J);
assert.ok(!jete.journees.some((m) => m.j === J) && !jete.entries.some((e) => e.j === J));
assert.equal(jeterBrouillon(pub, J), pub);

// 6 · La saison ne se clôt pas tant qu'il reste un brouillon.
assert.equal(cloturerSaison(s), s);
assert.notEqual(cloturerSaison(pub), pub);

// 7 · Le serveur : la seule lecture ne donne jamais le brouillon.
function faux(doc: Saison): SupabaseClient {
  const requete = (table: string) => {
    const q: Record<string, unknown> = {};
    const fin = () =>
      table === "saison"
        ? { data: { data: doc, updated_at: "2026-11-04T18:42:00Z" }, error: null }
        : table === "profiles"
          ? { data: [], error: null }
          : { data: [], error: null };
    for (const m of ["select", "eq", "order", "in"]) q[m] = () => q;
    q.maybeSingle = async () => fin();
    q.range = async () => fin();
    q.then = (ok: (v: unknown) => unknown) => Promise.resolve(fin()).then(ok);
    return q;
  };
  return { from: requete } as unknown as SupabaseClient;
}
// 8 · « J8 en ligne » : le texte exact, et qui le reçoit.
const texte = textePublication({ ...pub, terrains: [{ id: 1, nom: "l'Hippodrome", adresse: "", lat: 0, lng: 0, defaut: true }] }, J);
assert.equal(texte.titre, `J${J} en ligne`);
assert.ok(texte.texte.startsWith("Dim 8 nov."));
assert.deepEqual(destinatairesPublication(pub, J, "viennent").sort(), [...noms].sort());
assert.ok(!destinatairesPublication(pub, J, "ligue").includes("Sabri"), "jamais un membre qui ne joue pas");
assert.deepEqual(destinatairesPublication(pub, J, "personne"), []);
void newEntry;

void (async () => {
  const serveur = await lireSaisonServeur(faux(s));
  assert.ok(serveur);
  assert.ok(!serveur!.saison.journees.some((m) => m.j === J), "saison : sans brouillon");
  assert.ok(!serveur!.brute.entries.some((e) => e.j === J), "brute : sans brouillon");
  assert.ok(serveur!.document.journees.some((m) => m.j === J), "document : brouillons compris");

  console.log("brouillon-check : caché partout (moteur, points, serveur), aperçu exact, publier ⇄ remettre, jeter, clôture refusée — ok");
})();
