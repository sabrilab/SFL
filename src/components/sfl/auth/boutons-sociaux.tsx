"use client";

// Les boutons « Google » et « Apple » — à l'inscription et à la connexion.
//
// Ils n'apparaissent que pour les fournisseurs que Supabase a vraiment
// activés (fournisseursActifs) : brancher Apple un jour suffit à faire naître
// son bouton, sans toucher à l'app.
//
// Dans le navigateur intégré d'une app (Snapchat, Instagram…), Google refuse
// la connexion (« disallowed_useragent »), et une session ouverte là resterait
// coincée dans l'app. Le bouton rouvre donc la page dans Safari ou Chrome,
// comme le guide d'installation, et c'est là que le joueur continue.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { connexionSociale, fournisseursActifs, type Fournisseur } from "@/lib/sfl/auth/session";
import { lienSortie, lireEnvironnement } from "@/lib/pwa/environnement";
import { cn } from "@/lib/utils";

function LogoGoogle() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
      <path fill="#EA4335" d="M12 5.3c1.6 0 3 .55 4.1 1.63l3.05-3.05A10.3 10.3 0 0 0 12 1.6 10.4 10.4 0 0 0 2.7 7.33l3.55 2.76A6.2 6.2 0 0 1 12 5.3Z" />
      <path fill="#4285F4" d="M22.19 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.72a4.9 4.9 0 0 1-2.12 3.21l3.43 2.66c2-1.85 3.16-4.57 3.16-7.77Z" />
      <path fill="#FBBC05" d="M6.25 13.9a6.2 6.2 0 0 1 0-3.8L2.7 7.33a10.4 10.4 0 0 0 0 9.34l3.55-2.76Z" />
      <path fill="#34A853" d="M12 22.4c2.8 0 5.16-.92 6.88-2.5l-3.43-2.66c-.95.64-2.17 1.02-3.45 1.02a6.2 6.2 0 0 1-5.75-4.13L2.7 16.67A10.4 10.4 0 0 0 12 22.4Z" />
    </svg>
  );
}

function LogoApple() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px] fill-current" aria-hidden>
      <path d="M16.9 12.9c0-2.2 1.8-3.3 1.9-3.35-1-1.5-2.6-1.7-3.2-1.75-1.35-.14-2.65.8-3.34.8-.7 0-1.76-.78-2.9-.76-1.5.02-2.86.86-3.63 2.2-1.55 2.68-.4 6.65 1.11 8.83.74 1.06 1.62 2.26 2.77 2.22 1.11-.05 1.53-.72 2.88-.72 1.34 0 1.72.72 2.9.7 1.2-.02 1.96-1.08 2.7-2.15.85-1.24 1.2-2.44 1.22-2.5-.03-.01-2.34-.9-2.36-3.52ZM14.7 5.9c.6-.74 1.02-1.76.9-2.78-.87.04-1.94.58-2.57 1.32-.56.65-1.06 1.7-.93 2.7.98.07 1.98-.5 2.6-1.24Z" />
    </svg>
  );
}

const NOMS: Record<Fournisseur, string> = { apple: "Apple", google: "Google" };

export function BoutonsSociaux({
  retour,
  inscription = false,
  onErreur,
  enLigne = false,
  className,
}: {
  /** Où revenir après le fournisseur (même origine). */
  retour: string;
  /** Création de compte : rien ne s'affiche si Supabase ferme les inscriptions. */
  inscription?: boolean;
  onErreur?: (message: string) => void;
  /** Côte à côte, au nom seul : quand la place manque sous l'action. */
  enLigne?: boolean;
  className?: string;
}) {
  const [actifs, setActifs] = useState<Fournisseur[]>([]);
  const [depart, setDepart] = useState<Fournisseur | null>(null);

  useEffect(() => {
    let annule = false;
    fournisseursActifs().then((r) => {
      if (!annule) setActifs(r.inscriptions || !inscription ? r.actifs : []);
    });
    return () => {
      annule = true;
    };
  }, [inscription]);

  if (actifs.length === 0) return null;

  async function partir(f: Fournisseur) {
    const env = lireEnvironnement();
    if (env.appHote) {
      const sortie = lienSortie(new URL(retour, window.location.origin), env.systeme);
      if (sortie) {
        window.location.assign(sortie);
        return;
      }
    }
    setDepart(f);
    const erreur = await connexionSociale(f, retour);
    if (erreur) {
      setDepart(null);
      onErreur?.(erreur);
    }
  }

  return (
    <div className={cn("flex gap-[8px]", enLigne ? "flex-row" : "flex-col", className)}>
      {actifs.map((f) => (
        <button
          key={f}
          type="button"
          disabled={!!depart}
          onClick={() => void partir(f)}
          className={cn(
            // Du verre : l'action blanche de l'écran reste la seule.
            "bouton-secondaire flex min-w-0 flex-1 items-center justify-center gap-[8px] py-[15px] text-[15px] font-semibold",
            depart && depart !== f && "opacity-40"
          )}
        >
          {depart === f ? <Loader2 className="size-[18px] animate-spin" /> : f === "apple" ? <LogoApple /> : <LogoGoogle />}
          {enLigne ? NOMS[f] : `Continuer avec ${NOMS[f]}`}
        </button>
      ))}
    </div>
  );
}
