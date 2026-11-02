"use client";

// Écran de connexion : la porte de Bola (Sabri, 02/11 : « un vrai écran de
// connexion Bola, beaucoup plus stylé »).
//
// Il reprend le langage de l'accueil et de l'inscription, sans texte qui
// guide : le logo Bola en haut, la carte de dos qui flotte (le vrai dos,
// dos-carte.tsx, papier de la carte de saison) et le reflet qui passe dessus,
// puis « Reviens au ballon. », la phrase du site de la marque. Dessous, un
// seul bloc de verre à deux lignes (pseudo, mot de passe), l'action « Entrer »
// et « Continuer avec Google » (boutons-sociaux.tsx, visible seulement quand
// Supabase l'a activé). En pied, « Créer ma carte », « Mot de passe oublié ? »
// (la réponse ne s'affiche qu'au toucher) et la politique de confidentialité.
//
// Plus de « Sunday Five League » ici : la ligue n'est qu'une partie de Bola.
// Rien ne change à ce qui part au serveur : signIn, comme avant.
// Mouvement réduit : tout est posé d'emblée, la carte ne flotte pas.

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/sfl/auth/session";
import { DosCarte } from "@/components/sfl/dos-carte";
import { LOGO_BOLA, matiereDe, RAYON_CARTE } from "@/components/sfl/finitions-carte";
import { BoutonsSociaux } from "./boutons-sociaux";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  "bad-password": "Identifiant ou mot de passe incorrect.",
  unavailable: "Pas de réponse du serveur. Vérifie ta connexion et réessaie.",
};

/** Le logo Bola entier (symbole + logotype), repère de l'intro (intro-bola.ts). */
function LogoBola({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1000 237" className={className} fill="currentColor" role="img" aria-label="Bola">
      <path d={LOGO_BOLA.symbole} />
      <path d={LOGO_BOLA.logotype} />
    </svg>
  );
}

/** La carte de dos, qui flotte sous la lumière. `size` : 254 px de large à 1. */
function CarteQuiFlotte({ size }: { size: number }) {
  const reduit = useReducedMotion();
  return (
    <motion.div
      initial={reduit ? false : { y: 46, opacity: 0, scale: 0.84, rotateX: 18 }}
      animate={{ y: 0, opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ type: "spring", stiffness: 150, damping: 19, delay: 0.12 }}
      style={{ perspective: 900 }}
    >
      <motion.div
        animate={reduit ? undefined : { y: [0, -8, 0], rotateY: [-12, 12, -12], rotateX: [6, 2, 6] }}
        transition={{ repeat: Infinity, duration: 4.6, ease: "easeInOut" }}
        className="relative overflow-hidden"
        style={{
          borderRadius: (RAYON_CARTE * 254 * size) / 1024,
          boxShadow: "0 34px 55px -21px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)",
        }}
      >
        <DosCarte matiere={matiereDe("base")} nom="" size={size} />
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
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeInOut", repeatDelay: 2.4 }}
          />
        )}
      </motion.div>
      {/* L'ombre posée au sol, qui respire avec la carte. */}
      <motion.div
        aria-hidden
        className="mx-auto mt-[21px] h-[10px] rounded-[50%] bg-black/50 blur-[8px] dark:bg-black/80"
        style={{ width: 254 * size * 0.72 }}
        animate={reduit ? undefined : { scaleX: [1, 0.86, 1], opacity: [0.9, 0.6, 0.9] }}
        transition={{ repeat: Infinity, duration: 4.6, ease: "easeInOut" }}
      />
    </motion.div>
  );
}

