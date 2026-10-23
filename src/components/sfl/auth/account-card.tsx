"use client";

// Bloc « Mon compte » des réglages : qui est connecté, changement du mot de
// passe, déconnexion.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Link2, Mail } from "lucide-react";
import {
  changePassword,
  fournisseursActifs,
  getContactEmail,
  saveContactEmail,
  type Fournisseur,
  type RefusMotDePasse,
} from "@/lib/sfl/auth/session";
import { BORNES } from "@/lib/sfl/inscription";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/use-session";
import { useIdentites } from "@/hooks/use-identites";
import { cn } from "@/lib/utils";
import { PseudoCard } from "./pseudo-card";
import { BoutonDeconnexion } from "./bouton-deconnexion";

export function AccountCard() {
  const session = useSession();
  const identite = useIdentites();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const serverSession = !!session?.server;
  // « Lier Google / Apple » seulement pour un fournisseur activé dans Supabase.
  const [actifs, setActifs] = useState<Fournisseur[]>([]);
  useEffect(() => {
    let annule = false;
    fournisseursActifs().then((r) => {
      if (!annule) setActifs(r.actifs);
    });
    return () => {
      annule = true;
    };
  }, []);

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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!session || busy) return;
    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (res.ok) {
      toast.success("Mot de passe modifié");
      setOpen(false);
      setCurrent("");
      setNext("");
    } else {
      const messages: Record<RefusMotDePasse, string> = {
        "too-short": `${BORNES.motDePasse} caractères minimum.`,
        weak: "Trop facile à deviner. Choisis-en un autre.",
        "same-password": "C'est déjà ton mot de passe.",
        "bad-password": "Mot de passe actuel incorrect.",
        reauth: "Reconnecte-toi, puis réessaie.",
        unavailable: session.server
          ? "Serveur injoignable — réessaie dans un instant."
          : "Reconnecte-toi d'abord : le mot de passe ne se change qu'avec une connexion vérifiée.",
      };
      toast.error(messages[res.reason]);
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
            <div className="truncate text-[16px] font-bold tracking-tight">{identite.nom(session.name)}</div>
            <div className="mono-label mt-0.5 text-foreground/40">
              {serverSession ? session.user : `${session.user} · ${identite.pseudo(session.name)}`}
              {session.admin && " · Admin"}
            </div>
          </div>
        </div>

        {serverSession && <PseudoCard />}

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
                  className="bouton-principal bouton--vert shrink-0 px-4 py-2.5 text-[13px] font-bold disabled:opacity-40"
                >
                  OK
                </button>
              </form>
            )}
            {actifs.length > 0 && (
              <div className="mt-2.5 flex gap-2">
                {actifs.map((p) => (
                  <button
                    key={p}
                    onClick={() => linkProvider(p)}
                    className="bouton-secondaire bouton--vert mono-label flex flex-1 items-center justify-center gap-1.5 py-2.5"
                  >
                    <Link2 className="size-3" /> Lier {p === "google" ? "Google" : "Apple"}
                  </button>
                ))}
              </div>
            )}
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
              placeholder={`Nouveau mot de passe (${BORNES.motDePasse} caractères min.)`}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="glass-soft rounded-full px-4 py-3 text-[14px] font-medium outline-none placeholder:text-foreground/30"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy || !current || !next}
                className={cn(
                  "bouton-principal bouton--vert flex-1 py-3 text-[14px] font-bold",
                  (busy || !current || !next) && "opacity-40"
                )}
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bouton-secondaire px-5 py-3 text-[14px] font-semibold"
              >
                Annuler
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={() => setOpen(true)}
              className="bouton-secondaire flex items-center justify-center gap-2 py-3 text-[14px] font-semibold"
            >
              <KeyRound className="size-4" />
              Changer mon mot de passe
            </button>
            <BoutonDeconnexion className="py-3 text-[14px]" />
          </div>
        )}
      </div>
    </section>
  );
}
