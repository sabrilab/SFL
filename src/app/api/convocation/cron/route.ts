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
// L'expiration du vendredi minuit et la révélation des équipes du vendredi
// 19h n'ont PAS besoin du serveur : elles sont jugées à l'affichage par
// lib/sfl/convocation-temps.ts, à l'heure de Paris. Le seul travail qui doit
// se faire sans personne devant un écran, c'est celle-ci : ouvrir la semaine.
//
// Sécurité : si CRON_SECRET est posé dans Vercel, l'appel doit le porter
// (en-tête Authorization) — c'est ce que fait le cron Vercel de lui-même.

import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { candidateUrls, normalizeDbUrl } from "@/lib/server/migrate";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";

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

export async function GET(req: NextRequest) {
  // Le cron Vercel présente le secret ; un appel anonyme est refusé si le
  // secret existe. Sans secret configuré, la route reste inoffensive : elle
  // est idempotente et ne fait qu'ouvrir la semaine.
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
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
