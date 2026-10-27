// L'annonce des Missions Bola du dimanche — « Missions Bola · J3 », une
// notification par joueur de la feuille et par journée (lib/sfl/missions.ts).
//
// Quand : une fois la feuille FINIE. L'admin compose ses équipes en plusieurs
// enregistrements, et un joueur prévenu à mi-chemin recevrait un rival qui
// change dix minutes plus tard. La route n'annonce donc rien tant que la
// saison a bougé depuis moins de CALME (saison.updated_at, posé à chaque
// publication de l'admin), ni après le coup d'envoi. Jamais la nuit non plus,
// comme le rappel de la veille : de 22 h à 9 h à Paris, l'annonce attend le
// matin (le premier téléphone ouvert après 9 h la sonne).
//
// Qui l'appelle : n'importe quel joueur de la ligue, sans le savoir — l'app
// la sonne à l'ouverture tant qu'une journée a des missions ouvertes
// (MissionsAnnonce, lib/sfl/missions-reponses.ts). Il n'y a pas de cron assez
// fréquent sur Vercel pour ça ; la ligue ouvre l'app bien plus souvent.
// Rejouer l'appel ne renvoie rien : chaque joueur est « réservé » dans
// missions_envois avant l'envoi (insert … on conflict do nothing), si bien
// que deux appels simultanés ne préviennent personne deux fois. Un envoi qui
// échoue partout libère la réservation : le prochain appel réessaie.
//
// Le texte : le contrat du joueur, son rang, ce qu'il rapporte et ce qu'il
// coûte raté, puis l'heure limite — « Contrat de rang S : tiens Abdel à 8
// buts et passes D. +130 XP, −65 si tu échoues. Accepte avant dimanche
// 13h00. » Toucher la notification ouvre les Actus sur ses missions.
//
// Elle est suivie comme les autres (lib/server/push-envoi.ts, motif
// « missions ») : la base reconnaît seule le joueur qui répond ensuite à ses
// missions (trigger missions_reponses_push_effet).
//
// La route agit avec la clé secrète : elle exige une session de membre.

import { NextRequest, NextResponse } from "next/server";
import { prevenir, type Envoi } from "@/lib/server/push-envoi";
import { cleVapid } from "@/lib/server/web-push";
import { appelant, serveur } from "@/lib/sfl/serveur-ligue.server";
import { lireSaisonServeur } from "@/lib/sfl/saison-serveur.server";
import { dimancheEnCours, phrase, rangDe, risqueDe, type Mission } from "@/lib/sfl/missions";

export const maxDuration = 30;

/** Le temps sans publication de l'admin après lequel la feuille est tenue pour finie. */
const CALME = 15 * 60_000;
/** La journée, à Paris : de 9 h à 22 h. */
const JOUR = [9, 22] as const;

/** L'heure qu'il est à Paris (0 à 23). */
const heureParis = (d: Date) =>
  Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", hour: "2-digit", hourCycle: "h23" }).format(d));

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** « Contrat de rang S : tiens Abdel à 8 buts et passes D. +130 XP, −65 si tu échoues. » */
function annonce(contrat: Mission, nom: (n: string) => string): string {
  const objectif = phrase(contrat, nom);
  return `Contrat de rang ${rangDe(contrat)}\u00a0: ${objectif.charAt(0).toLowerCase()}${objectif.slice(1)} +${contrat.xp} XP, −${risqueDe(contrat)} si tu échoues.`;
}

/** « dimanche 13h00 », ou « 13h00 » le jour même — à l'heure de Paris. */
function limite(coupEnvoi: Date, heure: string, maintenant: Date): string {
  const jour = (d: Date) => new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short" }).format(d);
  if (jour(coupEnvoi) === jour(maintenant)) return heure;
  const nom = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long" }).format(coupEnvoi);
  return `${nom} ${heure}`;
}

