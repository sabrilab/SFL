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
//     il y en a à signer, et sur elles par /profil/xp?vue=missions ;
//   · on sort par la croix, Échap, ou en tirant vers le bas : le noir se
//     referme sur la tuile.
// Toujours en noir, en clair comme en sombre : c'est un autre monde.
// « Réduire les animations » : on entre et on sort sans ouverture ni montée.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Check, Lock, X } from "lucide-react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Card3D } from "@/components/sfl/card-3d";
import { useMissionsASigner, VueMissions } from "@/components/sfl/mode-passe-missions";
import type { Finition } from "@/components/sfl/finitions-carte";
import { CADRAGES, ChoixPays, essai, etatDe, GENRE, Mini, useOntLePalier, type EtatPalier } from "@/components/sfl/passe-bola";
import { PlayerCard } from "@/components/sfl/player-card";
import { Plongee } from "@/components/sfl/plongee-carte";
import { COULEURS_PAYS, PAYS_PAR_DEFAUT } from "@/components/sfl/skins-passe";
import { finitionsDe, useChoixHabillage, useHabillage, usePalierMax } from "@/hooks/use-habillage";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRangXp, useXp } from "@/hooks/use-missions";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import type { Player } from "@/lib/sfl/engine";
import { choisirHabillage } from "@/lib/sfl/habillages-choisis";
import type { BilanXp } from "@/lib/sfl/missions";
import { epreuveDu, PALIERS_PASSE, PASSE_BOLA, seuilPalier, type PalierPasse } from "@/lib/sfl/passe";
import { cn } from "@/lib/utils";
import "./mode-passe.css";

const xp = (n: number) => `${n.toLocaleString("fr-FR")} XP`;
const ontLe = (n: number) => (n > 0 ? `${n} l'${n > 1 ? "ont" : "a"}` : "personne ne l'a");

export type Vue = "passe" | "missions";

/** Le pas d'un palier sur la route, en px (la largeur d'un arrêt). */
const PAS = 76;
/** L'ouverture du noir depuis la tuile, puis sa fermeture. */
const OUVERTURE = 560;
const FERMETURE = 380;
/** Tirer de plus que ça vers le bas referme. */
const TIRER = 110;

/** La carte au centre, à la mesure de l'écran (le reste tient autour). */
function tailleCarte(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(0.78, Math.min(1.3, (window.innerHeight - 476) / 330));
}

/** /profil/xp?vue=missions (la notification des Missions Bola) ouvre les Missions. */
function vueDeLAdresse(): Vue | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get("vue") === "missions" ? "missions" : null;
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
      aria-pressed={choisi}
      aria-label={`Palier ${p.n}, ${p.nom}`}
      className={cn("mp-arret", `fiche--${p.rang}`, `mp-arret--${etat}`, choisi && "mp-arret--choisi")}
      style={{ width: PAS }}
    >
      <span className="mp-arret__vignette">
        <Mini player={player} habillage={essai(porte, p)} cadrage={CADRAGES[p.n]} l={40} h={64} />
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

