"use client";

// /connexion : l'adresse des boutons « Se connecter » de la page d'accueil
// (landing-site.tsx). Sans session, AuthGate y montre l'écran de connexion ;
// une fois connecté, on rejoint l'app.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Connexion() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/");
  }, [router]);
  return null;
}
