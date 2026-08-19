"use client";

// Synchronisation de la saison — le panneau que l'admin regarde quand il se
// demande « est-ce que tout le monde voit ce que je vois ? ».
//
// Trois choses, et rien d'autre : où en est la saison, un bouton pour la
// publier partout, un bouton pour reprendre celle de la base quand une
// saisie a dérapé. Aucun passage par l'installation : elle sert à créer les
// tables et les comptes, pas à publier des données.
//
// Les échecs sont affichés AVEC LEUR MOTIF, en toutes lettres. Un « échec de
// synchronisation » sans cause laisse l'admin sans rien à faire, et c'est
// justement le moment où il a besoin d'agir.

import { useCallback, useState, useSyncExternalStore } from "react";
import { CloudUpload, RotateCcw, Check, AlertTriangle, Stethoscope } from "lucide-react";
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
  | { phase: "erreur"; message: string };

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

export function Synchro({ saison }: { saison: Saison }) {
  const session = useSession();
  const partage = !!session?.server && !!session.admin;
  const [etat, setEtat] = useState<Etat>({ phase: "repos" });
  const [etapes, setEtapes] = useState<Etape[] | null>(null);
  const [examen, setExamen] = useState(false);
  const envoi = useDernierEnvoi();
  // La marque survit au rechargement : elle dit qu'une saisie attend encore
  // son voyage vers la base, même si l'envoi raté date d'une autre session.
  const enAttente = publicationEnAttente();
  // Lu à chaque rendu plutôt que mémorisé : la valeur change quand on publie.
  const derniere = quand(dernierePublication());
  const empeche = blocage();

  async function publier() {
    setEtat({ phase: "envoi" });
    const r = await publierSaison(saison);
    if (r.ok) {
      setEtat({ phase: "ok", message: "Publiée. Toute la ligue est sur cette version." });
      toast.success("Saison publiée", { description: "Tout le monde voit la même chose." });
    } else {
      setEtat({ phase: "erreur", message: r.raison });
    }
  }

  async function reprendre() {
    setEtat({ phase: "reprise" });
    const r = await reprendreDeLaBase();
    if (r.ok) {
      window.dispatchEvent(new Event(SAISIE_EVENT));
      setEtat({ phase: "ok", message: "Version de la base reprise sur cet appareil." });
      toast.success("Version de la base reprise");
    } else {
      setEtat({ phase: "erreur", message: r.raison });
    }
  }

  const occupe = etat.phase === "envoi" || etat.phase === "reprise";

  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold tracking-tight">Synchronisation</h2>
          <p className="mt-1 text-[12.5px] leading-snug text-foreground/45">
            {partage
              ? "Chaque sauvegarde part déjà en base toute seule. Ce bouton force l'envoi — après une coupure réseau, ou pour en avoir le cœur net."
              : "Tes corrections restent sur cet appareil tant que ta session n'est pas vérifiée par le serveur."}
          </p>
        </div>
        <span
          className={cn(
            "mono-label shrink-0 rounded-full px-2.5 py-1",
            partage ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"
          )}
        >
          {partage ? "Partagé" : "Local"}
        </span>
      </div>

      <p className="mono-label mt-3 text-foreground/35">Dernière publication · {derniere}</p>

      {/* L'envoi automatique de la dernière sauvegarde. Il partait sans rien
          dire et son échec était avalé : on enregistrait sa journée, la base
          ne la voyait jamais, et l'écran affichait la même chose dans les
          deux cas. */}
      {envoi && !envoi.ok && (
        <div className="mt-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-red-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            <span>
              <b className="font-semibold">Ta dernière sauvegarde n&apos;est pas partie en base.</b>{" "}
              {envoi.raison}
            </span>
          </p>
        </div>
      )}
      {!envoi && enAttente && (
        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-amber-400">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
          Des saisies ne sont pas encore publiées. Elles partiront d&apos;elles-mêmes dès que ta
          session serveur sera rétablie.
        </p>
      )}
      {envoi?.ok && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-emerald-400">
          <Check className="size-3.5 shrink-0" />
          Dernière sauvegarde publiée à {quand(envoi.at)}.
        </p>
      )}

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={publier}
          disabled={occupe || !!empeche}
          className="flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground py-3 text-[14px] font-bold text-background transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <CloudUpload className="size-4" strokeWidth={2.5} />
          {etat.phase === "envoi" ? "Publication…" : "Publier pour toute la ligue"}
        </button>
        <button
          onClick={reprendre}
          disabled={occupe || !session?.server}
          className="glass-soft flex items-center justify-center gap-2 rounded-full px-4 py-3 text-[13.5px] font-semibold text-foreground/70 transition-transform active:scale-[0.98] disabled:opacity-40"
        >
          <RotateCcw className="size-4" />
          {etat.phase === "reprise" ? "Reprise…" : "Reprendre la base"}
        </button>
      </div>

      {empeche && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-amber-400/90">
          <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
          {empeche}
        </p>
      )}

      {etat.phase === "ok" && (
        <p className="mt-2.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-emerald-400">
          <Check className="mt-[2px] size-3.5 shrink-0" />
          {etat.message}
        </p>
      )}

      {etat.phase === "erreur" && (
        <div className="mt-2.5 rounded-2xl border border-red-500/25 bg-red-500/8 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12.5px] leading-snug text-red-300">
            <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
            <span>
              <b className="font-semibold">Publication impossible.</b> {etat.message}
            </span>
          </p>
          <button
            onClick={publier}
            className="mono-label mt-2 rounded-full bg-white/8 px-3 py-1.5 text-foreground/70"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Le diagnostic : quel maillon casse, exactement. */}
      <button
        onClick={async () => {
          setExamen(true);
          setEtapes(await diagnostic());
          setExamen(false);
        }}
        disabled={examen}
        className="mono-label mt-3 flex items-center gap-1.5 rounded-full bg-white/6 px-3 py-1.5 text-foreground/60 disabled:opacity-40"
      >
        <Stethoscope className="size-3.5" />
        {examen ? "Examen…" : "Pourquoi ça ne se publie pas ?"}
      </button>

      {etapes && (
        <div className="mt-2.5 flex flex-col gap-1.5 rounded-2xl bg-white/4 px-3 py-2.5">
          {etapes.map((e) => (
            <div key={e.titre} className="flex items-start gap-2">
              <span
                className={cn(
                  "mt-[3px] flex size-3.5 shrink-0 items-center justify-center rounded-full text-[9px] font-black",
                  e.ok ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
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

      <p className="mt-3 border-t border-white/8 pt-2.5 text-[11.5px] leading-relaxed text-foreground/30">
        « Reprendre la base » remplace la saison de cet appareil par celle que voit la ligue.
        À utiliser quand une saisie a dérapé — puis corrige et republie.
      </p>
    </div>
  );
}

/** Repart des données livrées avec le code — geste rare, donc confirmé. */
export function ReinitialiserSaison() {
  const [confirme, setConfirme] = useState(false);
  return (
    <button
      onClick={() => {
        if (!confirme) {
          setConfirme(true);
          return;
        }
        saisieStore.reset();
        window.dispatchEvent(new Event(SAISIE_EVENT));
        toast.success("Saison remise aux données livrées");
        setConfirme(false);
      }}
      className={cn(
        "mono-label rounded-full px-3 py-1.5",
        confirme ? "bg-red-500/20 text-red-300" : "glass-soft text-foreground/45"
      )}
    >
      {confirme ? "Confirmer — tes saisies seront perdues" : "Repartir des données livrées"}
    </button>
  );
}
