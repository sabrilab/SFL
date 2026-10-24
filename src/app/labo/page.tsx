"use client";

// Le Labo : deux mesures que le téléphone fait seul, réflexes et détente.
// La logique (percentiles, détection des sauts, enregistrement) est dans
// src/lib/sfl/labo.ts ; cette page ne fait que l'interface des deux tests.
// Aucun lien n'y mène pour l'instant : voir layout.tsx.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import {
  DetecteurSaut,
  LABO_STAT,
  enregistrer,
  hauteurDepuisVol,
  lireFiche,
  mediane,
  percentileDetente,
  percentileReaction,
  type LaboFiche,
  type LaboTest,
} from "@/lib/sfl/labo";

const ESSAIS = 5;
const SAUTS = 3;

function vibrer(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // iOS n'a pas de vibreur côté web.
  }
}

function Resultat({
  test,
  fiche,
}: {
  test: LaboTest;
  fiche: LaboFiche;
}) {
  const r = fiche[test];
  if (!r) return null;
  const unite = test === "reaction" ? "ms" : "cm";
  return (
    <div className="flex items-end justify-between gap-3 border-t border-white/8 pt-3.5">
      <div>
        <p className="mono-label text-foreground/40">Dernier</p>
        <p className="mt-1 text-[26px] leading-none font-extrabold tracking-tight tabular-nums">
          {r.dernier.valeur}
          <span className="ml-1 text-[13px] font-semibold text-foreground/45">{unite}</span>
        </p>
      </div>
      <div className="text-right">
        <p className="mono-label text-foreground/40">Percentile · {LABO_STAT[test]}</p>
        <p className="mt-1 text-[26px] leading-none font-extrabold tracking-tight tabular-nums">
          {r.dernier.percentile}
          <span className="text-[13px] font-semibold text-foreground/45">e</span>
        </p>
      </div>
      {r.record.date !== r.dernier.date && (
        <div className="text-right">
          <p className="mono-label text-foreground/40">Record</p>
          <p className="mt-1 text-[15px] font-bold tabular-nums text-foreground/70">
            {r.record.valeur} {unite}
          </p>
        </div>
      )}
    </div>
  );
}

type PhaseReaction = "repos" | "attend" | "go" | "tot";

function TestReflexes({ nom, onFiche }: { nom: string; onFiche: (f: LaboFiche) => void }) {
  const [phase, setPhase] = useState<PhaseReaction>("repos");
  const [scores, setScores] = useState<number[]>([]);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const depart = useRef(0);

  useEffect(() => () => { if (minuteur.current) clearTimeout(minuteur.current); }, []);

  function armer() {
    setPhase("attend");
    minuteur.current = setTimeout(() => {
      depart.current = performance.now();
      setPhase("go");
      vibrer();
    }, 1400 + Math.random() * 2600);
  }

  function toucher() {
    if (phase === "attend") {
      if (minuteur.current) clearTimeout(minuteur.current);
      setPhase("tot");
      return;
    }
    if (phase === "go") {
      const ms = Math.round(performance.now() - depart.current);
      const suite = [...scores, ms];
      setScores(suite);
      setPhase("repos");
      if (suite.length === ESSAIS) {
        const m = mediane(suite);
        onFiche(
          enregistrer(nom, "reaction", {
            valeur: m,
            percentile: percentileReaction(m),
            date: new Date().toISOString(),
          })
        );
      }
      return;
    }
    if (scores.length >= ESSAIS) setScores([]);
    armer();
  }

  const fini = scores.length >= ESSAIS;
  const mot =
    phase === "attend"
      ? "Attends…"
      : phase === "go"
        ? "Touche !"
        : phase === "tot"
          ? "Trop tôt"
          : fini
            ? "Recommencer"
            : scores.length
              ? `${scores[scores.length - 1]} ms`
              : "Commencer";

  return (
    <button
      onPointerDown={toucher}
      className={cn(
        "flex h-[188px] w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-[22px] select-none",
        phase === "go" ? "bg-foreground text-background" : "glass-soft text-foreground"
      )}
    >
      <span className="text-[30px] font-extrabold tracking-tight tabular-nums">{mot}</span>
      <span className="flex gap-1.5">
        {Array.from({ length: ESSAIS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full",
              i < scores.length ? (phase === "go" ? "bg-background" : "bg-foreground") : "bg-foreground/20"
            )}
          />
        ))}
      </span>
    </button>
  );
}

type PhaseDetente = "repos" | "refus" | "ecoute" | "sans-capteur";

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

