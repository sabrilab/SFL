// La rotation hebdomadaire des convocations — le lundi matin, tout seul.
//
// Appelée par le cron Vercel (voir vercel.json) chaque lundi. Elle :
//   1. regarde la dernière convocation en base ;
//   2. si une convocation OUVERTE vise déjà le prochain dimanche → rien à
//      faire (l'appel est idempotent, on peut la déclencher dix fois) ;
//   3. sinon : clôture les convocations ouvertes (le dimanche passé est
//      passé) et en crée une neuve pour le prochain dimanche — même heure,
//      même lieu, même effectif que la précédente, journée suivante.
//
// Au passage, elle vide le journal d'usage, le suivi des notifications et les
// liens de parrainage ouverts de ce qui a plus de 13 mois, comme le promet la
// politique de confidentialité (même sans nouvelle semaine).
//
// L'expiration du vendredi minuit et la révélation des équipes du vendredi
// 19h n'ont PAS besoin du serveur : elles sont jugées à l'affichage par
// lib/sfl/convocation-temps.ts, à l'heure de Paris. Le seul travail qui doit
// se faire sans personne devant un écran, c'est celle-ci : ouvrir la semaine.
//
// Sécurité : si CRON_SECRET est posé dans Vercel, l'appel doit le porter
// (en-tête Authorization) — c'est ce que fait le cron Vercel de lui-même.
// Sans secret, la route ne travaille que le lundi matin, heure de Paris, là
// où passe le cron : appelée par n'importe qui un dimanche, elle clôturait la
// convocation du jour même et ouvrait déjà la semaine suivante (22/10/2026).
// Le lundi matin, elle ne fait rien de plus que ce que le cron ferait.

import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { candidateUrls, normalizeDbUrl } from "@/lib/server/migrate";
import { instantParis, labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";

export const dynamic = "force-dynamic";

interface DerniereConvocation {
  id: number;
  journee: number;
  heure: string;
  lieu: string;
  effectif: number;
  date_label: string;
  statut: string;
}

/** Le lundi de 5 h à 14 h, heure de Paris : la fenêtre du cron (7 h UTC, à l'heure près). */
function fenetreDuCron(date: Date): boolean {
  const { jourIso, heure } = instantParis(date);
  return jourIso === 1 && heure >= 5 && heure < 14;
}

export async function GET(req: NextRequest) {
  // Le cron Vercel présente le secret ; un appel anonyme est refusé si le
  // secret existe. Sans secret configuré, seulement dans la fenêtre du cron.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (!secret && !fenetreDuCron(new Date())) {
    return NextResponse.json({ error: "Seulement le lundi matin." }, { status: 403 });
  }

  const candidates = candidateUrls();
  if (candidates.length === 0) {
    return NextResponse.json({ status: "not-configured" });
  }

  const dimanche = prochainDimanche(new Date());
  const label = labelDateFr(dimanche);

  const connectErrors: string[] = [];
  for (const c of candidates) {
    const client = new Client({
      connectionString: normalizeDbUrl(c.url),
      connectionTimeoutMillis: 8000,
    });
    try {
      await client.connect();
    } catch (e) {
      connectErrors.push(`${c.name}: ${e instanceof Error ? e.message : String(e)}`);
      await client.end().catch(() => {});
      continue;
    }

    try {
      // Le journal d'usage et le suivi des notifications : 13 mois au plus
      // (politique de confidentialité). L'arrivée d'un téléphone toujours
      // abonné reste : sans elle, la courbe des abonnés le perdrait.
      await client
        .query("delete from public.activity where created_at < now() - interval '13 months'")
        .catch((e) => console.error("[cron] journal d'usage :", e instanceof Error ? e.message : e));
      await client
        .query(
          `delete from public.push_envois where envoyee_le < now() - interval '13 months';
           delete from public.push_historique h
            where h.le < now() - interval '13 months'
              and not exists (select 1 from public.push_abonnements a where md5(a.endpoint) = h.appareil)`
        )
        .catch((e) => console.error("[cron] suivi des notifications :", e instanceof Error ? e.message : e));
      // Les liens de parrainage ouverts : 13 mois au plus, eux aussi.
      await client
        .query("delete from public.parrainage_visites where created_at < now() - interval '13 months'")
        .catch((e) => console.error("[cron] liens de parrainage ouverts :", e instanceof Error ? e.message : e));

      const { rows } = await client.query<DerniereConvocation>(
        `select id, journee, heure, lieu, effectif, date_label, statut
           from public.convocations
          order by id desc limit 1`
      );
      const derniere = rows[0];

      // Déjà ouverte pour ce dimanche : le cron est passé (ou l'admin l'a
      // publiée à la main). On ne touche à rien.
      if (derniere && derniere.statut === "ouverte" && derniere.date_label === label) {
        return NextResponse.json({ status: "deja-ouverte", dimanche: label });
      }

      await client.query(
        "update public.convocations set statut = 'cloturee' where statut = 'ouverte'"
      );
      const journee = (derniere?.journee ?? 8) + 1;
      await client.query(
        `insert into public.convocations (journee, jour, date_label, heure, lieu, effectif)
         values ($1, 'Dimanche', $2, $3, $4, $5)`,
        [
          journee,
          label,
          derniere?.heure ?? "13h00",
          derniere?.lieu ?? "Terrain extérieur — 5 vs 5",
          derniere?.effectif ?? 10,
        ]
      );
      return NextResponse.json({ status: "ouverte", journee, dimanche: label });
    } catch (e) {
      return NextResponse.json(
        { status: "error", message: e instanceof Error ? e.message : String(e) },
        { status: 500 }
      );
    } finally {
      await client.end().catch(() => {});
    }
  }

  return NextResponse.json(
    { status: "error", message: `connexion impossible — ${connectErrors.join(" | ")}` },
    { status: 500 }
  );
}
