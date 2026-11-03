// Les droits dans une équipe de Bola Team, depuis l'entraîneur (Ilyes,
// 02/11/2026 : « une équipe = 7 joueurs + 1 entraîneur ») :
//   1. la base ne donne plus aucun droit par « rôle différent de membre » :
//      role_equipe ne sert plus qu'à dire si l'on est dans l'équipe ;
//   2. l'app non plus : aucun « role !== "membre" », aucun « capitaine ou
//      vice » écrit à la main (le brassard à afficher passe par brassard) ;
//   3. la table d'equipe_droit, lue dans supabase/schema.sql, est celle de
//      DROITS (lib/sfl/equipes-droits.ts), geste par geste ; chaque geste
//      demandé à la base existe ;
//   4. l'entraîneur : recrute, défie, dépose la feuille ; jamais le score,
//      l'excuse d'un absent, l'annulation, l'écusson, la couverture ni la
//      direction ; aucun droit pendant un préavis ;
//   5. une équipe 7 + 1 : 7 joueurs, plus aucune invitation de joueur,
//      « Active · 7 / 7 » ; 4 + 1 n'est pas active ; l'invitation de
//      l'entraîneur ne prend pas l'une des six ;
//   6. le Règlement en version 3 partout, la formule de l'entraîneur ;
//   7. le banc ne porte jamais de tirets (ils disent « invité ») ;
//   8. la feuille d'avant-match : qui la dépose, et quand (peutDeposer,
//      la même règle qu'equipe_feuille : 5 à 7 joueurs, l'entraîneur
//      toujours avant le coup d'envoi, le capitaine et le vice sans
//      entraîneur ou dès H-2 si la feuille n'est pas la sienne) ; la feuille
//      de score ne propose que ses joueurs.
//   npx tsx tools/equipe-droits-check.ts
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { DROITS, FEUILLE_AVANT_MATCH, brassard, droitDe, peut, peutDeposer, type Geste, type Role } from "../src/lib/sfl/equipes-droits";
import {
  INVITATIONS_MAX,
  VERSION_REGLEMENT,
  acceptationEntraineur,
  active,
  entraineurDe,
  etatEquipe,
  invitationsPossibles,
  invites,
  invitesJoueurs,
  signataires,
  tInvite,
  type Equipe,
  type Membre,
} from "../src/lib/sfl/equipes";

const RACINE = join(__dirname, "..");
const SCHEMA = readFileSync(join(RACINE, "supabase", "schema.sql"), "utf8");
function fichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? fichiers(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
  });
}
const SRC = fichiers(join(RACINE, "src"))
  .map((p) => ({ chemin: relative(join(RACINE, "src"), p).replace(/\\/g, "/"), texte: readFileSync(p, "utf8") }))
  .filter((f) => f.chemin !== "lib/sfl/db/schema-sql.server.ts");
const fautes: string[] = [];

