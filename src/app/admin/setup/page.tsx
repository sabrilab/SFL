"use client";

// Installation Supabase — presque tout est automatique.
//
// La création des 71 comptes et la publication de la convocation sont faites
// par le serveur de l'app (/api/setup) : l'admin appuie sur UN bouton.
// Ne restent à sa charge que ce que Supabase impose de faire dans SON tableau
// de bord : réveiller le projet, décocher « Confirm email », coller le schéma
// SQL, puis refermer les inscriptions à la fin.

import { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Rocket } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { useSeason } from "@/components/sfl/season-provider";
import { activeConvocation } from "@/lib/sfl/saisie/mutations";
import { NEXT_MATCH } from "@/lib/sfl/data";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { cn } from "@/lib/utils";

const DASHBOARD = "https://supabase.com/dashboard/project/tpfusliksgxcvfrodchk";

interface Status {
  reachable?: boolean;
  adminLogin?: boolean;
  profiles?: number;
  convocation?: number | null;
  detail?: string;
}

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/setup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json();
}

function Pill({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <span
      className={cn(
        "mono-label rounded-full px-2.5 py-1",
        ok === null
          ? "glass-soft text-foreground/40"
          : ok
            ? "bg-primary/15 text-primary"
            : "bg-[#FF6B5E]/12 text-[#FF6B5E]"
      )}
    >
      {label}
    </span>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-[26px] p-5">
      <div className="flex items-center gap-3">
        <span className="glass-soft flex size-8 shrink-0 items-center justify-center rounded-full text-[14px] font-extrabold">
          {n}
        </span>
        <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
      </div>
      <div className="mt-3.5 flex flex-col gap-3 text-[13.5px] leading-relaxed text-foreground/60">
        {children}
      </div>
    </section>
  );
}

