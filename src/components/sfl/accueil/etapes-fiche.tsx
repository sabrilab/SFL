"use client";

// La fiche, à l'accueil (accueil.tsx) : homme ou femme aux deux symboles, la
// date de naissance aux roues, le gabarit aux règles, le pied fort aux
// semelles et le poste sur le terrain. Ce que l'inscription demande déjà
// (lib/sfl/inscription.ts, mêmes bornes), demandé ici aux joueurs que l'admin
// a créés, une seule fois ; homme ou femme, que l'inscription ne demande pas,
// à tous. Chaque écran écrit sa part de la fiche (lib/sfl/fiche.ts) en
// passant au suivant. Une écriture qui échoue ne bloque personne : l'accueil
// la redemandera.
//
// Sous 15 ans, la case d'un parent (confidentialite/consentement.tsx)
// s'ajoute à la date de naissance quand l'accord a été donné sans elle.

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { CaseAccord, PHRASE_PARENT } from "@/components/sfl/confidentialite/consentement";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useAccord } from "@/hooks/use-accord";
import { useIdentites } from "@/hooks/use-identites";
import { AGE_ACCORD_PARENT } from "@/lib/sfl/confidentialite";
import { donnerAccord } from "@/lib/sfl/consentement";
import { poserMaFiche, type FicheJoueur } from "@/lib/sfl/fiche";
import { separerNom } from "@/lib/sfl/identites-regles";
import { age, BORNES, MAILLOTS, type Maillot, type Pied, type Poste, type Sexe } from "@/lib/sfl/inscription";
import type { VilleJoueur } from "@/lib/sfl/villes";
import { cn } from "@/lib/utils";
import { BoutonPrincipal, Corps, Ligne, Titre, useContexteAccueil } from "./cadre";
import { Regle } from "./regle";
import { Roue } from "./roue";
import { HommeOuFemme, PiedFort, TerrainPostes } from "./terrain-postes";

