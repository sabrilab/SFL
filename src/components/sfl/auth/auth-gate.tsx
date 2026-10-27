"use client";

// Porte d'entrée de l'app : sans session, on ne voit que la page d'accueil
// (landing.tsx, à l'adresse « / » dans un navigateur) ou l'écran de connexion
// (l'app installée, et toute autre adresse).
// Au chargement, on tente d'abord de reprendre une session Supabase existante
// (retour d'une connexion Google/Apple, ou session persistée) — l'écran de
// connexion n'apparaît que si rien n'est en attente.

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useIsClient } from "@/hooks/use-is-client";
import { useSession } from "@/hooks/use-session";
import { bootstrapServerSession, inscriptionSocialeEnCours } from "@/lib/sfl/auth/session";
import { LoginScreen } from "./login-screen";
import { Landing } from "./landing";
import { lireEnvironnement } from "@/lib/pwa/environnement";
import { VoileEtat } from "@/components/layout/bottom-nav";
import { EnAttente } from "./en-attente";
import { NouveauMotDePasse } from "./nouveau-mot-de-passe";
import { useJoueurInconnu } from "@/components/sfl/player-provider";
import { ConsentementObligatoire } from "@/components/sfl/confidentialite/consentement";

/**
 * Pages ouvertes à tous : le lien d'accueil personnel envoyé par l'admin, la
 * création de compte, le lien d'invitation d'une équipe (mode Team), le lien
 * d'un parrain (/p/code), le lien d'une vidéo (/v/id, sans la vidéo) et la
 * politique de confidentialité.
 */
const PUBLIC_ROUTES = ["/bienvenue", "/inscription", "/equipe/", "/p/", "/v/", "/confidentialite"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isClient = useIsClient();
  const session = useSession();
  const inconnu = useJoueurInconnu();
  const pathname = usePathname();
  const router = useRouter();
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Externe à React (Supabase + localStorage) : le résultat arrive par
    // l'événement de session ; ce flag n'évite que l'écran de connexion furtif.
    bootstrapServerSession()
      .then(async (ok) => {
        // Revenu de Google ou Apple sans avoir fini son inscription (app
        // fermée en route) : la suite est sur l'inscription.
        if (ok || cancelled || PUBLIC_ROUTES.some((r) => window.location.pathname.startsWith(r))) return;
        if (await inscriptionSocialeEnCours()) router.replace("/inscription");
      })
      .finally(() => {
        if (!cancelled) setBootstrapped(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Avant hydratation (et pendant la reprise de session) on ne rend rien :
  // ni flash de contenu privé, ni formulaire qui clignote.
  if (PUBLIC_ROUTES.some((r) => pathname?.startsWith(r))) return <>{children}</>;
  if (!isClient) return null;
  if (!session && !bootstrapped) return null;
  if (!session && pathname === "/" && !lireEnvironnement().installee)
    return (
      <div className="h-full overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Landing />
        <VoileEtat partout />
      </div>
    );
  if (!session)
    return (
      // Le body ne défile jamais : l'écran de connexion porte son propre
      // conteneur de scroll, sinon il est rogné sur les petits écrans.
      <div
        className="h-full overflow-y-auto"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <LoginScreen />
        <VoileEtat partout />
      </div>
    );
  // Un compte né d'un mot de passe d'origine (devenu public) ou provisoire :
  // il choisit le sien avant tout le reste. Un membre de la saison le choisit
  // dans l'accueil de l'app (components/sfl/accueil), qui s'ouvre dessus ;
  // ici, les comptes en attente et ceux que la saison ne connaît pas encore.
  if (session.server && session.motDePasseAChanger && (session.enAttente || inconnu))
    return (
      <div className="h-full overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <NouveauMotDePasse session={session} />
        <VoileEtat partout />
      </div>
    );
  // Inscrit, pas encore accepté : sa carte et l'état de sa demande, rien
  // d'autre (la base ne lui ouvre pas la ligue de toute façon). La case de
  // confidentialité passe avant, comme dans l'app.
  if (session.enAttente)
    return (
      <div className="h-full overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <EnAttente session={session} />
        <ConsentementObligatoire />
        <VoileEtat partout />
      </div>
    );
  // Connecté, mais la saison chargée ne le connaît pas (pas encore ajouté à
  // l'effectif, ou copie locale en retard) : sa carte arrive, pas celle d'un
  // autre.
  if (inconnu)
    return (
      <div className="h-full overflow-y-auto" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <EnAttente session={session} horsSaison />
        <ConsentementObligatoire />
        <VoileEtat partout />
      </div>
    );
  return <>{children}</>;
}
