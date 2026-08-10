"use client";

// Porte d'entrée de l'app : sans session, on ne voit que l'écran de connexion.
// Le header et la tab bar sont masqués pendant ce temps — l'écran est complet,
// pas une page de plus dans la navigation.

import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { LoginScreen } from "./login-screen";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const session = useSession();

  // Avant hydratation on ne sait pas encore : on ne rend ni l'app ni l'écran de
  // connexion, pour éviter un flash de contenu privé puis de formulaire.
  if (!isClient) return null;
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
