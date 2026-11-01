"use client";

// La Map — la première section de l'app, à l'image de la carte de « Jouer »
// de l'app iOS BOLA : un plan clair, les matchs de la Sunday Five League posés
// en stickers mini-stades sur leur terrain, la commune en lettrage découpé, le
// compte des matchs en étiquette, et en bas les cartes des matchs dans leur
// bord blanc, avec le lieu et le chemin pour y aller. « Toi » apparaît quand
// tu donnes ta position.
//
// Les matchs, ce sont les journées pas encore jouées : chaque journée que
// l'admin ajoute apparaît ici, sur son terrain (le sien, sinon le terrain par
// défaut). Tant qu'aucune journée n'est ouverte, la Map montre la convocation
// du dimanche. On répond à la convocation comme avant, depuis le tableau de
// présence sous la carte. Les terrains vivent dans la saison
// (`saison.terrains`) ; l'admin donne l'adresse de chaque match juste sous la
// carte.
//
// La discussion d'un match (22/10) : sur le plan, une bulle de messages au
// coin de son sticker, rouge avec ce que je n'ai pas lu (Sabri : « comme une
// notification dans la bulle du match ») ; la carte du match porte le même
// nombre. La bulle, « Discussion du match » dans sa fiche, ou la
// notification (/?match=12&discussion) ouvre la discussion plein écran
// (matchs/discussion-match.tsx), avec un onglet Équipe à côté : la
// discussion de mon équipe du mode Team. Sa notification, et son bouton sur
// la page Team (/?discussion=equipe), l'ouvrent sur cet onglet, mon
// prochain match sous l'onglet Match.
//
// Les joueurs (22/10, « en poursuivant l'idée de remplacer Snapchat ») :
// chacun dans sa ville, en piles qui s'ouvrent quand on s'approche
// (map/joueurs.ts), et le catalogue des joueurs par ville dans une fiche
// (map/catalogue-joueurs.tsx), ouverte par le bouton aux visages en haut à
// droite ou en touchant le nom d'une ville. Toucher une carte ouvre le profil.
//
// Les terrains où l'on peut jouer (23/10, Sabri : « en mode grisé, comme
// s'il fallait ouvrir le match […] pour que chacun puisse ouvrir un match
// Bola ou Bola Team ») : ceux du recensement, en France, en Europe et au
// Maghreb (lib/sfl/terrains.ts, lus case par case d'après ce que la Map
// montre), en stickers vides sous les matchs ; un terrain qui a son match n'a plus le
// sien. En toucher un ouvre sa fiche : sa photo, ce qu'il y a sur place, et
// « Ouvrir un match ici » (la feuille d'ouverture, le terrain déjà choisi)
// ou, pour le capitaine d'une équipe active, « Défier une équipe ici » (la
// page Team, le défi posé sur ce terrain). Un défi accepté s'y pose ensuite,
// à son nom. Le menu de la Map ne garde que ceux d'un format (à 3, 5, 7, 8
// ou 11 ; Sabri, 24/10 : « on fait actuellement du foot à 5 […] qu'on
// puisse filtrer facilement ») : map/format-terrains.tsx, le même choix que
// dans la feuille « Terrains ».
//
// Les contrats en direct (23/10) : le bouton au viseur ne laisse sur la Map
// que les cibles des contrats signés du dimanche, sous leur viseur, leur prime
// à la place de la note (map/contrats-map.ts) ; les matchs et les terrains
// s'effacent le temps du filtre. Toucher une cible ouvre les affiches des
// contrats sur elle (map/contrats-sur.tsx).

import dynamic from "next/dynamic";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  CalendarDays,
  ChartSpline,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardPen,
  Crosshair,
  IdCard,
  MessageCircle,
  Layers,
  LocateFixed,
  MapPin,
  Navigation,
  Plus,
  Search,
  Settings2,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { logActivity } from "@/lib/sfl/activity";
import { dureeLisible, trajetVers, type Trajet } from "@/lib/sfl/trajet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, type Fenetre } from "@/components/ui/sheet";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { FeuilleProfil } from "@/components/sfl/card-viewer";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { QuiVient } from "@/components/sfl/qui-vient";
import { FichePartie } from "@/components/sfl/matchs/fiche-partie";
import { MeteoMatch } from "@/components/sfl/meteo-match";
import { DiscussionMatch, type OngletDiscussion } from "@/components/sfl/matchs/discussion-match";
import { FeuilleDeMatch } from "@/components/sfl/matchs/feuille-de-match";
import { DirectDuMatch } from "@/components/sfl/direct/direct-du-match";
import { useFeuillesDirect } from "@/hooks/use-feuilles-direct";
import { DuelsDuJour } from "@/components/sfl/matchs/duels";
import { feuilleDeConvocation, feuilleDeJournee, type TerrainFeuille } from "@/lib/sfl/feuille";
import { MesDispos } from "@/components/sfl/matchs/mes-dispos";
import { OuvrirMatch } from "@/components/sfl/matchs/ouvrir-match";
import { Invitations, invitationsDe } from "@/components/sfl/matchs/invitations";
import { InvitationsEquipe } from "@/components/sfl/equipe/invitation-map";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { useParties } from "@/hooks/use-parties";
import { useDiscussionsMatch } from "@/hooks/use-discussions-match";
import { DISPOS_AFFICHEES, inscrits, libelleJour, listerDispos, momentDeLHeure, placesLibres, prochainsJours, type Dispo, type Partie } from "@/lib/sfl/matchs";
import { cleMoment, meilleurMoment, terrainPropose, type MomentPropose } from "@/lib/sfl/proposition";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";
import { usePresence } from "@/hooks/use-presence";
import { joueursDeLaFeuille } from "@/lib/sfl/presence-feuille";
import { annonceEnCours, J_DECOUPAGE, nomDivision, REGLES_DIVISIONS } from "@/lib/sfl/divisions";
import { useDivision } from "@/hooks/use-division";
import { useSession } from "@/hooks/use-session";
import { saisieStore } from "@/lib/sfl/saisie/store";
import { dernierEnvoiAuto, SYNC_EVENT } from "@/lib/sfl/saisie/sync";
import {
  ajouterTerrain,
  definirTerrainParDefaut,
  deplacerTerrain,
  journeeJouee,
  journeeTerminee,
  placerJourneeSurNouveauTerrain,
  placerMatchDuJourSurNouveauLieu,
  reglerMatchDuJour,
  retirerTerrain,
  terrainDeJournee,
  terrainDuMatch,
  updateJournee,
} from "@/lib/sfl/saisie/mutations";
import type { JourneeMeta, Saison, Terrain } from "@/lib/sfl/saisie/types";
import { ovr, rankPlayers } from "@/lib/sfl/engine";
import {
  dernierCoupDEnvoi,
  matchDuJoueur,
  matchsDeJournee,
  matchsParLieu,
  nomDuTerrain,
  premierCoupDEnvoi,
  type MatchResolu,
  type Repli,
} from "@/lib/sfl/matchs-du-jour";
import { ProfilJoueur } from "@/components/sfl/profil-joueur";
import { CatalogueJoueurs } from "@/components/sfl/map/catalogue-joueurs";
import { CollectionPile } from "@/components/sfl/map/collection-pile";
import { ciblesDuDimanche, contratsSignes, foyerDesCibles, villesDesCibles } from "@/components/sfl/map/contrats-map";
import { ContratsSur } from "@/components/sfl/map/contrats-sur";
import { cleVille, type ContratPlan, type VillePlan } from "@/components/sfl/map/joueurs";
import { useMissionsDeLaLigue } from "@/hooks/use-missions";
import { TOUTES_AMBIANCES, type Ambiance } from "@/components/sfl/map/ambiances";
import { calculerZones, dansContour, numeroZone, type Foyer, type VilleZone, type Zone } from "@/lib/sfl/zones";
import { maVille, villeOuLigue } from "@/lib/sfl/villes";
import { garderPosition, positionGardee } from "@/lib/sfl/activation";
import { photoMiniature, photoPerso } from "@/lib/sfl/photos";
import { nomAffiche } from "@/lib/sfl/identites";
import {
  aFormat,
  avecLaLigue,
  communeDeLAdresse,
  FORMATS,
  km,
  lieuDuTerrain,
  lireAutour,
  lireTerrain,
  lireVue,
  sansAccents,
  sourcesCitees,
  surPlace,
  useTerrainsRecenses,
  type TerrainPropose,
} from "@/lib/sfl/terrains";
import { active } from "@/lib/sfl/equipes";
import type { LieuChoisi } from "@/components/sfl/matchs/choisir-terrain";
import { useVillesRevision } from "@/hooks/use-villes";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { useIdentitesRevision } from "@/hooks/use-identites";
import { cn } from "@/lib/utils";
import {
  COULEUR_LIGUE,
  COULEUR_REMPLISSAGE,
  heureCourte,
  itineraires,
  remplissageDe,
  stadeSvg,
  type EtatSticker,
  type LigueMatch,
  type Moment,
  type Remplissage,
  type StickerPlan,
} from "@/components/sfl/map/stade";
import { VueTerrain } from "@/components/sfl/map/vue-terrain";
import { FriseDimanche, Rebours, SerieDimanches, type Etape } from "@/components/sfl/map/tableau-lieu";
import { IconeTerrain, PucesFormat } from "@/components/sfl/map/format-terrains";
import { MenuMap } from "@/components/sfl/map/menu-map";
import { useFormatTerrain } from "@/hooks/use-format-terrain";
import { montrerCalque, useCalquesMap } from "@/hooks/use-calques-map";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { Visages } from "@/components/sfl/suivre";
import { afficheDe, parNote, useAffiches, type Affiche } from "@/lib/sfl/affiche";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { useMatchsTeam, type MatchTeam } from "@/hooks/use-matchs-team";
import type { FondCarte, PointPlan, PossiblePlan, ToiPlan } from "@/components/sfl/map/carte-map";
import type { TeinteFantome } from "@/components/sfl/map/stade";
import "./animations.css";
import "@/components/sfl/map/contrats-map.css";

/** Les terrains enregistrés ne s'affichent plus sur le plan : seuls les matchs. */
const AUCUN_POINT: PointPlan[] = [];
/** Le filtre Contrats (ou le menu) ôte les terrains possibles du plan. */
const SANS_POSSIBLES: PossiblePlan[] = [];
/** Les joueurs masqués depuis le menu de la Map. */
const AUCUNE_VILLE: VillePlan[] = [];
const AUCUNE_ZONE: Zone[] = [];
/** Un terrain qui a son match n'a plus son sticker vide : à moins de 200 m, c'est le même. */
const MEME_TERRAIN_KM = 0.2;
/** « 23/10/2026 » */
/** Le gris ou le ciel des terrains possibles (dans un aperçu, /map?fantome=ciel montre l'autre). */
const teinteFantome = (): TeinteFantome =>
  process.env.NEXT_PUBLIC_BOLA_ENV !== "production" && new URLSearchParams(window.location.search).get("fantome") === "ciel" ? "ciel" : "gris";

/**
 * L'ambiance du plan : « Tableau » (nuit-encre), choisie par Sabri le 31/10
 * (« Publie cela »). Dans un aperçu, les autres restent essayables par
 * /?ambiance=rouge|braise|nuit-brume|nuit-braise|territoire|nuit|encre|classique.
 */
const ESSAIS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";
const ambianceDeLAdresse = (): Ambiance => {
  if (!ESSAIS) return "nuit-encre";
  const a = new URLSearchParams(window.location.search).get("ambiance");
  return TOUTES_AMBIANCES.includes(a as Ambiance) ? (a as Ambiance) : "nuit-encre";
};
/** Dans un aperçu, /?zones=demo ajoute une zone qui vient de s'ouvrir (Lens) et une zone fermée (Paris), pour voir le récit. */
const zonesDemo = () => ESSAIS && new URLSearchParams(window.location.search).get("zones") === "demo";
const useZonesDemo = () => useSyncExternalStore(rienAEcouter, zonesDemo, () => false);

const CarteMap = dynamic(() => import("@/components/sfl/map/carte-map").then((m) => m.CarteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e9eae6]" aria-hidden />,
});

const AjusterPoint = dynamic(() => import("@/components/sfl/map/ajuster-point").then((m) => m.AjusterPoint), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-secondary" aria-hidden />,
});

interface Lieu {
  lat: number;
  lng: number;
  libelle: string;
  commune?: string;
  /** Le nom d'un lieu (« Urban Soccer »), qui propose le nom du terrain. */
  nom?: string;
  genre?: "adresse" | "lieu";
}

const ENCRE = "#0A0B0D";
const CLAIR = "#EFEFEC";
const BLANC = "#F4F5F2";
const BRAISE = "#FF8A4C";
/** Le vert de ceux qui sont libres, sur le jeton sombre de la carte proposée (le ton « y aller »). */
const VERT_LIBRES = "#84D68C";
/** Les teintes des avatars de la grappe (des gris, comme dans l'app). */
const TEINTES = ["#CFCFCF", "#A4A4A4", "#F0F0F0", "#C4C4C4", "#E2E2DE", "#B8B8B4"];
/** Là où joue la ligue : les adresses proches passent devant. */
const PRES_DE = { lat: 50.6366, lng: 3.0632 };
/** Une équipe de cinq contre cinq : le compte des places quand rien n'est composé. */
const EFFECTIF = 10;

function teinte(nom: string): string {
  let h = 0;
  for (const c of nom) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return TEINTES[h % TEINTES.length];
}

/* -------------------------------- Le temps -------------------------------- */

/** Aujourd'hui à Paris, « 2026-10-10 » (une chaîne : stable pour React). */
function aujourdhuiParis(): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const v = (t: string) => parts.find((x) => x.type === t)?.value ?? "";
  return `${v("year")}-${v("month")}-${v("day")}`;
}

// Deux lectures du navigateur, vides côté serveur pour que l'hydratation parte
// du même point, puis vraies au premier rendu client.
const rienAEcouter = () => () => {};
const useAujourdhui = () => useSyncExternalStore(rienAEcouter, aujourdhuiParis, () => "");
/** L'heure qu'il est à Paris (0–23), -1 côté serveur. */
const heureParis = () => Number(new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "numeric", hour12: false }).format(new Date())) % 24;
const useHeure = () => useSyncExternalStore(rienAEcouter, heureParis, () => -1);
const useEstIos = () =>
  useSyncExternalStore(rienAEcouter, () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent), () => false);
const useTeinteFantome = () => useSyncExternalStore(rienAEcouter, teinteFantome, (): TeinteFantome => "gris");

const MOIS = ["jan", "fev", "mar", "avr", "mai", "juin", "juil", "aou", "sep", "oct", "nov", "dec"];
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

/** « 11 oct. », « 26 juillet » → une date de l'année en cours (ou de la suivante, en début d'année). */
function lireDate(label: string, aujourdhui: string): Date | null {
  const m = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .match(/(\d{1,2})\s*([a-z]+)/);
  if (!m || !aujourdhui) return null;
  const mot = m[2];
  const mois = MOIS.findIndex((p) => mot.startsWith(p.length === 4 ? p : p.slice(0, 3)));
  if (mois < 0) return null;
  const [an, moisAuj] = aujourdhui.split("-").map(Number);
  // Une date de janvier lue en décembre est celle de l'an prochain.
  const annee = moisAuj === 12 && mois === 0 ? an + 1 : an;
  return new Date(Date.UTC(annee, mois, Number(m[1])));
}

interface Quand {
  titre: string;
  jourCourt: string;
  moment: Moment;
}

/** Aujourd'hui, demain, ou le nom du jour ; le fond de la vignette suit. */
function quand(dateLabel: string, jourTexte: string | null, aujourdhui: string): Quand {
  const d = lireDate(dateLabel, aujourdhui);
  if (d && aujourdhui) {
    const [a, mo, j] = aujourdhui.split("-").map(Number);
    const ecart = Math.round((d.getTime() - Date.UTC(a, mo - 1, j)) / 86400000);
    const nom = JOURS[d.getUTCDay()];
    const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6;
    if (ecart === 0) return { titre: "Aujourd'hui", jourCourt: "AUJ.", moment: "jour" };
    if (ecart === 1) return { titre: "Demain", jourCourt: "DEMAIN", moment: weekend ? "weekend" : "semaine" };
    if (ecart > 1 && ecart < 7)
      return { titre: nom[0].toUpperCase() + nom.slice(1), jourCourt: `${nom.slice(0, 3).toUpperCase()}.`, moment: weekend ? "weekend" : "semaine" };
    const court = `${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}.`;
    return { titre: court, jourCourt: court.toUpperCase().slice(0, 7), moment: weekend ? "weekend" : "semaine" };
  }
  const t = jourTexte ?? dateLabel;
  return { titre: t, jourCourt: `${t.slice(0, 3).toUpperCase()}.`, moment: /dim|sam/i.test(t) ? "weekend" : "semaine" };
}

/** « 1,2 km », « 650 m » : la distance à vol d'oiseau. */
function distanceLisible(a: { lat: number; lng: number }, b: { lat: number; lng: number }): string {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  const m = 2 * R * Math.asin(Math.sqrt(h));
  return m < 950 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
}

/** L'itinéraire dans l'app de plans du téléphone : Plans sur iPhone, Google Maps ailleurs. */
function urlItineraire(t: Terrain, ios: boolean): string {
  return ios
    ? `https://maps.apple.com/?daddr=${t.lat},${t.lng}&q=${encodeURIComponent(t.nom)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${t.lat},${t.lng}`;
}

/* -------------------------------- Les matchs -------------------------------- */

interface MatchMap {
  cle: string;
  /** La journée ; null pour la convocation seule. */
  j: number | null;
  quand: Quand;
  dateLabel: string;
  heure: string;
  terrain: Terrain | null;
  presents: string[];
  effectif: number;
  dedans: boolean;
  etat: EtatSticker;
  etatTexte: string;
  /** Le match est passé : on montre qui a joué, et le chemin vers le récap. */
  joue?: boolean;
  /** Une journée datée du dimanche de la convocation : on y répond comme à la convocation. */
  convoquee?: boolean;
  /** Un match ouvert par un joueur (pas une journée de ligue). */
  partie?: Partie;
  /** Ce qu'il lui reste à remplir : rouge, orange, vert (jamais pour la ligue, sans plafond). */
  remplissage?: Remplissage;
  /** Un match d'équipe : un défi accepté du mode Team. */
  team?: MatchTeam;
  /** Sa ligue, qui donne sa couleur au stade : la journée est SFL, le match
   *  ouvert par un joueur est Bola, le défi entre deux équipes est Team. */
  ligue: LigueMatch;
  /** Une journée jouée en plusieurs lieux : ses matchs dans celui-ci (0 = Match 1). */
  matchsIci?: number[];
}

