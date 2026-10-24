"use client";

// Les rubriques de Ma carte, résumées (Sabri, 24/10 : que Ma carte soit
// « plus agréable à parcourir » ; « si on veut approfondir dans une rubrique,
// on puisse y aller » : une interface enfant). Sous moi (ma carte, mon nom,
// mes chiffres), Ma carte ne montre plus qu'une tuile par rubrique, chacune
// dans son ton (rubriques.css ; Sabri, 24/10 : la liste « pas ouf », « des
// cartes séparées », « un peu plus de couleurs ») : ma saison en large, puis
// deux par deux le Niveau XP, l'évolution (sa courbe), les badges (les vrais
// objets) et mes cartes (la dernière, en vrai). La toucher ouvre sa
// page, enfant de Ma carte (lib/nav.ts) : /profil/saison, /profil/xp,
// /profil/evolution, /profil/badges, /profil/cartes. Chaque page reprend tel
// quel le bloc qui était dans Ma carte (ma-saison.tsx, niveau-xp.tsx,
// carriere-joueur.tsx, vitrine.tsx), sous le retour de toute l'app
// (bouton-retour.tsx), qui ramène à Ma carte là où on l'avait laissée.
//
// Une rubrique vide ne se montre pas (pas encore de dimanche, pas d'XP, une
// seule journée pour la courbe). Les tuiles tiennent en clair comme en sombre.
// Les chiffres en Anton, les étiquettes en JetBrains Mono ; aucun rouge ni
// bleu (cartes Impact et Défensive), l'or reste aux badges.

import Link from "next/link";
import { useMemo } from "react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import type { RangDuJour } from "@/components/sfl/ma-saison";
import { useRangXp, useXp } from "@/hooks/use-missions";
import { useFormatCarte } from "@/hooks/use-format-carte";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { Medaille } from "@/components/sfl/vitrine";
import { cartesDeCarriere, courbeDeCarriere, type PointCourbe } from "@/lib/sfl/carriere";
import { actionsDuJour, dimanchesDe, ficheJoueur, resultatDuJour } from "@/lib/sfl/fiche-joueur";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { PALIERS_PASSE, PASSE_BOLA } from "@/lib/sfl/passe";
import { metal, NOM_METAL, prochain, vitrine } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import "./rubriques.css";

const signe = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);
const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Ce que Ma carte et ses pages lisent de ma saison : calculé au même endroit. */
export function useMaCarte() {
  const { player } = useMyPlayer();
  const { allPlayers, saison } = useSeason();
  const fiche = useMemo(() => ficheJoueur(saison, player, allPlayers), [saison, player, allPlayers]);
  const dimanches = useMemo(() => dimanchesDe(saison, player.name), [saison, player.name]);
  const joues = dimanches.filter((d) => !d.horsMatch).length;
  const courbe = useMemo(() => courbeDeCarriere(saison, player.name), [saison, player.name]);
  const mesCartes = useMemo(() => cartesDeCarriere(saison, player.name), [saison, player.name]);
  // Ma place au Pépite d'Or après chaque journée de la saison, et les places
  // gagnées ou perdues depuis la précédente : la courbe les a déjà.
  const rangs = useMemo(() => {
    const m = new Map<number, RangDuJour>();
    let avant: number | null = null;
    for (const p of courbe) {
      if (p.saison !== (saison.numero ?? 0)) continue;
      m.set(p.j, { rang: p.rang, ecart: avant != null && p.rang != null ? avant - p.rang : null });
      avant = p.rang;
    }
    return m;
  }, [courbe, saison.numero]);
  return { player, saison, fiche, dimanches, joues, courbe, mesCartes, rangs };
}

/* ------------------------------- Les tuiles ------------------------------- */

type Ton = "saison" | "xp" | "evolution" | "badges" | "cartes";

/** Une tuile : son ton, son étiquette, son contenu ; la toucher ouvre sa page. */
function Tuile({
  href,
  ton,
  nom,
  large,
  label,
  children,
}: {
  href: string;
  ton: Ton;
  nom: string;
  large?: boolean;
  /** Ce que lit le lecteur d'écran. */
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn("tuile flex min-h-[156px] flex-col gap-2.5 p-4", `tuile--${ton}`, large && "col-span-2 min-h-0")}
    >
      <span className="tuile__etiquette mono-label text-[10px]">{nom}</span>
      {children}
    </Link>
  );
}

const NOMBRE = { fontFamily: ANTON, lineHeight: 0.9 } as const;

