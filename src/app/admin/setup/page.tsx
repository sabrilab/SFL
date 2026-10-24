"use client";

// Installation Supabase — ce qu'il en reste : la base de données.
//
// Le schéma (supabase/schema.sql) s'applique tout seul à chaque mise en ligne
// (scripts/prebuild.ts). Cette page le vérifie, le rejoue à la demande et
// garde le copier-coller en repli, si la base n'est pas joignable depuis
// Vercel. Tout passe par /api/migrate, avec le jeton de session de l'admin.
//
// L'installation d'origine (les 71 comptes créés avec leurs mots de passe
// d'origine, la convocation publiée en se connectant comme l'admin) n'existe
// plus depuis le 22/10/2026 : la route qui le faisait, /api/setup, n'avait
// aucun contrôle d'accès. Les comptes se créent dans Admin → Les accès.

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { jetonServeur } from "@/lib/sfl/auth/session";
import { cn } from "@/lib/utils";
import { BoutonRetour } from "@/components/layout/bouton-retour";

const DASHBOARD = "https://supabase.com/dashboard/project/tpfusliksgxcvfrodchk";

async function appelMigration(method: "GET" | "POST"): Promise<Response> {
  const jeton = await jetonServeur();
  return fetch("/api/migrate", {
    method,
    headers: jeton ? { Authorization: `Bearer ${jeton}` } : {},
    cache: "no-store",
  });
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
            : "bg-[#FF6B5E]/12 text-[#c8352b] dark:text-[#FF6B5E]"
      )}
    >
      {label}
    </span>
  );
}

export default function SetupPage() {
  const session = useSession();
  const [checking, setChecking] = useState(false);
  const [db, setDb] = useState<string | null>(null);
  const [dbMessage, setDbMessage] = useState<string | null>(null);

  const verifier = useCallback(async () => {
    setChecking(true);
    try {
      const r = await appelMigration("POST");
      const j = (await r.json()) as { status?: string; message?: string; error?: string };
      setDb(j.status ?? "error");
      setDbMessage(j.message ?? j.error ?? null);
    } catch {
      setDb("error");
      setDbMessage("Le serveur n'a pas répondu.");
    }
    setChecking(false);
  }, []);

  // Migration automatique : à l'ouverture de la page, le serveur applique le
  // schéma s'il a changé (sans variable de connexion, il répond
  // « not-configured » et le copier-coller reste le repli).
  useEffect(() => {
    if (!session?.admin) return;
    // Micro-tâche : pas de setState synchrone dans le corps de l'effet.
    Promise.resolve().then(verifier);
  }, [session?.admin, verifier]);

  async function copierSchema() {
    try {
      const res = await appelMigration("GET");
      if (!res.ok) throw new Error(String(res.status));
      await navigator.clipboard.writeText(await res.text());
      toast.success("Script SQL copié — colle-le dans l'éditeur Supabase, puis Run.");
    } catch {
      toast.error("Copie impossible.");
    }
  }

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Cette page est réservée à l&apos;admin de la ligue.
      </div>
    );
  }

  const aJour = db === "applied" || db === "up-to-date";

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Installation Supabase</h1>
          <p className="mt-1 text-[13px] text-foreground/42">
            Le schéma de la base s&apos;applique tout seul à chaque mise en ligne.
          </p>
        </div>
      </div>

      <section className="glass flex flex-wrap items-center gap-2 rounded-[22px] p-4">
        <Pill
          ok={db === null ? null : aJour}
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
          onClick={() => void verifier()}
          disabled={checking}
          className="bouton-secondaire mono-label ml-auto flex items-center gap-1.5 px-3 py-1.5"
        >
          {checking ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Vérifier
        </button>
      </section>

      {db === "error" && dbMessage && (
        <p className="glass-soft rounded-2xl p-3.5 font-mono text-[11px] leading-relaxed break-all text-[#c8352b] dark:text-[#FF6B5E]">
          Migration : {dbMessage}
        </p>
      )}

      <section className="glass rounded-[26px] p-5">
        <h2 className="text-[17px] font-bold tracking-tight">Les tables</h2>
        <div className="mt-3.5 flex flex-col gap-3 text-[13.5px] leading-relaxed text-foreground/60">
          {aJour ? (
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
              <strong className="text-foreground">Run</strong>.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={copierSchema}
              className="bouton-principal flex items-center gap-2 px-4 py-2.5 text-[13px] font-bold"
            >
              <Copy className="size-3.5" /> Copier le script SQL
            </button>
            <a
              href={`${DASHBOARD}/sql/new`}
              target="_blank"
              rel="noreferrer"
              className="bouton-secondaire flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold"
            >
              Ouvrir l&apos;éditeur SQL <ExternalLink className="size-3.5" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
