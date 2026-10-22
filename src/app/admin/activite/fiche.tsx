"use client";

// La fiche d'un joueur, ouverte depuis Activité (« À suivre de près », « À
// relancer », « Par joueur ») : tout ce que le journal dit de lui, calculé
// par lib/sfl/suivi-joueur.ts. Demandée par Sabri le 22/10 pour Afid, un
// nouveau venu très engagé qu'il ne connaissait pas.

import { useMemo } from "react";
import { ChevronLeft, Mail } from "lucide-react";
import { DAY, duree, jjmm, type Evenement } from "@/lib/sfl/retention";
import { ficheJoueur } from "@/lib/sfl/suivi-joueur";
import { emojiDrapeau, unPays } from "@/lib/sfl/photo-studio";
import { cn } from "@/lib/utils";
import { Barres } from "./graphiques";
import type { PhotoStudio } from "./vue";

const JOUR = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "2-digit" });
const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });
const FILTRE_FR: Record<string, [string, string]> = {
  studio: ["photo de studio", "photos de studio"],
  drapeau: ["drapeau", "drapeaux"],
  manga: ["manga", "mangas"],
};

function depuis(ts: number, now: number): string {
  const d = now - ts;
  if (d < 3600 * 1000) return `il y a ${Math.max(1, Math.round(d / 60000))} min`;
  if (d < DAY) return `il y a ${Math.round(d / (3600 * 1000))} h`;
  return `il y a ${Math.round(d / DAY)} j`;
}

