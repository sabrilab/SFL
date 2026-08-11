"use client";

// Page d'accueil personnelle — la destination du lien que l'admin envoie à
// chaque joueur : /bienvenue?u=identifiant&p=motdepasse
//
// Elle ne fait qu'AFFICHER joliment ce que le lien porte déjà : aucun accès à
// la base, aucune liste, rien à deviner. Le lien vaut exactement ce que vaut
// le message qui le transporte — un lien qui n'est pas le sien n'apprend rien
// sur les autres comptes.
//
// Elle vit hors de la porte de connexion (voir AuthGate) : c'est le premier
// écran qu'un joueur voit, avant même d'avoir un compte en tête.

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

function Field({
  label,
  value,
  secret = false,
}: {
  label: string;
  value: string;
  secret?: boolean;
}) {
  const [shown, setShown] = useState(!secret);
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      })
      .catch(() => {});
  }

  return (
    <div className="glass-soft flex items-center gap-3 rounded-[18px] px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="mono-label text-foreground/40">{label}</p>
        <p className="mt-1 truncate font-mono text-[17px] font-bold">
          {shown ? value : "•".repeat(Math.max(6, value.length))}
        </p>
      </div>
      {secret && (
        <button
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? "Masquer" : "Afficher"}
          className="shrink-0 text-foreground/40"
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      )}
      <button
        onClick={copy}
        aria-label={`Copier ${label}`}
        className={cn(
          "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-bold transition-colors",
          copied ? "bg-primary text-primary-foreground" : "bg-foreground text-background"
        )}
      >
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}

function Bienvenue() {
  const params = useSearchParams();
  const user = params.get("u") ?? "";
  const password = params.get("p") ?? "";
  const name = params.get("n") ?? "";

  if (!user || !password) {
    return (
      <div className="mx-auto w-full max-w-sm px-6 py-16 text-center">
        <p className="mono-label text-primary">Sunday Five League</p>
        <h1 className="mt-2 text-[26px] font-extrabold tracking-tight">Lien incomplet</h1>
        <p className="mt-3 text-[13.5px] leading-snug text-foreground/45">
          Demande à Ilyes de te renvoyer ton lien d&apos;accès personnel.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-foreground px-6 py-3.5 text-[15px] font-bold text-background"
        >
          Ouvrir l&apos;app
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-12">
      <p className="mono-label text-primary">Sunday Five League</p>
      <h1 className="mt-2 text-[32px] leading-[1.08] font-extrabold tracking-tight">
        {name ? `Salut ${name},` : "Salut,"}
        <br />
        voici ton accès.
      </h1>
      <p className="mt-3 text-[13.5px] leading-snug text-foreground/45">
        Ta carte, tes points, et surtout : dis si tu viens dimanche. Garde ces
        identifiants — tu pourras changer ton mot de passe une fois connecté.
      </p>

      <div className="mt-7 flex flex-col gap-2.5">
        <Field label="Identifiant" value={user} />
        <Field label="Mot de passe" value={password} secret />
      </div>

      <Link
        href="/"
        className="mt-5 block rounded-full bg-foreground py-4 text-center text-[15px] font-bold text-background transition-transform active:scale-[0.98]"
      >
        Entrer dans la ligue
      </Link>

      <p className="mt-6 text-[12px] leading-relaxed text-foreground/30">
        Ce lien t&apos;est personnel : ne le fais pas suivre. Une fois connecté, va dans
        Réglages → Mon compte pour choisir ton propre mot de passe.
      </p>
    </div>
  );
}

export default function BienvenuePage() {
  return (
    <div
      className="flex min-h-dvh flex-col justify-center"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Suspense fallback={null}>
        <Bienvenue />
      </Suspense>
    </div>
  );
}
