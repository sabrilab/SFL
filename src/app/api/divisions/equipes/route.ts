// Les équipes du dimanche en divisions, faites toutes seules
// (lib/sfl/equipes-division.ts) et gardées dans la convocation : chaque
// joueur les découvre vendredi à 19 h, comme celles que l'admin validait.
//
// Qui l'appelle :
//   · le cron Vercel, le vendredi à 17 h UTC, 18 h à Paris en hiver (voir
//     vercel.json) : il compose les équipes de ceux qui viennent ;
//   · le téléphone d'un joueur qui vient de répondre à la convocation, et
//     l'app à son ouverture pendant le week-end (lib/sfl/divisions-equipes.ts) :
//     les équipes faites, un nouveau venu y entre et qui se désiste en sort
//     (completer), sans rien rebattre. Depuis l'incident de la J4 (29/10),
//     un téléphone ne compose plus jamais : sans équipes, il attend le cron
//     ou l'admin (« Composer maintenant »). Il ne crée ni équipe ni terrain ;
//     un terrain plein laisse le retardataire remplaçant.
//
// Le cron recompose aussi des équipes qui prennent plus de TERRAINS_MAX
// terrains (equipes-division.ts) : c'est ce qui s'est passé pour la J4.
//
// Ceux qui viennent : les joueurs que l'admin a posés sur la feuille de la
// journée (presence-feuille.ts), puis les « Je viens » de la convocation dans
// l'ordre des réponses (ordreDArrivee) : quand les places manquent, les
// derniers arrivés sont remplaçants. Rien avant le vendredi 18 h (heure de Paris), rien après
// le coup d'envoi ; rien hors des divisions (saison coupée, convocation de la
// J4 ou après, pas encore jouée) ; rien non plus quand l'admin a déjà fait
// les équipes sur la feuille : la feuille est sa parole.
//
// Le document de la saison est lu (votes appliqués, saison-serveur.server.ts),
// jamais écrit : seule la convocation change.
// Une composition ne passe que sur des équipes encore vides ; un ajustement
// repart des équipes du moment, si bien qu'un appel perdu se rattrape au
// suivant.
//
// La route agit avec la clé secrète : le cron présente CRON_SECRET quand il
// est posé dans Vercel, un joueur sa session de membre.

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import {
  completer,
  composer,
  divisionsDeLaJournee,
  equipesEnCours,
  journeeDeConvocation,
  ordreDArrivee,
  TERRAINS_MAX,
} from "@/lib/sfl/equipes-division";
import { isHidden } from "@/lib/sfl/hidden";
import { joueursDeLaFeuille } from "@/lib/sfl/presence-feuille";
import type { ConvocationTeam } from "@/lib/sfl/saisie/types";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Statut =
  | "hors-du-week-end"
  | "sans-convocation"
  | "sans-divisions"
  | "feuille-de-l-admin"
  | "en-attente-des-equipes"
  | "composees"
  | "ajustees"
  | "a-jour"
  | "erreur";

/**
 * `composer` : le cron seul. Un téléphone (POST) ne fait que compléter les
 * équipes qui existent.
 */
async function ajuster(sb: SupabaseClient, peutComposer: boolean): Promise<{ statut: Statut; equipes?: number }> {
  const { data: convocations } = await sb
    .from("convocations")
    .select("id, date_label, heure, teams")
    .eq("statut", "ouverte")
    .order("id", { ascending: false })
    .limit(1);
  const conv = convocations?.[0] as { id: number; date_label: string; heure: string; teams: ConvocationTeam[] | null } | undefined;
  if (!conv) return { statut: "sans-convocation" };
  // Le cron comme les téléphones : rien avant le vendredi 18 h. Le cron de
  // 17 h UTC tombe à 18 h à Paris en hiver, plus tard en été ; sans
  // CRON_SECRET posé dans Vercel, n'importe qui peut l'appeler, et l'heure le garde.
  if (!equipesEnCours(new Date(), conv.heure)) return { statut: "hors-du-week-end" };

  // La saison comme les téléphones la lisent : votes appliqués, arbitres
  // masqués (saison-serveur.server.ts). Sinon les divisions des équipes ne
  // sont pas celles de l'app, ni les notes qui les équilibrent.
  let lue;
  try {
    lue = await lireSaisonServeur(sb);
  } catch {
    return { statut: "erreur" };
  }
  const saison = lue?.saison;
  if (!saison) return { statut: "sans-divisions" };
  const j = journeeDeConvocation(saison, conv.date_label);
  const etat = divisionsDeLaJournee(saison, j);
  if (!etat) return { statut: "sans-divisions" };
  const feuille = joueursDeLaFeuille(saison, j);
  if (feuille.equipes) return { statut: "feuille-de-l-admin" };

  // Ceux qui viennent, comme l'app les compte (use-presence.ts) : ceux de la
  // feuille, puis les « Je viens » de l'effectif, du premier au dernier.
  const { data: lignes } = await sb
    .from("presence")
    .select("updated_at, profiles ( name )")
    .eq("convocation_id", conv.id)
    .eq("reponse", "present")
    .order("updated_at", { ascending: true });
  const effectif = new Set(saison.roster.map((r) => r.name));
  const quand = new Map<string, string>();
  const nomDe = (l: unknown) => {
    const ligne = l as { updated_at?: string; profiles?: { name?: string } | { name?: string }[] | null };
    const p = ligne.profiles;
    const nom = (Array.isArray(p) ? p[0]?.name : p?.name) ?? null;
    if (nom && ligne.updated_at) quand.set(nom, ligne.updated_at);
    return nom;
  };
  const presents = ((lignes ?? []) as unknown[]).map(nomDe).filter((n): n is string => !!n && effectif.has(n));
  const venus = ordreDArrivee(presents, feuille.noms, (n) => quand.get(n)).filter((n) => !isHidden(n));

  // Des équipes sur plus de terrains que l'Hippodrome n'en a (la J4, avant
  // le plafond) : le cron les refait. Un téléphone n'y touche pas.
  const tropDeTerrains = !!conv.teams && Math.floor(conv.teams.length / 2) > TERRAINS_MAX;
  if (!conv.teams?.length || (peutComposer && tropDeTerrains)) {
    if (!peutComposer) return { statut: "en-attente-des-equipes" };
    const { teams } = composer(saison, venus, etat);
    if (teams.length < 2) return { statut: "a-jour", equipes: 0 };
    const ecrire = sb.from("convocations").update({ teams }).eq("id", conv.id);
    const { data: ecrites, error } = await (conv.teams ? ecrire : ecrire.is("teams", null)).select("id");
    if (error) return { statut: "erreur" };
    // Quelqu'un est passé avant (un autre appel, l'admin) : ses équipes restent.
    return ecrites?.length ? { statut: "composees", equipes: teams.length } : { statut: "a-jour" };
  }
  const teams = completer(saison, conv.teams, venus, etat);
  if (!teams) return { statut: "a-jour", equipes: conv.teams.length };
  const { error } = await sb.from("convocations").update({ teams }).eq("id", conv.id);
  return error ? { statut: "erreur" } : { statut: "ajustees", equipes: teams.length };
}

/** Le cron du vendredi. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  const sb = serveur();
  if (!sb) return NextResponse.json({ statut: "pas-branche" }, { status: 503 });
  return NextResponse.json(await ajuster(sb, true));
}

/** Un téléphone de la ligue, après une réponse ou à l'ouverture. */
export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi.id).maybeSingle();
  if (!profil?.valide) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });
  // Un téléphone complète, ne compose jamais.
  return NextResponse.json(await ajuster(sb, false));
}
