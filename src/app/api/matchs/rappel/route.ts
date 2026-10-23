// Le rappel de la veille (Sabri, 22/10 : « que les joueurs reçoivent une
// notification pour la veille du match »).
//
// Appelée chaque soir par le cron de Vercel (vercel.json, 17 h UTC : 18 h à
// Paris l'hiver, 19 h l'été). Pour chaque match ouvert par un joueur qui se
// joue demain, ceux qui jouent — l'organisateur et les inscrits — reçoivent
// sur leur téléphone :
//   « Demain 19h00 · Croix » — « Avec Ilyes et Azzedine · Il manque 7 »
// Le toucher ouvre le match sur la Map (sa fiche : l'adresse, l'itinéraire,
// la discussion). Les invités qui n'ont pas répondu ne jouent pas encore :
// rien pour eux.
//
// Une seule fois par match et par jour (table match_rappels) : le cron peut
// repasser sans que personne ne reçoive deux rappels. La route ne travaille
// que le soir, à l'heure de Paris : sans CRON_SECRET (pas posé dans Vercel),
// n'importe qui peut l'appeler, mais au pire le rappel part un peu plus tôt,
// jamais en pleine nuit ni deux fois.

import { NextRequest, NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { serveur } from "@/lib/sfl/serveur-ligue.server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Le soir, à Paris : de 16 h à 22 h. */
const SOIR = [16, 22] as const;

/** La date (« 2026-10-27 ») et l'heure qu'il est à Paris. */
function aParis(d: Date): { jour: string; heure: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const v = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { jour: `${v("year")}-${v("month")}-${v("day")}`, heure: Number(v("hour")) };
}

function lendemain(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j + 1)).toISOString().slice(0, 10);
}

/** « Avec Ilyes », « Avec Ilyes et Azzedine », « Avec Ilyes, Kader et 5 autres ». */
function avecQui(prenoms: string[]): string {
  if (prenoms.length === 0) return "Personne d'autre pour l'instant";
  if (prenoms.length <= 3) return `Avec ${prenoms.length === 1 ? prenoms[0] : `${prenoms.slice(0, -1).join(", ")} et ${prenoms.at(-1)}`}`;
  return `Avec ${prenoms.slice(0, 2).join(", ")} et ${prenoms.length - 2} autres`;
}

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });

  const sb = serveur();
  const cle = cleVapid();
  if (!sb || !cle) return NextResponse.json({ status: "pas branché" });

  const ici = aParis(new Date());
  if (ici.heure < SOIR[0] || ici.heure >= SOIR[1]) return NextResponse.json({ status: "pas le soir", heure: ici.heure });
  const demain = lendemain(ici.jour);

  const { data: matchs, error } = await sb
    .from("matchs")
    .select("id, organisateur, heure, lieu, places")
    .eq("jour", demain);
  if (error) return NextResponse.json({ status: "error", message: error.message }, { status: 500 });

  let envoyes = 0;
  let morts = 0;
  const rappeles: number[] = [];
  for (const match of (matchs ?? []) as { id: number; organisateur: string; heure: string; lieu: string; places: number }[]) {
    // Le premier passage du soir prend le rappel ; un second n'a plus rien à prendre.
    const { data: pris } = await sb
      .from("match_rappels")
      .upsert({ match_id: match.id, jour: demain }, { onConflict: "match_id,jour", ignoreDuplicates: true })
      .select("match_id");
    if (!pris?.length) continue;
    rappeles.push(match.id);

    const { data: lignes } = await sb.from("match_joueurs").select("player_id, statut").eq("match_id", match.id);
    const joueurs = (lignes ?? []) as { player_id: string; statut: "invite" | "inscrit" }[];
    const jouent = [...new Set([match.organisateur, ...joueurs.filter((j) => j.statut === "inscrit").map((j) => j.player_id)])];
    const manque = Math.max(0, match.places - joueurs.length);

    const { data: profils } = await sb.from("profiles").select("id, name, nom_affiche, valide").in("id", jouent);
    const tous = (profils ?? []) as { id: string; name: string; nom_affiche: string | null; valide: boolean }[];
    const prenom = (uid: string) => {
      const p = tous.find((x) => x.id === uid);
      return (p?.nom_affiche ?? p?.name ?? "").split(" ")[0];
    };

    const envois = new Map<string, Envoi>();
    for (const uid of jouent) {
      if (!tous.some((p) => p.id === uid && p.valide)) continue;
      const autres = jouent.filter((x) => x !== uid).map(prenom).filter(Boolean);
      envois.set(uid, {
        motif: "match-veille",
        ref: `match:${match.id}`,
        notif: {
          titre: couper(`Demain ${match.heure} · ${match.lieu}`, 60),
          texte: couper(`${avecQui(autres)} · ${manque > 0 ? `Il manque ${manque}` : "Complet"}`, 180),
          url: `/?match=${match.id}`,
          tag: `match-${match.id}-veille`,
        },
      });
    }
    if (envois.size === 0) continue;

    const bilan = await prevenir(sb, cle, envois);
    envoyes += bilan.recus.size;
    morts += bilan.morts;
  }

  return NextResponse.json({ status: "ok", demain, matchs: rappeles, envoyes, morts });
}
