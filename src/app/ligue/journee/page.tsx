"use client";

// Le récap d'un dimanche, en entier — ce qui était la vue Journée de la
// Ligue. Depuis le 22/10, l'onglet est le fil des Actus (/ligue,
// components/sfl/actus) ; on arrive ici depuis une publication « Le récap »,
// une feuille de match touchée au Vestiaire (?j=N) ou un ancien lien vers
// les Matchs (?vue=matchs). Deux vues sous un sélecteur :
//   · Journée : les joueurs à l'honneur, en cartes (a-l-honneur.tsx), puis
//               le récap (le rideau GSAP se lève et le scrollytelling se
//               déroule) et les prochaines journées ;
//   · Matchs  : les journées jouées, une carte chacune.
// Les classements sont dans les stories du fil ; la flèche ramène au fil.
// Le récap lui-même vit dans feed/journee-recap.tsx.

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";
import { JourneeRecap } from "@/components/sfl/feed/journee-recap";
import { Ecarts } from "@/components/sfl/ecarts";
import { SaisonArchiveProvider } from "@/components/sfl/season-provider";
import { journeeJouee, saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { JourneeOpening } from "@/components/sfl/feed/journee-opening";
import { CarteJournee } from "@/components/sfl/carte-journee";
import { ALHonneur } from "@/components/sfl/a-l-honneur";
import { cn } from "@/lib/utils";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";

// Les deux dimanches après celui de la convocation, lus côté client
// (vides au rendu serveur, pour que l'hydratation concorde).
const rienAEcouter = () => () => {};
function lireDimanches(): string {
  const d1 = prochainDimanche(prochainDimanche(new Date()));
  const d2 = prochainDimanche(d1);
  return `${labelDateFr(d1)}|${labelDateFr(d2)}`;
}

type Vue = "journee" | "matchs";
const VUES: [Vue, string][] = [
  ["journee", "Journée"],
  ["matchs", "Matchs"],
];

export default function LiguePage() {
  // useSearchParams impose une frontière Suspense côté App Router.
  return (
    <Suspense fallback={null}>
      <Ligue />
    </Suspense>
  );
}

function Ligue() {
  const { journees, saison } = useSeason();
  // L'onglet Ligue s'ouvre sur le récap éditorial de la dernière journée ;
  // ?vue=classements (les anciens liens vers /stats) ouvre les classements.
  const params = useSearchParams();
  const router = useRouter();
  const vueDemandee = params.get("vue");
  const [view, setView] = useState<Vue>(
    VUES.some(([id]) => id === vueDemandee) ? (vueDemandee as Vue) : "journee"
  );
  // Les anciens liens (et les notifications d'avant le 19/10) vers la vue
  // Vestiaire de la Ligue.
  useEffect(() => {
    if (vueDemandee === "vestiaire") router.replace("/vestiaire");
  }, [vueDemandee, router]);

  /* --------------------- Les capsules de journées --------------------- */

  // Une journée compte comme jouée quand ses actions sont saisies : un résultat,
  // un but ou une passe. Une journée ouverte par l'admin avec ses présents n'en
  // est pas une — rien à récapituler, rien à classer, « stats à venir ».
  const played = useMemo(
    () =>
      journees.filter((j) =>
        saison.entries.some((e) => e.j === j.j && (e.result || e.buts > 0 || e.passes > 0))
      ),
    [journees, saison.entries]
  );
  const latestJ = played[played.length - 1]?.j ?? journees[0]?.j ?? 1;

  // La saison passée, pour son dernier récap tant que rien n'est joué.
  const derniereArchive = saison.archives?.[saison.archives.length - 1];
  const saisonArchive = useMemo(() => (derniereArchive ? saisonDepuisArchive(derniereArchive) : null), [derniereArchive]);
  const dernierJArchive = useMemo(() => {
    if (!saisonArchive) return 1;
    const joues = saisonArchive.journees.filter((m) => journeeJouee(saisonArchive, m.j)).map((m) => m.j);
    return joues.length ? Math.max(...joues) : (saisonArchive.journees[saisonArchive.journees.length - 1]?.j ?? 1);
  }, [saisonArchive]);
  const jDemandee = Number(params.get("j"));
  const [selectedJ, setSelectedJ] = useState<number | null>(Number.isInteger(jDemandee) && jDemandee > 0 ? jDemandee : null);
  const currentJ = selectedJ ?? latestJ;
  const [opening, setOpening] = useState<number | null>(null);

  const openJournee = (j: number) => {
    if (j === currentJ || opening !== null) return;
    setOpening(j);
  };
  const onReveal = useCallback(() => {
    setOpening((j) => {
      if (j !== null) {
        setSelectedJ(j);
        document.getElementById("app-scroll")?.scrollTo({ top: 0 });
      }
      return j;
    });
  }, []);
  const onDone = useCallback(() => setOpening(null), []);
  const openingMeta = opening !== null ? journees.find((x) => x.j === opening) : undefined;

  // La convocation porte la prochaine journée ; puis les deux suivantes.
  const dimanches = useSyncExternalStore(rienAEcouter, lireDimanches, () => "");
  const prochainJ = Math.max(0, ...saison.journees.map((m) => m.j)) + 1;
  const dimanchesSuivants = dimanches
    ? dimanches.split("|").map((d, i) => [`J${prochainJ + 1 + i}`, `Dimanche ${d}`] as const)
    : [];

  // Les capsules de journées — touche pour en ouvrir une autre. En ligne
  // qui défile sur téléphone ; en grille dans la petite colonne sur ordinateur.
  const capsules = (grille: boolean) => (
    <div>
      <p className="mono-label mb-2 px-1 text-foreground/30">
        Les journées · touche pour ouvrir
      </p>
      <div
        className={cn(
          "flex gap-2",
          grille
            ? "grid grid-cols-[repeat(auto-fill,minmax(78px,1fr))]"
            : "-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        )}
      >
        {[...played].reverse().map((jn) => {
          const active = jn.j === currentJ;
          const buts = (jn.matches ?? []).reduce(
            (s, m) => s + m.teamA.score + m.teamB.score,
            0
          );
          return (
            <button
              key={jn.j}
              onClick={() => openJournee(jn.j)}
              className={cn(
                "flex shrink-0 flex-col items-start gap-0.5 rounded-2xl px-3.5 py-2.5 text-left transition-transform active:scale-[0.96]",
                active ? "bg-foreground" : "glass-soft"
              )}
            >
              <span className={cn("mono-label", active ? "text-background" : "text-primary")}>
                J{jn.j}
              </span>
              <span
                className={cn(
                  "text-[12.5px] font-semibold whitespace-nowrap",
                  active ? "text-background" : "text-foreground/70"
                )}
              >
                {jn.date}
              </span>
              <span
                className={cn(
                  "mono-label text-[8px]",
                  active ? "text-background/60" : "text-foreground/30"
                )}
              >
                {buts} buts
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="shell flex flex-col gap-6 py-2 sm:py-6 lg:gap-[var(--fib-34)] lg:pt-[var(--fib-55)]">
      {/* Rideau d'ouverture d'une journée */}
      {opening !== null && (
        <JourneeOpening
          j={opening}
          date={openingMeta?.date ?? ""}
          onReveal={onReveal}
          onDone={onDone}
        />
      )}

      {/* Un seul sélecteur, toujours là, et le Wall of Fame au bout. Sur
          ordinateur, le titre de la page à gauche (comme Ma carte), et le
          sélecteur ramené à sa juste largeur au lieu de traverser l'écran. */}
      <div className="flex items-center gap-1.5 sm:gap-2 lg:gap-[var(--fib-13)]">
      <Link href="/ligue" aria-label="Actus" className="glass flex size-10 shrink-0 items-center justify-center rounded-full sm:size-11 lg:hidden">
        <ChevronLeft className="size-5" />
      </Link>
      <h1 className="hidden text-[34px] font-bold tracking-tight lg:mr-auto lg:block">Le récap</h1>
      <div className="glass flex flex-1 gap-1 rounded-full p-1 lg:w-[420px] lg:flex-none" role="tablist" aria-label="Vue du récap">
        {VUES.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={cn(
              "flex-auto rounded-full px-[7px] py-2 text-[12.5px] whitespace-nowrap font-semibold transition-colors min-[400px]:px-2.5 min-[400px]:text-[13px] sm:px-4 sm:text-sm",
              view === id ? "bg-foreground text-background" : "text-muted-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
        <BoutonRecherche className="size-10 sm:size-11" />
      </div>

      {view === "matchs" ? (
        <>
          <p className="px-1 text-[13px] text-foreground/40">
            Chaque dimanche sur son terrain · {played.length} journée
            {played.length > 1 ? "s" : ""} jouée{played.length > 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 lg:gap-[var(--fib-21)] xl:grid-cols-3">
            {[...played].reverse().map((jn) => (
              <CarteJournee
                key={jn.j}
                journee={jn}
                onOuvrir={() => {
                  setView("journee");
                  openJournee(jn.j);
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {played.length > 0 && <div className="-mt-1 lg:hidden">{capsules(false)}</div>}

          {/* Sur ordinateur, au nombre d'or : le récap dans la grande colonne,
              les journées et les prochaines dans la petite, à côté. */}
          <div className="grille-or grille-or--inverse flex flex-col gap-6">
            {/* Le récap de la journée ouverte — remonté à neuf à chaque ouverture.
                Borné en largeur : au-delà, une ligne de texte devient illisible. */}
            <div className="mesure flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1 lg:max-w-none">
              {/* Les joueurs d'abord, en cartes ; puis les écarts, où la saison se raconte. */}
              {played.length > 0 && <ALHonneur j={currentJ} />}
              <Ecarts />
              {played.length === 0 && derniereArchive ? (
                // Rien de joué cette saison : le dernier récap de la saison
                // passée, en attendant le premier de la nouvelle.
                <>
                  <p className="mono-label px-1 text-foreground/40">
                    {derniereArchive.nom} · le dernier récap — la saison {saison.numero ?? 0} commence
                  </p>
                  <SaisonArchiveProvider saison={saisonArchive!}>
                    <JourneeRecap key={`a${dernierJArchive}`} j={dernierJArchive} />
                  </SaisonArchiveProvider>
                </>
              ) : (
                <JourneeRecap key={currentJ} j={currentJ} />
              )}
            </div>

            <aside className="flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-1 lg:gap-[var(--fib-34)]">
              {played.length > 0 && <div className="hidden lg:block">{capsules(true)}</div>}
              {/* 16 · Les prochaines journées */}
              <section className="mesure lg:max-w-none">
                <div className="mb-3 px-1">
                  <h2 className="text-[17px] font-bold tracking-tight">Les prochaines journées</h2>
                </div>
                <PresencePanel />
                <div className="mt-2.5 flex flex-col gap-2 opacity-50">
                  {dimanchesSuivants.map(([jj, d]) => (
                    <div key={jj} className="flex items-center justify-between rounded-2xl bg-card px-4 py-3">
                      <span className="mono-label text-muted-foreground">{jj}</span>
                      <span className="text-[14px] font-semibold">{d}</span>
                      <span className="mono-label text-muted-foreground">À venir</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
