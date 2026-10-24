"use client";

// « D'où tu viens ? », à l'accueil (accueil.tsx) : la ville du joueur sur la
// Map, demandée une fois avec le reste. Le même geste que l'invitation de
// l'ouverture (invitation-ville.tsx) : sa carte, l'étiquette de la Map
// dessous avec la ville que sa connexion devine, « C'est ma ville » d'un
// toucher, ou le champ qui cherche une autre commune (useCommunes : le
// centre de la commune, jamais sa position).
//
// On ne passe pas, mais on peut ne pas apparaître : « Mode fantôme » pose la
// ville invisible, comme l'œil du catalogue de la Map. Une écriture qui
// échoue ne bloque personne : l'ouverture suivante la redemandera.

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ghost, Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCommunes, type Commune } from "@/hooks/use-communes";
import { poserMaVille } from "@/lib/sfl/villes";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { BoutonPrincipal, Corps, Ligne, Titre, useContexteAccueil } from "./cadre";
import type { Brouillon } from "./etapes-fiche";

export function EtapeVille({
  nom,
  player,
  b,
  maj,
  onFini,
}: {
  nom: string;
  player: Player;
  b: Brouillon;
  maj: (p: Partial<Brouillon>) => void;
  onFini: () => void;
}) {
  const { demo, court } = useContexteAccueil();
  const reduit = useReducedMotion();
  const champ = useRef<HTMLInputElement>(null);
  const [cherche, setCherche] = useState(false);
  const [q, setQ] = useState("");
  const trouvees = useCommunes(q);
  const [envoi, setEnvoi] = useState<"ville" | "fantome" | null>(null);

  function fermerRecherche() {
    setCherche(false);
    setQ("");
    champ.current?.blur();
  }

  function choisir(c: Commune) {
    maj({ ville: { ville: c.commune ?? c.libelle, lat: c.lat, lng: c.lng } });
    fermerRecherche();
    navigator.vibrate?.(8);
  }

  async function poser(fantome: boolean) {
    if (envoi || (!fantome && !b.ville)) return;
    navigator.vibrate?.(fantome ? 8 : 12);
    if (!demo) {
      setEnvoi(fantome ? "fantome" : "ville");
      const erreur = await poserMaVille(nom, b.ville, fantome);
      setEnvoi(null);
      if (erreur) toast.warning(erreur, { description: "On te la redemandera à la prochaine ouverture." });
      else if (!fantome && b.ville) toast.success(`Te voilà sur la Map : ${b.ville.ville}`);
    }
    onFini();
  }

  const pli = { duration: reduit ? 0 : 0.32, ease: [0.32, 0.72, 0, 1] as const };
  const replie = { height: 0, opacity: 0, overflow: "hidden" } as const;
  const deplie = { height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } } as const;

  return (
    <Corps
      haut={cherche}
      pied={
        !cherche && (
          <>
            <BoutonPrincipal onClick={() => poser(false)} disabled={!b.ville || !!envoi}>
              {envoi === "ville" ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              C&apos;est ma ville
            </BoutonPrincipal>
            <button
              type="button"
              onClick={() => poser(true)}
              disabled={!!envoi}
              className="bouton-discret flex items-center gap-[6px] px-6 py-[10px] text-[14px] font-semibold disabled:opacity-50"
            >
              {envoi === "fantome" ? <Loader2 className="size-4 animate-spin" /> : <Ghost className="size-4" />}
              Mode fantôme
            </button>
          </>
        )
      }
    >
      <motion.div initial={false} animate={cherche ? replie : deplie} transition={pli} className="flex w-full flex-col items-center">
        {/* 0,67 : la plus petite carte entière (palierCarte), pour un écran bas. */}
        <PlayerCard player={player} size={court ? 0.67 : 0.7} />
        {/* L'étiquette de la Map, sous la pile de sa ville. */}
        <div className="grid h-[42px] place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            {b.ville && (
              <motion.span
                key={b.ville.ville}
                initial={reduit ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
                animate={{ scale: 1, opacity: 1, rotate: -2 }}
                exit={{ scale: 0.5, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 20 }}
                className="inline-flex h-[27px] max-w-[260px] items-center gap-[5px] rounded-full bg-[#f4f5f2] px-[11px] text-[14px] leading-none font-extrabold tracking-[-0.2px] whitespace-nowrap text-[#0a0b0d] shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
              >
                <MapPin className="size-[13px] shrink-0" strokeWidth={2.6} />
                <span className="truncate">{b.ville.ville}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      <Titre>D&apos;où tu viens ?</Titre>
      <motion.div initial={false} animate={cherche ? replie : deplie} transition={pli} className="flex w-full flex-col items-center">
        <Ligne>Ta carte apparaît sur la Map, au centre de ta commune. Jamais ta position.</Ligne>
      </motion.div>

      <div className="mt-[21px] flex w-full flex-col gap-[2px]">
        <label className={cn("glass-soft flex items-center gap-[10px] rounded-2xl pr-[6px] pl-4", cherche && "ring-1 ring-white/25")}>
          {cherche || !b.ville ? (
            <Search className="size-4 shrink-0 text-white/40" />
          ) : (
            <span className="mono-label shrink-0 text-white/40">Ta ville</span>
          )}
          {/* Le même champ d'un bout à l'autre : le doigt qui le touche ouvre le clavier de l'iPhone. */}
          <input
            ref={champ}
            value={cherche ? q : (b.ville?.ville ?? "")}
            onFocus={() => {
              if (cherche) return;
              setCherche(true);
              setQ("");
            }}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && cherche && trouvees[0]) choisir(trouvees[0]);
            }}
            placeholder="Ta ville"
            aria-label="Ta ville"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={60}
            className="min-w-0 flex-1 bg-transparent py-[13px] text-[16px] font-semibold text-white outline-none placeholder:font-medium placeholder:text-white/30"
          />
          {cherche && (
            <button
              type="button"
              onClick={fermerRecherche}
              aria-label="Fermer la recherche"
              className="grid size-[36px] shrink-0 place-items-center rounded-full text-white/55 active:bg-white/10"
            >
              <X className="size-4" />
            </button>
          )}
        </label>

        {cherche &&
          trouvees.map((c) => {
            const [ville, departement] = c.libelle.split(" · ");
            return (
              <button
                key={`${c.libelle}${c.lat}`}
                type="button"
                onClick={() => choisir(c)}
                className="flex items-center gap-[10px] rounded-2xl px-4 py-[11px] text-left active:bg-white/8"
              >
                <MapPin className="size-4 shrink-0 text-white/40" />
                <span className="min-w-0 truncate text-[15px] font-semibold text-white">{ville}</span>
                {departement && <span className="ml-auto shrink-0 text-[13px] text-white/40">{departement}</span>}
              </button>
            );
          })}
      </div>
    </Corps>
  );
}
