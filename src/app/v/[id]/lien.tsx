"use client";

// La page du lien d'une vidéo (voir page.tsx). Connecté à Bola sur ce
// téléphone : le lecteur s'ouvre aussitôt, dans les Actus. Sinon, le titre
// et deux portes : « Se connecter » (puis le lecteur) et « Créer mon
// compte », par le parrain qui a partagé le lien quand il y en a un. Le lien
// ouvert et le pas vers l'app se comptent une fois par téléphone
// (noterLien), pour Admin → Activité → Vidéos. Un joueur Bola connecté
// (hors de la SFL) ne voit pas les Actus de la SFL : il arrive sur la Map
// (28/10/2026).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";
import { codeValide, garderCode, normaliserCode } from "@/lib/sfl/parrainage";
import { DEMO_VIDEOS, VIDEO_FACTICE, noterLien } from "@/lib/sfl/videos";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { supabase } from "@/lib/supabase";
import type { InfoVideo } from "./page";

export function LienVideo({ id, de: brut, initial }: { id: string; de: string | null; initial: InfoVideo | null | undefined }) {
  const session = useSession();
  const router = useRouter();
  const de = brut && codeValide(normaliserCode(brut)) ? normaliserCode(brut) : null;
  const connecte = !!session?.server && !session.enAttente;
  // undefined : le serveur n'a pas pu lire ; on relit ici (dans un aperçu sans les tables, la vidéo factice).
  const [v, setV] = useState<InfoVideo | null | undefined>(initial);
  useEffect(() => {
    if (initial !== undefined) return;
    let fini = false;
    supabase()
      .rpc("video_info", { v: id })
      .then(({ data, error }) => {
        if (fini) return;
        if (error) setV(DEMO_VIDEOS && id === VIDEO_FACTICE.id ? { id, titre: VIDEO_FACTICE.titre } : null);
        else setV((data as InfoVideo | null) ?? null);
      });
    return () => {
      fini = true;
    };
  }, [id, initial]);
  const horsSfl = useHorsSflEtat();
  const lecteur = `/ligue?video=${encodeURIComponent(id)}`;
  // Connecté : le lecteur, sauf pour un joueur Bola (la Map) ; on attend de savoir lequel.
  const vers = connecte && v && horsSfl !== null ? (horsSfl ? "/" : lecteur) : null;

  useEffect(() => {
    if (vers) router.replace(vers);
  }, [vers, router]);

  useEffect(() => {
    if (!v || connecte) return;
    noterLien(v.id, "ouvert", de);
    // Créer son compte plus tard, ailleurs que par ce bouton : le parrain suit (30 jours).
    if (de) garderCode(de);
  }, [v, connecte, de]);

  if (v === undefined || (connecte && v)) return null;
  return (
    <div
      className="dark fixed inset-0 z-[60] flex flex-col justify-center overflow-y-auto bg-black text-white"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex w-full max-w-sm flex-col items-center px-6 py-12 text-center">
        <SigleLigue ligue="bola" hauteur={22} className="text-white" />
        {v ? (
          <>
            {/* La place de la vidéo, vide : elle ne sort pas de l'app. */}
            <div className="relative mt-10 grid aspect-[9/16] w-[46%] place-items-center rounded-[22px] bg-white/[0.04] ring-1 ring-white/12">
              <span className="grid size-[58px] place-items-center rounded-full bg-white/8 ring-1 ring-white/20">
                <Play className="ml-1 size-[22px] fill-current" strokeWidth={0} />
              </span>
            </div>
            <h1 className="mt-9 text-[30px] leading-[1.05] font-extrabold tracking-tight">{v.titre}</h1>
            <p className="mono-label mt-3 text-white/45">Dans l&apos;app Bola</p>
            <div className="mt-9 flex w-full flex-col gap-2.5">
              <Link
                href={lecteur}
                onClick={() => noterLien(v.id, "app", de)}
                className="bouton-principal bouton--vert py-4 text-[15px] font-bold"
              >
                Se connecter
              </Link>
              <Link
                href={de ? `/inscription?parrain=${encodeURIComponent(de)}` : "/inscription"}
                onClick={() => noterLien(v.id, "app", de)}
                className="bouton-discret py-3.5 text-[14px] font-semibold"
              >
                Créer mon compte
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="mt-10 text-[26px] font-bold tracking-tight">Cette vidéo n&apos;est plus en ligne</h1>
            <Link href="/" className="bouton-principal mt-6 px-6 py-3.5 text-[15px] font-bold">
              Ouvrir Bola
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
