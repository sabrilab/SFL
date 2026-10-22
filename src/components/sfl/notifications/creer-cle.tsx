"use client";

// La clé des notifications, créée une fois par l'admin, dans son navigateur.
//
// Tant que le serveur n'a pas VAPID_PRIVATE_KEY, la page d'envoi montre ce
// panneau : un toucher tire une paire P-256 avec WebCrypto, ici même, et
// affiche la moitié privée à coller dans Vercel. Elle ne part nulle part
// d'autre et n'est gardée nulle part : la page oubliée, il n'en reste que la
// copie collée dans Vercel. La clé publique, le serveur la déduit de la
// privée (lib/server/web-push.ts).

import { useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import { toast } from "sonner";

async function nouvelleCle(): Promise<string> {
  const paire = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const jwk = await crypto.subtle.exportKey("jwk", paire.privateKey);
  if (!jwk.d) throw new Error("Clé incomplète.");
  return jwk.d;
}

export function CreerCle() {
  const [cle, setCle] = useState<string | null>(null);

  async function creer() {
    try {
      setCle(await nouvelleCle());
    } catch {
      toast.error("Ce navigateur ne sait pas créer la clé.");
    }
  }

  async function copier() {
    if (!cle) return;
    try {
      await navigator.clipboard.writeText(cle);
      toast.success("Clé copiée");
    } catch {
      toast.error("Copie impossible : sélectionne-la à la main.");
    }
  }

  return (
    <section className="glass flex flex-col gap-3 rounded-3xl p-4">
      <p className="mono-label flex items-center gap-1.5 text-primary">
        <KeyRound className="size-3" /> Clé des notifications
      </p>
      {!cle ? (
        <button
          type="button"
          onClick={creer}
          className="bouton-principal py-[14px] text-[15px] font-bold"
        >
          Créer la clé
        </button>
      ) : (
        <>
          <code className="glass-soft rounded-2xl px-4 py-3 font-mono text-[12px] break-all select-all">{cle}</code>
          <button
            type="button"
            onClick={copier}
            className="bouton-principal flex items-center justify-center gap-2 py-[14px] text-[15px] font-bold"
          >
            <Copy className="size-4" /> Copier
          </button>
          <ol className="list-decimal space-y-1 pl-5 text-[13px] leading-snug text-foreground/60">
            <li>Vercel → projet sfl → Settings → Environment Variables.</li>
            <li>
              Nom <span className="font-mono text-foreground/85">VAPID_PRIVATE_KEY</span>, valeur : la clé copiée,
              environnement Production, type Sensitive.
            </li>
            <li>Deployments → le dernier → Redeploy.</li>
          </ol>
        </>
      )}
    </section>
  );
}
