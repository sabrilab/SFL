"use client";

// Les classements des Actus, en « stories » (Sabri, 22/10 : « avoir ces
// classements de manière simple, sans trop de boutons partout »). En haut du
// fil, une rangée de ronds : chacun est un classement, avec le visage de son
// premier ; le dernier rond est le Wall of Fame. Toucher un rond ouvre le
// classement en plein écran, comme une story : le podium tombe sur ses
// marches, la suite défile, puis le classement suivant arrive seul. Toucher
// à droite avance, à gauche revient, appuyer longtemps met en pause, la croix
// ou Échap ferment. Un rond déjà vu passe au gris, jusqu'au prochain dimanche
// joué (son numéro est retenu dans le navigateur).

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Crown, X } from "lucide-react";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { usePhotoPerso, usePlayerPhoto } from "@/hooks/use-player-photo";
import { useIdentites } from "@/hooks/use-identites";
import { rankByMetric, type MetricRankedPlayer } from "@/lib/sfl/engine";
import { RANKINGS, type RankingDef } from "@/lib/sfl/rankings";
import { cn } from "@/lib/utils";
import { ANTON, Compte, Lecture, t } from "./ecran";
import { TAILLE } from "./cinematiques";
import "./actus.css";

/** Les classements en stories : la Discipline n'est pas une gloire. */
export const STORIES = RANKINGS.filter((r) => r.id !== "discipline");
const DUREE = 7;
const CLE_VUS = "sfl-actus-vus";

function classes(players: Parameters<typeof rankByMetric>[0], def: RankingDef): MetricRankedPlayer[] {
  return rankByMetric(players, def.value).filter((p) => def.showAll || p.value > 0);
}

/* ------------------------------- Déjà vus ------------------------------- */

const ecouteurs = new Set<() => void>();
function lireVus(): string {
  try {
    return localStorage.getItem(CLE_VUS) ?? "";
  } catch {
    return "";
  }
}
function marquerVu(cle: string) {
  try {
    const vus = new Set(lireVus().split("|").filter(Boolean));
    vus.add(cle);
    localStorage.setItem(CLE_VUS, [...vus].slice(-40).join("|"));
  } catch {}
  ecouteurs.forEach((f) => f());
}
function useVus(): Set<string> {
  const brut = useSyncExternalStore(
    (f) => {
      ecouteurs.add(f);
      return () => ecouteurs.delete(f);
    },
    lireVus,
    () => ""
  );
  return useMemo(() => new Set(brut.split("|").filter(Boolean)), [brut]);
}

/* -------------------------------- Les ronds -------------------------------- */

function Visage({ nom, taille }: { nom: string; taille: number }) {
  // La photo posée par le joueur d'abord, comme sur sa carte ; sinon son portrait.
  const perso = usePhotoPerso(nom);
  const portrait = usePlayerPhoto(nom);
  const src = perso ?? portrait;
  const initiale = useIdentites().nom(nom).slice(0, 1).toUpperCase();
  return (
    <span className="relative grid place-items-center overflow-hidden rounded-full bg-[#1d1e22] text-white" style={{ width: taille, height: taille }}>
      <span className="absolute text-[22px] font-bold" style={{ fontFamily: ANTON }}>{initiale}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img key={src} src={src} alt="" className="relative size-full object-cover object-top" onError={(e) => (e.currentTarget.style.display = "none")} />
    </span>
  );
}

