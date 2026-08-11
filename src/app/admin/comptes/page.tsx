"use client";

// Les accès de la ligue — une fenêtre de code par joueur.
//
// Chaque joueur a son petit bloc : en-tête avec son nom et l'icône copier
// (qui copie l'identifiant et le mot de passe de CE joueur), corps monospace.
// On défile, on copie, on envoie. Une recherche en tête pour retrouver
// quelqu'un sans dérouler les 71.
//
// Les mots de passe en clair ne sont pas dans le bundle : ils viennent de
// /api/comptes, qui exige une session serveur d'admin.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface Compte {
  name: string;
  user: string;
  password: string;
}

/** Le contenu du bloc — c'est exactement ce que copie l'icône. */
function bloc(c: Compte) {
  return `Identifiant : ${c.user}\nMot de passe : ${c.password}`;
}

function Fenetre({ c }: { c: Compte }) {
  const [copied, setCopied] = useState(false);

  function copier() {
    navigator.clipboard
      ?.writeText(bloc(c))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => toast.error("Copie impossible"));
  }

  return (
    <div className="glass overflow-hidden rounded-[18px]">
      {/* En-tête de la fenêtre : nom du joueur + icône copier */}
      <div className="flex items-center gap-2.5 border-b border-white/8 px-3.5 py-2.5">
        <span className="flex shrink-0 gap-1.5">
          {["rgba(255,255,255,0.22)", "rgba(255,255,255,0.14)", "rgba(255,255,255,0.1)"].map(
            (bg) => (
              <span key={bg} className="size-2 rounded-full" style={{ background: bg }} />
            )
          )}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold tracking-tight">
          {c.name}
        </span>
        <button
          onClick={copier}
          aria-label={`Copier les accès de ${c.name}`}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11.5px] font-bold transition-colors",
            copied ? "bg-primary text-primary-foreground" : "glass-soft text-foreground/60"
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copié" : "Copier"}
        </button>
      </div>

      {/* Le corps monospace */}
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-[12.5px] leading-[1.8] text-foreground/80">
        <span className="text-foreground/35">Identifiant  </span>
        <span className="font-bold text-foreground">{c.user}</span>
        {"\n"}
        <span className="text-foreground/35">Mot de passe </span>
        <span className="font-bold text-primary">{c.password}</span>
      </pre>
    </div>
  );
}

export default function ComptesPage() {
  const session = useSession();
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Le serveur est le seul juge : on lui transmet le jeton s'il existe et
      // on affiche sa réponse. Pas de contrôle dupliqué côté navigateur.
      const { data } = await supabase().auth.getSession();
      const accessToken = data.session?.access_token ?? null;
      const res = await fetch("/api/comptes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessToken }),
      });
      const json = await res.json();
      if (json.error) {
        setError(
          res.status === 401
            ? "Reconnecte-toi (Réglages → Mon compte → déconnexion, puis reconnexion) : cette page a besoin d'une session serveur."
            : json.error
        );
      } else {
        setComptes(json.accounts as Compte[]);
      }
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
          Une fenêtre par joueur · touche l&apos;icône pour copier ses identifiants
        </p>
      </div>

      {/* Recherche — pour ne pas dérouler les 71 à chaque fois */}
      {comptes && (
        <div className="glass-soft flex items-center gap-2.5 rounded-full px-4 py-3">
          <Search className="size-4 shrink-0 text-foreground/35" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un joueur…"
            className="min-w-0 flex-1 bg-transparent text-[14px] font-medium outline-none placeholder:text-foreground/30"
          />
          <span className="mono-label shrink-0 text-foreground/35">
            {filtered.length}/{comptes.length}
          </span>
        </div>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-foreground/40">
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

      {/* Les fenêtres, une par joueur */}
      <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2">
        {filtered.map((c) => (
          <Fenetre key={c.user} c={c} />
        ))}
      </div>

      {comptes && filtered.length === 0 && !loading && (
        <p className="py-8 text-center text-[13px] text-foreground/40">Aucun joueur trouvé.</p>
      )}

      {comptes && (
        <p className="px-1 pb-2 text-[12px] leading-relaxed text-foreground/35">
          Envoie chaque accès en privé : rappelle à chacun de changer son mot de passe dans
          Réglages → Mon compte.
        </p>
      )}
    </div>
  );
}
