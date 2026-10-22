"use client";

// La fiche d'un match ouvert par un joueur : le match sur son terrain
// (terrain-places.tsx), qui vient, qui est invité (carte effacée), et un +
// sur chaque place libre — l'organisateur y invite un joueur
// (choisir-joueur.tsx), un autre y prend sa place si le match est public.
// Puis le seul geste qui compte pour moi ici : accepter, me retirer, ou
// annuler si c'est mon match.
// Le coup d'envoi passé, l'organisateur tient la feuille (feuille-bola.tsx)
// et tout le monde voit le score et le ou les MVP.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { QuiVient } from "@/components/sfl/qui-vient";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import {
  accepter,
  annuler,
  direErreur,
  inscrits,
  inviter,
  listerDispos,
  listerProfils,
  momentDeLHeure,
  placesLibres,
  quitter,
  rejoindre,
  type Partie,
  type Profil,
} from "@/lib/sfl/matchs";
import { coupDEnvoiPasse, feuilleOuverte, mvpsDuMatch } from "@/lib/sfl/ligue-vierge";
import { FeuilleBola } from "@/components/sfl/matchs/feuille-bola";
import { cn } from "@/lib/utils";

export function FichePartie({ partie, moi, onChange }: { partie: Partie; moi: string | null; onChange: () => void }) {
  const [occupe, setOccupe] = useState(false);
  const venus = inscrits(partie);
  const attendus = partie.joueurs.filter((j) => j.statut === "invite");
  const libres = placesLibres(partie);
  const moiLa = partie.joueurs.find((j) => j.id === moi) ?? null;
  const organise = partie.organisateurId === moi;
  const [feuille, setFeuille] = useState(false);
  const joue = coupDEnvoiPasse(partie.jour, partie.heure);
  const saisi = partie.saisiLe != null && partie.scoreClairs != null && partie.scoreFonces != null;
  const corrigeable = feuilleOuverte(partie.saisiLe);
  const presents = partie.joueurs.filter((j) => j.equipe === "clairs" || j.equipe === "fonces");
  const mvps = saisi ? mvpsDuMatch(presents) : [];

  // L'organisateur invite depuis le terrain : la liste des joueurs, et ceux libres à cette heure-là.
  const [choisir, setChoisir] = useState(false);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [libresIds, setLibresIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!organise || joue) return;
    let fini = false;
    listerProfils()
      .then((p) => !fini && setProfils(p))
      .catch(() => {});
    const moment = momentDeLHeure(partie.heure);
    listerDispos(partie.jour, partie.jour)
      .then((d) => !fini && setLibresIds(new Set(d.filter((x) => x.moment === moment).map((x) => x.playerId))))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [organise, joue, partie.jour, partie.heure]);
  const orga = partie.joueurs.find((j) => j.id === partie.organisateurId);
  const occupants = [
    ...(orga ? [orga] : []),
    ...venus.filter((j) => j !== orga),
    ...attendus.filter((j) => j !== orga),
  ].map((j) => ({ cle: j.id, nom: j.name, enAttente: j.statut === "invite" }));
  const moiNom = moiLa?.name;
  const prendrePlace = !joue && !moiLa && partie.visibilite === "public" && libres > 0 && !!moi;

  async function faire(action: () => Promise<void>, ok: string) {
    setOccupe(true);
    try {
      await action();
      toast.success(ok);
      onChange();
    } catch (e) {
      toast.error(direErreur(e));
    } finally {
      setOccupe(false);
    }
  }

  const bouton = "flex h-12 items-center justify-center text-[15px] font-semibold disabled:opacity-40";

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[26px] bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="mono-label text-muted-foreground">
            {partie.genre === "exhibition" ? "Exhibition" : "Match"} · {partie.visibilite === "prive" ? "privé" : "public"} · par {partie.organisateur}
          </p>
          <p className="text-[22px] font-bold tabular-nums">
            {venus.length}
            <span className="text-muted-foreground">/{partie.places}</span>
          </p>
        </div>
      </div>
      <TerrainPlaces
        places={partie.places}
        occupants={occupants}
        moi={moiNom}
        hauteur={460}
        onPlus={
          joue || occupe
            ? undefined
            : organise
              ? () => setChoisir(true)
              : prendrePlace
                ? () => void faire(() => rejoindre(partie.id), "Place prise, à toi de jouer.")
                : undefined
        }
      />
      {organise && !joue && (
        <ChoisirJoueur
          open={choisir}
          onOpenChange={setChoisir}
          profils={profils}
          exclus={new Set(partie.joueurs.map((j) => j.id))}
          libres={libresIds}
          moiNom={moiNom ?? partie.organisateur}
          onChoisir={(p) => void faire(() => inviter(partie.id, p.id), `${p.name} est invité.`)}
        />
      )}

      {saisi && (
        <div className="rounded-[26px] bg-card p-5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <span className="mono-label text-muted-foreground">Clairs</span>
            <span className="text-[40px] leading-none font-extrabold tracking-tight tabular-nums">
              {partie.scoreClairs} <span className="text-foreground/25">–</span> {partie.scoreFonces}
            </span>
            <span className="mono-label text-muted-foreground">Foncés</span>
          </div>
          {mvps.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="mono-label text-muted-foreground">{mvps.length > 1 ? "MVP ex æquo" : "MVP"}</span>
              <QuiVient className="justify-center" noms={presents.filter((j) => mvps.includes(j.id)).map((j) => j.name)} />
            </div>
          )}
        </div>
      )}

      {organise && joue && corrigeable && (
        <>
          <button onClick={() => setFeuille(true)} className={cn(bouton, "bouton-principal bouton--vert")}>
            {saisi ? "Corriger la feuille" : "Feuille de match"}
          </button>
          {feuille && <FeuilleBola partie={partie} open={feuille} onOpenChange={setFeuille} onSaisie={onChange} />}
        </>
      )}

      {!joue && moiLa?.statut === "invite" && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={occupe} onClick={() => faire(() => accepter(partie.id), "C'est noté, tu joues.")} className={cn(bouton, "bouton-principal bouton--vert")}>
            Je viens
          </button>
          <button disabled={occupe} onClick={() => faire(() => quitter(partie.id), "Invitation déclinée.")} className={cn(bouton, "bouton-secondaire bouton--rouge")}>
            Pas dispo
          </button>
        </div>
      )}
      {/* Il manque des joueurs : la place à prendre s'allume en braise. */}
      {!joue && !moiLa && partie.visibilite === "public" && libres > 0 && (
        <button disabled={occupe || !moi} onClick={() => faire(() => rejoindre(partie.id), "Place prise, à toi de jouer.")} className={cn(bouton, "bouton-principal bouton--braise")}>
          Prendre une place
        </button>
      )}
      {!joue && moiLa?.statut === "inscrit" && !organise && (
        <button disabled={occupe} onClick={() => faire(() => quitter(partie.id), "Tu as libéré ta place.")} className={cn(bouton, "bouton-secondaire bouton--rouge")}>
          Me retirer
        </button>
      )}
      {organise && !saisi && (
        <button
          disabled={occupe}
          onClick={() => {
            if (window.confirm("Annuler ce match pour tout le monde ?")) void faire(() => annuler(partie.id), "Match annulé.");
          }}
          className={cn(bouton, "bouton-secondaire bouton--rouge")}
        >
          Annuler le match
        </button>
      )}
    </section>
  );
}