// 1 · La base : aucun droit par le rôle brut.
const numero = (i: number) => SCHEMA.slice(0, i).split("\n").length;
for (const m of SCHEMA.matchAll(/coalesce\(\s*public\.role_equipe\(/g)) fautes.push(`schema.sql:${numero(m.index!)} : un droit par « rôle différent de membre »`);
for (const m of SCHEMA.matchAll(/role_equipe\([^)]*\)\)?\s*(?:is distinct from|is not distinct from|=|<>|!=)\s*'/g))
  fautes.push(`schema.sql:${numero(m.index!)} : un droit lu sur role_equipe : passer par equipe_droit`);
// role_equipe ne sert plus qu'à « en suis-je ? » (equipe_quitter) : sa définition, ses droits d'exécution, et cet appel.
const appels = [...SCHEMA.matchAll(/public\.role_equipe\(/g)].map((m) => SCHEMA.slice(SCHEMA.lastIndexOf("\n", m.index!) + 1, SCHEMA.indexOf("\n", m.index!)).trim());
for (const l of appels)
  if (!/^create or replace function public\.role_equipe|^(revoke|grant) execute on function public\.role_equipe|^place := public\.role_equipe\(e\);$/.test(l))
    fautes.push(`schema.sql : role_equipe appelé hors d'« en suis-je ? » : ${l}`);

// 2 · L'app : ni « rôle différent de membre », ni « capitaine ou vice » à la main.
for (const f of SRC) {
  for (const m of f.texte.matchAll(/\brole\s*[!=]==?\s*["']membre["']/g)) fautes.push(`${f.chemin} : « ${m[0]} » sert de droit : passer par peut / droitDe`);
  if (f.chemin === "lib/sfl/equipes-droits.ts") continue;
  for (const m of f.texte.matchAll(/===\s*["']capitaine["']\s*\|\|\s*[\w.?]+\s*===\s*["']vice["']/g))
    fautes.push(`${f.chemin} : « ${m[0]} » écrit à la main : peut (un droit) ou brassard (un nom)`);
}

// 3 · La table de la base est celle de l'app.
const corps = SCHEMA.slice(SCHEMA.indexOf("create or replace function public.equipe_droit("));
const tableSql = corps.slice(0, corps.indexOf("$$;"));
const lues = new Map<string, string[]>();
for (const m of tableSql.matchAll(/when\s+'(\w+)'\s+then\s+array\[([^\]]*)\]/g))
  lues.set(m[1], [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]).sort());
assert.deepEqual([...lues.keys()].sort(), Object.keys(DROITS).sort(), "les mêmes gestes dans la base et dans l'app");
for (const [g, roles] of lues) assert.deepEqual(roles, [...DROITS[g as Geste]].sort(), `le geste ${g} : la base et l'app disent la même chose`);
assert.ok(/m\.depart_le is null/.test(tableSql), "la base : aucun droit pendant un préavis d'exclusion");
// Chaque appel (une ligne) : les gestes demandés, hors de la condition sur le rôle d'une invitation.
for (const m of SCHEMA.matchAll(/(?<!function )public\.equipe_droit\(([^\n]*)/g))
  for (const g of m[1].replace(/when \w+ = '\w+'/g, "").matchAll(/'(\w+)'/g))
    if (!(g[1] in DROITS)) fautes.push(`schema.sql:${numero(m.index!)} : geste inconnu « ${g[1]} »`);
for (const g of ["inviter", "defier", "annuler", "score", "ecusson", "couverture", "direction"])
  assert.ok(SCHEMA.includes(`'${g}')`), `la base demande le geste ${g} quelque part`);

// 4 · L'entraîneur, geste par geste.
const ENTRAINEUR: Record<Geste, boolean> = {
  inviter: true,
  defier: true,
  feuille: true,
  annuler: false,
  score: false,
  excuser: false,
  ecusson: false,
  couverture: false,
  direction: false,
};
for (const [g, oui] of Object.entries(ENTRAINEUR) as [Geste, boolean][]) {
  assert.equal(peut("entraineur", g), oui, `l'entraîneur ${oui ? "a" : "n'a pas"} le geste ${g}`);
  assert.equal(droitDe({ role: "entraineur", departLe: "2026-11-05T18:00:00Z" }, g), false, `exclu, l'entraîneur n'a plus le geste ${g}`);
}
for (const g of Object.keys(DROITS) as Geste[]) {
  assert.equal(peut("capitaine", g), true, `le capitaine a le geste ${g}`);
  assert.equal(peut("membre", g), false, `un joueur sans brassard n'a pas le geste ${g}`);
  assert.equal(peut(null, g), false, "hors de l'équipe, aucun droit");
}
assert.equal(peut("vice", "direction"), false, "le vice ne dirige pas");
assert.equal(brassard("entraineur"), false);
assert.equal(brassard("vice"), true);

// 5 · Une équipe 7 + 1.
const il = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();
const m = (id: string, role: Role, statut: Membre["statut"] = "membre", depuis = il(200)): Membre => ({ id, name: id, role, statut, depuis, signeLe: depuis, reglement: "v3" });
const sept: Membre[] = [m("a", "capitaine"), m("b", "vice"), m("c", "membre"), m("d", "membre"), m("e", "membre"), m("f", "membre"), m("g", "membre")];
const equipe = (membres: Membre[]): Equipe => ({ id: 1, nom: "Sunday Five", initiales: "SF", fond: "noir", ville: "Lille", capitaine: "a", membres, blason: null, couvertureLe: null });
const septPlusUn = equipe([...sept, m("lucien", "entraineur")]);
assert.equal(signataires(septPlusUn).length, 7, "7 joueurs : l'entraîneur ne compte pas");
assert.ok(!signataires(septPlusUn).some((x) => x.role === "entraineur"), "l'entraîneur n'est pas sur le terrain");
assert.equal(invitationsPossibles(septPlusUn), 0, "à 7 joueurs, plus aucune invitation de joueur");
assert.equal(etatEquipe(septPlusUn), "Lille · Active · 7 / 7");
assert.equal(entraineurDe(septPlusUn)?.id, "lucien");
const quatrePlusUn = equipe([...sept.slice(0, 4), m("lucien", "entraineur")]);
assert.equal(active(quatrePlusUn), false, "4 joueurs et un entraîneur : pas active");
assert.equal(etatEquipe(quatrePlusUn), "Lille · En formation · 4 / 5");
// L'invitation d'entraîneur : hors des six, sur le banc et pas sur le terrain.
const avecInvites = equipe([...sept.slice(0, 5), m("i1", "membre", "invite", il(2)), m("adil", "entraineur", "invite", il(1))]);
assert.equal(invites(avecInvites).length, 2, "les deux invitations valent");
assert.deepEqual(invitesJoueurs(avecInvites).map((x) => x.id), ["i1"], "sur le terrain, le joueur invité seul");
assert.equal(invitationsPossibles(avecInvites), INVITATIONS_MAX - 1, "l'invitation de l'entraîneur ne prend pas l'une des six");
assert.equal(entraineurDe(avecInvites)?.id, "adil", "l'entraîneur invité est sur le banc");
assert.equal(entraineurDe(equipe([...sept.slice(0, 5), m("adil", "entraineur", "invite", il(80))])), null, "une invitation tombée libère le banc");
assert.equal(tInvite(avecInvites, avecInvites.membres[6]), "a t'invite à entraîner");
assert.equal(tInvite(avecInvites, avecInvites.membres[5]), "a t'invite");

// 6 · La version 3 partout.
assert.equal(VERSION_REGLEMENT, "v3");
for (const fn of ["equipe_creer", "equipe_signer", "equipe_signer_charte"]) {
  const debut = SCHEMA.indexOf(`create or replace function public.${fn}(`);
  const texte = SCHEMA.slice(debut, SCHEMA.indexOf("$$;", debut));
  assert.ok(texte.includes(`'${VERSION_REGLEMENT}'`), `${fn} signe la ${VERSION_REGLEMENT}`);
  assert.ok(!/'v[12]'/.test(texte), `${fn} n'écrit plus une version d'avant`);
}
const formule = acceptationEntraineur("Sunday Five");
assert.ok(formule.includes("(version 3)") && formule.includes("Entraîneur de Sunday Five") && formule.includes("ni le score ni les buteurs"));

// 7 · Le banc : jamais de tirets.
const banc = SRC.find((f) => f.chemin === "components/sfl/equipe/banc-entraineur.tsx");
assert.ok(banc, "le banc existe");
assert.ok(!/dashed/.test(banc.texte.replace(/^\s*\/\/.*$/gm, "")), "le banc ne porte aucun bord en tirets");

// 8 · La feuille d'avant-match.
const H = 3600_000;
const maintenant = new Date("2026-11-07T15:00:00Z");
const dans = (h: number) => new Date(maintenant.getTime() + h * H);
const avecCoach = [...sept, m("lucien", "entraineur")];
const qui = (id: string, membres: Membre[] = avecCoach) => membres.find((x) => x.id === id)!;
assert.equal(peutDeposer(qui("lucien"), avecCoach, null, dans(72), maintenant), true, "l'entraîneur dépose, 72 h avant");
assert.equal(peutDeposer(qui("lucien"), avecCoach, "a", dans(0.1), maintenant), true, "l'entraîneur redépose jusqu'au coup d'envoi");
assert.equal(peutDeposer(qui("lucien"), avecCoach, null, dans(0), maintenant), false, "au coup d'envoi, la feuille est fermée");
assert.equal(peutDeposer(qui("lucien"), avecCoach, null, dans(-1), maintenant), false, "après, aussi");
assert.equal(peutDeposer(qui("a"), avecCoach, null, dans(72), maintenant), false, "avec un entraîneur, le capitaine attend H-2");
assert.equal(peutDeposer(qui("b"), avecCoach, null, dans(2.5), maintenant), false, "le vice aussi");
assert.equal(peutDeposer(qui("a"), avecCoach, null, dans(2), maintenant), true, "à H-2, sans feuille de l'entraîneur, le capitaine dépose");
assert.equal(peutDeposer(qui("b"), avecCoach, "a", dans(1), maintenant), true, "à H-1, après le capitaine, le vice redépose");
assert.equal(peutDeposer(qui("a"), avecCoach, "lucien", dans(1), maintenant), false, "après l'entraîneur, le capitaine ne change plus rien");
assert.equal(peutDeposer(qui("c"), avecCoach, null, dans(1), maintenant), false, "un joueur sans brassard, jamais");
assert.equal(peutDeposer(qui("a", sept), sept, null, dans(72), maintenant), true, "sans entraîneur, le capitaine dépose quand il veut");
const ecarte = avecCoach.map((x) => (x.id === "lucien" ? { ...x, departLe: dans(48).toISOString() } : x));
assert.equal(peutDeposer(qui("lucien", ecarte), ecarte, null, dans(72), maintenant), false, "l'entraîneur écarté ne dépose plus");
assert.equal(peutDeposer(qui("a", ecarte), ecarte, null, dans(72), maintenant), true, "sans entraîneur en place, le capitaine dépose");
assert.equal(peutDeposer(null, avecCoach, null, dans(72), maintenant), false, "hors de l'équipe, rien");
// La même règle dans la base : 5 à 7, deux heures, la feuille fermée au coup d'envoi.
const feuilleSql = SCHEMA.slice(SCHEMA.indexOf("create or replace function public.equipe_feuille("));
const corpsFeuille = feuilleSql.slice(0, feuilleSql.indexOf("$$;"));
assert.ok(corpsFeuille.includes(`coup - interval '${FEUILLE_AVANT_MATCH.capitainesAvantH} hours'`), "la base attend aussi H-2");
assert.ok(corpsFeuille.includes(`n not between ${FEUILLE_AVANT_MATCH.min} and ${FEUILLE_AVANT_MATCH.max}`), "la base borne aussi de 5 à 7");
assert.ok(/if now\(\) >= coup then/.test(corpsFeuille), "la base ferme la feuille au coup d'envoi");
assert.ok(/m\.role <> 'entraineur'/.test(corpsFeuille), "jamais l'entraîneur sur la feuille");
// La feuille de score propose les joueurs de la feuille d'avant-match, s'il y en a une.
const feuilleScore = SRC.find((f) => f.chemin === "components/sfl/equipe/feuille-team.tsx")!.texte;
assert.ok(/match\.feuilles\?\.find\(\(f\) => f\.equipe === mienne\.id\)\?\.joueurs/.test(feuilleScore), "la feuille de score lit la feuille d'avant-match");
const avantMatch = SRC.find((f) => f.chemin === "components/sfl/equipe/feuille-avant-match.tsx");
assert.ok(avantMatch && !/dashed/.test(avantMatch.texte.replace(/^\s*\/\/.*$/gm, "")), "la feuille d'avant-match ne porte aucun bord en tirets");

assert.deepEqual(fautes, [], fautes.join("\n"));
console.log("equipe-droits-check : ok");
