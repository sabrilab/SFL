"use client";

// La carrière d'un joueur sur son profil : ses cartes, saison par saison, et
// sa courbe (Sabri, 19/10 : « la carte en elle-même a de la valeur »).
//
//   · Ses cartes — une rangée par saison, la plus récente d'abord : la carte
//     de la saison en grand format (la note qu'il avait alors), puis les
//     cartes spéciales débloquées cette saison-là en moyen (MVP, Impact,
//     Défensive), la plus haute d'abord. D'un format à l'autre, le rapport
//     est φ (FORMAT_CARTE). Toucher une carte l'ouvre en grand, en 3D.
//   · Sa courbe — journée après journée, toutes saisons à la suite : la note
//     de sa carte (une marche par saison, un point pour chaque carte
//     spéciale du jour) ou son rang au Pépite d'Or. On la parcourt du doigt.
// Ma carte s'en sert aussi : « Mes cartes », et la courbe, ouverte sur le rang.
// Noir et blanc : tout en `currentColor` et en opacités, sauf les cartes
// spéciales et leurs ronds sur la courbe, dans leur couleur (or, rouge,
// bleu : teinte-carte.ts, Sabri 22/10). Calcul dans
// lib/sfl/carriere.ts.

import { useEffect, useRef, useState } from "react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { BOOST_LABELS } from "@/components/sfl/boost-card";
import { TEINTES } from "@/components/sfl/teinte-carte";
import type { CartesDeSaison, PointCourbe } from "@/lib/sfl/carriere";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { cn } from "@/lib/utils";

const ANTON = "var(--font-anton), Anton, sans-serif";

/* -------------------------------- Ses cartes ------------------------------- */