function TestDetente({ nom, onFiche }: { nom: string; onFiche: (f: LaboFiche) => void }) {
  const [phase, setPhase] = useState<PhaseDetente>("repos");
  const [sauts, setSauts] = useState<number[]>([]);
  const arret = useRef<(() => void) | null>(null);

  useEffect(() => () => arret.current?.(), []);

  function terminer(vols: number[]) {
    arret.current?.();
    arret.current = null;
    setPhase("repos");
    if (!vols.length) return;
    const cm = Math.max(...vols.map(hauteurDepuisVol));
    onFiche(
      enregistrer(nom, "detente", {
        valeur: cm,
        percentile: percentileDetente(cm),
        date: new Date().toISOString(),
      })
    );
  }

  async function demarrer() {
    if (typeof window === "undefined" || !("DeviceMotionEvent" in window)) {
      setPhase("sans-capteur");
      return;
    }
    // iOS : l'autorisation se demande au toucher, avant toute écoute.
    const perm = (DeviceMotionEvent as unknown as MotionPermission).requestPermission;
    if (perm) {
      try {
        if ((await perm()) !== "granted") {
          setPhase("refus");
          return;
        }
      } catch {
        setPhase("refus");
        return;
      }
    }

    const detecteur = new DetecteurSaut();
    const vols: number[] = [];
    let recu = false;
    setSauts([]);
    setPhase("ecoute");

    const surMouvement = (e: DeviceMotionEvent) => {
      const g = e.accelerationIncludingGravity;
      if (!g || g.x == null || g.y == null || g.z == null) return;
      recu = true;
      const a = Math.hypot(g.x, g.y, g.z);
      const vol = detecteur.echantillon(a, e.timeStamp / 1000);
      if (vol !== null) {
        vols.push(vol);
        setSauts([...vols]);
        vibrer(20);
        if (vols.length >= SAUTS) terminer(vols);
      }
    };
    window.addEventListener("devicemotion", surMouvement);
    // Un ordinateur expose l'API sans jamais envoyer de mesure.
    const verif = setTimeout(() => {
      if (!recu) {
        terminer([]);
        setPhase("sans-capteur");
      }
    }, 1500);
    const limite = setTimeout(() => terminer(vols), 30_000);
    arret.current = () => {
      window.removeEventListener("devicemotion", surMouvement);
      clearTimeout(verif);
      clearTimeout(limite);
    };
  }

  const mot =
    phase === "ecoute"
      ? sauts.length
        ? `${hauteurDepuisVol(sauts[sauts.length - 1])} cm`
        : "Saute"
      : phase === "refus"
        ? "Capteurs refusés"
        : phase === "sans-capteur"
          ? "Sur téléphone"
          : "Commencer";

  return (
    <button
      onClick={phase === "ecoute" ? () => terminer(sauts) : demarrer}
      className={cn(
        "flex h-[188px] w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-[22px] select-none",
        phase === "ecoute" ? "bg-foreground text-background" : "glass-soft text-foreground"
      )}
    >
      <span className="text-[30px] font-extrabold tracking-tight tabular-nums">{mot}</span>
      <span className="flex gap-1.5">
        {Array.from({ length: SAUTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "size-1.5 rounded-full",
              i < sauts.length
                ? phase === "ecoute"
                  ? "bg-background"
                  : "bg-foreground"
                : phase === "ecoute"
                  ? "bg-background/25"
                  : "bg-foreground/20"
            )}
          />
        ))}
      </span>
    </button>
  );
}

export default function LaboPage() {
  const { player } = useMyPlayer();
  const isClient = useIsClient();
  // Le dernier passage de cette visite, sinon ce que l'appareil a gardé.
  const [maj, setMaj] = useState<{ nom: string; fiche: LaboFiche } | null>(null);
  const fiche: LaboFiche =
    maj?.nom === player.name ? maj.fiche : isClient ? lireFiche(player.name) : {};
  const setFiche = (f: LaboFiche) => setMaj({ nom: player.name, fiche: f });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-[18px] px-5 py-4 sm:py-8">
      <div className="flex items-center gap-2.5">
        <Link
          href="/profil"
          aria-label="Retour"
          className="glass-soft flex size-[38px] items-center justify-center rounded-full"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <h1 className="text-[30px] font-bold tracking-tight">Le Labo</h1>
      </div>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold tracking-tight">Réflexes</h2>
          <span className="mono-label text-foreground/40">40 s · VIT</span>
        </div>
        <TestReflexes nom={player.name} onFiche={setFiche} />
        <Resultat test="reaction" fiche={fiche} />
      </section>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-[18px]">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[17px] font-bold tracking-tight">Détente</h2>
          <span className="mono-label text-foreground/40">Téléphone contre la poitrine · PHY</span>
        </div>
        <TestDetente nom={player.name} onFiche={setFiche} />
        <Resultat test="detente" fiche={fiche} />
      </section>
    </div>
  );
}
