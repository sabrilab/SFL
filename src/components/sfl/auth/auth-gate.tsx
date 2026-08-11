"use client";

// Porte d'entrée de l'app : sans session, on ne voit que l'écran de connexion.
// Au chargement, on tente d'abord de reprendre une session Supabase existante
// (retour d'une connexion Google/Apple, ou session persistée) — l'écran de
// connexion n'apparaît que si rien n'est en attente.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { bootstrapServerSession } from "@/lib/sfl/auth/session";
import { LoginScreen } from "./login-screen";

/** Pages ouvertes à tous : le lien d'accueil personnel envoyé par l'admin. */
const PUBLIC_ROUTES = ["/bienvenue"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const session = useSession();
  const pathname = usePathname();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Externe à React (Supabase + localStorage) : le résultat arrive par
    // l'événement de session ; ce flag n'évite que l'écran de connexion furtif.
    bootstrapServerSession().finally(() => {
      if (!cancelled) setBootstrapped(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Avant hydratation (et pendant la reprise de session) on ne rend rien :
  // ni flash de contenu privé, ni formulaire qui clignote.
  if (PUBLIC_ROUTES.some((r) => pathname?.startsWith(r))) return <>{children}</>;
  if (!isClient) return null;
  if (!session && !bootstrapped) return null;
  if (!session)
    return (
      // Le body ne défile jamais : l'écran de connexion porte son propre
      // conteneur de scroll, sinon il est rogné sur les petits écrans.
      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <LoginScreen />
      </div>
    );
  return <>{children}</>;
}
