"use client";

// Les premiers écrans de l'accueil (accueil.tsx) : la bienvenue, puis ce qui
// ouvre le compte, le mot de passe à soi, l'accord à la politique de
// confidentialité et « C'est bien toi ? ».
//
// Chacun reprend la logique de l'écran qu'il remplace, sans rien changer à ce
// qui part au serveur : choisirMotDePasse (nouveau-mot-de-passe.tsx),
// donnerAccord et ses cases (confidentialite/consentement.tsx), la saisie de
// l'identité (identite.tsx). En aperçu (`demo`), rien n'est envoyé.

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronRight, Eye, EyeOff, Loader2, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDe, RAYON_CARTE } from "@/components/sfl/finitions-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { ChampsIdentite, useSaisieIdentite } from "@/components/sfl/identite";
import { MESSAGES } from "@/components/sfl/auth/nouveau-mot-de-passe";
import { CaseAccord, LecturePolitique, PHRASE_PARENT, PhraseAccord, POINTS } from "@/components/sfl/confidentialite/consentement";
import { useAccord } from "@/hooks/use-accord";
import { useHabillage } from "@/hooks/use-habillage";
import { choisirMotDePasse, signOut, type Session } from "@/lib/sfl/auth/session";
import { donnerAccord } from "@/lib/sfl/consentement";
import { BORNES } from "@/lib/sfl/inscription";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { BoutonDiscret, BoutonPrincipal, Corps, Ligne, Titre, useContexteAccueil } from "./cadre";

/**
 * La carte, de dos, qui flotte : elle se prépare. Son vrai dos (dos-carte.tsx,
 * à la matière de sa face), dessiné à plat et balancé en perspective : la 3D
 * arrive en tournant sur elle-même, et passerait par la face avant la
 * révélation. `size` : 254 px de large à 1, comme les cartes.
 */
