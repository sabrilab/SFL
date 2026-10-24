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
//
// Un terrain touché sur la Map (« Défier une équipe ici », /bola-team?terrain=id,
// un terrain du Nord : lib/sfl/terrains-nord.ts) : il se pose au-dessus des
// équipes à défier, sa photo et son adresse, et chaque défi part avec lui.
//
// Sur tablette et ordinateur (dès 768 px ; Sabri, 23/10 : « comme tu l'as
// fait pour l'onglet Actus »), la largeur des Actus (.gabarit-ligue) et deux
// colonnes au nombre d'or : à gauche, la grande, mon équipe et son terrain,
// qui prend un cran de plus dès 1024 px (.terrain-grand) ; à droite, ses
// défis et les autres équipes. Sous 768 px, rien ne bouge (les copies pour
// grand écran sont masquées, les enveloppes en display: contents).
//
// Passe du 24/10 (Sabri : « un championnat comme la Ligue 1 », « un vrai
// écusson d'équipe et de vraies couleurs », « contraints de répondre : oui
// ou non ? », « un règlement déontologique […] qu'ils doivent signer ») :
//   · deux vues sous l'en-tête, Mon équipe et Championnat (le tableau par
//     division, les buteurs et les passeurs, les récompenses :
//     equipe/championnat.tsx ; /bola-team?vue=championnat) ;
//   · sous le nom de mon équipe, sa place au championnat (la toucher ouvre
//     la vue) ; le capitaine (ou le vice) touche l'écusson pour le dessiner,
//     avec le maillot (equipe/editeur-blason.tsx) ;
//   · au capitaine et au vice, les feuilles de match à remplir, à confirmer
//     ou à corriger (equipe/feuille-team.tsx ; la notification ouvre
//     /bola-team?feuille=id) ; à qui avait signé la version 1, la Charte de
//     déontologie à signer (?charte=1 l'ouvre) ;
//   · les boutons Oui et Non de la notification d'invitation arrivent ici
//     (?invitation=id&reponse=oui|non) : Non refuse, Oui ouvre la signature ;
//   · sans accès à Bola Team (hooks/use-acces-team.ts), la vitrine du mode
//     à la place de « Créer mon équipe » (equipe/vitrine-team.tsx).
// Depuis le 24/10 au soir, chaque équipe a sa page (bola-team/[id]/page.tsx :
// sa couverture, son effectif, son maillot, sa saison) : toucher le nom de
// mon équipe, une autre équipe ou une ligne du championnat l'ouvre.
// En aperçu seulement (jamais en production) : ?apercu=1 montre le monde de
// démonstration même connecté, gardé sur l'appareil (la page des équipes, le
// profil des joueurs et Ma carte le montrent aussi) jusqu'à ?apercu=0 ;
// ?vitrine=1 la vitrine ; et le championnat de démonstration
// (lib/sfl/equipes-demo.ts) tant que la vraie saison n'a aucun match validé.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, MessageCircle, Pencil, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { CreerEquipe } from "@/components/sfl/equipe/creer-equipe";
import { SignerCharte, SignerReglement } from "@/components/sfl/equipe/reglement";
import { Defier } from "@/components/sfl/equipe/defier";
import { ChampionnatTeam } from "@/components/sfl/equipe/championnat";
import { FeuilleTeam } from "@/components/sfl/equipe/feuille-team";
import { FicheBlason } from "@/components/sfl/equipe/editeur-blason";
import { VitrineTeam } from "@/components/sfl/equipe/vitrine-team";
import { TerrainRetenu } from "@/components/sfl/matchs/choisir-terrain";
import { TerrainPlaces, type Occupant } from "@/components/sfl/matchs/terrain-places";
import { ChoisirJoueur } from "@/components/sfl/matchs/choisir-joueur";
import { useSession } from "@/hooks/use-session";
import { useAccesTeam } from "@/hooks/use-acces-team";
import { useApercuTeam } from "@/hooks/use-equipes";
import { signalerEquipe, useMonEquipe } from "@/hooks/use-mon-equipe";
import { championnat, coupDEnvoiTeam, etatMatch, saisonEnCours, type EtatMatch, type MatchTeam } from "@/lib/sfl/championnat-team";
import {
  MAX_EQUIPE,
  MIN_EQUIPE,
  RAISON_INDISPO,
  VERSION_REGLEMENT,
  aSignerLaCharte,
  active,
  annulerSeraitForfait,
  direErreurEquipe,
  dissoudreEquipe,
  enCours,
  etatEquipe,
  exclureMembre,
  indisponibles,
  initialesDe,
  invitationsPossibles,
  invites,
  inviterJoueurs,
  inviteur,
  lienEquipe,
  lireChampionnat,
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
  type EquipeTeam,
  type Indispo,
  type Membre,
} from "@/lib/sfl/equipes";
import { finInvitation, quandTombe, resteAvant } from "@/lib/sfl/equipes-temps";
import { avecLaLigue, lireTerrainsNord, terrainsNordLus, type CatalogueTerrains } from "@/lib/sfl/terrains-nord";
import { DEMO_EQUIPES, demanderApercu, demoChampionnat, demoEquipes } from "@/lib/sfl/equipes-demo";
import { libelleJour, listerProfils, monId, type Profil } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const LIEN_EN_ATTENTE = "sfl-equipe-lien";
const prenom = (nom: string) => nom.split(" ")[0];
/** « de Bilal », « d'Adil ». */
const de = (nom: string) => (/^[aeiouyàâäéèêëîïôöûü]/i.test(nom) ? `d'${nom}` : `de ${nom}`);