export function CartesCarriere({ saisons, titre = "Ses cartes" }: { saisons: CartesDeSaison[]; titre?: string }) {
  const total = saisons.reduce((n, s) => n + 1 + s.speciales.length, 0);
  return (
    <section aria-labelledby="ses-cartes" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h3 id="ses-cartes" className="mono-label text-muted-foreground">
          {titre}
        </h3>
        <span className="font-mono text-[12px] font-bold text-foreground/45 tabular-nums">{total}</span>
      </div>
      <div className="glass flex flex-col overflow-hidden rounded-[22px]">
        {saisons.map((s, i) => {
          const avant = saisons[i + 1];
          const ecart = avant ? s.note - avant.note : 0;
          return (
            <div key={s.numero} className={cn("flex flex-col gap-[var(--fib-13)] py-[var(--fib-13)]", i > 0 && "border-t border-white/8")}>
              <div className="flex items-baseline justify-between px-4">
                <span className="text-[15px] font-semibold">
                  {s.nom}
                  {s.enCours && <span className="font-normal text-foreground/45"> · en cours</span>}
                </span>
                <span className="flex items-baseline gap-1.5">
                  {avant && ecart !== 0 && (
                    <span className="font-mono text-[11px] font-bold text-foreground/55 tabular-nums">
                      {ecart > 0 ? `+${ecart}` : `−${-ecart}`}
                    </span>
                  )}
                  <span style={{ fontFamily: ANTON, fontSize: 22, lineHeight: 0.9 }} className="tabular-nums">
                    {s.note}
                  </span>
                </span>
              </div>
              <div className="flex items-end gap-[var(--fib-13)] overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
                <figure className="flex shrink-0 flex-col items-center">
                  <MiniCarte
                    player={s.player}
                    size={FORMAT_CARTE.grande}
                    cle={`saison-${s.numero}-${s.player.name}`}
                    detail={`${s.nom} · ${s.note}`}
                  />
                </figure>
                {s.speciales.map((c) => (
                  <figure key={c.carte.type + c.j} className="flex shrink-0 flex-col items-center gap-1.5">
                    <MiniCarte
                      player={c.player}
                      size={FORMAT_CARTE.moyenne}
                      cle={`speciale-${s.numero}-${c.j}-${c.carte.type}-${c.player.name}`}
                      distinction={c.carte.type}
                      detail={`${BOOST_LABELS[c.carte.type]} · ${c.carte.date}`}
                    />
                    <figcaption className="flex flex-col items-center leading-tight">
                      <span className="text-[11px] font-bold">{BOOST_LABELS[c.carte.type]}</span>
                      <span className="font-mono text-[10px] text-foreground/45">J{c.j}</span>
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* -------------------------------- Sa courbe -------------------------------- */

function useLargeur<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Mode = "note" | "rang";

/** `depart` : la lecture montrée tant qu'on n'en a pas choisi une (Ma carte ouvre sur le rang). */
export function CourbeCarriere({ points, depart = "note" }: { points: PointCourbe[]; depart?: Mode }) {
  const [choisi, setMode] = useState<Mode | null>(null);
  const mode = choisi ?? depart;
  const [ref, largeur] = useLargeur<HTMLDivElement>();
  const [actif, setActif] = useState<number | null>(null);
  const n = points.length;
  if (n < 2) return null;

  const hauteur = 188;
  const gauche = 28;
  const droite = 10;
  const haut = 14;
  const bas = 24;
  const w = Math.max(0, largeur - gauche - droite);
  const h = hauteur - haut - bas;
  const x = (i: number) => gauche + (i / (n - 1)) * w;

  // L'échelle : la note entre ses bornes (cartes spéciales comprises), le rang
  // renversé (1er en haut).
  let y: (v: number) => number;
  let graduations: number[];
  if (mode === "note") {
    const vals = points.flatMap((p) => [p.note, ...(p.speciale ? [p.speciale.note] : [])]);
    const lo = Math.min(...vals) - 1;
    const hi = Math.max(...vals) + 1;
    y = (v) => haut + h - ((v - lo) / Math.max(1, hi - lo)) * h;
    graduations = [Math.ceil(lo), Math.round((lo + hi) / 2), Math.floor(hi)];
  } else {
    // Jusqu'à son pire rang (au moins le 5e) : sinon une ligue de 50 écrase sa courbe en haut.
    const pire = Math.max(5, ...points.map((p) => p.rang ?? 1));
    const bas = Math.min(Math.max(...points.map((p) => p.sur)), pire + Math.ceil(pire / 5));
    y = (v) => haut + ((v - 1) / Math.max(1, bas - 1)) * h;
    graduations = [1, Math.round((1 + bas) / 2), bas];
  }

  // Le trait : la note en marches (elle ne bouge qu'entre deux saisons), le
  // rang journée après journée, levé quand il n'a pas encore de rang.
  let d = "";
  let leve = true;
  points.forEach((p, i) => {
    const v = mode === "note" ? p.note : p.rang;
    if (v == null) {
      leve = true;
      return;
    }
    if (leve) d += `M${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    else if (mode === "note") d += `H${x(i).toFixed(1)}V${y(v).toFixed(1)}`;
    else d += `L${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    leve = false;
  });

  // Le début de chaque saison : un trait fin et son nom.
  const debuts = points.flatMap((p, i) => (i === 0 || points[i - 1].saison !== p.saison ? [{ i, nom: `S${p.saison}` }] : []));

  const i = actif ?? n - 1;
  const p = points[i];
  const choisir = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const rel = (clientX - r.left - gauche) / Math.max(1, w);
    setActif(Math.max(0, Math.min(n - 1, Math.round(rel * (n - 1)))));
  };
  const valeurActive = mode === "note" ? p.note : p.rang;

  return (
    <section aria-labelledby="evolution" className="glass flex flex-col gap-[var(--fib-13)] rounded-[22px] px-4 pt-[var(--fib-13)] pb-3">
      <div className="flex items-center justify-between">
        <h3 id="evolution" className="mono-label text-muted-foreground">
          Évolution
        </h3>
        <div role="tablist" className="flex rounded-full bg-foreground/[0.07] p-0.5">
          {(["note", "rang"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "px-3 py-1 text-[12px] font-semibold",
                mode === m ? "bouton-principal" : "bouton-discret text-foreground/55"
              )}
            >
              {m === "note" ? "Note" : "Pépite d'Or"}
            </button>
          ))}
        </div>
      </div>

      {/* Le point touché : sa journée, sa valeur. */}
      <div className="flex items-end justify-between gap-3">
        <span className="flex items-baseline gap-2">
          <span style={{ fontFamily: ANTON, fontSize: 34, lineHeight: 0.9 }} className="tabular-nums">
            {valeurActive == null ? "–" : mode === "note" ? valeurActive : ordinal(valeurActive)}
          </span>
          <span className="font-mono text-[11px] text-foreground/55">
            {mode === "note"
              ? p.speciale
                ? `carte ${BOOST_LABELS[p.speciale.type]} ${p.speciale.note}`
                : "carte de la saison"
              : p.rang == null
                ? "pas encore classé"
                : `sur ${p.sur}`}
          </span>
        </span>
        <span className="text-right font-mono text-[11px] leading-tight text-foreground/45">
          {p.nomSaison} · J{p.j}
          <br />
          {p.date}
        </span>
      </div>

      <div ref={ref} className="relative select-none" style={{ height: hauteur, touchAction: "pan-y" }}>
        {largeur > 0 && (
          <svg
            width={largeur}
            height={hauteur}
            className="block text-foreground"
            onPointerMove={(e) => choisir(e.clientX)}
            onPointerDown={(e) => choisir(e.clientX)}
            onPointerLeave={(e) => e.pointerType === "mouse" && setActif(null)}
          >
            {graduations.map((g) => (
              <g key={g}>
                <line x1={gauche} x2={gauche + w} y1={y(g)} y2={y(g)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={gauche - 6} y={y(g) + 3.5} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.4} className="font-mono tabular-nums">
                  {mode === "note" ? g : `${g}e`.replace(/^1e$/, "1er")}
                </text>
              </g>
            ))}
            {debuts.map((s) => (
              <g key={s.nom}>
                {s.i > 0 && <line x1={x(s.i) - w / (n - 1) / 2} x2={x(s.i) - w / (n - 1) / 2} y1={haut} y2={haut + h} stroke="currentColor" strokeOpacity={0.18} strokeDasharray="2 3" />}
                <text x={x(s.i)} y={hauteur - 6} fontSize={10} fill="currentColor" fillOpacity={0.45} className="font-mono" textAnchor={s.i === 0 ? "start" : "middle"}>
                  {s.nom}
                </text>
              </g>
            ))}
            <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {/* Les dimanches joués : un point plein ; sautés, rien. */}
            {mode === "rang" &&
              points.map((q, k) => (q.joue && q.rang != null ? <circle key={k} cx={x(k)} cy={y(q.rang)} r={2} fill="currentColor" /> : null))}
            {/* Les cartes spéciales : un anneau à leur note, relié à la carte du jour. */}
            {mode === "note" &&
              points.map((q, k) =>
                q.speciale ? (
                  <g key={k}>
                    <line x1={x(k)} x2={x(k)} y1={y(q.note)} y2={y(q.speciale.note)} stroke="currentColor" strokeOpacity={0.3} />
                    <circle cx={x(k)} cy={y(q.speciale.note)} r={3.5} fill="var(--background)" stroke={TEINTES[q.speciale.type].vive} strokeWidth={1.75} />
                  </g>
                ) : null
              )}
            {valeurActive != null && (
              <>
                <line x1={x(i)} x2={x(i)} y1={haut} y2={haut + h} stroke="currentColor" strokeOpacity={0.25} />
                <circle cx={x(i)} cy={y(valeurActive)} r={5} fill="currentColor" stroke="var(--background)" strokeWidth={2} />
              </>
            )}
          </svg>
        )}
      </div>
    </section>
  );
}
