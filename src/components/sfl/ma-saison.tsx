"use client";

// « Ma saison », dans Ma carte (Sabri, 22/10 : que Ma carte « donne plus
// envie, qu'on comprenne mieux les choses et que ce soit mieux rangé ») : ce
// que le joueur a fait cette saison, du plus récent au plus ancien.
//
//   1. son dernier dimanche, en grand : ce qui s'est passé en une phrase,
//      ses titres du jour, puis ce que ça lui a rapporté (ses points Pépite)
//      et ce que ça a changé (ses places gagnées ou perdues au Pépite d'Or) ;
//   2. ses trois points forts de la saison, les mêmes que sur son profil ;
//   3. ses autres dimanches, une ligne chacun, les plus récents d'abord.
// Un dimanche sans match n'y est que s'il lui a rapporté ou coûté des points
// (un bonus d'extra time, une absence injustifiée) : ses dimanches mis bout à
// bout font son total.
//
// Tout se touche (Sabri, 24/10 : « des boutons, des choses dessus où je peux
// cliquer, et ça me ramène vers des classements ») : un dimanche ouvre ce
// dimanche dans les Actus (/ligue#j2), pas l'ancien récap ; ses points et sa
// place, le Pépite d'Or ; un point fort, son classement (?classement=buts),
// sa place en pastille, pleine sur le podium. Le haut dit jusqu'où va la
// saison lue : « Saison 1 · après J2 ».
// Noir et blanc : seuls ses titres du jour portent la couleur de leur carte
// (or, rouge, bleu : teinte-carte.ts). Calcul dans lib/sfl/fiche-joueur.ts
// (dimanchesDe, ficheJoueur).

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Chiffre } from "@/components/sfl/profil-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { TEINTES } from "@/components/sfl/teinte-carte";
import {
  actionsDuJour,
  NOM_TITRE,
  phraseDuJour,
  resultatDuJour,
  type Dimanche,
  type PointFort,
  type Resultat,
  type TitreDuJour,
} from "@/lib/sfl/fiche-joueur";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { cn } from "@/lib/utils";

/** Sa place au Pépite d'Or après un dimanche, et ce qu'il a gagné (+) ou perdu (−) ce jour-là. */
export type RangDuJour = { rang: number | null; ecart: number | null };

/** Les autres dimanches montrés d'emblée ; le reste se déplie. */
const D_EMBLEE = 4;

const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const signe = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** Un dimanche dans les Actus ; un classement de la saison. */
const dimancheDansLesActus = (j: number) => `/ligue#j${j}`;
const classement = (id: string) => `/ligue?vue=classements&classement=${id}`;

/** La carte d'un titre du jour : MVP en or, Le Mur en bleu, Impact en rouge. */
const TEINTE_TITRE: Record<TitreDuJour, string> = {
  mvp: TEINTES.mvp.vive,
  def: TEINTES.def.vive,
  impact: TEINTES.impact.vive,
};

/** V, N ou D dans un rond : la victoire en plein, le nul en gris, la défaite à peine. */
function Pastille({ r }: { r: Resultat }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
        r === "V" ? "bg-primary text-primary-foreground" : r === "N" ? "bg-foreground/12 text-foreground/70" : "bg-foreground/6 text-foreground/40"
      )}
    >
      {r}
    </span>
  );
}

/** Ses titres du jour, chacun avec le rond de la couleur de sa carte. */
function Titres({ titres, taille = "petit" }: { titres: TitreDuJour[]; taille?: "petit" | "grand" }) {
  if (!titres.length) return null;
  return (
    <span className={cn("flex flex-wrap items-center", taille === "grand" ? "gap-x-3.5 gap-y-1.5" : "gap-x-2.5 gap-y-1")}>
      {titres.map((t) => (
        <span key={t} className={cn("flex items-center", taille === "grand" ? "gap-2 text-[14px] font-semibold" : "gap-1.5")}>
          <span
            aria-hidden
            className={cn("shrink-0 rounded-full", taille === "grand" ? "size-2.5" : "size-2")}
            style={{ background: TEINTE_TITRE[t], boxShadow: `0 0 8px ${TEINTE_TITRE[t]}` }}
          />
          {taille === "grand" ? `${NOM_TITRE[t]} du match` : NOM_TITRE[t]}
        </span>
      ))}
    </span>
  );
}

