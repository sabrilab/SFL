"use client";

// Les badges du joueur, dans Ma carte. Deux familles, qui n'ont pas la même
// valeur :
//
// 1. Fin de saison (fin-de-saison.ts) : les trois premiers du Pépite d'Or et
//    des classements buteur, passeur, défenseur et MVP, une fois par saison.
//    C'est l'écusson : or au 1er, argent au 2e, bronze au 3e. Pendant la
//    saison, un petit rond creux donne le rang du moment.
// 2. Paliers (trophees.ts) : gagnés au fil des dimanches. C'est la médaille
//    ronde, quatre paliers pour tous : bronze, argent, or, puis rouge et or.
//
// La forme dit la famille, le métal dit le niveau, et le niveau est toujours
// écrit en toutes lettres : on n'a pas besoin de distinguer les couleurs pour
// lire un badge. Le rang du moment (rond creux) s'écrit en entier sous le
// Pépite d'Or, en abrégé sous les quatre autres. Pas encore gagné, un badge est en pointillés. Toucher un
// badge ouvre sa feuille : ses paliers, ou ses podiums.
//
// NouveauxBadges, monté une fois dans la mise en page, annonce chaque palier
// gagné depuis la dernière visite.

import { useEffect, useId, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { finsDeSaison, ordinal, podiumsDe, type ClassementId, type EtatClassement } from "@/lib/sfl/fin-de-saison";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import {
  clesGagnees,
  detenteurs,
  metal,
  METAUX,
  NOM_METAL,
  prochain,
  quantite,
  TROPHEES,
  vitrine,
  type EtatTrophee,
  type Metal,
  type TropheeId,
} from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

/** Les métaux : le dégradé, l'encre gravée dessus, le listel du bord. */
const METAL: Record<Metal, { stops: [string, string, string]; encre: string; listel: string; trait: string }> = {
  bronze: { stops: ["#f0b98a", "#b06a35", "#6b3815"], encre: "#2a1608", listel: "#f0b98a", trait: "#c27a43" },
  argent: { stops: ["#ffffff", "#c3c6ca", "#868a90"], encre: "#15171a", listel: "#ffffff", trait: "#9da1a7" },
  or: { stops: ["#fff2b8", "#e2b13c", "#94640f"], encre: "#2b1d02", listel: "#fff2b8", trait: "#d9a531" },
  legende: { stops: ["#d8473a", "#8a1212", "#420707"], encre: "#f6d77a", listel: "#e2b13c", trait: "#c4352b" },
};

const fond = (m: Metal) => {
  const [a, b, c] = METAL[m].stops;
  return `linear-gradient(150deg, ${a} 0%, ${b} 50%, ${c} 100%)`;
};

/** Le rang d'un podium en métal : 1er or, 2e argent, 3e bronze. */
const METAL_RANG: Record<number, Metal> = { 1: "or", 2: "argent", 3: "bronze" };

/* -------------------------------- Médaille -------------------------------- */

/** Une médaille de palier. palier 0 = pas encore gagnée : en pointillés, son arc montre le chemin. */
export function Medaille({ e, diametre = 60 }: { e: EtatTrophee; diametre?: number }) {
  const Embleme = EMBLEMES[e.def.id];
  const d = diametre;
  const m = metal(e.palier);
  if (!m) {
    const r = d / 2 - 2;
    const tour = 2 * Math.PI * r;
    return (
      <span className="relative block shrink-0" style={{ width: d, height: d }}>
        <span className="absolute inset-[1px] rounded-full border-[1.5px] border-dashed border-foreground/40" />
        {e.progression > 0 && (
          <svg className="absolute inset-0 -rotate-90" width={d} height={d} aria-hidden>
            <circle
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              stroke={METAL.bronze.trait}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={`${tour * e.progression} ${tour}`}
            />
          </svg>
        )}
        <Embleme
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-foreground/55"
          style={{ width: d * 0.4, height: d * 0.4 }}
          strokeWidth={1.8}
          aria-hidden
        />
      </span>
    );
  }
  const t = METAL[m];
  return (
    <span
      className="relative block shrink-0 rounded-full shadow-[0_6px_14px_rgba(0,0,0,0.35)]"
      style={{ width: d, height: d, background: fond(m), color: t.encre, boxShadow: `inset 0 0 0 2px ${t.listel}` }}
    >
      <span className="absolute rounded-full border" style={{ inset: d * 0.12, borderColor: t.encre, opacity: 0.3 }} />
      <Embleme
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ width: d * 0.4, height: d * 0.4 }}
        strokeWidth={2.2}
        aria-hidden
      />
      {/* Le reflet, à peine */}
      <span className="absolute inset-0 rounded-full bg-[linear-gradient(115deg,transparent_35%,rgba(255,255,255,0.3)_48%,transparent_60%)]" />
    </span>
  );
}

