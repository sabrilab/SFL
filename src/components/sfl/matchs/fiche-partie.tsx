"use client";

// La fiche d'un match ouvert par un joueur : le match sur son terrain
// (terrain-places.tsx), qui vient, qui est invité (carte effacée), et un +
// sur chaque place libre — l'organisateur y invite un joueur
// (choisir-joueur.tsx), un autre y prend sa place si le match est public.
// Puis le seul geste qui compte pour moi ici : répondre (Je viens, Pas
// dispo, ou prendre une place d'un match public), ou annuler si c'est mon
// match. Une réponse se donne une fois et se scelle (Sabri, 27/10 ;
// reponse-scellee.tsx, et la base le garde : match_refus,
// match_sortie_gardee) : plus de « Me retirer », et les + du terrain ne
// prennent plus de place d'un toucher — seul le glissé jusqu'au bout répond.
// L'organisateur garde la main jusqu'au coup d'envoi (Sabri, 22/10) : il
// retire un joueur en touchant sa carte, et « Modifier » rouvre la feuille
// du match (ouvrir-match.tsx) pour en changer le jour, l'heure, le lieu ou
// les places.
// Le coup d'envoi passé, l'organisateur tient la feuille (feuille-bola.tsx)
// et tout le monde voit le score et le ou les MVP, puis où en est la
// confirmation du résultat par les joueurs (28/10, bilan-resultat.tsx).
// Ceux du match (organisateur, inscrits, invités) ont en haut la porte de sa
// discussion (22/10, matchs/discussion-match.tsx), avec ce qu'ils n'ont pas lu.

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { QuiVient } from "@/components/sfl/qui-vient";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { OuvrirMatch } from "@/components/sfl/matchs/ouvrir-match";
import { ReponseScellee, type IssueReponse } from "@/components/sfl/reponse-scellee";
import type { Terrain } from "@/lib/sfl/saisie/types";
import {
  accepter,
  aiRefuse,
  annuler,
  direErreur,
  inscrits,
  inviter,
  listerDispos,
  listerProfils,
  momentDeLHeure,
  placesLibres,
  refuser,
  rejoindre,
  retirerJoueur,
  type Partie,
  type Profil,
} from "@/lib/sfl/matchs";
import { coupDEnvoiPasse, feuilleOuverte, mvpsDuMatch } from "@/lib/sfl/ligue-vierge";
import { FeuilleBola } from "@/components/sfl/matchs/feuille-bola";
import { BilanResultat } from "@/components/sfl/matchs/bilan-resultat";
import { cn } from "@/lib/utils";

