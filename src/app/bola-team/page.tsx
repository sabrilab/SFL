"use client";

// Team — le mode équipe (Sabri, 22/10 ; règles officielles : BOLA
// docs/gameplay/04 et 11 ; la logique : lib/sfl/equipes.ts).
//
// De haut en bas :
//   · les équipes qui m'invitent : les rejoindre, c'est signer le Règlement ;
//   · mon équipe : son écusson, puis le terrain (terrain-places.tsx) avec
//     ses joueurs à leur place et un + sur chaque place libre jusqu'à 7. Le
//     + ouvre la liste des joueurs de Bola, et l'invitation par lien pour
//     un nouveau. Puis ses défis : reçus, envoyés, à jouer ;
//   · sans équipe : « Créer mon équipe » ;
//   · les autres équipes, chacune avec « Défier » quand les deux sont à 5.
// Un lien d'invitation ouvert avant de se connecter (/equipe/[jeton]) est
// repris ici, une fois connecté.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChoixLigue } from "@/components/sfl/choix-ligue";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { CreerEquipe } from "@/components/sfl/equipe/creer-equipe";
import { SignerReglement } from "@/components/sfl/equipe/reglement";
import { Defier } from "@/components/sfl/equipe/defier";
import { TerrainPlaces } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { useSession } from "@/hooks/use-session";
import {
  MAX_EQUIPE,
  MIN_EQUIPE,
  active,
  direErreurEquipe,
  inviterEquipe,
  invites,
  lienEquipe,
  listerDefis,
  listerEquipes,
  quitterEquipe,
  rejoindreParLien,
  repondreDefi,
  retirerInvitation,
  signataires,
  urlDuLien,
  type Defi,
  type Equipe,
} from "@/lib/sfl/equipes";
import { DEMO_EQUIPES, demoEquipes } from "@/lib/sfl/equipes-demo";
import { libelleJour, listerProfils, monId, type Profil } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const LIEN_EN_ATTENTE = "sfl-equipe-lien";