/* -------------------------------- Écusson -------------------------------- */

const ECU = "M32 3 L59 11 V36 C59 52 47 63 32 69 C17 63 5 52 5 36 V11 Z";
const ECU_LISTEL = "M32 8 L54 14.5 V36 C54 49 44 58.5 32 63.5 C20 58.5 10 49 10 36 V14.5 Z";

/** Un écusson de fin de saison. rang null = jamais sur le podium : en pointillés. */
export function Ecusson({ id, rang, largeur = 58 }: { id: ClassementId; rang: number | null; largeur?: number }) {
  const gid = useId();
  const Embleme = EMBLEMES_SAISON[id];
  const w = largeur;
  const h = (w * 72) / 64;
  const m = rang ? METAL_RANG[rang] : null;
  const t = m ? METAL[m] : null;
  return (
    <span className="relative block shrink-0" style={{ width: w, height: h }}>
      <svg className="absolute inset-0" width={w} height={h} viewBox="0 0 64 72" aria-hidden>
        {t ? (
          <>
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={t.stops[0]} />
                <stop offset="0.5" stopColor={t.stops[1]} />
                <stop offset="1" stopColor={t.stops[2]} />
              </linearGradient>
            </defs>
            <path d={ECU} fill={`url(#${gid})`} />
            <path d={ECU_LISTEL} fill="none" stroke={t.encre} strokeOpacity={0.3} strokeWidth={1} />
            <text x="32" y="57" textAnchor="middle" fontSize="11" fontWeight="800" fill={t.encre} fontFamily="var(--font-sans), system-ui, sans-serif">
              {ordinal(rang!)}
            </text>
          </>
        ) : (
          <path d={ECU} fill="none" stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.6} strokeDasharray="4 4" />
        )}
      </svg>
      <Embleme
        className={cn("absolute left-1/2 -translate-x-1/2", !t && "text-foreground/55")}
        style={{ width: w * 0.38, height: w * 0.38, top: t ? h * 0.2 : h * 0.3, color: t?.encre }}
        strokeWidth={t ? 2.3 : 1.8}
        aria-hidden
      />
    </span>
  );
}

/** Le rang du moment, en petit rond creux : provisoire. */
function EnCours({ e, court = false }: { e: EtatClassement; court?: boolean }) {
  if (!e.enCours) return null;
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground/80">
      <span className="size-2 shrink-0 rounded-full border-[1.5px] border-foreground/80" aria-hidden />
      {ordinal(e.enCours.rang)}
      {!court && " en ce moment"}
    </span>
  );
}

const sousTitre = (e: EtatClassement) => (e.meilleur ? `${ordinal(e.meilleur.rang)} · ${e.meilleur.saison}` : "Pas encore");

const ariaClassement = (e: EtatClassement) =>
  [
    e.def.nom,
    e.meilleur ? `${ordinal(e.meilleur.rang)}, ${e.meilleur.saison}, ${NOM_METAL[METAL_RANG[e.meilleur.rang]].toLowerCase()}` : "pas encore sur le podium",
    e.enCours ? `${ordinal(e.enCours.rang)} en ce moment` : null,
  ]
    .filter(Boolean)
    .join(", ");

