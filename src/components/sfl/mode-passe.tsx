"use client";

// Le mode Passe. Sabri, 24/10 : « il faudrait que, visuellement, on comprenne
// que là, on est dans quelque chose de différent en termes de gameplay ». Le
// Niveau XP de Ma carte (la tuile de ma-carte/rubriques.tsx) n'ouvre plus une
// page de plus : on quitte l'app.
//   · l'entrée : le noir s'ouvre depuis la tuile touchée jusqu'à tout l'écran,
//     la barre des onglets disparaît dessous ; la carte monte au centre, puis
//     le reste s'allume ;
//   · une scène, pas une page : ma carte en 3D, au centre, sous un projecteur,
//     porte la récompense du palier choisi (le prochain à l'ouverture) ;
//   · la passe en route : les vingt paliers en file, à l'horizontale, sous la
//     carte ; on la fait glisser, le palier qui passe au centre se choisit et
//     la carte le porte aussitôt. Le trait plein dit où j'en suis ;
//   · deux onglets en haut, comme un passe de combat : « Passe » (la scène
//     ci-dessus) et « Missions » (mode-passe-missions.tsx : les missions de
//     la journée, tout ce qui rapporte de l'XP, le journal). Sabri, 26/10 :
//     « là, je vois que les skins ». Le mode s'ouvre sur les Missions quand
//     il y en a à signer, et sur elles par /profil/xp?vue=missions ; un
//     troisième, « Les autres » (mode-passe-autres.tsx : l'outsider de
//     l'arc 1 et les missions acceptées de toute la ligue ; Sabri, 27/10 :
//     « pour qu'on puisse voir les missions et les missions des gens »),
//     par /profil/xp?vue=autres. Un joueur Bola, hors de la SFL, n'a pas
//     « Les autres » : ce sont les missions de la ligue du dimanche (28/10) ;
//   · un quatrième, « Packs » (mode-passe-packs.tsx, 01/11/2026) : le PACK
//     AFRIQUE 2027, payé en XP, par /profil/xp?vue=packs ;
//   · le compteur d'XP en tête (Ilyes, 01/11 : « je vois que je suis niveau
//     6, mais pas le nombre d'XP que j'ai gagné ») : compteur-xp.tsx ;
//   · la route se pilote à la souris, à la molette, au doigt et au clavier
//     d'un seul comportement (lib/sfl/route-passe.ts), avec précédent et
//     suivant à l'ordinateur ; un palier qu'on n'a pas se porte en aperçu,
//     et le dit ;
//   · on sort par la croix, Échap, ou en tirant vers le bas au doigt (jamais
//     depuis la route) : le noir se referme sur la tuile.
// Toujours en noir, en clair comme en sombre : c'est un autre monde.
// Ce qui défile porte overflow-y-auto / overflow-x-auto : le verrou du rebond
// d'iOS (pwa/viewport-lock.tsx) bloque tout autre glissé hors de #app-scroll,
// et le mode, posé dans body, en est hors (30/10 : « on ne peut pas scroller »).
// « Réduire les animations » : on entre et on sort sans ouverture ni montée.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Lock, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Card3D } from "@/components/sfl/card-3d";
import { useHorsDeLaSfl, useMissionsASigner, VueMissions } from "@/components/sfl/mode-passe-missions";
import { VueAutres } from "@/components/sfl/mode-passe-autres";
import type { Finition } from "@/components/sfl/finitions-carte";
import { cadrageDe, ChoixPays, essai, etatDe, GENRE, Mini, useOntLePalier, type EtatPalier } from "@/components/sfl/passe-bola";
import { PlayerCard } from "@/components/sfl/player-card";
import { Plongee } from "@/components/sfl/plongee-carte";
import { COULEURS_PAYS, PAYS_PAR_DEFAUT } from "@/components/sfl/skins-passe";
import { CompteurXp } from "@/components/sfl/compteur-xp";
import { VuePacks } from "@/components/sfl/mode-passe-packs";
import { useSoldeXp } from "@/hooks/use-achats-xp";
import { finitionsDe, useAfriqueCarte, useChoixHabillage, useHabillage, usePaliers } from "@/hooks/use-habillage";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRangXp, useXp, useXpLigue } from "@/hooks/use-missions";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import type { Player } from "@/lib/sfl/engine";
import { choisirHabillage } from "@/lib/sfl/habillages-choisis";
import type { BilanXp } from "@/lib/sfl/missions";
import { epreuveDu, seuilPalier, type PalierPasse } from "@/lib/sfl/passe";
import { packOuvert } from "@/lib/sfl/pack-afrique";
import { saisonPasseSuivante, type SaisonPasse } from "@/lib/sfl/saisons-passe";
import {
  borner,
  CALME,
  estUnClic,
  FIN_DU_PILOTAGE,
  molette,
  PAS_ROUTE,
  palierAuCentre,
  piloter,
  piloteExpire,
  positionDe,
  sansPilote,
  surDefilement,
  surMolette,
  toucheRoute,
  type Pilote,
} from "@/lib/sfl/route-passe";
import { cn } from "@/lib/utils";
import "./mode-passe.css";

