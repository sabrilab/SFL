"use client";

// La vitrine des badges — dans Ma carte, comme dans l'app iPhone Bola
// (Composants/Trophee/Medaille.swift) : des médailles sur une grille de
// quatre, leur nom dessous. Étain mat au palier I, argent poli au II, onyx
// gravé de blanc au III et au-delà ; verrouillée, la médaille est en creux et
// son arc de progression montre le chemin. Toucher une médaille la détaille.
//
// NouveauxBadges, monté une fois dans la mise en page, annonce chaque palier
// gagné depuis la dernière visite.

import { useEffect, useMemo, useState } from "react";
import {
  Award,
  CalendarCheck,
  Crown,
  Flame,
  Forward,
  Goal,
  Hourglass,
  Medal,
  Shield,
  ShieldCheck,
  Trophy,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { clesGagnees, prochain, quantite, romain, TROPHEES, vitrine, type EtatTrophee, type TropheeId } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

const EMBLEMES: Record<TropheeId, typeof Crown> = {
  matchs: CalendarCheck,
  buts: Goal,
  passes: Forward,
  victoires: Trophy,
  mvp: Award,
  mur: Shield,
  impact: Zap,
  cleanSheet: ShieldCheck,
  serie: Flame,
  podium: Medal,
  pepite: Crown,
  saisons: Hourglass,
};

const METAL = {
  etain: { fond: "linear-gradient(150deg, #a9aaa6 0%, #7c7d79 45%, #5e5f5b 100%)", encre: "rgba(10,11,13,0.82)", listel: "rgba(255,255,255,0.35)" },
  argent: { fond: "linear-gradient(150deg, #fbfbf9 0%, #c9cac5 40%, #eeeeeb 62%, #a7a8a3 100%)", encre: "rgba(10,11,13,0.85)", listel: "rgba(255,255,255,0.75)" },
  onyx: { fond: "linear-gradient(150deg, #3a3b3f 0%, #141518 55%, #050607 100%)", encre: "#f4f5f2", listel: "rgba(255,255,255,0.28)" },
};

/** Une médaille. palier 0 = verrouillée. */
export function Medaille({ e, diametre = 64 }: { e: EtatTrophee; diametre?: number }) {
  const Embleme = EMBLEMES[e.def.id];
  const d = diametre;
  if (!e.palier) {
    const r = d / 2 - 2.5;
    const tour = 2 * Math.PI * r;
    return (
      <span className="relative block shrink-0" style={{ width: d, height: d }}>
        <span className="absolute inset-0 rounded-full bg-foreground/[0.05] ring-1 ring-foreground/12 ring-inset" />
        <span className="absolute rounded-full border border-dotted border-foreground/12" style={{ inset: d * 0.12 }} />
        {e.progression > 0 && (
          <svg className="absolute inset-0 -rotate-90" width={d} height={d} aria-hidden>
            <circle
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.6}
              strokeWidth={2.5}
              strokeDasharray={`${tour * e.progression} ${tour}`}
            />
          </svg>
        )}
        <Embleme className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground/25" style={{ width: d * 0.36, height: d * 0.36 }} strokeWidth={1.6} />
      </span>
    );
  }
  const m = e.palier === 1 && e.def.paliers.length > 1 ? METAL.etain : e.palier >= 3 ? METAL.onyx : METAL.argent;
  return (
    <span
      className="relative block shrink-0 rounded-full shadow-[0_6px_14px_rgba(0,0,0,0.45)]"
      style={{ width: d, height: d, background: m.fond, color: m.encre }}
    >
      <span className="absolute rounded-full border" style={{ inset: d * 0.07, borderColor: m.listel }} />
      <span className="absolute rounded-full border-[1.5px] border-dotted" style={{ inset: d * 0.13, borderColor: m.encre, opacity: 0.22 }} />
      <Embleme
        className="absolute left-1/2 -translate-x-1/2"
        style={{ width: d * 0.36, height: d * 0.36, top: d * 0.22 }}
        strokeWidth={2.2}
      />
      <span
        className="absolute inset-x-0 text-center font-black italic"
        style={{ bottom: d * 0.14, fontSize: d * 0.17, lineHeight: 1, letterSpacing: -0.3 }}
      >
        {romain(e.palier)}
      </span>
      {/* Le reflet, à peine */}
      <span className="absolute inset-0 rounded-full bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.35)_48%,transparent_60%)]" />
    </span>
  );
}

