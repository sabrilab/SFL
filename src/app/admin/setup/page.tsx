"use client";

// Installation Supabase — la page qui guide l'admin de bout en bout, depuis
// son téléphone : réveiller le projet, coller le schéma SQL, créer les 71
// comptes (ici même, en série), poser le rôle admin, publier la convocation,
// puis refermer les inscriptions.
//
// La création des comptes passe par un client SANS persistance de session :
// chaque signUp se fait « en tant que » le joueur créé, sans jamais écraser la
// session de l'admin.

import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useSession } from "@/hooks/use-session";
import { loginEmail, supabase, supabaseEphemeral, SUPABASE_URL } from "@/lib/supabase";
import { username } from "@/lib/sfl/usernames";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { cn } from "@/lib/utils";

const DASHBOARD = "https://supabase.com/dashboard/project/tpfusliksgxcvfrodchk";
const ADMIN_SQL = "update public.profiles set is_admin = true where username = '@ilyes';";

type Etat = {
  joignable: boolean | null;
  tables: boolean | null;
  comptes: number | null;
};

type LigneCompte = { name: string; user: string; password: string };

/** Parse les lignes `| Nom | \`user\` | \`motdepasse\` | … |` de COMPTES.md. */
function parseComptes(text: string): LigneCompte[] {
  const rows: LigneCompte[] = [];
  for (const line of text.split("\n")) {
    const m = line.match(/^\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|\s*`([^`]+)`\s*\|/);
    if (m && m[1] !== "Joueur") rows.push({ name: m[1], user: m[2], password: m[3] });
  }
  return rows;
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

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
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
  const [etat, setEtat] = useState<Etat>({ joignable: null, tables: null, comptes: null });
  const [checking, setChecking] = useState(false);

  const [pasted, setPasted] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [bilan, setBilan] = useState<{ crees: number; existants: number; erreurs: string[] } | null>(
    null
  );

  async function verifier() {
    setChecking(true);
    const next: Etat = { joignable: null, tables: null, comptes: null };
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/health`, { cache: "no-store" });
      next.joignable = res.ok;
    } catch {
      next.joignable = false;
    }
    if (next.joignable) {
      const { count, error } = await supabase()
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (!error) {
        next.tables = true;
        next.comptes = count ?? 0;
      } else if (/does not exist|schema cache|PGRST205/i.test(error.message)) {
        next.tables = false;
      } else {
        // Permission refusée = la table existe mais on n'est pas connecté au
        // serveur : c'est déjà une réponse.
        next.tables = true;
      }
    }
    setEtat(next);
    setChecking(false);
  }

  async function copierSchema() {
    try {
      const res = await fetch("/supabase-schema.sql", { cache: "no-store" });
      const sql = await res.text();
      await navigator.clipboard.writeText(sql);
      toast.success("Script SQL copié — colle-le dans l'éditeur Supabase.");
    } catch {
      toast.error("Copie impossible. Ouvre supabase/schema.sql sur GitHub.");
    }
  }

  async function creerComptes() {
    const lignes = parseComptes(pasted);
    if (lignes.length === 0) {
      toast.error("Colle d'abord le tableau de docs/COMPTES.md (les lignes | … |).");
      return;
    }
    setSeeding(true);
    setBilan(null);
    let crees = 0;
    let existants = 0;
    const erreurs: string[] = [];

    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i];
      setProgress(`${i + 1}/${lignes.length} · ${l.name}`);
      try {
        const { error } = await supabaseEphemeral().auth.signUp({
          email: loginEmail(l.user),
          password: l.password,
          options: { data: { name: l.name, username: username(l.name) } },
        });
        if (!error) crees += 1;
        else if (/already registered|already exists/i.test(error.message)) existants += 1;
        else if (/rate limit/i.test(error.message)) {
          // Limite d'inscriptions atteinte : on souffle 25 s puis on retente une fois.
          setProgress(`Limite atteinte — pause 25 s… (${l.name})`);
          await new Promise((r) => setTimeout(r, 25000));
          const retry = await supabaseEphemeral().auth.signUp({
            email: loginEmail(l.user),
            password: l.password,
            options: { data: { name: l.name, username: username(l.name) } },
          });
          if (!retry.error) crees += 1;
          else erreurs.push(`${l.name} : ${retry.error.message}`);
        } else erreurs.push(`${l.name} : ${error.message}`);
      } catch {
        erreurs.push(`${l.name} : réseau`);
      }
      // Rythme volontairement calme pour rester sous les limites du plan gratuit.
      await new Promise((r) => setTimeout(r, 400));
    }

    setProgress(null);
    setSeeding(false);
    setBilan({ crees, existants, erreurs });
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
          Six étapes, une seule fois. À la fin : présence partagée, en direct, pour toute la
          ligue.
        </p>
      </div>

      {/* État */}
      <section className="glass flex flex-wrap items-center gap-2 rounded-[22px] p-4">
        <Pill ok={etat.joignable} label={etat.joignable === false ? "Projet injoignable" : "Projet"} />
        <Pill ok={etat.tables} label={etat.tables === false ? "Tables à créer" : "Tables"} />
        <Pill
          ok={etat.comptes === null ? null : etat.comptes > 0}
          label={etat.comptes === null ? "Comptes" : `${etat.comptes} comptes`}
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

      <Step n={1} title="Réveiller le projet et ouvrir les inscriptions">
        <p>
          Sur le tableau de bord Supabase : si le projet est en pause, touche{" "}
          <strong className="text-foreground">Restore project</strong>. Puis dans{" "}
          <strong className="text-foreground">Authentication → Sign In / Providers → Email</strong>,
          désactive <strong className="text-foreground">Confirm email</strong> (nos identifiants
          sont des emails techniques, personne ne peut recevoir de mail de confirmation).
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

      <Step n={2} title="Créer les tables (un copier-coller)">
        <p>
          Copie le script, ouvre l&apos;éditeur SQL, colle, puis touche{" "}
          <strong className="text-foreground">Run</strong>. Le script est réexécutable sans danger.
        </p>
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

      <Step n={3} title="Créer les 71 comptes">
        <p>
          Colle ici le tableau de <strong className="text-foreground">docs/COMPTES.md</strong>{" "}
          (je te l&apos;ai envoyé en fichier) puis lance. Les comptes déjà créés sont simplement
          ignorés : tu peux relancer autant de fois que nécessaire.
        </p>
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={5}
          placeholder="| Abdel | `abdel` | `pivot92` | Actif |&#10;| Adel | `adel` | `sprint74` | Actif |&#10;…"
          className="glass-soft w-full rounded-2xl px-3.5 py-3 font-mono text-[12px] leading-relaxed outline-none placeholder:text-foreground/25"
        />
        <div className="flex items-center gap-3">
          <button
            onClick={creerComptes}
            disabled={seeding}
            className={cn(
              "flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-[13px] font-bold text-background",
              seeding && "opacity-50"
            )}
          >
            {seeding ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {seeding ? "Création en cours…" : `Créer les comptes (${parseComptes(pasted).length || "0"})`}
          </button>
          {progress && <span className="mono-label text-foreground/50">{progress}</span>}
        </div>
        {bilan && (
          <div className="glass-soft rounded-2xl p-3.5 text-[12.5px]">
            <p>
              <span className="font-bold text-primary">{bilan.crees} créés</span> ·{" "}
              {bilan.existants} existaient déjà · {bilan.erreurs.length} erreur
              {bilan.erreurs.length > 1 ? "s" : ""}
            </p>
            {bilan.erreurs.slice(0, 5).map((e) => (
              <p key={e} className="mt-1 text-[#FF6B5E]">
                {e}
              </p>
            ))}
          </div>
        )}
      </Step>

      <Step n={4} title="Poser le rôle admin">
        <p>
          Dans l&apos;éditeur SQL, exécute cette ligne (elle est aussi à la fin du script de
          l&apos;étape 2 — la relancer suffit) :
        </p>
        <button
          onClick={() =>
            navigator.clipboard.writeText(ADMIN_SQL).then(() => toast.success("Ligne SQL copiée"))
          }
          className="glass-soft flex items-center gap-2 self-start rounded-2xl px-3.5 py-2.5 text-left font-mono text-[11.5px] text-foreground/70"
        >
          <Copy className="size-3.5 shrink-0" /> {ADMIN_SQL}
        </button>
      </Step>

      <Step n={5} title="Se reconnecter, puis publier la convocation">
        <p>
          Déconnecte-toi (Réglages → Mon compte), reconnecte-toi avec ton identifiant : ta
          session passe alors par le serveur. Sur le fil, le panneau{" "}
          <strong className="text-foreground">Ma présence</strong> te proposera « Publier la
          convocation » — à partir de là, toute la ligue répond dans la même liste, en direct.
        </p>
      </Step>

      <Step n={6} title="Refermer les inscriptions">
        <p>
          Dernière chose, importante : dans{" "}
          <strong className="text-foreground">Authentication → Sign In / Providers</strong>,
          désactive <strong className="text-foreground">Allow new users to sign up</strong>.
          Les 71 comptes existent, personne d&apos;autre ne doit pouvoir s&apos;en créer un.
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

      <p className="px-1 text-[12px] leading-relaxed text-foreground/35">
        {ACCOUNTS.length} comptes attendus. Quand tout est vert, dis-le-moi : je verrouille
        alors la connexion sur le serveur uniquement (le repli local disparaît).
      </p>
    </div>
  );
}