const xp = (n: number) => `${n.toLocaleString("fr-FR")} XP`;
const ontLe = (n: number) => (n > 0 ? `${n} l'${n > 1 ? "ont" : "a"}` : "personne ne l'a");

export type Vue = "passe" | "missions" | "autres" | "packs";
const VUES: Vue[] = ["passe", "missions", "autres", "packs"];
const NOM_VUE: Record<Vue, string> = { passe: "Passe", missions: "Missions", autres: "Les autres", packs: "Packs" };

/** Le pas d'un palier sur la route, en px (la largeur d'un arrêt). */
const PAS = PAS_ROUTE;
/** L'ouverture du noir depuis la tuile, puis sa fermeture. */
const OUVERTURE = 560;
const FERMETURE = 380;
/** Tirer de plus que ça vers le bas referme. */
const TIRER = 110;

/** La carte au centre, à la mesure de l'écran (le reste tient autour). */
function tailleCarte(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(0.74, Math.min(1.3, (window.innerHeight - 512) / 330));
}

/** /profil/xp?vue=missions (la notification des Missions Bola) ouvre les Missions ; ?vue=autres, Les autres (celle de l'outsider). */
function vueDeLAdresse(): Vue | null {
  if (typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("vue");
  return v === "missions" || v === "autres" || v === "packs" ? v : null;
}

/* --------------------- D'où l'on entre (la tuile touchée) --------------------- */

let origine: { x: number; y: number } | null = null;

/** La tuile touchée retient son centre : le noir s'ouvre de là, et s'y referme. */
export function retenirOrigineModePasse(el: HTMLElement | null) {
  const r = el?.getBoundingClientRect();
  origine = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
}

/* ------------------------------- La route ------------------------------- */

function Arret({
  p,
  etat,
  choisi,
  player,
  onChoisir,
}: {
  p: PalierPasse;
  etat: EtatPalier;
  choisi: boolean;
  player: Player;
  onChoisir: () => void;
}) {
  const porte = useHabillage(player.name);
  return (
    <button
      type="button"
      data-n={p.n}
      onClick={onChoisir}
      aria-current={choisi ? "step" : undefined}
      aria-label={`Palier ${p.n}, ${p.nom}${etat === "verrou" ? ", verrouillé" : ""}`}
      className={cn("mp-arret", `fiche--${p.rang}`, `mp-arret--${etat}`, choisi && "mp-arret--choisi")}
      data-etat={etat}
      style={{ width: PAS }}
    >
      <span className="mp-arret__vignette">
        <Mini player={player} habillage={essai(porte, p)} cadrage={cadrageDe(p)} l={40} h={64} />
        {etat === "verrou" && (
          <span className="mp-arret__cadenas">
            <Lock className="size-2.5" strokeWidth={2.8} />
          </span>
        )}
      </span>
      <span className="mp-arret__point" />
      <span className="mp-arret__numero tabular-nums">{p.n}</span>
    </button>
  );
}

/**
 * Les paliers en file : celui qui passe au centre est choisi. Un seul
 * comportement pour la souris, la molette, le glissé, le doigt et le clavier
 * (lib/sfl/route-passe.ts) : quand l'app pilote le défilement, le défilement
 * ne choisit rien ; quand on glisse, le palier du centre se choisit une fois
 * le geste calmé. À l'ordinateur, deux boutons aux bouts de la route.
 */
function Route({
  piste,
  player,
  palier,
  avance,
  palierMax,
  choisi,
  onChoisir,
  reduit,
}: {
  /** Les paliers de la saison du Passe en cours. */
  piste: readonly PalierPasse[];
  player: Player;
  palier: number;
  /** La part du palier suivant déjà faite, de 0 à 1. */
  avance: number;
  palierMax: number;
  choisi: number;
  onChoisir: (n: number) => void;
  reduit: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const premier = useRef(true);
  const pilote = useRef<Pilote>(sansPilote());
  const parGlisse = useRef(false);
  const calme = useRef<number | undefined>(undefined);
  const lacher = useRef<number | undefined>(undefined);
  const saisie = useRef<{ x: number; y: number; depart: number; id: number; bouge: boolean } | null>(null);
  const sansClic = useRef(false);
  const [saisi, setSaisi] = useState(false);
  const n = piste.length;
  // Les gestes lisent le palier choisi au moment où ils arrivent.
  const choisiRef = useRef(choisi);
  useEffect(() => {
    choisiRef.current = choisi;
  }, [choisi]);

  /** L'app amène la piste sur le palier `cible` : rien d'autre ne choisit en chemin. */
  const amener = useCallback(
    (cible: number) => {
      const r = ref.current;
      if (!r) return;
      const left = positionDe(cible);
      if (Math.abs(r.scrollLeft - left) < 2) {
        pilote.current = sansPilote();
        return;
      }
      pilote.current = piloter(pilote.current, cible, performance.now());
      r.scrollTo({ left, behavior: premier.current || reduit ? "instant" : "smooth" });
      window.clearTimeout(lacher.current);
      lacher.current = window.setTimeout(function attendre() {
        const p = piloteExpire(pilote.current, performance.now());
        pilote.current = p;
        if (p.cible !== null) lacher.current = window.setTimeout(attendre, 120);
      }, FIN_DU_PILOTAGE);
    },
    [reduit]
  );

  // Le palier choisi vient au centre (sans glisser à l'ouverture), sauf s'il vient d'un glissé.
  useEffect(() => {
    const glisse = parGlisse.current;
    parGlisse.current = false;
    if (!glisse) amener(choisi);
    premier.current = false;
  }, [choisi, amener]);

  useEffect(
    () => () => {
      window.clearTimeout(calme.current);
      window.clearTimeout(lacher.current);
    },
    []
  );

  /** Un choix de l'app (clic, bouton, molette) : la piste suit, même si le palier ne change pas. */
  const choisir = useCallback(
    (cible: number) => {
      const c = borner(cible, n);
      if (c === choisiRef.current) amener(c);
      else onChoisir(c);
    },
    [n, onChoisir, amener]
  );

  // Au doigt ou au trackpad : le palier du centre, une fois le geste calmé.
  const surScroll = () => {
    const r = ref.current;
    if (!r) return;
    const { pilote: p, choisit } = surDefilement(pilote.current, r.scrollLeft, performance.now());
    pilote.current = p;
    if (!choisit || saisie.current) return;
    window.clearTimeout(calme.current);
    calme.current = window.setTimeout(() => {
      const c = palierAuCentre(r.scrollLeft, n);
      if (c !== choisiRef.current) {
        parGlisse.current = true;
        onChoisir(c);
      }
    }, CALME);
  };

  // La molette verticale avance d'un palier par geste ; la page ne défile pas.
  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    let m = molette();
    const surRoue = (e: WheelEvent) => {
      const x = surMolette(m, e.deltaX, e.deltaY, performance.now());
      m = x.molette;
      if (!x.pris) return;
      e.preventDefault();
      if (x.pas) choisir(choisiRef.current + x.pas);
    };
    r.addEventListener("wheel", surRoue, { passive: false });
    return () => r.removeEventListener("wheel", surRoue);
  }, [choisir]);

  // Glisser à la souris : la piste suit la main, l'aimant coupé ; au relâcher, le palier le plus proche.
  const souris = {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !ref.current) return;
      saisie.current = { x: e.clientX, y: e.clientY, depart: ref.current.scrollLeft, id: e.pointerId, bouge: false };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = saisie.current;
      const r = ref.current;
      if (!s || !r || s.id !== e.pointerId) return;
      const dx = e.clientX - s.x;
      if (!s.bouge && estUnClic(dx, e.clientY - s.y)) return;
      if (!s.bouge) {
        s.bouge = true;
        pilote.current = sansPilote();
        setSaisi(true);
        r.setPointerCapture?.(e.pointerId);
      }
      r.scrollLeft = s.depart - dx;
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      const s = saisie.current;
      saisie.current = null;
      const r = ref.current;
      if (!s || !r || s.id !== e.pointerId || !s.bouge) return;
      setSaisi(false);
      sansClic.current = true;
      window.setTimeout(() => (sansClic.current = false), 0);
      choisir(palierAuCentre(r.scrollLeft, n));
    },
    onPointerCancel: () => {
      saisie.current = null;
      setSaisi(false);
    },
    // Un glissé n'est pas un clic sur le palier où il finit.
    onClickCapture: (e: React.MouseEvent) => {
      if (!sansClic.current) return;
      e.preventDefault();
      e.stopPropagation();
    },
  };

  return (
    <div className="mp-route" role="group" aria-label={`Les ${n} paliers`}>
      <button type="button" className="mp-route__fleche mp-route__fleche--avant" aria-label="Palier précédent" disabled={choisi <= 1} onClick={() => choisir(choisi - 1)}>
        <ChevronLeft className="size-5" strokeWidth={2.2} />
      </button>
      <div ref={ref} onScroll={surScroll} {...souris} className={cn("mp-route__piste overflow-x-auto", saisi && "mp-route__piste--saisie")}>
        <div className="mp-route__rail" style={{ width: n * PAS }}>
          <span className="mp-route__trait" />
          <span className="mp-route__fait" style={{ width: Math.min(n - 1, Math.max(0, palier - 1 + avance)) * PAS }} />
          {piste.map((x) => (
            <Arret
              key={x.n}
              p={x}
              etat={etatDe(x.n, palier, palierMax)}
              choisi={x.n === choisi}
              player={player}
              onChoisir={() => choisir(x.n)}
            />
          ))}
        </div>
      </div>
      <button type="button" className="mp-route__fleche mp-route__fleche--apres" aria-label="Palier suivant" disabled={choisi >= n} onClick={() => choisir(choisi + 1)}>
        <ChevronRight className="size-5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

/* ------------------------- Ce que dit le palier choisi ------------------------- */

function Palier({ p, player, b, palierMax, pays, setPays, onPlonger }: {
  p: PalierPasse;
  player: Player;
  b: BilanXp;
  palierMax: number;
  pays: string;
  setPays: (p: string) => void;
  onPlonger: () => void;
}) {
  const nom = player.name;
  const porte = useHabillage(nom);
  const choix = useChoixHabillage(nom);
  const combien = useOntLePalier(b.saisonPasse.id);
  const paliers = usePaliers(nom);
  const etat = etatDe(p.n, b.palier, palierMax);
  const ouvert = etat === "gagne" || etat === "acquis";
  const finition = p.habille?.finition as Finition | undefined;
  const aLeSkin = !!finition && (ouvert || finitionsDe(nom, paliers).includes(finition));
  const portee = !!finition && porte.finition === finition && (finition !== "couleurs" || porte.pays === pays);
  const { passe } = b;

  let action: React.ReactNode = null;
  if (finition && aLeSkin)
    action = portee ? (
      <button type="button" onClick={() => void choisirHabillage(nom, { ...choix, finition: "-" })} className="mp-bouton mp-bouton--creux">
        Retirer
      </button>
    ) : (
      <button
        type="button"
        onClick={() => void choisirHabillage(nom, { ...choix, finition, pays: finition === "couleurs" ? pays : choix.pays })}
        className="mp-bouton"
      >
        Porter{finition === "couleurs" ? ` · ${COULEURS_PAYS[pays]?.nom ?? ""}` : ""}
      </button>
    );
  else if (p.genre === "sequence")
    action = (
      <button type="button" onClick={onPlonger} className={cn("mp-bouton", !ouvert && "mp-bouton--creux")}>
        {ouvert ? "Plonger dans ta carte" : "Aperçu de la séquence"}
      </button>
    );

  return (
    <div className={cn("mp-palier", `fiche--${p.rang}`)} aria-live="polite">
      <div className="flex items-center justify-center gap-2">
        <span className="mono-label text-white/55">
          Palier {p.n} · {GENRE[p.genre]}
        </span>
        <span className="mp-palier__rang">{p.rang}</span>
      </div>
      <h2 className="mp-palier__nom titre-lettrage">{p.nom}</h2>

      {etat === "prochain" && !passe.bloquee ? (
        <div className="mp-palier__jauge">
          <div className="passe__barre">
            <span style={{ width: `${(passe.versPalier / Math.max(1, passe.coutPalier)) * 100}%` }} />
          </div>
          <span className="font-mono text-[11px] text-white/60 tabular-nums">encore {xp(passe.manque)}</span>
        </div>
      ) : etat === "prochain" && passe.bloquee ? (
        <>
          <p className="mp-palier__ligne">
            Épreuve {passe.bloquee.romain} · {passe.bloquee.phrase}
          </p>
          <span className="font-mono text-[11px] text-white/60 tabular-nums">
            {passe.xp.toLocaleString("fr-FR")} / {xp(seuilPalier(p.n))}
          </span>
        </>
      ) : ouvert ? (
        <p className="mp-palier__ligne mp-palier__ligne--a-toi">
          <Check className="size-3.5" strokeWidth={3} /> {etat === "acquis" ? "Acquis" : "Gagné"} · {ontLe(combien(p.n))}
        </p>
      ) : (
        <p className="mp-palier__ligne">
          <Lock className="size-3" strokeWidth={2.6} /> {xp(seuilPalier(p.n))}
          {epreuveDu(p.n) ? " + une épreuve" : ""} · {ontLe(combien(p.n))}
        </p>
      )}

      {finition === "couleurs" && <ChoixPays pays={pays} onChoisir={setPays} />}
      {action && <div className="mp-palier__action">{action}</div>}
    </div>
  );
}

/* ------------------------- La saison qui vient ------------------------- */

/** Les deux semaines avant la saison suivante : sa devise et son jour (Sabri, 30/10 : « dès que c'est l'hiver »). */
const ANNONCE_JOURS = 14;

function Annonce({ maintenant }: { maintenant: Date }) {
  const suivante = saisonPasseSuivante(maintenant);
  if (!suivante?.debut || !suivante.devise) return null;
  const debut = new Date(`${suivante.debut}T12:00:00`);
  const jours = Math.ceil((debut.getTime() - maintenant.getTime()) / 86_400_000);
  if (jours > ANNONCE_JOURS) return null;
  const quand = debut.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return (
    <p className="mp-annonce">
      <span className="mp-annonce__devise titre-lettrage">{suivante.devise}.</span>
      <span className="mono-label text-white/55">
        {suivante.nom} · {quand}
      </span>
    </p>
  );
}

/**
 * Une saison qui vient de s'ouvrir se dévoile, une fois par téléphone (Sabri,
 * 30/10 : les saisons ne se montrent pas avant, elles se débloquent).
 */
function Debloquee({ saison }: { saison: SaisonPasse }) {
  const cle = `bola-saison-passe-vue-${saison.id}`;
  const [ouverte, setOuverte] = useState(() => {
    if (!saison.debut) return false;
    try {
      return !localStorage.getItem(cle);
    } catch {
      return false;
    }
  });
  if (!ouverte) return null;
  const fermer = () => {
    try {
      localStorage.setItem(cle, String(Date.now()));
    } catch {}
    setOuverte(false);
  };
  return (
    <div className="mp-debloquee" role="dialog" aria-label={`${saison.nom} débloquée`}>
      <span className="mono-label text-white/55">Débloquée</span>
      <h2 className="mp-debloquee__nom titre-lettrage">{saison.nom}</h2>
      {saison.devise && <p className="mp-debloquee__devise">{saison.devise}.</p>}
      <span className="mono-label text-white/45">{saison.paliers.length} paliers · jusqu&apos;au {new Date(`${saison.fin}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
      <button type="button" onClick={fermer} className="mp-bouton">
        Voir la saison
      </button>
    </div>
  );
}

/* ------------------------------- Le mode ------------------------------- */

/**
 * Le mode, posé sur Ma carte. `onSortie` : ouvert par-dessus Ma carte, il s'y
 * referme ; sans lui (la page /profil/xp ouverte directement), il ramène à Ma carte.
 */
export function ModePasse({
  player,
  saison,
  onSortie,
  vue: vueVoulue,
}: {
  player: Player;
  saison: number;
  onSortie?: () => void;
  /** L'onglet d'ouverture ; sinon les Missions s'il y en a à signer, sinon la Passe. */
  vue?: Vue;
}) {
  const router = useRouter();
  const reduit = useMediaQuery("(prefers-reduced-motion: reduce)");
  const b = useXp(player.name);
  const r = useRangXp(player.name);
  const aSigner = useMissionsASigner();
  const porte = useHabillage(player.name);
  const choix = useChoixHabillage(player.name);
  const photo = usePlayerPhoto(player.name);
  // La saison du Passe en cours et sa piste (saisons-passe.ts) ; un palier atteint y reste.
  const piste = b?.saisonPasse.paliers ?? [];
  const PALIERS_PASSE = Math.max(1, piste.length);
  const palierMax = b?.palier ?? 0;
  // Le palier atteint : au moins celui que le serveur a gardé (b.palier, lib/sfl/xp-acquis.ts).
  const prochain = Math.min(PALIERS_PASSE, Math.max(b?.palier ?? 0, b?.passe.palier ?? 0) + 1);
  const [choisi, setChoisi] = useState(prochain);
  const choisiRef = useRef(choisi);
  useEffect(() => {
    choisiRef.current = choisi;
  }, [choisi]);
  // L'XP arrive parfois après l'ouverture (les réponses aux missions) : tant qu'on n'a rien touché, la route suit le prochain palier.
  const routeTouchee = useRef(false);
  useEffect(() => {
    if (!routeTouchee.current) setChoisi(prochain);
  }, [prochain]);
  const [pays, setPays] = useState(choix.pays ?? PAYS_PAR_DEFAUT);
  const horsSfl = useHorsDeLaSfl();
  const lg = useXpLigue();
  const vitrine = !!lg?.vitrine && lg.vitrine === player.name;
  const afrique = useAfriqueCarte(player.name);
  const solde = useSoldeXp(player.name);
  // Les Packs (PACK AFRIQUE 2027) : quand le pack est ouvert, ou pour qui en a déjà, ou pour la vitrine (un aperçu).
  const avecPacks = packOuvert() || afrique.length > 0 || vitrine;
  const vues = VUES.filter((v) => (v !== "autres" || !horsSfl) && (v !== "packs" || avecPacks));
  const [vueChoisie, setVue] = useState<Vue>(() => vueVoulue ?? vueDeLAdresse() ?? "passe");
  const vue: Vue = vues.includes(vueChoisie) ? vueChoisie : "passe";
  // Des missions à signer (connues un instant après l'ouverture) : on s'ouvre sur elles, tant qu'on n'a rien touché.
  const vueTouchee = useRef(!!vueVoulue || !!vueDeLAdresse());
  useEffect(() => {
    if (!vueTouchee.current && aSigner > 0) {
      vueTouchee.current = true;
      setVue("missions");
    }
  }, [aSigner]);
  const [plonge, setPlonge] = useState(false);
  const [sortie, setSortie] = useState(false);
  const [monte, setMonte] = useState(false);
  const scene = useRef<HTMLDivElement>(null);
  const tire = useRef<{ y: number; id: number } | null>(null);
  const [depart] = useState(() => {
    const o = origine;
    origine = null;
    return o;
  });
  // Le portail attend le navigateur ; la taille de la carte suit l'écran.
  const pret = useIsClient();
  const [taille, setTaille] = useState(tailleCarte);
  useEffect(() => {
    const regler = () => setTaille(tailleCarte());
    window.addEventListener("resize", regler);
    return () => window.removeEventListener("resize", regler);
  }, []);

  // L'ouverture : le noir part de la tuile et prend l'écran.
  useEffect(() => {
    const el = scene.current;
    if (!pret || !el || reduit) return;
    const x = depart?.x ?? window.innerWidth / 2;
    const y = depart?.y ?? window.innerHeight / 2;
    const a = el.animate(
      [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${Math.hypot(window.innerWidth, window.innerHeight)}px at ${x}px ${y}px)` }],
      { duration: OUVERTURE, easing: "cubic-bezier(0.7, 0, 0.2, 1)" }
    );
    const id = window.setTimeout(() => setMonte(true), OUVERTURE * 0.55);
    navigator.vibrate?.(10);
    return () => {
      a.cancel();
      window.clearTimeout(id);
    };
  }, [pret, reduit, depart]);

  const sortir = useCallback(() => {
    if (sortie) return;
    setSortie(true);
    const el = scene.current;
    const revenir = () => (onSortie ? onSortie() : router.replace("/profil"));
    if (!el || reduit) return revenir();
    const x = depart?.x ?? window.innerWidth / 2;
    const y = depart?.y ?? window.innerHeight / 2;
    const a = el.animate(
      [{ clipPath: `circle(${Math.hypot(window.innerWidth, window.innerHeight)}px at ${x}px ${y}px)` }, { clipPath: `circle(0px at ${x}px ${y}px)` }],
      { duration: FERMETURE, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" }
    );
    a.onfinish = revenir;
  }, [sortie, reduit, depart, router, onSortie]);

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !plonge) sortir();
      else if (vue !== "passe") return;
      else {
        const vers = toucheRoute(e.key, choisiRef.current, PALIERS_PASSE);
        if (vers === null || (e.target as HTMLElement | null)?.closest?.("input, textarea")) return;
        e.preventDefault();
        routeTouchee.current = true;
        setChoisi(vers);
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [sortir, plonge, vue, PALIERS_PASSE]);


  const p = piste[Math.min(choisi, PALIERS_PASSE) - 1] ?? piste[0];
  // Un palier qu'on n'a pas : la carte le porte en aperçu, et le dit.
  const etatChoisi = p && b ? etatDe(p.n, b.passe.palier, palierMax) : "gagne";
  const apercu = etatChoisi === "verrou" || etatChoisi === "prochain";
  const habillage = useMemo(() => (p ? essai(porte, p, pays) : porte), [porte, p, pays]);
  if (!pret || !b || !p) return null;

  // Tirer vers le bas, depuis le haut ou le bas de l'écran (la carte, elle, tourne au doigt).
  const tirer = {
    onPointerDown: (e: React.PointerEvent) => {
      // Au doigt seulement, et jamais depuis la route (elle glisse) : à l'ordinateur, Échap ou la croix.
      if (e.pointerType === "mouse" || (e.target as HTMLElement).closest(".mp-route")) return;
      tire.current = { y: e.clientY, id: e.pointerId };
    },
    onPointerUp: (e: React.PointerEvent) => {
      const t = tire.current;
      tire.current = null;
      if (t && t.id === e.pointerId && e.clientY - t.y > TIRER) sortir();
    },
    onPointerCancel: () => {
      tire.current = null;
    },
  };

  return createPortal(
    <div
      ref={scene}
      role="dialog"
      aria-modal
      aria-label="Passe Bola"
      className={cn("mode-passe dark", `fiche--${p.rang}`, (monte || reduit) && "mode-passe--monte", sortie && "mode-passe--sortie")}
    >
      <div aria-hidden className="mp-ciel" />
      <div aria-hidden className="mp-projecteur" />
      <div aria-hidden className="mp-sol" />

      <header className="mp-hud mp-entre" style={{ "--i": 1 } as React.CSSProperties} {...tirer}>
        <div className="flex flex-col gap-1">
          <span className="mono-label text-white/50">
            {`Passe Bola · ${b.saisonPasse.nom}`}
            {vitrine && <span className="mp-vitrine">vitrine</span>}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 54, lineHeight: 0.85 }}>
              {Math.max(b.palier, b.passe.palier)}
            </span>
            <span className="font-mono text-[13px] font-bold text-white/45">/ {PALIERS_PASSE}</span>
          </span>
          <span className="mono-label tabular-nums text-white/55">{`${b.saisonPasse.nom} · ${xp(b.saison)}`}</span>
        </div>
        <div className="flex items-start gap-2.5">
          <span className={cn("mp-niveau", `fiche--${r?.rang ?? "B"}`)} aria-label={`Niveau XP ${b.niveau}`}>
            <span className="mono-label text-white/50">Niv.</span>
            <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 22, lineHeight: 1 }}>
              {b.niveau}
            </span>
            {r && r.xp > 0 && <span className="mp-palier__rang">{r.rang}</span>}
          </span>
          <button type="button" onClick={sortir} aria-label="Quitter la passe" className="mp-rond">
            <X className="size-4" strokeWidth={2.4} />
          </button>
        </div>
      </header>

      <div className="mp-compteur mp-entre" style={{ "--i": 1 } as React.CSSProperties}>
        <CompteurXp
          b={b}
          solde={vitrine ? null : solde}
          onSolde={avecPacks ? () => {
            vueTouchee.current = true;
            setVue("packs");
          } : undefined}
          className="text-white/70"
        />
      </div>

      <nav className={cn("mp-vues mp-entre", vues.length > 3 && "mp-vues--quatre")} style={{ "--i": 1 } as React.CSSProperties} aria-label={vues.map((v) => NOM_VUE[v]).join(", ")}>
        {vues.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vue === v}
            onClick={() => {
              if (v !== vue) navigator.vibrate?.(6);
              vueTouchee.current = true;
              setVue(v);
            }}
            className={cn("mp-vue", vue === v && "mp-vue--active")}
          >
            {NOM_VUE[v]}
            {v === "missions" && aSigner > 0 && <span className="mp-vue__pastille tabular-nums">{aSigner}</span>}
          </button>
        ))}
      </nav>

      {vue === "passe" ? (
        <>
          <div className={cn("mp-carte", apercu && "mp-carte--apercu")}>
            {apercu && (
              <span className="mp-apercu mono-label">
                <Lock className="size-2.5" strokeWidth={2.8} /> Aperçu
              </span>
            )}
            <Card3D
              cacheKey={`mode-passe-${p.n}-${player.name}-${p.habille?.finition === "couleurs" ? pays : ""}`}
              size={taille}
              apercu
              render={(s) => <PlayerCard player={player} size={s} habillage={habillage} />}
            />
          </div>

          <div className="mp-bas mp-entre" style={{ "--i": 2 } as React.CSSProperties} {...tirer}>
            <Annonce maintenant={new Date()} />
            <Palier
              key={p.n}
              p={p}
              player={player}
              b={b}
              palierMax={palierMax}
              pays={pays}
              setPays={setPays}
              onPlonger={() => setPlonge(true)}
            />
            <Route
              piste={piste}
              player={player}
              palier={b.passe.palier}
              avance={b.passe.bloquee ? 0 : b.passe.versPalier / Math.max(1, b.passe.coutPalier)}
              palierMax={palierMax}
              choisi={choisi}
              onChoisir={(n) => {
                routeTouchee.current = true;
                setChoisi(n);
              }}
              reduit={reduit}
            />
          </div>
        </>
      ) : (
        <div key={vue} className="mp-defile overflow-y-auto mp-entre" style={{ "--i": 2 } as React.CSSProperties}>
          {vue === "missions" ? (
            <VueMissions b={b} saison={saison} nom={player.name} />
          ) : vue === "packs" ? (
            <VuePacks player={player} vitrine={vitrine} />
          ) : (
            <VueAutres />
          )}
        </div>
      )}

      <Debloquee saison={b.saisonPasse} />

      {plonge && (
        <Plongee
          carte={<PlayerCard player={player} size={taille} habillage={porte} />}
          photo={photo}
          theme={p.n === 19 ? "ombre" : "transformation"}
          onFin={() => setPlonge(false)}
        />
      )}
    </div>,
    document.body
  );
}
