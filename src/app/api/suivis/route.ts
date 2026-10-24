// « Kader te suit » : la notification du joueur qu'on vient de suivre —
// appelée par l'app juste après le geste (lib/sfl/suivis.ts, suivre).
//
// Une seule fois par suiveur et par joueur suivi (push_envoyes) : qui
// arrête de suivre puis recommence ne réveille personne une deuxième fois.
// Les nouveaux abonnés des douze dernières heures se comptent dans la même
// notification, qui remplace la précédente (« Kader et 2 autres te
// suivent »). La toucher ouvre le profil du dernier arrivé, où le suivre en
// retour (/recherche?joueur=…).
//
// La route agit avec la clé secrète, donc elle ne croit pas l'appelant sur
// parole : le suivi doit exister dans la base, être le sien, et avoir moins
// de cinq minutes.
//
// Elle est suivie comme les autres (lib/server/push-envoi.ts) : motif
// « suivi », dont le geste attendu est de suivre en retour (la base le
// reconnaît, trigger suivis_push_effet), ou « suivi-retour » quand ils se
// suivent déjà et qu'il n'y a rien à faire.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";

export const maxDuration = 30;

/** Un appel ne vaut que pour un suivi de moins de cinq minutes. */
const FRAIS = 5 * 60_000;
/** Les nouveaux abonnés de ce délai se comptent ensemble. */
const FENETRE = 12 * 3600_000;
/** Au plus, par appel (l'invitation de l'ouverture en propose six). */
const MAX = 12;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface Profil {
  id: string;
  name: string;
  username: string;
  nom_affiche: string | null;
  valide: boolean;
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  const cle = cleVapid();
  if (!sb || !cle) return NextResponse.json({ envoyes: 0, raison: "pas branché" });

  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { suivis?: unknown };
  const demandes = Array.isArray(corps.suivis)
    ? [...new Set(corps.suivis.filter((x): x is string => typeof x === "string"))].slice(0, MAX)
    : [];
  if (demandes.length === 0) return NextResponse.json({ envoyes: 0 });

  // Seuls comptent les suivis que l'appelant vient vraiment de poser.
  const maintenant = Date.now();
  const { data: lignes } = await sb.from("suivis").select("suivi, created_at").eq("suiveur", moi.id).in("suivi", demandes);
  const frais = ((lignes ?? []) as { suivi: string; created_at: string }[])
    .filter((l) => maintenant - new Date(l.created_at).getTime() < FRAIS)
    .map((l) => l.suivi);
  if (frais.length === 0) return NextResponse.json({ envoyes: 0 });

  const { data: profils } = await sb.from("profiles").select("id, name, username, nom_affiche, valide").in("id", [moi.id, ...frais]);
  const tous = (profils ?? []) as Profil[];
  const lui = tous.find((p) => p.id === moi.id);
  if (!lui?.valide) return NextResponse.json({ error: "Compte pas encore accepté." }, { status: 403 });

  // Une fois par suiveur et par joueur suivi : la ligne posée, on prévient ;
  // déjà là, il a déjà été prévenu.
  const { data: posees } = await sb
    .from("push_envoyes")
    .upsert(
      frais.map((s) => ({ cle: `suivi:${moi.id}:${s}` })),
      { onConflict: "cle", ignoreDuplicates: true }
    )
    .select("cle");
  const cibles = ((posees ?? []) as { cle: string }[])
    .map((x) => x.cle.split(":")[2])
    .filter((uid) => tous.some((p) => p.id === uid && p.valide));
  if (cibles.length === 0) return NextResponse.json({ envoyes: 0 });

  // Ses nouveaux abonnés du moment, et ceux qui le suivent déjà, lui.
  const [{ data: recents }, { data: retour }] = await Promise.all([
    sb.from("suivis").select("suivi").in("suivi", cibles).gt("created_at", new Date(maintenant - FENETRE).toISOString()),
    sb.from("suivis").select("suiveur").eq("suivi", moi.id).in("suiveur", cibles),
  ]);
  const prenom = (lui.nom_affiche ?? lui.name).split(" ")[0];
  const pseudo = `@${lui.username.replace(/^@/, "")}`;
  const leSuivent = new Set(((retour ?? []) as { suiveur: string }[]).map((r) => r.suiveur));

  const envois = new Map<string, Envoi>();
  for (const uid of cibles) {
    const autres = Math.max(0, ((recents ?? []) as { suivi: string }[]).filter((r) => r.suivi === uid).length - 1);
    envois.set(uid, {
      notif: {
        titre: couper(autres > 0 ? `${prenom} et ${autres} ${autres > 1 ? "autres" : "autre"} te suivent` : `${prenom} te suit`, 60),
        texte: couper(`${pseudo} · ${leSuivent.has(uid) ? "Vous vous suivez" : "Suivre en retour"}`, 180),
        url: `/recherche?joueur=${encodeURIComponent(lui.name)}`,
        tag: "suivi",
      },
      motif: leSuivent.has(uid) ? "suivi-retour" : "suivi",
      ref: `joueur:${moi.id}`,
    });
  }

  const { recus } = await prevenir(sb, cle, envois, { de: moi.id });
  return NextResponse.json({ envoyes: recus.size });
}
