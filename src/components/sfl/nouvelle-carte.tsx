"use client";

// La cérémonie des nouvelles cartes — à l'ouverture de l'app.
//
// Quand l'admin met une journée à jour et qu'une carte t'est attribuée (MVP,
// Impact, Défensive), tu la découvres à ta prochaine ouverture : l'app se
// voile, ta carte arrive dos tourné, tu touches — son + retournement + halo à
// la couleur du titre. Plusieurs cartes ? Elles s'égrènent une à une.
//
// Le déjà-vu est mémorisé PAR JOUEUR (localStorage) : à la toute première
// visite, l'historique est marqué comme vu en silence — la cérémonie est
// réservée aux cartes qui arrivent APRÈS, jamais à la reprise d'historique.
// Fermer l'app au milieu ne perd rien : les cartes non révélées reviennent.
//
// Jamais en plein direct (Sabri, 25/10) : la cérémonie ne part qu'à
// l'ouverture ou au retour dans l'app (useMomentAnnonce), jamais dans
// l'admin, et une carte déjà vue ne revient pas quand sa note bouge pendant
// qu'on saisit le match : elle est reconnue à son titre et à sa date.
//
// La révélation du dimanche (02/11/2026, revelation.ts) : avant les cartes,
// ta division passe de l'ancienne à la nouvelle, sur son métal — « Tu montes
// en D2 », « Tu descends en D3 », « Tu restes en D1 ». Une fois par joueur,
// par journée et par appareil ; seulement une journée comptée (votes
// chargés), jamais dans l'admin.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { PastilleDivision } from "@/components/sfl/metal-division";
import { dernierBilan, phraseBilan, type Division, type EtatDivisions } from "@/lib/sfl/divisions";
import { isHidden } from "@/lib/sfl/hidden";
import { BoostCard, BOOST_LABELS } from "@/components/sfl/boost-card";
import { Card3D } from "@/components/sfl/card-3d";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import { useMomentAnnonce } from "@/hooks/use-moment-annonce";
import { sonRevelation } from "@/lib/sfl/son";
import type { BoostCardData } from "@/lib/sfl/engine";

const GLOW: Record<string, string> = {
  def: "rgba(127,212,255,.75)",
  impact: "rgba(255,90,31,.75)",
  mvp: "rgba(244,197,66,.85)",
};

/** Identité stable d'une carte reçue — le joueur est déjà fixé par la clé. */
const carteKey = (c: BoostCardData) => `${c.type}|${c.date}|${c.ovr}`;
/** La même carte, quelle que soit sa note : le titre et la date (« mvp|J3 · 25/10 »). */
const titreDate = (cle: string) => cle.split("|").slice(0, 2).join("|");

const vuKey = (me: string) => `sfl-cartes-vues-${me}`;

/** Le bilan des divisions d'une journée, vu sur cet appareil (sur le modèle de divisions-annonce.ts). */
const bilanKey = (saison: number, j: number, me: string) => `sfl-bilan-divisions-s${saison}-j${j}-${me}`;
function bilanVu(cle: string): boolean {
  try {
    return localStorage.getItem(cle) !== null;
  } catch {
    return true;
  }
}
function noterBilanVu(cle: string) {
  try {
    localStorage.setItem(cle, String(Date.now()));
  } catch {
    /* stockage interdit : rien à retenir */
  }
}

interface BilanAMontrer {
  cle: string;
  j: number;
  de: Division;
  vers: Division;
  phrase: string;
}

/** Le bilan de la dernière journée comptée pour moi, s'il n'est pas encore vu ; null sinon. */
function bilanAMontrer(etat: EtatDivisions | null, comptees: Set<number>, numero: number, me: string): BilanAMontrer | null {
  if (!etat || isHidden(me)) return null;
  const b = dernierBilan(etat);
  if (!b || !comptees.has(b.j)) return null;
  const m = b.parNom.get(me);
  const phrase = phraseBilan(etat, b, me);
  if (!m || !phrase) return null;
  const cle = bilanKey(numero, b.j, me);
  return bilanVu(cle) ? null : { cle, j: b.j, de: m.de, vers: m.vers, phrase };
}

