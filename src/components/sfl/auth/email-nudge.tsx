"use client";

// Invite à laisser son email — affichée en tête du fil tant que le joueur
// connecté (session serveur) n'a pas d'email de contact en base. L'email
// prépare la connexion Google/Apple et donne à l'admin un moyen de contact.

import { useEffect, useState } from "react";
import { Mail, X } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { getContactEmail, saveContactEmail } from "@/lib/sfl/auth/session";

const DISMISS_KEY = "sfl-email-nudge-off";

export function EmailNudge() {
  const session = useSession();
  const serverSession = !!session?.server;
  // null = pas encore vérifié ; "" = vérifié, absent ; sinon l'email.
  const [known, setKnown] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!serverSession) return;
    let cancelled = false;
    getContactEmail().then((e) => {
      if (!cancelled) setKnown(e ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, [serverSession]);

  void tick;
  const dismissed = typeof window !== "undefined" && !!localStorage.getItem(DISMISS_KEY);
  if (!serverSession || known === null || known !== "" || dismissed) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const email = value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      toast.error("Cet email n'a pas l'air valide.");
      return;
    }
    setBusy(true);
    const ok = await saveContactEmail(email);
    setBusy(false);
    if (ok) {
      setKnown(email);
      toast.success("Merci ! Ton email est enregistré 📬");
    } else {
      toast.error("Impossible d'enregistrer, réessaie.");
    }
  }

  return (
    <section
      className="glass relative rounded-3xl p-4"
      style={{
        background:
          "radial-gradient(120% 80% at 0% 0%, rgba(111,168,255,0.12), transparent 55%), linear-gradient(168deg, rgba(255,255,255,0.09), rgba(255,255,255,0.028))",
      }}
    >
      <button
        aria-label="Plus tard"
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, "1");
          setTick((t) => t + 1);
        }}
        className="absolute top-3 right-3 text-foreground/35"
      >
        <X className="size-4" />
      </button>
      <p className="mono-label flex items-center gap-1.5 text-primary">
        <Mail className="size-3" /> Ton email
      </p>
      <p className="mt-1.5 pr-6 text-[13px] leading-snug text-foreground/55">
        Laisse ton email : bientôt tu pourras te connecter en un geste avec Google ou
        Apple, sans mot de passe.
      </p>
      <form onSubmit={submit} className="mt-3 flex gap-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="prenom@exemple.fr"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="glass-soft min-w-0 flex-1 rounded-full px-4 py-3 text-[14px] font-medium outline-none placeholder:text-foreground/30"
        />
        <button
          type="submit"
          disabled={busy || !value}
          className="shrink-0 rounded-full bg-foreground px-5 py-3 text-[14px] font-bold text-background disabled:opacity-40"
        >
          Envoyer
        </button>
      </form>
    </section>
  );
}
