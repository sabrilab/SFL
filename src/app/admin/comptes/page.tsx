"use client";

// Les accès de la ligue — une fenêtre par joueur.
//
// Chaque joueur a son petit bloc : en-tête avec son nom, corps monospace avec
// son identifiant. Une recherche en tête pour retrouver quelqu'un sans
// dérouler les 71.
//
// Il n'y a plus de mot de passe à lire ici : personne ne les connaît, à part
// chaque joueur pour le sien. Jusqu'au 22/10/2026 la page montrait les mots
// de passe d'origine — les mêmes que le dépôt public. Pour un joueur qui a
// perdu le sien, l'admin demande un mot de passe PROVISOIRE
// (/api/comptes/reinitialiser) : il s'affiche une fois, dans la fenêtre, prêt
// à copier ; le joueur en choisit un à lui en se connectant.
//
// Tout passe par les routes /api/comptes*, qui exigent la session de l'admin.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { cn } from "@/lib/utils";
import { BoutonRetour } from "@/components/layout/bouton-retour";

interface Compte {
  name: string;
  user: string;
  /** Ajouté à l'effectif en cours de saison, hors liste d'origine. */
  ajoute?: boolean;
  /** Dans l'effectif, mais pas encore inscrit côté serveur. */
  sansCompte?: boolean;
  /** Doit encore choisir son mot de passe. */
  aChanger?: "origine" | "provisoire";
}

