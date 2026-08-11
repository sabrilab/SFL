"use client";

// Les accès de la ligue — la page où l'admin distribue les comptes.
//
// Une fenêtre par joueur : identifiant, mot de passe, et deux boutons —
// « Copier » (un message prêt à envoyer) et « Lien » (une page d'accueil
// personnelle, /bienvenue, qui affiche joliment ses identifiants).
//
// Les mots de passe ne sont pas dans le bundle : ils viennent de /api/comptes,
// qui exige une session serveur d'admin.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Link2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Compte {
  name: string;
  user: string;
  password: string;
}

/** Le message prêt à coller dans une conversation privée. */
function message(c: Compte, origin: string) {
  return (
    `Salut ${c.name} 👋\n` +
    `Voici ton accès à l'app de la SFL :\n\n` +
    `Identifiant : ${c.user}\n` +
    `Mot de passe : ${c.password}\n\n` +
    `${origin}/bienvenue?u=${encodeURIComponent(c.user)}&p=${encodeURIComponent(c.password)}&n=${encodeURIComponent(c.name)}\n\n` +
    `Tu y retrouves ta carte, tes stats, et tu peux dire si tu viens dimanche.`
  );
}

function lien(c: Compte, origin: string) {
  return `${origin}/bienvenue?u=${encodeURIComponent(c.user)}&p=${encodeURIComponent(c.password)}&n=${encodeURIComponent(c.name)}`;
}

function CopyButton({
  label,
  icon,
  text,
  primary = false,
}: {
  label: string;
  icon: React.ReactNode;
  text: string;
  primary?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            setTimeout(() => setDone(false), 1600);
          })
          .catch(() => toast.error("Copie impossible"));
      }}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-[12.5px] font-bold transition-colors",
        done
          ? "bg-primary text-primary-foreground"
          : primary
            ? "bg-foreground text-background"
            : "glass-soft font-semibold text-foreground/70"
      )}
    >
      {done ? <Check className="size-3.5" /> : icon}
      {done ? "Copié" : label}
    </button>
  );
}

function CarteCompte({ c, origin }: { c: Compte; origin: string }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="glass flex flex-col gap-3 rounded-[22px] p-4">
      <div className="flex items-center gap-3">
        <span className="glass-soft flex size-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold">
          {c.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-bold tracking-tight">{c.name}</div>
          <div className="mono-label mt-0.5 text-foreground/40">{c.user}</div>
        </div>
        <button
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="shrink-0 text-foreground/35"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>

      <div className="glass-soft rounded-2xl px-3.5 py-2.5">
        <p className="mono-label text-foreground/35">Mot de passe</p>
        <p className="mt-0.5 font-mono text-[15px] font-bold">
          {shown ? c.password : "••••••••"}
        </p>
      </div>

      <div className="flex gap-2">
        <CopyButton
          label="Copier"
          icon={<Copy className="size-3.5" />}
          text={message(c, origin)}
          primary
        />
        <CopyButton label="Lien" icon={<Link2 className="size-3.5" />} text={lien(c, origin)} />
      </div>
    </div>
  );
}

export default function ComptesPage() {
  const session = useSession();
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  // Origine lue paresseusement : elle ne sert que dans les textes copiés,
  // jamais dans le rendu — aucun risque d'écart à l'hydratation.
  const [origin] = useState(() =>
    typeof window === "undefined" ? "" : window.location.origin
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await supabase().auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        setError(
          "Reconnecte-toi (Réglages → Mon compte → déconnexion, puis reconnexion) : cette page a besoin d'une session serveur."
        );
        setLoading(false);
        return;
      }
      const res = await fetch("/api/comptes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const json = await res.json();
      if (json.error) setError(json.error);
      else setComptes(json.accounts as Compte[]);
    } catch {
      setError("Le serveur n'a pas répondu.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.admin) return;
    // Micro-tâche : pas de setState synchrone dans le corps de l'effet.
    Promise.resolve().then(load);
  }, [session?.admin, load]);

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Cette page est réservée à l&apos;admin de la ligue.
      </div>
    );
  }

  const filtered = (comptes ?? []).filter((c) =>
    `${c.name} ${c.user}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Les accès</h1>
        <p className="mt-1 text-[13px] text-foreground/42">
          Une fenêtre par joueur · « Copier » prépare le message, « Lien » sa page
          d&apos;accueil personnelle
        </p>
      </div>

      <p className="glass-soft rounded-2xl px-4 py-3 text-[12.5px] leading-snug text-foreground/50">
        Envoie chaque accès <strong className="text-foreground">en privé</strong>, un joueur à
        la fois : le lien affiche un mot de passe, il ne doit pas atterrir dans le groupe.
      </p>

      {/* Recherche */}
      <div className="glass-soft flex items-center gap-2.5 rounded-full px-4 py-3">
        <Search className="size-4 shrink-0 text-foreground/35" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Chercher un joueur…"
          className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-foreground/30"
        />
        {comptes && (
          <span className="mono-label shrink-0 text-foreground/35">
            {filtered.length}/{comptes.length}
          </span>
        )}
      </div>

      {loading && (
        <p className="flex items-center justify-center gap-2 py-8 text-[13px] text-foreground/40">
          <Loader2 className="size-4 animate-spin" /> Chargement des accès…
        </p>
      )}

      {error && (
        <div className="glass-soft rounded-2xl p-4">
          <p className="text-[12.5px] leading-snug text-[#FF6B5E]">{error}</p>
          <button
            onClick={load}
            className="glass-soft mono-label mt-3 rounded-full px-3 py-1.5 text-foreground/60"
          >
            Réessayer
          </button>
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {filtered.map((c) => (
          <CarteCompte key={c.user} c={c} origin={origin} />
        ))}
      </div>

      {comptes && filtered.length === 0 && !loading && (
        <p className="py-8 text-center text-[13px] text-foreground/40">Aucun joueur trouvé.</p>
      )}
    </div>
  );
}