export function LoginScreen() {
  const reduit = useReducedMotion();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oubli, setOubli] = useState(false);
  const pret = !!user && !!password;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !pret) return;
    setBusy(true);
    setError(null);
    const res = await signIn(user, password);
    if (!res.ok) {
      setError(MESSAGES[res.reason] ?? "Connexion impossible.");
      setBusy(false);
      navigator.vibrate?.([18, 40, 18]);
    }
    // En cas de succès, la session change et AuthGate remplace cet écran.
  }

  // Les blocs entrent l'un après l'autre, sous la carte.
  const entree = (i: number) =>
    reduit
      ? {}
      : {
          initial: { y: 14, opacity: 0 },
          animate: { y: 0, opacity: 1 },
          transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const, delay: 0.32 + i * 0.07 },
        };

  return (
    <div className="relative flex min-h-dvh flex-col px-[21px] pt-[13px] pb-[calc(21px+env(safe-area-inset-bottom))]">
      <div className="orbs" aria-hidden>
        <i />
        <i />
        <i />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[380px] flex-1 flex-col">
        <motion.div {...entree(-3)} className="flex justify-center pt-[8px]">
          <LogoBola className="h-[21px] w-auto text-foreground" />
        </motion.div>

        <div className="flex flex-1 flex-col items-center justify-center py-[21px] [@media(max-height:700px)]:py-[13px]">
          <div className="[@media(max-height:700px)]:hidden">
            <CarteQuiFlotte size={0.62} />
          </div>
          <div className="hidden [@media(max-height:700px)]:block">
            <CarteQuiFlotte size={0.44} />
          </div>
          <motion.h1
            {...entree(0)}
            className="mt-[21px] text-center text-titre-l leading-[1.06] font-extrabold tracking-tight text-balance text-foreground"
          >
            Reviens au ballon.
          </motion.h1>
        </div>

        <form onSubmit={submit} className="flex flex-col">
          <motion.div {...entree(1)} className="glass-soft overflow-hidden rounded-[22px]">
            <label className="flex flex-col gap-[3px] px-[18px] pt-[13px] pb-[11px]">
              <span className="mono-label text-encre-3">Pseudo</span>
              <input
                value={user}
                onChange={(e) => {
                  setUser(e.target.value);
                  setError(null);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                spellCheck={false}
                enterKeyHint="next"
                aria-label="Pseudo ou identifiant"
                className="w-full bg-transparent text-titre font-semibold text-foreground outline-none"
              />
            </label>
            <span className="mx-[18px] block h-px bg-contraste/8" />
            <label className="flex flex-col gap-[3px] px-[18px] pt-[11px] pb-[13px]">
              <span className="mono-label text-encre-3">Mot de passe</span>
              <span className="flex items-center gap-2">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  className="min-w-0 flex-1 bg-transparent text-titre font-semibold text-foreground outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  className="-mr-1 grid size-[30px] shrink-0 place-items-center text-encre-3"
                >
                  {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
                </button>
              </span>
            </label>
          </motion.div>

          <AnimatePresence initial={false}>
            {error && (
              <motion.p
                key={error}
                role="alert"
                initial={reduit ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: reduit ? 0 : [-8, 6, -3, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="px-[6px] pt-[10px] text-corps font-medium text-[#c8352b] dark:text-[#FF6B5E]"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <motion.button
            {...entree(2)}
            type="submit"
            disabled={busy || !pret}
            className={cn(
              "bouton-principal bouton--vert mt-[13px] flex items-center justify-center gap-2 py-[16px] text-lecture font-bold transition-opacity",
              (busy || !pret) && "opacity-45"
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Entrer
          </motion.button>
        </form>

        <motion.div {...entree(3)}>
          <BoutonsSociaux retour="/inscription" onErreur={setError} className="mt-[8px]" />
        </motion.div>

        <motion.div {...entree(4)} className="mt-[21px] flex items-center justify-between px-[6px]">
          <Link href="/inscription" className="bouton-discret text-ligne font-semibold">
            Créer ma carte
          </Link>
          <button
            type="button"
            onClick={() => setOubli((o) => !o)}
            aria-expanded={oubli}
            className="bouton-discret text-ligne font-semibold text-encre-3"
          >
            Mot de passe oublié ?
          </button>
        </motion.div>
        <AnimatePresence initial={false}>
          {oubli && (
            <motion.p
              initial={reduit ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden px-[6px] pt-[8px] text-right text-corps leading-snug text-encre-3"
            >
              Un admin de la ligue t&apos;en donne un provisoire.
            </motion.p>
          )}
        </AnimatePresence>

        <motion.div {...entree(5)} className="mt-[21px] flex justify-center">
          <Link href="/confidentialite" className="text-micro font-medium text-encre-4 underline-offset-2 hover:underline">
            Politique de confidentialité
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