export function RondsClassements({ j, moi }: { j: number; moi?: string }) {
  const { players } = useSeason();
  const [ouvert, setOuvert] = useState<number | null>(null);
  const vus = useVus();
  const premiers = useMemo(() => STORIES.map((def) => classes(players, def)[0]), [players]);

  return (
    <>
      <div className="-mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STORIES.map((def, i) => {
          const premier = premiers[i];
          if (!premier) return null;
          const vu = vus.has(`${def.id}-${j}`);
          return (
            <button key={def.id} type="button" onClick={() => setOuvert(i)} className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <span className={cn("rounded-full p-[2.5px]", vu ? "bg-white/15" : "story-anneau")}>
                <span className="block rounded-full bg-background p-[2.5px]">
                  <Visage nom={premier.name} taille={60} />
                </span>
              </span>
              <span className={cn("w-full truncate text-center text-[11.5px] font-medium", vu ? "text-foreground/45" : "text-foreground/85")}>{def.label}</span>
            </button>
          );
        })}
        <Link href="/palmares" className="flex w-[72px] shrink-0 flex-col items-center gap-1.5 active:scale-95 transition-transform">
          <span className="rounded-full bg-white/15 p-[2.5px]">
            <span className="block rounded-full bg-background p-[2.5px]">
              <span className="grid size-[60px] place-items-center rounded-full bg-[#1d1e22]">
                <Crown className="size-6 text-white" />
              </span>
            </span>
          </span>
          <span className="w-full truncate text-center text-[11.5px] font-medium text-foreground/85">Wall of Fame</span>
        </Link>
      </div>
      {ouvert !== null && <Stories depart={ouvert} j={j} moi={moi} onFermer={() => setOuvert(null)} />}
    </>
  );
}

/* ------------------------------- La story ------------------------------- */