/** La vitrine du joueur connecté, pour Ma carte. */
export function VitrineBadges({ nom }: { nom: string }) {
  const { saison } = useSeason();
  const etats = useMemo(() => vitrine(saison, nom, new Date()), [saison, nom]);
  const [choix, setChoix] = useState<TropheeId | null>(null);
  const gagnes = etats.filter((e) => e.palier > 0).length;
  const suivant = prochain(etats);
  const detail = etats.find((e) => e.def.id === choix) ?? null;

  return (
    <section className="glass flex flex-col gap-4 rounded-[26px] p-[18px]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[17px] font-bold tracking-tight">Mes badges</h2>
        <span className="mono-label text-foreground/45 tabular-nums">
          {gagnes} / {TROPHEES.length}
        </span>
      </div>

      {suivant && (
        <div className="flex items-center gap-3 rounded-[18px] bg-foreground/[0.06] px-3.5 py-3">
          <Medaille e={suivant} diametre={40} />
          <p className="min-w-0 flex-1 text-[13px] leading-snug">
            <span className="text-foreground/55">Prochain badge · </span>
            <strong className="font-semibold">
              {suivant.def.nom} {romain(suivant.palier + 1)}
            </strong>
            <br />
            <span className="text-foreground/55">
              Plus que {quantite(suivant.def, suivant.cible! - suivant.valeur)} — rendez-vous dimanche.
            </span>
          </p>
        </div>
      )}

      <div className="grid grid-cols-4 gap-x-1 gap-y-4">
        {etats.map((e) => (
          <button
            key={e.def.id}
            type="button"
            onClick={() => setChoix(choix === e.def.id ? null : e.def.id)}
            aria-pressed={choix === e.def.id}
            aria-label={`${e.def.nom}${e.palier ? `, palier ${e.palier}` : ", verrouillé"}`}
            className="flex flex-col items-center gap-2 transition-transform active:scale-95"
          >
            <span className={cn("rounded-full", choix === e.def.id && "ring-2 ring-foreground/60 ring-offset-2 ring-offset-background")}>
              <Medaille e={e} />
            </span>
            <span className={cn("w-full truncate text-center text-[11px] font-medium", e.palier ? "text-foreground/70" : "text-foreground/35")}>
              {e.def.nom}
            </span>
          </button>
        ))}
      </div>

      {detail && (
        <div className="flex items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] p-3.5">
          <Medaille e={detail} diametre={56} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-bold">
              {detail.def.nom} {detail.palier ? romain(detail.palier) : ""}
            </p>
            <p className="font-mono text-[11.5px] text-foreground/55">{detail.def.inscription}</p>
            <p className="mt-1 text-[12.5px] text-foreground/70">
              {quantite(detail.def, detail.valeur)}
              {detail.cible != null
                ? ` · palier ${romain(detail.palier + 1)} à ${quantite(detail.def, detail.cible)}`
                : " · palier maximal"}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

const vuKey = (nom: string) => `sfl-badges-vus-${nom}`;

/** Annonce les paliers gagnés depuis la dernière visite. */
export function NouveauxBadges() {
  const { me } = useMyPlayer();
  const { saison } = useSeason();
  const session = useSession();
  const actif = !!session && session.name === me;

  useEffect(() => {
    if (!actif) return;
    const etats = vitrine(saison, me, new Date());
    const cles = clesGagnees(etats);
    let vus: string[] | null = null;
    try {
      const brut = localStorage.getItem(vuKey(me));
      if (brut) vus = JSON.parse(brut) as string[];
    } catch {}
    try {
      localStorage.setItem(vuKey(me), JSON.stringify(cles));
    } catch {}

    const nouveaux = vus ? cles.filter((c) => !vus!.includes(c)) : cles;
    if (!nouveaux.length) return;
    const timer = setTimeout(() => {
      if (!vus) {
        toast(`Tu as ${nouveaux.length} badge${nouveaux.length > 1 ? "s" : ""}`, {
          description: "Ta vitrine t'attend dans Ma carte.",
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
        return;
      }
      for (const c of nouveaux.slice(0, 3)) {
        const [id, palier] = c.split(":");
        const def = TROPHEES.find((t) => t.id === id);
        if (!def) continue;
        toast.success(`Nouveau badge · ${def.nom} ${romain(Number(palier))}`, {
          description: def.inscription,
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [actif, saison, me]);

  return null;
}