export function FichePartie({
  partie,
  moi,
  terrains,
  onChange,
  nonLus = 0,
  onDiscussion,
}: {
  partie: Partie;
  moi: string | null;
  terrains: Terrain[];
  onChange: () => void;
  /** Les messages de la discussion que je n'ai pas lus. */
  nonLus?: number;
  /** Ouvre la discussion du match (pour ceux qui en sont). */
  onDiscussion?: () => void;
}) {
  const [modifier, setModifier] = useState(0);
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

  // Ai-je déjà dit « Pas dispo » à ce match ? Alors c'est scellé.
  const [refuse, setRefuse] = useState(false);
  useEffect(() => {
    if (!moi || moiLa) return;
    let fini = false;
    aiRefuse(partie.id)
      .then((r) => !fini && setRefuse(r))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [moi, moiLa, partie.id]);

  /** Une réponse du joueur, pour le sceau : « figee » quand la base l'a déjà. */
  async function repondre(action: () => Promise<void>): Promise<IssueReponse> {
    try {
      await action();
      return "ok";
    } catch (e) {
      const dit = direErreur(e);
      if (/déjà donnée/.test(dit)) {
        onChange();
        return "figee";
      }
      toast.error(dit);
      return "dite";
    }
  }

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

  const bouton = "flex h-12 items-center justify-center text-lecture font-semibold disabled:opacity-40";

  return (
    <section className="flex flex-col gap-4">
      <div className="rounded-[26px] bg-card p-5">
        <div className="flex items-baseline justify-between">
          <p className="mono-label text-muted-foreground">
            Match {partie.visibilite === "prive" ? "privé" : "public"} · par {partie.organisateur}
          </p>
          <p className="text-titre-m font-bold tabular-nums">
            {venus.length}
            <span className="text-muted-foreground">/{partie.places}</span>
          </p>
        </div>
      </div>
      {onDiscussion && (moiLa || organise) && (
        <button type="button" onClick={onDiscussion} className={cn(bouton, "bouton-secondaire bouton--mauve gap-2.5")}>
          <MessageCircle className="size-[18px]" strokeWidth={2.2} />
          Discussion du match
          {nonLus > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full px-[5px] text-petit leading-none font-bold text-white tabular-nums" style={{ background: "#FF3B30" }}>
              {nonLus > 9 ? "9+" : nonLus}
            </span>
          )}
        </button>
      )}
      {/* Un cran plus grand dans le panneau de droite, sur grand écran (globals.css). */}
      <div className="terrain-grand-panneau">
        <TerrainPlaces
          places={partie.places}
          occupants={occupants}
          moi={moiNom}
          retirable={organise && !joue}
          onOccupant={
            organise && !joue && !occupe
              ? (o) => {
                  if (o.cle === partie.organisateurId) return;
                  if (window.confirm(`Retirer ${o.nom.split(" ")[0]} du match ?`))
                    void faire(() => retirerJoueur(partie.id, o.cle), `${o.nom.split(" ")[0]} n'est plus dans le match.`);
                }
              : undefined
          }
          onPlus={
            joue || occupe
              ? undefined
              : organise
                ? () => setChoisir(true)
                : undefined
          }
        />
      </div>
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
            <span className="text-affiche leading-none font-extrabold tracking-tight tabular-nums">
              {partie.scoreClairs} <span className="text-encre-4">–</span> {partie.scoreFonces}
            </span>
            <span className="mono-label text-muted-foreground">Foncés</span>
          </div>
          {mvps.length > 0 && (
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="mono-label text-muted-foreground">{mvps.length > 1 ? "MVP ex æquo" : "MVP"}</span>
              <QuiVient className="justify-center" noms={presents.filter((j) => mvps.includes(j.id)).map((j) => j.name)} />
            </div>
          )}
          <BilanResultat matchId={partie.id} organise={organise} className="mt-5 border-t border-contraste/[0.06] pt-4" />
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

      {/* Ma réponse : la piste à deux sens à l'invitation, à un sens (la
          braise : il manque des joueurs) pour prendre une place ; une fois
          donnée, le sceau. L'organisateur, lui, est du match d'office. */}
      {!joue && !organise && moiLa?.statut === "invite" && (
        <ReponseScellee
          mine={null}
          onRepondre={(r) =>
            repondre(async () => {
              if (r === "present") return accepter(partie.id);
              await refuser(partie.id);
              setRefuse(true);
            })
          }
          onScellee={onChange}
        />
      )}
      {!joue && !organise && (moiLa?.statut === "inscrit" || (!moiLa && refuse)) && (
        <ReponseScellee mine={moiLa ? "present" : "absent"} onRepondre={async () => "figee"} />
      )}
      {!joue && !moiLa && !refuse && partie.visibilite === "public" && libres > 0 && !!moi && (
        <ReponseScellee
          mine={null}
          seul={{ r: "present", libelle: "Prendre une place" }}
          tonSeul="braise"
          onRepondre={() => repondre(() => rejoindre(partie.id))}
          onScellee={onChange}
        />
      )}
      {organise && !joue && (
        <div className="grid grid-cols-2 gap-2">
          <button disabled={occupe} onClick={() => setModifier((n) => n + 1)} className={cn(bouton, "bouton-secondaire")}>
            Modifier
          </button>
          <button
            disabled={occupe}
            onClick={() => {
              if (window.confirm("Annuler ce match pour tout le monde ?")) void faire(() => annuler(partie.id), "Match annulé.");
            }}
            className={cn(bouton, "bouton-secondaire bouton--rouge")}
          >
            Annuler le match
          </button>
        </div>
      )}
      {organise && joue && !saisi && (
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
      {modifier > 0 && (
        <OuvrirMatch
          key={modifier}
          open
          onOpenChange={(o) => !o && setModifier(0)}
          terrains={terrains}
          terrainInitial={null}
          moi={moi}
          partie={partie}
          onOuvert={onChange}
        />
      )}
    </section>
  );
}
