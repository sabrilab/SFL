// Le résultat d'un match Bola, envoyé à ceux qui le confirment (Sabri, 28/10 :
// « que le résultat puisse être envoyé à chaque joueur qui confirme »).
// Appelée par l'app juste après le geste (lib/sfl/matchs.ts) :
//   · feuille : l'organisateur vient d'enregistrer une version de la
//     feuille (enregistrer_feuille_bola). Chaque destinataire reçoit son
//     résultat à lui — « Match de Karim · 6 – 4 », « Toi : 2 buts, 1 passe ·
//     MVP Clara » —, une fois par version (match_feuilles.resultat_notifie_le) ;
//     une correction remplace la notification d'avant (même étiquette).
//     Toucher ouvre l'écran « Résultat du match » (/?resultat=id) ;
//   · conteste : un joueur vient d'infirmer ; l'organisateur est prévenu,
//     une fois par réponse (match_confirmations.notifie_le), avec le motif.
//     Toucher ouvre sa feuille dans Bola (/ligue-vierge?feuille=id) : la Map
//     ne montre plus un match passé.
// Un match saisi avant le 28/10 (confirmation_requise à false) ne prévient
// personne : il compte tel quel. Aucune notification quand un match bascule
// (« compte », « ne compte pas ») : choix par défaut, 28/10, pour éviter le bruit.
//
// La route agit avec la clé secrète : elle vérifie elle-même qui appelle.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { appelant, estAdmin, serveur } from "@/lib/sfl/serveur-ligue.server";
import { jourLong } from "@/lib/sfl/jour-long";
import { maLigne, matchDe } from "@/lib/sfl/confirmation-resultat";
import { mvpsDuMatch } from "@/lib/sfl/ligue-vierge";
import { TEXTE_MAX, TITRE_MAX, type Notif } from "@/lib/sfl/push";

export const maxDuration = 30;

const couper = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
const prenom = (
  p: { nom_affiche?: string | null; name?: string } | null | undefined,
) => (p?.nom_affiche ?? p?.name ?? "Quelqu'un").split(" ")[0];

