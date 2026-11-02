// La notification d'un carton (lib/sfl/cartons.ts, 01/11/2026) : « Carton
// jaune · Retard · J4 · 1/3 », « Carton rouge · Suspendu pour la J5 », au
// seul joueur qui le reçoit, une fois par carton (annonces_envois, clé
// carton-s{n}-j{j}-{couleur}). L'animation, elle, l'attend à l'ouverture de
// l'app (components/sfl/cartons/carton-recu.tsx).
//
// Qui l'appelle : l'app de n'importe quel membre, à l'ouverture
// (lib/sfl/cartons-annonce.ts), et celle de l'admin dès qu'il note un retard.
// La route relit la saison publiée (jamais un brouillon) et ne prévient que
// ceux dont le carton n'est pas encore parti : rejouer l'appel ne renvoie
// rien. Un envoi qui échoue partout libère la réservation : le prochain
// appel réessaie. Session de membre exigée ; la route agit avec la clé
// secrète.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";
import { cartonsDeLaSaison, cleNotifCarton, texteCarton } from "@/lib/sfl/cartons";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi.id).maybeSingle();
  if (!(profil as { valide?: boolean } | null)?.valide) return NextResponse.json({ error: "Réservé à la ligue." }, { status: 403 });

  const lue = await lireSaisonServeur(sb).catch(() => null);
  // Le direct (la saison publiée, sans figer) : le carton se donne sur place.
  // Le −1 du retard, lui, entre au classement à la révélation (revelation.ts).
  const saison = lue?.direct;
  if (!saison) return NextResponse.json({ envoyes: 0, fini: true });
  const cartons = [...cartonsDeLaSaison(saison).values()].flatMap((c) => c.cartons);
  if (!cartons.length) return NextResponse.json({ envoyes: 0, fini: true });

  // Ceux qui n'ont pas encore été prévenus : la réservation d'abord (une seule fois, même à deux appels).
  const { data: deja } = await sb
    .from("annonces_envois")
    .select("annonce, joueur")
    .in("annonce", [...new Set(cartons.map(cleNotifCarton))]);
  const partis = new Set(((deja ?? []) as { annonce: string; joueur: string }[]).map((x) => `${x.annonce}|${x.joueur}`));
  const aPrevenir = cartons.filter((c) => !partis.has(`${cleNotifCarton(c)}|${c.joueur}`));
  if (!aPrevenir.length) return NextResponse.json({ envoyes: 0, fini: true });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0, fini: true });
  const { data: profils } = await sb.from("profiles").select("id, name").eq("valide", true).in("name", [...new Set(aPrevenir.map((c) => c.joueur))]);
  const idDe = new Map(((profils ?? []) as { id: string; name: string }[]).map((p) => [p.name, p.id]));

  const { data: reserves, error: refus } = await sb
    .from("annonces_envois")
    .upsert(
      aPrevenir.filter((c) => idDe.has(c.joueur)).map((c) => ({ annonce: cleNotifCarton(c), joueur: c.joueur })),
      { onConflict: "annonce,joueur", ignoreDuplicates: true }
    )
    .select("annonce, joueur");
  if (refus) return NextResponse.json({ envoyes: 0, fini: false });

  // Un joueur à la fois (prevenir n'envoie qu'une notification par joueur) :
  // son jaune, puis son rouge s'il le suit.
  let envoyes = 0;
  const rates: { annonce: string; joueur: string }[] = [];
  for (const r of (reserves ?? []) as { annonce: string; joueur: string }[]) {
    const c = aPrevenir.find((x) => cleNotifCarton(x) === r.annonce && x.joueur === r.joueur);
    const uid = idDe.get(r.joueur);
    if (!c || !uid) continue;
    const { titre, ligne } = texteCarton(c);
    const envois = new Map<string, Envoi>([[uid, { notif: { titre, texte: `${ligne}.`, url: "/", tag: r.annonce }, motif: "carton", ref: r.annonce }]]);
    const bilan = await prevenir(sb, cle, envois);
    if (bilan.recus.has(uid)) envoyes += 1;
    // Des téléphones, mais aucun n'a pris la notification : on réessaiera.
    // Sans téléphone abonné, rien à réessayer (l'animation l'attend dans l'app).
    else if (bilan.echecs > 0) rates.push(r);
  }
  for (const r of rates) await sb.from("annonces_envois").delete().eq("annonce", r.annonce).eq("joueur", r.joueur);
  return NextResponse.json({ envoyes, fini: rates.length === 0 });
}