/** Ce que le joueur a réglé, gardé d'un écran à l'autre (le retour le retrouve). */
export interface Brouillon {
  jour: number;
  /** De 1 à 12. */
  mois: number;
  annee: number;
  /** Une roue a tourné : la date n'est plus celle qu'on propose au départ. */
  naissanceVue: boolean;
  sexe: Sexe | null;
  taille: number;
  poids: number;
  pointure: number;
  maillot: Maillot | null;
  pied: Pied | null;
  poste: Poste | null;
  ville: VilleJoueur | null;
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const deux = (n: number) => String(n).padStart(2, "0");
const joursDans = (mois: number, annee: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

/** Écrit sa part de la fiche ; en aperçu, rien. Un échec est dit, sans bloquer. */
function useEnregistrer() {
  const { demo } = useContexteAccueil();
  const { player } = useMyPlayer();
  const identite = useIdentites();
  const [envoi, setEnvoi] = useState(false);
  async function enregistrer(champs: Partial<FicheJoueur>) {
    if (demo) return;
    setEnvoi(true);
    const erreur = await poserMaFiche(champs, separerNom(identite.nom(player.name)));
    setEnvoi(false);
    if (erreur) toast.warning(erreur, { description: "On te le redemandera à la prochaine ouverture." });
  }
  return { envoi, enregistrer };
}

function Suivant({ envoi, disabled, onClick }: { envoi: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <BoutonPrincipal onClick={onClick} disabled={envoi || disabled}>
      {envoi && <Loader2 className="size-4 animate-spin" />}
      Continuer
    </BoutonPrincipal>
  );
}

export function EtapeSexe({ b, maj, onFini }: { b: Brouillon; maj: (p: Partial<Brouillon>) => void; onFini: () => void }) {
  const { envoi, enregistrer } = useEnregistrer();
  async function continuer() {
    if (!b.sexe) return;
    navigator.vibrate?.(12);
    await enregistrer({ sexe: b.sexe });
    onFini();
  }
  return (
    <Corps pied={<Suivant envoi={envoi} disabled={!b.sexe} onClick={continuer} />}>
      <Titre>Homme ou femme ?</Titre>
      <div className="mt-[34px]">
        <HommeOuFemme valeur={b.sexe} onChange={(sexe) => maj({ sexe })} />
      </div>
    </Corps>
  );
}

export function EtapeNaissance({
  nom,
  b,
  maj,
  onFini,
}: {
  nom: string;
  b: Brouillon;
  maj: (p: Partial<Brouillon>) => void;
  onFini: () => void;
}) {
  const { demo } = useContexteAccueil();
  const reduit = useReducedMotion();
  const { accord } = useAccord(nom);
  const { envoi, enregistrer } = useEnregistrer();
  const [parent, setParent] = useState(false);
  const cetteAnnee = new Date().getFullYear();
  const annees = Array.from({ length: 90 - BORNES.ageMin + 1 }, (_, i) => cetteAnnee - 90 + i);
  const jours = joursDans(b.mois, b.annee);
  const date = `${b.annee}-${deux(b.mois)}-${deux(Math.min(b.jour, jours))}`;
  const ans = age(date);
  const valide = ans !== null && ans >= BORNES.ageMin && ans <= 90;
  const vue = b.naissanceVue;
  // Sous 15 ans, un parent s'ajoute à l'accord, s'il ne l'a pas déjà donné avec lui.
  const parentManque = vue && ans !== null && ans < AGE_ACCORD_PARENT && (demo || !accord?.parent);
  const pret = vue && valide && (!parentManque || parent);

  async function continuer() {
    if (!pret) return;
    navigator.vibrate?.(12);
    await enregistrer({ naissance: date });
    if (parentManque && parent && !demo) {
      await donnerAccord(nom, { horsApp: accord?.horsApp ?? false, parent: true, ou: "ouverture" });
    }
    onFini();
  }

  return (
    <Corps
      pied={
        <div className="w-full">
          {parentManque && (
            <CaseAccord coche={parent} onChange={setParent}>
              {PHRASE_PARENT}
            </CaseAccord>
          )}
          <div className={cn(parentManque && "mt-[8px]")}>
            <Suivant envoi={envoi} disabled={!pret} onClick={continuer} />
          </div>
        </div>
      }
    >
      <div className="flex h-[108px] items-end justify-center gap-[8px]">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={vue ? (ans ?? "–") : "?"}
            initial={reduit ? false : { y: 18, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -18, opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className={cn("font-display text-[89px] leading-[0.9] tracking-wide tabular-nums", vue && valide ? "text-white" : "text-white/35")}
          >
            {vue ? (ans ?? "–") : "?"}
          </motion.span>
        </AnimatePresence>
        <span className="mono-label pb-[10px] text-white/45">ans</span>
      </div>
      <div className="mt-[21px] flex flex-col items-center">
        <Titre>Ta date de naissance.</Titre>
        <Ligne>Elle reste privée, entre toi et les administrateurs.</Ligne>
      </div>
      <div className="mt-[21px] grid w-full grid-cols-[0.8fr_1.6fr_1.1fr] gap-[8px]">
        <Roue
          label="Jour"
          options={Array.from({ length: jours }, (_, i) => String(i + 1))}
          index={Math.min(b.jour, jours) - 1}
          onChange={(i) => maj({ jour: i + 1, naissanceVue: true })}
        />
        <Roue label="Mois" options={MOIS} index={b.mois - 1} onChange={(i) => maj({ mois: i + 1, naissanceVue: true })} />
        <Roue
          label="Année"
          options={annees.map(String)}
          index={Math.max(0, annees.indexOf(b.annee))}
          onChange={(i) => maj({ annee: annees[i], naissanceVue: true })}
        />
      </div>
      {vue && !valide && ans !== null && (
        <p className="mt-[13px] text-center text-[13px] font-medium text-[#FF6B5E]">
          {ans < BORNES.ageMin ? `Bola est ouverte dès ${BORNES.ageMin} ans.` : "Vérifie ta date de naissance."}
        </p>
      )}
    </Corps>
  );
}

export function EtapeGabarit({ b, maj, onFini }: { b: Brouillon; maj: (p: Partial<Brouillon>) => void; onFini: () => void }) {
  const { court } = useContexteAccueil();
  const { envoi, enregistrer } = useEnregistrer();
  async function continuer() {
    if (!b.maillot) return;
    navigator.vibrate?.(12);
    await enregistrer({ taille_cm: b.taille, poids_kg: b.poids, pointure: b.pointure, maillot: b.maillot });
    onFini();
  }
  return (
    <Corps pied={<Suivant envoi={envoi} disabled={!b.maillot} onClick={continuer} />}>
      <Titre>Ton gabarit.</Titre>
      <Ligne>Pour tes maillots et, bientôt, ton personnage.</Ligne>
      <div className={cn("flex w-full flex-col", court ? "mt-[13px] gap-[13px]" : "mt-[21px] gap-[21px]")}>
        <Regle
          label="Taille"
          unite="cm"
          min={BORNES.taille.min}
          max={BORNES.taille.max}
          valeur={b.taille}
          onChange={(v) => maj({ taille: v })}
          compact={court}
        />
        <Regle
          label="Poids"
          unite="kg"
          min={BORNES.poids.min}
          max={BORNES.poids.max}
          valeur={b.poids}
          onChange={(v) => maj({ poids: v })}
          compact={court}
        />
        <Regle
          label="Pointure"
          unite="EU"
          min={BORNES.pointure.min}
          max={BORNES.pointure.max}
          pas={0.5}
          majeur={5}
          moyen={1}
          valeur={b.pointure}
          onChange={(v) => maj({ pointure: v })}
          compact={court}
        />
        <div className="flex flex-col items-center gap-[8px]">
          <span className="mono-label text-white/45">Maillot</span>
          <div className="grid w-full grid-cols-6 gap-[5px]">
            {MAILLOTS.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={b.maillot === m}
                onClick={() => {
                  navigator.vibrate?.(6);
                  maj({ maillot: m });
                }}
                className={cn(
                  "bouton--or grid place-items-center rounded-[13px] text-[14px] font-extrabold tracking-tight",
                  court ? "h-[40px]" : "h-[44px]",
                  b.maillot === m ? "bouton-principal" : "bouton-secondaire text-white/70"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Corps>
  );
}

export function EtapePied({ b, maj, onFini }: { b: Brouillon; maj: (p: Partial<Brouillon>) => void; onFini: () => void }) {
  const { envoi, enregistrer } = useEnregistrer();
  async function continuer() {
    if (!b.pied) return;
    navigator.vibrate?.(12);
    await enregistrer({ pied: b.pied });
    onFini();
  }
  return (
    <Corps pied={<Suivant envoi={envoi} disabled={!b.pied} onClick={continuer} />}>
      <Titre>Ton pied fort.</Titre>
      <Ligne>Touche ta semelle. Les deux, si tu frappes des deux.</Ligne>
      <div className="mt-[34px]">
        <PiedFort valeur={b.pied} onChange={(pied) => maj({ pied })} />
      </div>
    </Corps>
  );
}

export function EtapePoste({ b, maj, onFini }: { b: Brouillon; maj: (p: Partial<Brouillon>) => void; onFini: () => void }) {
  const { envoi, enregistrer } = useEnregistrer();
  async function continuer() {
    if (!b.poste) return;
    navigator.vibrate?.(12);
    await enregistrer({ poste: b.poste });
    onFini();
  }
  return (
    <Corps pied={<Suivant envoi={envoi} disabled={!b.poste} onClick={continuer} />}>
      <Titre>Ton poste.</Titre>
      <Ligne>Là où tu joues le plus.</Ligne>
      <div className="mt-[21px] w-full">
        <TerrainPostes valeur={b.poste} onChange={(poste) => maj({ poste })} />
      </div>
    </Corps>
  );
}
