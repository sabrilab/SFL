"use client";

// Bloc « Mon compte » des réglages : qui est connecté, changement du mot de
// passe par défaut, déconnexion.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { LogOut, KeyRound, Link2, Mail } from "lucide-react";
import {
  changePassword,
  getContactEmail,
  hasCustomPassword,
  saveContactEmail,
  signOut,
} from "@/lib/sfl/auth/session";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useIsClient } from "@/hooks/use-is-client";
import { username } from "@/lib/sfl/usernames";
import { cn } from "@/lib/utils";

export function AccountCard() {
  const session = useSession();
  const isClient = useIsClient();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const serverSession = !!session?.server;

  // L'email vit en base (système extérieur) : lecture au montage, mise à jour
  // via les callbacks — pas de setState synchrone dans l'effet.
  useEffect(() => {
    if (!serverSession) return;
    let cancelled = false;
    getContactEmail().then((e) => {
      if (!cancelled && e) setEmail(e);
    });
    return () => {
      cancelled = true;
    };
  }, [serverSession]);

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const value = emailInput.trim();
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      toast.error("Cet email n'a pas l'air valide.");
      return;
    }
    setEmailBusy(true);
    const ok = await saveContactEmail(value);
    setEmailBusy(false);
    if (ok) {
      setEmail(value.toLowerCase());
      setEmailInput("");
      toast.success("Email enregistré 📬");
    } else {
      toast.error("Impossible d'enregistrer — reconnecte-toi et réessaie.");
    }
  }

  async function linkProvider(provider: "google" | "apple") {
    try {
      const { error } = await supabase().auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/reglages` },
      });
      if (error) {
        toast.error(
          /manual linking/i.test(error.message)
            ? "La liaison de comptes n'est pas encore activée par l'admin."
            : `Liaison ${provider === "google" ? "Google" : "Apple"} pas encore disponible.`
        );
      }
    } catch {
      toast.error("Liaison impossible pour l'instant.");
    }
  }

  if (!session) return null;
  void tick;
  const custom = isClient && hasCustomPassword(session.user);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || busy) return;
    setBusy(true);
    const res = await changePassword(session.user, current, next);
    setBusy(false);
    if (res.ok) {
      toast.success("Mot de passe modifié");
      setOpen(false);
      setCurrent("");
      setNext("");
      setTick((t) => t + 1);
    } else {
      toast.error(
        res.reason === "too-short"
          ? "Six caractères minimum."
          : res.reason === "unavailable"
            ? "Serveur injoignable — réessaie dans un instant."
            : "Mot de passe actuel incorrect."
      );
    }
  }

  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-semibold text-foreground/45">Mon compte</h2>

      <div className="glass rounded-[22px] p-4">
        <div className="flex items-center gap-3">
          <span className="glass-soft flex size-11 shrink-0 items-center justify-center rounded-full text-[14px] font-bold">
            {session.name[0]}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[16px] font-bold tracking-tight">{session.name}</div>
            <div className="mono-label mt-0.5 text-foreground/40">
              {session.user} · {username(session.name)}
              {session.admin && " · Admin"}
            </div>
          </div>
        </div>

        {isClient && !custom && (
          <p className="mt-3 rounded-2xl bg-primary/10 px-3.5 py-2.5 text-[12.5px] leading-snug text-primary">
            Tu utilises encore le mot de passe donné par l&apos;admin. Change-le : il est
            écrit en clair sur sa liste.
          </p>
        )}

        {/* Email de contact — la clé de la future connexion Google/Apple */}
        {serverSession && (
          <div className="mt-3 border-t border-white/8 pt-3">
            {email ? (
              <p className="flex items-center gap-2 text-[13px] text-foreground/60">
                <Mail className="size-3.5 shrink-0 text-primary" />
                <span className="min-w-0 truncate">{email}</span>
              </p>
            ) : (
              <form onSubmit={submitEmail} className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="Ton email (pour Google/Apple)"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="glass-soft min-w-0 flex-1 rounded-full px-4 py-2.5 text-[13.5px] font-medium outline-none placeholder:text-foreground/30"
                />
                <button
                  type="submit"
                  disabled={emailBusy || !emailInput}
                  className="shrink-0 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background disabled:opacity-40"
                >
                  OK
                </button>
              </form>
            )}
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => linkProvider("google")}
                className="glass-soft mono-label flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-foreground/60"
              >
                <Link2 className="size-3" /> Lier Google
              </button>
              <button
                onClick={() => linkProvider("apple")}
                className="glass-soft mono-label flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-foreground/60"
              >
                <Link2 className="size-3" /> Lier Apple
              </button>
            </div>
          </div>
        )}

        {open ? (
          <form onSubmit={submit} className="mt-3 flex flex-col gap-2">
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Mot de passe actuel"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              className="glass-soft rounded-full px-4 py-3 text-[14px] font-medium outline-none placeholder:text-foreground/30"
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Nouveau mot de passe (6 caractères min.)"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="glass-soft rounded-full px-4 py-3 text-[14px] font-medium outline-none placeholder:text-foreground/30"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !current || !next}
                className={cn(
                  "flex-1 rounded-full bg-foreground py-3 text-[14px] font-bold text-background",
                  (busy || !current || !next) && "opacity-40"
                )}
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="glass-soft rounded-full px-5 py-3 text-[14px] font-semibold text-foreground/60"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setOpen(true)}
              className="glass-soft flex flex-1 items-center justify-center gap-2 rounded-full py-3 text-[14px] font-semibold"
            >
              <KeyRound className="size-4" />
              Changer mon mot de passe
            </button>
            <button
              onClick={() => {
                signOut();
                toast.success("À dimanche 👋");
              }}
              aria-label="Se déconnecter"
              className="glass-soft flex items-center justify-center rounded-full px-4 py-3 text-foreground/60"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
