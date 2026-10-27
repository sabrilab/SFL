// L'outsider du dimanche par notification — « J4 · La journée de Miken »,
// une par joueur de la ligue et par dimanche de l'arc 1 (lib/sfl/outsiders.ts).
//
// Sabri, 23/10 : « Une notif « La journée de Miken » le samedi, ça te dit ? »
// « Go », puis le texte qu'il a retenu, « Le récit » :
//   « J4 · La journée de Miken »
//   « Personne ne l'attendait en D1. Demain, Miken joue son rang A. »
// L'outsider, lui, reçoit « J4 · Ta journée », « Personne ne t'attendait en
// D1. Demain, tu joues ton rang A. » Le dimanche matin, « Aujourd'hui ».
// Toucher la notification ouvre sa fiche dans Ma carte → Niveau XP → Les autres.
//
// Quand : la veille du dimanche dès 18 h, ou le dimanche même de 9 h au coup
// d'envoi, à l'heure de Paris (fenetreOutsider). Un dimanche sans outsider
// (plus aucun rang B en D1) n'envoie rien.
//
// L'outsider se calcule ici comme dans Ma carte → Niveau XP → Les autres : le journal de l'XP de
// toute la ligue (journalXp, avec les réponses aux missions, les votes et les
// félicitations de la base), puis arcOutsider. Jamais sur la parole d'un
// téléphone : son nom part à toute la ligue.
//
// Qui l'appelle : n'importe quel joueur de la ligue, sans le savoir — l'app la
// sonne à l'ouverture le samedi soir et le dimanche (lib/sfl/outsider-annonce.ts),
// comme l'annonce des divisions. Rejouer l'appel ne renvoie rien : chaque
// joueur est « réservé » dans annonces_envois avant l'envoi (insert … on
// conflict do nothing), si bien que deux appels simultanés ne préviennent
// personne deux fois. Un envoi qui échoue partout libère la réservation : le
// prochain appel réessaie. Elle part par prevenir (lib/server/push-envoi.ts),
// motif « outsider » : Admin → Activité compte qui l'a reçue et touchée.
//
// La route agit avec la clé secrète : elle exige une session de membre.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { prenom, type FelicitationXp, type Reponse } from "@/lib/sfl/missions";
import { dimancheAAnnoncer, fenetreOutsider, notificationOutsider, outsiderDuDimanche } from "@/lib/sfl/outsiders";
import { numeroSaison, type Saison } from "@/lib/sfl/saisie/types";
import type { VoteFigure } from "@/lib/sfl/votes";
import { chargerArbitresServeur, toutesLesLignes, votesDeLaSaison } from "@/lib/sfl/saison-serveur.server";
import type { Notif } from "@/lib/sfl/push";

