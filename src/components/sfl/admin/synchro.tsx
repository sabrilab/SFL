"use client";

// Synchronisation de la saison — le panneau que l'admin regarde quand il se
// demande « est-ce que tout le monde voit ce que je vois ? ».
//
// Trois choses, et rien d'autre : où en est la saison, un bouton pour la
// renvoyer (« Renvoyer » : depuis le 30/10, le mot « Publier » ne désigne
// plus que la journée, saisie/brouillon.ts), un bouton pour reprendre celle
// de la base quand une saisie a dérapé. Aucun passage par l'installation : elle sert à créer les
// tables et les comptes, pas à publier des données.
//
// Les échecs sont affichés AVEC LEUR MOTIF, en toutes lettres. Un « échec de
// synchronisation » sans cause laisse l'admin sans rien à faire, et c'est
// justement le moment où il a besoin d'agir.
//
// Le conflit (22/10/2026) : un autre admin a publié depuis la version d'où
// part cet appareil. Rien n'a été écrasé ; l'admin choisit entre reprendre la
// base et écraser avec la sienne, ce second geste confirmé.
//
// Le refus de la base (30/10) : une feuille malsaine (public.feuille_saine :
// un joueur en double, un membre qui ne joue pas, deux journées pour un
// dimanche) n'est jamais écrite, même en écrasant. Les objets en cause sont
// dits tels quels (« J4 · Ilyes ×2 »), en noir et blanc.

import { useCallback, useState, useSyncExternalStore } from "react";
import { RotateCcw, Check, RefreshCw, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSession } from "@/hooks/use-session";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { SAISIE_EVENT } from "@/components/sfl/season-provider";
import {
  blocage,
  dernierEnvoiAuto,
  dernierePublication,
  diagnostic,
  publicationEnAttente,
  publierSaison,
  reprendreDeLaBase,
  SYNC_EVENT,
  type Etape,
} from "@/lib/sfl/saisie/sync";
import type { Saison } from "@/lib/sfl/saisie/types";

type Etat =
  | { phase: "repos" }
  | { phase: "envoi" }
  | { phase: "reprise" }
  | { phase: "ok"; message: string }
  | { phase: "erreur"; message: string; conflit?: boolean; feuille?: string[] };

/**
 * L'issue du dernier envoi automatique. C'est un état extérieur à React
 * (module de synchro) : on s'y abonne plutôt que d'en recopier une version
 * dans un effet.
 */
function useDernierEnvoi() {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener(SYNC_EVENT, onChange);
    return () => window.removeEventListener(SYNC_EVENT, onChange);
  }, []);
  return useSyncExternalStore(subscribe, dernierEnvoiAuto, () => null);
}

