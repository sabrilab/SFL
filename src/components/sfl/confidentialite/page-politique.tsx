"use client";

// Le cadre de la page /confidentialite : plein écran, au-dessus de la barre
// d'onglets, comme l'inscription. Elle s'ouvre sans compte (AuthGate), depuis
// l'écran de connexion, les Réglages ou un lien envoyé à un parent ; le
// texte vient de politique.tsx. Un joueur connecté y lit aussi quand il l'a
// acceptée.

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useAccord } from "@/hooks/use-accord";
import { VERSION_POLITIQUE, dateAccord } from "@/lib/sfl/confidentialite";

export function PagePolitique({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();
  const { accord } = useAccord(session?.name);
  const accepte = accord?.version === VERSION_POLITIQUE ? accord : null;

  function retour() {
    // Arrivé par un lien : pas de page d'avant dans l'app.
    if (window.history.length > 1) router.back();
    else router.replace("/");
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      <div className="orbs" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-[680px] items-center px-[13px] pt-[8px] pb-[8px]">
        <button
          type="button"
          onClick={retour}
          className="bouton-discret flex items-center gap-[2px] py-[8px] pr-[13px] pl-[6px] text-[14px] font-semibold"
        >
          <ChevronLeft className="size-5" />
          Retour
        </button>
      </div>
      <div className="relative z-10 flex-1 overflow-y-auto overscroll-contain">
        <div
          className="mx-auto w-full max-w-[680px] px-[21px] pt-[13px]"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 55px)" }}
        >
          {children}
          {accepte && (
            <p className="mono-label mt-[55px] text-foreground/40">
              {accepte.enAttente ? "Acceptée sur ce téléphone" : `Acceptée le ${dateAccord(accepte.le)}`}
              {" · "}
              {accepte.horsApp ? "Carte hors de l'app : oui" : "Carte hors de l'app : non"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