/** « 13h00 », « 13:30 » → 13 ; 13 à défaut. */
function heureDe(heure: string): number {
  const m = heure.match(/(\d{1,2})\s*[h:]/i);
  return m ? Number(m[1]) : 13;
}

/** Le jour d'un match, AAAA-MM-JJ : celui de la base pour un match ouvert ou un défi, sinon lu dans son libellé. */
function dateIsoDuMatch(m: Pick<MatchMap, "partie" | "team" | "dateLabel">, aujourdhui: string): string | null {
  const brut = m.partie?.jour ?? m.team?.defi.jour;
  const iso = brut?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (iso) return iso;
  const d = lireDate(m.dateLabel, aujourdhui);
  return d ? d.toISOString().slice(0, 10) : null;
}

/** Les jours entre aujourd'hui et une date (négatif : passée) ; null si illisible. */
function ecartJours(dateLabel: string, aujourdhui: string): number | null {
  const d = lireDate(dateLabel, aujourdhui);
  if (!d || !aujourdhui) return null;
  const [a, mo, j] = aujourdhui.split("-").map(Number);
  return Math.round((d.getTime() - Date.UTC(a, mo - 1, j)) / 86400000);
}

const MOIS_LONGS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 11 oct. » → « 11 octobre ». */
function dateLongue(dateLabel: string, aujourdhui: string): string {
  const d = lireDate(dateLabel, aujourdhui);
  return d ? `${d.getUTCDate()} ${MOIS_LONGS[d.getUTCMonth()]}` : dateLabel;
}

/** « 19 oct. » → « Dimanche 19 octobre », pour la feuille de match partagée. */
function dateComplete(dateLabel: string, aujourdhui: string): string {
  const d = lireDate(dateLabel, aujourdhui);
  if (!d) return dateLabel;
  const nom = JOURS[d.getUTCDay()];
  return `${nom[0].toUpperCase()}${nom.slice(1)} ${dateLongue(dateLabel, aujourdhui)}`;
}

/** Une journée de ligue : ouverte à tous, sans plafond — on montre qui vient déjà. */
function etatLigue(dedans: boolean, n: number): { etat: EtatSticker; texte: string } {
  if (dedans) return { etat: { genre: "dedans" }, texte: "Tu y es" };
  return { etat: { genre: "inscrits", n }, texte: n ? `${n} participant${n > 1 ? "s" : ""} déjà` : "Ouvert à tous" };
}

/** Un match ouvert par un joueur : un nombre de places, donc ce qu'il manque. */
function etatDe(dedans: boolean, manque: number): { etat: EtatSticker; texte: string } {
  if (dedans) return { etat: { genre: "dedans" }, texte: "Tu y es" };
  if (manque > 0) return { etat: { genre: "manque", n: manque }, texte: `Il manque ${manque}` };
  return { etat: { genre: "complet" }, texte: "Complet" };
}