function Bloc({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-[17px] font-bold tracking-tight">{titre}</h2>
      {sous && <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">{sous}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Chiffre({ label, valeur, sous }: { label: string; valeur: string; sous?: string }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-[8.5px] text-foreground/45">{label}</p>
      <div className="mt-1.5 text-[24px] leading-none font-extrabold tabular-nums">{valeur}</div>
      <p className="mt-1.5 min-h-[15px] text-[11px] leading-snug text-foreground/50">{sous}</p>
    </div>
  );
}

export function FicheJoueur({
  name,
  evenements,
  studio,
  email,
  now,
  onClose,
}: {
  name: string;
  /** Le journal du public regardé : la fiche range le joueur parmi lui. */
  evenements: Evenement[];
  studio: PhotoStudio[] | null;
  email: string | null;
  now: number;
  onClose: () => void;
}) {
  const f = useMemo(() => ficheJoueur(evenements, name), [evenements, name]);
  const photos = useMemo(() => studio?.filter((p) => p.name === name) ?? null, [studio, name]);

  const max = f ? Math.max(1, ...f.rythme.map((r) => r.ms)) : 1;
  const parFiltre = new Map<string, number>();
  for (const p of photos ?? []) parFiltre.set(p.filtre, (parFiltre.get(p.filtre) ?? 0) + 1);
  const pays = [...new Set((photos ?? []).filter((p) => p.pays).map((p) => p.pays!))];

  return (
    <div className="fixed inset-0 z-[700] overflow-y-auto bg-background" role="dialog" aria-label={`Fiche de ${name}`}>
      <div className="shell flex flex-col gap-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(32px+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            aria-label="Revenir à Activité"
            className="glass flex size-10 shrink-0 items-center justify-center rounded-full active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="mono-label text-[9px] text-foreground/45">Fiche joueur</p>
        </div>

        {!f ? (
          <p className="py-16 text-center text-[13px] text-foreground/45">Rien dans le journal pour {name}.</p>
        ) : (
          <>
            <div>
              <h1 className="flex items-center gap-2.5 text-[30px] font-bold tracking-tight">
                {name}
                <Mail className={cn("size-4", email ? "text-foreground" : "text-foreground/15")} />
              </h1>
              <p className="mt-1 text-[13px] text-foreground/50">
                Arrivé {JOUR.format(f.premier)} à {HEURE.format(f.premier)} · vu {depuis(f.last, now)}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Chiffre label="Temps passé" valeur={duree(f.temps)} sous={`depuis le ${jjmm(f.premier)}`} />
              <Chiffre
                label="Sessions"
                valeur={String(f.sessions.length)}
                sous={`${duree(f.sessions.length ? f.temps / f.sessions.length : 0)} en moyenne`}
              />
              <Chiffre label="Jours actifs" valeur={String(f.joursActifs)} />
              <Chiffre
                label="Premières 24 h"
                valeur={duree(f.debut.ms)}
                sous={`${f.debut.rang === 1 ? "1er" : `${f.debut.rang}e`} sur ${f.debut.sur} · médiane ${duree(f.debut.mediane)}`}
              />
            </div>

            <Bloc
              titre="Son rythme"
              sous={f.pas === "heure" ? "Temps passé, heure par heure depuis son arrivée." : "Temps passé, jour par jour depuis son arrivée."}
            >
              <div className="flex h-[96px] items-end gap-[2px]">
                {f.rythme.map((r) => (
                  <span
                    key={r.t}
                    title={`${f.pas === "heure" ? `${JOUR.format(r.t)} ${HEURE.format(r.t)}` : JOUR.format(r.t)} · ${duree(r.ms)}`}
                    className={cn("flex-1 rounded-t-[3px]", r.ms ? "bg-foreground/80" : "bg-foreground/8")}
                    style={{ height: r.ms ? `${Math.max(6, (r.ms / max) * 100)}%` : "3px" }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex justify-between text-[10.5px] text-foreground/40 tabular-nums">
                <span>{f.pas === "heure" ? `${JOUR.format(f.rythme[0].t)} ${HEURE.format(f.rythme[0].t)}` : JOUR.format(f.rythme[0].t)}</span>
                <span>
                  {f.pas === "heure"
                    ? `${JOUR.format(f.rythme.at(-1)!.t)} ${HEURE.format(f.rythme.at(-1)!.t)}`
                    : JOUR.format(f.rythme.at(-1)!.t)}
                </span>
              </div>
            </Bloc>

            <Bloc titre="Ce qu'il regarde" sous="Pages vues, depuis son arrivée.">
              <Barres lignes={f.pages} />
            </Bloc>

            {f.gestes.length > 0 && (
              <Bloc titre="Ce qu'il fait">
                <Barres lignes={f.gestes} />
              </Bloc>
            )}

            {photos && photos.length > 0 && (
              <Bloc titre="Studio photo" sous={`${photos.length} ${photos.length > 1 ? "photos générées" : "photo générée"} pour sa carte.`}>
                <div className="flex flex-wrap gap-1.5">
                  {[...parFiltre.entries()].map(([filtre, n]) => (
                    <span key={filtre} className="glass-soft rounded-full px-3 py-1.5 text-[12px] font-semibold">
                      {n} {FILTRE_FR[filtre]?.[n > 1 ? 1 : 0] ?? filtre}
                    </span>
                  ))}
                  {pays.map((p) => (
                    <span key={p} className="glass-soft rounded-full px-3 py-1.5 text-[12px] font-semibold">
                      {emojiDrapeau(p)} {unPays(p)?.nom ?? p}
                    </span>
                  ))}
                </div>
              </Bloc>
            )}

            <Bloc titre="Ses sessions" sous="Les plus récentes d'abord, avec les pages dans l'ordre.">
              <div className="flex flex-col">
                {f.sessions.map((s) => (
                  <div key={s.debut} className="border-b border-foreground/6 py-2.5 last:border-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-semibold">
                        {JOUR.format(s.debut)} · {HEURE.format(s.debut)}
                      </span>
                      <span className="shrink-0 text-[12px] font-bold tabular-nums">{duree(s.ms)}</span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-foreground/45">
                      {s.pages.length ? s.pages.join(" → ") : "Aucune page vue"}
                    </p>
                  </div>
                ))}
              </div>
            </Bloc>
          </>
        )}
      </div>
    </div>
  );
}
