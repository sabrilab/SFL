"use client";

// Les rubriques de Ma carte, résumées (Sabri, 24/10 : que Ma carte soit
// « plus agréable à parcourir » ; « si on veut approfondir dans une rubrique,
// on puisse y aller » : une interface enfant). Sous moi (ma carte, mon nom,
// mes chiffres), Ma carte ne montre plus qu'une liste groupée, comme les
// Réglages d'un iPhone : une rangée par rubrique, son nom, une phrase, un
// chiffre (ou la courbe, pour l'évolution) et le chevron. La toucher ouvre sa
// page, enfant de Ma carte (lib/nav.ts) : /profil/saison, /profil/xp,
// /profil/evolution, /profil/badges, /profil/cartes. Chaque page reprend tel
// quel le bloc qui était dans Ma carte (ma-saison.tsx, niveau-xp.tsx,
// carriere-joueur.tsx, vitrine.tsx), sous le retour de toute l'app
// (bouton-retour.tsx), qui ramène à Ma carte là où on l'avait laissée.
//
// Une rubrique vide ne se montre pas (pas encore de dimanche, pas d'XP, une
// seule journée pour la courbe). Le verre de la liste est celui de toute
// l'app (.glass) : il tient en clair comme en sombre. Les chiffres en Anton,
// les étiquettes en JetBrains Mono ; noir et blanc, rien de doré ici.

import Link from "next/link";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import type { RangDuJour } from "@/components/sfl/ma-saison";
import { useRangXp, useXp } from "@/hooks/use-missions";
import { cartesDeCarriere, courbeDeCarriere, type PointCourbe } from "@/lib/sfl/carriere";
import { actionsDuJour, dimanchesDe, ficheJoueur, resultatDuJour } from "@/lib/sfl/fiche-joueur";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { PALIERS_PASSE, PASSE_BOLA } from "@/lib/sfl/passe";
import { metal, NOM_METAL, prochain, vitrine } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

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

/* ------------------------------- La rangée ------------------------------- */

function Rangee({
  href,
  nom,
  phrase,
  detail,
  premiere,
  children,
}: {
  href: string;
  nom: string;
  phrase: string;
  detail?: string;
  premiere: boolean;
  /** Le chiffre ou la courbe, à droite. */
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex min-h-[76px] items-center gap-3.5 px-[18px] py-3.5 transition-colors active:bg-foreground/[0.05]",
        !premiere && "border-t border-foreground/8"
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="mono-label text-[10px] text-foreground/45">{nom}</span>
        <span className="truncate text-[15px] leading-tight font-semibold">{phrase}</span>
        {detail && <span className="truncate font-mono text-[11px] text-foreground/45 tabular-nums">{detail}</span>}
      </span>
      <span className="flex shrink-0 items-center">{children}</span>
      <ChevronRight className="size-4 shrink-0 text-foreground/30" aria-hidden />
    </Link>
  );
}

function Chiffre({ valeur, quoi }: { valeur: string | number; quoi: string }) {
  return (
    <span className="flex min-w-[52px] flex-col items-end gap-1">
      <span style={{ fontFamily: ANTON, fontSize: 30, lineHeight: 0.9 }} className="tabular-nums">
        {valeur}
      </span>
      <span className="mono-label text-[8.5px] text-foreground/40">{quoi}</span>
    </span>
  );
}