/** Les vingt paliers en file : celui qui passe au centre est choisi. */
function Route({
  player,
  palier,
  avance,
  palierMax,
  choisi,
  onChoisir,
}: {
  player: Player;
  palier: number;
  /** La part du palier suivant déjà faite, de 0 à 1. */
  avance: number;
  palierMax: number;
  choisi: number;
  onChoisir: (n: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const premier = useRef(true);

  // Le palier choisi vient au centre (sans glisser à l'ouverture).
  useEffect(() => {
    const r = ref.current;
    if (!r) return;
    const cible = (choisi - 1) * PAS;
    if (Math.abs(r.scrollLeft - cible) < 2) return;
    r.scrollTo({ left: cible, behavior: premier.current ? "instant" : "smooth" });
    premier.current = false;
  }, [choisi]);

  // En glissant, le palier au centre se choisit.
  const suivre = () => {
    const r = ref.current;
    if (!r) return;
    const n = Math.min(PALIERS_PASSE, Math.max(1, Math.round(r.scrollLeft / PAS) + 1));
    if (n !== choisi) onChoisir(n);
  };

  return (
    <div className="mp-route" role="group" aria-label="Les vingt paliers">
      <div ref={ref} onScroll={suivre} className="mp-route__piste">
        <div className="mp-route__rail" style={{ width: PALIERS_PASSE * PAS }}>
          <span className="mp-route__trait" />
          <span className="mp-route__fait" style={{ width: Math.min(PALIERS_PASSE - 1, Math.max(0, palier - 1 + avance)) * PAS }} />
          {PASSE_BOLA.map((x) => (
            <Arret
              key={x.n}
              p={x}
              etat={etatDe(x.n, palier, palierMax)}
              choisi={x.n === choisi}
              player={player}
              onChoisir={() => onChoisir(x.n)}
            />
          ))}
        </div>
      </div>
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
  const combien = useOntLePalier();
  const etat = etatDe(p.n, b.palier, palierMax);
  const ouvert = etat === "gagne" || etat === "acquis";
  const finition = p.habille?.finition as Finition | undefined;
  const aLeSkin = !!finition && (ouvert || finitionsDe(nom, palierMax).includes(finition));
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
        <p className="mp-palier__ligne">
          Épreuve {passe.bloquee.romain} · {passe.bloquee.phrase}
        </p>
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
  const palierMax = Math.max(usePalierMax(player.name), b?.palier ?? 0);
  const prochain = Math.min(PALIERS_PASSE, (b?.passe.palier ?? 0) + 1);
  const [choisi, setChoisi] = useState(prochain);
  const [pays, setPays] = useState(choix.pays ?? PAYS_PAR_DEFAUT);
  const [vue, setVue] = useState<Vue>(() => vueVoulue ?? vueDeLAdresse() ?? "passe");
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
      else if (e.key === "ArrowLeft") setChoisi((n) => Math.max(1, n - 1));
      else if (e.key === "ArrowRight") setChoisi((n) => Math.min(PALIERS_PASSE, n + 1));
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [sortir, plonge, vue]);

  const p = PASSE_BOLA[choisi - 1];
  const habillage = useMemo(() => essai(porte, p, pays), [porte, p, pays]);
  if (!pret || !b) return null;

  // Tirer vers le bas, depuis le haut ou le bas de l'écran (la carte, elle, tourne au doigt).
  const tirer = {
    onPointerDown: (e: React.PointerEvent) => {
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
          <span className="mono-label text-white/50">Passe Bola · Saison {saison}</span>
          <span className="flex items-baseline gap-1.5">
            <span className="tabular-nums" style={{ fontFamily: ANTON, fontSize: 54, lineHeight: 0.85 }}>
              {b.passe.palier}
            </span>
            <span className="font-mono text-[13px] font-bold text-white/45">/ {PALIERS_PASSE}</span>
          </span>
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

      <nav className="mp-vues mp-entre" style={{ "--i": 1 } as React.CSSProperties} aria-label="Passe ou missions">
        {(["passe", "missions"] as const).map((v) => (
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
            {v === "passe" ? "Passe" : "Missions"}
            {v === "missions" && aSigner > 0 && <span className="mp-vue__pastille tabular-nums">{aSigner}</span>}
          </button>
        ))}
      </nav>

      {vue === "passe" ? (
        <>
          <div className="mp-carte">
            <Card3D
              cacheKey={`mode-passe-${p.n}-${player.name}-${p.habille?.finition === "couleurs" ? pays : ""}`}
              size={taille}
              apercu
              render={(s) => <PlayerCard player={player} size={s} habillage={habillage} />}
            />
          </div>

          <div className="mp-bas mp-entre" style={{ "--i": 2 } as React.CSSProperties} {...tirer}>
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
              player={player}
              palier={b.passe.palier}
              avance={b.passe.bloquee ? 0 : b.passe.versPalier / Math.max(1, b.passe.coutPalier)}
              palierMax={palierMax}
              choisi={choisi}
              onChoisir={setChoisi}
            />
          </div>
        </>
      ) : (
        <div className="mp-defile mp-entre" style={{ "--i": 2 } as React.CSSProperties}>
          <VueMissions b={b} saison={saison} />
        </div>
      )}

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
