"use client";

// Écran de connexion — première chose que voit un membre de la ligue.
// Repris du langage du design : fond #070707 et orbes, verre, micro-libellés
// en JetBrains Mono, une seule action blanche.

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/sfl/auth/session";
import { cn } from "@/lib/utils";

const MESSAGES: Record<string, string> = {
  "unknown-user": "Cet identifiant n'existe pas dans la ligue.",
  "bad-password": "Mot de passe incorrect.",
  unavailable:
    "Connexion impossible depuis cette adresse. Ouvre l'app en https (ou en localhost).",
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
        <h1 className="mt-2 text-[34px] leading-[1.05] font-extrabold tracking-tight">
          Le dimanche,
          <br />
          ça se joue ici.
        </h1>
        <p className="mt-3 text-[13.5px] leading-snug text-foreground/45">
          Connecte-toi avec l&apos;identifiant que l&apos;admin t&apos;a transmis. Tu retrouveras
          ta carte, tes points, et tu pourras répondre aux convocations.
        </p>

        <form onSubmit={submit} className="mt-7 flex flex-col gap-3">
          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
            <span className="mono-label text-foreground/40">Identifiant</span>
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
              className="w-full bg-transparent text-[16px] font-semibold outline-none placeholder:text-foreground/25"
            />
          </label>

          <label className="glass-soft flex flex-col gap-1.5 rounded-[18px] px-4 py-3">
            <span className="mono-label text-foreground/40">Mot de passe</span>
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
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold outline-none placeholder:text-foreground/25"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                className="shrink-0 text-foreground/40"
              >
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </span>
          </label>

          {error && (
            <p className="px-1 text-[12.5px] font-medium text-[#FF6B5E]">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !user || !password}
            className={cn(
              "mt-1 flex items-center justify-center gap-2 rounded-full bg-foreground py-4 text-[15px] font-bold text-background transition-transform active:scale-[0.98]",
              (busy || !user || !password) && "opacity-40"
            )}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            Entrer dans la ligue
          </button>
        </form>

        <p className="mt-6 text-[12.5px] leading-snug text-foreground/35">
          Mot de passe oublié ? Demande à Ilyes de te le redonner — il a la liste des
          comptes. Pense à le changer une fois connecté, dans Réglages.
        </p>
      </div>
    </div>
  );
}
