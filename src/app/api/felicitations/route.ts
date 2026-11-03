// Féliciter un joueur pour un exploit des Actus — appelée par l'app au geste
// (lib/sfl/felicitations.ts, feliciter). Seule cette route écrit les
// félicitations : elles donnent de l'XP (lib/sfl/missions.ts), donc on ne
// croit pas l'appelant sur parole. L'exploit doit exister dans la saison de
// la base (exploits.ts, les mêmes clés que l'app), ne pas être le sien, et
// son joueur doit avoir un compte accepté.
//
// Puis le joueur est prévenu, une fois par félicitation (push_envoyes : qui
// retire son bravo puis le redonne ne le réveille pas deux fois). Les bravos
// d'un même exploit se comptent dans la même notification, qui remplace la
// précédente : « Kader et 2 autres t'ont félicité · Pour ton titre d'homme
// du dimanche · J2 · +10 XP ». Un même bravo qui touche plusieurs exploits
// d'un joueur (un joueur peut être MVP, Impact et Défensive le même jour) les
// dit tous dans une seule notification : « Pour tes titres de Joueur Impact
// et de meilleur défenseur · J4 · +20 XP » (le calcul, pur et vérifié :
// lib/sfl/felicitations-notif.ts). Avant, la dernière seule restait. Les 10 XP ne s'annoncent que tant qu'ils
// comptent : cinq félicitations au plus par exploit, dix par joueur et par
// journée (les plafonds de lib/sfl/missions.ts). La toucher ouvre l'exploit
// dans les Actus (/ligue?exploit=…). Elle est suivie comme les autres
// (lib/server/push-envoi.ts, motif « felicitation »).

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { exploitsDeLaSaison, type Exploit } from "@/lib/sfl/exploits";
import { exploitsDemandes, notificationsDesBravos, type Recue } from "@/lib/sfl/felicitations-notif";
import type { Saison } from "@/lib/sfl/saisie/types";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";

export const maxDuration = 30;

interface Profil {
  id: string;
  name: string;
  nom_affiche: string | null;
  valide: boolean;
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Pas encore branché." }, { status: 503 });

  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const demandes = exploitsDemandes(await req.json().catch(() => ({})));
  if (demandes.length === 0) return NextResponse.json({ error: "Exploit inconnu." }, { status: 400 });

  // La saison publiée : un exploit d'une journée en brouillon n'existe pas encore.
  const [{ data: profils }, lue] = await Promise.all([
    sb.from("profiles").select("id, name, nom_affiche, valide"),
    lireSaisonServeur(sb).catch(() => null),
  ]);
  const tous = (profils ?? []) as Profil[];
  const lui = tous.find((p) => p.id === moi.id);
  if (!lui?.valide) return NextResponse.json({ error: "Compte pas encore accepté." }, { status: 403 });
  // La vue figée, votes posés (revelation.ts) : un exploit n'existe qu'à la révélation, comme dans le fil.
  const saison: Saison | undefined = lue?.saison;
  if (!saison?.journees) return NextResponse.json({ error: "Saison introuvable." }, { status: 503 });

  // Les exploits de la saison de la base, avec les noms que la ligue voit,
  // et les élus des votes (Impact, Défensive) posés comme dans l'app.
  const parNom = new Map(tous.filter((p) => p.valide).map((p) => [p.name, p]));
  const affiche = (n: string) => parNom.get(n)?.nom_affiche ?? n;
  const exploits = new Map<string, Exploit>(exploitsDeLaSaison(saison, affiche).map((e) => [e.cle, e]));

  const lignes = demandes
    .map((c) => exploits.get(c))
    .filter((e): e is Exploit => !!e && e.nom !== lui.name && parNom.has(e.nom))
    .map((e) => ({ de: moi.id, a: parNom.get(e.nom)!.id, exploit: e.cle, saison: e.saison, j: e.j, famille: e.famille }));
  if (lignes.length === 0) return NextResponse.json({ error: "Exploit inconnu." }, { status: 404 });

  const { data: posees, error } = await sb
    .from("felicitations")
    .upsert(lignes, { onConflict: "de,a,exploit", ignoreDuplicates: true })
    .select("id, a, exploit");
  if (error) return NextResponse.json({ error: "Pas enregistré." }, { status: 500 });
  const ok = lignes.map((l) => l.exploit);

  // Les notifications : une par félicitation, jamais deux.
  const cle = cleVapid();
  const neuves = (posees ?? []) as { id: number; a: string; exploit: string }[];
  if (!cle || neuves.length === 0) return NextResponse.json({ ok, envoyes: 0 });
  const { data: marquees } = await sb
    .from("push_envoyes")
    .upsert(
      neuves.map((f) => ({ cle: `felicitation:${moi.id}:${f.a}:${f.exploit}` })),
      { onConflict: "cle", ignoreDuplicates: true }
    )
    .select("cle");
  const aPrevenir = new Set(((marquees ?? []) as { cle: string }[]).map((m) => m.cle.split(":").slice(2).join(":")));
  const cibles = neuves.filter((f) => aPrevenir.has(`${f.a}:${f.exploit}`));
  if (cibles.length === 0) return NextResponse.json({ ok, envoyes: 0 });

  // Tout ce que les joueurs prévenus ont reçu sur ces journées : le compte
  // des bravos de chaque exploit, et ce qui compte encore pour l'XP.
  const { data: recues } = await sb
    .from("felicitations")
    .select("id, de, a, exploit, saison, j")
    .in(
      "a",
      cibles.map((f) => f.a)
    )
    .in("saison", [...new Set(cibles.map((f) => exploits.get(f.exploit)!.saison))])
    .in("j", [...new Set(cibles.map((f) => exploits.get(f.exploit)!.j))])
    .order("id");
  const toutes = (recues ?? []) as Recue[];
  const prenom = (lui.nom_affiche ?? lui.name).split(" ")[0];

  // Une notification par joueur prévenu, avec tous ses exploits de l'appel.
  const envois = new Map<string, Envoi>();
  for (const [a, n] of notificationsDesBravos(cibles, exploits, toutes, prenom)) {
    envois.set(a, { notif: { titre: n.titre, texte: n.texte, url: n.url, tag: n.tag }, motif: "felicitation", ref: n.ref });
  }

  const { recus } = await prevenir(sb, cle, envois, { de: moi.id });
  return NextResponse.json({ ok, envoyes: recus.size });
}
