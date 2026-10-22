"use client";

// Le lien d'invitation d'une équipe (mode Team, lib/sfl/equipes.ts) : ce que
// le capitaine partage. Page publique (hors de la porte de connexion, voir
// AuthGate) : l'écusson, le nom, l'effectif, puis
//   · un joueur connecté : « Rejoindre », il arrive invité et signe le
//     Règlement sur la page Team ;
//   · un nouveau : « Créer mon compte », l'inscription courte, qui le fait
//     entrer dans Bola sans attendre et l'amène invité dans l'équipe ;
//   · un joueur qui a déjà un compte mais n'est pas connecté : le lien est
//     gardé, et repris sur la page Team une fois connecté.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { useSession } from "@/hooks/use-session";
import { MAX_EQUIPE, direErreurEquipe, lireLien, rejoindreParLien, type InfoLien } from "@/lib/sfl/equipes";
import { DEMO_EQUIPES } from "@/lib/sfl/equipes-demo";

const DEMO: InfoLien = { id: 0, nom: "Sunday Five", initiales: "SF", fond: "noir", ville: "Lille", membres: 4, capitaine: "Sabri" };

export default function LienEquipePage() {
  const { jeton } = useParams<{ jeton: string }>();
  const router = useRouter();
  const session = useSession();
  const [info, setInfo] = useState<InfoLien | null | undefined>(undefined);
  const [envoi, setEnvoi] = useState(false);

  useEffect(() => {
    let fini = false;
    lireLien(jeton)
      .then((i) => !fini && setInfo(i))
      .catch(() => !fini && setInfo(DEMO_EQUIPES ? DEMO : null));
    return () => {
      fini = true;
    };
  }, [jeton]);

  const garder = () => {
    try {
      localStorage.setItem("sfl-equipe-lien", jeton);
    } catch {}
  };

  async function rejoindre() {
    setEnvoi(true);
    try {
      await rejoindreParLien(jeton);
      router.replace("/bola-team");
    } catch (e) {
      toast.error(direErreurEquipe(e));
      setEnvoi(false);
    }
  }

  if (info === undefined) return null;
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-center overflow-y-auto bg-background" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* On peut toujours partir : vers la Team si l'on est connecté, sinon l'accueil. */}
      <Link
        href={session?.server ? "/bola-team" : "/"}
        aria-label="Fermer"
        className="bouton-secondaire fixed right-4 grid size-10 place-items-center"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X className="size-[18px]" />
      </Link>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center px-6 py-12 text-center">
        {info ? (
          <>
            <Ecusson initiales={info.initiales} fond={info.fond} taille={132} />
            <h1 className="mt-6 text-[34px] leading-none font-bold tracking-tight">{info.nom}</h1>
            <p className="mono-label mt-3 text-muted-foreground">
              {[info.ville, `${info.membres} / ${MAX_EQUIPE}`, info.capitaine && `Cap. ${info.capitaine}`].filter(Boolean).join(" · ")}
            </p>
            <div className="mt-9 flex w-full flex-col gap-2.5">
              {session?.server && !session.enAttente ? (
                <button
                  type="button"
                  disabled={envoi}
                  onClick={rejoindre}
                  className="bouton-principal py-4 text-[15px] font-bold disabled:opacity-60"
                >
                  Rejoindre {info.nom}
                </button>
              ) : (
                <>
                  <Link
                    href={`/inscription?equipe=${encodeURIComponent(jeton)}`}
                    className="bouton-principal py-4 text-[15px] font-bold"
                  >
                    Créer mon compte
                  </Link>
                  <Link href="/bola-team" onClick={garder} className="bouton-discret py-3.5 text-[14px] font-semibold">
                    J&apos;ai déjà un compte
                  </Link>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[26px] font-bold tracking-tight">Lien expiré</h1>
            <Link href="/" className="bouton-principal mt-6 px-6 py-3.5 text-[15px] font-bold">
              Ouvrir Bola
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
