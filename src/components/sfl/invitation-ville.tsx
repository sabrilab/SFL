"use client";

// « D'où tu viens ? » — la ville du joueur, à l'ouverture (Sabri, 22/10 :
// « propose à chaque joueur, à sa prochaine connexion, de renseigner sa
// ville pour qu'on puisse le mettre sur la map »).
//
// La première des invitations de l'ouverture (invitation-carte.tsx), tant
// que le joueur n'a ni choisi ni confirmé sa ville lui-même (lib/sfl/villes,
// maVilleAProposer). Sa carte arrive avec, dessous, l'étiquette de sa ville
// telle que la Map l'écrit sous une pile. Celle que sa connexion a devinée
// est déjà là : « C'est ma ville » la confirme d'un toucher. Toucher le champ
// cherche une autre commune, comme « Ta ville » dans le catalogue de la Map
// (useCommunes) : le centre de la commune, jamais sa position. La commune
// touchée vient sur l'étiquette ; « C'est ma ville » l'enregistre.
//
// Le champ reste le même <input> d'un bout à l'autre : c'est le doigt qui le
// touche qui ouvre le clavier de l'iPhone (un focus donné après coup ne
// l'ouvre pas). Pendant la recherche, la carte se replie et le champ monte
// en haut de l'écran, avec les communes dessous. Le voile suit la partie
// visible de la page (useVueVisible) : en PWA, le
// clavier de l'iPhone recouvre la page sans la redimensionner.

import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { PlayerCard } from "@/components/sfl/player-card";
import { useCommunes, type Commune } from "@/hooks/use-communes";
import { useVueVisible } from "@/hooks/use-vue-visible";
import { poserMaVille, type VilleJoueur } from "@/lib/sfl/villes";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export function InvitationVille({
  player,
  proposee,
  onFini,
  onPlusTard,
}: {
  player: Player;
  /** Sa ville sur la Map (devinée), ou celle que devine sa connexion ; null sinon. */
  proposee: VilleJoueur | null;
  /** La ville est enregistrée. */
  onFini: () => void;
  onPlusTard: () => void;
}) {
  const reduit = useReducedMotion();
  const vue = useVueVisible();
  const titre = useId();
  const champ = useRef<HTMLInputElement>(null);
  const [choisie, setChoisie] = useState<VilleJoueur | null>(proposee);
  const [cherche, setCherche] = useState(false);
  const [q, setQ] = useState("");
  const trouvees = useCommunes(q);
  const [envoi, setEnvoi] = useState(false);

  const pli = { duration: reduit ? 0 : 0.32, ease: [0.32, 0.72, 0, 1] as const };
  // Replié pendant la recherche. Le débord ne se coupe que le temps du pli :
  // déplié, le halo du bouton et l'ombre de la carte débordent librement.
  const replie = { height: 0, opacity: 0, overflow: "hidden" } as const;
  const deplie = { height: "auto", opacity: 1, transitionEnd: { overflow: "visible" } } as const;

  function fermerRecherche() {
    setCherche(false);
    setQ("");
    champ.current?.blur();
  }

  function choisir(c: Commune) {
    setChoisie({ ville: c.commune ?? c.libelle, lat: c.lat, lng: c.lng });
    fermerRecherche();
    navigator.vibrate?.(8);
  }

  async function valider() {
    if (!choisie || envoi) return;
    setEnvoi(true);
    const erreur = await poserMaVille(player.name, choisie, false);
    setEnvoi(false);
    if (erreur) {
      toast.error(erreur);
      return;
    }
    navigator.vibrate?.(12);
    toast.success(`Te voilà sur la Map : ${choisie.ville}`);
    onFini();
  }

  return (
    <motion.div
      key="invitation-ville"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titre}
      className="fixed inset-0 z-[55] overflow-y-auto overscroll-contain bg-black/92 backdrop-blur-sm"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        // Clavier ouvert : seulement ce qu'il laisse voir.
        ...(vue.hauteur > 0 ? { top: vue.haut, bottom: "auto", height: vue.hauteur } : {}),
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-[380px] flex-col items-center px-6 py-[21px]">
        {/* Au centre au repos ; en haut pendant la recherche, au-dessus du clavier. */}
        <div
          aria-hidden
          className="transition-[flex-grow] duration-300 ease-out"
          style={{ flexGrow: cherche ? 0 : 1 }}
        />

        <motion.div initial={false} animate={cherche ? replie : deplie} transition={pli} className="flex w-full flex-col items-center">
          <motion.div
            initial={reduit ? false : { scale: 0.7, y: 40, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
            className="pt-[8px]"
          >
            <PlayerCard player={player} size={0.7} />
          </motion.div>
          {/* L'étiquette de la Map, sous la pile de sa ville. */}
          <div className="grid h-[42px] place-items-center">
            <AnimatePresence mode="popLayout" initial={false}>
              {choisie && (
                <motion.span
                  key={choisie.ville}
                  initial={reduit ? false : { scale: 0.5, opacity: 0, rotate: -6 }}
                  animate={{ scale: 1, opacity: 1, rotate: -2 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  className="inline-flex h-[27px] max-w-[260px] items-center gap-[5px] rounded-full bg-[#f4f5f2] px-[11px] text-[14px] leading-none font-extrabold tracking-[-0.2px] whitespace-nowrap text-[#0a0b0d] shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
                >
                  <MapPin className="size-[13px] shrink-0" strokeWidth={2.6} />
                  <span className="truncate">{choisie.ville}</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        <h2 id={titre} className="text-center text-[24px] leading-tight font-extrabold tracking-tight text-white">
          D&apos;où tu viens ?
        </h2>
        <motion.p
          initial={false}
          animate={cherche ? replie : deplie}
          transition={pli}
          className="max-w-[290px] text-center text-[14px] leading-snug text-white/60"
        >
          <span className="block pt-[6px]">Ta carte apparaît sur la Map, au centre de ta commune. Jamais ta position.</span>
        </motion.p>

        <div className="mt-[21px] flex w-full flex-col gap-[2px]">
          <label className={cn("glass-soft flex items-center gap-[10px] rounded-2xl pr-[6px] pl-4", cherche && "ring-1 ring-white/25")}>
            {cherche || !choisie ? (
              <Search className="size-4 shrink-0 text-white/40" />
            ) : (
              <span className="mono-label shrink-0 text-white/40">Ta ville</span>
            )}
            <input
              ref={champ}
              value={cherche ? q : (choisie?.ville ?? "")}
              onFocus={() => {
                if (cherche) return;
                setCherche(true);
                setQ("");
              }}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => {
                // iOS laisse parfois la page décalée après le clavier.
                if (vue.tactile) window.scrollTo(0, 0);
              }}
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
              className="min-w-0 flex-1 bg-transparent py-[13px] text-[15px] font-semibold text-white outline-none placeholder:font-medium placeholder:text-white/30"
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

        <motion.div
          initial={false}
          animate={cherche ? replie : deplie}
          transition={pli}
          className="flex w-full flex-col items-center"
        >
          <div className="flex w-full flex-col items-center gap-1 pt-[21px]">
            <button
              type="button"
              onClick={valider}
              disabled={!choisie || envoi}
              className="bouton-principal bouton--vert flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold disabled:opacity-40"
            >
              {envoi ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
              C&apos;est ma ville
            </button>
            <button type="button" onClick={onPlusTard} className="bouton-discret px-6 py-3 text-[14px] font-semibold">
              Plus tard
            </button>
          </div>
        </motion.div>

        <div aria-hidden className="flex-grow" />
      </div>
    </motion.div>
  );
}
