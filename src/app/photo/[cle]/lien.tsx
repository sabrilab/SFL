"use client";

// La page du lien d'une photo (voir page.tsx). Connecté à Bola sur ce
// téléphone : le fil de la journée, dans les Actus (un joueur Bola hors de la
// SFL va sur la Map). Sinon, la photo (si elle peut sortir de l'app), la
// journée, et deux portes : « Se connecter » et « Créer mon compte », par le
// parrain qui a partagé le lien quand il y en a un.

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";
import { codeValide, garderCode, normaliserCode } from "@/lib/sfl/parrainage";
import { dateLongue } from "@/lib/sfl/photo-export";
import { SigleLigue } from "@/components/sfl/choix-ligue";

export interface InfoPhoto {
  /** null : la photo ne sort pas de l'app. */
  src: string | null;
  journee: number;
  date: string;
  largeur: number;
  hauteur: number;
}

export function LienPhoto({ cle, photo, de: brut }: { cle: string; photo: InfoPhoto | null; de: string | null }) {
  const session = useSession();
  const router = useRouter();
  const de = brut && codeValide(normaliserCode(brut)) ? normaliserCode(brut) : null;
  const connecte = !!session?.server && !session.enAttente;
  const horsSfl = useHorsSflEtat();
  const fil = photo ? `/ligue#j${photo.journee}` : "/ligue";
  const vers = connecte && photo && horsSfl !== null ? (horsSfl ? "/" : fil) : null;

  useEffect(() => {
    if (vers) router.replace(vers);
  }, [vers, router]);
  useEffect(() => {
    if (de && !connecte) garderCode(de);
  }, [de, connecte]);

  if (connecte && photo) return null;
  return (
    <div
      className="dark fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      data-cle={cle}
    >
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <SigleLigue ligue="bola" hauteur={22} className="text-white" />
        {photo ? (
          <>
            {photo.src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photo.src}
                alt=""
                className="mt-9 max-h-[52dvh] w-auto max-w-full rounded-[22px] object-cover ring-1 ring-white/12"
                style={{ aspectRatio: `${photo.largeur} / ${photo.hauteur}` }}
              />
            ) : (
              <div className="mt-9 aspect-[4/5] w-[46%] rounded-[22px] bg-white/[0.04] ring-1 ring-white/12" />
            )}
            <h1
              className="mt-8 text-[56px] leading-none font-black tracking-[-0.02em]"
              style={{ fontFamily: "var(--font-archivo)", fontStretch: "125%" }}
            >
              J{photo.journee}
            </h1>
            <p className="mono-label mt-3 text-white/50">Sunday Five League · {dateLongue(photo.date)}</p>
            <div className="mt-9 flex w-full flex-col gap-2.5">
              <Link href={fil} className="bouton-principal bouton--vert py-4 text-[15px] font-bold">
                Se connecter
              </Link>
              <Link
                href={de ? `/inscription?parrain=${encodeURIComponent(de)}` : "/inscription"}
                className="bouton-discret py-3.5 text-[14px] font-semibold"
              >
                Créer mon compte
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-10 text-[26px] font-bold tracking-tight">Cette photo n&apos;est plus en ligne</h1>
            <Link href="/" className="bouton-principal mt-6 px-6 py-3.5 text-[15px] font-bold">
              Ouvrir Bola
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
