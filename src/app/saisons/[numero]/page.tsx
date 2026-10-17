"use client";

// Une saison close, relue telle quelle.
//
// L'archive voyage dans le document de saison ; on la rejoue dans le moteur
// exactement comme la saison en cours — mêmes classements, mêmes journées —
// et on l'affiche en lecture seule. Rien n'est recalculé autrement : ce qu'on
// lit ici est ce que la ligue affichait le soir de la clôture.

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JourneesDepliables } from "@/components/sfl/feed/journees-depliables";
import { useSeason } from "@/components/sfl/season-provider";
import { rankByMetric } from "@/lib/sfl/engine";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { RANKINGS } from "@/lib/sfl/rankings";
import { publicOnly } from "@/lib/sfl/hidden";

function dateLisible(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function SaisonArchiveePage() {
  const { numero } = useParams<{ numero: string }>();
  const { saison } = useSeason();
  const archive = saison.archives?.find((a) => String(a.numero) === numero);

  const derived = useMemo(() => (archive ? deriveSeason(saisonDepuisArchive(archive)) : null), [archive]);
  const players = useMemo(() => (derived ? publicOnly(derived.players) : []), [derived]);
  const journees = useMemo(() => (derived ? [...derived.journees].reverse() : []), [derived]);
  const totalButs = journees.reduce(
    (s, j) => s + (j.matches ?? []).reduce((t, m) => t + m.teamA.score + m.teamB.score, 0),
    0
  );

  if (!archive || !derived) {
    return (
      <main className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-muted-foreground">Cette saison n&apos;est pas dans les archives.</p>
        <Button render={<Link href="/palmares" />} variant="ghost" className="mt-4 rounded-full">Retour</Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 pt-3 pb-24">
      <div className="flex items-center gap-2">
        <Button render={<Link href="/palmares" aria-label="Retour au Wall of Fame" />} variant="ghost" size="icon" className="rounded-full">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="mono-label text-[10px] text-muted-foreground">ARCHIVE · CLOSE LE {dateLisible(archive.cloturee).toUpperCase()}</p>
          <h1 className="truncate text-[22px] font-extrabold tracking-tight">{archive.nom}</h1>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          [journees.length, "journées"],
          [totalButs, "buts"],
          [players.filter((p) => p.matchs > 0).length, "joueurs"],
        ].map(([v, l]) => (
          <div key={String(l)} className="glass rounded-2xl px-3 py-3 text-center">
            <p className="text-[22px] font-black tabular-nums">{v}</p>
            <p className="mono-label text-[10px] text-muted-foreground">{String(l).toUpperCase()}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="classement">
        <TabsList className="w-full rounded-full">
          <TabsTrigger value="classement" className="flex-1 rounded-full">Classements</TabsTrigger>
          <TabsTrigger value="journees" className="flex-1 rounded-full">Journées</TabsTrigger>
        </TabsList>

        <TabsContent value="classement" className="mt-3 flex flex-col gap-3">
          {RANKINGS.map((def) => {
            const classes = rankByMetric(players, def.value).filter((p) => def.showAll || def.value(p) > 0);
            if (classes.length === 0) return null;
            return (
              <section key={def.id} className="glass overflow-hidden rounded-3xl">
                <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
                  <h2 className="text-[15px] font-bold tracking-tight">{def.label}</h2>
                  <span className="mono-label text-[10px] text-muted-foreground">{def.unit.toUpperCase()}</span>
                </div>
                {classes.slice(0, 10).map((p) => (
                  <div key={p.name} className="flex items-center gap-3 border-t border-border/40 px-4 py-2">
                    <span className="w-5 text-[12px] text-muted-foreground tabular-nums">{p.rank}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="text-[14px] font-bold tabular-nums">{def.value(p)}</span>
                  </div>
                ))}
              </section>
            );
          })}
        </TabsContent>

        <TabsContent value="journees" className="mt-3">
          <JourneesDepliables journees={journees} onOuvrir={() => {}} />
        </TabsContent>
      </Tabs>

      <p className="px-1 text-[12px] text-muted-foreground">
        Cette saison est close : ce que tu lis ici ne bouge plus. Les cartes, elles, ont été
        requalifiées pour la saison suivante.
      </p>
    </main>
  );
}
