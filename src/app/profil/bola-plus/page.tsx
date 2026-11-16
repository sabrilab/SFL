"use client";

// Bola Plus, enfant de Ma carte (lib/nav.ts) : la précommande (Sabri,
// 12/11/2026). Un carrousel horizontal en couleurs (retours du 14/11) :
// l'ouverture, les avantages carte par carte, « Ramène 5 abonnés », puis
// « Ton prix » et « Je suis intéressé » (sfl/bola-plus.tsx). La page a sa
// propre mise en page : elle tient dans l'écran, seul le rail glisse. Aucun
// paiement.
//
// En ligne, seuls les deux admins la voient (Sabri, 16/11 : « mettre le paywall
// sur les comptes de Ilyes et Sabri […] pour qu'on voie ce que ça donne ») :
// voitBolaPlus (lib/sfl/bola-plus.ts). Tout autre compte qui tape l'adresse
// revient sur Ma carte sans rien voir.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageBolaPlus } from "@/components/sfl/bola-plus";
import { useSession } from "@/hooks/use-session";
import { getSession } from "@/lib/sfl/auth/session";
import { voitBolaPlus } from "@/lib/sfl/bola-plus";

export default function Page() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    // La session lue au moment même (localStorage), pas l'instantané d'hydratation, toujours vide.
    if (!voitBolaPlus(getSession()?.name)) router.replace("/profil");
  }, [router, session]);
  if (!voitBolaPlus(session?.name)) return null;
  return <PageBolaPlus />;
}
