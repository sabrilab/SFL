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
// du dimanche · J2 · +10 XP ». Les 10 XP ne s'annoncent que tant qu'ils
// comptent : cinq félicitations au plus par exploit, dix par joueur et par
// journée (les plafonds de lib/sfl/missions.ts). La toucher ouvre l'exploit
// dans les Actus (/ligue?exploit=…). Elle est suivie comme les autres
// (lib/server/push-envoi.ts, motif « felicitation »).

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { exploitsDeLaSaison, lireCle, type Exploit } from "@/lib/sfl/exploits";
import type { Saison } from "@/lib/sfl/saisie/types";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { appliquerVotes, type VoteFigure } from "@/lib/sfl/votes";

export const maxDuration = 30;

/** Au plus, par appel : une rubrique des Actus tient sept joueurs. */
const MAX = 10;
const XP_RECUE = 10;
/** Les félicitations comptées pour l'XP : par exploit, et par joueur et par journée. */
const PAR_EXPLOIT = 5;
const PAR_JOURNEE = 10;

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

interface Profil {
  id: string;
  name: string;
  nom_affiche: string | null;
  valide: boolean;
}

interface Ligne {
  id: number;
  de: string;
  a: string;
  exploit: string;
  saison: number;
  j: number;
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "Pas encore branché." }, { status: 503 });

  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });

  const corps = (await req.json().catch(() => ({}))) as { exploits?: unknown };
  const demandes = Array.isArray(corps.exploits)
    ? [...new Set(corps.exploits.filter((x): x is string => typeof x === "string" && x.length <= 120 && !!lireCle(x)))].slice(0, MAX)
    : [];
  if (demandes.length === 0) return NextResponse.json({ error: "Exploit inconnu." }, { status: 400 });

  const [{ data: profils }, { data: doc }] = await Promise.all([
    sb.from("profiles").select("id, name, nom_affiche, valide"),
    sb.from("saison").select("data").eq("id", 1).maybeSingle(),
  ]);
  const tous = (profils ?? []) as Profil[];
  const lui = tous.find((p) => p.id === moi.id);
  if (!lui?.valide) return NextResponse.json({ error: "Compte pas encore accepté." }, { status: 403 });
  const saison = (doc as { data?: Saison } | null)?.data;
  if (!saison?.journees) return NextResponse.json({ error: "Saison introuvable." }, { status: 503 });

  // Les exploits de la saison de la base, avec les noms que la ligue voit,
  // et les élus des votes fermés (Impact, Défensive) posés comme dans l'app.
  const parNom = new Map(tous.filter((p) => p.valide).map((p) => [p.name, p]));
  const affiche = (n: string) => parNom.get(n)?.nom_affiche ?? n;
  const { data: votes } = await sb
    .from("votes_figures")
    .select("saison, j, categorie, votant, candidat, match_id")
    .eq("saison", saison.numero ?? 0)
    .limit(5000);
  const titree = appliquerVotes(saison, deriveSeason(saison).journees, (votes ?? []) as VoteFigure[], new Date());
  const exploits = new Map<string, Exploit>(exploitsDeLaSaison(titree, affiche).map((e) => [e.cle, e]));

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
  const toutes = (recues ?? []) as Ligne[];
  const prenom = (lui.nom_affiche ?? lui.name).split(" ")[0];

  const envois = new Map<string, Envoi>();
  for (const f of cibles) {
    const e = exploits.get(f.exploit)!;
    const duJour = toutes.filter((x) => x.a === f.a && x.saison === e.saison && x.j === e.j);
    // Les félicitations comptées, dans l'ordre où elles sont arrivées.
    let jour = 0;
    const parExploit = new Map<string, number>();
    let compte = false;
    for (const x of duJour) {
      const n = parExploit.get(x.exploit) ?? 0;
      const retenue = n < PAR_EXPLOIT && jour < PAR_JOURNEE;
      parExploit.set(x.exploit, n + 1);
      if (retenue) jour++;
      if (x.id === f.id) compte = retenue;
    }
    const autres = duJour.filter((x) => x.exploit === f.exploit).length - 1;
    // Plusieurs exploits du même joueur dans l'appel : la dernière notification reste.
    envois.set(f.a, {
      notif: {
        titre: couper(autres > 0 ? `${prenom} et ${autres} ${autres > 1 ? "autres" : "autre"} t'ont félicité` : `${prenom} t'a félicité`, 60),
        texte: couper(`Pour ${e.quoi} · J${e.j}${compte ? ` · +${XP_RECUE} XP` : ""}`, 180),
        url: `/ligue?exploit=${encodeURIComponent(e.cle)}`,
        tag: `felicitation-${e.cle}`,
      },
      motif: "felicitation",
      ref: `exploit:${e.cle}`,
    });
  }

  const { recus } = await prevenir(sb, cle, envois, { de: moi.id });
  return NextResponse.json({ ok, envoyes: recus.size });
}
