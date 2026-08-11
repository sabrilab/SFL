"use client";

// Arène — Composition : ton cinq idéal pour dimanche, posé sur le terrain.
//
// Le demi-terrain porte cinq bulles : gardien, deux défenseurs, deux
// attaquants. On touche un poste puis un joueur (ou l'inverse), les bulles
// se remplissent ; toucher deux postes les échange, retoucher un poste le
// vide. Déposer la composition rapporte 5 ⚽ — une fois par dimanche visé,
// la remplacer ensuite est gratuit.
//
// Les dépôts nourrissent la suite : les matchs populaires de l'Arène et la
// génération d'équipes « selon l'avis des joueurs » côté admin.

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { Check, Search, Send } from "lucide-react";
import { useSeason } from "@/components/sfl/season-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { labelDateFr, prochainDimanche } from "@/lib/sfl/convocation-temps";
import {
  COMPO_REWARD,
  COMPO_SLOTS,
  compoPourDimanche,
  submitCompo,
  type CompoSlotId,
  type CompoSlots,
} from "@/lib/sfl/compositions";
import { cleDimanche } from "@/lib/sfl/convocation-temps";
import { cn } from "@/lib/utils";

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function CompoArena({ me }: { me: string }) {
  const isClient = useIsClient();
  const { players } = useSeason();

  const [slots, setSlots] = useState<CompoSlots>({});
  const [selection, setSelection] = useState<CompoSlotId | null>(null);
  const [q, setQ] = useState("");
  const [deposee, setDeposee] = useState(false);

  // L'horloge du dimanche visé — posée après le premier rendu (pureté).
  const [maintenant, setMaintenant] = useState<Date | null>(null);
  useEffect(() => {
    Promise.resolve().then(() => setMaintenant(new Date()));
  }, []);
  const dimancheLabel = maintenant ? labelDateFr(prochainDimanche(maintenant)) : "dimanche";

  // Reprendre la composition déjà déposée pour ce dimanche, s'il y en a une.
  useEffect(() => {
    if (!maintenant) return;
    const existante = compoPourDimanche(me, cleDimanche(prochainDimanche(maintenant)));
    if (existante) {
      // setState après lecture externe, dans une micro-tâche.
      Promise.resolve().then(() => {
        setSlots(existante.slots);
        setDeposee(true);
      });
    }
  }, [me, maintenant]);

  const utilisés = useMemo(() => new Set(Object.values(slots)), [slots]);
  const complets = COMPO_SLOTS.every((s) => slots[s.id]);

  const roster = useMemo(() => {
    const needle = fold(q.trim());
    return [...players]
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .filter((p) => !needle || fold(p.name).includes(needle));
  }, [players, q]);

  /** Toucher un poste : sélectionner, échanger avec la sélection, ou vider. */
  function toucherPoste(id: CompoSlotId) {
    setDeposee(false);
    if (selection === null) {
      if (slots[id]) {
        // Poste rempli, rien de sélectionné : on retire le joueur.
        setSlots((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      } else {
        setSelection(id);
      }
      return;
    }
    if (selection === id) {
      setSelection(null);
      return;
    }
    // Deux postes touchés : échange (ou déplacement vers un poste vide).
    setSlots((s) => {
      const next = { ...s };
      const a = next[selection];
      const b = next[id];
      if (a !== undefined) next[id] = a;
      else delete next[id];
      if (b !== undefined) next[selection] = b;
      else delete next[selection];
      return next;
    });
    setSelection(null);
  }

  /** Toucher un joueur : le poser sur le poste sélectionné, sinon le prochain vide. */
  function toucherJoueur(name: string) {
    if (utilisés.has(name)) {
      // Déjà sur le terrain : on le retire d'où il est.
      setDeposee(false);
      setSlots((s) => {
        const next = { ...s };
        for (const k of Object.keys(next) as CompoSlotId[]) {
          if (next[k] === name) delete next[k];
        }
        return next;
      });
      return;
    }
    const cible = selection ?? COMPO_SLOTS.find((s) => !slots[s.id])?.id;
    if (!cible) {
      toast.error("Le cinq est complet — retire quelqu'un d'abord.");
      return;
    }
    setDeposee(false);
    setSlots((s) => ({ ...s, [cible]: name }));
    setSelection(null);
  }

  function deposer() {
    if (!complets || !maintenant) return;
    const { rewarded } = submitCompo(me, slots as Record<CompoSlotId, string>, maintenant);
    setDeposee(true);
    if (rewarded > 0) {
      toast.success(`+${rewarded} Ballons ⚽`, {
        description: `Composition déposée pour dimanche ${dimancheLabel}`,
      });
    } else {
      toast.success("Composition remplacée", {
        description: `C'est elle qui compte pour dimanche ${dimancheLabel}`,
      });
    }
  }

  if (!isClient) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="px-1 text-[12.5px] leading-snug text-foreground/45">
        Ton cinq idéal pour dimanche {dimancheLabel} : touche un poste puis un joueur — ou
        l&apos;inverse. Deux postes se touchent pour s&apos;échanger. Premier dépôt de la
        semaine : <strong className="font-semibold text-foreground">+{COMPO_REWARD} ⚽</strong>.
      </p>

      {/* Le demi-terrain */}
      <div
        className="relative overflow-hidden rounded-[22px] border border-primary/20"
        style={{
          aspectRatio: "4 / 3.4",
          background:
            "radial-gradient(120% 90% at 50% 100%, rgba(111,168,255,0.13), transparent 60%), linear-gradient(0deg, rgba(111,168,255,0.05), transparent)",
        }}
      >
        {/* Tracé : surface en bas, rond central en haut */}
        <span className="pointer-events-none absolute -top-12 left-1/2 size-28 -translate-x-1/2 rounded-full border border-primary/25" />
        <span className="pointer-events-none absolute bottom-0 left-1/2 h-14 w-44 -translate-x-1/2 rounded-t-xl border border-b-0 border-primary/25" />

        {COMPO_SLOTS.map((slot) => {
          const nom = slots[slot.id];
          const actif = selection === slot.id;
          return (
            <button
              key={slot.id}
              onClick={() => toucherPoste(slot.id)}
              aria-label={`${slot.label}${nom ? ` — ${nom}` : ""}`}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <motion.span
                animate={actif ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={actif ? { repeat: Infinity, duration: 1.1 } : undefined}
                className={cn(
                  "flex size-12 items-center justify-center rounded-full text-[15px] font-black transition-colors",
                  nom
                    ? "bg-primary text-primary-foreground shadow-[0_0_16px_rgba(111,168,255,0.45)]"
                    : actif
                      ? "border-2 border-primary bg-primary/15 text-primary"
                      : "border-2 border-dashed border-white/25 text-foreground/30"
                )}
              >
                {nom ? nom[0] : "+"}
              </motion.span>
              <span
                className={cn(
                  "max-w-[76px] truncate text-[11px] leading-none font-bold",
                  nom ? "text-white/90" : "text-foreground/35"
                )}
              >
                {nom ?? slot.id}
              </span>
              <span className="mono-label text-[7.5px] text-foreground/30">{slot.id}</span>
            </button>
          );
        })}
      </div>

      {/* Déposer */}
      <button
        onClick={deposer}
        disabled={!complets}
        className={cn(
          "flex items-center justify-center gap-2 rounded-full py-3.5 text-[15px] font-bold transition-transform active:scale-[0.98]",
          deposee && complets
            ? "bg-emerald-500/15 text-emerald-400"
            : "bg-foreground text-background disabled:opacity-35"
        )}
      >
        {deposee && complets ? (
          <>
            <Check className="size-4" /> Déposée pour dimanche
          </>
        ) : (
          <>
            <Send className="size-4" />
            {complets
              ? "Déposer ma composition"
              : `Encore ${COMPO_SLOTS.filter((s) => !slots[s.id]).length} poste${COMPO_SLOTS.filter((s) => !slots[s.id]).length > 1 ? "s" : ""}`}
          </>
        )}
      </button>

      {/* Le banc — tous les joueurs de la ligue */}
      <div className="glass-soft flex items-center gap-2.5 rounded-full px-4 py-2.5">
        <Search className="size-4 shrink-0 text-foreground/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un joueur…"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-foreground/30"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence initial={false}>
          {roster.map((p) => {
            const surTerrain = utilisés.has(p.name);
            return (
              <motion.button
                key={p.name}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
                onClick={() => toucherJoueur(p.name)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  surTerrain
                    ? "bg-primary text-primary-foreground"
                    : "glass-soft text-foreground/65"
                )}
              >
                {p.name}
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      <p className="px-1 pb-1 text-[11.5px] leading-relaxed text-foreground/30">
        Les compositions déposées par toute la ligue serviront à créer les matchs populaires de
        l&apos;Arène et à générer les équipes du dimanche « selon l&apos;avis des joueurs ».
      </p>
    </div>
  );
}
