"use client";

// Écran de connexion — première chose que voit un membre de la ligue.
// Repris du langage du design : fond #070707 et orbes, verre, micro-libellés
// en JetBrains Mono, une seule action blanche.

import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { signIn } from "@/lib/sfl/auth/session";
import { supabase } from "@/lib/supabase";
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

  async function oauth(provider: "google" | "apple") {
    try {
      const { error } = await supabase().auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error) {
        setError(
          provider === "apple"
            ? "Connexion Apple pas encore activée par l'admin."
            : "Connexion Google pas encore activée par l'admin."
        );
      }
    } catch {
      setError("Connexion impossible pour l'instant. Utilise ton identifiant.");
    }
  }

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

        <div className="mt-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-white/8" />
          <span className="mono-label text-foreground/30">ou</span>
          <span className="h-px flex-1 bg-white/8" />
        </div>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => oauth("google")}
            className="glass-soft flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-semibold"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#EA4335" d="M12 5.3c1.6 0 3 .55 4.1 1.63l3.05-3.05A10.3 10.3 0 0 0 12 1.6 10.4 10.4 0 0 0 2.7 7.33l3.55 2.76A6.2 6.2 0 0 1 12 5.3Z" />
              <path fill="#4285F4" d="M22.19 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.72a4.9 4.9 0 0 1-2.12 3.21l3.43 2.66c2-1.85 3.16-4.57 3.16-7.77Z" />
              <path fill="#FBBC05" d="M6.25 13.9a6.2 6.2 0 0 1 0-3.8L2.7 7.33a10.4 10.4 0 0 0 0 9.34l3.55-2.76Z" />
              <path fill="#34A853" d="M12 22.4c2.8 0 5.16-.92 6.88-2.5l-3.43-2.66c-.95.64-2.17 1.02-3.45 1.02a6.2 6.2 0 0 1-5.75-4.13L2.7 16.67A10.4 10.4 0 0 0 12 22.4Z" />
            </svg>
            Google
          </button>
          <button
            type="button"
            onClick={() => oauth("apple")}
            className="glass-soft flex flex-1 items-center justify-center gap-2 rounded-full py-3.5 text-[14px] font-semibold"
          >
            <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden>
              <path d="M16.9 12.9c0-2.2 1.8-3.3 1.9-3.35-1-1.5-2.6-1.7-3.2-1.75-1.35-.14-2.65.8-3.34.8-.7 0-1.76-.78-2.9-.76-1.5.02-2.86.86-3.63 2.2-1.55 2.68-.4 6.65 1.11 8.83.74 1.06 1.62 2.26 2.77 2.22 1.11-.05 1.53-.72 2.88-.72 1.34 0 1.72.72 2.9.7 1.2-.02 1.96-1.08 2.7-2.15.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.34-.9-2.36-3.52ZM14.7 5.9c.6-.74 1.02-1.76.9-2.78-.87.04-1.94.58-2.57 1.32-.56.65-1.06 1.7-.93 2.7.98.07 1.98-.5 2.6-1.24Z" />
            </svg>
            Apple
          </button>
        </div>
        <p className="mt-3 text-center text-[11.5px] text-foreground/30">
          Uniquement si tu as déjà lié Google ou Apple à ton compte (Réglages).
        </p>

        <p className="mt-6 text-[12.5px] leading-snug text-foreground/35">
          Mot de passe oublié ? Demande à Ilyes de te le redonner — il a la liste des
          comptes. Pense à le changer une fois connecté, dans Réglages.
        </p>
      </div>
    </div>
  );
}