export function Stories({ depart, j, onFermer, moi }: { depart: number; j: number; onFermer: () => void; moi?: string }) {
  const [i, setI] = useState(depart);
  const [pause, setPause] = useState(false);
  const appui = useRef<number | null>(null);
  const long = useRef(false);
  const def = STORIES[i];

  useEffect(() => {
    marquerVu(`${def.id}-${j}`);
  }, [def.id, j]);

  const suivant = useCallback(() => setI((x) => (x + 1 < STORIES.length ? x + 1 : (onFermer(), x))), [onFermer]);
  const precedent = useCallback(() => setI((x) => Math.max(0, x - 1)), []);

  // L'avance automatique, suspendue pendant l'appui.
  useEffect(() => {
    if (pause) return;
    const id = window.setTimeout(suivant, DUREE * 1000);
    return () => window.clearTimeout(id);
  }, [i, pause, suivant]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
      if (e.key === "ArrowRight") suivant();
      if (e.key === "ArrowLeft") precedent();
    };
    window.addEventListener("keydown", touche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
    };
  }, [onFermer, suivant, precedent]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      role="dialog"
      aria-label={`Classement ${def.label}`}
      className="fixed inset-0 z-[60] bg-black text-white"
      onPointerDown={() => {
        long.current = false;
        appui.current = window.setTimeout(() => {
          long.current = true;
          setPause(true);
        }, 220);
      }}
      onPointerUp={(e) => {
        if (appui.current) window.clearTimeout(appui.current);
        setPause(false);
        // Une carte touchée s'ouvre en grand : ce n'est pas un geste de story.
        if (long.current || (e.target as HTMLElement).closest("button")) return;
        const x = e.clientX / window.innerWidth;
        if (x < 0.3) precedent();
        else suivant();
      }}
      onPointerCancel={() => {
        if (appui.current) window.clearTimeout(appui.current);
        setPause(false);
      }}
    >
      <div className="relative mx-auto flex h-full max-w-[520px] flex-col" style={{ paddingTop: "max(env(safe-area-inset-top), 10px)", paddingBottom: "max(env(safe-area-inset-bottom), 14px)" }}>
        {/* Les barres de progression, une par classement. */}
        <div className="flex gap-1 px-3">
          {STORIES.map((s, k) => (
            <span key={s.id} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/25">
              {k < i && <span className="block h-full bg-white" />}
              {k === i && <span key={i} className="story-barre block h-full bg-white" data-pause={pause ? "" : undefined} style={{ ["--duree" as string]: `${DUREE}s` }} />}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 pt-3">
          <div>
            <p className="text-[15px] font-bold">{def.label}</p>
            <p className="text-[12px] text-white/50">{def.desc} · après J{j}</p>
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => {
              e.stopPropagation();
              onFermer();
            }}
            className="grid size-10 place-items-center rounded-full bg-white/10"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="actu-ecran relative min-h-0 flex-1 overflow-hidden" data-joue="">
          <div key={def.id} className={cn("actu-scene absolute inset-0", pause && "[&_*]:[animation-play-state:paused]")}>
            <Lecture>
              <Story def={def} moi={moi} />
            </Lecture>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Story({ def, moi }: { def: RankingDef; moi?: string }) {
  const { players } = useSeason();
  const id = useIdentites();
  const liste = classes(players, def);
  const [p1, p2, p3] = liste;
  const suite = liste.slice(3, 9);
  const ici = moi ? liste.find((p) => p.name === moi) : undefined;
  const marches = [
    { p: p2, h: 70, s: TAILLE.moyenne, a: 0.7 },
    { p: p1, h: 108, s: TAILLE.grande, a: 1.2 },
    { p: p3, h: 46, s: TAILLE.moyenne, a: 0.3 },
  ];
  return (
    <div className="flex h-full flex-col px-4 pt-4">
      <div className="relative flex items-end justify-center gap-2.5">
        <div aria-hidden className="a-rayons absolute top-[20%] left-1/2 size-[110%] -translate-x-1/2 -translate-y-1/2" style={{ ...t(1.4, 2), background: "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.08) 0 6deg, transparent 6deg 16deg)", maskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)", WebkitMaskImage: "radial-gradient(closest-side, #000 15%, transparent 75%)" }} />
        {marches.map(({ p, h, s, a }, k) =>
          p ? (
            <div key={p.name} className="relative flex w-[31%] flex-col items-center">
              <div className="a-tombe mb-2" style={t(a, 1.2)}>
                <MiniCarte player={p} size={s} detail={`${def.label} · ${p.value} ${def.unit}`} />
              </div>
              <span className={cn("a-fondu mb-1.5 max-w-full truncate text-center font-semibold", k === 1 ? "text-[15px]" : "text-[12.5px] text-white/75")} style={t(a + 0.7)}>
                {id.nom(p.name)}
              </span>
              <div className="a-hausse flex w-full flex-col items-center rounded-t-[10px] bg-gradient-to-b from-white/[0.18] to-white/[0.03] pt-2" style={{ ...t(0.05 + (2 - k) * 0.12, 0.7), height: h }}>
                <span className="leading-none" style={{ fontFamily: ANTON, fontSize: k === 1 ? 40 : 28 }}>{p.rank}</span>
                <span className="mt-1 text-[12.5px] font-bold tabular-nums text-white/75">
                  <Compte n={p.value} a={a + 0.5} du={0.8} /> <span className="mono-label text-[8.5px] text-white/45">{def.unit}</span>
                </span>
              </div>
            </div>
          ) : (
            <span key={k} className="w-[31%]" />
          )
        )}
      </div>
      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-1.5 overflow-hidden">
        {suite.map((p, k) => (
          <div key={p.name} className={cn("a-monte flex items-center gap-3 rounded-[16px] bg-white/[0.06] px-3 py-1.5", p.name === moi && "bg-white/[0.16]")} style={t(1.9 + k * 0.1, 0.6)}>
            <span className="w-6 text-[14px] font-bold text-white/45 tabular-nums">{p.rank}</span>
            <MiniCarte player={p} size={TAILLE.petite} detail={`${def.label} · ${p.value} ${def.unit}`} />
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{id.nom(p.name)}</span>
            <span className="text-[16px] font-bold tabular-nums">
              {p.value}
              <span className="mono-label ml-1 text-white/40">{def.unit}</span>
            </span>
          </div>
        ))}
      </div>
      {ici && ici.rank > 9 && (
        <div className="a-monte mt-2 flex items-center gap-3 rounded-[16px] bg-white px-3 py-2 text-black" style={t(2.6, 0.6)}>
          <span className="w-6 text-[14px] font-bold text-black/50 tabular-nums">{ici.rank}</span>
          <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold">Toi</span>
          <span className="text-[16px] font-bold tabular-nums">
            {ici.value}
            <span className="mono-label ml-1 text-black/45">{def.unit}</span>
          </span>
        </div>
      )}
    </div>
  );
}
