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
//
// Aperçu admin de la ligue payante (lib/sfl/sfl-payant.ts) : ?apercu=payant
// fait comme si la journée gratuite du 22/11 était passée (la carte « Bola
// Plus · J8 » à la place de « Je viens ») ; ?apercu=gratuit l'efface.

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PageBolaPlus } from "@/components/sfl/bola-plus";
import { useSession } from "@/hooks/use-session";
import { getSession } from "@/lib/sfl/auth/session";
import { voitBolaPlus } from "@/lib/sfl/bola-plus";
import { isAdmin } from "@/lib/sfl/admin";
import { CLE_APERCU_PAYANT } from "@/lib/sfl/sfl-payant";

export default function Page() {
  const session = useSession();
  const router = useRouter();
  useEffect(() => {
    // La session lue au moment même (localStorage), pas l'instantané d'hydratation, toujours vide.
    const nom = getSession()?.name;
    if (!voitBolaPlus(nom)) router.replace("/profil");
    const apercu = new URLSearchParams(window.location.search).get("apercu");
    if (isAdmin(nom) && (apercu === "payant" || apercu === "gratuit")) {
      try {
        if (apercu === "payant") localStorage.setItem(CLE_APERCU_PAYANT, "1");
        else localStorage.removeItem(CLE_APERCU_PAYANT);
      } catch {}
    }
  }, [router, session]);
  if (!voitBolaPlus(session?.name)) return null;
  return <PageBolaPlus />;
}
