"use client";

// Le bandeau « connexion non vérifiée ».
//
// La base de la ligue ne s'ouvre qu'aux connexions vérifiées par le serveur.
// Une session locale (mot de passe refusé, jeton expiré, réseau coupé à la
// connexion) ne lit donc plus rien : l'appareil reste figé sur sa dernière
// copie — sans terrains récents, sans cartes à jour — et ses modifications ne
// partent pas. Sans ce bandeau, personne ne le voit. Avec, un geste suffit.

import { RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { signOut } from "@/lib/sfl/auth/session";

export function ConnexionLocale() {
  const session = useSession();
  if (!session || session.server) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-3 z-[60] flex items-center gap-3 rounded-2xl border border-[#ff8a4c]/40 bg-[#1a1210]/95 px-3.5 py-2.5 text-[12.5px] leading-snug text-[#f4f5f2] shadow-[0_10px_30px_rgba(0,0,0,0.5)] backdrop-blur sm:inset-x-auto sm:left-1/2 sm:w-[520px] sm:-translate-x-1/2"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 8px)" }}
    >
      <span className="size-2 shrink-0 rounded-full bg-[#ff8a4c]" aria-hidden />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">Connexion non vérifiée.</strong>{" "}
        {session.refus === "injoignable"
          ? "Le serveur n'a pas répondu"
          : session.refus === "refuse"
            ? "Le serveur a refusé ton mot de passe"
            : "Ta connexion a expiré"}
        {" : "}tu ne vois pas les dernières données de la ligue
        {session.admin ? " et tes modifications ne partent pas" : ""}.
      </p>
      <button
        type="button"
        onClick={() => signOut()}
        className="bouton-principal bouton--vert flex shrink-0 items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold"
      >
        <RefreshCw className="size-3.5" strokeWidth={2.4} /> Me reconnecter
      </button>
    </div>
  );
}