export const maxDuration = 30;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi.id).maybeSingle();
  if (!profil?.valide) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });

  // Le document stocké, avec les arbitres masqués (saison-serveur.server.ts) ;
  // outsiderDuDimanche y applique lui-même les votes, lus plus bas.
  const { data: doc } = await sb.from("saison").select("data").eq("id", 1).maybeSingle();
  const saison = (doc as { data?: Saison } | null)?.data;
  if (!saison) return NextResponse.json({ envoyes: 0, fini: true });
  await chargerArbitresServeur(sb);
  const j = dimancheAAnnoncer(saison);
  if (j === null) return NextResponse.json({ envoyes: 0, fini: true });
  const { data: convocations } = await sb
    .from("convocations")
    .select("date_label, heure")
    .eq("statut", "ouverte")
    .order("id", { ascending: false })
    .limit(1);
  const maintenant = new Date();
  const moment = fenetreOutsider(saison, j, maintenant, convocations?.[0] as { date_label?: string; heure?: string } | undefined);
  if (!moment) return NextResponse.json({ envoyes: 0, fini: true });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0, fini: true });

  // L'outsider du dimanche, comme Les autres le calculent (outsiderDuDimanche).
  const numero = numeroSaison(saison);
  type Felicitation = { de: string; a: string; exploit: string; saison: number; j: number };
  let lues: [Reponse[], VoteFigure[], Felicitation[]];
  try {
    lues = await Promise.all([
      toutesLesLignes<Reponse>(sb, "missions_reponses", "saison, j, mission, joueur, reponse, cible, le", ["saison", "j", "mission", "joueur"]),
      votesDeLaSaison(sb, numero),
      toutesLesLignes<Felicitation>(sb, "felicitations", "de, a, exploit, saison, j", ["id"]),
    ]);
  } catch {
    // Une table illisible : l'XP serait faux, et le nom aussi. Le prochain appel réessaie.
    return NextResponse.json({ envoyes: 0, fini: false });
  }
  const [reponses, votes, lignesFelicitations] = lues;
  const { data: profils, error: sansProfils } = await sb.from("profiles").select("id, name, nom_affiche, valide, is_admin");
  if (sansProfils) return NextResponse.json({ envoyes: 0, fini: false });
  const comptes = (profils ?? []) as {
    id: string;
    name: string;
    nom_affiche: string | null;
    valide: boolean;
    is_admin: boolean | null;
  }[];
  const nomDeId = new Map(comptes.map((p) => [p.id, p.name]));
  const felicitations: FelicitationXp[] = lignesFelicitations.flatMap((f) => {
    const de = nomDeId.get(f.de);
    const a = nomDeId.get(f.a);
    return de && a ? [{ de, a, exploit: f.exploit, saison: f.saison, j: f.j }] : [];
  });

  const outsider = outsiderDuDimanche(saison, j, { reponses, votes, felicitations }, maintenant);
  if (!outsider) return NextResponse.json({ envoyes: 0, fini: true });
  const lui = comptes.find((p) => p.name === outsider.nom);
  const qui = prenom(lui?.nom_affiche ?? outsider.nom);

  // Les joueurs de la ligue qui ont un téléphone abonné : ceux de la saison
  // (et les admins), pas les joueurs Bola venus par un parrain.
  const roster = new Set((saison.roster ?? []).map((r) => r.name));
  const joueurs = comptes.filter((p) => p.valide && (p.is_admin || roster.has(p.name)));
  const { data: abonnements } = await sb
    .from("push_abonnements")
    .select("user_id")
    .in(
      "user_id",
      joueurs.map((p) => p.id)
    );
  const abonnes = new Set(((abonnements ?? []) as { user_id: string }[]).map((ab) => ab.user_id));
  const idDe = new Map(joueurs.filter((p) => abonnes.has(p.id)).map((p) => [p.name, p.id]));
  if (!idDe.size) return NextResponse.json({ envoyes: 0, fini: true });

  // La réservation : seuls ceux qu'on vient d'inscrire sont prévenus par cet appel.
  const annonce = `outsider-s${numero}-j${j}`;
  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert(
      [...idDe.keys()].map((joueur) => ({ annonce, joueur })),
      { onConflict: "annonce,joueur", ignoreDuplicates: true }
    )
    .select("joueur");
  if (refus) return NextResponse.json({ envoyes: 0, fini: true });

  const envois = new Map<string, Envoi>();
  for (const { joueur } of (reserves ?? []) as { joueur: string }[]) {
    const uid = idDe.get(joueur);
    if (!uid) continue;
    const { titre, texte } = notificationOutsider(outsider, j, joueur, qui, moment);
    const notif: Notif = { titre: couper(titre, 60), texte: couper(texte, 180), url: "/profil/xp?vue=autres#outsider", tag: annonce };
    envois.set(uid, { notif, motif: "outsider", ref: annonce });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = [...idDe].filter(([, uid]) => envois.has(uid) && !recus.has(uid)).map(([joueur]) => joueur);
  if (rates.length > 0) await sb.from("annonces_envois").delete().eq("annonce", annonce).in("joueur", rates);

  return NextResponse.json({ envoyes: recus.size, fini: rates.length === 0 });
}