/**
 * Le dernier dimanche joué, en grand. Deux touchers : le haut ouvre ce
 * dimanche dans les Actus, les chiffres du bas le Pépite d'Or.
 */
function DernierDimanche({ d, rang }: { d: Dimanche; rang?: RangDuJour }) {
  const sansTitres = { ...d, titres: [] };
  const ecart = rang?.ecart ?? null;
  return (
    <div className="glass flex flex-col rounded-[22px]">
      <Link
        href={dimancheDansLesActus(d.j)}
        aria-label={`Dernier dimanche, J${d.j}, ${d.date} : ${phraseDuJour(d)} Voir ce dimanche dans les Actus`}
        className="flex flex-col gap-[var(--fib-13)] rounded-t-[22px] px-4 pt-[var(--fib-13)] pb-[var(--fib-13)] active:bg-foreground/[0.04]"
      >
        <span className="flex items-center justify-between gap-3">
          <span className="mono-label text-muted-foreground">Dernier dimanche</span>
          <span className="flex items-center gap-1 font-mono text-[11px] text-foreground/45">
            J{d.j} · {d.date}
            <ChevronRight className="size-3.5" aria-hidden />
          </span>
        </span>
        <span className="flex flex-col gap-[var(--fib-8)]">
          <span className="text-[19px] leading-[1.25] font-bold tracking-[-0.4px]">{phraseDuJour(sansTitres)}</span>
          <Titres titres={d.titres} taille="grand" />
        </span>
      </Link>
      <Link
        href={classement("pp")}
        aria-label={`${signe(d.points)} points Pépite ce dimanche : voir le classement du Pépite d'Or`}
        className="mx-4 flex items-stretch divide-x divide-foreground/10 border-t border-foreground/10 pt-[var(--fib-13)] pb-[var(--fib-13)] active:opacity-70"
      >
        <Chiffre valeur={signe(d.points)} quoi={Math.abs(d.points) > 1 ? "Pts Pépite" : "Pt Pépite"} />
        {ecart != null ? (
          <Chiffre valeur={ecart > 0 ? `▲${ecart}` : ecart < 0 ? `▼${-ecart}` : "="} quoi={ecart === 0 ? "Même place" : "Au Pépite d'Or"} />
        ) : rang?.rang != null ? (
          <Chiffre valeur={ordinal(rang.rang)} quoi="Pépite d'Or" />
        ) : null}
      </Link>
    </div>
  );
}

/**
 * Un point fort, en bouton : son chiffre, ce qu'il compte, sa place (pleine
 * sur le podium) ; il ouvre son classement.
 */
function Fort({ f }: { f: PointFort }) {
  const podium = f.place != null && f.place <= 3;
  return (
    <Link
      href={classement(f.classement)}
      aria-label={`${f.chiffre} ${f.quoi}, ${f.rang} : voir le classement`}
      className="bouton-secondaire flex min-w-0 flex-col gap-1.5 rounded-2xl bg-secondary px-3 pt-3 pb-2.5"
    >
      <span className="flex items-start justify-between gap-1">
        <span className="text-[26px] leading-none font-black tracking-[-1px] italic tabular-nums">{f.chiffre}</span>
        <ChevronRight className="size-4 shrink-0 text-foreground/35" aria-hidden />
      </span>
      <span className="text-[12px] font-semibold">{f.quoi}</span>
      <span className="font-mono text-[10.5px] leading-tight text-muted-foreground">
        {f.place != null && (
          <span
            className={cn(
              "mr-1 inline-block rounded-full px-1.5 py-px font-bold tabular-nums",
              podium ? "bg-foreground text-background" : "text-foreground/80 ring-1 ring-foreground/20 ring-inset"
            )}
          >
            {ordinal(f.place)}
          </span>
        )}
        {f.titre}
      </span>
    </Link>
  );
}