export default function SetupPage() {
  const session = useSession();
  const { saison } = useSeason();
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const [db, setDb] = useState<string | null>(null);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  function runMigrate() {
    return fetch("/api/migrate", { method: "POST" })
      .then((r) => r.json())
      .then((r) => {
        setDb(r.status ?? "error");
        setDbMessage(r.message ?? null);
      })
      .catch(() => {
        setDb("error");
        setDbMessage("Le serveur n'a pas répondu.");
      });
  }

  // Migration automatique : à l'ouverture de la page, le serveur applique le
  // schéma s'il a changé (sans variable de connexion, il répond
  // « not-configured » et le copier-coller reste le repli).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/migrate", { method: "POST" })
      .then((r) => r.json())
      .then((r) => {
        if (cancelled) return;
        setDb(r.status ?? "error");
        setDbMessage(r.message ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setDb("error");
        setDbMessage("Le serveur n'a pas répondu.");
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [bilan, setBilan] = useState<string | null>(null);

  async function verifier() {
    setChecking(true);
    try {
      // La migration d'abord (elle peut débloquer le reste), l'état ensuite.
      await runMigrate();
      setStatus(await api({ action: "status" }));
    } catch {
      setStatus({ reachable: false });
    }
    setChecking(false);
  }

  async function copierSchema() {
    try {
      const res = await fetch("/supabase-schema.sql", { cache: "no-store" });
      await navigator.clipboard.writeText(await res.text());
      toast.success("Script SQL copié — colle-le dans l'éditeur Supabase, puis Run.");
    } catch {
      toast.error("Copie impossible.");
    }
  }

  // LE bouton : crée les 71 comptes par lots, puis publie la convocation.
  async function toutInstaller() {
    setRunning(true);
    setBilan(null);
    let created = 0;
    let existing = 0;
    const errors: string[] = [];
    try {
      let from: number | null = 0;
      while (from !== null) {
        setProgress(`Comptes… ${Math.min(from + 12, ACCOUNTS.length)}/${ACCOUNTS.length}`);
        const r = await api({ action: "seed", from });
        if (r.error) {
          errors.push(r.error);
          break;
        }
        created += r.created ?? 0;
        existing += r.existing ?? 0;
        errors.push(...(r.errors ?? []));
        from = r.next;
      }

      setProgress("Publication de la convocation…");
      const conv = activeConvocation(saison);
      const pub = await api({
        action: "convocation",
        journee: NEXT_MATCH.journee,
        jour: conv?.jour ?? NEXT_MATCH.jour,
        date_label: conv?.date ?? NEXT_MATCH.date,
        heure: conv?.heure ?? NEXT_MATCH.heure,
        lieu: conv?.lieu ?? NEXT_MATCH.lieu,
      });
      const convOk = !pub.error;
      if (pub.error) errors.push(`Convocation : ${pub.error}`);

      setBilan(
        `${created} comptes créés · ${existing} existaient déjà · convocation ${convOk ? "publiée ✓" : "à publier depuis le panneau"}` +
          (errors.length ? ` · ${errors.length} erreur${errors.length > 1 ? "s" : ""}` : "")
      );
      if (errors.length) {
        console.warn("Installation :", errors);
        toast.error(errors[0]);
      } else {
        toast.success("Installation terminée 🎉");
      }
    } catch {
      toast.error("Le serveur n'a pas répondu. Réessaie — ça reprend où c'était.");
    }
    setProgress(null);
    setRunning(false);
    verifier();
  }

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Cette page est réservée à l&apos;admin de la ligue.
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Installation Supabase</h1>
        <p className="mt-1 text-[13px] text-foreground/42">
          Deux réglages, un copier-coller, un bouton. À la fin : présence partagée, en
          direct, pour toute la ligue.
        </p>
      </div>

      {/* État */}
      <section className="glass flex flex-wrap items-center gap-2 rounded-[22px] p-4">
        <Pill
          ok={status ? !!status.reachable : null}
          label={status?.reachable === false ? "Projet injoignable" : "Projet"}
        />
        <Pill
          ok={status ? !!status.adminLogin : null}
          label={status?.adminLogin ? `${status.profiles ?? 0} comptes` : "Comptes"}
        />
        <Pill
          ok={status ? status.convocation != null : null}
          label={status?.convocation != null ? `Convocation J${status.convocation}` : "Convocation"}
        />
        <Pill
          ok={db === null ? null : db === "applied" || db === "up-to-date"}
          label={
            db === "applied"
              ? "Base mise à jour"
              : db === "up-to-date"
                ? "Base à jour"
                : db === "not-configured"
                  ? "Base : manuel"
                  : db === "error"
                    ? "Base : erreur"
                    : "Base"
          }
        />
        <button
          onClick={verifier}
          disabled={checking}
          className="glass-soft mono-label ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/60"
        >
          {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Vérifier
        </button>
      </section>

      {db === "error" && dbMessage && (
        <p className="glass-soft rounded-2xl p-3.5 font-mono text-[11px] leading-relaxed break-all text-[#FF6B5E]">
          Migration : {dbMessage}
        </p>
      )}

      <Step n={1} title="Réveiller le projet, ouvrir la porte">
        <p>
          Sur le tableau de bord : si le projet est en pause, touche{" "}
          <strong className="text-foreground">Restore project</strong>. Puis dans{" "}
          <strong className="text-foreground">Authentication → Sign In / Providers → Email</strong>{" "}
          : décoche <strong className="text-foreground">Confirm email</strong>, et vérifie que{" "}
          <strong className="text-foreground">Allow new users to sign up</strong> est activé
          (le temps de l&apos;installation seulement).
        </p>
        <a
          href={`${DASHBOARD}/auth/providers`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
        >
          Ouvrir les réglages d&apos;authentification <ExternalLink className="size-3.5" />
        </a>
      </Step>

      <Step n={2} title="Créer les tables">
        {db === "applied" || db === "up-to-date" ? (
          <p className="flex items-center gap-2 rounded-2xl bg-primary/10 px-3.5 py-2.5 text-[12.5px] text-primary">
            <Check className="size-3.5 shrink-0" />
            {db === "applied"
              ? "Base mise à jour automatiquement — rien à faire ici."
              : "Base déjà à jour — rien à faire ici."}
          </p>
        ) : (
          <p>
            {db === "not-configured" && (
              <span className="mb-2 block text-[12px] text-foreground/40">
                (Astuce : ajoute SUPABASE_DB_URL dans Vercel et cette étape deviendra
                automatique à chaque déploiement — voir docs/SUPABASE.md.)
              </span>
            )}
            Copie le script, ouvre l&apos;éditeur SQL, colle, puis{" "}
            <strong className="text-foreground">Run</strong>. Le rôle admin est posé
            automatiquement.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={copierSchema}
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background"
          >
            <Copy className="size-3.5" /> Copier le script SQL
          </button>
          <a
            href={`${DASHBOARD}/sql/new`}
            target="_blank"
            rel="noreferrer"
            className="glass-soft flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[13px] font-semibold text-foreground/70"
          >
            Ouvrir l&apos;éditeur SQL <ExternalLink className="size-3.5" />
          </a>
        </div>
      </Step>

      <Step n={3} title="Tout installer — un bouton">
        <p>
          Le serveur crée les {ACCOUNTS.length} comptes (2-3 minutes) puis publie la
          convocation J{NEXT_MATCH.journee}. Si ça s&apos;interrompt, relance : ça reprend où
          c&apos;était.
        </p>
        <button
          onClick={toutInstaller}
          disabled={running}
          className={cn(
            "flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-[15px] font-bold text-background",
            running && "opacity-50"
          )}
        >
          {running ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
          {running ? (progress ?? "Installation…") : "Tout installer"}
        </button>
        {bilan && (
          <p className="glass-soft flex items-start gap-2 rounded-2xl p-3.5 text-[12.5px]">
            <Check className="mt-0.5 size-3.5 shrink-0 text-primary" /> {bilan}
          </p>
        )}
      </Step>

      <Step n={4} title="Refermer la porte">
        <p>
          Retour dans{" "}
          <strong className="text-foreground">Authentication → Sign In / Providers</strong> :
          désactive <strong className="text-foreground">Allow new users to sign up</strong>.
          Les comptes existent, personne d&apos;autre ne doit pouvoir s&apos;en créer un.
        </p>
        <a
          href={`${DASHBOARD}/auth/providers`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 text-[13px] font-semibold text-primary"
        >
          Ouvrir les réglages d&apos;authentification <ExternalLink className="size-3.5" />
        </a>
      </Step>

      <Step n={5} title="Se reconnecter">
        <p>
          Déconnecte-toi (Réglages → Mon compte) et reconnecte-toi : ta session passe par le
          serveur, et le panneau <strong className="text-foreground">Ma présence</strong> du
          fil affiche « En direct — toute la ligue voit cette liste ». C&apos;est gagné.
        </p>
      </Step>
    </div>
  );
}