/* --------------------------------- Vitrine -------------------------------- */

type Choix = { famille: "palier"; id: TropheeId } | { famille: "saison"; id: ClassementId } | null;

/** Les badges du joueur connecté, pour Ma carte. */
export function VitrineBadges({ nom }: { nom: string }) {
  const { saison, allPlayers } = useSeason();
  const paliers = useMemo(() => vitrine(saison, nom, new Date()), [saison, nom]);
  const fins = useMemo(() => finsDeSaison(saison, nom, allPlayers), [saison, nom, allPlayers]);
  const [choix, setChoix] = useState<Choix>(null);
  const suivant = prochain(paliers);
  const gagnes = paliers.filter((e) => e.palier > 0).length;

  const pepite = fins.find((e) => e.def.id === "pepite")!;
  const autres = fins.filter((e) => e.def.id !== "pepite");

  const detailPalier = choix?.famille === "palier" ? paliers.find((e) => e.def.id === choix.id) ?? null : null;
  const detailSaison = choix?.famille === "saison" ? fins.find((e) => e.def.id === choix.id) ?? null : null;

  return (
    <div className="flex flex-col gap-[18px]">
      {suivant && <ProchainBadge e={suivant} onOpen={() => setChoix({ famille: "palier", id: suivant.def.id })} />}

      {/* 1. Fin de saison : l'écusson */}
      <section aria-labelledby="fin-de-saison" className="glass rounded-[26px] px-3.5 pt-[18px] pb-4">
        <div className="mb-3 flex items-baseline justify-between px-1">
          <h2 id="fin-de-saison" className="text-[19px] font-extrabold tracking-tight">
            Fin de saison
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setChoix({ famille: "saison", id: "pepite" })}
          aria-label={ariaClassement(pepite)}
          className="flex w-full items-center gap-4 rounded-[20px] px-1.5 pt-1 pb-4 text-left transition-transform active:scale-[0.98] motion-reduce:transition-none"
        >
          <Ecusson id="pepite" rang={pepite.meilleur?.rang ?? null} largeur={78} />
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[18px] font-extrabold">Pépite d&apos;Or</span>
            <span className="text-[13px] text-foreground/65">{sousTitre(pepite)}</span>
            <span className="mt-1">
              <EnCours e={pepite} />
            </span>
          </span>
        </button>

        <div className="grid grid-cols-4 gap-1 border-t border-foreground/[0.08] pt-4">
          {autres.map((e) => (
            <button
              key={e.def.id}
              type="button"
              onClick={() => setChoix({ famille: "saison", id: e.def.id })}
              aria-label={ariaClassement(e)}
              className="flex min-h-11 flex-col items-center gap-1.5 text-center transition-transform active:scale-95 motion-reduce:transition-none"
            >
              <Ecusson id={e.def.id} rang={e.meilleur?.rang ?? null} />
              <span className="text-[12px] leading-tight font-bold">{e.def.nom}</span>
              <span className="text-[12px] leading-tight text-foreground/65">{sousTitre(e)}</span>
              <EnCours e={e} court />
            </button>
          ))}
        </div>
      </section>

      {/* 2. Paliers : la médaille ronde */}
      <section aria-labelledby="paliers" className="glass rounded-[26px] px-2.5 pt-[18px] pb-5">
        <div className="mb-4 flex items-baseline justify-between px-2">
          <h2 id="paliers" className="text-[19px] font-extrabold tracking-tight">
            Paliers
          </h2>
          <span className="font-mono text-[12px] font-bold text-foreground/65 tabular-nums">
            {gagnes} / {TROPHEES.length}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-x-1 gap-y-5 sm:grid-cols-5">
          {paliers.map((e) => {
            const m = metal(e.palier);
            return (
              <button
                key={e.def.id}
                type="button"
                onClick={() => setChoix({ famille: "palier", id: e.def.id })}
                aria-label={`${e.def.nom}, ${m ? `palier ${NOM_METAL[m].toLowerCase()}` : "pas encore gagné"}, ${quantite(e.def, e.valeur)}${e.cible != null ? `, prochain à ${e.cible}` : ""}`}
                className="flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95 motion-reduce:transition-none"
              >
                <Medaille e={e} diametre={56} />
                <span className="w-full text-[12px] leading-tight font-bold">{e.def.nom}</span>
                <span className="font-mono text-[12px] font-bold tabular-nums">
                  {e.cible != null ? `${e.valeur}/${e.cible}` : e.valeur}
                </span>
                <span className="text-[11px] font-semibold text-foreground/70">{m ? NOM_METAL[m] : "À gagner"}</span>
              </button>
            );
          })}
        </div>
      </section>

      <Sheet open={!!choix} onOpenChange={(o) => !o && setChoix(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          {detailPalier && <FeuillePalier e={detailPalier} moi={nom} />}
          {detailSaison && <FeuilleSaison e={detailSaison} moi={nom} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Le badge le plus proche : la seule chose à viser dimanche. */
function ProchainBadge({ e, onOpen }: { e: EtatTrophee; onOpen: () => void }) {
  const cible = metal(e.palier + 1)!;
  const base = e.palier ? e.def.paliers[e.palier - 1] : 0;
  const reste = e.cible! - e.valeur;
  const Embleme = EMBLEMES[e.def.id];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Prochain badge : ${e.def.nom} ${NOM_METAL[cible].toLowerCase()}, ${e.valeur} sur ${e.cible}, plus que ${reste}`}
      className="glass flex w-full items-center gap-3.5 rounded-[24px] px-[18px] py-4 text-left"
    >
      <span
        className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed"
        style={{ borderColor: METAL[cible].trait }}
        aria-hidden
      >
        <Embleme className="size-6" style={{ color: METAL[cible].trait }} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mono-label block text-[11px] text-foreground/65">Prochain badge</span>
        <span className="mt-0.5 block text-[17px] font-extrabold">
          {e.def.nom} · {NOM_METAL[cible]}
        </span>
        <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-foreground/12">
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(4, ((e.valeur - base) / (e.cible! - base)) * 100)}%`, background: METAL[cible].trait }}
          />
        </span>
        <span className="mt-1.5 flex justify-between text-[13px]">
          <span className="font-bold tabular-nums">
            {e.valeur} / {quantite(e.def, e.cible!)}
          </span>
          <span className="text-foreground/65">plus que {reste}</span>
        </span>
      </span>
    </button>
  );
}

/** La feuille d'un badge de palier : ses quatre marches. */
function FeuillePalier({ e, moi }: { e: EtatTrophee; moi: string }) {
  const m = metal(e.palier);
  return (
    <div className="flex flex-col items-center gap-4">
      <Medaille e={e} diametre={96} />
      <div className="text-center">
        <SheetTitle className="text-[22px] font-extrabold tracking-tight">
          {e.def.nom}
          {m ? ` · ${NOM_METAL[m]}` : ""}
        </SheetTitle>
        <SheetDescription className="mt-1 text-[15px] text-foreground/75">{quantite(e.def, e.valeur)}</SheetDescription>
      </div>
      <ol className="flex w-full flex-col gap-2">
        {e.def.paliers.map((seuil, i) => {
          const mm = METAUX[Math.min(i, METAUX.length - 1)];
          const gagne = e.palier > i;
          const courant = e.palier === i;
          const base = i ? e.def.paliers[i - 1] : 0;
          return (
            <li key={seuil} className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] px-3.5 py-2.5">
              {gagne ? (
                <span className="size-9 shrink-0 rounded-full" style={{ background: fond(mm), boxShadow: `inset 0 0 0 2px ${METAL[mm].listel}` }} aria-hidden />
              ) : (
                <span className="size-9 shrink-0 rounded-full border-[2.5px] border-dashed" style={{ borderColor: METAL[mm].trait }} aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-bold">{NOM_METAL[mm]}</span>
                  <span className="font-mono text-[13px] font-bold tabular-nums">{quantite(e.def, seuil)}</span>
                </span>
                {courant && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-foreground/12">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(4, ((e.valeur - base) / (seuil - base)) * 100)}%`, background: METAL[mm].trait }}
                    />
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1 text-[13px] text-foreground/70">
                  {gagne ? (
                    <>
                      <Check className="size-3.5" strokeWidth={3} aria-hidden /> Gagné
                    </>
                  ) : courant ? (
                    `Plus que ${quantite(e.def, seuil - e.valeur)}`
                  ) : (
                    "À gagner"
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <AussiPalier e={e} moi={moi} />
    </div>
  );
}

/** La feuille d'un classement de fin de saison : ses podiums, et le rang du moment. */
function FeuilleSaison({ e, moi }: { e: EtatClassement; moi: string }) {
  const unite = (n: number) => `${n} ${n > 1 ? e.def.unite[1] : e.def.unite[0]}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <Ecusson id={e.def.id} rang={e.meilleur?.rang ?? null} largeur={92} />
      <div className="text-center">
        <SheetTitle className="text-[22px] font-extrabold tracking-tight">{e.def.nom}</SheetTitle>
        <SheetDescription className="mt-1 text-[15px] text-foreground/75">{sousTitre(e)}</SheetDescription>
      </div>
      <ol className="flex w-full flex-col gap-2">
        {e.enCours && (
          <li className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] border border-foreground/15 px-3.5 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden>
              <span className="size-3 rounded-full border-2 border-foreground/80" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold">{ordinal(e.enCours.rang)} en ce moment</span>
                <span className="font-mono text-[13px] font-bold tabular-nums">{unite(e.enCours.valeur)}</span>
              </span>
              <span className="mt-1 block text-[13px] text-foreground/70">Saison en cours</span>
            </span>
          </li>
        )}
        {e.podiums.map((p) => {
          const mm = METAL_RANG[p.rang];
          return (
            <li key={p.saison} className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] px-3.5 py-2.5">
              <span className="size-9 shrink-0 rounded-full" style={{ background: fond(mm), boxShadow: `inset 0 0 0 2px ${METAL[mm].listel}` }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-bold">
                    {ordinal(p.rang)} · {NOM_METAL[mm]}
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums">{unite(p.valeur)}</span>
                </span>
                <span className="mt-1 block text-[13px] text-foreground/70">{p.saison}</span>
              </span>
            </li>
          );
        })}
        {!e.podiums.length && !e.enCours && (
          <li className="rounded-[18px] bg-foreground/[0.06] px-3.5 py-4 text-center text-[14px] text-foreground/70">
            Les trois premiers à la fin de la saison
          </li>
        )}
      </ol>
      <AussiSaison id={e.def.id} moi={moi} />
    </div>
  );
}

/* ---------------------------- Qui d'autre l'a ---------------------------- */

/** Un joueur qui a le badge : sa photo, son nom, son métal. Le toucher ouvre sa carte. */
function Detenteur({ nom, m, detail }: { nom: string; m: Metal; detail: string }) {
  const { players } = useSeason();
  const { open } = useCardViewer();
  const src = usePlayerPhoto(nom);
  const [cassee, setCassee] = useState(false);
  const p = players.find((x) => x.name === nom);
  return (
    <li>
      <button
        type="button"
        disabled={!p}
        onClick={() =>
          p &&
          open({
            cacheKey: `badge-${nom}`,
            mode: "simple",
            title: nom,
            subtitle: detail,
            render: (s) => <PlayerCard player={p} size={s} />,
          })
        }
        aria-label={`${nom}, ${detail}. Voir sa carte`}
        className="flex w-full min-h-11 items-center gap-3 rounded-[14px] px-1 py-1.5 text-left active:bg-foreground/[0.06]"
      >
        <span className="relative size-9 shrink-0">
          <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-foreground/10 text-[13px] font-bold">
            {cassee ? (
              nom[0]
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="size-full object-cover" onError={() => setCassee(true)} />
            )}
          </span>
          <span
            className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-popover"
            style={{ background: fond(m) }}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{nom}</span>
        <span className="shrink-0 text-[13px] text-foreground/70">{detail}</span>
      </button>
    </li>
  );
}

function ListeDetenteurs({ titre, gens }: { titre: string; gens: { nom: string; m: Metal; detail: string }[] }) {
  return (
    <section className="w-full" aria-label={titre}>
      <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-[15px] font-bold">
        {titre}
        <span className="font-mono text-[12px] text-foreground/65 tabular-nums">{gens.length}</span>
      </h3>
      {gens.length ? (
        <ul className="flex flex-col">
          {gens.map((g) => (
            <Detenteur key={g.nom + g.detail} {...g} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-[14px] text-foreground/70">Personne pour l&apos;instant</p>
      )}
    </section>
  );
}

/** Qui d'autre a ce badge de palier, à n'importe quel palier. */
function AussiPalier({ e, moi }: { e: EtatTrophee; moi: string }) {
  const { saison, players } = useSeason();
  const gens = useMemo(
    () =>
      detenteurs(
        saison,
        e.def.id,
        players.map((p) => p.name).filter((n) => n !== moi),
        1,
        new Date()
      ).map((d) => ({ nom: d.nom, m: metal(d.palier)!, detail: `${NOM_METAL[metal(d.palier)!]} · ${quantite(e.def, d.valeur)}` })),
    [saison, players, e.def, moi]
  );
  return <ListeDetenteurs titre={e.palier ? "Ils l'ont aussi" : "Ils l'ont déjà"} gens={gens} />;
}

/** Qui d'autre est monté sur ce podium de fin de saison. */
function AussiSaison({ id, moi }: { id: ClassementId; moi: string }) {
  const { saison, players } = useSeason();
  const gens = useMemo(() => {
    const noms = new Set(players.map((p) => p.name).filter((n) => n !== moi));
    return podiumsDe(saison, id, noms).map((p) => ({ nom: p.nom, m: METAL_RANG[p.rang], detail: `${ordinal(p.rang)} · ${p.saison}` }));
  }, [saison, players, id, moi]);
  return <ListeDetenteurs titre="Sur ce podium" gens={gens} />;
}

/* ----------------------------- Nouveaux badges ---------------------------- */

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
          description: "Ils t'attendent dans Ma carte.",
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
        return;
      }
      for (const c of nouveaux.slice(0, 3)) {
        const [id, palier] = c.split(":");
        const def = TROPHEES.find((t) => t.id === id);
        const m = metal(Number(palier));
        if (!def || !m) continue;
        toast.success(`Nouveau badge · ${def.nom} ${NOM_METAL[m]}`, {
          description: def.inscription,
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [actif, saison, me]);

  return null;
}

/**
 * La feuille d'un badge pour n'importe quel joueur (fiche joueur, par
 * exemple) : ses paliers ou ses podiums, et qui d'autre l'a. À poser dans un
 * SheetContent.
 */
export function FeuilleBadge({
  nom,
  badge,
}: {
  nom: string;
  badge: { famille: "palier"; id: TropheeId } | { famille: "saison"; id: ClassementId };
}) {
  const { saison, allPlayers } = useSeason();
  const e = useMemo(
    () =>
      badge.famille === "palier"
        ? { famille: "palier" as const, e: vitrine(saison, nom, new Date()).find((x) => x.def.id === badge.id)! }
        : { famille: "saison" as const, e: finsDeSaison(saison, nom, allPlayers).find((x) => x.def.id === badge.id)! },
    [saison, allPlayers, nom, badge.famille, badge.id]
  );
  return e.famille === "palier" ? <FeuillePalier e={e.e} moi={nom} /> : <FeuilleSaison e={e.e} moi={nom} />;
}