export default function MapPage() {
  // La Map écrit la saison (terrains, horaires) : elle part du document stocké.
  const { saisonLue: saison, journees, players } = useSeason();
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();
  const { player, me } = useMyPlayer();
  // Joueur Bola (true), joueur SFL (false), ou pas encore su (null : la
  // toute première ouverture d'un compte) : dans le doute, rien de la SFL
  // (28/10/2026).
  const horsSflEtat = useHorsSflEtat();
  const sansSfl = horsSflEtat !== false;
  const aujourdhui = useAujourdhui();
  const heure = useHeure();
  // La J3, dernier dimanche avant les divisions (lib/sfl/divisions.ts) : sa fiche le dit ;
  // dès la J4, la fiche d'un dimanche à venir dit ta division.
  const sansDivisions = !!aujourdhui && annonceEnCours(saison, new Date(`${aujourdhui}T12:00:00Z`));
  const maDivision = useDivision(me);
  const surtitreDeLigue = (j: number | null | undefined) =>
    j === J_DECOUPAGE && sansDivisions
      ? "Dernier dimanche sans divisions"
      : j != null && j >= REGLES_DIVISIONS.depuis && maDivision && !journeeTerminee(saison, j)
        ? `Tu joues en ${nomDivision(maDivision)}`
        : null; // le sigle SFL dit déjà la ligue : plus de « Sunday Five League »

  const terrains = useMemo(() => saison.terrains ?? [], [saison.terrains]);
  // L'heure et le lieu d'une journée, et ses matchs chacun aux siens.
  const matchsDe = useCallback(
    (m: JourneeMeta) => {
      const repli: Repli = { heure: m.heure || p.heure, lieu: terrainDeJournee(saison, m, p.lieu) };
      return { repli, matchs: matchsDeJournee(journees.find((x) => x.j === m.j), terrains, repli) };
    },
    [saison, journees, terrains, p.heure, p.lieu]
  );
  // Les terrains recensés (France, Europe, Maghreb) : lus case par case,
  // autour des terrains de la ligue d'abord, puis de ce que la Map montre
  // (onVue), et gardés en mémoire (lib/sfl/terrains.ts).
  const { index: indexTerrains, terrains: recenses } = useTerrainsRecenses();
  useEffect(() => {
    const t = terrains.find((x) => x.defaut) ?? terrains[0];
    lireAutour(t && Number.isFinite(t.lat) ? t : { lat: 50.6329, lng: 3.0586 }).catch(() => {});
  }, [terrains]);
  // La vue du plan à chaque arrêt : le titre de la Map la suit (31/10).
  const [vue, setVue] = useState<{ lat: number; lng: number; zoom: number } | null>(null);
  const voirTerrains = useCallback((o: number, s: number, e: number, n: number, zoom: number) => {
    setVue((v) => {
      const lat = (s + n) / 2;
      const lng = (o + e) / 2;
      // Un palier du titre qui ne change pas ne redessine rien.
      const palier = (z: number) => (z < 7.5 ? 0 : z < 11 ? 1 : 2);
      if (v && palier(v.zoom) === palier(zoom) && Math.abs(v.lat - lat) < 0.05 && Math.abs(v.lng - lng) < 0.05) return v;
      return { lat, lng, zoom };
    });
    // De trop loin (un pays entier), on ne lit rien de plus : les points ne se verraient pas.
    if (zoom >= 7) lireVue(o, s, e, n).catch(() => {});
  }, []);
  // Tous les terrains où l'on peut jouer : ceux de la ligue à leur nom, puis le recensement.
  const proposables = useMemo(() => avecLaLigue(recenses, terrains), [recenses, terrains]);
  // Un défi d'équipe se pose sur le terrain recensé qui porte son nom (celui que la fiche du terrain lui donne).
  const recensesParNom = useMemo(() => {
    const m = new Map<string, Terrain>();
    recenses.forEach((t) => {
      const nom = lieuDuTerrain(t);
      // Un id négatif, le même tant que le terrain ne change pas (les cases arrivent dans n'importe quel ordre).
      let h = 0;
      for (let k = 0; k < t.id.length; k++) h = (h * 31 + t.id.charCodeAt(k)) | 0;
      m.set(sansAccents(nom), { id: -(1_000_000 + (Math.abs(h) % 1_000_000_000)), nom, adresse: t.adresse, lat: t.lat, lng: t.lng, commune: t.commune });
    });
    return m;
  }, [recenses]);

  // Les journées à venir, chacune sur son terrain ; sinon la convocation du
  // dimanche. Une journée est passée quand elle est jouée (résultat saisi) ou
  // quand sa date est derrière nous — le jour même, deux heures après le coup
  // d'envoi de son dernier match. La dernière passée (de moins d'une
  // semaine) reste sur la Map, « jouée », avec ses joueurs et le chemin vers
  // le récap.
  //
  // Ses matchs peuvent avoir chacun leur heure et leur lieu (Sabri, 23/10 ;
  // lib/sfl/matchs-du-jour) : une journée jouée en deux lieux pose un
  // sticker sur chacun, avec ses matchs et leurs joueurs. L'heure affichée
  // est celle de mon match, sinon le premier coup d'envoi du lieu.
  //
  // Un joueur Bola (venu par un parrain, hors de la saison) ne voit rien de
  // la SFL (Sabri, 26/10 : « le côté SFL doit lui être invisible »).
  // La ligue sur la Map, et tous ses dimanches joués (la page d'un lieu les
  // remonte : « les matchs précédents », Sabri 31/10).
  const { liste: ligue, jouees: ligueJouees } = useMemo<{ liste: MatchMap[]; jouees: MatchMap[] }>(() => {
    if (sansSfl) return { liste: [], jouees: [] };
    const passee = (m: JourneeMeta) => {
      if (journeeJouee(saison, m.j)) return true;
      const e = ecartJours(m.date, aujourdhui);
      if (e == null) return false;
      if (e < 0) return true;
      const { repli, matchs: tous } = matchsDe(m);
      return e === 0 && heure >= 0 && heure >= heureDe(dernierCoupDEnvoi(tous, repli.heure)) + 2;
    };
    const ecartConvocation = ecartJours(p.jour.replace(/^\S+\s+/, ""), aujourdhui);
    const versMatchs = (m: JourneeMeta, joue: boolean): MatchMap[] => {
      const lignes = saison.entries.filter((e) => e.j === m.j);
      // Les équipes faites, un joueur resté sans équipe ne compte pas.
      const presents = joueursDeLaFeuille(saison, m.j).noms;
      const effectif = Math.max(EFFECTIF, lignes.length);
      const e = ecartJours(m.date, aujourdhui);
      const convoquee = !joue && e != null && e === ecartConvocation;
      const { repli, matchs: tous } = matchsDe(m);
      const lieux = matchsParLieu(tous);
      // Un seul lieu (ou la journée jouée, qui reste une seule carte) : un
      // seul match sur la Map, comme avant.
      const separe = lieux.length > 1 && !joue;
      const groupes = separe ? lieux : [{ lieu: lieux.length === 1 ? lieux[0].lieu : repli.lieu, matchs: tous }];
      return groupes.map((g, i): MatchMap => {
        const noms = new Set(g.matchs.flatMap((t) => [...t.noirs, ...t.blancs]));
        const ici = separe ? presents.filter((n) => noms.has(n)) : presents;
        const dedans = ici.includes(player.name);
        // La convocation du dimanche : on y répond pour toute la journée.
        const commeConvocation = convoquee && !separe;
        const { etat, texte } = joue
          ? { etat: { genre: "joue" } as EtatSticker, texte: dedans ? "Joué · tu y étais" : "Joué" }
          : commeConvocation
            ? etatLigue(p.mine === "present", p.presents.length)
            : etatLigue(dedans, ici.length);
        return {
          cle: i === 0 ? `j${m.j}` : `j${m.j}-${g.lieu?.id ?? i}`,
          j: m.j,
          quand: joue ? { titre: m.date, jourCourt: m.date.toUpperCase().slice(0, 7), moment: "weekend" } : quand(m.date, null, aujourdhui),
          dateLabel: m.date,
          heure: matchDuJoueur(g.matchs, player.name)?.heure ?? premierCoupDEnvoi(g.matchs, repli.heure),
          terrain: g.lieu,
          presents: commeConvocation ? p.presents : ici,
          effectif: commeConvocation ? p.effectif : effectif,
          dedans: commeConvocation ? p.mine === "present" : dedans,
          etat,
          etatTexte: texte,
          joue,
          convoquee,
          ligue: "sfl",
          ...(separe ? { matchsIci: g.matchs.map((t) => t.n) } : {}),
        };
      });
    };

    const parDate = [...saison.journees].sort((a, b) => a.j - b.j);
    const aVenir = parDate.filter((m) => !passee(m)).flatMap((m) => versMatchs(m, false));
    const derniere = parDate.filter(passee).at(-1);
    const eDerniere = derniere ? ecartJours(derniere.date, aujourdhui) : null;
    const recente = derniere && (eDerniere == null || eDerniere >= -6) ? versMatchs(derniere, true) : [];
    const jouees = parDate.filter(passee).flatMap((m) => versMatchs(m, true));

    if (aVenir.length) return { liste: [...aVenir, ...recente], jouees };
    // Pas de journée à venir : la convocation du dimanche, si elle n'est pas
    // elle-même passée (l'admin ouvre la suivante en ouvrant l'app).
    if (ecartConvocation != null && ecartConvocation < 0) return { liste: recente, jouees };
    const dedans = p.mine === "present";
    const { etat, texte } = etatLigue(dedans, p.presents.length);
    const liste: MatchMap[] = [
      {
        cle: "convocation",
        j: null,
        quand: quand(p.jour === "Dimanche" ? "" : p.jour, p.jour, aujourdhui),
        dateLabel: p.jour,
        heure: p.heure,
        terrain: terrainDuMatch(saison, p.lieu),
        presents: p.presents,
        effectif: p.effectif,
        dedans,
        etat,
        etatTexte: texte,
        ligue: "sfl",
      },
      ...recente,
    ];
    return { liste, jouees };
  }, [sansSfl, saison, matchsDe, player.name, aujourdhui, heure, p.heure, p.lieu, p.jour, p.mine, p.effectif, p.presents]);
  // Les habitués : ceux du dernier dimanche joué (la fiche d'une journée pas encore composée).
  const habitues = useMemo(() => {
    const derniere = [...saison.journees].sort((x, y) => y.j - x.j).find((m) => journeeJouee(saison, m.j));
    return derniere ? joueursDeLaFeuille(saison, derniere.j).noms : [];
  }, [saison]);

  // Les matchs ouverts par les joueurs : un public montre ses places libres,
  // un privé n'apparaît qu'à ceux qui en sont.
  const { parties, moi, actif: partiesActives, recharger } = useParties();
  // La discussion de chacun de mes matchs : ce que je n'y ai pas lu.
  const { apercus } = useDiscussionsMatch();
  const matchsTeam = useMatchsTeam();
  const matchs = useMemo<MatchMap[]>(() => {
    const ouverts = parties.map((x): MatchMap => {
      const venus = inscrits(x).map((j) => j.name);
      const moiLa = x.joueurs.find((j) => j.id === moi);
      const libres = placesLibres(x);
      const { etat, texte } =
        moiLa?.statut === "invite"
          ? { etat: { genre: "manque", n: libres } as EtatSticker, texte: "Tu es invité" }
          : moiLa
            ? { etat: { genre: "dedans" } as EtatSticker, texte: "Tu y es" }
            : x.visibilite === "prive"
              ? { etat: { genre: "complet" } as EtatSticker, texte: "Privé" }
              : etatDe(false, libres);
      const dateLabel = libelleJour(x.jour);
      return {
        // Rouge, orange ou vert : ce qu'il manque, dit par la couleur (un privé où je ne suis pas n'en dit rien).
        remplissage: x.visibilite === "prive" && !moiLa ? undefined : remplissageDe(libres, x.places),
        cle: `m${x.id}`,
        j: null,
        quand: quand(dateLabel, null, aujourdhui),
        dateLabel,
        heure: x.heure,
        terrain:
          x.lat != null && x.lng != null
            ? { id: -x.id, nom: x.lieu, adresse: x.adresse ?? "", lat: x.lat, lng: x.lng, commune: communeDeLAdresse(x.adresse) }
            : null,
        presents: venus,
        effectif: x.places,
        dedans: moiLa?.statut === "inscrit",
        etat,
        etatTexte: texte,
        partie: x,
        ligue: "bola",
      };
    });
    // Les matchs d'équipe : sur le terrain dont ils portent le nom, de la
    // ligue ou du recensement ; sinon dans le carrousel seulement.
    const equipes = matchsTeam.map((t): MatchMap => {
      const dateLabel = libelleJour(t.defi.jour);
      const dedans = [t.de, t.a].some((e) => e.membres.some((x) => x.id === moi && x.statut === "membre"));
      const lieu = sansAccents(t.defi.lieu);
      const terrain = terrains.find((x) => sansAccents(x.nom) === lieu) ?? recensesParNom.get(lieu) ?? null;
      return {
        cle: `t${t.defi.id}`,
        j: null,
        quand: quand(dateLabel, null, aujourdhui),
        dateLabel,
        heure: t.defi.heure.slice(0, 5).replace(":", "h"),
        terrain,
        presents: [],
        effectif: 0,
        dedans,
        etat: dedans ? { genre: "dedans" } : { genre: "equipe", texte: `${t.de.initiales} – ${t.a.initiales}` },
        etatTexte: dedans ? "Tu y es" : `${t.de.initiales} – ${t.a.initiales}`,
        team: t,
        ligue: "team",
      };
    });
    return [...ligue, ...ouverts, ...equipes];
  }, [ligue, parties, moi, aujourdhui, matchsTeam, terrains, recensesParNom]);

  // Sur la carte, dans l'ordre du temps : le dernier match joué à gauche, en
  // petit, puis ce qui arrive, du plus proche au plus loin. Le match « à la
  // une » est le prochain : c'est lui qu'on voit en ouvrant la Map, avec ce
  // qu'il lui manque. Le jour même, après le coup de sifflet, le match joué
  // garde la une jusqu'à minuit (on y cherche le récap) ; dès le lendemain,
  // la une passe au suivant. Les terrains enregistrés n'y sont plus — on ne
  // noie pas le match. Une journée jouée en plusieurs lieux pose une carte
  // par lieu : chacun ouvre la Map sur la sienne, celle de son match.
  const affiches = useMemo(() => {
    const ordre = (m: MatchMap) => (ecartJours(m.dateLabel, aujourdhui) ?? 99) * 24 + heureDe(m.heure);
    const aVenir = matchs.filter((m) => !m.joue).sort((a, b) => ordre(a) - ordre(b) || Number(b.dedans) - Number(a.dedans));
    const joue = matchs.filter((m) => m.joue).at(-1);
    return joue ? [joue, ...aVenir] : aVenir;
  }, [matchs, aujourdhui]);
  const une = useMemo(() => {
    const joue = affiches.find((m) => m.joue);
    if (joue && ecartJours(joue.dateLabel, aujourdhui) === 0) return joue;
    const prochain = affiches.find((m) => !m.joue);
    const mien = prochain?.j != null ? affiches.find((m) => !m.joue && m.j === prochain.j && m.dedans) : undefined;
    return mien ?? prochain ?? affiches[0];
  }, [affiches, aujourdhui]);
  // L'affiche d'un match à venir (lib/sfl/affiche.ts) : le meilleur des
  // Noirs contre le meilleur des Blancs une fois les équipes faites, sinon
  // les deux meilleures notes parmi ceux qui viennent (ou les habitués).
  const versionAffiches = useAffiches();
  const afficheDu = useCallback(
    (m: MatchMap): Affiche | null => {
      if (m.joue) return null;
      const joueur = (nom: string) => players.find((p) => p.name === nom);
      const match = m.j != null && m.ligue === "sfl" ? journees.find((x) => x.j === m.j)?.matches?.[m.matchsIci?.[0] ?? 0] : undefined;
      const cote = (equipe: string) =>
        saison.entries.filter((e) => e.j === m.j && e.team === equipe && e.statut === "Présent").map((e) => e.player);
      const noirs = match ? parNote(cote(match.teamA.name), joueur) : [];
      const blancs = match ? parNote(cote(match.teamB.name), joueur) : [];
      if (noirs.length && blancs.length) return afficheDe({ noirs, blancs }, joueur);
      return afficheDe({ joueurs: parNote(m.presents.length ? m.presents : m.ligue === "sfl" ? habitues : [], joueur) }, joueur);
    },
    // versionAffiches : relire quand une affiche arrive du serveur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [habitues, players, journees, saison.entries, versionAffiches]
  );

  // Les terrains possibles, en stickers vides : tous, sauf ceux qui ont déjà
  // leur match. Comparés par leurs lieux : la liste des matchs est refaite à
  // chaque rendu, le plan ne se redessine que si un match change de terrain.
  const pris = useMemo(
    () =>
      affiches
        .flatMap((m) => (m.terrain ? [`${m.terrain.lat},${m.terrain.lng}`] : []))
        .sort()
        .join(";"),
    [affiches]
  );
  const libres = useMemo(() => {
    const occupes = pris ? pris.split(";").map((x) => ({ lat: Number(x.split(",")[0]), lng: Number(x.split(",")[1]) })) : [];
    return proposables.filter((t) => !occupes.some((o) => km(o, t) < MEME_TERRAIN_KM));
  }, [proposables, pris]);
  // Le format choisi (dans le menu de la Map) ne garde que les complexes
  // qui en ont un ; un format sans aucun terrain libre s'éteint.
  const formatTerrain = useFormatTerrain();
  // Ce que la Map montre en plus des matchs : les joueurs, les terrains libres (le menu de la Map).
  const calques = useCalquesMap();
  const comptesFormats = useMemo(() => new Map(FORMATS.map((f) => [f, aFormat(libres, f).length])), [libres]);
  const possibles = useMemo<PossiblePlan[]>(
    () =>
      aFormat(libres, formatTerrain).map((t) => ({
        id: t.id,
        lat: t.lat,
        lng: t.lng,
        nom: lieuDuTerrain(t),
        // La ligue d'abord, puis les complexes les plus grands, éclairés avant les autres.
        rang: t.ligue != null ? 0 : 10 - Math.min(9, t.formats.length) + (t.eclaire ? 0 : 0.5),
      })),
    [libres, formatTerrain]
  );
  // Le terrain possible touché : il se lève sur le plan, puis sa fiche monte
  // (un instant après, qu'on voie l'onde partir). La fiche garde le terrain
  // le temps de redescendre.
  const [libre, setLibre] = useState<TerrainPropose | null>(null);
  const [leve, setLeve] = useState<string | null>(null);
  const [ficheLibre, setFicheLibre] = useState(false);
  const toucherPossible = useCallback(
    (id: string) => {
      const t = proposables.find((x) => x.id === id);
      if (!t) return;
      setLibre(t);
      setLeve(t.id);
      const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.setTimeout(() => setFicheLibre(true), calme ? 0 : 320);
    },
    [proposables]
  );
  const tonFantomes = useTeinteFantome();

  // Ouvrir un match : n'importe quel joueur, d'un bouton, d'un moment libre ou d'un terrain possible.
  const [ouvrir, setOuvrir] = useState<{ terrain: Terrain | null; lieu?: LieuChoisi; jour?: string; heure?: string; n: number } | null>(null);
  const [dispos, setDispos] = useState(false);

  // « Ton premier match » (components/sfl/invitation-premier-match.tsx) :
  // /map?ouvrir=id ouvre la feuille d'ouverture sur ce terrain du catalogue,
  // dès que sa case est lue ; /map?ouvrir= l'ouvre vide. Lu une fois et gardé
  // (l'effet remonté du mode strict ne le relit pas dans l'adresse).
  const aOuvrir = useRef<string | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (!q.has("ouvrir")) return;
    aOuvrir.current = q.get("ouvrir") ?? "";
    if (aOuvrir.current) lireTerrain(aOuvrir.current).catch(() => {});
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  useEffect(() => {
    const id = aOuvrir.current;
    if (id === null || !partiesActives) return;
    const t = id ? recenses.find((x) => x.id === id) : null;
    if (id && !t) return;
    aOuvrir.current = null;
    void Promise.resolve().then(() =>
      setOuvrir((o) => ({
        terrain: null,
        lieu: t ? { lieu: lieuDuTerrain(t), adresse: t.adresse, lat: t.lat, lng: t.lng, terrain: t } : undefined,
        n: (o?.n ?? 0) + 1,
      }))
    );
  }, [recenses, partiesActives]);

  const [fiche, setFiche] = useState(false);
  const [ficheAdmin, setFicheAdmin] = useState(false);
  const [choix, setChoixBrut] = useState<string | null>(null);
  // La carte « Ton match » au bout du carrousel (le match que la Map propose
  // d'ouvrir) : choisie, le plan montre son terrain ; choisir un match la quitte.
  const [surProposition, setSurProposition] = useState(false);
  const setChoix = useCallback((cle: string | null) => {
    setSurProposition(false);
    setChoixBrut(cle);
  }, []);
  // Toucher un match sur le plan le choisit et ouvre sa fiche — un instant
  // après, qu'on voie le sticker grandir et l'onde partir.
  const choisirSticker = useCallback((id: string) => {
    setChoix(id);
    setFicheAdmin(false);
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setFiche(true), calme ? 0 : 320);
  }, [setChoix]);
  // Le carrousel replié (Sabri, 22/10 : « il faut pouvoir le rendre invisible
  // pour qu'on puisse juste admirer la map »), gardé d'une visite à l'autre.
  const [replie, setReplie] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem("bola-map-replie") === "1") setReplie(true);
      } catch {}
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const basculerCarrousel = () => {
    navigator.vibrate?.(5);
    setReplie((r) => {
      try {
        window.localStorage.setItem("bola-map-replie", r ? "0" : "1");
      } catch {}
      return !r;
    });
  };
  // Le match choisi : celui qu'on a touché s'il est encore là, sinon la une.
  // Un dimanche plus ancien se choisit depuis la page de son lieu.
  const choisi = affiches.find((m) => m.cle === choix) ?? matchs.find((m) => m.cle === choix) ?? ligueJouees.find((m) => m.cle === choix) ?? une;
  // Les matchs du lieu du choisi, du plus ancien au prochain : la page du
  // lieu les fait défiler (Sabri, 31/10 : « on pourrait même voir les autres
  // matchs précédents »).
  const auLieu = useMemo<MatchMap[]>(() => {
    const t = choisi?.terrain;
    if (!choisi || !t) return choisi ? [choisi] : [];
    const ici = (m: MatchMap) =>
      !!m.terrain && (m.terrain.id === t.id || sansAccents(m.terrain.nom) === sansAccents(t.nom) || Math.hypot(m.terrain.lat - t.lat, (m.terrain.lng - t.lng) * 0.64) < 0.0015);
    const vus = new Set<string>();
    const ordre = (m: MatchMap) => (ecartJours(m.dateLabel, aujourdhui) ?? (m.joue ? -999 : 99)) * 24 + heureDe(m.heure);
    return [...ligueJouees, ...matchs]
      .filter((m) => ici(m) && !vus.has(m.cle) && !!vus.add(m.cle))
      .sort((a, b) => ordre(a) - ordre(b));
  }, [choisi, ligueJouees, matchs, aujourdhui]);
  // La convocation d'un dimanche que la saison n'a pas encore : le numéro de sa journée.
  const jDuChoisi = choisi?.j ?? (choisi?.cle === "convocation" && p.shared ? p.journee : null);

  // La discussion d'un match, plein écran par-dessus la Map ; ou celle de
  // mon équipe (match: null), mon prochain match sous l'onglet Match.
  const [discussion, setDiscussion] = useState<{ match: number | null; onglet: OngletDiscussion } | null>(null);
  const fermerDiscussion = useCallback(() => setDiscussion(null), []);
  const ouvrirDiscussion = useCallback((cle: string) => {
    setChoix(cle);
    setFiche(false);
    setDiscussion({ match: Number(cle.slice(1)), onglet: "match" });
  }, [setChoix]);
  const ouvrirEquipe = useCallback(() => setDiscussion({ match: null, onglet: "equipe" }), []);
  const partieDiscussion =
    discussion == null
      ? undefined
      : discussion.match != null
        ? parties.find((x) => x.id === discussion.match)
        : parties.find((x) => !!moi && (x.organisateurId === moi || x.joueurs.some((j) => j.id === moi)));

  // Un match à montrer dès qu'il est là : celui qu'on vient d'ouvrir, ou
  // celui d'une notification (/?match=12). Sa fiche s'ouvre, on y gère tout ;
  // la notification d'un message (/?match=12&discussion) ouvre sa discussion,
  // celle d'un message de mon équipe (/?discussion=equipe), son onglet.
  const aMontrer = useRef<{ cle: string; discussion: boolean } | null>(null);
  const equipeAMontrer = useRef(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("discussion") === "equipe") {
      equipeAMontrer.current = true;
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }
    const id = q.get("match");
    if (!id || !/^\d+$/.test(id)) return;
    aMontrer.current = { cle: `m${id}`, discussion: q.has("discussion") };
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  useEffect(() => {
    if (equipeAMontrer.current) {
      equipeAMontrer.current = false;
      ouvrirEquipe();
      return;
    }
    const a = aMontrer.current;
    if (!a || !affiches.some((m) => m.cle === a.cle)) return;
    aMontrer.current = null;
    if (a.discussion) ouvrirDiscussion(a.cle);
    else choisirSticker(a.cle);
  }, [affiches, choisirSticker, ouvrirDiscussion, ouvrirEquipe]);
  const invitations = useMemo(() => invitationsDe(parties, moi), [parties, moi]);
  // Les équipes du mode Team qui m'invitent : leur carte au-dessus de celles des matchs.
  const { equipe: monEquipe, invitations: invitationsEquipe } = useMonEquipe();
  // Défier depuis un terrain : le capitaine ou le vice d'une équipe active ;
  // sans équipe, la monter ; un simple membre laisse le défi à son capitaine.
  const roleEquipe = monEquipe?.membres.find((x) => x.id === moi && x.statut === "membre")?.role;
  const defiDepuisTerrain: "defier" | "monter" | null = !partiesActives
    ? null
    : !monEquipe
      ? "monter"
      : active(monEquipe) && (roleEquipe === "capitaine" || roleEquipe === "vice")
        ? "defier"
        : null;

  // Le carrousel et le plan vont ensemble : faire glisser les cartes choisit
  // celle qui s'arrête au centre (le plan suit), et choisir sur le plan amène
  // sa carte au centre.
  const carrousel = useRef<HTMLDivElement>(null);
  /** La carte au centre : la clé du match choisi, ou « proposition ». */
  const carteCle = useRef<string | undefined>(undefined);
  const arretCarrousel = useRef(0);
  const suivreCarrousel = useCallback(() => {
    window.clearTimeout(arretCarrousel.current);
    arretCarrousel.current = window.setTimeout(() => {
      const boite = carrousel.current;
      if (!boite) return;
      const milieu = boite.getBoundingClientRect().left + boite.clientWidth / 2;
      let proche: HTMLElement | null = null;
      let ecart = Infinity;
      for (const el of boite.querySelectorAll<HTMLElement>("[data-cle]")) {
        const r = el.getBoundingClientRect();
        const e = Math.abs(r.left + r.width / 2 - milieu);
        if (e < ecart) [proche, ecart] = [el, e];
      }
      const cle = proche?.dataset.cle;
      if (cle && cle !== carteCle.current) {
        navigator.vibrate?.(5);
        if (cle === "proposition") setSurProposition(true);
        else setChoix(cle);
      }
    }, 140);
  }, [setChoix]);
  const cleChoisie = choisi?.cle;
  useEffect(() => {
    const cle = surProposition ? "proposition" : cleChoisie;
    carteCle.current = cle;
    const el = cle && carrousel.current?.querySelector<HTMLElement>(`[data-cle="${cle}"]`);
    if (!el) return;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: calme ? "auto" : "smooth" });
  }, [cleChoisie, surProposition]);
  const stickers = useMemo<StickerPlan[]>(
    () =>
      affiches
        // Deux matchs à venir au même endroit font un paquet sur le plan
        // (map/carte-map.tsx) ; le match joué, lui, s'efface derrière un match
        // à venir sur son terrain, sauf quand on le choisit.
        .filter((m) => {
          if (!m.terrain) return false;
          if (!m.joue || m.cle === choisi?.cle) return true;
          return !affiches.some((x) => !x.joue && x.terrain && km(x.terrain, m.terrain!) < MEME_TERRAIN_KM);
        })
        .map((m) => ({
          id: m.cle,
          lat: m.terrain!.lat,
          lng: m.terrain!.lng,
          moment: m.quand.moment,
          jourCourt: m.quand.jourCourt,
          heure: m.heure,
          etat: m.etat,
          nom: m.terrain!.nom,
          ligue: m.ligue,
          remplissage: m.remplissage,
          discussion: m.partie && apercus.has(m.partie.id) ? { nonLus: apercus.get(m.partie.id)!.nonLus } : undefined,
        })),
    [affiches, choisi, apercus]
  );

  // Toi : ta position, quand tu la donnes.
  const [toi, setToi] = useState<ToiPlan | null>(null);
  const [cherchePosition, setCherchePosition] = useState(false);
  // Donnée il y a moins d'une heure sur ce téléphone (« Ton premier match ») :
  // la Map le place au même endroit, sans redemander.
  const noteToi = ovr(player.stats);
  const teinteToi = teinte(player.name);
  useEffect(() => {
    const p = positionGardee();
    if (p) void Promise.resolve().then(() => setToi((t) => t ?? { ...p, note: noteToi, teinte: teinteToi }));
  }, [noteToi, teinteToi]);
  function localiser() {
    if (!("geolocation" in navigator)) {
      toast.error("Ce navigateur ne donne pas la position.");
      return;
    }
    setCherchePosition(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        garderPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setToi({ lat: pos.coords.latitude, lng: pos.coords.longitude, note: ovr(player.stats), teinte: teinte(player.name) });
        setCherchePosition(false);
      },
      (err) => {
        setCherchePosition(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Active ta position dans les réglages du navigateur." : "On ne te trouve pas.");
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  // Le match que la Map propose d'ouvrir (lib/sfl/proposition.ts) : le moment
  // de la semaine où le plus de joueurs sont libres, que rien n'occupe déjà,
  // sur le terrain libre le plus proche (de toi, de ta ville, sinon de la
  // ligue) et du format choisi. Les dispos se relisent quand Mes dispos se
  // referme. Tant qu'elles sont cachées (DISPOS_AFFICHEES), pas de moment :
  // la carte propose seulement le terrain.
  const [disposSemaine, setDisposSemaine] = useState<Dispo[]>([]);
  useEffect(() => {
    if (!partiesActives || dispos) return;
    let fini = false;
    const jours = prochainsJours(7);
    listerDispos(jours[0], jours[jours.length - 1])
      .then((d) => !fini && setDisposSemaine(d))
      .catch(() => {});
    return () => {
      fini = true;
    };
  }, [partiesActives, dispos]);
  // Ce qui occupe déjà un moment : un match ouvert qui a de la place, un des miens, une journée de la ligue.
  const occupes = useMemo(() => {
    const s = new Set<string>();
    for (const m of affiches) {
      if (m.joue) continue;
      if (m.partie) {
        const x = m.partie;
        if (m.dedans || x.organisateurId === moi || (x.visibilite === "public" && placesLibres(x) > 0)) s.add(cleMoment(x.jour, momentDeLHeure(x.heure)));
      } else if (m.team) {
        if (m.dedans) s.add(cleMoment(m.team.defi.jour, momentDeLHeure(m.team.defi.heure)));
      } else {
        const d = lireDate(m.dateLabel, aujourdhui);
        if (d) s.add(cleMoment(d.toISOString().slice(0, 10), momentDeLHeure(m.heure)));
      }
    }
    return s;
  }, [affiches, moi, aujourdhui]);
  const momentPropose = useMemo(
    () => (partiesActives ? meilleurMoment(disposSemaine, { moi, aujourdhui, heure, occupes }) : null),
    [partiesActives, disposSemaine, moi, aujourdhui, heure, occupes]
  );
  const ville = me ? maVille(me) : null;
  const pres = toi ?? ville ?? terrains.find((t) => t.defaut) ?? PRES_DE;
  const [presLat, presLng] = [pres.lat, pres.lng];
  // Les terrains autour de toi (ou de ta ville) : la proposition les cherche là.
  useEffect(() => {
    lireAutour({ lat: presLat, lng: presLng }).catch(() => {});
  }, [presLat, presLng]);
  // Sans format choisi, un terrain à 5 : un match ouvert se joue à dix, comme
  // la ligue. Sans moment, la feuille s'ouvre à 19 h : un terrain éclairé.
  const ouPropose = useMemo(() => {
    if (!partiesActives) return null;
    const ici = { lat: presLat, lng: presLng };
    const moment = momentPropose?.moment ?? "soir";
    return terrainPropose(aFormat(libres, formatTerrain ?? 5), ici, moment) ?? terrainPropose(libres, ici, moment);
  }, [partiesActives, libres, formatTerrain, presLat, presLng, momentPropose]);
  const proposition = momentPropose || ouPropose ? { moment: momentPropose, terrain: ouPropose } : null;
  // Sur la carte proposée (ou seule, sans match) : le plan montre son terrain.
  const surCarte = !!proposition && (surProposition || affiches.length === 0);
  const seulPropose = useMemo(() => (ouPropose ? possibles.filter((x) => x.id === ouPropose.id) : SANS_POSSIBLES), [possibles, ouPropose]);
  const ouvrirPropose = () => {
    navigator.vibrate?.(8);
    const t = proposition?.terrain ?? null;
    const deLaLigue = t?.ligue != null ? (terrains.find((x) => x.id === t.ligue) ?? null) : null;
    setOuvrir((o) => ({
      terrain: deLaLigue,
      lieu: t && !deLaLigue ? { lieu: lieuDuTerrain(t), adresse: t.adresse, lat: t.lat, lng: t.lng, terrain: t } : undefined,
      jour: proposition?.moment?.jour,
      heure: proposition?.moment?.heure,
      n: (o?.n ?? 0) + 1,
    }));
  };
  // Sous « Ouvrir un match », ce que la Map propose : « SAM. 15H · 7 LIBRES », sinon le terrain.
  const sousOuvrir = proposition?.moment
    ? `${quand(libelleJour(proposition.moment.jour), null, aujourdhui).jourCourt} ${heureCourte(proposition.moment.heure.replace(":", "h"))} · ${proposition.moment.noms.length} libres`
    : proposition?.terrain
      ? [lieuDuTerrain(proposition.terrain), toi ? distanceLisible(toi, proposition.terrain) : null].filter(Boolean).join(" · ")
      : null;

  const ios = useEstIos();
  // Les gestes faits dans la Map, au journal d'activité (31/10 : aucun ne
  // l'était ; on saura ce qui sert).
  // Le coup d'envoi du choisi, en ms (l'heure du téléphone, en France).
  const debutDuChoisi = useMemo(() => {
    if (!choisi || choisi.joue) return null;
    const iso = dateIsoDuMatch(choisi, aujourdhui);
    const h = choisi.heure.match(/(\d{1,2})\s*[h:]\s*(\d{2})?/i);
    if (!iso || !h) return null;
    const t = new Date(`${iso}T${h[1].padStart(2, "0")}:${h[2] ?? "00"}:00`).getTime();
    return Number.isFinite(t) ? t : null;
  }, [choisi, aujourdhui]);
  // Ton trajet jusqu'au match choisi (31/10) : il brille sur le plan, et
  // « Y aller » dit son temps. Seulement quand on sait où tu es, et pas
  // au-delà de 60 km (un autre pays n'est pas un trajet).
  const [trajet, setTrajet] = useState<(Trajet & { cle: string }) | null>(null);
  const cibleTrajet = !surCarte && toi && choisi?.terrain && !choisi.joue ? choisi.terrain : null;
  const cleTrajet = toi && cibleTrajet ? `${toi.lat.toFixed(3)},${toi.lng.toFixed(3)}>${cibleTrajet.lat},${cibleTrajet.lng}` : null;
  useEffect(() => {
    if (!cleTrajet || !toi || !cibleTrajet) return;
    if (Math.hypot(toi.lat - cibleTrajet.lat, (toi.lng - cibleTrajet.lng) * 0.64) > 0.55) return;
    let vivant = true;
    void trajetVers(toi, cibleTrajet).then((t) => vivant && setTrajet({ ...t, cle: cleTrajet }));
    return () => {
      vivant = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleTrajet]);
  const trajetIci = trajet && trajet.cle === cleTrajet ? trajet : null;
  // Le match choisi se pose au centre du carrousel du lieu, à l'ouverture et à chaque choix (pas à chaque rendu : on y glisse du doigt).
  useEffect(() => {
    if (!fiche) return;
    const t = window.setTimeout(() => document.querySelector("[data-lieu-choisi]")?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }), 60);
    return () => window.clearTimeout(t);
  }, [fiche, choisi?.cle]);
  // La page d'un lieu s'ouvre depuis l'endroit touché : le dernier toucher,
  // posé en variables CSS (sans redessiner la Map à chaque doigt).
  useEffect(() => {
    const noter = (e: PointerEvent) => {
      const r = document.documentElement.style;
      r.setProperty("--lieu-x", `${Math.round(e.clientX)}px`);
      r.setProperty("--lieu-y", `${Math.round(e.clientY)}px`);
    };
    window.addEventListener("pointerdown", noter, { capture: true, passive: true });
    return () => window.removeEventListener("pointerdown", noter, { capture: true });
  }, []);
  const geste = useCallback((g: string, meta?: Record<string, string | number | boolean>) => logActivity("map", { path: "/", meta: { geste: g, ...meta } }), []);
  // Le match du dimanche, convocation ouverte : on y répond depuis la Map.
  const repondreIci = !!choisi && !choisi.joue && !choisi.partie && !choisi.team && (!!choisi.convoquee || choisi.cle === "convocation") && p.reponsesOuvertes;

  // Les joueurs, ville par ville, du mieux noté au moins bien noté. Ce sont
  // ceux de la SFL : un joueur Bola ne les voit pas (28/10/2026).
  const revVilles = useVillesRevision();
  const revPhotos = usePhotoRevision();
  const revNoms = useIdentitesRevision();
  const villes = useMemo<VillePlan[]>(() => {
    if (revVilles < 0 || sansSfl) return [];
    void revPhotos;
    void revNoms;
    const parVille = new Map<string, VillePlan>();
    // Qui n'a pas donné sa ville est dans celle de la ligue.
    for (const pl of players) {
      const v = villeOuLigue(pl.name);
      if (!v) continue;
      const id = cleVille(v.ville);
      const g = parVille.get(id) ?? { id, ville: v.ville, lat: v.lat, lng: v.lng, joueurs: [] };
      // Sur le plan, les cartes font 22 à 36 px : la photo en vignette.
      const photo = photoPerso(pl.name);
      g.joueurs.push({ name: pl.name, affiche: nomAffiche(pl.name), note: ovr(pl.stats), photo: photo && photoMiniature(photo), secours: photo });
      parVille.set(id, g);
    }
    for (const g of parVille.values()) g.joueurs.sort((a, b) => b.note - a.note || a.affiche.localeCompare(b.affiche));
    return [...parVille.values()];
  }, [players, revVilles, revPhotos, revNoms, sansSfl]);

  // Les zones Bola (lib/sfl/zones.ts) : là où l'on joue, et d'où viennent
  // ceux qui y jouent. La ligue ouvre la première ; chaque match ouvert ou
  // défi d'équipe loin de tout en ouvre une nouvelle.
  const ambiance = useSyncExternalStore(rienAEcouter, ambianceDeLAdresse, (): Ambiance => "nuit-encre");
  // Midi, aujourd'hui à Paris : l'âge des zones (une zone de moins de trois jours est nouvelle).
  const maintenant = aujourdhui ? Date.parse(`${aujourdhui}T12:00:00`) : 0;
  const demoZones = useZonesDemo();
  const foyers = useMemo<Foyer[]>(() => {
    const f: Foyer[] = sansSfl ? [] : terrains.map((t) => ({ lat: t.lat, lng: t.lng, genre: "sfl" as const, nom: t.nom, commune: t.commune }));
    for (const m of matchs) {
      if (!m.terrain || m.ligue === "sfl") continue;
      const depuis = m.partie ? Date.parse(`${m.partie.jour}T12:00:00`) : m.team ? Date.parse(`${m.team.defi.jour}T12:00:00`) : undefined;
      f.push({ lat: m.terrain.lat, lng: m.terrain.lng, genre: m.ligue === "team" ? "team" : "bola", nom: m.terrain.nom, commune: m.terrain.commune, depuis, par: m.partie?.organisateur });
    }
    if (demoZones) f.push({ lat: 50.4296, lng: 2.8307, genre: "bola", nom: "Five de Lens", commune: "Lens", depuis: maintenant, par: "Sami" });
    return f;
  }, [terrains, matchs, sansSfl, demoZones, maintenant]);
  const villesZones = useMemo<VilleZone[]>(() => {
    const v = villes.map((x) => ({ ville: x.ville, lat: x.lat, lng: x.lng, n: x.joueurs.length }));
    if (demoZones) v.push({ ville: "Paris", lat: 48.8566, lng: 2.3522, n: 5 }, { ville: "Lens", lat: 50.4296, lng: 2.8307, n: 3 });
    // Une ville, une fois (la démo des aperçus peut doubler une vraie).
    const parNom = new Map<string, VilleZone>();
    for (const x of v) {
      const deja = parNom.get(x.ville);
      if (deja) deja.n += x.n;
      else parNom.set(x.ville, { ...x });
    }
    return [...parNom.values()];
  }, [villes, demoZones]);
  const dimanches = useMemo(() => saison.journees.filter((j) => journeeJouee(saison, j.j)).length, [saison]);
  const chezMoi = useMemo(() => (me && villes.length ? villeOuLigue(me) : null), [me, villes]);
  // Calculées toujours (le titre de la Map les lit), dessinées seulement dans une ambiance.
  const toutesZones = useMemo<Zone[]>(() => {
    return calculerZones(foyers, villesZones, maintenant).map((z) => {
      const ligue = z.foyers.some((f) => f.genre === "sfl");
      const matchsIci = z.foyers.filter((f) => f.genre !== "sfl").length;
      const sous = z.ouverte
        ? [`${z.joueurs} joueur${z.joueurs > 1 ? "s" : ""}`, ligue && dimanches ? `${dimanches} dimanche${dimanches > 1 ? "s" : ""}` : null, matchsIci ? `${matchsIci} match${matchsIci > 1 ? "s" : ""}` : null]
            .filter(Boolean)
            .join(" · ")
        : `${z.joueurs} joueurs · aucun match`;
      // La zone où je vis : « Ta zone ».
      const aMoi = !!chezMoi && dansContour(z.contour, chezMoi.lat, chezMoi.lng);
      return { ...z, sous, aMoi };
    });
  }, [foyers, villesZones, dimanches, maintenant, chezMoi]);
  const zones = ambiance === "classique" ? AUCUNE_ZONE : toutesZones;
  const [zoneOuverte, setZoneOuverte] = useState<string | null>(null);
  const zoneVue = zones.find((z) => z.id === zoneOuverte) ?? null;
  /** La zone d'un point : ouverte, sinon celle qu'un match là-bas ouvrirait (son numéro à venir). */
  const zoneDe = useCallback(
    (lat: number, lng: number) => {
      const ici = zones.find((z) => z.ouverte && dansContour(z.contour, lat, lng));
      if (ici) return { zone: ici, ouvre: false };
      const prochaine = zones.filter((z) => z.ouverte).length + 1;
      const attente = zones.find((z) => !z.ouverte && dansContour(z.contour, lat, lng));
      return { zone: attente ?? null, ouvre: true, numero: prochaine };
    },
    [zones]
  );
  // Les terrains hors des zones passent au vert : leur premier match ouvre une zone.
  const possiblesZones = useMemo(() => {
    const ouvertes = zones.filter((z) => z.ouverte);
    if (!ouvertes.length) return possibles;
    return possibles.map((x) => ({ ...x, horsZone: !ouvertes.some((z) => dansContour(z.contour, x.lat, x.lng)) }));
  }, [possibles, zones]);
  const zoneProposee = useMemo(() => {
    const t = proposition?.terrain;
    if (!t || !zones.length) return null;
    const z = zoneDe(t.lat, t.lng);
    return z.ouvre ? numeroZone(z.numero!) : null;
  }, [proposition?.terrain, zones, zoneDe]);
  const zoneDuLibre = useMemo(() => {
    if (!libre || !zones.length) return null;
    const z = zoneDe(libre.lat, libre.lng);
    if (!z.ouvre) return { texte: `Zone ${numeroZone(z.zone!.numero)} · ${z.zone!.nom}`, ouvre: false };
    return { texte: `Ton match ouvre la zone ${numeroZone(z.numero!)}${z.zone ? ` · ${z.zone.nom}` : ""}`, ouvre: true };
  }, [libre, zones, zoneDe]);
  // Le filtre Contrats : seules les cibles du dimanche, chacune avec son
  // contrat. L'horloge des missions recalcule tout chaque minute : les cibles
  // passent par une chaîne, pour que le plan ne redessine ses joueurs que
  // quand un contrat change.
  const missions = useMissionsDeLaLigue();
  const [contrats, setContrats] = useState(false);
  const ciblesCle = useMemo(() => JSON.stringify(missions ? [...ciblesDuDimanche(missions)] : []), [missions]);
  const cibles = useMemo(() => new Map(JSON.parse(ciblesCle) as [string, ContratPlan][]), [ciblesCle]);
  // Les contrats sont ceux du dimanche de la SFL : pas pour un joueur Bola.
  const enContrats = !sansSfl && contrats && cibles.size > 0;
  const villesVues = useMemo(() => (enContrats ? villesDesCibles(villes, cibles) : villes), [enContrats, villes, cibles]);
  // Allumer le filtre cadre le plan sur le foyer des cibles ; l'éteindre le ramène sur les matchs.
  const [cadrage, setCadrage] = useState<{ lieux: { lat: number; lng: number }[]; n: number } | null>(null);
  const basculerContrats = () => {
    navigator.vibrate?.(6);
    const allume = !contrats;
    setContrats(allume);
    setCadrage((x) =>
      allume ? { lieux: foyerDesCibles(villesDesCibles(villes, cibles)).map((v) => ({ lat: v.lat, lng: v.lng })), n: (x?.n ?? 0) + 1 } : null
    );
  };
  const [catalogue, setCatalogue] = useState(false);
  // Un joueur touché dans le catalogue : son profil s'ouvre dans sa fenêtre (ui/sheet.tsx).
  const fenetreCatalogue = useRef<Fenetre | null>(null);
  // La notification « Mets ta ville » ouvre /map?ville : le catalogue, la recherche de ta ville ouverte.
  const [chercherVille, setChercherVille] = useState(false);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("ville")) return;
    const t = window.setTimeout(() => {
      window.history.replaceState(null, "", window.location.pathname);
      setChercherVille(true);
      setCatalogue(true);
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  const [focusVilles, setFocusVilles] = useState<string[] | null>(null);
  const [profil, setProfil] = useState<string | null>(null);
  const [viser, setViser] = useState<{ lat: number; lng: number; n: number } | null>(null);
  // Une pile touchée sur la Map : sa collection, la Map floutée derrière.
  const [pile, setPile] = useState<string[] | null>(null);
  const ouvrirVille = useCallback((ids: string[]) => setPile(ids), []);
  const fermerPile = useCallback(() => setPile(null), []);
  const villesPile = useMemo(() => (pile ? villesVues.filter((v) => pile.includes(v.id)) : []), [pile, villesVues]);
  // Une cible touchée avec le filtre Contrats : les contrats sur elle ; sinon le profil.
  const [cible, setCible] = useState<string | null>(null);
  const toucherJoueur = useCallback(
    (nom: string) => (enContrats && cibles.has(nom) ? setCible(nom) : setProfil(nom)),
    [enContrats, cibles]
  );
  const rangs = useMemo(() => new Map(rankPlayers(players).map((x) => [x.name, x.rank])), [players]);
  const profilJoueur = profil ? players.find((x) => x.name === profil) : undefined;
  const nomFocus = focusVilles?.length === 1 ? villes.find((v) => v.id === focusVilles[0])?.ville : null;

  // La feuille de match du choisi : les équipes de sa journée, chaque match
  // à son heure, à son lieu et sur son terrain (seulement ceux d'ici quand la
  // journée se joue en plusieurs lieux), sinon celles de la convocation une
  // fois révélées (vendredi 19h ; l'admin, toujours).
  const feuille = useMemo<TerrainFeuille[]>(() => {
    if (!choisi || choisi.partie) return [];
    const meta = choisi.j != null ? saison.journees.find((x) => x.j === choisi.j) : undefined;
    const horaires = meta ? matchsDe(meta).matchs : [];
    const deJournee = feuilleDeJournee(journees.find((x) => x.j === choisi.j))
      .map((t, i) => {
        const h = horaires[i];
        return h ? { ...t, heure: h.heure, ou: h.lieu?.nom ?? null, terrain: h.terrain } : t;
      })
      .filter((_, i) => !choisi.matchsIci || choisi.matchsIci.includes(i));
    if (deJournee.length || (choisi.j != null && !choisi.convoquee)) return deJournee;
    return p.equipesVisibles || admin ? feuilleDeConvocation(p.teams) : [];
  }, [choisi, saison.journees, journees, matchsDe, p.equipesVisibles, p.teams, admin]);
  // Les feuilles en direct du dimanche choisi (01/11/2026) : une feuille prise,
  // c'est le coup d'envoi (« le match commence au premier appui »).
  const direct = useFeuillesDirect(choisi?.ligue === "sfl" ? (choisi.j ?? null) : null);
  const enDirect = direct.feuilles.size > 0;
  // La journée en étapes : un dimanche de la ligue seulement.
  const etapesDuChoisi = useMemo<Etape[]>(() => {
    if (!choisi || choisi.ligue !== "sfl") return [];
    const joue = !!choisi.joue;
    const convocation = joue || !!choisi.convoquee || choisi.cle === "convocation" || choisi.presents.length > 0;
    const votesClos = joue && (ecartJours(choisi.dateLabel, aujourdhui) ?? 0) < 0;
    return [
      { nom: "Convocation", sous: convocation && !joue && p.presents.length ? `${p.presents.length} je viens` : "le lundi", faite: convocation },
      { nom: "Les équipes", sous: "vendredi 19 h", faite: joue || feuille.length > 0 },
      { nom: "Coup d'envoi", sous: choisi.heure, faite: joue || enDirect },
      { nom: "Feuille de match", sous: "buts, passes, MVP", faite: joue },
      { nom: "Les votes", sous: "jusqu'à minuit", faite: votesClos },
    ];
  }, [choisi, aujourdhui, feuille.length, p.presents.length, enDirect]);
  // Le tableau de bord du match (31/10) : le grand chiffre, puis la journée en étapes.
  // Avec une feuille, il passe entre les terrains et Le Flair (Sabri, 31/10 : « met-la avant le Flair »).
  const tableauDeBord = choisi && (!choisi.joue || etapesDuChoisi.length > 0) ? (
    <>
      {!choisi.joue && !enDirect && (
        <Rebours
          debut={debutDuChoisi}
          joueurs={choisi.presents.length || (choisi.ligue === "sfl" ? habitues.length : 0)}
          libelleJoueurs={choisi.presents.length || choisi.ligue !== "sfl" ? "joueurs" : "habitués"}
        />
      )}
      {etapesDuChoisi.length > 0 && <FriseDimanche etapes={etapesDuChoisi} />}
    </>
  ) : null;
  // Ta série : tes dimanches J1…Jn (les neuf derniers), joués, manqués ou à venir.
  const maSerie = useMemo(
    () =>
      [...saison.journees]
        .sort((a, b) => a.j - b.j)
        .slice(-9)
        .map((m) => ({ j: m.j, joue: journeeJouee(saison, m.j) ? joueursDeLaFeuille(saison, m.j).noms.includes(player.name) : null })),
    [saison, player.name]
  );

  const communeDuMatch = (surCarte ? proposition?.terrain?.commune : null) || choisi?.terrain?.commune || terrains.find((t) => t.commune)?.commune || "SFL";
  const n = affiches.filter((m) => !m.joue).length;
  const signes = missions ? contratsSignes(missions).length : 0;
  const compteMatchs = enContrats
    ? `${signes} CONTRAT${signes > 1 ? "S" : ""} EN JEU`
    : n
      ? `${n} MATCH${n > 1 ? "S" : ""} OUVERT${n > 1 ? "S" : ""}`
      : "MATCH JOUÉ";
  // Le titre suit le zoom (31/10) : de près la commune, plus loin la zone
  // où l'on est, de très loin Bola tout entier ; il ne ment plus quand on
  // voit la mer du Nord.
  const ouvertes = toutesZones.filter((z) => z.ouverte);
  const zoneIci = !enContrats && vue && vue.zoom < 11 ? (ouvertes.find((z) => dansContour(z.contour, vue.lat, vue.lng)) ?? null) : null;
  const deTresLoin = !enContrats && !!vue && vue.zoom < 7.5 && ouvertes.length > 0;
  const joueursBola = ouvertes.reduce((t, z) => t + z.joueurs, 0);
  const commune = deTresLoin ? "Bola" : zoneIci ? zoneIci.nom : communeDuMatch;
  const compte = deTresLoin
    ? `${ouvertes.length} ZONE${ouvertes.length > 1 ? "S" : ""} · ${joueursBola} JOUEURS`
    : zoneIci
      ? `${zoneIci.joueurs} JOUEURS · ${compteMatchs}`
      : compteMatchs;

  function sauver(next: Saison, message: string) {
    // L'envoi en base suit la sauvegarde : un refus (un autre admin a publié)
    // se dit ici, au lieu de laisser ce téléphone ne plus suivre la base sans
    // le savoir.
    const apres = () => {
      window.removeEventListener(SYNC_EVENT, apres);
      const envoi = dernierEnvoiAuto();
      if (envoi && !envoi.ok) toast.error(envoi.raison ?? "Pas publié en base.", { description: "Admin → Synchro" });
    };
    window.addEventListener(SYNC_EVENT, apres);
    saisieStore.save(next);
    window.dispatchEvent(new Event(SAISIE_EVENT));
    toast.success(message);
  }

  // La fiche du match : la feuille qui monte du bas, comme dans l'app.
  const [fond, setFond] = useState<FondCarte>("plan");
  const ouvrirFiche = (admin = false) => {
    setFicheAdmin(admin);
    setFiche(true);
  };

  // Les surcouches se posent sous l'encoche en haut, au-dessus de la barre
  // d'onglets en bas (qui flotte sur le plan, comme sur l'iPhone).
  // Rien en haut de l'écran (plus d'en-tête, comme dans une app iOS) : le
  // plan prend tout l'écran et les surcouches se posent juste sous l'encoche.
  const haut = "calc(env(safe-area-inset-top, 0px) + var(--sous-entete))";
  const bas = "calc(env(safe-area-inset-bottom, 0px) + 92px)";

  return (
    <AmbianceDuPlan.Provider value={ambiance}>
      {/* ─── Le plan, tout l'écran ─── */}
      <section className="fixed inset-0 isolate overflow-hidden bg-[#e9eae6] [--sous-entete:0.75rem] lg:[--sous-entete:1.25rem]">
        <div className="absolute inset-0">
          <CarteMap
            fond={fond}
            stickers={stickers}
            points={AUCUN_POINT}
            toi={toi}
            trajet={trajetIci?.coords ?? null}
            choisi={surCarte ? null : (choisi?.cle ?? null)}
            onChoisir={(cle) => {
              geste("stade");
              choisirSticker(cle);
            }}
            onBulle={ouvrirDiscussion}
            villes={enContrats || calques.joueurs ? villesVues : AUCUNE_VILLE}
            margeBas={replie || enContrats ? 150 : 380}
            onVille={ouvrirVille}
            onJoueur={toucherJoueur}
            viser={viser}
            cadrerSur={cadrage}
            matchsEnRetrait={enContrats}
            possibles={enContrats ? SANS_POSSIBLES : calques.terrains ? possiblesZones : surCarte ? seulPropose : SANS_POSSIBLES}
            possibleChoisi={enContrats ? null : (leve ?? (surCarte ? (ouPropose?.id ?? null) : null))}
            onPossible={toucherPossible}
            teinteFantome={tonFantomes}
            onVue={voirTerrains}
            zones={enContrats ? AUCUNE_ZONE : zones}
            ambiance={ambiance}
            onZone={(id) => {
              geste("zone");
              setZoneOuverte(id);
            }}
            className="h-full w-full"
          />
        </div>
        {/* Voile en haut : la barre d'état et le lettrage restent lisibles.
            Tout ce qui est posé sur le plan passe au-dessus des calques de
            Leaflet (z-index 400 et plus). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-44 bg-gradient-to-b from-[rgba(8,9,11,0.42)] to-transparent" />

        {/* En haut à gauche : la commune en lettrage, le compte en étiquette */}
        <div className="pointer-events-none absolute left-5 z-[510] flex max-w-[calc(100%-8.5rem)] flex-col items-start" style={{ top: `calc(${haut} + 8px)` }}>
          <span
            key={commune}
            className="lettrage lettrage-entre -rotate-[4deg]"
            style={{ ["--taille" as string]: commune.length <= 7 ? "34px" : commune.length <= 10 ? "28px" : commune.length <= 13 ? "22px" : "17px" }}
          >
            {commune}
          </span>
          <span
            key={compte}
            className="compte-entre -mt-1 ml-2.5 inline-flex h-[19px] rotate-[3deg] items-center rounded-full border-[1.5px] px-2 font-mono text-[9px] font-bold tracking-[1.2px] shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            style={{ background: ENCRE, color: BLANC, borderColor: BLANC }}
          >
            {compte}
          </span>
        </div>

        {/* En haut à droite : la loupe (la Recherche, montée de la barre
            d'onglets le 19/10) et le menu de la Map (24/10, map/menu-map.tsx) :
            ce qu'elle montre, en interrupteurs (les joueurs, les terrains
            libres et leur format, les contrats du dimanche, le satellite), les
            raccourcis et, pour l'admin, ses réglages. Les contrats allumés,
            leur viseur reste dessous pour les éteindre d'un toucher. Le
            lettrage garde sa place. La colonne passe devant la rangée du bas :
            le menu ouvert la recouvre. */}
        <div data-traverse className="absolute right-4 z-[520] flex flex-col items-end gap-2" style={{ top: haut }}>
          <Link
            href="/recherche"
            aria-label="Recherche"
            className="bouton-givre map-bord map-touche grid size-10 place-items-center"
          >
            <Search className="size-[18px]" strokeWidth={2.2} />
          </Link>
          <MenuMap
            filtre={!calques.joueurs || (libres.length > 0 && (!calques.terrains || formatTerrain != null)) || fond === "satellite" || enContrats}
            bascules={[
              {
                id: "joueurs",
                libelle: "Les joueurs",
                icone: <IdCard className="size-[19px]" strokeWidth={2} />,
                actif: calques.joueurs,
                onChange: (v) => montrerCalque("joueurs", v),
              },
              ...(libres.length > 0
                ? [
                    {
                      id: "terrains",
                      libelle: "Les terrains libres",
                      icone: <IconeTerrain className="size-[19px]" />,
                      actif: calques.terrains,
                      onChange: (v: boolean) => montrerCalque("terrains", v),
                      dessous: <PucesFormat sur="plan" comptes={comptesFormats} />,
                    },
                  ]
                : []),
              ...(!sansSfl && cibles.size > 0
                ? [
                    {
                      id: "contrats",
                      libelle: "Les contrats en jeu",
                      icone: <Crosshair className="size-[18px]" strokeWidth={2.2} />,
                      actif: contrats,
                      onChange: () => basculerContrats(),
                    },
                  ]
                : []),
              {
                id: "satellite",
                libelle: "Vue satellite",
                icone: <Layers className="size-[18px]" strokeWidth={2.2} />,
                actif: fond === "satellite",
                onChange: (v) => setFond(v ? "satellite" : "plan"),
              },
            ]}
            raccourcis={[
              ...(!sansSfl && (villes.length > 0 || !!me)
                ? [
                    {
                      id: "catalogue",
                      libelle: "Les joueurs, ville par ville",
                      icone: <Users className="size-[18px]" strokeWidth={2.2} />,
                      ton: "#5b2141",
                      onClick: () => {
                        setFocusVilles(null);
                        setCatalogue(true);
                      },
                    },
                  ]
                : []),
              ...(partiesActives && DISPOS_AFFICHEES
                ? [{ id: "dispos", libelle: "Mes dispos", icone: <CalendarDays className="size-[18px]" strokeWidth={2.2} />, ton: "#24452a", onClick: () => setDispos(true) }]
                : []),
            ]}
            admin={
              admin
                ? [
                    { id: "activite", libelle: "Activité et rétention", icone: <ChartSpline className="size-[18px]" strokeWidth={2.2} />, href: "/admin/activite" },
                    { id: "matchs", libelle: "Matchs et terrains", icone: <Settings2 className="size-[18px]" strokeWidth={2.2} />, onClick: () => ouvrirFiche(true) },
                    { id: "journee", libelle: "La journée", icone: <ClipboardPen className="size-[18px]" strokeWidth={2.2} />, href: "/admin" },
                  ]
                : []
            }
          />
          {enContrats && (
            <button
              type="button"
              onClick={basculerContrats}
              aria-label="Revoir tous les joueurs"
              aria-pressed
              className="bouton-encre map-bord map-touche grid size-10 place-items-center"
            >
              <Crosshair className="size-[18px]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* En bas : les boutons, les cartes des matchs, les pastilles. Leurs
            rangées sont transparentes et prennent toute la largeur : marquées
            `data-traverse` (comme la colonne des boutons), elles laissent la
            molette, le pincement et le glisser de la souris au plan, sur
            ordinateur (map/gestes-ordinateur.ts). */}
        <div data-traverse className="absolute inset-x-0 z-[510] flex flex-col items-center gap-3" style={{ bottom: bas }}>
          <InvitationsEquipe invitations={invitationsEquipe} moi={moi} />
          <Invitations invitations={invitations} onOuvrir={(p) => choisirSticker(`m${p.id}`)} />
          <div data-traverse className="flex w-full items-center justify-between gap-2 px-4">
            {/* Une seule rangée de boutons ronds au-dessus du carrousel (31/10 :
                le bas de l'écran rend la carte). À gauche replier les matchs ;
                à droite ouvrir un match, le geste principal, en « + » vert
                (la raison qu'elle propose est sur la dernière carte du
                carrousel), puis revenir sur soi. */}
            {(affiches.length > 0 || proposition) && !enContrats ? (
              <button
                type="button"
                onClick={basculerCarrousel}
                aria-label={replie ? "Montrer les matchs" : "Cacher les matchs"}
                aria-expanded={!replie}
                className="bouton-givre map-monte map-touche grid size-11 place-items-center"
              >
                {replie ? <ChevronUp className="size-[18px]" strokeWidth={2.4} /> : <ChevronDown className="size-[18px]" strokeWidth={2.4} />}
              </button>
            ) : (
              <span />
            )}
            <div data-traverse className="flex items-center gap-2">
              {partiesActives ? (
                <button
                  type="button"
                  onClick={() => {
                    geste("ouvrir");
                    ouvrirPropose();
                  }}
                  aria-label={sousOuvrir ? `Ouvrir un match, ${sousOuvrir.toLowerCase()}` : "Ouvrir un match"}
                  className="bouton-encre bouton--vert map-monte map-touche grid size-11 place-items-center"
                >
                  <Plus className="size-5" strokeWidth={3} />
                </button>
              ) : (
                admin && (
                  <Link href="/admin" aria-label="Ouvrir un match" className="bouton-encre bouton--vert map-monte map-touche grid size-11 place-items-center">
                    <Plus className="size-5" strokeWidth={3} />
                  </Link>
                )
              )}
              <button
                type="button"
                onClick={localiser}
                aria-label={toi ? "Revenir sur toi" : "Activer la localisation"}
                className="bouton-givre map-monte map-touche grid size-11 place-items-center"
              >
                <LocateFixed className={cn("size-4", cherchePosition && "animate-pulse")} strokeWidth={2.4} />
              </button>
            </div>
          </div>

          {/* Le carrousel : une carte par match, celle du centre est la choisie.
              Toucher la choisie ouvre sa fiche. Replié, il descend et s'efface. */}
          <div
            data-traverse
            className={cn("grid w-full transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none", replie || enContrats ? "pointer-events-none grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}
            aria-hidden={replie || enContrats}
          >
          <div data-traverse className="flex min-h-0 flex-col items-center gap-3 overflow-hidden">
          <div
            ref={carrousel}
            onScroll={suivreCarrousel}
            data-traverse
            className="flex w-full snap-x snap-mandatory items-end gap-3 overflow-x-auto pr-[max(1rem,calc(50%-103px))] pb-[18px] [scrollbar-width:none]"
            style={{ paddingLeft: `max(1rem, calc(50% - ${affiches[0]?.joue ? LARGEUR_JOUE / 2 + 5 : 103}px))` }}
          >
            {affiches.map((m, i) => (
              <div key={m.cle} data-cle={m.cle} className="map-monte shrink-0 snap-center" style={{ ["--i" as string]: i + 1 }}>
                <CarteMatch
                  m={m}
                  choisi={m.cle === choisi?.cle}
                  une={m.cle === une?.cle && !m.joue}
                  affiche={afficheDu(m)}
                  dans={m.joue ? null : ecartJours(m.dateLabel, aujourdhui)}
                  loin={toi && m.terrain ? `à ${distanceLisible(toi, m.terrain)}` : null}
                  nonLus={m.partie ? (apercus.get(m.partie.id)?.nonLus ?? 0) : 0}
                  onToucher={() => (m.cle !== choisi?.cle || surCarte ? setChoix(m.cle) : ouvrirFiche())}
                />
              </div>
            ))}
            {/* Au bout, le match que la Map propose d'ouvrir : un premier
                toucher la choisit (le plan montre son terrain), le second
                ouvre la feuille remplie. */}
            {proposition && (
              <div data-cle="proposition" className="map-monte shrink-0 snap-center" style={{ ["--i" as string]: affiches.length + 1 }}>
                <CarteProposee
                  moment={proposition.moment}
                  terrain={proposition.terrain}
                  titre={proposition.moment ? quand(libelleJour(proposition.moment.jour), null, aujourdhui).titre : "Ton match"}
                  choisie={surCarte}
                  loin={toi && proposition.terrain ? `à ${distanceLisible(toi, proposition.terrain)}` : null}
                  ouvreZone={zoneProposee}
                  onToucher={() => (surCarte ? ouvrirPropose() : setSurProposition(true))}
                />
              </div>
            )}
          </div>

          {surCarte ? (
            // Sur la carte proposée : son terrain, qui ouvre sa fiche (le bouton du dessus ouvre le match).
            <div data-traverse className="flex max-w-full items-center gap-2 px-4">
              {ouPropose && (
                <button
                  type="button"
                  onClick={() => toucherPossible(ouPropose.id)}
                  className="bouton-givre flex h-[30px] min-w-0 items-center gap-[7px] px-3.5"
                >
                  <span className="size-2 shrink-0 rounded-full border-[1.5px]" style={{ borderColor: ENCRE }} />
                  <span className="truncate text-[13px] font-semibold tracking-[-0.2px]">{lieuDuTerrain(ouPropose)}</span>
                </button>
              )}
            </div>
          ) : choisi && (
            <div data-traverse className="flex max-w-full items-center gap-2 px-4">
              {choisi.terrain ? (
                <>
                  {/* Le match du dimanche s'accepte d'ici (31/10) : « Je viens »,
                      puis « Tu viens » une fois dit. Le nom du terrain est déjà
                      sur son stade et sur la carte. */}
                  {repondreIci &&
                    (p.mine === "present" ? (
                      <span className="flex h-[30px] items-center gap-[5px] rounded-full px-3 text-[12.5px] font-semibold" style={{ background: ENCRE, color: BLANC }}>
                        <Check className="size-3" strokeWidth={3} /> Tu viens
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.vibrate?.(10);
                          geste("je-viens");
                          void p.answer("present");
                        }}
                        className="bouton-encre flex h-[30px] shrink-0 items-center gap-[5px] px-3.5 text-[12.5px] font-semibold"
                      >
                        Je viens
                      </button>
                    ))}
                  <a
                    href={urlItineraire(choisi.terrain, ios)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => geste("y-aller")}
                    className="bouton-givre bouton--vert flex h-[30px] shrink-0 items-center gap-[5px] px-3 text-[12.5px] font-semibold"
                  >
                    <Navigation className="size-[11px]" strokeWidth={2.6} /> Y aller{trajetIci ? ` · ${dureeLisible(trajetIci.minutes)}` : ""}
                  </a>
                </>
              ) : choisi.partie ? (
                <button
                  type="button"
                  onClick={() => ouvrirFiche()}
                  className="bouton-givre flex h-[30px] items-center px-3.5 text-[13px] font-semibold"
                >
                  {choisi.partie.lieu}
                </button>
              ) : admin ? (
                <button
                  type="button"
                  onClick={() => ouvrirFiche(true)}
                  className="bouton-principal bouton--braise flex h-[30px] items-center gap-[7px] px-3.5 text-[13px] font-semibold"
                >
                  <MapPin className="size-3.5" strokeWidth={2.4} /> Donner l&apos;adresse du match
                </button>
              ) : (
                <span className="flex h-[30px] items-center rounded-full px-3.5 text-[13px] font-semibold shadow-[0_3px_6px_rgba(0,0,0,0.14)]" style={{ background: BLANC, color: ENCRE }}>
                  Lieu à venir
                </span>
              )}
            </div>
          )}
          </div>
          </div>
        </div>
      </section>

      {/* ─── Les réglages des matchs (admin) : la feuille du bas, comme avant ─── */}
      <Sheet open={fiche && ficheAdmin} onOpenChange={(o) => { setFiche(o); if (!o) setFicheAdmin(false); }} titre="les matchs">
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <SheetTitle className="text-[26px] font-bold tracking-tight">Les matchs</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4">
            {/* L'admin écrit depuis le document entier, brouillons compris
                (saisie/brouillon.ts) : jamais depuis la saison des joueurs. */}
            <OuSeJouent saison={saisieStore.load()} matchs={ligue} terrains={terrains} matchsDe={matchsDe} onSauver={sauver} />
            <Terrains saison={saisieStore.load()} terrains={terrains} onSauver={sauver} />
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── La page d'un lieu (Sabri, 31/10, d'après une app de souvenirs
          sur carte) : toucher un match l'ouvre en grand depuis l'endroit
          touché, un écran enfant plein écran avec son retour. En tête le
          lieu en lettrage, ses matchs en carrousel (les précédents à gauche,
          le prochain à droite), puis tout ce qu'il y a à savoir du match
          choisi ; le geste du moment est en bas, sous le pouce. ─── */}
      <Sheet open={fiche && !ficheAdmin} onOpenChange={setFiche} titre={choisi?.terrain?.nom ?? "le match"}>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="page-lieu top-0 duration-[380ms] ease-[cubic-bezier(0.2,0.85,0.25,1)] h-[100dvh] origin-[var(--lieu-x,50%)_var(--lieu-y,50%)] max-h-none gap-0 overflow-y-auto rounded-none border-0 bg-background data-starting-style:scale-[0.55] data-ending-style:scale-[0.55] data-[side=bottom]:data-starting-style:translate-y-0 data-[side=bottom]:data-ending-style:translate-y-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{choisi?.terrain?.nom ?? choisi?.partie?.lieu ?? "Le match"}</SheetTitle>
          </SheetHeader>
          {choisi && (
            <div className="relative flex shrink-0 flex-col items-center px-4 pt-[calc(env(safe-area-inset-top,0px)+10px)]">
              <BoutonRetour onRetour={() => setFiche(false)} titre="la Map" className="absolute left-4 top-[calc(env(safe-area-inset-top,0px)+10px)]" />
              {(() => {
                const nom = choisi.terrain?.nom ?? choisi.partie?.lieu ?? choisi.team?.defi.lieu ?? (choisi.j != null ? `Journée ${choisi.j}` : "Le match");
                return (
                  <span
                    className="lettrage mt-12 max-w-full -rotate-[3deg] text-center"
                    style={{ ["--taille" as string]: nom.length <= 9 ? "34px" : nom.length <= 13 ? "27px" : "21px" }}
                  >
                    {nom}
                  </span>
                );
              })()}
              <p className="mono-label mt-2 flex items-center gap-2 text-muted-foreground">
                <SigleLigue ligue={choisi.ligue} hauteur={10} className="text-foreground" />
                <span>
                  {auLieu.length > 1 ? `${auLieu.length} matchs ici` : choisi.partie ? `Ouvert par ${choisi.partie.organisateur}` : choisi.team ? "Match d'équipe" : "1 match ici"}
                  {choisi.terrain?.commune ? ` · ${choisi.terrain.commune}` : ""}
                </span>
              </p>
              {(() => {
                const noms = [...new Set(auLieu.flatMap((m) => m.presents))].slice(0, 5);
                return noms.length > 0 ? <span className="mt-3"><Visages noms={noms} /></span> : null;
              })()}
            </div>
          )}
          {/* Les matchs du lieu : on glisse de l'un à l'autre, le choisi au centre. */}
          {choisi && auLieu.length > 1 && (
            <div className="mt-5 flex shrink-0 snap-x snap-mandatory items-center gap-1 overflow-x-auto px-[calc(50%-150px)] py-3 [scrollbar-width:none]">
              {auLieu.map((m) => (
                <div
                  key={m.cle}
                  data-lieu-choisi={m.cle === choisi.cle || undefined}
                  className="shrink-0 snap-center"
                >
                  <CarteMatch
                    m={m}
                    choisi={m.cle === choisi.cle}
                    une={false}
                    grand
                    affiche={afficheDu(m)}
                    dans={m.joue ? null : ecartJours(m.dateLabel, aujourdhui)}
                    loin={null}
                    nonLus={m.partie ? (apercus.get(m.partie.id)?.nonLus ?? 0) : 0}
                    onToucher={() => {
                      navigator.vibrate?.(5);
                      setChoix(m.cle);
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          {/* La carte dit déjà le jour et l'heure ; dessous, seulement la division du dimanche. */}
          {choisi && surtitreDeLigue(jDuChoisi) && <p className="mono-label mt-2 shrink-0 text-center text-foreground">{surtitreDeLigue(jDuChoisi)}</p>}
          <div className="mt-5 flex shrink-0 flex-col gap-5 px-4 pb-32">
                {/* Les terrains de la journée d'abord, en carrousel (Sabri, 31/10 : « qu'on le voie dès qu'on arrive »). */}
                {choisi && feuille.length > 0 && (
                  <FeuilleDeMatch
                    key={choisi.cle}
                    terrains={feuille}
                    moi={player.name}
                    j={choisi.j ?? null}
                    avantFlair={tableauDeBord}
                    // La feuille en direct de ce match, prise par un de ses joueurs (01/11/2026).
                    sousTerrain={
                      choisi.ligue === "sfl" && choisi.j != null
                        ? (t) => (t.equipes ? <DirectDuMatch key={`${choisi.j}-${t.equipes.join("-")}`} j={choisi.j!} equipes={t.equipes} label={t.label === "Le match" ? "Match 1" : t.label} direct={direct} /> : null)
                        : undefined
                    }
                    entete={{
                      surtitre: `${choisi.j != null ? `J${choisi.j} · ` : ""}Sunday Five League`,
                      jour: dateComplete(choisi.dateLabel, aujourdhui),
                      heure: choisi.heure,
                      ou: choisi.terrain ? choisi.terrain.nom : null,
                    }}
                  />
                )}
                {/* Avec une feuille, le tableau de bord passe entre les terrains et Le Flair (Sabri, 31/10). */}
                {choisi && feuille.length === 0 && tableauDeBord}
                {/* Les joueurs d'abord, la feuille de match tout de suite dessous
                    (Sabri, 24/10 : plus de vue satellite en tête de la fiche) ;
                    le chemin pour y aller vient après. Une journée : ses
                    joueurs. La convocation : on y répond, comme avant. */}
                {choisi?.partie ? (
                  <FichePartie
                    partie={choisi.partie}
                    moi={moi}
                    terrains={terrains}
                    onChange={recharger}
                    nonLus={apercus.get(choisi.partie.id)?.nonLus ?? 0}
                    onDiscussion={() => ouvrirDiscussion(choisi.cle)}
                  />
                ) : choisi?.team ? (
                  <FicheTeam t={choisi.team} />
                ) : choisi?.j != null && !choisi.convoquee ? (
                  <Presents m={choisi} habitues={habitues} />
                ) : (
                  <PresencePanel />
                )}
                {choisi && feuille.length > 0 && <DuelsDuJour j={choisi.j} matchs={choisi.matchsIci} />}
                {/* La météo au coup d'envoi (Sabri, 24/10 : « à telle heure, ce
                    que ça prévoit »), en une ligne depuis le 31/10 : les gens
                    d'abord, le ciel ensuite, juste avant la route. */}
                {choisi?.ligue === "sfl" && <SerieDimanches jours={maSerie} />}
                {choisi && !choisi.joue && choisi.terrain && (
                  <MeteoMatch
                    key={choisi.cle}
                    lat={choisi.terrain.lat}
                    lng={choisi.terrain.lng}
                    date={dateIsoDuMatch(choisi, aujourdhui)}
                    heure={choisi.heure}
                    aujourdhui={aujourdhui}
                    taille="ligne"
                  />
                )}
                {choisi?.terrain && <Itineraire terrain={choisi.terrain} ios={ios} autres />}
                {admin && !choisi?.partie && !choisi?.team && (
                  <button
                    type="button"
                    onClick={() => ouvrirFiche(true)}
                    className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-[14px] font-semibold"
                  >
                    <Settings2 className="size-4" /> Date, heure et adresse des matchs
                  </button>
                )}
          </div>
          {/* Le geste du moment, en bas sous le pouce : venir, y aller, ou revoir le dimanche. */}
          {choisi && (
            <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex items-center justify-end gap-2 bg-gradient-to-t from-background via-background/90 to-transparent px-4 pt-8 pb-[calc(env(safe-area-inset-bottom,0px)+14px)]">
              {choisi.partie && (
                <button
                  type="button"
                  onClick={() => ouvrirDiscussion(choisi.cle)}
                  className="bouton-secondaire pointer-events-auto mr-auto flex h-12 items-center gap-2 px-4 text-[14px] font-semibold"
                >
                  <MessageCircle className="size-4" /> Discussion
                </button>
              )}
              {choisi.joue ? (
                <Link
                  href={choisi.j !== null ? `/ligue#j${choisi.j}` : "/ligue"}
                  className="bouton-principal pointer-events-auto flex h-12 items-center gap-2 px-6 text-[15px] font-semibold"
                >
                  Le récap
                </Link>
              ) : repondreIci && p.mine !== "present" ? (
                <button
                  type="button"
                  onClick={() => {
                    navigator.vibrate?.(10);
                    geste("je-viens", { depuis: "lieu" });
                    void p.answer("present");
                  }}
                  className="bouton-encre pointer-events-auto flex h-12 items-center gap-2 px-6 text-[15px] font-semibold"
                >
                  Je viens
                </button>
              ) : choisi.terrain ? (
                <>
                  {repondreIci && (
                    <span className="flex h-12 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold" style={{ background: ENCRE, color: BLANC }}>
                      <Check className="size-4" strokeWidth={3} /> Tu viens
                    </span>
                  )}
                  <a
                    href={urlItineraire(choisi.terrain, ios)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => geste("y-aller", { depuis: "lieu" })}
                    className="bouton-principal bouton--vert pointer-events-auto flex h-12 items-center gap-2 px-6 text-[15px] font-semibold"
                  >
                    <Navigation className="size-4" /> Y aller{trajetIci ? ` · ${dureeLisible(trajetIci.minutes)}` : ""}
                  </a>
                </>
              ) : null}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Une zone Bola : son récit (30/10) ─── */}
      <Sheet open={!!zoneVue} onOpenChange={(o) => !o && setZoneOuverte(null)} titre="la zone">
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          {zoneVue && (
            <RecitZone
              zone={zoneVue}
              dimanches={dimanches}
              ouvrir={partiesActives}
              onOuvrir={() => {
                setZoneOuverte(null);
                setOuvrir((o) => ({ terrain: null, n: (o?.n ?? 0) + 1 }));
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* ─── Les joueurs, ville par ville ─── */}
      <Sheet open={catalogue} onOpenChange={setCatalogue} fenetreRef={fenetreCatalogue} titre="les joueurs">
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <p className="mono-label text-muted-foreground">
              {villes.reduce((s, v) => s + v.joueurs.length, 0)} joueurs · {villes.length} ville{villes.length > 1 ? "s" : ""}
            </p>
            <SheetTitle className="text-[26px] font-bold tracking-tight">{nomFocus ?? "Les joueurs"}</SheetTitle>
          </SheetHeader>
          <div className="px-4">
            <CatalogueJoueurs
              villes={villes}
              focus={focusVilles}
              onFocus={setFocusVilles}
              me={me}
              chercherVille={chercherVille}
              onJoueur={(nom) => fenetreCatalogue.current?.poser(<FeuilleProfil nom={nom} />, "son profil")}
              onVoir={(v) => {
                setCatalogue(false);
                setViser((x) => ({ lat: v.lat, lng: v.lng, n: (x?.n ?? 0) + 1 }));
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      <CollectionPile
        villes={villesPile}
        masquee={!!profil || !!cible}
        onFermer={fermerPile}
        onJoueur={toucherJoueur}
        onVoir={(v) => {
          setPile(null);
          setViser((x) => ({ lat: v.lat, lng: v.lng, n: (x?.n ?? 0) + 1 }));
        }}
      />

      {/* ─── Les contrats sur une cible, avec le filtre Contrats ─── */}
      {/* Ouverts depuis la pile de joueurs, les contrats et le profil y
          ramènent par leur retour ; leur croix ferme aussi la pile. */}
      <ContratsSur
        nom={cible}
        lg={missions}
        onFermer={() => {
          setCible(null);
          fermerPile();
        }}
        onRetour={pile ? () => setCible(null) : undefined}
      />

      {/* ─── Le profil d'un joueur touché sur la Map ou dans le catalogue ─── */}
      <Sheet
        open={!!profilJoueur}
        onOpenChange={(o) => {
          if (o) return;
          setProfil(null);
          fermerPile();
        }}
        titre="son profil"
      >
        <SheetContent
          side="bottom"
          onRetour={pile ? () => setProfil(null) : undefined}
          className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{profilJoueur ? nomAffiche(profilJoueur.name) : "Profil"}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pt-5">{profilJoueur && <ProfilJoueur key={profilJoueur.name} player={profilJoueur} rank={rangs.get(profilJoueur.name) ?? players.length} />}</div>
        </SheetContent>
      </Sheet>

      {/* ─── Un terrain possible : sa fiche, et les deux façons d'y jouer ─── */}
      <Sheet
        open={ficheLibre}
        onOpenChange={(o) => {
          setFicheLibre(o);
          if (!o) setLeve(null);
        }}
      >
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <p className="mono-label flex items-center gap-2 text-muted-foreground">
              {libre?.ligue != null && <SigleLigue ligue="sfl" hauteur={11} className="text-foreground" />}
              <span className="min-w-0 truncate">{[libre?.commune, libre && toi ? `à ${distanceLisible(toi, libre)}` : null].filter(Boolean).join(" · ")}</span>
            </p>
            <SheetTitle className="text-[26px] leading-tight font-bold tracking-tight">{libre?.nom}</SheetTitle>
            {libre && surPlace(libre) && <p className="mono-label text-muted-foreground">{surPlace(libre)}</p>}
          </SheetHeader>
          {libre && (
            <FicheLibre
              t={libre}
              ios={ios}
              defi={defiDepuisTerrain}
              ouvrir={partiesActives}
              source={sourcesCitees(indexTerrains, [libre]).join(" · ") || null}
              zone={zoneDuLibre}
              onOuvrir={() => {
                setFicheLibre(false);
                setLeve(null);
                const ligue = libre.ligue != null ? (terrains.find((x) => x.id === libre.ligue) ?? null) : null;
                setOuvrir((o) => ({
                  terrain: ligue,
                  lieu: ligue ? undefined : { lieu: lieuDuTerrain(libre), adresse: libre.adresse, lat: libre.lat, lng: libre.lng, terrain: libre },
                  n: (o?.n ?? 0) + 1,
                }));
              }}
            />
          )}
        </SheetContent>
      </Sheet>

      {ouvrir && (
        <OuvrirMatch
          key={ouvrir.n}
          open
          onOpenChange={(o) => !o && setOuvrir(null)}
          terrains={terrains}
          terrainInitial={ouvrir.terrain}
          lieuInitial={ouvrir.lieu}
          jourInitial={ouvrir.jour}
          heureInitial={ouvrir.heure}
          moi={moi}
          ici={toi}
          sansTerrainParDefaut={sansSfl}
          onSfl={
            admin
              ? () => {
                  setOuvrir(null);
                  setFicheAdmin(true);
                  setFiche(true);
                }
              : undefined
          }
          onOuvert={(id) => {
            recharger();
            setChoix(`m${id}`);
            aMontrer.current = { cle: `m${id}`, discussion: false };
          }}
        />
      )}
      {DISPOS_AFFICHEES && (
        <MesDispos
          open={dispos}
          onOpenChange={setDispos}
          moi={moi}
          onOuvrir={(jour, h) => {
            setDispos(false);
            setOuvrir((o) => ({ terrain: null, jour, heure: h, n: (o?.n ?? 0) + 1 }));
          }}
        />
      )}

      {/* ─── La discussion d'un match, par-dessus tout (barre d'onglets comprise) ─── */}
      {discussion && (partieDiscussion || discussion.onglet === "equipe") && (
        <DiscussionMatch
          key={discussion.match ?? "equipe"}
          partie={partieDiscussion ?? null}
          moi={moi}
          ongletInitial={discussion.onglet}
          onFermer={fermerDiscussion}
        />
      )}
    </AmbianceDuPlan.Provider>
  );
}

/* ------------------------- La carte d'un match ------------------------- */

/** L'ambiance du plan, pour que les cartes dessinent leur terrain comme la Map. */
const AmbianceDuPlan = createContext<Ambiance>("classique");

/** Le vrai terrain dessiné : noir au tableau de bord, crème sinon. */
function TerrainDessine(props: { lat: number; lng: number; titre?: string; className?: string }) {
  const a = useContext(AmbianceDuPlan);
  return <VueTerrain {...props} ambiance={a === "nuit-encre" ? "nuit-encre" : "classique"} />;
}

/** La carte du match joué, en retrait : plus petite, en gris. */
const LARGEUR_JOUE = 150;

/** « dans 6 j », « demain » : ce qu'il reste avant le coup d'envoi. */
function compteARebours(dans: number | null): string | null {
  if (dans == null || dans < 1) return null;
  return dans === 1 ? "demain" : `dans ${dans} j`;
}

function CarteMatch({
  m,
  choisi,
  une,
  dans,
  loin,
  nonLus = 0,
  affiche,
  grand = false,
  onToucher,
}: {
  m: MatchMap;
  choisi: boolean;
  /** Son affiche : les deux meilleures notes, à la place du terrain. */
  affiche?: Affiche | null;
  /** Dans la page du lieu : la carte en grand, l'affiche bien visible (Sabri, 31/10). */
  grand?: boolean;
  /** Le prochain match : la une de la Map, avec ses places. */
  une: boolean;
  /** Les jours avant le match (null : joué ou date illisible). */
  dans: number | null;
  loin: string | null;
  /** Les messages de sa discussion que je n'ai pas lus. */
  nonLus?: number;
  onToucher: () => void;
}) {
  const [c0, c1, c2] = COULEUR_LIGUE[m.ligue].fond;
  const complet = m.etat.genre === "complet";
  const inscrits = m.etat.genre === "inscrits";
  const joue = !!m.joue;
  const titre = m.quand.titre;
  // « demain » ne se répète pas quand le titre le dit déjà (31/10).
  const reste = compteARebours(dans);
  const rebours = reste && reste.toLowerCase() !== titre.toLowerCase() ? reste : null;
  const [l, h] = grand ? (joue ? [216, 150] : [300, 200]) : joue ? [LARGEUR_JOUE, 104] : [196, 140];
  // Les places d'un match ouvert par un joueur : une encoche par joueur
  // attendu ; les vides sont celles qu'il manque, en braise. Une journée de
  // ligue n'a pas de plafond : pas de jauge, le compte des participants.
  const places = joue || !m.partie ? 0 : Math.min(m.effectif, 14);
  const venus = Math.min(m.presents.length, places);
  // Les places vides prennent la couleur de ce qu'il manque : rouge, ou la braise.
  const manque = m.remplissage ? COULEUR_REMPLISSAGE[m.remplissage] : BRAISE;
  return (
    <div className={cn("carte-match relative", choisi && "carte-match--choisie", joue && "carte-match--joue")}>
      <button
        type="button"
        onClick={onToucher}
        className={cn("block p-[5px] text-left", joue ? "rounded-[20px] shadow-[0_5px_9px_rgba(0,0,0,0.18)]" : "rounded-[24px] shadow-[0_8px_12px_rgba(0,0,0,0.22)]")}
        style={{ background: BLANC }}
        aria-label={`${titre} ${m.heure}${m.terrain ? `, ${m.terrain.nom}` : ""}, ${m.etatTexte}${nonLus ? `, ${nonLus} message${nonLus > 1 ? "s" : ""} pas lu${nonLus > 1 ? "s" : ""}` : ""}`}
        aria-pressed={choisi}
      >
        <div
          className={cn("relative overflow-hidden", joue ? "rounded-[15px]" : "rounded-[19px]")}
          style={{ width: l, height: h, background: `linear-gradient(180deg, ${c0}, ${c1} 50%, ${c2})` }}
        >
          {affiche ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={affiche.image} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[50%_30%]" draggable={false} />
          ) : m.terrain ? (
            // Le vrai terrain, dessiné et vu un peu de haut (31/10 : plus de satellite).
            <TerrainDessine lat={m.terrain.lat} lng={m.terrain.lng} className={cn("absolute inset-0 h-full w-full", joue && "grayscale")} />
          ) : (
            <div
              className={cn("absolute top-1/2 left-1/2 size-[118px] -translate-x-1/2 -translate-y-[calc(50%+14px)]", joue && "saturate-0")}
              dangerouslySetInnerHTML={{ __html: stadeSvg(m.quand.moment, { fond: false, ligue: m.ligue }) }}
            />
          )}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 bg-gradient-to-b from-transparent via-[rgba(4,5,7,0.4)] to-[rgba(3,4,6,0.82)]",
              une || inscrits ? "h-[78%]" : "h-[62%]"
            )}
          />
          <div className={cn("absolute inset-x-0 top-0 flex items-center justify-between gap-1", joue ? "p-2" : "p-2.5")}>
            {/* Une journée de ligue : le compte des participants va en bas, en grand. */}
            {!inscrits && <Jeton texte={m.etatTexte} ton={m.etat.genre} couleur={m.remplissage && COULEUR_REMPLISSAGE[m.remplissage]} petit={joue} />}
            {!joue && (loin || rebours) && <Jeton texte={loin ?? rebours!} ton="neutre" />}
          </div>
          <div className={cn("absolute inset-x-0 bottom-0", joue ? "px-2.5 pb-2.5" : "px-3 pb-3")}>
            <p
              className="truncate font-black uppercase text-white/85"
              style={{ fontSize: joue ? 22 : titre.length > 10 ? 22 : titre.length > 7 ? 28 : 34, letterSpacing: joue ? -0.9 : -1.4, lineHeight: 1 }}
            >
              {titre}
            </p>
            <p className={cn("mt-1 flex items-center gap-1.5 font-mono font-bold text-white/70 uppercase", joue ? "text-[8.5px] tracking-[0.8px]" : "text-[9.5px] tracking-[1px]")}>
              {/* La ligue du match, par son sigle (SFL, Bola, Team). */}
              <SigleLigue ligue={m.ligue} hauteur={joue ? 8 : 9.5} className="text-white/90" />
              <span className="min-w-0 truncate">
                {[
                  heureCourte(m.heure),
                  m.partie
                    ? `${m.partie.visibilite === "prive" ? "Privé" : "Public"} · ${m.partie.organisateur}`
                    : m.team
                      ? `${m.team.de.nom} – ${m.team.a.nom}`
                      : m.j != null
                        ? `J${m.j}`
                        : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </p>
            {inscrits && (
              <p className="mt-1.5 flex items-baseline gap-1.5 text-white">
                {m.presents.length > 0 ? (
                  <>
                    <span className="text-[20px] leading-none font-black tracking-[-0.6px] tabular-nums">{m.presents.length}</span>
                    <span className="text-[12px] font-semibold text-white/85">participant{m.presents.length > 1 ? "s" : ""} déjà</span>
                  </>
                ) : (
                  <span className="text-[12px] font-semibold text-white/85">{m.etatTexte}</span>
                )}
              </p>
            )}
            {une && places > 0 && (
              <div className="mt-2 flex gap-[3px]" aria-hidden>
                {Array.from({ length: places }, (_, i) => (
                  <span
                    key={i}
                    className={cn("h-[5px] flex-1 rounded-full", i >= venus && "places-vide")}
                    style={
                      i < venus
                        ? { background: "rgba(255,255,255,0.9)" }
                        : {
                            background: complet ? "rgba(255,255,255,0.25)" : `color-mix(in srgb, ${manque} 30%, transparent)`,
                            boxShadow: complet ? undefined : `inset 0 0 0 1px ${manque}`,
                            ["--i" as string]: i - venus,
                          }
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
      {/* Des messages pas lus dans sa discussion : leur nombre, comme sur une
          icône d'iPhone. */}
      {nonLus > 0 && (
        <span
          aria-hidden
          className="pointer-events-none absolute -top-1.5 -right-1.5 z-10 flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] leading-none font-bold text-white tabular-nums"
          style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${BLANC}, 0 2px 4px rgba(0,0,0,0.25)` }}
        >
          {nonLus > 9 ? "9+" : nonLus}
        </span>
      )}
      {!joue && <CartesSous noms={m.presents} />}
    </div>
  );
}

/**
 * Sous une carte du carrousel, ceux qui viennent (ou qui sont libres) : leurs
 * cartes en mini, comme les visages de « Suivi par » (Sabri, 24/10 : « Fais
 * en sorte qu'on voie leurs cartes ici en mini, comme t'as fait quand t'as un
 * follower »), puis le compte des autres.
 */
function CartesSous({ noms }: { noms: string[] }) {
  if (!noms.length) return null;
  return (
    <div className="pointer-events-none absolute -bottom-4 left-1/2 flex -translate-x-1/2 items-center drop-shadow-[0_1px_2px_rgba(0,0,0,0.2)]" aria-hidden>
      <Visages noms={noms.slice(0, 3)} clair />
      {noms.length > 3 && (
        <span
          className="relative -ml-[9px] flex h-[26px] items-center rounded-full pr-2 pl-[11px] text-[10px] font-bold tabular-nums ring-2 ring-[#f2f1ee]"
          style={{ background: ENCRE, color: BLANC }}
        >
          +{noms.length - 3}
        </span>
      )}
    </div>
  );
}

/**
 * Le match que la Map propose d'ouvrir, au bout du carrousel : le cadre des
 * cartes de match, le terrain vu du ciel, mais un pointillé à la place du
 * match qui n'existe pas encore, et un « + » au milieu. Il dit quand (le
 * jour, l'heure) et combien sont libres, en vert ; sous la carte, leurs
 * cartes en mini, comme celles de ceux qui viennent sous un match.
 */
function CarteProposee({
  moment,
  terrain,
  titre,
  choisie,
  loin,
  ouvreZone,
  onToucher,
}: {
  moment: MomentPropose | null;
  terrain: TerrainPropose | null;
  titre: string;
  choisie: boolean;
  loin: string | null;
  /** Le numéro de la zone qu'un match sur ce terrain ouvrirait (31/10), sinon null. */
  ouvreZone: string | null;
  onToucher: () => void;
}) {
  const [c0, c1, c2] = COULEUR_LIGUE.bola.fond;
  const noms = moment?.noms ?? [];
  const ou = terrain ? lieuDuTerrain(terrain) : null;
  return (
    <div className={cn("carte-match relative", choisie && "carte-match--choisie")}>
      <button
        type="button"
        onClick={onToucher}
        className="block rounded-[24px] p-[5px] text-left shadow-[0_8px_12px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC }}
        aria-label={`Ouvrir un match${moment ? ` ${titre.toLowerCase()} ${moment.heure.replace(":", "h")}` : ""}${ou ? `, ${ou}` : ""}${noms.length ? `, ${noms.length} joueurs libres` : ""}`}
        aria-pressed={choisie}
      >
        <div className="relative overflow-hidden rounded-[19px]" style={{ width: 196, height: 140, background: `linear-gradient(180deg, ${c0}, ${c1} 50%, ${c2})` }}>
          {terrain ? (
            <TerrainDessine lat={terrain.lat} lng={terrain.lng} className="absolute inset-0 h-full w-full" />
          ) : (
            <div
              className="absolute top-1/2 left-1/2 size-[118px] -translate-x-1/2 -translate-y-[calc(50%+14px)] opacity-60"
              dangerouslySetInnerHTML={{ __html: stadeSvg("semaine", { fond: false, ligue: "bola" }) }}
            />
          )}
          <div className="absolute inset-0 bg-[rgba(4,5,7,0.18)]" />
          <div className="absolute inset-x-0 bottom-0 h-[70%] bg-gradient-to-b from-transparent via-[rgba(4,5,7,0.4)] to-[rgba(3,4,6,0.82)]" />
          {/* Le match qui n'existe pas encore : un pointillé, un « + ». */}
          <div className="pointer-events-none absolute inset-[5px] rounded-[15px] border-[1.5px] border-dashed border-white/70" />
          <span
            aria-hidden
            className="absolute top-[40%] left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full shadow-[0_4px_10px_rgba(0,0,0,0.35)]"
            style={{ background: BLANC, color: ENCRE }}
          >
            <Plus className="size-[18px]" strokeWidth={3} />
          </span>
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-2.5">
            {noms.length > 0 ? <Jeton texte={`${noms.length} libres`} ton="neutre" couleur={VERT_LIBRES} /> : <span />}
            {loin && <Jeton texte={loin} ton="neutre" />}
          </div>
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3">
            {/* La raison d'ouvrir (31/10) : un terrain hors des zones ouvre la suivante. */}
            {ouvreZone && (
              <p className="mb-1 font-mono text-[9.5px] font-bold tracking-[1px] uppercase" style={{ color: VERT_ZONE }}>
                Ouvre la zone {ouvreZone}
              </p>
            )}
            <p
              className="truncate font-black text-white/85 uppercase"
              style={{ fontSize: titre.length > 10 ? 22 : titre.length > 7 ? 28 : 34, letterSpacing: -1.4, lineHeight: 1 }}
            >
              {titre}
            </p>
            <p className="mt-1 flex items-center gap-1.5 font-mono text-[9.5px] font-bold tracking-[1px] text-white/70 uppercase">
              <SigleLigue ligue="bola" hauteur={9.5} className="text-white/90" />
              <span className="min-w-0 truncate">{[moment && heureCourte(moment.heure.replace(":", "h")), ou].filter(Boolean).join(" · ") || "Où tu veux"}</span>
            </p>
          </div>
        </div>
      </button>
      <CartesSous noms={noms} />
    </div>
  );
}

/** Le vert des terrains hors zone (map/stade.ts, teinte « vert » de nuit) : lisible sur la photo. */
const VERT_ZONE = "#84D68C";

const DATE_COURTE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/**
 * Le récit d'une zone (30/10) : son numéro, ce qu'elle compte, et comment
 * elle s'est ouverte, lieu par lieu, dans l'ordre ; ses villes ensuite. Une
 * zone fermée dit seulement qui y attend, et s'ouvre d'un match.
 */
function RecitZone({ zone, dimanches, ouvrir, onOuvrir }: { zone: Zone; dimanches: number; ouvrir: boolean; onOuvrir: () => void }) {
  const ligue = zone.foyers.some((f) => f.genre === "sfl");
  const lieux = zone.foyers.length;
  const chiffres: [number, string][] = [
    [zone.joueurs, zone.joueurs > 1 ? "joueurs" : "joueur"],
    zone.ouverte ? [lieux, lieux > 1 ? "terrains" : "terrain"] : [0, "match"],
    ...(ligue && dimanches ? [[dimanches, dimanches > 1 ? "dimanches" : "dimanche"] as [number, string]] : []),
  ];
  const recit = [...zone.foyers].sort((a, b) => (a.depuis ?? 0) - (b.depuis ?? 0));
  return (
    <>
      <SheetHeader className="px-5 pt-5 pb-0">
        <p className="mono-label text-muted-foreground">{zone.ouverte ? `${zone.aMoi ? "Ta zone" : "Zone"} ${numeroZone(zone.numero)}${zone.nouvelle ? " · nouvelle" : ""}` : "Zone à ouvrir"}</p>
        <SheetTitle className="text-[30px] leading-none font-black tracking-tight uppercase italic">{zone.nom}</SheetTitle>
      </SheetHeader>
      <div className="flex flex-col gap-4 px-4 pt-3">
        <div className="grid grid-cols-3 gap-2">
          {chiffres.map(([n, l]) => (
            <div key={l} className="rounded-[18px] border border-border bg-secondary/60 px-3 py-2.5">
              <p className="font-display text-[30px] leading-none tabular-nums">{n}</p>
              <p className="mono-label mt-1 text-muted-foreground">{l}</p>
            </div>
          ))}
        </div>
        {recit.length > 0 && (
          <ol className="relative flex flex-col gap-3 border-l-[1.5px] border-foreground/80 pl-4">
            {recit.map((f, i) => (
              <li key={`${f.lat},${f.lng},${i}`} className="relative">
                <span aria-hidden className="absolute top-1 -left-[21.5px] size-[11px] rounded-full border-[1.5px] border-foreground bg-background" />
                <p className="mono-label flex items-center gap-1.5 text-muted-foreground">
                  <SigleLigue ligue={f.genre} hauteur={10} className="text-foreground" />
                  {[i === 0 ? "L'ouverture" : null, f.depuis ? DATE_COURTE.format(f.depuis) : f.genre === "sfl" ? "Chaque dimanche" : null].filter(Boolean).join(" · ")}
                </p>
                <p className="text-[15px] leading-snug font-semibold">{f.nom}</p>
                {f.par && <p className="text-[13px] text-muted-foreground">par {f.par}</p>}
              </li>
            ))}
          </ol>
        )}
        {zone.villes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...zone.villes]
              .sort((a, b) => b.n - a.n)
              .map((v) => (
                <span key={v.ville} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border px-2.5 text-[12.5px] font-semibold">
                  {v.ville}
                  <span className="text-muted-foreground tabular-nums">{v.n}</span>
                </span>
              ))}
          </div>
        )}
        {ouvrir && (
          <Button variant="vert" onClick={onOuvrir} className="h-12 w-full gap-2.5 rounded-full text-[15px] font-semibold">
            <SigleLigue ligue="bola" hauteur={12} />
            {zone.ouverte ? "Ouvrir un match dans la zone" : "Ouvrir la zone"}
          </Button>
        )}
      </div>
    </>
  );
}

/**
 * La fiche d'un terrain possible : sa photo, le chemin pour y aller, et les
 * deux façons d'y jouer — un match Bola ouvert à tous, ou le défi d'une
 * équipe (Team, que seul un capitaine lance ; sans équipe, on la monte).
 */
function FicheLibre({
  t,
  ios,
  defi,
  ouvrir,
  source,
  zone,
  onOuvrir,
}: {
  t: TerrainPropose;
  ios: boolean;
  defi: "defier" | "monter" | null;
  /** Ouvrir un match demande d'être connecté (le bouton de la Map aussi). */
  ouvrir: boolean;
  /** La source du terrain, citée sous la fiche (Licence Ouverte, ODbL). */
  source: string | null;
  /** La zone du terrain : la sienne, ou celle que son premier match ouvrira. */
  zone?: { texte: string; ouvre: boolean } | null;
  onOuvrir: () => void;
}) {
  const lien = itineraires(t.lat, t.lng, t.nom)[ios ? 0 : 1];
  return (
    <div className="flex flex-col gap-3 px-4">
      <div className="relative h-[180px] overflow-hidden rounded-[22px] border border-border bg-secondary">
        <TerrainDessine lat={t.lat} lng={t.lng} titre={`Le terrain ${t.nom}`} className="h-full w-full" />
        <span className="ajuster-pin pointer-events-none" style={{ left: "50%", top: "50%", cursor: "default" }} aria-hidden />
        <span className="absolute bottom-2 left-2 max-w-[calc(100%-6.5rem)] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {t.adresse || t.commune}
        </span>
        <a
          href={lien.url}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-2 bottom-2 flex h-[26px] items-center gap-[5px] rounded-full bg-black/55 px-2.5 text-[11.5px] font-semibold text-white backdrop-blur"
        >
          <Navigation className="size-[10px]" strokeWidth={2.6} /> Y aller
        </a>
      </div>
      {zone && <p className={`mono-label text-center ${zone.ouvre ? "font-bold text-[#1F8A45] dark:text-[#84D68C]" : "text-muted-foreground"}`}>{zone.texte}</p>}
      {ouvrir && (
        <Button variant="vert" onClick={onOuvrir} className="h-12 w-full gap-2.5 rounded-full text-[15px] font-semibold">
          <SigleLigue ligue="bola" hauteur={12} />
          {zone?.ouvre ? "Ouvrir la zone ici" : "Ouvrir un match ici"}
        </Button>
      )}
      {defi && (
        <Link
          href={defi === "defier" ? `/bola-team?terrain=${encodeURIComponent(t.id)}` : "/bola-team"}
          className="bouton-secondaire bouton--mauve flex h-12 items-center justify-center gap-2.5 text-[15px] font-semibold"
        >
          <SigleLigue ligue="team" hauteur={12} />
          {defi === "defier" ? "Défier une équipe ici" : "Monter mon équipe"}
        </Link>
      )}
      {source && <p className="px-2 pt-1 text-center text-[11px] leading-snug text-muted-foreground/70">{source}</p>}
    </div>
  );
}

/** Les trois façons d'aller au terrain (l'adresse est déjà sous le titre de la fiche). */
function Itineraire({ terrain, ios, autres }: { terrain: Terrain; ios: boolean; /** Le premier est déjà « Y aller », en bas de la page : les deux autres seulement. */ autres?: boolean }) {
  const liens = itineraires(terrain.lat, terrain.lng, terrain.nom);
  // Sur iPhone, Plans d'abord ; ailleurs, Google Maps d'abord.
  const ordre = ios ? liens : [liens[1], liens[0], liens[2]];
  return (
    <section className="flex flex-col gap-3">
      {!autres && <a
        href={ordre[0].url}
        target="_blank"
        rel="noopener noreferrer"
        className="bouton-principal bouton--vert flex h-12 items-center justify-center gap-2 text-[15px] font-semibold"
      >
        <Navigation className="size-4" /> Itinéraire avec {ordre[0].libelle}
      </a>}
      <div className="grid grid-cols-2 gap-2">
        {ordre.slice(1).map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="bouton-secondaire bouton--vert flex h-11 items-center justify-center text-[14px] font-semibold"
          >
            {l.libelle}
          </a>
        ))}
      </div>
    </section>
  );
}

/** Les joueurs d'une journée, tels que l'admin les a convoqués : leur nombre,
 *  jamais sur un plafond (une journée n'en a pas). */
function Presents({ m, habitues }: { m: MatchMap; habitues: string[] }) {
  // Avant la composition, personne n'est encore sur la feuille : on montre
  // les habitués, ceux du dernier dimanche joué (31/10 : des visages plutôt
  // qu'un zéro).
  const avant = !m.joue && !m.presents.length && habitues.length > 0;
  const noms = avant ? habitues : m.presents;
  return (
    <section className="rounded-[26px] bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="mono-label text-muted-foreground">{m.joue ? "Ils ont joué" : avant ? "Les habitués" : "Les joueurs"}</p>
        <p className="text-[22px] font-bold tabular-nums">{noms.length}</p>
      </div>
      {noms.length > 0 && <QuiVient className="mt-3" noms={noms} />}
      {m.dedans && <p className="mono-label mt-3 text-foreground">{m.joue ? "Tu y étais" : "Tu y es"}</p>}
    </section>
  );
}

function Jeton({ texte, ton, couleur, petit }: { texte: string; ton: EtatSticker["genre"] | "neutre"; couleur?: string; petit?: boolean }) {
  // Un match ouvert par un joueur dit ce qu'il lui manque dans sa couleur (rouge, orange, vert).
  const style =
    ton === "dedans"
      ? { background: CLAIR, color: ENCRE }
      : {
          background: "rgba(14,17,21,0.72)",
          color: couleur ?? (ton === "manque" ? BRAISE : ton === "complet" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)"),
          boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.15)",
        };
  return (
    <span className={cn("truncate rounded-full font-medium", petit ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[4.5px] text-[11px]")} style={style}>
      {texte}
    </span>
  );
}

/** La fiche d'un match d'équipe : les deux écussons face à face, leurs
 *  effectifs, et le chemin vers la page Team, où il se gère. */
function FicheTeam({ t }: { t: MatchTeam }) {
  const cote = (e: MatchTeam["de"]) => (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center">
      <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={72} />
      <p className="w-full truncate text-[15px] font-bold tracking-tight">{e.nom}</p>
      <p className="mono-label text-muted-foreground">{e.membres.filter((x) => x.statut === "membre").length} joueurs</p>
    </div>
  );
  return (
    <>
      <div className="flex items-start gap-3 rounded-[22px] bg-contraste/[0.04] px-3 py-5">
        {cote(t.de)}
        <span className="mt-6 text-[22px] font-black text-muted-foreground">–</span>
        {cote(t.a)}
      </div>
      <Link href="/bola-team" className="bouton-secondaire flex h-12 items-center justify-center text-[15px] font-semibold">
        Voir la Team
      </Link>
    </>
  );
}

/* ----------------------------- Côté admin ----------------------------- */

/**
 * Le nom du terrain, et son adresse qui se complète pendant la frappe : les
 * adresses de la Base Adresse Nationale, puis les lieux nommés
 * d'OpenStreetMap (un five, un city stade). Toucher une proposition la
 * retient ; un lieu nommé propose aussi son nom pour le terrain.
 */
function ChercheAdresse({
  onPlacer,
  bouton,
  nomInitial = "",
}: {
  onPlacer: (nom: string, adresse: string, lieu: Lieu) => void;
  bouton: string;
  nomInitial?: string;
}) {
  const [nom, setNom] = useState(nomInitial);
  const [adresse, setAdresse] = useState("");
  const [lieux, setLieux] = useState<Lieu[]>([]);
  const [choisi, setChoisi] = useState<Lieu | null>(null);
  const [cherche, setCherche] = useState(false);
  const [vide, setVide] = useState(false);
  const derniere = useRef(0);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  function taper(v: string) {
    setAdresse(v);
    setChoisi(null);
    setVide(false);
    if (minuteur.current) clearTimeout(minuteur.current);
    const q = v.trim();
    if (q.length < 3) {
      setLieux([]);
      return;
    }
    // Une requête par pause de frappe ; une réponse en retard ne remplace
    // jamais une plus récente.
    minuteur.current = setTimeout(async () => {
      const n = ++derniere.current;
      setCherche(true);
      try {
        // Les propositions proches de la ligue passent devant (Lille).
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}&lat=${PRES_DE.lat}&lon=${PRES_DE.lng}`);
        const data = (await res.json()) as { resultats: Lieu[]; erreur?: string };
        if (n !== derniere.current) return;
        if (data.erreur) toast.error(data.erreur);
        setLieux(data.resultats ?? []);
        setVide(!data.erreur && !(data.resultats ?? []).length);
      } catch {
        if (n === derniere.current) toast.error("Les services d'adresses ne répondent pas.");
      } finally {
        if (n === derniere.current) setCherche(false);
      }
    }, 250);
  }

  function retenir(l: Lieu) {
    setChoisi(l);
    setAdresse(l.libelle);
    setLieux([]);
    if (!nom.trim() && l.nom) setNom(l.nom);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Nom du terrain</span>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Five du canal" maxLength={40} />
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="adresse-terrain" className="text-[13px] font-semibold">
          Adresse
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="adresse-terrain"
            value={adresse}
            onChange={(e) => taper(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && lieux[0]) {
                e.preventDefault();
                retenir(lieux[0]);
              }
            }}
            placeholder="Une adresse ou le nom du terrain"
            autoComplete="off"
            className="pl-9"
            role="combobox"
            aria-expanded={lieux.length > 0}
            aria-controls="adresses-proposees"
          />
          {cherche && <span className="absolute top-1/2 right-3 size-3 -translate-y-1/2 animate-pulse rounded-full bg-muted-foreground/60" aria-hidden />}
        </div>
        {lieux.length > 0 && (
          <ul id="adresses-proposees" role="listbox" className="overflow-hidden rounded-2xl border border-border bg-popover">
            {lieux.map((l) => (
              <li key={`${l.lat},${l.lng},${l.libelle}`} role="option" aria-selected={false}>
                <button
                  type="button"
                  onClick={() => retenir(l)}
                  className="flex w-full items-start gap-2.5 border-b border-border/60 px-3 py-2.5 text-left last:border-0 hover:bg-secondary"
                >
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{l.nom ?? l.libelle.split(",")[0]}</span>
                    <span className="block truncate text-[12px] text-muted-foreground">
                      {l.nom ? l.libelle.split(", ").slice(1).join(", ") : (l.commune ?? "")}
                      {l.genre === "lieu" ? " · lieu" : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {vide && <p className="text-[12px] text-muted-foreground">Rien pour cette saisie : ajoute la ville ou le code postal.</p>}
        {choisi && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <Crosshair className="size-3.5" /> Pose l&apos;épingle pile sur le terrain : glisse-la, ou touche le terrain.
            </p>
            <div className="h-[240px] overflow-hidden rounded-2xl border border-border">
              <AjusterPoint
                lat={choisi.lat}
                lng={choisi.lng}
                onChange={(lat, lng) => setChoisi((c) => (c ? { ...c, lat, lng } : c))}
                className="h-full w-full"
              />
            </div>
          </div>
        )}
      </div>

      <Button
        disabled={!choisi || !nom.trim()}
        onClick={() => {
          if (!choisi || !nom.trim()) return;
          onPlacer(nom.trim(), choisi.libelle, choisi);
          setNom("");
          setAdresse("");
          setLieux([]);
          setChoisi(null);
        }}
        variant="vert"
        className="font-semibold"
      >
        <MapPin className="size-4" /> {bouton}
      </Button>
    </div>
  );
}

/**
 * Où se joue chaque match ouvert : son terrain, son heure, sa date ; et quand
 * la journée a plusieurs terrains, l'heure et le lieu de chacun (Sabri,
 * 23/10). Un terrain laissé vide suit la journée.
 */
function OuSeJouent({
  saison,
  matchs,
  terrains,
  matchsDe,
  onSauver,
}: {
  saison: Saison;
  matchs: MatchMap[];
  terrains: Terrain[];
  /** L'heure et le lieu d'une journée, et ses matchs chacun aux siens. */
  matchsDe: (m: JourneeMeta) => { repli: Repli; matchs: MatchResolu[] };
  onSauver: (next: Saison, message: string) => void;
}) {
  const [nouvelle, setNouvelle] = useState<number | "convocation" | null>(null);
  // « 3-1 » : le Match 2 de la J3 attend sa nouvelle adresse.
  const [nouveauLieu, setNouveauLieu] = useState<string | null>(null);
  // Une journée jouée en plusieurs lieux a un match par lieu : une seule ligne ici.
  const journees = matchs.filter((m, i) => m.j != null && matchs.findIndex((x) => x.j === m.j) === i);
  const meta = (j: number) => saison.journees.find((x) => x.j === j) as JourneeMeta;
  const { journees: derivees } = useSeason();

  return (
    <section id="ou-se-joue" className="scroll-mt-4 overflow-hidden rounded-[26px] bg-card">
      <div className="px-5 pt-4 pb-3">
        <p className="mono-label text-muted-foreground">Admin · les matchs</p>
        <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">Où se jouent les matchs</h2>
      </div>

      {journees.length === 0 ? (
        <div className="border-t border-border/60 px-5 py-4">
          <p className="text-[13px] text-muted-foreground">
            Aucune journée ouverte : la Map montre la convocation du dimanche
            {matchs[0]?.terrain ? `, au ${matchs[0].terrain.nom}` : ""}.
          </p>
          {!terrains.length && (
            <div className="mt-3">
              <ChercheAdresse
                bouton="Placer le match sur la Map"
                onPlacer={(nom, adresse, l) =>
                  onSauver(ajouterTerrain(saison, { nom, adresse, lat: l.lat, lng: l.lng, commune: l.commune }), `${nom} est sur la Map.`)
                }
              />
            </div>
          )}
        </div>
      ) : (
        <ul>
          {journees.map((m) => {
            const j = m.j!;
            const mj = meta(j);
            const { repli, matchs: duJour } = matchsDe(mj);
            const matches = derivees.find((x) => x.j === j)?.matches ?? [];
            return (
              <li key={m.cle} className="flex flex-col gap-3 border-t border-border/60 px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-bold tracking-tight">
                    J{j} · {m.quand.titre}
                  </p>
                  <span className={cn("mono-label", m.terrain ? "text-muted-foreground" : "text-braise")}>
                    {m.terrain ? (mj.terrainId != null ? "sur la map" : "lieu par défaut") : "sans adresse"}
                  </span>
                </div>
                <div className={cn("grid gap-2", duJour.length === 1 ? "grid-cols-3" : "grid-cols-2")}>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-muted-foreground">Date</span>
                    <Input
                      key={`d${j}-${mj.date}`}
                      defaultValue={mj.date}
                      placeholder="11 oct."
                      onBlur={(e) => e.target.value.trim() && e.target.value !== mj.date && onSauver(updateJournee(saison, j, { date: e.target.value.trim() }), `J${j} : ${e.target.value.trim()}.`)}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-muted-foreground">Heure</span>
                    <Input
                      key={`h${j}-${mj.heure ?? repli.heure}`}
                      defaultValue={mj.heure ?? repli.heure}
                      placeholder="13h00"
                      onBlur={(e) => e.target.value.trim() && e.target.value !== (mj.heure ?? repli.heure) && onSauver(updateJournee(saison, j, { heure: e.target.value.trim() }), `J${j} à ${e.target.value.trim()}.`)}
                    />
                  </label>
                  {/* Un seul match : son terrain sur place se règle ici. */}
                  {duJour.length === 1 && matches[0] && (
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-muted-foreground">Terrain</span>
                      <Input
                        key={`t${j}-${matches[0].terrain ?? ""}`}
                        defaultValue={matches[0].terrain ?? ""}
                        placeholder="—"
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          if (v === (matches[0].terrain ?? "").trim()) return;
                          const nom = nomDuTerrain(v);
                          onSauver(
                            reglerMatchDuJour(saison, j, 0, { terrain: v || undefined }),
                            nom ? `J${j} sur le ${nom}.` : `J${j} : terrain retiré.`
                          );
                        }}
                      />
                    </label>
                  )}
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-muted-foreground">Lieu</span>
                  <select
                    value={nouvelle === j ? "nouveau" : (mj.terrainId ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "nouveau") return setNouvelle(j);
                      setNouvelle(null);
                      onSauver(updateJournee(saison, j, { terrainId: v ? Number(v) : undefined }), `J${j} : lieu enregistré.`);
                    }}
                    className="h-10 rounded-xl border border-input bg-transparent px-3 text-[14px]"
                  >
                    {terrains.length > 0 && <option value="">Par défaut{terrains.find((t) => t.defaut) ? ` — ${terrains.find((t) => t.defaut)!.nom}` : ""}</option>}
                    {terrains.length === 0 && <option value="">Aucun terrain</option>}
                    {terrains.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nom}
                      </option>
                    ))}
                    <option value="nouveau">+ Nouvelle adresse…</option>
                  </select>
                </label>
                {(nouvelle === j || terrains.length === 0) && (
                  <ChercheAdresse
                    bouton={`Placer J${j} sur la Map`}
                    onPlacer={(nom, adresse, l) => {
                      onSauver(
                        placerJourneeSurNouveauTerrain(saison, j, { nom, adresse, lat: l.lat, lng: l.lng, commune: l.commune }),
                        `J${j} se joue au ${nom}.`
                      );
                      setNouvelle(null);
                    }}
                  />
                )}

                {/* Plusieurs matchs : l'heure, le lieu et le terrain de chacun. Vide, il suit la journée. */}
                {duJour.length > 1 && (
                  <div className="flex flex-col gap-3 rounded-2xl bg-secondary/60 p-3">
                    <p className="mono-label text-muted-foreground">Chaque match</p>
                    {duJour.map((t) => {
                      const match = matches[t.n];
                      if (!match) return null;
                      const cle = `${j}-${t.n}`;
                      const sienne = match.heure ?? "";
                      const sonTerrain = match.terrain ?? "";
                      return (
                        <div key={cle} className="flex flex-col gap-1.5">
                          <p className="flex min-w-0 items-baseline gap-2 text-[13.5px]">
                            <span className="shrink-0 font-bold">{t.label}</span>
                            <span className="truncate text-muted-foreground">
                              {t.noirs.length} contre {t.blancs.length}
                            </span>
                          </p>
                          <div className="grid grid-cols-2 gap-2">
                            <Input
                              key={`h${cle}-${sienne}`}
                              defaultValue={sienne}
                              placeholder={repli.heure}
                              aria-label={`Heure du ${t.label}`}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v === sienne.trim()) return;
                                onSauver(
                                  reglerMatchDuJour(saison, j, t.n, { heure: v || undefined }),
                                  v ? `J${j} · ${t.label} à ${v}.` : `J${j} · ${t.label} à l'heure de la journée.`
                                );
                              }}
                            />
                            <Input
                              key={`t${cle}-${sonTerrain}`}
                              defaultValue={sonTerrain}
                              placeholder="Terrain"
                              aria-label={`Terrain du ${t.label}`}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v === sonTerrain.trim()) return;
                                const nom = nomDuTerrain(v);
                                onSauver(
                                  reglerMatchDuJour(saison, j, t.n, { terrain: v || undefined }),
                                  nom ? `J${j} · ${t.label} sur le ${nom}.` : `J${j} · ${t.label} : terrain retiré.`
                                );
                              }}
                            />
                          </div>
                          <select
                            aria-label={`Lieu du ${t.label}`}
                            value={nouveauLieu === cle ? "nouveau" : (match.lieuId ?? "")}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (v === "nouveau") return setNouveauLieu(cle);
                              setNouveauLieu(null);
                              const lieu = terrains.find((x) => x.id === Number(v));
                              onSauver(
                                reglerMatchDuJour(saison, j, t.n, { lieuId: lieu?.id }),
                                lieu ? `J${j} · ${t.label} au ${lieu.nom}.` : `J${j} · ${t.label} au lieu de la journée.`
                              );
                            }}
                            className="h-10 min-w-0 rounded-xl border border-input bg-transparent px-3 text-[14px]"
                          >
                            <option value="">{repli.lieu ? repli.lieu.nom : "Lieu de la journée"}</option>
                            {terrains
                              .filter((x) => x.id !== repli.lieu?.id)
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nom}
                                </option>
                              ))}
                            <option value="nouveau">+ Nouvelle adresse…</option>
                          </select>
                          {nouveauLieu === cle && (
                            <ChercheAdresse
                              bouton={`Placer le ${t.label} sur la Map`}
                              onPlacer={(nom, adresse, l) => {
                                onSauver(
                                  placerMatchDuJourSurNouveauLieu(saison, j, t.n, { nom, adresse, lat: l.lat, lng: l.lng, commune: l.commune }),
                                  `J${j} · ${t.label} au ${nom}.`
                                );
                                setNouveauLieu(null);
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Terrains({
  saison,
  terrains,
  onSauver,
}: {
  saison: Saison;
  terrains: Terrain[];
  onSauver: (next: Saison, message: string) => void;
}) {
  const [ajuste, setAjuste] = useState<number | null>(null);
  return (
    <section className="overflow-hidden rounded-[26px] bg-card">
      <div className="px-5 pt-4 pb-3">
        <p className="mono-label text-muted-foreground">Admin · terrains</p>
        <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">Les terrains de la ligue</h2>
      </div>

      {terrains.length > 0 && (
        <ul className="border-t border-border/60">
          {terrains.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 border-b border-border/60 px-5 py-3 last:border-b-0">
              <MapPin className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">
                  {t.nom}
                  {t.defaut && <span className="mono-label ml-2 text-muted-foreground">par défaut</span>}
                </p>
                <p className="truncate text-[12px] text-muted-foreground">{t.adresse}</p>
              </div>
              {!t.defaut && (
                <button
                  type="button"
                  aria-label={`${t.nom} par défaut`}
                  onClick={() => onSauver(definirTerrainParDefaut(saison, t.id), `${t.nom} devient le terrain par défaut.`)}
                  className="bouton-secondaire grid size-8 place-items-center"
                >
                  <Star className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Ajuster ${t.nom} sur la photo satellite`}
                aria-pressed={ajuste === t.id}
                onClick={() => setAjuste((x) => (x === t.id ? null : t.id))}
                className={cn("grid size-8 place-items-center", ajuste === t.id ? "bouton-principal" : "bouton-secondaire")}
              >
                <Crosshair className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Retirer ${t.nom}`}
                onClick={() => onSauver(retirerTerrain(saison, t.id), `${t.nom} retiré de la Map.`)}
                className="bouton-secondaire bouton--rouge grid size-8 place-items-center"
              >
                <Trash2 className="size-4" />
              </button>
              {ajuste === t.id && (
                <div className="mt-2 basis-full">
                  <div className="h-[260px] overflow-hidden rounded-2xl border border-border">
                    <AjusterPoint
                      lat={t.lat}
                      lng={t.lng}
                      onChange={(lat, lng) => onSauver(deplacerTerrain(saison, t.id, lat, lng), `${t.nom} : épingle posée.`)}
                      className="h-full w-full"
                    />
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border/60 px-5 py-4">
        <ChercheAdresse
          bouton="Ajouter le terrain"
          onPlacer={(nom, adresse, l) =>
            onSauver(ajouterTerrain(saison, { nom, adresse, lat: l.lat, lng: l.lng, commune: l.commune }), `${nom} est sur la Map.`)
          }
        />
      </div>
    </section>
  );
}
