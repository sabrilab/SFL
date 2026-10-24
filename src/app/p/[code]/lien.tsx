"use client";

// La page du lien d'un parrain (voir page.tsx) : qui invite, sa carte s'il a
// accepté qu'elle sorte de l'app, « Bola Team offert » si c'est un joueur
// SFL, puis
//   · un nouveau : « Créer mon compte », l'inscription courte, qui le fait
//     entrer dans Bola sans attendre l'admin ;
//   · quelqu'un qui a déjà un compte : il se connecte, et rien ne change
//     pour lui (un compte n'a qu'un parrain, celui qui l'a fait naître).
// Le code est gardé sur le téléphone (30 jours) et écrit en bas de la page :
// ouverte ailleurs, l'inscription le reprend ou on le tape.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { BolaCard } from "@/components/sfl/bola-card";
import { useSession } from "@/hooks/use-session";
import { photoParNom } from "@/lib/sfl/photos";
import { garderCode, lireParrain, noterVisite, type Parrain } from "@/lib/sfl/parrainage";

export function LienParrain({ code, initial }: { code: string; initial: Parrain | null | undefined }) {
  const session = useSession();
  // undefined : le serveur n'a pas pu dire (base injoignable, préversion) ; on relit ici.
  const [parrain, setParrain] = useState<Parrain | null | undefined>(initial);

  useEffect(() => {
    if (initial !== undefined) return;
    let fini = false;
    lireParrain(code)
      .then((p) => !fini && setParrain(p))
      .catch(() => !fini && setParrain(null));
    return () => {
      fini = true;
    };
  }, [code, initial]);

  useEffect(() => {
    if (!parrain) return;
    garderCode(parrain.code);
    noterVisite(parrain.code, "ouvert");
  }, [parrain]);

  const connecte = !!session?.server && !session.enAttente;

  if (parrain === undefined) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col justify-center overflow-y-auto bg-background"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <Link
        href="/"
        aria-label="Fermer"
        className="bouton-secondaire fixed right-4 grid size-10 place-items-center"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <X className="size-[18px]" />
      </Link>
      <div className="mx-auto flex w-full max-w-sm flex-col items-center px-6 py-12 text-center">
        {parrain ? (
          <>
            {parrain.carte && (
              <div style={{ filter: "drop-shadow(0 21px 34px rgba(0,0,0,.45))" }}>
                <BolaCard
                  name={parrain.nom}
                  affiche={parrain.affiche}
                  username={parrain.pseudo ?? undefined}
                  position={parrain.carte.poste}
                  overall={parrain.carte.note}
                  stats={parrain.carte.stats}
                  photo={parrain.photo ? photoParNom(parrain.nom, parrain.photo) : null}
                  size={0.75}
                />
              </div>
            )}
            <h1 className="mt-8 text-[34px] leading-[1.05] font-extrabold tracking-tight">
              {`${parrain.affiche} t'invite.`}
            </h1>
            {parrain.sfl && <p className="mono-label mt-3 text-muted-foreground">Bola Team offert</p>}
            <div className="mt-9 flex w-full flex-col gap-2.5">
              {connecte ? (
                <Link href="/" className="bouton-principal py-4 text-[15px] font-bold">
                  Ouvrir Bola
                </Link>
              ) : (
                <>
                  <Link
                    href={`/inscription?parrain=${encodeURIComponent(parrain.code)}`}
                    className="bouton-principal bouton--vert py-4 text-[15px] font-bold"
                  >
                    Créer mon compte
                  </Link>
                  <Link href="/" className="bouton-discret py-3.5 text-[14px] font-semibold">
                    J&apos;ai déjà un compte
                  </Link>
                </>
              )}
            </div>
            <p className="mono-label mt-8 text-foreground/35">Code · {parrain.code}</p>
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