function quand(ts: number | null): string {
  if (!ts) return "jamais";
  const d = new Date(ts);
  return d.toLocaleString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** « I1 J4 Ilyes » (public.feuille_saine) → « J4 · Ilyes ×2 ». */
export function lireDefaut(d: string): string {
  const m = /^(I\d)\s+(J\d+)?\s*(.*)$/.exec(d.trim());
  if (!m) return d;
  const [, r, j, reste] = m;
  if (r === "I1") return `${j} · ${reste} ×2`;
  if (r === "I2") return `${j} · ${reste} · ne joue pas`;
  if (r === "I0") return `${j} · ${reste} · vitrine`;
  if (r === "I6") return `${reste} · deux journées`;
  return d;
}

/** L'état de la synchro en une pastille : ⟳ ✓, ⟳ 1 (en attente), ⟳ ! (refus, conflit). */
export function useEtatSynchro(): "ok" | "attente" | "refus" | "local" {
  const session = useSession();
  const envoi = useDernierEnvoi();
  if (!session?.server || !session.admin) return "local";
  if (envoi && !envoi.ok) return "refus";
  if (publicationEnAttente()) return "attente";
  return "ok";
}

export function PastilleSynchro({ onClick, className }: { onClick?: () => void; className?: string }) {
  const etat = useEtatSynchro();
  const signe = etat === "ok" ? "✓" : etat === "attente" ? "1" : etat === "refus" ? "!" : "·";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Synchronisation : ${etat === "ok" ? "à jour" : etat === "attente" ? "en attente" : etat === "refus" ? "refusée" : "locale"}`}
      className={cn(
        "mono-label flex h-9 items-center gap-1.5 rounded-full px-3",
        etat === "refus" ? "bg-foreground text-background" : "bg-secondary text-foreground/70",
        className
      )}
    >
      <RefreshCw className="size-3.5" strokeWidth={2.4} />
      {signe}
    </button>
  );
}

export function Synchro({ saison, nu = false }: { saison: Saison; nu?: boolean }) {
  const session = useSession();
  const partage = !!session?.server && !!session.admin;
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const [etapes, setEtapes] = useState<Etape[] | null>(null);
  const [examen, setExamen] = useState(false);
  const [ecraser, setEcraser] = useState(false);
  const envoi = useDernierEnvoi();
  const enAttente = publicationEnAttente();
  const derniere = quand(dernierePublication());
  const empeche = blocage();

  async function publier(forcer = false) {
    setEcraser(false);
    setEtat({ phase: "envoi" });
    const r = await publierSaison(saison, { forcer });
    if (r.ok) {
      setEtat({ phase: "ok", message: "Renvoyée" });
      toast("Saison renvoyée");
    } else {
      setEtat({ phase: "erreur", message: r.raison, conflit: !!r.conflit, feuille: r.feuille });
    }
  }

  async function reprendre() {
    setEtat({ phase: "reprise" });
    const r = await reprendreDeLaBase();
    if (r.ok) {
      window.dispatchEvent(new Event(SAISIE_EVENT));
      setEtat({ phase: "ok", message: "Base reprise" });
      toast("Version de la base reprise");
    } else {
      setEtat({ phase: "erreur", message: r.raison });
    }
  }

  const occupe = etat.phase === "envoi" || etat.phase === "reprise";
  const conflit =
    (etat.phase === "erreur" && !!etat.conflit) || (etat.phase === "repos" && !!envoi && !envoi.ok && !!envoi.conflit);
  const feuille = (etat.phase === "erreur" ? etat.feuille : undefined) ?? (envoi && !envoi.ok ? envoi.feuille : undefined);

  return (
    <div className={cn(!nu && "glass rounded-3xl p-4")}>
      <div className="flex items-center justify-between gap-3">
        <p className="mono-label text-foreground/45">{partage ? "Partagé" : "Local"} · {derniere}</p>
        <span className="mono-label text-foreground/70">
          {envoi?.ok ? `✓ ${quand(envoi.at)}` : enAttente ? "⟳ 1 en attente" : envoi && !envoi.ok ? "! refusé" : ""}
        </span>
      </div>

      {feuille?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {feuille.map((d) => (
            <span key={d} className="mono-label rounded-full px-3 py-1.5 text-foreground line-through decoration-2 shadow-[inset_0_0_0_1px_currentColor]">
              {lireDefaut(d)}
            </span>
          ))}
        </div>
      ) : envoi && !envoi.ok && !conflit ? (
        <p className="mono-label mt-3 text-foreground/70">{envoi.raison}</p>
      ) : null}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => void publier()}
          disabled={occupe || !!empeche}
          className="bouton-principal flex h-12 flex-1 items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40"
        >
          {etat.phase === "envoi" ? "Envoi…" : "Renvoyer"}
        </button>
        <button
          onClick={reprendre}
          disabled={occupe || !session?.server}
          className="bouton-secondaire flex h-12 items-center justify-center gap-2 px-4 text-[14px] font-semibold disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          {etat.phase === "reprise" ? "Reprise…" : "Reprendre la base"}
        </button>
      </div>

      {empeche && <p className="mt-2.5 text-[12.5px] leading-snug text-foreground/60">{empeche}</p>}

      {etat.phase === "ok" && (
        <p className="mono-label mt-2.5 flex items-center gap-1.5 text-foreground/70">
          <Check className="size-3.5 shrink-0" />
          {etat.message}
        </p>
      )}

      {conflit && (
        <div className="mt-3 rounded-2xl px-3 py-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
          <p className="mono-label text-foreground/70">Base plus récente · rien d&apos;écrasé</p>
          <button
            onClick={() => (ecraser ? void publier(true) : setEcraser(true))}
            disabled={occupe}
            className="bouton-secondaire bouton--rouge mono-label mt-2 px-3 py-1.5 disabled:opacity-40"
          >
            {ecraser ? "Confirmer : remplacer la base" : "Écraser avec la mienne"}
          </button>
        </div>
      )}

      {etat.phase === "erreur" && !etat.conflit && !etat.feuille && (
        <p className="mt-2.5 text-[12.5px] leading-snug text-foreground/60">{etat.message}</p>
      )}

      <button
        onClick={async () => {
          setExamen(true);
          setEtapes(await diagnostic());
          setExamen(false);
        }}
        disabled={examen}
        className="bouton-discret mono-label mt-3 flex items-center gap-1.5 px-1 py-1.5 disabled:opacity-40"
      >
        <Stethoscope className="size-3.5" />
        {examen ? "Examen…" : "Diagnostic"}
      </button>

      {etapes && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-2xl bg-contraste/4 px-3 py-2.5">
          {etapes.map((e) => (
            <div key={e.titre} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
                  e.ok ? "bg-foreground/15 text-foreground" : "bg-foreground text-background"
                )}
              >
                {e.ok ? "✓" : "✕"}
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold">{e.titre}</span>
                <span className="block text-[12px] leading-snug text-foreground/45">{e.detail}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {process.env.NODE_ENV !== "production" && <ReinitialiserSaison />}
    </div>
  );
}

/**
 * Repart des données livrées avec le code — geste rare, donc confirmé.
 * Jamais en production (30/10) : il publiait la démo à toute la ligue.
 */
export function ReinitialiserSaison() {
  const [confirme, setConfirme] = useState(false);
  if (process.env.NODE_ENV === "production") return null;
  return (
    <button
      onClick={() => {
        if (!confirme) {
          setConfirme(true);
          return;
        }
        saisieStore.reset();
        window.dispatchEvent(new Event(SAISIE_EVENT));
        toast("Saison remise aux données livrées");
        setConfirme(false);
      }}
      className={cn(
        "mono-label mt-2 px-3 py-1.5",
        confirme ? "bouton-principal bouton--rouge" : "bouton-discret"
      )}
    >
      {confirme ? "Confirmer" : "Démo"}
    </button>
  );
}
