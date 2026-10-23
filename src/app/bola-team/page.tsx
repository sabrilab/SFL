"use client";

// Team — le mode équipe (Sabri, 22/10 ; règles officielles : BOLA
// docs/gameplay/04, 11 et 13 ; la logique : lib/sfl/equipes.ts).
//
// De haut en bas :
//   · les équipes qui m'invitent : qui m'invite, jusqu'à quand, les cartes
//     de ceux qui y jouent ; les rejoindre, c'est signer le Règlement. La
//     notification, la carte posée sur la Map (equipe/invitation-map.tsx)
//     et le lien d'une équipe ouvrent directement la signature
//     (/bola-team?invitation=id, ?lien=jeton) ;
//   · mon équipe : son écusson, « En formation » tant qu'elle n'a pas 5
//     signataires (« Il manque 3 », en braise : de vraies places à
//     prendre), « Active » ensuite ; « Discussion de l'équipe » (l'onglet
//     Équipe de matchs/discussion-match.tsx, avec ce que je n'y ai pas lu) ;
//     le terrain (terrain-places.tsx), chacun à sa place, les invités en
//     pointillé avec le temps qui leur reste, un + sur chaque place libre ;
//     « Inviter des joueurs » (en tête tant que l'équipe se forme, sous le
//     terrain ensuite) ouvre la liste de Bola, où l'on en coche plusieurs,
//     ceux qui ne peuvent pas venir grisés avec la raison, et l'invitation
//     par lien pour un nouveau. Puis ses défis : reçus, envoyés, à jouer ;
//   · sans équipe : « Créer mon équipe », puis la liste des joueurs s'ouvre
//     d'elle-même pour inviter ;
//   · les autres équipes, chacune avec « Défier » quand les deux sont à 5.
// Toucher un joueur du terrain ouvre sa fiche : sa carte, son rôle, sa
// signature. Le capitaine y nomme ou retire le vice et exclut (48 h de
// préavis) ; sur un invité, il le relance ou retire l'invitation. Tout ce
// qui défait se confirme dans une fiche, jamais dans une alerte du
// navigateur. Une équipe en formation n'apparaît pas aux autres. Les règles
// (délais, limites) sont gardées par la base.
//
// Passe du 23/10 (Sabri : « quand on va ajouter un nouveau joueur, ce n'est
// pas assez fluide : c'est bloqué ») : l'invité n'était prévenu nulle part,
// une invitation ressemblait à un joueur déjà là, une invitation par
// ouverture de la liste, et le seul geste sur un invité était de le retirer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { MessageCircle, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { CreerEquipe } from "@/components/sfl/equipe/creer-equipe";
import { SignerReglement } from "@/components/sfl/equipe/reglement";
import { Defier } from "@/components/sfl/equipe/defier";
import { TerrainPlaces, type Occupant } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { useSession } from "@/hooks/use-session";
import { signalerEquipe, useMonEquipe } from "@/hooks/use-mon-equipe";
import {
  MAX_EQUIPE,
  MIN_EQUIPE,
  RAISON_INDISPO,
  active,
  annulerSeraitForfait,
  direErreurEquipe,
  dissoudreEquipe,
  enCours,
  etatEquipe,
  exclureMembre,
  indisponibles,
  invitationsPossibles,
  invites,
  inviterJoueurs,
  inviteur,
  lienEquipe,
  listerDefis,
  listerEquipes,
  nommerVice,
  notifierEquipe,
  quitterEquipe,
  rejoindreParLien,
  repondreDefi,
  retirerInvitation,
  signataires,
  urlDuLien,
  type Defi,
  type Equipe,
  type Indispo,
  type Membre,
} from "@/lib/sfl/equipes";
import { finInvitation, quandTombe, resteAvant } from "@/lib/sfl/equipes-temps";
import { DEMO_EQUIPES, demoEquipes } from "@/lib/sfl/equipes-demo";
import { libelleJour, listerProfils, monId, type Profil } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const LIEN_EN_ATTENTE = "sfl-equipe-lien";
const prenom = (nom: string) => nom.split(" ")[0];
/** « de Bilal », « d'Adil ». */
const de = (nom: string) => (/^[aeiouyàâäéèêëîïôöûü]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

let seq = 0;

/** Un geste qui défait, à confirmer dans une fiche (au lieu d'une alerte du navigateur). */
interface AConfirmer {
  titre: string;
  texte?: string;
  /** Le bouton qui défait, et celui qui garde tout tel quel. */
  oui: string;
  non: string;
  action: () => void;
}

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

function Pilule({ children, onClick, plein = true, ton, disabled }: { children: React.ReactNode; onClick: () => void; plein?: boolean; ton?: "bouton--vert" | "bouton--mauve" | "bouton--rouge"; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "shrink-0 px-3.5 py-1.5 text-[13px] font-semibold disabled:opacity-50",
        plein ? "bouton-principal" : "bouton-secondaire",
        ton
      )}
    >
      {children}
    </button>
  );
}