/** La courbe : mon rang (le 1er en haut) ou la note de ma carte. */
function Trace({ points, mode }: { points: PointCourbe[]; mode: "rang" | "note" }) {
  const vals = points.map((p) => (mode === "rang" ? p.rang : p.note)).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const l = 140;
  const h = 46;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const y = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return 5 + (mode === "rang" ? t : 1 - t) * (h - 10);
  };
  const x = (i: number) => (i / (vals.length - 1)) * (l - 10) + 5;
  const d = vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const fin = vals.length - 1;
  return (
    <svg viewBox={`0 0 ${l} ${h}`} className="tuile__courbe h-[46px] w-full" preserveAspectRatio="none" aria-hidden>
      <path d={`${d} L${x(fin)} ${h} L${x(0)} ${h} Z`} fill="currentColor" fillOpacity={0.1} />
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(fin)} cy={y(vals[fin])} r={3.2} fill="currentColor" />
    </svg>
  );
}

const fleche = (n: number) => (n > 0 ? "▲" : "▼");
const places = (n: number) => `${Math.abs(n)} ${Math.abs(n) > 1 ? "places" : "place"}`;

/* ------------------------------ Les rubriques ------------------------------ */

export function RubriquesMaCarte() {
  const { player, saison, dimanches, joues, courbe, mesCartes, rangs } = useMaCarte();
  const b = useXp(player.name);
  const r = useRangXp(player.name);
  const format = useFormatCarte();
  const paliers = useMemo(() => vitrine(saison, player.name, new Date()), [saison, player.name]);
  const numero = saison.numero ?? 0;
  const tuiles: React.ReactNode[] = [];

  // 1. Ma saison, en large : mon dernier dimanche en une phrase, ce qu'il m'a rapporté.
  const dernier = dimanches[0];
  if (dernier) {
    const rang = rangs.get(dernier.j);
    const phrase = dernier.horsMatch ?? majuscule([resultatDuJour(dernier), actionsDuJour(dernier.buts, dernier.passes)].filter(Boolean).join(", ") || "présent");
    tuiles.push(
      <Tuile
        key="saison"
        href="/profil/saison"
        ton="saison"
        nom={`Ma saison · J${dernier.j}`}
        large
        label={`Ma saison. Dernier dimanche, J${dernier.j} : ${phrase}, ${signe(dernier.points)} points Pépite`}
      >
        <span className="text-[19px] leading-[1.2] font-bold tracking-[-0.3px]">{phrase}</span>
        <span className="flex items-end gap-5">
          <span className="flex flex-col gap-1">
            <span style={{ ...NOMBRE, fontSize: 38 }} className="tabular-nums">
              {signe(dernier.points)}
            </span>
            <span className="mono-label text-[9px] text-foreground/45">Pts Pépite</span>
          </span>
          {rang?.ecart ? (
            <span className="flex flex-col gap-1">
              <span style={{ ...NOMBRE, fontSize: 38 }} className="tabular-nums">
                <span className="mr-1 align-[0.3em] text-[0.45em]">{fleche(rang.ecart)}</span>
                {Math.abs(rang.ecart)}
              </span>
              <span className="mono-label text-[9px] text-foreground/45">{Math.abs(rang.ecart) > 1 ? "Places" : "Place"}</span>
            </span>
          ) : null}
          <span className="ml-auto flex flex-col items-end gap-1">
            <span className="flex gap-1">
              {dernier.resultats.map((x, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full text-[11px] font-bold",
                    x === "V" ? "tuile__plein text-background" : "bg-foreground/10 text-foreground/60"
                  )}
                >
                  {x}
                </span>
              ))}
            </span>
            <span className="font-mono text-[11px] text-foreground/45 tabular-nums">
              {joues} {joues > 1 ? "dimanches" : "dimanche"}
            </span>
          </span>
        </span>
      </Tuile>
    );
  }

  // 2. Mon Niveau XP, et le Passe Bola en vingt traits.
  if (b) {
    const fini = b.passe.palier >= PALIERS_PASSE;
    const suivant = PASSE_BOLA[Math.min(PALIERS_PASSE, b.passe.palier + 1) - 1];
    tuiles.push(
      <Tuile
        key="xp"
        href="/profil/xp"
        ton="xp"
        nom="Niveau XP"
        label={`Niveau XP ${b.niveau}${r && r.xp > 0 ? `, rang ${r.rang}` : ""}. Passe Bola : palier ${b.passe.palier} sur ${PALIERS_PASSE}`}
      >
        <span className="flex items-baseline gap-2">
          <span style={{ ...NOMBRE, fontSize: 52 }} className="tabular-nums">
            {b.niveau}
          </span>
          {r && r.xp > 0 && <span className="tuile__etiquette font-mono text-[12px] font-bold">rang {r.rang}</span>}
        </span>
        <span className="mt-auto flex flex-col gap-1.5">
          <span className="flex gap-[2px]" aria-hidden>
            {Array.from({ length: PALIERS_PASSE }, (_, i) => (
              <span key={i} className={cn("h-[5px] flex-1 rounded-full", i < b.passe.palier ? "tuile__plein" : "tuile__trait")} />
            ))}
          </span>
          <span className="truncate text-[12px] font-semibold">
            {fini ? "Passe complet" : `Passe ${b.passe.palier}/${PALIERS_PASSE} · ${suivant.nom}`}
          </span>
        </span>
      </Tuile>
    );
  }

  // 3. Mon évolution : la courbe, et où elle en est.
  const mode = joues > 0 ? "rang" : "note";
  const lus = (mode === "rang" ? courbe.filter((p) => p.saison === numero && p.rang != null) : courbe);
  if (lus.length >= 2) {
    const premier = lus[0];
    const fin = lus[lus.length - 1];
    const ecart = mode === "rang" ? premier.rang! - fin.rang! : fin.note - premier.note;
    tuiles.push(
      <Tuile
        key="evolution"
        href="/profil/evolution"
        ton="evolution"
        nom="Évolution"
        label={`Évolution : ${mode === "rang" ? `${ordinal(fin.rang!)} au Pépite d'Or` : `note ${fin.note}`}`}
      >
        <span className="flex items-baseline gap-1.5">
          <span style={{ ...NOMBRE, fontSize: 34 }} className="tabular-nums">
            {mode === "rang" ? ordinal(fin.rang!) : fin.note}
          </span>
          {ecart !== 0 && (
            <span className="tuile__etiquette font-mono text-[12px] font-bold">
              {fleche(ecart)} {Math.abs(ecart)}
            </span>
          )}
        </span>
        <span className="mt-auto">
          <Trace points={lus} mode={mode} />
        </span>
        <span className="font-mono text-[11px] text-foreground/45">
          {mode === "rang" ? (ecart ? `${places(ecart)} depuis J${premier.j}` : `depuis J${premier.j}`) : "note de ma carte"}
        </span>
      </Tuile>
    );
  }

  // 4. Mes badges : ceux que j'ai, en vrai, et le prochain.
  const suivant = prochain(paliers);
  const gagnes = paliers.filter((e) => e.palier > 0).sort((x, y) => y.palier - x.palier);
  tuiles.push(
    <Tuile
      key="badges"
      href="/profil/badges"
      ton="badges"
      nom="Badges"
      label={`Badges : ${gagnes.length} paliers sur ${paliers.length}${suivant ? `, prochain ${suivant.def.nom}` : ""}`}
    >
      <span className="flex items-center">
        {(gagnes.length ? gagnes : paliers).slice(0, 3).map((e, i) => (
          <span key={e.def.id} className={cn(i > 0 && "-ml-2.5")}>
            <Medaille e={e} diametre={40} />
          </span>
        ))}
      </span>
      <span className="mt-auto flex flex-col gap-0.5">
        <span className="text-[13px] font-semibold">
          {gagnes.length} / {paliers.length} paliers
        </span>
        {suivant && (
          <span className="truncate font-mono text-[11px] text-foreground/45">
            prochain : {suivant.def.nom.toLowerCase()} {NOM_METAL[metal(suivant.palier + 1)!].toLowerCase()}
          </span>
        )}
      </span>
    </Tuile>
  );

  // 5. Mes cartes : la dernière en vrai, et combien j'en ai.
  if (mesCartes.length > 0) {
    const speciales = mesCartes.reduce((n, s) => n + s.speciales.length, 0);
    const total = mesCartes.length + speciales;
    const s = mesCartes[0];
    tuiles.push(
      <Tuile key="cartes" href="/profil/cartes" ton="cartes" nom="Mes cartes" label={`Mes cartes : ${total}`}>
        <span className="flex items-end gap-3">
          <span className="pointer-events-none -mb-1 shrink-0">
            <MiniCarte player={s.player} size={format.moyenne} cle={`tuile-${s.numero}-${s.player.name}`} saison={s.enCours ? undefined : s.numero} />
          </span>
          <span className="flex min-w-0 flex-col gap-1 pb-0.5">
            <span style={{ ...NOMBRE, fontSize: 34 }} className="tabular-nums">
              {total}
            </span>
            <span className="text-[12px] leading-tight font-semibold">
              {speciales > 0 ? `dont ${speciales} ${speciales > 1 ? "spéciales" : "spéciale"}` : total > 1 ? "cartes" : "carte"}
            </span>
          </span>
        </span>
      </Tuile>
    );
  }

  return (
    <nav aria-label="Ma carte en détail" className="grid grid-cols-2 gap-2.5">
      {tuiles}
    </nav>
  );
}

/* ----------------------------- La page enfant ----------------------------- */

/**
 * Une rubrique en grand : le retour vers Ma carte, son nom, son contenu. Le
 * nom du bloc repris (« Ma saison », « Niveau XP ») redirait le titre : il ne
 * reste que pour le lecteur d'écran, la ligne d'à côté (« Saison 1 · après
 * J2 ») reste à sa place.
 */
export function PageRubrique({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--fib-21)] px-5 py-4 sm:py-8 lg:max-w-2xl [&>section>div:first-child>h2.mono-label]:sr-only">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-[30px] font-bold tracking-tight">{titre}</h1>
      </div>
      {children}
    </div>
  );
}
