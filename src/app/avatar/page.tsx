"use client";

// Création d'avatar : aperçu 3D animé + panneau de réglages paramétriques
// (taille, corpulence, forme de tête, peau). Panneau à droite sur desktop,
// sous l'aperçu sur mobile. La config est conservée en localStorage.

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PersonStanding } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AVATAR_STORAGE_KEY,
  CORPULENCE_OPTIONS,
  DEFAULT_AVATAR_CONFIG,
  PEAU_HEX,
  PEAU_OPTIONS,
  TAILLE_OPTIONS,
  TETE_OPTIONS,
  type AvatarConfig,
} from "@/lib/sfl/avatar";

const AvatarViewer = dynamic(
  () => import("@/components/sfl/avatar-viewer").then((m) => m.AvatarViewer),
  { ssr: false }
);

function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="glass flex rounded-2xl p-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative flex-1 rounded-xl py-2.5 text-[13px] font-semibold transition-colors",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {active && (
              <span className="absolute inset-0 rounded-xl bg-foreground/10 ring-1 ring-foreground/10" />
            )}
            <span className="relative">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function AvatarPage() {
  const [config, setConfig] = useState<AvatarConfig>(DEFAULT_AVATAR_CONFIG);
  const [loaded, setLoaded] = useState(false);

  // Restaure la config sauvegardée (après montage, pour éviter tout
  // décalage d'hydratation).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(AVATAR_STORAGE_KEY);
      if (raw) setConfig({ ...DEFAULT_AVATAR_CONFIG, ...JSON.parse(raw) });
    } catch {
      // config corrompue : on repart des défauts
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(config));
  }, [config, loaded]);

  const set = <K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div className="flex items-center gap-2.5">
        <span className="glass flex size-11 items-center justify-center rounded-2xl">
          <PersonStanding className="size-5" />
        </span>
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">Personnalisation</p>
          <h1 className="text-[28px] font-bold tracking-tight">Mon avatar</h1>
        </div>
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-start">
        {/* Aperçu 3D — plein cadre sur mobile, colonne principale sur desktop */}
        <div className="glass relative h-[46vh] min-h-[320px] overflow-hidden rounded-3xl md:h-[560px] md:flex-1">
          <AvatarViewer config={config} />
          <p className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-[11px] text-muted-foreground">
            Glisse pour faire tourner
          </p>
        </div>

        {/* Panneau de réglages — en dessous sur mobile, à droite sur desktop */}
        <aside className="flex flex-col gap-5 md:w-64 md:shrink-0">
          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Taille</h2>
            <Segmented options={TAILLE_OPTIONS} value={config.taille} onChange={(v) => set("taille", v)} />
          </section>

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Corpulence</h2>
            <Segmented
              options={CORPULENCE_OPTIONS}
              value={config.corpulence}
              onChange={(v) => set("corpulence", v)}
            />
          </section>

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Tête</h2>
            <Segmented options={TETE_OPTIONS} value={config.tete} onChange={(v) => set("tete", v)} />
          </section>

          <section>
            <h2 className="mb-2 px-1 text-sm font-semibold text-muted-foreground">Peau</h2>
            <div className="glass flex items-center justify-around rounded-2xl p-3">
              {PEAU_OPTIONS.map((opt) => {
                const active = config.peau === opt.value;
                return (
                  <button
                    key={opt.value}
                    aria-label={`Peau ${opt.label}`}
                    onClick={() => set("peau", opt.value)}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <span
                      className={cn(
                        "size-9 rounded-full ring-2 transition-all",
                        active
                          ? "ring-primary ring-offset-2 ring-offset-background"
                          : "ring-foreground/10"
                      )}
                      style={{ backgroundColor: PEAU_HEX[opt.value] }}
                    />
                    <span
                      className={cn(
                        "text-[11px] font-semibold",
                        active ? "text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