function LigneEquipe({ e, droite }: { e: Equipe; droite?: React.ReactNode }) {
  const n = signataires(e).length;
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5">
      <Ecusson initiales={e.initiales} fond={e.fond} taille={42} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15.5px] font-semibold">{e.nom}</span>
        <span className="truncate text-[12.5px] text-muted-foreground">
          {[e.ville, `${n} / ${MAX_EQUIPE}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      {droite}
    </div>
  );
}

function Pilule({ children, onClick, plein = true, disabled }: { children: React.ReactNode; onClick: () => void; plein?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50",
        plein ? "bouton-principal" : "bouton-secondaire"
      )}
    >
      {children}
    </button>
  );
}

export default function BolaTeamPage() {
  const session = useSession();
  const connecte = !!session?.server;
  const { me } = useMyPlayer();
  const { allPlayers } = useSeason();
  const [equipes, setEquipes] = useState<Equipe[] | null>(null);
  const [defis, setDefis] = useState<Defi[]>([]);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [moiId, setMoiId] = useState<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const [tick, setTick] = useState(0);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  const [creer, setCreer] = useState(false);
  const [aSigner, setASigner] = useState<Equipe | null>(null);
  const [adversaire, setAdversaire] = useState<Equipe | null>(null);
  const [choisir, setChoisir] = useState(false);
  const [quitter, setQuitter] = useState(false);

  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    const charger = () => {
      Promise.all([listerEquipes(), listerDefis()])
        .then(([e, d]) => {
          if (fini) return;
          setEquipes(e);
          setDefis(d);
          setIndisponible(false);
        })
        .catch(() => !fini && setIndisponible(true));
    };
    void monId().then((id) => !fini && setMoiId(id));
    listerProfils()
      .then((p) => !fini && setProfils(p))
      .catch(() => {});
    // Un lien ouvert avant de se connecter : on le reprend ici.
    let jeton: string | null = null;
    try {
      jeton = localStorage.getItem(LIEN_EN_ATTENTE);
      localStorage.removeItem(LIEN_EN_ATTENTE);
    } catch {}
    if (jeton) rejoindreParLien(jeton).then(charger, (e) => toast.error(direErreurEquipe(e)));
    charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`team-${tick}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "equipe_membres" }, charger)
        .on("postgres_changes", { event: "*", schema: "public", table: "equipe_defis" }, charger)
        .subscribe();
    } catch {}
    return () => {
      fini = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [connecte, tick]);

  // Aperçu (jamais en production) : la base n'a pas encore les équipes.
  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const apercu = DEMO_EQUIPES && (indisponible || !connecte) && noms.length >= 12;
  const monde = useMemo(
    () => (apercu ? demoEquipes(noms, me) : { equipes: equipes ?? [], defis }),
    [apercu, noms, me, equipes, defis]
  );
  const moi = apercu ? `demo-${me}` : moiId;
  const moiNom = apercu ? me : (profils.find((p) => p.id === moiId)?.name ?? me);

  const mienne = monde.equipes.find((e) => e.membres.some((m) => m.id === moi && m.statut === "membre")) ?? null;
  const monRole = mienne?.membres.find((m) => m.id === moi)?.role ?? null;
  const capitaine = monRole === "capitaine" || monRole === "vice";
  const invitations = monde.equipes.filter((e) => e.membres.some((m) => m.id === moi && m.statut === "invite"));
  const autres = monde.equipes.filter((e) => e.id !== mienne?.id);
  const nomDe = (id: number) => monde.equipes.find((e) => e.id === id);

  const agir = async (f: () => Promise<unknown>, ok?: string) => {
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    try {
      await f();
      if (ok) toast.success(ok);
      recharger();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    }
  };

  async function partagerLien() {
    if (!mienne) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    try {
      const url = urlDuLien(await lienEquipe(mienne.id));
      const texte = `Rejoins ${mienne.nom} sur Bola`;
      if (navigator.share) await navigator.share({ title: mienne.nom, text: texte, url }).catch(() => {});
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Lien copié.");
      }
      setChoisir(false);
    } catch (e) {
      toast.error(direErreurEquipe(e));
    }
  }

  const occupants = mienne
    ? [
        ...signataires(mienne).map((m) => ({ cle: m.id, nom: m.name })),
        ...invites(mienne).map((m) => ({ cle: m.id, nom: m.name, enAttente: true })),
      ]
    : [];
  const recus = mienne ? monde.defis.filter((d) => d.a === mienne.id && d.statut === "propose") : [];
  const envoyes = mienne ? monde.defis.filter((d) => d.de === mienne.id && d.statut === "propose") : [];
  const aJouer = mienne ? monde.defis.filter((d) => (d.a === mienne.id || d.de === mienne.id) && d.statut === "accepte") : [];
  const quand = (d: Defi) => `${libelleJour(d.jour)} · ${d.heure.slice(0, 5)} · ${d.lieu}`;

  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-7 px-5 pt-2 pb-8 sm:pt-6">
      <h1 className="sr-only">Team</h1>
      <ChoixLigue actif="/bola-team" />

      {invitations.length > 0 && (
        <section className="flex flex-col gap-2">
          {invitations.map((e) => (
            <LigneEquipe key={e.id} e={e} droite={<Pilule onClick={() => setASigner(e)}>Rejoindre</Pilule>} />
          ))}
        </section>
      )}

      {mienne ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Ecusson initiales={mienne.initiales} fond={mienne.fond} taille={76} />
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="truncate text-[28px] leading-none font-bold tracking-tight">{mienne.nom}</h2>
              <span className="mono-label text-muted-foreground">
                {[mienne.ville, `${signataires(mienne).length} / ${active(mienne) ? MAX_EQUIPE : MIN_EQUIPE}`].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
          <TerrainPlaces
            places={MAX_EQUIPE}
            unCamp
            moi={moiNom}
            occupants={occupants}
            onPlus={capitaine ? () => setChoisir(true) : undefined}
            onOccupant={
              capitaine
                ? (o) => {
                    if (o.enAttente) void agir(() => retirerInvitation(mienne.id, o.cle));
                  }
                : undefined
            }
          />

          {recus.map((d) => {
            const e = nomDe(d.de);
            return e ? (
              <div key={d.id} className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3">
                <LigneEquipe e={e} droite={<span className="mono-label pr-1 text-foreground">Défi</span>} />
                <p className="px-1 text-[14px] font-semibold">{quand(d)}</p>
                {capitaine && (
                  <div className="grid grid-cols-2 gap-2">
                    <Pilule plein={false} onClick={() => void agir(() => repondreDefi(d.id, "refuse"))}>
                      Refuser
                    </Pilule>
                    <Pilule onClick={() => void agir(() => repondreDefi(d.id, "accepte"), "Défi accepté.")}>Accepter</Pilule>
                  </div>
                )}
              </div>
            ) : null;
          })}

          {(aJouer.length > 0 || envoyes.length > 0) && (
            <div className="flex flex-col gap-2">
              {[...aJouer, ...envoyes].map((d) => {
                const e = nomDe(d.de === mienne.id ? d.a : d.de);
                if (!e) return null;
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5">
                    <Ecusson initiales={e.initiales} fond={e.fond} taille={36} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[15px] font-semibold">{e.nom}</span>
                      <span className="truncate text-[12.5px] text-muted-foreground">{quand(d)}</span>
                    </span>
                    {d.statut === "propose" ? (
                      capitaine ? (
                        <Pilule plein={false} onClick={() => void agir(() => repondreDefi(d.id, "annule"))}>
                          Annuler
                        </Pilule>
                      ) : null
                    ) : (
                      <span className="mono-label text-foreground">À jouer</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : (
        <Button onClick={() => setCreer(true)} className="h-12 rounded-full text-[15px] font-semibold">
          Créer mon équipe
        </Button>
      )}

      {autres.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mono-label text-muted-foreground">Équipes</h2>
          {autres.map((e) => {
            const dejaDefie = monde.defis.some((d) => (d.de === mienne?.id && d.a === e.id) || (d.a === mienne?.id && d.de === e.id));
            const peutDefier = !!mienne && capitaine && active(mienne) && active(e) && !dejaDefie;
            return <LigneEquipe key={e.id} e={e} droite={peutDefier ? <Pilule onClick={() => setAdversaire(e)}>Défier</Pilule> : undefined} />;
          })}
        </section>
      )}

      {mienne && (
        <button type="button" onClick={() => setQuitter(true)} className="bouton-discret self-center px-4 py-2 text-[13px] font-semibold">
          Quitter l&apos;équipe
        </button>
      )}

      <CreerEquipe open={creer} onOpenChange={setCreer} apercu={apercu} onCree={recharger} />
      <SignerReglement equipe={aSigner} onOpenChange={(o) => !o && setASigner(null)} apercu={apercu} onSigne={recharger} />
      <Defier mienne={mienne} adversaire={adversaire} onOpenChange={(o) => !o && setAdversaire(null)} apercu={apercu} onDefie={recharger} />
      {mienne && (
        <ChoisirJoueur
          open={choisir}
          onOpenChange={setChoisir}
          profils={profils}
          exclus={new Set([...(moi ? [moi] : []), ...mienne.membres.map((m) => m.id)])}
          libres={new Set()}
          moiNom={moiNom}
          onChoisir={(p) => void agir(() => inviterEquipe(mienne.id, p.id), `${p.name} est invité.`)}
          onLien={partagerLien}
        />
      )}
      {mienne && quitter && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/50 p-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]" onClick={() => setQuitter(false)}>
          <div className="mx-auto flex w-full max-w-[440px] flex-col gap-2 rounded-[26px] bg-card p-4" onClick={(e) => e.stopPropagation()}>
            <p className="px-1 pb-1 text-center text-[15px] font-semibold">Quitter {mienne.nom} pour toujours ?</p>
            <Button
              variant="destructive"
              className="h-12 rounded-full text-[15px] font-semibold"
              onClick={() => {
                setQuitter(false);
                void agir(() => quitterEquipe(mienne.id));
              }}
            >
              Quitter
            </Button>
            <Button variant="secondary" className="h-12 rounded-full text-[15px] font-semibold" onClick={() => setQuitter(false)}>
              Rester
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