interface Instantane {
  scoreClairs: number;
  scoreFonces: number;
  lignes: {
    id: string;
    equipe: "clairs" | "fonces" | "absent";
    buts: number;
    passes: number;
  }[];
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi)
    return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as {
    id?: unknown;
    type?: unknown;
  };
  const id = Number(corps.id);
  const type = corps.type;
  if (!Number.isInteger(id) || (type !== "feuille" && type !== "conteste"))
    return NextResponse.json({ error: "Demande inconnue." }, { status: 400 });

  const { data: match } = await sb
    .from("matchs")
    .select(
      "id, organisateur, jour, heure, lieu, mode, feuille_version, confirmation_requise",
    )
    .eq("id", id)
    .maybeSingle();
  if (!match || match.mode !== "bola")
    return NextResponse.json({ error: "Match inconnu." }, { status: 404 });
  if (!match.confirmation_requise)
    return NextResponse.json({ envoyes: 0, prevenus: 0 });
  const version = match.feuille_version as number;
  const cle = cleVapid();
  const tag = `resultat-${id}`;
  const ref = `match:${id}`;

  const { data: feuille } = await sb
    .from("match_feuilles")
    .select("instantane, resultat_notifie_le")
    .eq("match_id", id)
    .eq("version", version)
    .maybeSingle();
  if (!feuille)
    return NextResponse.json({ error: "Feuille inconnue." }, { status: 404 });
  const inst = feuille.instantane as Instantane;
  const score = `${inst.scoreClairs} – ${inst.scoreFonces}`;

  if (type === "feuille") {
    if (match.organisateur !== moi.id && !(await estAdmin(sb, moi.id)))
      return NextResponse.json(
        { error: "Ce match n'est pas le tien." },
        { status: 403 },
      );
    // Une fois par version : la première demande pose l'heure, les suivantes ne renvoient rien.
    const { data: pris } = await sb
      .from("match_feuilles")
      .update({ resultat_notifie_le: new Date().toISOString() })
      .eq("match_id", id)
      .eq("version", version)
      .is("resultat_notifie_le", null)
      .select("version");
    if (!pris?.length) return NextResponse.json({ envoyes: 0, prevenus: 0 });

    // Les destinataires : comme destinataires_feuille (supabase/schema.sql).
    const { data: lignes } = await sb
      .from("match_joueurs")
      .select("player_id, statut, equipe, profiles ( valide, name )")
      .eq("match_id", id);
    type L = {
      player_id: string;
      statut: string;
      equipe: string | null;
      profiles:
        | { valide?: boolean; name?: string }
        | { valide?: boolean; name?: string }[]
        | null;
    };
    const prof = (l: L) =>
      (Array.isArray(l.profiles) ? l.profiles[0] : l.profiles) ?? null;
    const cibles = ((lignes ?? []) as L[]).filter(
      (l) =>
        l.player_id !== match.organisateur &&
        !!prof(l)?.valide &&
        (l.equipe === "clairs" ||
          l.equipe === "fonces" ||
          (l.equipe === "absent" && l.statut === "inscrit")),
    );
    const noms = new Map(
      ((lignes ?? []) as L[]).map((l) => [
        l.player_id,
        (prof(l)?.name ?? "").split(" ")[0],
      ]),
    );
    const mvps = mvpsDuMatch(inst.lignes.filter((l) => l.equipe !== "absent"))
      .map((m) => noms.get(m))
      .filter(Boolean);
    const { data: orga } = await sb
      .from("profiles")
      .select("name, nom_affiche")
      .eq("id", match.organisateur)
      .maybeSingle();
    const titre = couper(`${matchDe(prenom(orga))} · ${score}`, TITRE_MAX);
    const mvp = mvps.length ? ` · MVP ${mvps.join(", ")}` : "";

    let envoyes = 0;
    if (cle && cibles.length > 0) {
      const envois = new Map(
        cibles.map((c): [string, Envoi] => {
          const ligne = inst.lignes.find((l) => l.id === c.player_id);
          const notif: Notif = {
            titre,
            texte: couper(
              `Toi : ${maLigne(ligne).toLowerCase().replace(" · ", ", ")}${mvp}`,
              TEXTE_MAX,
            ),
            url: `/?resultat=${id}`,
            tag,
          };
          return [c.player_id, { notif, motif: "match-resultat", ref }];
        }),
      );
      envoyes = (await prevenir(sb, cle, envois, { de: match.organisateur }))
        .recus.size;
    }
    return NextResponse.json({ envoyes, prevenus: cibles.length });
  }

  // conteste : ma réponse « infirme » à la version courante, pas encore signalée.
  const { data: pris } = await sb
    .from("match_confirmations")
    .update({ notifie_le: new Date().toISOString() })
    .eq("match_id", id)
    .eq("version", version)
    .eq("joueur", moi.id)
    .eq("reponse", "infirme")
    .is("notifie_le", null)
    .select("motif");
  if (!pris?.length) return NextResponse.json({ envoyes: 0, prevenus: 0 });
  const motif = (pris[0] as { motif: string | null }).motif;
  const { count } = await sb
    .from("match_confirmations")
    .select("joueur", { count: "exact", head: true })
    .eq("match_id", id)
    .eq("version", version)
    .eq("reponse", "infirme");
  const { data: lui } = await sb
    .from("profiles")
    .select("name, nom_affiche")
    .eq("id", moi.id)
    .maybeSingle();
  const k = count ?? 1;
  const notif: Notif = {
    titre: couper(
      k > 1
        ? `${k} joueurs infirment le résultat`
        : `${prenom(lui)} infirme le résultat`,
      TITRE_MAX,
    ),
    texte: couper(
      motif
        ? `« ${motif} » · ${score}`
        : `${score} · ${jourLong(match.jour)} · ${match.lieu}`,
      TEXTE_MAX,
    ),
    url: `/ligue-vierge?feuille=${id}`,
    tag: `conteste-${id}`,
  };
  let envoyes = 0;
  if (cle) {
    const envois = new Map<string, Envoi>([
      [match.organisateur, { notif, motif: "match-conteste", ref }],
    ]);
    envoyes = (await prevenir(sb, cle, envois, { de: moi.id })).recus.size;
  }
  return NextResponse.json({ envoyes, prevenus: 1 });
}
