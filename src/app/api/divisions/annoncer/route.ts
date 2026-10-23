// L'annonce des divisions par notification — « J3 · Dernier dimanche sans
// divisions », une par joueur de la ligue (lib/sfl/divisions.ts).
//
// Quand : la veille de la J3 dès 18 h, ou le dimanche même de 9 h au coup
// d'envoi, à l'heure de Paris (fenetreNotification). Jamais la nuit, jamais
// une fois la J3 commencée.
//
// Le texte : ce qui arrive après la J3, puis où le joueur tomberait si on
// coupait maintenant (notificationAnnonce) :
//   « Après la J3, la ligue se coupe en trois. Si on coupait ce soir, tu
//     serais en D2, à 3 pts de la D1 et 1 pt devant la D3. »
// Toucher la notification ouvre l'annonce dans les Actus.
//
// Qui l'appelle : n'importe quel joueur de la ligue, sans le savoir — l'app la
// sonne à l'ouverture pendant la fenêtre (lib/sfl/divisions-annonce.ts), comme
// l'annonce des missions ; la ligue ouvre l'app bien plus souvent qu'un cron
// de Vercel ne passe. Rejouer l'appel ne renvoie rien : chaque joueur est
// « réservé » dans annonces_envois avant l'envoi (insert … on conflict do
// nothing), si bien que deux appels simultanés ne préviennent personne deux
// fois. Un envoi qui échoue partout libère la réservation : le prochain appel
// réessaie. Comme toute notification, elle part par prevenir
// (lib/server/push-envoi.ts), motif « divisions » : Admin → Activité compte
// qui l'a reçue et touchée.
//
// La route agit avec la clé secrète : elle exige une session de membre.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { decouper, editionAnnonce, fenetreNotification, J_DECOUPAGE, notificationAnnonce } from "@/lib/sfl/divisions";
import { numeroSaison, type Saison } from "@/lib/sfl/saisie/types";
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

  const { data: doc } = await sb.from("saison").select("data").eq("id", 1).maybeSingle();
  const saison = (doc as { data?: Saison } | null)?.data;
  if (!saison) return NextResponse.json({ envoyes: 0, fini: true });
  const { data: convocations } = await sb
    .from("convocations")
    .select("heure")
    .eq("statut", "ouverte")
    .order("id", { ascending: false })
    .limit(1);
  const maintenant = new Date();
  const heure = (convocations?.[0] as { heure?: string } | undefined)?.heure;
  if (!fenetreNotification(saison, maintenant, heure)) return NextResponse.json({ envoyes: 0, fini: true });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0, fini: true });

  // Les joueurs de la ligue qui ont un téléphone abonné.
  const { data: profils } = await sb.from("profiles").select("id, name").eq("valide", true);
  const joueurs = (profils ?? []) as { id: string; name: string }[];
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
  const annonce = `divisions-s${numeroSaison(saison)}-j${J_DECOUPAGE}`;
  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert(
      [...idDe.keys()].map((joueur) => ({ annonce, joueur })),
      { onConflict: "annonce,joueur", ignoreDuplicates: true }
    )
    .select("joueur");
  // Table absente (avant la migration) : on n'envoie rien plutôt que d'envoyer deux fois.
  if (refus) return NextResponse.json({ envoyes: 0, fini: true });

  const edition = editionAnnonce(saison, maintenant) ?? "avant";
  const d = decouper(saison);
  const envois = new Map<string, Envoi>();
  for (const { joueur } of (reserves ?? []) as { joueur: string }[]) {
    const uid = idDe.get(joueur);
    if (!uid) continue;
    const { titre, texte } = notificationAnnonce(saison, d, joueur, edition);
    const notif: Notif = { titre: couper(titre, 60), texte: couper(texte, 180), url: "/ligue#divisions", tag: annonce };
    envois.set(uid, { notif, motif: "divisions", ref: annonce });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = [...idDe].filter(([, uid]) => envois.has(uid) && !recus.has(uid)).map(([joueur]) => joueur);
  if (rates.length > 0) await sb.from("annonces_envois").delete().eq("annonce", annonce).in("joueur", rates);

  return NextResponse.json({ envoyes: recus.size, fini: rates.length === 0 });
}