export function CarteDeDos({ player, size = 0.7 }: { player: Player; size?: number }) {
  const reduit = useReducedMotion();
  const habillage = useHabillage(player.name);
  return (
    <motion.div
      initial={reduit ? false : { y: 40, opacity: 0, scale: 0.86 }}
      animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 170, damping: 20, delay: 0.08 }}
      style={{ perspective: 900 }}
    >
      <motion.div
        animate={reduit ? undefined : { y: [0, -9, 0], rotateY: [-11, 11, -11], rotateX: [5, 2, 5] }}
        transition={{ repeat: Infinity, duration: 4.2, ease: "easeInOut" }}
        className="relative overflow-hidden"
        style={{
          borderRadius: (RAYON_CARTE * 254 * size) / 1024,
          boxShadow: "0 34px 55px -21px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <DosCarte matiere={matiereDe("base", habillage)} nom={player.name} size={size} habillage={habillage} />
        {/* Le reflet qui passe sur le dos, comme sous la lumière. */}
        {!reduit && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-[55%]"
            style={{
              background: "linear-gradient(105deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 100%)",
              mixBlendMode: "overlay",
            }}
            initial={{ x: "-100%" }}
            animate={{ x: ["-100%", "190%"] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 2 }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}

export function EtapeBonjour({ player, prenom, onSuite }: { player: Player; prenom: string; onSuite: () => void }) {
  return (
    <Corps pied={<BoutonPrincipal onClick={onSuite}>Commencer</BoutonPrincipal>}>
      <CarteDeDos player={player} />
      <div className="mt-[34px] flex flex-col items-center">
        <Titre>{prenom ? `Bienvenue dans Bola, ${prenom}.` : "Bienvenue dans Bola."}</Titre>
        <Ligne>Avant d&apos;entrer, on prépare ta carte. Deux minutes, et elle est à toi.</Ligne>
      </div>
    </Corps>
  );
}

export function EtapeMotDePasse({ session, onFini }: { session: Session | null; onFini: () => void }) {
  const { demo } = useContexteAccueil();
  const reduit = useReducedMotion();
  const [next, setNext] = useState("");
  const [current, setCurrent] = useState("");
  const [demandeActuel, setDemandeActuel] = useState(false);
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const provisoire = session?.motDePasseAChanger === "provisoire";
  const assez = next.length >= BORNES.motDePasse;
  const pret = assez && (!demandeActuel || !!current);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pret) return;
    if (demo) {
      onFini();
      return;
    }
    setBusy(true);
    setError(null);
    const res = await choisirMotDePasse(next, demandeActuel ? current : undefined);
    setBusy(false);
    if (res.ok) {
      navigator.vibrate?.([10, 50, 10]);
      onFini();
      return;
    }
    if (res.reason === "reauth") setDemandeActuel(true);
    setError(MESSAGES[res.reason]);
  }

  const Cadenas = assez ? LockKeyhole : LockKeyholeOpen;
  return (
    <form onSubmit={submit} className="contents">
      <Corps
        pied={
          <>
            <BoutonPrincipal type="submit" disabled={busy || !pret}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              Enregistrer
            </BoutonPrincipal>
            <BoutonDiscret rouge onClick={signOut}>
              Me déconnecter
            </BoutonDiscret>
          </>
        }
      >
        <motion.span
          key={assez ? "ferme" : "ouvert"}
          initial={reduit ? false : { scale: 0.7, rotate: assez ? -14 : 0 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 14 }}
          className={cn(
            "grid size-[89px] place-items-center rounded-full transition-colors duration-300",
            assez ? "bg-white text-[#0a0b0d] shadow-[0_0_44px_rgba(255,255,255,0.25)]" : "glass-soft text-white/80"
          )}
        >
          <Cadenas className="size-[34px]" strokeWidth={1.8} />
        </motion.span>
        <div className="mt-[21px] flex flex-col items-center">
          <Titre>Choisis ton mot de passe.</Titre>
          <Ligne>
            {provisoire
              ? "Ton mot de passe provisoire ne sert qu'à entrer. Choisis-en un à toi : personne d'autre ne le connaîtra."
              : "Celui que la ligue t'a donné n'est plus sûr. Choisis-en un à toi : personne d'autre ne le connaîtra."}
          </Ligne>
        </div>

        <div className="mt-[21px] flex w-full flex-col gap-[8px]">
          {/* Pour le trousseau du téléphone : le nouveau mot de passe va sous le bon identifiant. */}
          <input type="text" name="username" autoComplete="username" value={session?.user ?? ""} readOnly hidden />
          {demandeActuel && (
            <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
              <span className="mono-label text-white/40">Mot de passe actuel</span>
              <input
                type={show ? "text" : "password"}
                value={current}
                onChange={(e) => {
                  setCurrent(e.target.value);
                  setError(null);
                }}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-transparent text-titre font-semibold text-white outline-none placeholder:text-white/25"
              />
            </label>
          )}
          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
            <span className="mono-label text-white/40">Nouveau mot de passe</span>
            <span className="flex items-center gap-2">
              <input
                type={show ? "text" : "password"}
                value={next}
                onChange={(e) => {
                  setNext(e.target.value);
                  setError(null);
                }}
                autoComplete="new-password"
                placeholder={`${BORNES.motDePasse} caractères au moins`}
                className="min-w-0 flex-1 bg-transparent text-titre font-semibold text-white outline-none placeholder:text-white/25"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="shrink-0 text-white/40"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>
          {error && <p className="px-1 text-corps font-medium text-[#FF6B5E]">{error}</p>}
        </div>
      </Corps>
    </form>
  );
}

export function EtapeAccord({ nom, mineur, onFini }: { nom: string; mineur: boolean; onFini: () => void }) {
  const { demo } = useContexteAccueil();
  const { accord } = useAccord(nom);
  const [lecture, setLecture] = useState(false);
  const [oui, setOui] = useState(false);
  // Une nouvelle version garde son choix d'avant pour la carte hors de l'app.
  const [horsApp, setHorsApp] = useState(accord?.horsApp ?? false);
  const [parent, setParent] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const pret = oui && (!mineur || parent);

  async function continuer() {
    if (!pret || envoi) return;
    navigator.vibrate?.(12);
    if (!demo) {
      setEnvoi(true);
      // L'accord est gardé ici aussitôt, et part au serveur (ou à la prochaine ouverture).
      await donnerAccord(nom, { horsApp, parent: mineur && parent, ou: "ouverture" });
      setEnvoi(false);
    }
    onFini();
  }

  if (lecture)
    return (
      <div className="absolute inset-0 flex flex-col">
        <LecturePolitique onRetour={() => setLecture(false)} />
      </div>
    );

  return (
    <Corps
      haut
      pied={
        <div className="w-full">
          <CaseAccord coche={oui} onChange={setOui}>
            <PhraseAccord onLire={() => setLecture(true)} />
          </CaseAccord>
          {mineur && (
            <CaseAccord coche={parent} onChange={setParent}>
              {PHRASE_PARENT}
            </CaseAccord>
          )}
          <CaseAccord coche={horsApp} onChange={setHorsApp} note="Facultatif">
            Bola peut aussi montrer ma carte dans ses vidéos et ses posts, hors de l&apos;app.
          </CaseAccord>
          <div className="mt-[13px] flex flex-col items-center gap-[5px]">
            <BoutonPrincipal onClick={continuer} disabled={!pret || envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              Continuer
            </BoutonPrincipal>
            <BoutonDiscret rouge onClick={signOut}>
              Me déconnecter
            </BoutonDiscret>
          </div>
        </div>
      }
    >
      <div className="pt-[8px]">
        <Titre>Ton image, tes données.</Titre>
      </div>
      <ul className="mt-[21px] flex w-full flex-col gap-[13px]">
        {POINTS.map(({ icone: Icone, titre, texte }) => (
          <li key={titre} className="flex gap-[13px]">
            <span className="glass-soft grid size-[34px] shrink-0 place-items-center rounded-full">
              <Icone className="size-[16px] text-white/80" />
            </span>
            <span className="min-w-0 pt-[1px]">
              <span className="block text-lecture leading-tight font-bold text-white">{titre}</span>
              <span className="mt-[3px] block text-corps leading-snug text-white/55">{texte}</span>
            </span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => setLecture(true)}
        className="bouton-secondaire mt-[21px] flex w-full items-center justify-center gap-[6px] py-[12px] text-ligne font-bold"
      >
        Lire la politique en entier
        <ChevronRight className="size-4" />
      </button>
    </Corps>
  );
}

export function EtapeIdentite({ onFini }: { onFini: () => void }) {
  const { demo, clavier, court } = useContexteAccueil();
  const saisie = useSaisieIdentite({ demo });
  const { player, envoi, panne, pseudo, prenom, pret, enregistrer } = saisie;

  async function valider(e: React.FormEvent) {
    e.preventDefault();
    const affiche = await enregistrer();
    if (affiche === null) return;
    navigator.vibrate?.([10, 50, 10]);
    onFini();
  }

  return (
    <form onSubmit={valider} className="contents">
      <Corps
        pied={
          <>
            <BoutonPrincipal type="submit" disabled={!pret || envoi}>
              {envoi && <Loader2 className="size-4 animate-spin" />}
              C&apos;est moi
            </BoutonPrincipal>
            {/* Le serveur ne répond pas : on passe, et l'ouverture suivante le redemandera. */}
            {panne && <BoutonDiscret onClick={onFini}>Plus tard</BoutonDiscret>}
          </>
        }
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={clavier ? "petite" : "grande"}
            initial={{ scale: 0.8, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.12 } }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
          >
            <PlayerCard
              player={player}
              // 0,67 : la plus petite carte entière (palierCarte), où le nom et le pseudo s'écrivent.
              size={clavier ? 0.38 : court ? 0.67 : 0.7}
              affiche={prenom || " "}
              pseudo={pseudo ? `@${pseudo}` : ""}
            />
          </motion.div>
        </AnimatePresence>
        <div className={court ? "mt-[13px]" : "mt-[21px]"}>
          <Titre>C&apos;est bien toi ?</Titre>
        </div>
        <div className={cn("w-full", court ? "mt-[13px]" : "mt-[21px]")}>
          <ChampsIdentite saisie={saisie} />
        </div>
      </Corps>
    </form>
  );
}