let seq = 0;

/** « 1er », « 2e », « 3e »… */
const rangFr = (n: number) => (n === 1 ? "1er" : `${n}e`);

type Championnat = { equipes: EquipeTeam[]; matchs: MatchTeam[] };
const SANS_CHAMPIONNAT: Championnat = { equipes: [], matchs: [] };

/** Un geste qui défait, à confirmer dans une fiche (au lieu d'une alerte du navigateur). */
interface AConfirmer {
  titre: string;
  texte?: string;
  /** Le bouton qui défait, et celui qui garde tout tel quel. */
  oui: string;
  non: string;
  action: () => void;
}

/** Une équipe : la toucher ouvre sa page (/bola-team/[id]) ; à droite, son geste (Défier). */
function LigneEquipe({ e, droite }: { e: Equipe; droite?: React.ReactNode }) {
  const n = signataires(e).length;
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-card px-3 py-2.5">
      <Link href={`/bola-team/${e.id}`} className="flex min-w-0 flex-1 items-center gap-3 transition-transform active:scale-[0.98]">
        <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={42} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[15.5px] font-semibold">{e.nom}</span>
          <span className="truncate text-[12.5px] text-muted-foreground">
            {[e.ville, `${n} / ${MAX_EQUIPE}`].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
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

/** Une feuille de match à remplir, à confirmer ou à corriger (capitaine et vice). */
function CarteFeuille({
  m,
  etat,
  mienne,
  adverse,
  onOuvrir,
}: {
  m: MatchTeam;
  etat: EtatMatch;
  mienne: number;
  adverse: Pick<Equipe, "nom" | "initiales" | "fond" | "blason">;
  onOuvrir: () => void;
}) {
  // Ma feuille envoyée attend l'autre capitaine : on peut encore la corriger, elle ne presse plus.
  const envoyee = etat.etat === "a-confirmer" && etat.par === mienne;
  const action = etat.etat === "a-saisir" ? "Feuille de match" : etat.etat === "litige" ? "À corriger" : envoyee ? "Envoyée" : "À confirmer";
  return (
    <button
      type="button"
      onClick={onOuvrir}
      className={cn(
        "flex w-full items-center gap-3 rounded-[22px] py-3 pr-4 pl-3 text-left transition-transform active:scale-[0.98]",
        envoyee ? "bg-card" : "bouton-principal bouton--vert"
      )}
    >
      <Ecusson initiales={adverse.initiales} fond={adverse.fond} blason={adverse.blason} taille={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold">{adverse.nom}</span>
        <span className={cn("mono-label", envoyee ? "text-muted-foreground" : "bouton-sous")}>
          {libelleJour(m.jour)} · {m.heure}
        </span>
      </span>
      <span className={cn("shrink-0 text-[14px] font-semibold", envoyee && "text-muted-foreground")}>{action}</span>
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
        <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={50} />
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
  const { allPlayers, saison } = useSeason();
  const acces = useAccesTeam();
  const [equipes, setEquipes] = useState<Equipe[] | null>(null);
  const [defis, setDefis] = useState<Defi[]>([]);
  const [champ, setChamp] = useState<Championnat | null>(null);
  const [vue, setVue] = useState<"equipe" | "championnat">("equipe");
  // Aperçu seulement : le monde de démonstration même connecté (demandé une
  // fois par appareil, ?apercu=1 ; ?apercu=0 revient à la base), la vitrine.
  const forceApercu = useApercuTeam();
  const [forceVitrine, setForceVitrine] = useState(false);
  const [profils, setProfils] = useState<Profil[]>([]);
  const [moiId, setMoiId] = useState<string | null>(null);
  const [indisponible, setIndisponible] = useState(false);
  const [tick, setTick] = useState(0);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  const [creer, setCreer] = useState(false);
  const [aSigner, setASigner] = useState<Equipe | null>(null);
  const [adversaire, setAdversaire] = useState<Equipe | null>(null);
  // La feuille du défi repart de zéro à chaque équipe défiée (sa clé), le terrain de la Map déjà écrit.
  const [defiN, setDefiN] = useState(0);
  const [terrainDefi, setTerrainDefi] = useState<string | null>(null);
  const [recensement, setRecensement] = useState<CatalogueTerrains | null>(terrainsNordLus);
  const [choisir, setChoisir] = useState(false);
  const [indispos, setIndispos] = useState<Map<string, Indispo> | null>(null);
  const [joueur, setJoueur] = useState<Membre | null>(null);
  const [confirmer, setConfirmer] = useState<AConfirmer | null>(null);
  const [feuille, setFeuille] = useState<number | null>(null);
  const [blasonOuvert, setBlasonOuvert] = useState(false);
  const [charte, setCharte] = useState(false);
  // Une invitation à ouvrir dès que les équipes sont là (notification, Map,
  // lien), et la liste des joueurs à ouvrir juste après la création.
  const aOuvrir = useRef<number | null>(null);
  const inviterApres = useRef(false);
  // La réponse donnée sur la notification (Oui, Non), la feuille qu'elle
  // ouvre, la Charte demandée par l'ouverture de l'app.
  const reponse = useRef<"oui" | "non" | null>(null);
  const feuilleVoulue = useRef<number | null>(null);
  const charteVoulue = useRef(false);
  // Ce que je n'ai pas lu dans la discussion de mon équipe.
  const nonLus = useMonEquipe().nonLus;

  // La notification ou la carte de la Map (?invitation=id), ou le lien d'une
  // équipe après l'inscription (?lien=jeton) : repris une fois connecté. Le
  // terrain de la Map (?terrain=id) est gardé de côté : l'adresse est déjà
  // nettoyée quand l'effet repasse.
  const terrainVenu = useRef<string | null>(null);
  const vueVenue = useRef<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get("invitation");
    const jeton = q.get("lien");
    const terrain = q.get("terrain") ?? terrainVenu.current;
    terrainVenu.current = terrain;
    const v = q.get("vue") ?? vueVenue.current;
    vueVenue.current = v;
    const r = q.get("reponse");
    const f = q.get("feuille");
    if (id && /^\d+$/.test(id)) aOuvrir.current = Number(id);
    if (r === "oui" || r === "non") reponse.current = r;
    if (f && /^\d+$/.test(f)) feuilleVoulue.current = Number(f);
    if (q.has("charte")) charteVoulue.current = true;
    if (jeton) {
      try {
        localStorage.setItem(LIEN_EN_ATTENTE, jeton);
      } catch {}
    }
    // Le monde de démonstration se garde sur l'appareil ; la vitrine reste
    // dans l'adresse ; le reste ne sert qu'une fois.
    if (DEMO_EQUIPES && q.has("apercu")) demanderApercu(q.get("apercu") !== "0");
    const garde = new URLSearchParams();
    if (DEMO_EQUIPES && q.has("vitrine")) garde.set("vitrine", "1");
    if ([...q.keys()].some((k) => !garde.has(k)))
      window.history.replaceState(null, "", window.location.pathname + (garde.toString() ? `?${garde}` : ""));
    const t = window.setTimeout(() => {
      if (terrain) setTerrainDefi(terrain);
      if (v === "championnat") setVue("championnat");
      if (garde.has("vitrine")) setForceVitrine(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  // Le terrain venu de la Map : le recensement lu une fois, les terrains de la ligue à leur nom.
  useEffect(() => {
    if (!terrainDefi || recensement) return;
    let fini = false;
    lireTerrainsNord()
      .then((c) => !fini && setRecensement(c))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [terrainDefi, recensement]);
  const terrainDuDefi = useMemo(
    () => (terrainDefi && recensement ? (avecLaLigue(recensement.terrains, saison.terrains ?? []).find((t) => t.id === terrainDefi) ?? null) : null),
    [terrainDefi, recensement, saison.terrains]
  );

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
        .on("postgres_changes", { event: "*", schema: "public", table: "equipe_resultats" }, recharger)
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
    Promise.all([listerEquipes(), listerDefis(), monId(), lireChampionnat().catch(() => null)])
      .then(([e, d, id, c]) => {
        if (fini) return;
        setEquipes(e);
        setDefis(d);
        setChamp(c);
        setMoiId(id);
        setIndisponible(false);
        // L'invitation qu'on vient ouvrir : sa signature, tout de suite ; ou
        // le Non donné sur la notification, qui la refuse.
        const voulue = aOuvrir.current;
        if (voulue != null && id) {
          aOuvrir.current = null;
          const non = reponse.current === "non";
          reponse.current = null;
          const x = e.find((q) => q.id === voulue);
          if (x && invites(x).some((m) => m.id === id)) {
            if (non)
              retirerInvitation(x.id, id).then(
                () => {
                  toast.success("Invitation refusée.");
                  recharger();
                  signalerEquipe();
                },
                (err) => toast.error(direErreurEquipe(err))
              );
            else setASigner(x);
          } else if (!x?.membres.some((m) => m.id === id && m.statut === "membre")) toast("Cette invitation n'est plus valable.");
        }
        // La notification d'une feuille : la feuille, si je peux la remplir ; sinon le championnat.
        const f = feuilleVoulue.current;
        if (f != null && id) {
          feuilleVoulue.current = null;
          const mien = e.find((x) => x.membres.some((m) => m.id === id && m.statut === "membre" && m.role !== "membre"));
          const match = c?.matchs.find((m) => m.id === f);
          if (mien && match && (match.de === mien.id || match.a === mien.id)) setFeuille(f);
          else setVue("championnat");
        }
        if (charteVoulue.current) {
          charteVoulue.current = false;
          setCharte(true);
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
  }, [connecte, tick, recharger]);

  // Aperçu (jamais en production) : la base n'a pas encore les équipes.
  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const apercu = DEMO_EQUIPES && (forceApercu || indisponible || !connecte) && noms.length >= 12;
  const monde = useMemo(
    () => (apercu ? demoEquipes(noms, me) : { equipes: equipes ?? [], defis }),
    [apercu, noms, me, equipes, defis]
  );
  // La vitrine en aperçu : personne n'est dans une équipe.
  const moi = forceVitrine ? null : apercu ? `demo-${me}` : moiId;
  const moiNom = apercu ? me : (profils.find((p) => p.id === moiId)?.name ?? me);

  const mienne = monde.equipes.find((e) => e.membres.some((m) => m.id === moi && m.statut === "membre")) ?? null;
  const monRole = mienne?.membres.find((m) => m.id === moi)?.role ?? null;
  const capitaine = monRole === "capitaine" || monRole === "vice";
  const invitations = monde.equipes.filter((e) => invites(e).some((m) => m.id === moi));
  // Une équipe en formation (moins de 5) reste invisible aux autres (doc 04 §6).
  const autres = monde.equipes.filter((e) => e.id !== mienne?.id && active(e));
  const charge = apercu || equipes !== null;
  const nomDe = (id: number) => monde.equipes.find((e) => e.id === id);
  const sansAcces = forceVitrine || acces === false;
  const moiMembre = mienne?.membres.find((m) => m.id === moi) ?? null;
  const charteASigner = !!moiMembre && aSignerLaCharte(moiMembre);

  // Le championnat. En aperçu, et sur une préversion tant que la vraie
  // saison n'a aucun match validé : la démonstration, à son heure (le soir du
  // 15 décembre). Mon équipe n'y est surlignée que dans le monde de démonstration.
  const vraiVide = !champ || !champ.matchs.some((m) => etatMatch(m).etat === "valide");
  const demoChamp = useMemo(
    () => (DEMO_EQUIPES && (apercu || vraiVide) && noms.length >= 12 ? demoChampionnat(noms, me) : null),
    [apercu, vraiVide, noms, me]
  );
  const vu = demoChamp ?? champ ?? SANS_CHAMPIONNAT;
  const heureChamp = demoChamp?.maintenant;
  const mienneChamp = demoChamp ? (apercu && mienne ? mienne.id : null) : (mienne?.id ?? null);
  const classement = useMemo(() => {
    const now = heureChamp ?? new Date();
    return championnat(saisonEnCours(now), vu.equipes, vu.matchs, now);
  }, [heureChamp, vu]);
  const maPlace = (() => {
    if (mienneChamp == null) return null;
    const d = classement.divisions.find((x) => x.n === classement.divisionDe.get(mienneChamp));
    const l = d?.lignes.find((x) => x.equipe === mienneChamp);
    return d && l && l.j > 0 ? `${d.nom} · ${rangFr(l.rang)} · ${l.pts} pt${l.pts > 1 ? "s" : ""}` : null;
  })();
  // Mes feuilles : celles de mes vrais matchs (ou de la démonstration, en aperçu).
  const miens = apercu && demoChamp ? demoChamp : (champ ?? SANS_CHAMPIONNAT);
  const heureFeuilles = apercu && demoChamp ? demoChamp.maintenant : undefined;
  const equipeDe = (id: number) => miens.equipes.find((e) => e.id === id) ?? monde.equipes.find((e) => e.id === id) ?? null;
  const aRemplir =
    mienne && capitaine
      ? miens.matchs
          .filter((m) => m.de === mienne.id || m.a === mienne.id)
          .map((m) => ({ m, etat: etatMatch(m, heureFeuilles) }))
          .filter(({ etat }) => etat.etat === "a-saisir" || etat.etat === "a-confirmer" || etat.etat === "litige")
          .sort((x, y) => coupDEnvoiTeam(y.m).getTime() - coupDEnvoiTeam(x.m).getTime())
      : [];
  const matchFeuille = feuille != null ? (miens.matchs.find((m) => m.id === feuille) ?? null) : null;
  const adverseFeuille = matchFeuille && mienne ? equipeDe(matchFeuille.de === mienne.id ? matchFeuille.a : matchFeuille.de) : null;

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
  const raisons = new Map<string, string>();
  if (mienne) {
    for (const e of monde.equipes) {
      if (e.id === mienne.id) continue;
      for (const m of signataires(e)) raisons.set(m.id, active(e) ? `Chez ${e.nom}` : RAISON_INDISPO.equipe);
    }
    for (const [id, raison] of indispos ?? []) if (raison !== "equipe" || !raisons.has(id)) raisons.set(id, RAISON_INDISPO[raison]);
  }

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

  // Les autres équipes et « Quitter » : sous l'équipe sur téléphone, dans la
  // petite colonne, à côté du terrain, sur grand écran (une copie chacun).
  const lesAutres = (className?: string) =>
    autres.length > 0 && (
      <section className={cn("flex flex-col gap-2", className)}>
        {terrainDuDefi && !!mienne && capitaine && active(mienne) && (
          <div className="mb-3 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="mono-label text-muted-foreground">Le terrain du défi</h2>
              <button
                type="button"
                onClick={() => setTerrainDefi(null)}
                aria-label="Défier ailleurs"
                className="bouton-discret grid size-8 place-items-center text-muted-foreground"
              >
                <X className="size-4" strokeWidth={2.2} />
              </button>
            </div>
            <TerrainRetenu t={terrainDuDefi} />
          </div>
        )}
        <h2 className="mono-label text-muted-foreground">Équipes</h2>
        {autres.map((e) => {
          const dejaDefie = monde.defis.some(
            (d) => enCours(d) && ((d.de === mienne?.id && d.a === e.id) || (d.a === mienne?.id && d.de === e.id))
          );
          const peutDefier = !!mienne && capitaine && active(mienne) && active(e) && !dejaDefie;
          return (
            <LigneEquipe
              key={e.id}
              e={e}
              droite={
                peutDefier ? (
                  <Pilule
                    ton="bouton--mauve"
                    onClick={() => {
                      setDefiN((n) => n + 1);
                      setAdversaire(e);
                    }}
                  >
                    Défier
                  </Pilule>
                ) : undefined
              }
            />
          );
        })}
      </section>
    );
  const partir = (className?: string) =>
    mienne && (
      <div className={cn("flex justify-center gap-2", className)}>
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
    );

  return (
    <div className="gabarit-ligue mx-auto flex w-full max-w-[470px] flex-col gap-7 px-5 pt-2 pb-8 sm:pt-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <h1 className="sr-only">Team</h1>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <EnteteLigue actif="/bola-team" className="md:flex-1" />
        <div className="glass flex gap-1 rounded-full p-1 md:w-[340px]" role="tablist" aria-label="Vue">
          {(
            [
              ["equipe", "Mon équipe"],
              ["championnat", "Championnat"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={vue === id}
              onClick={() => setVue(id)}
              className={cn(
                "flex-1 px-4 py-2 text-[13.5px] font-semibold whitespace-nowrap",
                vue === id ? "bouton-principal bouton--vert" : "bouton-discret text-muted-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {vue === "championnat" && (
        <ChampionnatTeam
          equipes={vu.equipes}
          matchs={vu.matchs}
          mienne={mienneChamp}
          maintenant={heureChamp}
          pages={!demoChamp || (forceApercu && apercu)}
        />
      )}

      {vue === "equipe" && invitations.length > 0 && (
        <section className="flex flex-col gap-2.5 lg:grid lg:grid-cols-2 lg:gap-[var(--fib-13)]">
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

      {vue !== "equipe" ? null : mienne ? (
        <section className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)] min-[1440px]:gap-[var(--fib-55)]">
          {/* La grande colonne : l'équipe, sa discussion, son terrain. */}
          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-[var(--fib-21)]">
          <div className="flex items-center gap-4">
            {capitaine ? (
              <button
                type="button"
                onClick={() => setBlasonOuvert(true)}
                aria-label="Écusson et couleurs"
                className="relative shrink-0 transition-transform active:scale-95"
              >
                <Ecusson initiales={mienne.initiales} fond={mienne.fond} blason={mienne.blason} taille={76} />
                <span
                  aria-hidden
                  className="absolute -right-1 -bottom-0.5 grid size-7 place-items-center rounded-full bg-foreground text-background ring-[3px] ring-background"
                >
                  <Pencil className="size-3.5" strokeWidth={2.4} />
                </span>
              </button>
            ) : (
              <Ecusson initiales={mienne.initiales} fond={mienne.fond} blason={mienne.blason} taille={76} />
            )}
            <div className="flex min-w-0 flex-col gap-1.5">
              <Link href={`/bola-team/${mienne.id}`} className="flex min-w-0 items-center gap-1 transition-opacity active:opacity-60">
                <h2 className="truncate text-[28px] leading-none font-bold tracking-tight md:text-[34px]">{mienne.nom}</h2>
                <ChevronRight className="size-5 shrink-0 text-foreground/35" strokeWidth={2.4} />
              </Link>
              <span className="mono-label text-muted-foreground">{etatEquipe(mienne)}</span>
              {!active(mienne) && (
                <span className="mono-label text-braise">Il manque {MIN_EQUIPE - signes.length}</span>
              )}
              {maPlace && (
                <button type="button" onClick={() => setVue("championnat")} className="mono-label self-start text-left text-foreground">
                  {maPlace}
                </button>
              )}
            </div>
          </div>
          {charteASigner && (
            <button
              type="button"
              onClick={() => setCharte(true)}
              className="bouton-principal bouton--vert flex w-full items-center gap-3 rounded-[22px] px-4 py-3.5 text-left transition-transform active:scale-[0.98]"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">Charte de déontologie</span>
                <span className="mono-label bouton-sous">Règlement Team · version {VERSION_REGLEMENT.slice(1)}</span>
              </span>
              <span className="shrink-0 text-[14px] font-semibold">Signer</span>
            </button>
          )}
          {aRemplir.map(({ m, etat }) => {
            const autre = equipeDe(m.de === mienne.id ? m.a : m.de);
            return autre ? (
              <CarteFeuille key={m.id} m={m} etat={etat} mienne={mienne.id} adverse={autre} onOuvrir={() => setFeuille(m.id)} />
            ) : null;
          })}
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
          <div className="terrain-grand">
            <TerrainPlaces
              places={MAX_EQUIPE}
              unCamp
              moi={moiNom}
              occupants={occupants}
              onPlus={peutInviter ? ouvrirChoix : undefined}
              onOccupant={(o) => {
                const m = mienne.membres.find((x) => x.id === o.cle);
                if (m && m.id !== moi) setJoueur(m);
              }}
            />
          </div>
          {deborde.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {deborde.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setJoueur(m)}
                  className="flex items-center gap-2.5 rounded-[18px] bg-card py-1.5 pr-3.5 pl-1.5 text-[13.5px] font-semibold transition-transform active:scale-95"
                >
                  <span className="flex rounded-[14px] border-[1.5px] border-dashed border-contraste/60 p-px opacity-60">
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
          </div>

          {/* La petite colonne : les défis, puis les autres équipes. */}
          <div className="contents md:flex md:min-w-0 md:flex-col md:gap-[var(--fib-21)]">
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
                    <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={36} />
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
          {lesAutres("hidden md:flex")}
          {partir("hidden md:mt-[var(--fib-13)] md:flex")}
          </div>
        </section>
      ) : sansAcces && invitations.length === 0 ? (
        <VitrineTeam initiales={initialesDe(moiNom)} />
      ) : charge ? (
        <Button
          variant={invitations.length > 0 ? "secondary" : "vert"}
          onClick={() => setCreer(true)}
          className={cn("h-12 rounded-full text-[15px] font-semibold md:w-[320px] md:self-center", invitations.length > 0 && "bouton--vert")}
        >
          Créer mon équipe
        </Button>
      ) : null}

      {vue === "equipe" && lesAutres(mienne ? "md:hidden" : "md:grid md:grid-cols-2 md:gap-[var(--fib-13)] xl:grid-cols-3 md:[&>h2]:col-span-full")}

      {vue === "equipe" && partir("md:hidden")}

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
      <SignerCharte
        equipe={mienne}
        open={charte}
        onOpenChange={setCharte}
        apercu={apercu}
        onSigne={() => {
          recharger();
          signalerEquipe();
        }}
      />
      <FicheBlason
        equipe={capitaine ? mienne : null}
        open={blasonOuvert}
        onOpenChange={setBlasonOuvert}
        apercu={apercu}
        onEnregistre={() => {
          recharger();
          signalerEquipe();
        }}
      />
      <FeuilleTeam
        match={matchFeuille}
        mienne={mienne}
        adverse={adverseFeuille}
        onOpenChange={(o) => !o && setFeuille(null)}
        apercu={apercu}
        maintenant={heureFeuilles}
        onSaisie={() => {
          recharger();
          signalerEquipe();
        }}
      />
      <Defier
        key={defiN}
        mienne={mienne}
        adversaire={adversaire}
        terrain={terrainDuDefi}
        onOpenChange={(o) => !o && setAdversaire(null)}
        apercu={apercu}
        onDefie={recharger}
      />
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