/** Une équipe qui m'invite : qui, jusqu'à quand, ceux qui ont signé, et la réponse. */
function InvitationRecue({ e, moi, onRefuser, onRejoindre }: { e: Equipe; moi: string | null; onRefuser: () => void; onRejoindre: () => void }) {
  const m = e.membres.find((x) => x.id === moi && x.statut === "invite");
  const deja = signataires(e);
  return (
    <div className="flex flex-col gap-3 rounded-[24px] bg-card p-3.5">
      <div className="flex items-center gap-3">
        <Ecusson initiales={e.initiales} fond={e.fond} taille={50} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-[18px] leading-tight font-bold tracking-tight">{e.nom}</span>
          {m && (
            <span className="truncate text-[13px] text-muted-foreground">
              {inviteur(e, m)} t&apos;invite{m.depuis && <> · jusqu&apos;à {quandTombe(finInvitation(m.depuis))}</>}
            </span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {deja.map((x) => (
          <CarteDe key={x.id} name={x.name} size={FORMAT_CARTE.petite} />
        ))}
        <span className="mono-label ml-auto pl-2 text-muted-foreground">
          {deja.length} / {active(e) ? MAX_EQUIPE : MIN_EQUIPE}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="destructive" className="h-11 rounded-full text-[15px] font-semibold" onClick={onRefuser}>
          Refuser
        </Button>
        <Button variant="vert" className="h-11 rounded-full text-[15px] font-semibold" onClick={onRejoindre}>
          Rejoindre
        </Button>
      </div>
    </div>
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
  const [indispos, setIndispos] = useState<Map<string, Indispo> | null>(null);
  const [joueur, setJoueur] = useState<Membre | null>(null);
  const [confirmer, setConfirmer] = useState<AConfirmer | null>(null);
  // Une invitation à ouvrir dès que les équipes sont là (notification, Map,
  // lien), et la liste des joueurs à ouvrir juste après la création.
  const aOuvrir = useRef<number | null>(null);
  const inviterApres = useRef(false);
  // Ce que je n'ai pas lu dans la discussion de mon équipe.
  const nonLus = useMonEquipe().nonLus;

  // La notification ou la carte de la Map (?invitation=id), ou le lien d'une
  // équipe après l'inscription (?lien=jeton) : repris une fois connecté.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("invitation");
    const jeton = q.get("lien");
    if (id && /^\d+$/.test(id)) aOuvrir.current = Number(id);
    if (jeton) {
      try {
        localStorage.setItem(LIEN_EN_ATTENTE, jeton);
      } catch {}
    }
    if (id || jeton) window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Une fois connecté : mes joueurs, un lien ouvert avant de se connecter,
  // et le temps réel (un seul canal ; chaque changement relit les équipes).
  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    listerProfils()
      .then((p) => !fini && setProfils(p))
      .catch(() => {});
    let jeton: string | null = null;
    try {
      jeton = localStorage.getItem(LIEN_EN_ATTENTE);
      localStorage.removeItem(LIEN_EN_ATTENTE);
    } catch {}
    if (jeton)
      rejoindreParLien(jeton).then(
        (id) => {
          aOuvrir.current = id;
          recharger();
        },
        (e) => toast.error(direErreurEquipe(e))
      );
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`team-${++seq}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "equipe_membres" }, recharger)
        .on("postgres_changes", { event: "*", schema: "public", table: "equipe_defis" }, recharger)
        .subscribe();
    } catch {}
    return () => {
      fini = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [connecte, recharger]);

  useEffect(() => {
    if (!connecte) return;
    let fini = false;
    Promise.all([listerEquipes(), listerDefis(), monId()])
      .then(([e, d, id]) => {
        if (fini) return;
        setEquipes(e);
        setDefis(d);
        setMoiId(id);
        setIndisponible(false);
        // L'invitation qu'on vient ouvrir : sa signature, tout de suite.
        const voulue = aOuvrir.current;
        if (voulue != null && id) {
          aOuvrir.current = null;
          const x = e.find((q) => q.id === voulue);
          if (x && invites(x).some((m) => m.id === id)) setASigner(x);
          else if (!x?.membres.some((m) => m.id === id && m.statut === "membre")) toast("Cette invitation n'est plus valable.");
        }
        // L'équipe vient d'être créée : on invite.
        const creee = id ? e.find((x) => x.membres.some((m) => m.id === id && m.statut === "membre" && m.role === "capitaine")) : null;
        if (inviterApres.current && creee) {
          inviterApres.current = false;
          setChoisir(true);
          indisponibles(creee.id).then(
            (r) => !fini && setIndispos(r),
            () => {}
          );
        }
      })
      .catch(() => !fini && setIndisponible(true));
    return () => {
      fini = true;
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
  const invitations = monde.equipes.filter((e) => invites(e).some((m) => m.id === moi));
  // Une équipe en formation (moins de 5) reste invisible aux autres (doc 04 §6).
  const autres = monde.equipes.filter((e) => e.id !== mienne?.id && active(e));
  const charge = apercu || equipes !== null;
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
      signalerEquipe();
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

  const ouvrirChoix = () => {
    if (!mienne) return;
    setChoisir(true);
    if (!apercu)
      indisponibles(mienne.id).then(setIndispos, () => setIndispos(null));
  };

  async function inviter(ps: Profil[]) {
    if (!mienne) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    const { invites: partis, refus } = await inviterJoueurs(mienne.id, ps);
    if (partis.length === 1) toast.success(`Invitation envoyée à ${prenom(partis[0])}.`);
    else if (partis.length > 1) toast.success(`${partis.length} invitations envoyées.`);
    for (const r of refus) toast.error(`${prenom(r.name)} : ${r.raison}`);
    recharger();
  }

  async function relancer(m: Membre) {
    if (!mienne) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    const r = await notifierEquipe(mienne.id, "relance", m.id);
    if (r?.tropTot) toast(`${prenom(m.name)} a été prévenu il y a moins de 12 h.`);
    else if (r) toast.success(`${prenom(m.name)} est relancé.`);
    else toast.error("Relance impossible pour l'instant. Réessaie dans un instant.");
  }

  // Qui ne peut pas venir, et pourquoi : d'abord ce que l'app sait seule
  // (les joueurs d'une autre équipe, avec son nom quand elle est active),
  // puis la base, qui sait le reste (un départ, une carence, un compte en
  // attente). Sans la base (un aperçu), la liste se contente du premier.
  const raisons = useMemo(() => {
    const r = new Map<string, string>();
    if (!mienne) return r;
    for (const e of monde.equipes) {
      if (e.id === mienne.id) continue;
      for (const m of signataires(e)) r.set(m.id, active(e) ? `Chez ${e.nom}` : RAISON_INDISPO.equipe);
    }
    for (const [id, raison] of indispos ?? []) if (raison !== "equipe" || !r.has(id)) r.set(id, RAISON_INDISPO[raison]);
    return r;
  }, [mienne, monde.equipes, indispos]);

  const signes = mienne ? signataires(mienne) : [];
  const enAttente = mienne ? invites(mienne) : [];
  const libres = Math.max(0, MAX_EQUIPE - signes.length);
  const occupants: Occupant[] = [
    ...signes.map((m) => ({ cle: m.id, nom: m.name })),
    ...enAttente.slice(0, libres).map((m) => ({
      cle: m.id,
      nom: m.name,
      enAttente: true,
      reste: m.depuis ? resteAvant(finInvitation(m.depuis)) : undefined,
    })),
  ];
  // Plus d'invités que de places (permis : les premiers qui signent entrent).
  const deborde = enAttente.slice(libres);
  const peutInviter = !!mienne && capitaine && invitationsPossibles(mienne) > 0;

  const recus = mienne ? monde.defis.filter((d) => d.a === mienne.id && d.statut === "propose") : [];
  const envoyes = mienne ? monde.defis.filter((d) => d.de === mienne.id && d.statut === "propose") : [];
  const aJouer = mienne ? monde.defis.filter((d) => (d.a === mienne.id || d.de === mienne.id) && d.statut === "accepte" && enCours(d)) : [];
  // Annuler un match programmé : libre jusqu'à 48 h avant, forfait ensuite.
  const annulerMatch = (d: Defi) => {
    const forfait = annulerSeraitForfait(d);
    setConfirmer({
      titre: forfait ? "Déclarer forfait ?" : "Annuler ce match ?",
      texte: forfait ? "À moins de 48 h du coup d'envoi, annuler, c'est déclarer forfait." : undefined,
      oui: forfait ? "Déclarer forfait" : "Annuler le match",
      non: "Garder le match",
      action: () => void agir(() => repondreDefi(d.id, "annule"), forfait ? "Forfait déclaré." : "Match annulé."),
    });
  };
  const quand = (d: Defi) => `${libelleJour(d.jour)} · ${d.heure.slice(0, 5)} · ${d.lieu}`;

  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-7 px-5 pt-2 pb-8 sm:pt-6">
      <h1 className="sr-only">Team</h1>
      <EnteteLigue actif="/bola-team" />

      {invitations.length > 0 && (
        <section className="flex flex-col gap-2.5">
          {invitations.map((e) => (
            <InvitationRecue
              key={e.id}
              e={e}
              moi={moi}
              onRefuser={() => moi && void agir(() => retirerInvitation(e.id, moi), "Invitation refusée.")}
              onRejoindre={() => setASigner(e)}
            />
          ))}
        </section>
      )}

      {mienne ? (
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <Ecusson initiales={mienne.initiales} fond={mienne.fond} taille={76} />
            <div className="flex min-w-0 flex-col gap-1.5">
              <h2 className="truncate text-[28px] leading-none font-bold tracking-tight">{mienne.nom}</h2>
              <span className="mono-label text-muted-foreground">{etatEquipe(mienne)}</span>
              {!active(mienne) && (
                <span className="mono-label text-braise">Il manque {MIN_EQUIPE - signes.length}</span>
              )}
            </div>
          </div>
          {peutInviter && !active(mienne) && (
            <Button variant="mauve" onClick={ouvrirChoix} className="h-12 gap-2.5 rounded-full text-[15px] font-semibold">
              <UserPlus className="size-[18px]" strokeWidth={2.2} />
              Inviter des joueurs
            </Button>
          )}
          {!apercu && (
            <Link
              href="/?discussion=equipe"
              className="bouton-secondaire bouton--mauve flex h-12 items-center justify-center gap-2.5 text-[15px] font-semibold"
            >
              <MessageCircle className="size-[18px]" strokeWidth={2.2} />
              Discussion de l&apos;équipe
              {nonLus > 0 && (
                <span
                  className="flex h-5 min-w-5 items-center justify-center rounded-full px-[5px] text-[11.5px] leading-none font-bold text-white tabular-nums"
                  style={{ background: "#FF3B30" }}
                >
                  {nonLus > 9 ? "9+" : nonLus}
                </span>
              )}
            </Link>
          )}
          <TerrainPlaces
            places={MAX_EQUIPE}
            unCamp
            moi={moiNom}
            occupants={occupants}
            toucher="voir"
            onPlus={peutInviter ? ouvrirChoix : undefined}
            onOccupant={(o) => {
              const m = mienne.membres.find((x) => x.id === o.cle);
              if (m && m.id !== moi) setJoueur(m);
            }}
          />
          {deborde.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {deborde.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setJoueur(m)}
                  className="flex items-center gap-2.5 rounded-[18px] bg-card py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-semibold transition-transform active:scale-95"
                >
                  <span className="flex rounded-[14px] border-[1.5px] border-dashed border-white/60 p-px opacity-60">
                    <CarteDe name={m.name} size={FORMAT_CARTE.petite} inerte />
                  </span>
                  {prenom(m.name)}
                  {m.depuis && <span className="font-medium text-muted-foreground tabular-nums">{resteAvant(finInvitation(m.depuis))}</span>}
                </button>
              ))}
            </div>
          )}
          {peutInviter && active(mienne) && (
            <Button variant="secondary" onClick={ouvrirChoix} className="bouton--mauve h-12 gap-2.5 rounded-full text-[15px] font-semibold">
              <UserPlus className="size-[18px]" strokeWidth={2.2} />
              Inviter des joueurs
            </Button>
          )}

          {recus.map((d) => {
            const e = nomDe(d.de);
            return e ? (
              <div key={d.id} className="flex flex-col gap-2.5 rounded-[22px] bg-card p-3">
                <LigneEquipe e={e} droite={<span className="mono-label pr-1 text-foreground">Défi</span>} />
                <p className="px-1 text-[14px] font-semibold">{quand(d)}</p>
                {capitaine && (
                  <div className="grid grid-cols-2 gap-2">
                    <Pilule plein={false} ton="bouton--rouge" onClick={() => void agir(() => repondreDefi(d.id, "refuse"))}>
                      Refuser
                    </Pilule>
                    <Pilule ton="bouton--vert" onClick={() => void agir(() => repondreDefi(d.id, "accepte"), "Défi accepté.")}>Accepter</Pilule>
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
                      capitaine && d.de === mienne.id ? (
                        <Pilule plein={false} ton="bouton--rouge" onClick={() => void agir(() => repondreDefi(d.id, "annule"), "Défi retiré.")}>
                          Retirer
                        </Pilule>
                      ) : null
                    ) : capitaine ? (
                      <Pilule plein={false} ton="bouton--rouge" onClick={() => annulerMatch(d)}>
                        Annuler
                      </Pilule>
                    ) : (
                      <span className="mono-label text-foreground">À jouer</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : charge ? (
        <Button
          variant={invitations.length > 0 ? "secondary" : "vert"}
          onClick={() => setCreer(true)}
          className={cn("h-12 rounded-full text-[15px] font-semibold", invitations.length > 0 && "bouton--vert")}
        >
          Créer mon équipe
        </Button>
      ) : null}

      {autres.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="mono-label text-muted-foreground">Équipes</h2>
          {autres.map((e) => {
            const dejaDefie = monde.defis.some(
              (d) => enCours(d) && ((d.de === mienne?.id && d.a === e.id) || (d.a === mienne?.id && d.de === e.id))
            );
            const peutDefier = !!mienne && capitaine && active(mienne) && active(e) && !dejaDefie;
            return <LigneEquipe key={e.id} e={e} droite={peutDefier ? <Pilule ton="bouton--mauve" onClick={() => setAdversaire(e)}>Défier</Pilule> : undefined} />;
          })}
        </section>
      )}

      {mienne && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            onClick={() =>
              setConfirmer({
                titre: `Quitter ${mienne.nom} pour toujours ?`,
                oui: "Quitter",
                non: "Rester",
                action: () => void agir(() => quitterEquipe(mienne.id)),
              })
            }
            className="bouton-discret bouton--rouge px-4 py-2 text-[13px] font-semibold"
          >
            Quitter l&apos;équipe
          </button>
          {monRole === "capitaine" && (
            <button
              type="button"
              onClick={() =>
                setConfirmer({
                  titre: `Dissoudre ${mienne.nom} ?`,
                  oui: "Dissoudre",
                  non: "Garder l'équipe",
                  action: () => void agir(() => dissoudreEquipe(mienne.id)),
                })
              }
              className="bouton-discret bouton--rouge px-4 py-2 text-[13px] font-semibold"
            >
              Dissoudre
            </button>
          )}
        </div>
      )}

      <CreerEquipe
        open={creer}
        onOpenChange={setCreer}
        apercu={apercu}
        onCree={() => {
          inviterApres.current = true;
          recharger();
          signalerEquipe();
        }}
      />
      <SignerReglement
        equipe={aSigner}
        moi={moi}
        onOpenChange={(o) => !o && setASigner(null)}
        apercu={apercu}
        onSigne={() => {
          recharger();
          signalerEquipe();
        }}
      />
      <Defier mienne={mienne} adversaire={adversaire} onOpenChange={(o) => !o && setAdversaire(null)} apercu={apercu} onDefie={recharger} />
      {mienne && (
        <ChoisirJoueur
          open={choisir}
          onOpenChange={setChoisir}
          profils={profils}
          exclus={new Set([...(moi ? [moi] : []), ...mienne.membres.map((m) => m.id)])}
          libres={new Set()}
          moiNom={moiNom}
          onChoisir={(p) => void inviter([p])}
          onLien={partagerLien}
          plusieurs={{ max: invitationsPossibles(mienne), onInviter: (ps) => void inviter(ps) }}
          indispos={raisons}
        />
      )}

      {/* Un joueur de mon équipe, ou un invité : sa carte, et ce qu'on peut y faire. */}
      <Sheet open={!!joueur} onOpenChange={(o) => !o && setJoueur(null)}>
        <SheetContent side="bottom" className="rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {mienne && joueur && (
            <FicheJoueur
              equipe={mienne}
              joueur={joueur}
              monRole={monRole}
              onRelancer={() => {
                setJoueur(null);
                void relancer(joueur);
              }}
              onRetirer={() => {
                setJoueur(null);
                setConfirmer({
                  titre: `Retirer l'invitation ${de(prenom(joueur.name))} ?`,
                  oui: "Retirer l'invitation",
                  non: "Garder l'invitation",
                  action: () => void agir(() => retirerInvitation(mienne.id, joueur.id), "Invitation retirée."),
                });
              }}
              onVice={() => {
                setJoueur(null);
                void agir(
                  () => nommerVice(mienne.id, joueur.role === "vice" ? null : joueur.id),
                  joueur.role === "vice" ? "Plus de vice-capitaine." : `${prenom(joueur.name)} est vice-capitaine.`
                );
              }}
              onExclure={() => {
                setJoueur(null);
                if (joueur.departLe) {
                  void agir(() => exclureMembre(mienne.id, joueur.id), "Exclusion annulée.");
                  return;
                }
                setConfirmer({
                  titre: `Exclure ${prenom(joueur.name)} ?`,
                  texte: "Départ dans 48 h, sans retour possible dans l'équipe.",
                  oui: "Exclure",
                  non: `Garder ${prenom(joueur.name)}`,
                  action: () => void agir(() => exclureMembre(mienne.id, joueur.id), "Exclusion dans 48 h."),
                });
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Tout ce qui défait : retirer, exclure, quitter, dissoudre, annuler. */}
      <Sheet open={!!confirmer} onOpenChange={(o) => !o && setConfirmer(null)}>
        <SheetContent side="bottom" className="rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="pr-10 text-[22px] font-bold tracking-tight">{confirmer?.titre}</SheetTitle>
            {confirmer?.texte && <p className="text-[14px] text-muted-foreground">{confirmer.texte}</p>}
          </SheetHeader>
          {confirmer && (
            <div className="flex flex-col gap-2 px-4">
              <Button
                variant="destructive"
                className="h-12 rounded-full text-[15px] font-semibold"
                onClick={() => {
                  setConfirmer(null);
                  confirmer.action();
                }}
              >
                {confirmer.oui}
              </Button>
              <Button variant="ghost" className="h-12 rounded-full text-[15px] font-semibold" onClick={() => setConfirmer(null)}>
                {confirmer.non}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

const ROLE = { capitaine: "Capitaine", vice: "Vice-capitaine", membre: "Membre" } as const;

/** La fiche d'un joueur touché sur le terrain : sa carte, où il en est, et les gestes du capitaine. */
function FicheJoueur({
  equipe,
  joueur,
  monRole,
  onRelancer,
  onRetirer,
  onVice,
  onExclure,
}: {
  equipe: Equipe;
  joueur: Membre;
  monRole: Membre["role"] | null;
  onRelancer: () => void;
  onRetirer: () => void;
  onVice: () => void;
  onExclure: () => void;
}) {
  const capitaine = monRole === "capitaine" || monRole === "vice";
  const invite = joueur.statut === "invite";
  const date = (iso: string, avecHeure = false) =>
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris",
      ...(avecHeure ? { weekday: "long", hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "long" }),
    }).format(new Date(iso));
  const etat = invite
    ? [`Invité par ${inviteur(equipe, joueur)}`, joueur.depuis && `jusqu'à ${quandTombe(finInvitation(joueur.depuis))}`]
    : [ROLE[joueur.role], joueur.signeLe && `a signé le ${date(joueur.signeLe)}`];
  return (
    <>
      <SheetHeader className="flex-row items-center gap-4 px-5 pt-5 pb-0">
        <span className={cn("shrink-0", invite && "opacity-60")}>
          <CarteDe name={joueur.name} size={FORMAT_CARTE.moyenne} />
        </span>
        <span className="flex min-w-0 flex-col gap-1 pr-8">
          <SheetTitle className="text-[24px] leading-tight font-bold tracking-tight">{joueur.name}</SheetTitle>
          <span className="text-[14px] text-muted-foreground">{etat.filter(Boolean).join(" · ")}</span>
          {joueur.departLe && <span className="text-[14px] font-semibold text-foreground">Part {date(joueur.departLe, true)}</span>}
        </span>
      </SheetHeader>
      {invite && capitaine ? (
        <div className="flex flex-col gap-2 px-4">
          <Button variant="mauve" className="h-12 rounded-full text-[15px] font-semibold" onClick={onRelancer}>
            Relancer {prenom(joueur.name)}
          </Button>
          <Button variant="ghost" className="bouton--rouge h-12 rounded-full text-[15px] font-semibold" onClick={onRetirer}>
            Retirer l&apos;invitation
          </Button>
        </div>
      ) : !invite && monRole === "capitaine" && joueur.role !== "capitaine" ? (
        <div className="flex flex-col gap-2 px-4">
          {!joueur.departLe && (
            <Button
              variant="secondary"
              className={cn(joueur.role === "vice" ? "bouton--rouge" : "bouton--or", "h-12 rounded-full text-[15px] font-semibold")}
              onClick={onVice}
            >
              {joueur.role === "vice" ? "Retirer le brassard de vice" : "Nommer vice-capitaine"}
            </Button>
          )}
          <Button variant={joueur.departLe ? "secondary" : "ghost"} className={cn("h-12 rounded-full text-[15px] font-semibold", !joueur.departLe && "bouton--rouge")} onClick={onExclure}>
            {joueur.departLe ? "Annuler l'exclusion" : "Exclure (48 h de préavis)"}
          </Button>
        </div>
      ) : (
        <span aria-hidden />
      )}
    </>
  );
}