async function appel(route: string, corps?: Record<string, unknown>) {
  const jeton = await jetonServeur();
  const res = await fetch(route, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}),
    },
    body: JSON.stringify(corps ?? {}),
  });
  return { res, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Ce que copie l'icône : de quoi entrer une fois. */
function bloc(c: Compte, provisoire: string) {
  return `${c.name}\nIdentifiant : ${c.user}\nMot de passe provisoire : ${provisoire}`;
}

function Fenetre({
  c,
  provisoire,
  onProvisoire,
}: {
  c: Compte;
  provisoire?: string;
  onProvisoire: (name: string, password: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmer, setConfirmer] = useState(false);
  const [busy, setBusy] = useState(false);

  function copier() {
    if (!provisoire) return;
    navigator.clipboard
      ?.writeText(bloc(c, provisoire))
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => toast.error("Copie impossible"));
  }

  async function donnerProvisoire() {
    setBusy(true);
    try {
      const { json } = await appel("/api/comptes/reinitialiser", { name: c.name });
      if (typeof json.password === "string") onProvisoire(c.name, json.password);
      else toast.error(typeof json.error === "string" ? json.error : "Impossible pour l'instant.");
    } catch {
      toast.error("Le serveur n'a pas répondu.");
    }
    setBusy(false);
    setConfirmer(false);
  }

  return (
    <div className="glass overflow-hidden rounded-[18px]">
      {/* En-tête de la fenêtre : nom du joueur, état, copier */}
      <div className="flex items-center gap-2.5 border-b border-contraste/8 px-3.5 py-2.5">
        <span className="flex shrink-0 gap-1.5">
          {["bg-contraste/22", "bg-contraste/14", "bg-contraste/10"].map((bg) => (
            <span key={bg} className={cn("size-2 rounded-full", bg)} />
          ))}
        </span>
        <span className="min-w-0 flex-1 truncate text-ligne font-bold tracking-tight">
          {c.name}
        </span>
        {c.sansCompte ? (
          <span className="mono-label shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-400">
            À inscrire
          </span>
        ) : c.aChanger && !provisoire ? (
          <span className="mono-label shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-encre-3">
            Mot de passe à choisir
          </span>
        ) : (
          c.ajoute && (
            <span className="mono-label shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-primary">
              Nouveau
            </span>
          )
        )}
        {provisoire && (
          <button
            onClick={copier}
            aria-label={`Copier les accès de ${c.name}`}
            className={cn(
              "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-petit font-bold",
              copied ? "bouton-principal bouton--vert" : "bouton-secondaire bouton--mauve"
            )}
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copié" : "Copier"}
          </button>
        )}
      </div>

      {/* Le corps monospace */}
      <pre className="overflow-x-auto px-3.5 py-3 font-mono text-corps leading-[1.8] text-encre-2">
        <span className="text-encre-4">Identifiant  </span>
        <span className="font-bold text-foreground">{c.user}</span>
        {provisoire && (
          <>
            {"\n"}
            <span className="text-encre-4">Provisoire   </span>
            <span className="font-bold text-primary">{provisoire}</span>
          </>
        )}
      </pre>

      {!c.sansCompte && !provisoire && (
        <div className="px-3.5 pb-3">
          <button
            onClick={() => (confirmer ? void donnerProvisoire() : setConfirmer(true))}
            disabled={busy}
            className={cn(
              "flex w-full items-center justify-center gap-1.5 py-2 text-petit font-semibold",
              confirmer ? "bouton-principal bouton--vert" : "bouton-secondaire bouton--vert"
            )}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <KeyRound className="size-3.5" />}
            {confirmer ? "Confirmer : l'ancien ne marchera plus" : "Mot de passe provisoire"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ComptesPage() {
  const session = useSession();
  const [comptes, setComptes] = useState<Compte[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  /** Les mots de passe provisoires tirés pendant cette visite, par joueur. */
  const [provisoires, setProvisoires] = useState<Record<string, string>>({});
  const [inscription, setInscription] = useState<{
    faits: number;
    total: number;
    erreur: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Le serveur est le seul juge : on lui transmet le jeton s'il existe et
      // on affiche sa réponse. Pas de contrôle dupliqué côté navigateur.
      const { res, json } = await appel("/api/comptes");
      if (typeof json.error === "string") {
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

  const retenir = useCallback((name: string, password: string) => {
    setProvisoires((p) => ({ ...p, [name]: password }));
  }, []);

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-encre-3">
        Cette page est réservée à l&apos;admin de la ligue.
      </div>
    );
  }

  const manquants = (comptes ?? []).filter((c) => c.sansCompte);
  const aChoisir = (comptes ?? []).filter((c) => c.aChanger && !provisoires[c.name]).length;

  /**
   * Inscrit ceux qui n'ont pas encore de compte. En série et sans se
   * presser : le plan gratuit de Supabase n'aime pas les rafales, et un
   * échec au milieu ne doit pas emporter les suivants.
   */
  async function inscrireManquants() {
    setInscription({ faits: 0, total: manquants.length, erreur: null });
    let faits = 0;
    for (const c of manquants) {
      try {
        const { json } = await appel("/api/comptes/creer", { name: c.name });
        if (typeof json.error === "string") {
          setInscription({ faits, total: manquants.length, erreur: json.error });
          return;
        }
        if (typeof json.password === "string") retenir(c.name, json.password);
        faits += 1;
        setInscription({ faits, total: manquants.length, erreur: null });
      } catch {
        setInscription({ faits, total: manquants.length, erreur: "Serveur injoignable." });
        return;
      }
      await new Promise((r) => setTimeout(r, 250));
    }
    setInscription(null);
    await load();
    toast.success(`${faits} compte${faits > 1 ? "s" : ""} créé${faits > 1 ? "s" : ""}`);
  }

  const filtered = (comptes ?? []).filter((c) =>
    `${c.name} ${c.user}`.toLowerCase().includes(q.trim().toLowerCase())
  );

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <div>
          <h1 className="text-titre-l font-bold tracking-tight">Les accès</h1>
          <p className="mt-1 text-corps text-encre-3">
            Une fenêtre par joueur · un mot de passe provisoire s&apos;il a perdu le sien
          </p>
        </div>
      </div>

      {/* Recherche — pour ne pas dérouler les 71 à chaque fois */}
      {comptes && (
        <div className="glass-soft flex items-center gap-2.5 rounded-full px-4 py-3">
          <Search className="size-4 shrink-0 text-encre-4" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Chercher un joueur…"
            className="min-w-0 flex-1 bg-transparent text-ligne font-medium outline-none placeholder:text-encre-4"
          />
          <span className="mono-label shrink-0 text-encre-4">
            {filtered.length}/{comptes.length}
          </span>
        </div>
      )}

      {loading && (
        <p className="flex items-center justify-center gap-2 py-10 text-corps text-encre-3">
          <Loader2 className="size-4 animate-spin" /> Chargement des accès…
        </p>
      )}

      {error && (
        <div className="glass-soft rounded-2xl p-4">
          <p className="text-corps leading-snug text-[#c8352b] dark:text-[#FF6B5E]">{error}</p>
          <button
            onClick={load}
            className="bouton-secondaire mono-label mt-3 px-3 py-1.5"
          >
            Réessayer
          </button>
        </div>
      )}

      {comptes && aChoisir > 0 && (
        <p className="px-1 text-corps leading-snug text-encre-3">
          {aChoisir > 1
            ? `${aChoisir} joueurs doivent encore choisir leur mot de passe : l'app le leur demande à la prochaine ouverture.`
            : "1 joueur doit encore choisir son mot de passe : l'app le lui demande à la prochaine ouverture."}
        </p>
      )}

      {/* Ceux dont l'inscription reste à faire : tant que le compte n'existe
          pas côté serveur, la personne ne peut pas entrer. */}
      {manquants.length > 0 && (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 px-3.5 py-3">
          <p className="text-corps leading-snug text-amber-700 dark:text-amber-300">
            <b className="font-semibold">
              {manquants.length} joueur{manquants.length > 1 ? "s" : ""} sans compte.
            </b>{" "}
            {manquants.length > 1
              ? "Leur identifiant est prêt, mais ils ne pourront pas se connecter tant que l'inscription n'est pas faite."
              : "Son identifiant est prêt, mais il ne pourra pas se connecter tant que l'inscription n'est pas faite."}
          </p>
          <button
            onClick={() => void inscrireManquants()}
            disabled={!!inscription && !inscription.erreur}
            className="bouton-principal bouton--vert mt-2.5 w-full py-2.5 text-ligne font-bold disabled:opacity-50"
          >
            {inscription && !inscription.erreur
              ? `Inscription… ${inscription.faits}/${inscription.total}`
              : manquants.length > 1
                ? `Créer les ${manquants.length} comptes manquants`
                : "Créer le compte manquant"}
          </button>
          {inscription?.erreur && (
            <p className="mt-2 text-corps leading-snug text-red-600 dark:text-red-300">
              Arrêté après {inscription.faits} sur {inscription.total} — {inscription.erreur}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5 sm:grid sm:grid-cols-2">
        {filtered.map((c) => (
          <Fenetre key={c.user} c={c} provisoire={provisoires[c.name]} onProvisoire={retenir} />
        ))}
      </div>

      {comptes && filtered.length === 0 && !loading && (
        <p className="py-8 text-center text-corps text-encre-3">Aucun joueur trouvé.</p>
      )}

      {comptes && (
        <p className="px-1 pb-2 text-petit leading-relaxed text-encre-4">
          Un mot de passe provisoire ne s&apos;affiche qu&apos;ici, pendant cette visite :
          envoie-le en privé. Le joueur en choisit un à lui en se connectant.
        </p>
      )}
    </div>
  );
}
