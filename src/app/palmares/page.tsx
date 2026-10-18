"use client";

// Le Wall of Fame — l'histoire de la ligue, en trois niveaux qu'on ouvre
// l'un après l'autre, sans jamais tout montrer d'un coup :
//   1. les saisons, une carte chacune : le podium du Pépite d'Or en cartes
//      joueurs (photo comprise), le meilleur buteur, passeur et MVP ; on
//      entre dans la saison pour ses classements et ses journées ;
//   2. les légendes, les records de carrière, une catégorie à la fois ;
//   3. un parcours, saison par saison : rang, victoires, nuls, défaites,
//      et les médailles gagnées. Le sien par défaut ; toucher une légende
//      montre le sien.
// Les proportions suivent le nombre d'or : la carte du champion est φ fois
// celle de ses dauphins. Tout est lu dans lib/sfl/palmares.ts.

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Medaille } from "@/components/sfl/vitrine";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { legendes, parcours, saisonsPalmares, type Legende, type SaisonPalmares } from "@/lib/sfl/palmares";
import { vitrine } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

// Le podium d'une saison : le champion en carte moyenne, ses dauphins en petite.
const DAUPHIN = FORMAT_CARTE.petite;
const CHAMPION = FORMAT_CARTE.moyenne;

function dateCourte(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function lienSaison(s: SaisonPalmares) {
  return s.cloturee ? `/saisons/${s.numero}` : "/ligue";
}

/* ------------------------------ Une saison ------------------------------ */

function CarteSaison({ s }: { s: SaisonPalmares }) {
  const [premier, deuxieme, troisieme] = [1, 2, 3].map((r) => s.podium.find((p) => p.rank === r) ?? null);
  // Le podium classique : le 2e à gauche, le champion au milieu, le 3e à droite.
  const marches = [
    { p: deuxieme, rang: 2, size: DAUPHIN },
    { p: premier, rang: 1, size: CHAMPION },
    { p: troisieme, rang: 3, size: DAUPHIN },
  ];
  const lauriers = [
    ["Buteur", s.buteur],
    ["Passeur", s.passeur],
    ["MVP", s.mvp],
  ] as const;

  return (
    <article className="glass flex flex-col overflow-hidden rounded-[28px]">
      <div className="flex items-baseline justify-between px-5 pt-4">
        <h3 className="text-[17px] font-extrabold tracking-tight">{s.nom}</h3>
        <span className="mono-label text-foreground/40">
          {s.cloturee ? dateCourte(s.cloturee) : "En cours"}
        </span>
      </div>

      {s.podium.length > 0 ? (
        <div className="flex items-end justify-center gap-3 px-4 pt-4">
          {marches.map(({ p, rang, size }) => (
            <div key={rang} className="flex min-w-0 flex-col items-center gap-1.5">
              {p ? (
                <>
                  <MiniCarte player={p} size={size} detail={`${rang}${rang === 1 ? "er" : "e"} au Pépite d'Or · ${p.pp} pts`} />
                  <span className={cn("max-w-[96px] truncate font-semibold", rang === 1 ? "text-[14px]" : "text-[12px] text-foreground/70")}>
                    {p.name}
                  </span>
                  <span className="mono-label text-foreground/40 tabular-nums">
                    {p.pp} pts
                    {/* Les ex aequo : une seule carte, le compte des autres. */}
                    {s.podium.filter((x) => x.rank === rang).length > 1 && ` · +${s.podium.filter((x) => x.rank === rang).length - 1}`}
                  </span>
                </>
              ) : (
                <span style={{ width: 255 * size }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="px-5 pt-3 text-[13px] text-muted-foreground">Pas encore de points au Pépite d&apos;Or.</p>
      )}

      <div className="flex flex-wrap justify-center gap-1.5 px-4 pt-4">
        {lauriers.map(([titre, l]) =>
          l ? (
            <span key={titre} className="inline-flex items-center gap-2 rounded-[16px] border border-foreground/15 bg-foreground/[0.05] py-1 pr-3 pl-1 text-[12px]">
              <MiniCarte player={l.player} size={FORMAT_CARTE.petite} detail={`${titre} · ${l.n}`} />
              <span className="flex flex-col leading-tight">
                <span className="mono-label text-foreground/45">{titre}</span>
                <span>
                  <span className="font-semibold">{l.player.name}</span> <span className="text-foreground/50 tabular-nums">{l.n}</span>
                </span>
              </span>
            </span>
          ) : null
        )}
      </div>

      <Link
        href={lienSaison(s)}
        className="mt-4 flex items-center justify-between border-t border-foreground/10 px-5 py-3 text-[13px] text-foreground/60 transition-colors hover:text-foreground"
      >
        <span className="tabular-nums">
          {s.journees} journée{s.journees > 1 ? "s" : ""} · {s.buts} buts · {s.classement.length} joueurs
        </span>
        <ChevronRight className="size-4" />
      </Link>
    </article>
  );
}

/* ------------------------------ Les légendes ----------------------------- */

const CATEGORIES: { id: string; label: string; valeur: (l: Legende) => number }[] = [
  { id: "titres", label: "Titres", valeur: (l) => l.titres },
  { id: "buts", label: "Buts", valeur: (l) => l.buts },
  { id: "passes", label: "Passes", valeur: (l) => l.passes },
  { id: "victoires", label: "Victoires", valeur: (l) => l.victoires },
  { id: "mvp", label: "MVP", valeur: (l) => l.mvp },
  { id: "matchs", label: "Matchs", valeur: (l) => l.matchs },
];

function Legendes({ liste, onChoisir }: { liste: Legende[]; onChoisir: (nom: string) => void }) {
  // On ouvre sur la première catégorie qui distingue quelqu'un.
  const premiere = CATEGORIES.find((c) => liste.some((l) => c.valeur(l) > 0))?.id ?? "matchs";
  const [cat, setCat] = useState(premiere);
  const def = CATEGORIES.find((c) => c.id === cat)!;
  const top = liste
    .filter((l) => def.valeur(l) > 0)
    .sort((a, b) => def.valeur(b) - def.valeur(a) || b.matchs - a.matchs)
    .slice(0, 5);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="mono-label px-1 text-foreground/40">Légendes</h2>
      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]" role="tablist" aria-label="Catégorie">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            role="tab"
            aria-selected={c.id === cat}
            onClick={() => setCat(c.id)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              c.id === cat ? "bg-foreground text-background" : "glass-soft text-foreground/60"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="glass overflow-hidden rounded-[24px]">
        {top.length === 0 && <p className="px-4 py-4 text-[13px] text-muted-foreground">Personne pour l&apos;instant.</p>}
        {top.map((l, i) => (
          <div key={l.player.name} className={cn("flex items-center gap-3 px-4 py-2.5", i > 0 && "border-t border-foreground/[0.08]")}>
            <span className="w-4 text-[12px] text-foreground/40 tabular-nums">{i + 1}</span>
            <MiniCarte player={l.player} size={FORMAT_CARTE.petite} />
            <button type="button" onClick={() => onChoisir(l.player.name)} className="flex min-w-0 flex-1 flex-col items-start text-left">
              <span className="max-w-full truncate text-[15px] font-semibold">{l.player.name}</span>
              <span className="text-[12px] text-foreground/45 tabular-nums">
                {l.saisons} saison{l.saisons > 1 ? "s" : ""} · {l.matchs} match{l.matchs > 1 ? "s" : ""}
              </span>
            </button>
            <span className="text-[20px] font-black tabular-nums">{def.valeur(l)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------ Un parcours ------------------------------ */

function Parcours({ nom, saisons, moi, onRevenir }: { nom: string; saisons: SaisonPalmares[]; moi: boolean; onRevenir: () => void }) {
  const { saison } = useSeason();
  const etapes = useMemo(() => parcours(saisons, nom), [saisons, nom]);
  const medailles = useMemo(() => vitrine(saison, nom, new Date()).filter((e) => e.palier > 0), [saison, nom]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="mono-label text-foreground/40">{moi ? "Ton parcours" : `Le parcours de ${nom}`}</h2>
        {!moi && (
          <button onClick={onRevenir} className="flex items-center gap-1 text-[12px] font-semibold text-foreground/60">
            <ArrowLeft className="size-3.5" /> Le mien
          </button>
        )}
      </div>

      {etapes.length === 0 ? (
        <p className="glass-soft rounded-[24px] px-4 py-4 text-[13px] text-muted-foreground">Ton premier dimanche ouvrira ton parcours.</p>
      ) : (
        <div className="glass overflow-hidden rounded-[24px]">
          {etapes.map(({ saison: s, rang, sur, player, bilan }, i) => {
            const total = bilan.victoires + bilan.nuls + bilan.defaites;
            return (
              <Link
                key={s.numero}
                href={lienSaison(s)}
                className={cn("flex items-center gap-3.5 px-4 py-3", i > 0 && "border-t border-foreground/[0.08]")}
              >
                <span className="flex w-11 shrink-0 flex-col items-center">
                  <span className="text-[22px] leading-none font-black tabular-nums">{rang}</span>
                  <span className="mono-label mt-1 text-[9px] text-foreground/40 tabular-nums">sur {sur}</span>
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-bold">{s.nom}</span>
                    <span className="shrink-0 text-[12px] text-foreground/50 tabular-nums">
                      {player.buts} B · {player.passes} P · {player.pp} pts
                    </span>
                  </span>
                  {/* Victoires, nuls, défaites : une barre, sans couleur de verdict. */}
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-foreground/10" aria-hidden>
                    {total > 0 && (
                      <>
                        <span className="bg-foreground" style={{ width: `${(bilan.victoires / total) * 100}%` }} />
                        <span className="bg-foreground/40" style={{ width: `${(bilan.nuls / total) * 100}%` }} />
                      </>
                    )}
                  </span>
                  <span className="text-[12px] text-foreground/55 tabular-nums">
                    {bilan.victoires} V · {bilan.nuls} N · {bilan.defaites} D
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-foreground/40" />
              </Link>
            );
          })}
        </div>
      )}

      {medailles.length > 0 && (
        <div className="glass-soft flex gap-3 overflow-x-auto rounded-[24px] px-4 py-3.5 [scrollbar-width:none]">
          {medailles.map((e) => (
            <span key={e.def.id} className="flex w-14 shrink-0 flex-col items-center gap-1.5" title={e.def.nom}>
              <Medaille e={e} diametre={44} />
              <span className="w-full truncate text-center text-[10.5px] text-foreground/55">{e.def.nom}</span>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- Page --------------------------------- */

export default function WallOfFame() {
  const { saison } = useSeason();
  const { player } = useMyPlayer();
  const saisons = useMemo(() => saisonsPalmares(saison), [saison]);
  const liste = useMemo(() => legendes(saisons), [saisons]);
  const [focus, setFocus] = useState<string | null>(null);
  const refParcours = useRef<HTMLDivElement>(null);
  const nom = focus ?? player?.name ?? "";

  const totalJournees = saisons.reduce((t, s) => t + s.journees, 0);
  const totalButs = saisons.reduce((t, s) => t + s.buts, 0);

  const choisir = (n: string) => {
    setFocus(n === player?.name ? null : n);
    refParcours.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="shell flex flex-col gap-7 py-2 sm:py-6">
      <header className="flex flex-col gap-3 px-1">
        <p className="mono-label text-foreground/40">Wall of Fame</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            [saisons.length, "saisons"],
            [totalJournees, "journées"],
            [totalButs, "buts"],
          ].map(([v, l]) => (
            <div key={String(l)} className="glass rounded-2xl px-3 py-3 text-center">
              <p className="text-[24px] font-black tabular-nums">{v}</p>
              <p className="mono-label text-[10px] text-foreground/45">{l}</p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="mono-label px-1 text-foreground/40">Les saisons</h2>
          {saisons.length === 0 ? (
            <p className="glass-soft rounded-[24px] px-4 py-4 text-[13px] text-muted-foreground">La première saison s&apos;écrit dimanche.</p>
          ) : (
            saisons.map((s) => <CarteSaison key={s.numero} s={s} />)
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-7 lg:sticky lg:top-24">
          <div ref={refParcours} className="scroll-mt-24">
            {nom && <Parcours nom={nom} saisons={saisons} moi={focus === null} onRevenir={() => setFocus(null)} />}
          </div>
          <Legendes liste={liste} onChoisir={choisir} />
        </div>
      </div>
    </div>
  );
}
