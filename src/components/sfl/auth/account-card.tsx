"use client";

// Bloc « Mon compte » des réglages : qui est connecté, changement du mot de
// passe par défaut, déconnexion.

import { useState } from "react";
import { toast } from "sonner";
import { LogOut, KeyRound } from "lucide-react";
import { changePassword, hasCustomPassword, signOut } from "@/lib/sfl/auth/session";
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
