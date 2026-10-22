"use client";

// L'écran d'un joueur inscrit, pas encore accepté par l'admin.
//
// La base ne lui ouvre rien de la ligue (voir est_membre dans le schéma) :
// plutôt qu'une app vide, il voit sa carte et l'état de sa demande. L'écran
// se relit tout seul ; dès que l'admin accepte, la session bascule et l'app
// s'ouvre à sa place.

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { BolaCard } from "@/components/sfl/bola-card";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { refreshSession, signOut, type Session } from "@/lib/sfl/auth/session";
import { rafraichirPhotos } from "@/lib/sfl/photos";
import { ovr, type Stats } from "@/lib/sfl/engine";

const STATS: Stats = { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 };
/** Relecture de l'état de la demande. */
const RYTHME = 30_000;

export function EnAttente({ session, horsSaison = false }: { session: Session; horsSaison?: boolean }) {
  const perso = usePhotoPerso(session.name);
  const [verif, setVerif] = useState(false);

  useEffect(() => {
    const relire = () => void refreshSession();
    void rafraichirPhotos();
    const t = setInterval(relire, RYTHME);
    window.addEventListener("focus", relire);
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", relire);
    };
  }, []);

  async function verifier() {
    setVerif(true);
    await refreshSession();
    setVerif(false);
  }

  return (
    <div className="flex min-h-dvh flex-col px-[21px]" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 21px)" }}>
      <div className="flex h-[52dvh] min-h-[340px] items-end justify-center">
        <div style={{ filter: "drop-shadow(0 21px 34px rgba(0,0,0,.55))" }}>
          <BolaCard
            name={session.name}
            username={`@${session.user}`}
            position=""
            overall={ovr(STATS)}
            stats={STATS}
            photo={perso}
          />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[420px] pt-[34px]">
        <p className="mono-label text-foreground/40">En attente</p>
        <h1 className="mt-[8px] text-[34px] leading-[1.05] font-extrabold tracking-tight">
          {horsSaison ? "Ta carte arrive." : "Tu es sur la liste."}
        </h1>
        <p className="mt-[13px] text-[15px] leading-snug text-foreground/55">
          {horsSaison
            ? "Ton compte est validé. Ta carte s'ouvre dès que la saison t'a ajouté."
            : "La ligue valide ton entrée. Ta carte s'ouvre dès que c'est fait."}
        </p>
      </div>
      <div className="mx-auto mt-auto w-full max-w-[420px] pt-[34px]">
        <button
          type="button"
          onClick={verifier}
          className="bouton-principal flex w-full items-center justify-center gap-2 py-[17px] text-[15px] font-bold"
        >
          {verif && <Loader2 className="size-4 animate-spin" />}
          Vérifier
        </button>
        <button
          type="button"
          onClick={signOut}
          className="bouton-discret mt-[13px] w-full py-[8px] text-center text-[13px] font-semibold"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