export async function POST(req: NextRequest) {
  const sb = serveur();
  if (!sb) return NextResponse.json({ error: "pas branché" }, { status: 503 });
  const moi = await appelant(sb, req);
  if (!moi) return NextResponse.json({ error: "Session requise." }, { status: 401 });
  const { data: profil } = await sb.from("profiles").select("valide").eq("id", moi.id).maybeSingle();
  if (!profil?.valide) return NextResponse.json({ error: "Réservé aux joueurs de la ligue." }, { status: 403 });

  // Les missions se tirent sur la saison des votes appliqués, comme sur les
  // téléphones (use-missions.ts) : mêmes rivaux, mêmes cibles.
  const maintenant = new Date();
  let lue;
  try {
    lue = await lireSaisonServeur(sb, maintenant);
  } catch {
    return NextResponse.json({ envoyes: 0, fini: false });
  }
  const saison = lue?.saison;
  if (!saison) return NextResponse.json({ envoyes: 0, fini: true });
  const d = dimancheEnCours(saison, maintenant);
  if (!d || d.joue || maintenant.getTime() >= d.coupEnvoi.getTime()) return NextResponse.json({ envoyes: 0, fini: true });
  const publieLe = new Date(lue?.updatedAt ?? 0).getTime();
  if (maintenant.getTime() - publieLe < CALME) return NextResponse.json({ envoyes: 0, attente: true });
  const heure = heureParis(maintenant);
  if (heure < JOUR[0] || heure >= JOUR[1]) return NextResponse.json({ envoyes: 0, attente: true });

  const cle = cleVapid();
  if (!cle) return NextResponse.json({ envoyes: 0, fini: true });

  // Les joueurs de la feuille, leurs noms affichés (le rival dans la phrase) et leurs abonnements.
  const noms = [...d.missions.keys()];
  let { data: profils, error } = await sb.from("profiles").select("id, name, nom_affiche");
  // Avant la migration (aperçus), nom_affiche n'existe pas encore.
  if (error) ({ data: profils, error } = await sb.from("profiles").select("id, name"));
  const lignes = (profils ?? []) as { id: string; name: string; nom_affiche?: string | null }[];
  const affiches = new Map(lignes.map((p) => [p.name, p.nom_affiche || p.name]));
  const idDe = new Map(lignes.filter((p) => noms.includes(p.name)).map((p) => [p.name, p.id]));
  const ids = [...idDe.values()];
  if (!ids.length) return NextResponse.json({ envoyes: 0, fini: true });
  const { data: abonnements } = await sb.from("push_abonnements").select("user_id").in("user_id", ids);
  const joignables = new Set(((abonnements ?? []) as { user_id: string }[]).map((ab) => ab.user_id));
  const abonnes = noms.filter((n) => joignables.has(idDe.get(n) ?? ""));
  if (!abonnes.length) return NextResponse.json({ envoyes: 0, fini: true });

  // La réservation : seuls ceux qu'on vient d'inscrire sont prévenus par cet appel.
  const { data: reserves, error: refus } = await sb
    .from("missions_envois")
    .upsert(
      abonnes.map((joueur) => ({ saison: d.saison, j: d.j, joueur })),
      { onConflict: "saison,j,joueur", ignoreDuplicates: true }
    )
    .select("joueur");
  // Table absente (avant la migration) : on n'envoie rien plutôt que d'envoyer deux fois.
  if (refus) return NextResponse.json({ envoyes: 0, fini: true });

  const quand = limite(d.coupEnvoi, d.heure, maintenant);
  const nom = (n: string) => affiches.get(n) ?? n;
  const inscrits = ((reserves ?? []) as { joueur: string }[]).map((x) => x.joueur);
  const envois = new Map<string, Envoi>();
  for (const joueur of inscrits) {
    const contrat = d.missions.get(joueur)?.find((m) => m.creneau === "contrat");
    envois.set(idDe.get(joueur)!, {
      notif: {
        titre: `Missions Bola · J${d.j}`,
        texte: couper(`${contrat ? `${annonce(contrat, nom)} ` : ""}Accepte avant ${quand}.`, 180),
        url: "/profil/xp?vue=missions",
        tag: `missions-${d.saison}-${d.j}`,
      },
      motif: "missions",
      ref: `missions:${d.saison}:${d.j}`,
    });
  }
  const { recus } = await prevenir(sb, cle, envois);
  const rates = inscrits.filter((joueur) => !recus.has(idDe.get(joueur)!));
  if (rates.length > 0)
    await sb.from("missions_envois").delete().eq("saison", d.saison).eq("j", d.j).in("joueur", rates);

  return NextResponse.json({ envoyes: recus.size, fini: rates.length === 0 });
}