/** La courbe en miniature : mon rang (le 1er en haut) ou la note de ma carte. */
function Trace({ points, mode }: { points: PointCourbe[]; mode: "rang" | "note" }) {
  const vals = points.map((p) => (mode === "rang" ? p.rang : p.note)).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const l = 72;
  const h = 30;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const y = (v: number) => {
    const t = max === min ? 0.5 : (v - min) / (max - min);
    return 3 + (mode === "rang" ? t : 1 - t) * (h - 6);
  };
  const d = vals.map((v, i) => `${i ? "L" : "M"}${((i / (vals.length - 1)) * (l - 6) + 3).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const [fx, fy] = [l - 3, y(vals[vals.length - 1])];
  return (
    <svg width={l} height={h} viewBox={`0 0 ${l} ${h}`} aria-hidden className="text-foreground">
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={fx} cy={fy} r={3} fill="currentColor" />
    </svg>
  );
}

/* ------------------------------ Les rubriques ------------------------------ */

export function RubriquesMaCarte() {
  const { player, saison, dimanches, joues, courbe, mesCartes, rangs } = useMaCarte();
  const b = useXp(player.name);
  const r = useRangXp(player.name);
  const paliers = useMemo(() => vitrine(saison, player.name, new Date()), [saison, player.name]);
  const numero = saison.numero ?? 0;

  // 1. Ma saison : mon dernier dimanche, en une phrase.
  const dernier = dimanches[0];
  const items: { cle: string; rendre: (premiere: boolean) => React.ReactNode }[] = [];
  if (dernier) {
    const rang = rangs.get(dernier.j);
    items.push({
      cle: "saison",
      rendre: (premiere) => (
        <Rangee
          href="/profil/saison"
          nom="Ma saison"
          phrase={dernier.horsMatch ?? majuscule([resultatDuJour(dernier), actionsDuJour(dernier.buts, dernier.passes)].filter(Boolean).join(", ") || "présent")}
          detail={`J${dernier.j} · ${joues} ${joues > 1 ? "dimanches" : "dimanche"}${rang?.ecart ? ` · ${rang.ecart > 0 ? "▲" : "▼"} ${Math.abs(rang.ecart)} ${Math.abs(rang.ecart) > 1 ? "places" : "place"}` : ""}`}
          premiere={premiere}
        >
          <Chiffre valeur={signe(dernier.points)} quoi={`Pts J${dernier.j}`} />
        </Rangee>
      ),
    });
  }

  // 2. Mon Niveau XP et le Passe Bola de la saison.
  if (b) {
    const suivant = PASSE_BOLA[Math.min(PALIERS_PASSE, b.passe.palier + 1) - 1];
    items.push({
      cle: "xp",
      rendre: (premiere) => (
        <Rangee
          href="/profil/xp"
          nom="Niveau XP · Passe Bola"
          phrase={b.passe.palier >= PALIERS_PASSE ? "Passe Bola complet" : `Palier ${b.passe.palier} / ${PALIERS_PASSE} · ${suivant.nom} ensuite`}
          detail={`${b.total.toLocaleString("fr-FR")} XP à vie${r && r.xp > 0 ? ` · rang ${r.rang}` : ""}`}
          premiere={premiere}
        >
          <Chiffre valeur={b.niveau} quoi="Niveau" />
        </Rangee>
      ),
    });
  }

  // 3. Mon évolution : la courbe en miniature et où elle en est.
  const mode = joues > 0 ? "rang" : "note";
  const saisonEnCours = courbe.filter((p) => p.saison === numero);
  const trace = mode === "rang" ? saisonEnCours : courbe;
  if (courbe.length >= 2 && trace.filter((p) => (mode === "rang" ? p.rang != null : true)).length >= 2) {
    const lus = trace.filter((p) => (mode === "rang" ? p.rang != null : true));
    const premier = lus[0];
    const fin = lus[lus.length - 1];
    const ecart = mode === "rang" ? premier.rang! - fin.rang! : fin.note - premier.note;
    items.push({
      cle: "evolution",
      rendre: (premiere) => (
        <Rangee
          href="/profil/evolution"
          nom="Évolution"
          phrase={
            ecart === 0
              ? mode === "rang"
                ? `${ordinal(fin.rang!)} au Pépite d'Or, comme à J${premier.j}`
                : `Note ${fin.note}, comme au début`
              : mode === "rang"
                ? `${ecart > 0 ? "▲" : "▼"} ${Math.abs(ecart)} ${Math.abs(ecart) > 1 ? "places" : "place"} depuis J${premier.j}`
                : `${ecart > 0 ? "▲" : "▼"} ${Math.abs(ecart)} de note depuis le début`
          }
          detail={mode === "rang" ? `Pépite d'Or · ${ordinal(fin.rang!)} sur ${fin.sur}` : `Note de ma carte · ${fin.note}`}
          premiere={premiere}
        >
          <Trace points={lus} mode={mode} />
        </Rangee>
      ),
    });
  }

  // 4. Mes badges : le prochain à viser, et combien j'en ai.
  const suivant = prochain(paliers);
  const gagnes = paliers.filter((e) => e.palier > 0).length;
  items.push({
    cle: "badges",
    rendre: (premiere) => (
      <Rangee
        href="/profil/badges"
        nom="Badges et trophées"
        phrase={
          suivant
            ? `${suivant.def.nom} ${NOM_METAL[metal(suivant.palier + 1)!].toLowerCase()} : plus que ${suivant.cible! - suivant.valeur}`
            : "Tous les paliers sont à toi"
        }
        detail={`${gagnes} / ${paliers.length} paliers gagnés`}
        premiere={premiere}
      >
        <Chiffre valeur={gagnes} quoi={gagnes > 1 ? "Badges" : "Badge"} />
      </Rangee>
    ),
  });

  // 5. Mes cartes : une par saison, et les cartes spéciales.
  if (mesCartes.length > 0) {
    const speciales = mesCartes.reduce((n, s) => n + s.speciales.length, 0);
    const total = mesCartes.length + speciales;
    items.push({
      cle: "cartes",
      rendre: (premiere) => (
        <Rangee
          href="/profil/cartes"
          nom="Mes cartes"
          phrase={mesCartes.map((s) => `${s.nom} · ${s.note}`).join(", ")}
          detail={
            speciales > 0
              ? `${speciales} ${speciales > 1 ? "cartes spéciales" : "carte spéciale"}`
              : `${mesCartes.length} ${mesCartes.length > 1 ? "saisons" : "saison"}`
          }
          premiere={premiere}
        >
          <Chiffre valeur={total} quoi={total > 1 ? "Cartes" : "Carte"} />
        </Rangee>
      ),
    });
  }

  return (
    <nav aria-label="Ma carte en détail" className="glass flex flex-col overflow-hidden rounded-[26px]">
      {items.map((it, i) => (
        <div key={it.cle}>{it.rendre(i === 0)}</div>
      ))}
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
