"use client";

// « Se déconnecter », en toutes lettres : au bas de Ma carte, comme dans
// toute app, et dans les réglages (Mon compte). Sabri, le 22/10 : rendre la
// déconnexion « plus accessible » ; ce n'était qu'une icône, dans les
// réglages, derrière le « ⋯ ».
//
// Rouge comme tout ce qui défait, en secondaire : elle ne brille jamais plus
// que ce qui fait (boutons.css). On demande d'abord, comme pour annuler un
// match : un joueur déconnecté par erreur, sans son mot de passe, reste dehors.

import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/lib/sfl/auth/session";
import { cn } from "@/lib/utils";

export function BoutonDeconnexion({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!window.confirm("Te déconnecter ?")) return;
        signOut();
        toast.success("À dimanche 👋");
      }}
      className={cn(
        "bouton-secondaire bouton--rouge flex items-center justify-center gap-2 py-[15px] text-[15px] font-semibold",
        className
      )}
    >
      <LogOut className="size-4" />
      Se déconnecter
    </button>
  );
}
