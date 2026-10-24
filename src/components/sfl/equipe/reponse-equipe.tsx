"use client";

// À l'ouverture de l'app, l'invitation d'une équipe attend sa réponse
// (Sabri, 24/10 : « pas les obliger, mais qu'ils soient quand même
// contraints de répondre à cette notif : oui ou non ? ») : l'écusson et le
// maillot de l'équipe, qui m'invite et jusqu'à quand, ceux qui ont déjà
// signé, et deux boutons, Non et Oui, sans « Plus tard ». Non retire mon
// invitation ; Oui mène à la signature du Règlement et de la Charte, sur la
// page Team (/bola-team?invitation=id). Invité par plusieurs équipes : la
// plus ancienne d'abord (elle tombe la première), la suivante juste après un
// Non. Déjà dans une équipe, on n'en rejoint pas d'autre : rien ne s'ouvre.
//
// À un membre qui avait signé la version 1, la même place présente la
// Charte de déontologie (version 2) : « Lire et signer » ouvre la signature
// sur la page Team (/bola-team?charte=1) ; « Plus tard » la fait taire deux
// jours, comme les autres invitations de l'ouverture.
//
// C'est invitation-carte.tsx qui décide laquelle des invitations de
// l'ouverture passe (equipeAOuvrir, avant toutes les autres) ; rien ne
// s'ouvre sur la page Team ni sur le lien d'une équipe, qui la montrent déjà.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { signalerEquipe } from "@/hooks/use-mon-equipe";
import {
  VERSION_REGLEMENT,
  aSignerLaCharte,
  direErreurEquipe,
  inviteur,
  invites,
  mesInvitations,
  monEquipe,
  retirerInvitation,
  signataires,
  type Equipe,
} from "@/lib/sfl/equipes";
import { finInvitation, quandTombe } from "@/lib/sfl/equipes-temps";
import { monId } from "@/lib/sfl/matchs";

export type EquipeAOuvrir = { quoi: "invitation"; equipes: Equipe[]; moi: string } | { quoi: "charte"; equipe: Equipe };

/** Ce que l'ouverture présente du mode Team : une invitation, la Charte à signer, ou rien. */
export async function equipeAOuvrir(charteEnPause: boolean): Promise<EquipeAOuvrir | null> {
  const ici = window.location.pathname;
  if (ici.startsWith("/bola-team") || ici.startsWith("/equipe/")) return null;
  const moi = await monId();
  if (!moi) return null;
  const [invitations, mienne] = await Promise.all([mesInvitations(moi).catch(() => []), monEquipe(moi).catch(() => null)]);
  if (!mienne) {
    const depuis = (e: Equipe) => e.membres.find((m) => m.id === moi && m.statut === "invite")?.depuis ?? "";
    const valables = invitations.filter((e) => invites(e).some((m) => m.id === moi)).sort((a, b) => depuis(a).localeCompare(depuis(b)));
    return valables.length > 0 ? { quoi: "invitation", equipes: valables, moi } : null;
  }
  const m = mienne.membres.find((x) => x.id === moi);
  return m && aSignerLaCharte(m) && !charteEnPause ? { quoi: "charte", equipe: mienne } : null;
}

export function ReponseEquipe({ a, onFini, onPlusTard }: { a: EquipeAOuvrir; onFini: () => void; onPlusTard: () => void }) {
  const router = useRouter();
  const [reste, setReste] = useState(() => (a.quoi === "invitation" ? a.equipes : []));
  const [envoi, setEnvoi] = useState(false);
  const e = a.quoi === "invitation" ? reste[0] : a.equipe;
  if (!e) return null;
  const invitation = a.quoi === "invitation" ? e.membres.find((m) => m.id === a.moi && m.statut === "invite") : undefined;
  const deja = signataires(e);

  async function non() {
    if (a.quoi !== "invitation" || !e) return;
    setEnvoi(true);
    try {
      await retirerInvitation(e.id, a.moi);
      navigator.vibrate?.(8);
      toast(`Invitation de ${e.nom} refusée.`);
      signalerEquipe();
      if (reste.length > 1) setReste(reste.slice(1));
      else onFini();
    } catch (err) {
      toast.error(direErreurEquipe(err));
    } finally {
      setEnvoi(false);
    }
  }

  function oui() {
    if (!e) return;
    onFini();
    router.push(a.quoi === "invitation" ? `/bola-team?invitation=${e.id}` : "/bola-team?charte=1");
  }

  return (
    <motion.div
      key={`${a.quoi}-${e.id}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={a.quoi === "invitation" ? `Invitation de ${e.nom}` : "Charte de déontologie"}
      className="dark fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 overflow-y-auto bg-black/92 px-6 py-10 text-foreground backdrop-blur-sm"
      style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
    >
      <motion.div
        initial={{ scale: 0.8, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="flex items-end justify-center gap-4"
      >
        <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={112} />
        <Maillot initiales={e.initiales} fond={e.fond} blason={e.blason} taille={124} />
      </motion.div>
      <div className="flex max-w-sm flex-col items-center gap-2 text-center">
        <span className="mono-label text-white/50">{a.quoi === "invitation" ? "Bola Team" : `Version ${VERSION_REGLEMENT.slice(1)}`}</span>
        <h2 className="text-[30px] leading-none font-bold tracking-tight text-white">
          {a.quoi === "invitation" ? e.nom : "Charte de déontologie"}
        </h2>
        <p className="text-[15px] text-white/70">
          {a.quoi === "invitation"
            ? [invitation && `${inviteur(e, invitation)} t'invite`, invitation?.depuis && `jusqu'à ${quandTombe(finInvitation(invitation.depuis))}`]
                .filter(Boolean)
                .join(" · ")
            : `${e.nom} · Règlement Team et Charte à signer`}
        </p>
      </div>
      {a.quoi === "invitation" && deja.length > 0 && (
        <div className="flex max-w-sm flex-wrap justify-center gap-x-2 gap-y-2.5">
          {deja.map((m) => (
            <span key={m.id} className="flex w-[52px] flex-col items-center gap-1">
              <CarteDe name={m.name} size={FORMAT_CARTE.petite} inerte />
              <span className="w-full truncate text-center text-[11.5px] font-medium text-white/80">{m.name.split(" ")[0]}</span>
            </span>
          ))}
        </div>
      )}
      {a.quoi === "invitation" ? (
        <div className="grid w-full max-w-sm grid-cols-2 gap-3">
          <Button variant="destructive" disabled={envoi} onClick={non} className="h-12 rounded-full text-[16px] font-semibold">
            Non
          </Button>
          <Button variant="vert" disabled={envoi} onClick={oui} className="h-12 rounded-full text-[16px] font-semibold">
            Oui
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-sm flex-col gap-2">
          <Button variant="vert" onClick={oui} className="h-12 rounded-full text-[16px] font-semibold">
            Lire et signer
          </Button>
          <Button variant="ghost" onClick={onPlusTard} className="h-12 rounded-full text-[15px] font-semibold text-white/60">
            Plus tard
          </Button>
        </div>
      )}
      {a.quoi === "invitation" && reste.length > 1 && (
        <span className="mono-label text-white/40">
          +{reste.length - 1} autre{reste.length > 2 ? "s" : ""} invitation{reste.length > 2 ? "s" : ""}
        </span>
      )}
    </motion.div>
  );
}