export function NouvellesCartes() {
  const { me } = useMyPlayer();
  const { boostCards, divisions, revelation, saison } = useSeason();
  const connecte = !!useSession();
  const calme = useReducedMotion();
  const moment = useMomentAnnonce();
  const traite = useRef("");
  // Les cartes du moment, lues par l'effet sans le relancer : une saisie en
  // direct ne doit ni ouvrir la cérémonie, ni annuler celle qui s'apprête.
  const cartes = useRef(boostCards);
  const ligue = useRef({ divisions, comptees: revelation.comptees, numero: saison.numero ?? 0 });
  useEffect(() => {
    cartes.current = boostCards;
    ligue.current = { divisions, comptees: revelation.comptees, numero: saison.numero ?? 0 };
  }, [boostCards, divisions, revelation.comptees, saison.numero]);
  /** Le premier temps de la cérémonie : ta division, avant tes cartes. */
  const [bilan, setBilan] = useState<BilanAMontrer | null>(null);
  const [arrivee, setArrivee] = useState(false);

  const [queue, setQueue] = useState<BoostCardData[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // Pas de session : on est sur l'écran de connexion, pas de cérémonie.
    if (!connecte) return;
    // Hors des moments d'annonce, la saison qui bouge (le direct) n'ouvre rien.
    const cle = `${moment}|${me}`;
    if (moment === 0 || cle === traite.current) return;
    traite.current = cle;
    const division = bilanAMontrer(ligue.current.divisions, ligue.current.comptees, ligue.current.numero, me);
    const mine = cartes.current.filter((c) => c.player === me);
    const keys = mine.map(carteKey);
    const raw = localStorage.getItem(vuKey(me));

    // Première visite de ce joueur : tout l'historique est « vu », en silence.
    let fresh: BoostCardData[] = [];
    if (raw === null) {
      localStorage.setItem(vuKey(me), JSON.stringify(keys));
    } else {
      let seen: string[];
      try {
        const parsed: unknown = JSON.parse(raw);
        // Un stockage abîmé ne doit pas faire tomber l'écran : sans tableau,
        // on repart d'une liste vide plutôt que de laisser `new Set` échouer.
        seen = Array.isArray(parsed) ? parsed : [];
      } catch {
        seen = [];
      }
      const seenSet = new Set(seen.map(titreDate));
      fresh = mine.filter((c) => !seenSet.has(titreDate(carteKey(c))));
    }
    if (fresh.length === 0 && !division) return;

    // Un temps de respiration après le splash d'ouverture, puis la cérémonie.
    const timer = setTimeout(() => {
      setBilan(division);
      setArrivee(false);
      setQueue(fresh.length ? fresh : null);
      setIndex(0);
      setRevealed(false);
    }, 1400);
    return () => clearTimeout(timer);
  }, [connecte, me, moment]);

  // La division arrive d'abord, sur son ancien métal, puis passe au nouveau.
  useEffect(() => {
    if (!bilan) return;
    const id = window.setTimeout(() => setArrivee(true), calme ? 0 : 900);
    return () => window.clearTimeout(id);
  }, [bilan, calme]);

  if (bilan) {
    const fermer = () => {
      noterBilanVu(bilan.cle);
      setBilan(null);
    };
    const affichee = arrivee ? bilan.vers : bilan.de;
    return (
      <AnimatePresence>
        <motion.div
          key="bilan-divisions"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="dark fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/92 px-6 text-foreground backdrop-blur-sm"
        >
          <button type="button" onClick={fermer} className="flex flex-col items-center gap-6" aria-label="Continuer">
            <span className="rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-black tracking-[0.3em] text-white uppercase">
              Les divisions · J{bilan.j}
            </span>
            <AnimatePresence mode="wait">
              <motion.span
                key={affichee}
                initial={calme ? false : { scale: 0.6, opacity: 0, rotateX: -70 }}
                animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                exit={calme ? { opacity: 0 } : { scale: 0.8, opacity: 0, rotateX: 70 }}
                transition={{ duration: calme ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <PastilleDivision x={affichee} className="h-[88px] min-w-[128px] rounded-[22px] px-5 text-[56px]" />
              </motion.span>
            </AnimatePresence>
            <motion.span
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: arrivee ? 1 : 0, y: arrivee ? 0 : 8 }}
              transition={{ duration: calme ? 0 : 0.35 }}
              className="max-w-[300px] text-center text-[17px] font-bold text-white"
            >
              {bilan.phrase}.
            </motion.span>
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (!queue || queue.length === 0) return null;
  const current = queue[index];
  if (!current) return null;

  function reveler() {
    // Le geste débloque l'audio — c'est la règle des navigateurs.
    sonRevelation(current.type);
    setRevealed(true);
  }

  function suivant() {
    if (index < queue!.length - 1) {
      setIndex((i) => i + 1);
      setRevealed(false);
    } else {
      terminer();
    }
  }

  function terminer() {
    // On ne marque « vu » QUE ce qui a été réellement révélé : fermer avec
    // « Plus tard » au milieu laisse les cartes suivantes revenir à la
    // prochaine ouverture.
    const montrees = queue!.slice(0, index + (revealed ? 1 : 0)).map(carteKey);
    let seen: string[];
    try {
      seen = JSON.parse(localStorage.getItem(vuKey(me)) ?? "[]");
    } catch {
      seen = [];
    }
    localStorage.setItem(vuKey(me), JSON.stringify([...new Set([...seen, ...montrees])]));
    setQueue(null);
  }

  return (
    <AnimatePresence>
      <motion.div
        key="nouvelles-cartes"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="dark fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden bg-black/92 px-6 text-foreground backdrop-blur-sm"
      >
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.button
              key={`dos-${index}`}
              onClick={reveler}
              initial={{ scale: 0.6, y: 60, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 240, damping: 20 }}
              className="flex flex-col items-center gap-6"
              aria-label="Révéler la carte"
            >
              <motion.span
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                {queue.length > 1 ? `${queue.length} nouvelles cartes` : "Nouvelle carte"}
              </motion.span>
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "easeInOut" }}
              >
                <Card3D
                  cacheKey={`nouvelle-dos-${me}-${index}`}
                  mode="simple"
                  size={0.9}
                  startFace="back"
                  interactive={false}
                  render={(s) => <BoostCard card={current} size={s} />}
                />
              </motion.div>
              <span className="animate-pulse text-sm font-semibold text-white/85">
                Touche pour révéler
              </span>
            </motion.button>
          ) : (
            <motion.button
              key={`face-${index}`}
              onClick={suivant}
              initial={{ rotateY: 100, scale: 0.65, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              exit={{ x: -140, opacity: 0, transition: { duration: 0.18 } }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="relative flex flex-col items-center gap-5"
              aria-label="Continuer"
            >
              {/* Halo à la couleur du titre */}
              <motion.div
                className="absolute top-1/2 left-1/2 -z-10 size-[135%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 1.6 }}
                style={{
                  background: `radial-gradient(circle, ${GLOW[current.type] ?? GLOW.mvp} 0%, transparent 65%)`,
                }}
              />
              <motion.span
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45 }}
                className="rounded-full bg-white/10 px-4 py-1 text-[11px] font-black tracking-[0.3em] text-white uppercase"
              >
                ✦ {BOOST_LABELS[current.type]} · {current.date} ✦
              </motion.span>
              <Card3D
                cacheKey={`nouvelle-face-${me}-${index}`}
                mode="simple"
                size={0.95}
                render={(s) => <BoostCard card={current} size={s} />}
              />
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-sm font-bold text-white">
                  {/* Une carte MVP de Bola (lib/sfl/carte-bola.ts) vient d'un match, pas d'un dimanche. */}
                  Elle est à toi, {me} — bien joué{current.date.startsWith("Bola") ? "" : " dimanche"}.
                </span>
                <span className="text-xs text-white/60">
                  {index + 1}/{queue.length} — touche pour continuer
                </span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>

        <button
          onClick={terminer}
          className="bouton-secondaire absolute top-5 right-5 px-3.5 py-2 text-[12px] font-semibold"
          style={{ marginTop: "env(safe-area-inset-top)" }}
        >
          Plus tard
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
