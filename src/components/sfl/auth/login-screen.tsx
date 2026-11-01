"use client";

// Écran de connexion — première chose que voit un membre de la ligue.
// Repris du langage du design : fond #070707 et orbes, verre, micro-libellés
// en capitales Inter, une seule action blanche.

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/sfl/auth/session";
import { BoutonsSociaux } from "./boutons-sociaux";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  "bad-password": "Identifiant ou mot de passe incorrect.",
  unavailable: "Pas de réponse du serveur. Vérifie ta connexion et réessaie.",
};

export function LoginScreen() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await signIn(user, password);
    if (!res.ok) {
      setError(MESSAGES[res.reason] ?? "Connexion impossible.");
      setBusy(false);
    }
    // En cas de succès, la session change et AuthGate remplace cet écran.
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <p className="mono-label text-primary">Sunday Five League</p>
        <h1 className="mt-2 text-nom leading-[1.05] font-extrabold tracking-tight">
          Le dimanche,
          <br />
          ça se joue ici.
        </h1>
        <p className="mt-3 text-ligne leading-snug text-encre-3">
          Connecte-toi avec ton pseudo, ou l&apos;identifiant que l&apos;admin t&apos;a transmis. Tu retrouveras
          ta carte, tes points, et tu pourras répondre aux convocations.
        </p>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
            <span className="mono-label text-encre-3">Pseudo ou identifiant</span>
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
              placeholder="ilyes"
              className="w-full bg-transparent text-titre font-semibold outline-none placeholder:text-encre-4"
            />
          </label>

          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
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
                placeholder="••••••••"
                className="min-w-0 flex-1 bg-transparent text-titre font-semibold outline-none placeholder:text-encre-4"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="shrink-0 text-encre-3"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {error && (
            <p className="px-1 text-corps font-medium text-[#c8352b] dark:text-[#FF6B5E]">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !user || !password}
            className={cn(
              "bouton-principal bouton--vert mt-1 flex items-center justify-center gap-2 py-4 text-lecture font-bold",
              (busy || !user || !password) && "opacity-40"
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Entrer dans la ligue
          </button>
        </form>

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-contraste/8" />
          <span className="mono-label text-encre-4">ou</span>
          <span className="h-px flex-1 bg-contraste/8" />
        </div>
        <BoutonsSociaux retour="/inscription" onErreur={setError} className="mt-4" />

        <Link
          href="/inscription"
          className="bouton-secondaire bouton--vert mt-6 flex items-center justify-center py-3.5 text-ligne font-bold"
        >
          Créer mon compte
        </Link>

        <p className="mt-6 text-corps leading-snug text-encre-4">
          Mot de passe oublié ? Un admin de la ligue peut t&apos;en donner un provisoire.
        </p>
        <Link
          href="/confidentialite"
          className="mt-4 inline-block text-corps font-semibold text-encre-3 underline underline-offset-2"
        >
          Politique de confidentialité
        </Link>
      </div>
    </div>
  );
}
