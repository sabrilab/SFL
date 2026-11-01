"use client";

// « Ton premier match » — à l'ouverture, pour un joueur Bola qui n'a encore
// ni ouvert ni rejoint de match (Sabri, 31/10/2026 : « fais un match ici,
// fais un match là, organise là, invite »). Le pourquoi et le journal sont
// dans lib/sfl/activation.ts.
//
// Sa carte, puis les trois terrains les plus proches (le catalogue de la Map,
// lib/sfl/terrains : à 5 d'abord, à 40 km au plus), autour de sa position
// s'il la donne d'un toucher (« Autour de moi » : le navigateur demande la
// permission à ce toucher-là, jamais avant), sinon autour de sa ville.
// Toucher un terrain le choisit ; « Ouvrir un match ici » ouvre la Map sur
// la feuille d'ouverture, ce terrain déjà posé (/map?ouvrir=id). « Inviter
// mes potes » mène à son lien de parrainage. Sans terrain recensé autour, la
// feuille s'ouvre vide et il choisit son lieu.

import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { Loader2, LocateFixed, MapPin, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/sfl/player-card";
import type { Player } from "@/lib/sfl/engine";
import { demanderPosition, noterActivation, positionAutorisee, positionGardee, type Position } from "@/lib/sfl/activation";
import { aFormat, distanceLisible, km, lireAutour, sourcesCitees, surPlace, useTerrainsRecenses, type TerrainRecense } from "@/lib/sfl/terrains";
import { maVille } from "@/lib/sfl/villes";
import { cn } from "@/lib/utils";

/** Combien de terrains l'écran propose. */
const PROPOSES = 3;
/** Au-delà, ce n'est plus « près de chez toi ». */
const PROCHE_KM = 40;
/** Sans ville ni position : la métropole lilloise, où la ligue joue. */
const PAR_DEFAUT: Position = { lat: 50.6329, lng: 3.0586 };

/** Les plus proches, à 5 d'abord (un match ouvert se joue à dix), sinon de tout format. */
export function terrainsProches(terrains: TerrainRecense[], pres: Position, n = PROPOSES): (TerrainRecense & { d: number })[] {
  const tries = (liste: TerrainRecense[]) =>
    liste
      .map((t) => ({ ...t, d: km(pres, t) }))
      .filter((t) => t.d <= PROCHE_KM)
      .sort((a, b) => a.d - b.d);
  const a5 = tries(aFormat(terrains, 5));
  return (a5.length >= n ? a5 : [...a5, ...tries(terrains).filter((t) => !a5.some((x) => x.id === t.id))]).slice(0, n);
}

export function InvitationPremierMatch({
  player,
  onFini,
  onPlusTard,
}: {
  player: Player;
  /** Il est parti ouvrir son match, ou inviter. */
  onFini: () => void;
  onPlusTard: () => void;
}) {
  const reduit = useReducedMotion();
  const router = useRouter();
  const titre = useId();
  const ville = maVille(player.name);
  const [toi, setToi] = useState<Position | null>(positionGardee);
  const [cherche, setCherche] = useState(false);
  const pres = toi ?? ville ?? PAR_DEFAUT;
  const [lat, lng] = [pres.lat, pres.lng];
  const { terrains, index } = useTerrainsRecenses();
  const proches = useMemo(() => terrainsProches(terrains, { lat, lng }), [terrains, lat, lng]);
  // La source et sa date, partout où ses terrains se montrent (Licence Ouverte, ODbL).
  const source = sourcesCitees(index, proches).join(" · ");
  const [choisi, setChoisi] = useState<string | null>(null);
  const actif = proches.find((t) => t.id === choisi) ?? proches[0] ?? null;

  useEffect(() => {
    lireAutour({ lat, lng }).catch(() => {});
  }, [lat, lng]);

  // Déjà autorisée sur ce téléphone : on la lit sans rien demander.
  useEffect(() => {
    if (toi) return;
    let fini = false;
    void positionAutorisee().then((oui) => {
      if (!oui || fini) return;
      demanderPosition()
        .then((p) => !fini && setToi(p))
        .catch(() => {});
    });
    return () => {
      fini = true;
    };
  }, [toi]);

  function localiser() {
    setCherche(true);
    demanderPosition()
      .then((p) => {
        setToi(p);
        setChoisi(null);
        navigator.vibrate?.(8);
        noterActivation("position-oui");
      })
      .catch((err: GeolocationPositionError | Error) => {
        const refus = "code" in err && err.code === err.PERMISSION_DENIED;
        noterActivation("position-non", { raison: refus ? "refus" : "echec" });
        toast.error(refus ? "Position refusée : tu peux l'activer dans les réglages du téléphone." : "On ne te trouve pas.");
      })
      .finally(() => setCherche(false));
  }

  function ouvrir() {
    navigator.vibrate?.([8, 40, 8]);
    noterActivation("terrain", actif ? { terrain: actif.id, km: Math.round(actif.d * 10) / 10 } : {});
    onFini();
    router.push(`/map?ouvrir=${encodeURIComponent(actif?.id ?? "")}`);
  }

  function inviter() {
    noterActivation("inviter");
    onFini();
    router.push("/parrainage");
  }

  const autour = toi ? "Autour de toi" : ville ? `Autour de ${ville.ville}` : "Autour de Lille";

  return (
    <motion.div
      key="invitation-premier-match"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titre}
      className="dark fixed inset-0 z-[55] overflow-y-auto overscroll-contain bg-black/92 text-foreground backdrop-blur-sm"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[380px] flex-col items-center px-6 py-[21px]">
        <div aria-hidden className="flex-grow" />

        <motion.div
          initial={reduit ? false : { scale: 0.7, y: 40, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 240, damping: 22 }}
        >
          <PlayerCard player={player} size={0.56} />
        </motion.div>

        <h2 id={titre} className="pt-[21px] text-center text-titre-g leading-tight font-extrabold tracking-tight text-white">
          Ton premier match
        </h2>

        <div className="flex items-center gap-2 pt-[13px]">
          <span className="inline-flex h-[27px] max-w-[220px] items-center gap-[5px] rounded-full bg-[#f4f5f2] px-[11px] text-ligne leading-none font-extrabold tracking-[-0.2px] whitespace-nowrap text-[#0a0b0d]">
            <MapPin className="size-[13px] shrink-0" strokeWidth={2.6} />
            <span className="truncate">{autour}</span>
          </span>
          {!toi && (
            <button
              type="button"
              onClick={localiser}
              disabled={cherche}
              className="glass-soft inline-flex h-[27px] items-center gap-[5px] rounded-full px-[11px] text-ligne leading-none font-semibold text-white active:scale-[0.97] disabled:opacity-50"
            >
              {cherche ? <Loader2 className="size-[13px] animate-spin" /> : <LocateFixed className="size-[13px]" />}
              Autour de moi
            </button>
          )}
        </div>

        <div className="flex w-full flex-col gap-[6px] pt-[21px]" role="radiogroup" aria-label="Terrains proches">
          {proches.length === 0 ? (
            <p className="py-4 text-center text-ligne text-white/50">Aucun terrain recensé autour.</p>
          ) : (
            proches.map((t, i) => {
              const pris = t.id === actif?.id;
              return (
                <motion.button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={pris}
                  initial={reduit ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 + 0.06 * i }}
                  onClick={() => {
                    setChoisi(t.id);
                    navigator.vibrate?.(6);
                  }}
                  className={cn(
                    "glass-soft flex w-full items-center gap-3 rounded-2xl px-4 py-[11px] text-left transition-[box-shadow,opacity]",
                    pris ? "ring-2 ring-white/80" : "opacity-70"
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-lecture font-bold text-white">{t.nom}</span>
                    <span className="block truncate text-corps text-white/55">
                      {[t.commune, surPlace(t)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-ligne font-extrabold text-white tabular-nums">{distanceLisible(t.d)}</span>
                </motion.button>
              );
            })
          )}
        </div>

        <div className="flex w-full flex-col items-center gap-[8px] pt-[21px]">
          <button
            type="button"
            onClick={ouvrir}
            className="bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-[15px] text-lecture font-bold"
          >
            <Plus className="size-4" strokeWidth={2.6} />
            {actif ? "Ouvrir un match ici" : "Ouvrir un match"}
          </button>
          <button
            type="button"
            onClick={inviter}
            className="bouton-secondaire bouton--mauve flex w-full items-center justify-center gap-2 py-3.5 text-ligne font-semibold"
          >
            <UserPlus className="size-4" />
            Inviter mes potes
          </button>
          <button type="button" onClick={onPlusTard} className="bouton-discret px-6 py-3 text-ligne font-semibold">
            Plus tard
          </button>
        </div>

        {source && <p className="pt-[8px] text-center text-[10px] leading-snug text-white/30">{source}</p>}

        <div aria-hidden className="flex-grow" />
      </div>
    </motion.div>
  );
}