/** Un autre dimanche, sur une ligne : ce qu'il a fait, ses titres, ses points, ses résultats. */
function LigneDimanche({ d, premiere }: { d: Dimanche; premiere: boolean }) {
  const actions = actionsDuJour(d.buts, d.passes);
  const resultat = resultatDuJour(d);
  return (
    <Link
      href={dimancheDansLesActus(d.j)}
      aria-label={`J${d.j}, ${d.date} : ${phraseDuJour(d)} ${signe(d.points)} points Pépite. Voir ce dimanche dans les Actus`}
      className={cn("flex min-h-[60px] items-center gap-3 px-4 py-2.5 active:bg-foreground/[0.04]", !premiere && "border-t border-foreground/8")}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("truncate text-[15px] font-semibold", d.horsMatch && "text-foreground/60")}>
          {d.horsMatch ?? majuscule(actions ?? resultat ?? "présent")}
        </span>
        <span className="flex min-w-0 items-center gap-2.5 font-mono text-[11px] text-foreground/45">
          <span className="shrink-0">
            J{d.j} · {d.date}
          </span>
          <Titres titres={d.titres} />
        </span>
      </span>
      <span className="shrink-0 font-mono text-[12px] font-bold text-foreground/70 tabular-nums">{signe(d.points)}</span>
      <span className="flex shrink-0 gap-1">
        {d.resultats.map((r, i) => (
          <Pastille key={i} r={r} />
        ))}
      </span>
      <ChevronRight className="size-4 shrink-0 text-foreground/30" aria-hidden />
    </Link>
  );
}

export function MaSaison({
  saison,
  dimanches,
  forts,
  rangs,
}: {
  /** « Saison 1 ». */
  saison: string;
  /** Ses dimanches joués, le plus récent d'abord. */
  dimanches: Dimanche[];
  forts: PointFort[];
  /** Sa place au Pépite d'Or après chaque journée de la saison (par numéro de journée). */
  rangs: Map<number, RangDuJour>;
}) {
  const [tout, setTout] = useState(false);
  // Jusqu'où va la saison : son dernier dimanche joué, celui de tous les classements.
  const { saison: s } = useSeason();
  const apres = useMemo(() => Math.max(0, ...s.journees.map((m) => m.j).filter((j) => journeeJouee(s, j))), [s]);
  if (!dimanches.length) return null;
  const [dernier, ...autres] = dimanches;
  const montres = tout ? autres : autres.slice(0, D_EMBLEE);

  return (
    <section aria-labelledby="ma-saison" className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between px-1">
        <h2 id="ma-saison" className="mono-label text-muted-foreground">
          Ma saison
        </h2>
        <span className="font-mono text-[12px] font-bold text-foreground/45">
          {saison}
          {apres > 0 && ` · après J${apres}`}
        </span>
      </div>

      <DernierDimanche d={dernier} rang={rangs.get(dernier.j)} />

      {forts.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {forts.map((f) => (
            <Fort key={f.classement} f={f} />
          ))}
        </div>
      )}

      {autres.length > 0 && (
        <div className="glass flex flex-col overflow-hidden rounded-[22px]">
          {montres.map((d, i) => (
            <LigneDimanche key={d.j} d={d} premiere={i === 0} />
          ))}
          {autres.length > D_EMBLEE && (
            <button
              type="button"
              onClick={() => setTout((t) => !t)}
              aria-expanded={tout}
              className="border-t border-foreground/8 py-3.5 text-[13px] font-semibold text-foreground/70 active:bg-foreground/[0.04]"
            >
              {tout ? "Moins" : "Tous mes dimanches"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
