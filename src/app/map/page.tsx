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

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CalendarDays, Crosshair, Layers, LocateFixed, MapPin, Navigation, Plus, Search, Settings2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { QuiVient } from "@/components/sfl/qui-vient";
import { FichePartie } from "@/components/sfl/matchs/fiche-partie";
import { FeuilleDeMatch } from "@/components/sfl/matchs/feuille-de-match";
import { feuilleDeConvocation, feuilleDeJournee } from "@/lib/sfl/feuille";
import { MesDispos } from "@/components/sfl/matchs/mes-dispos";
import { OuvrirMatch } from "@/components/sfl/matchs/ouvrir-match";
import { useParties } from "@/hooks/use-parties";
import { inscrits, libelleJour, placesLibres, type Partie } from "@/lib/sfl/matchs";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "@/hooks/use-session";
import { saisieStore } from "@/lib/sfl/saisie/store";
import {
  ajouterTerrain,
  definirTerrainParDefaut,
  deplacerTerrain,
  journeeJouee,
  placerJourneeSurNouveauTerrain,
  retirerTerrain,
  terrainDeJournee,
  terrainDuMatch,
  updateJournee,
} from "@/lib/sfl/saisie/mutations";
import type { JourneeMeta, Saison, Terrain } from "@/lib/sfl/saisie/types";
import { ovr } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { FOND_MOMENT, heureCourte, itineraires, photoSatellite, stadeSvg, type EtatSticker, type Moment, type StickerPlan } from "@/components/sfl/map/stade";
import type { FondCarte, PointPlan, ToiPlan } from "@/components/sfl/map/carte-map";
import "./animations.css";

/** Les terrains enregistrés ne s'affichent plus sur le plan : seuls les matchs. */
const AUCUN_POINT: PointPlan[] = [];

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
}

/** « 13h00 », « 13:30 » → 13 ; 13 à défaut. */
function heureDe(heure: string): number {
  const m = heure.match(/(\d{1,2})\s*[h:]/i);
  return m ? Number(m[1]) : 13;
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
  const { saison, journees } = useSeason();
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();
  const { player } = useMyPlayer();
  const aujourdhui = useAujourdhui();
  const heure = useHeure();

  const terrains = useMemo(() => saison.terrains ?? [], [saison.terrains]);

  // Les journées à venir, chacune sur son terrain ; sinon la convocation du
  // dimanche. Une journée est passée quand elle est jouée (résultat saisi) ou
  // quand sa date est derrière nous — le jour même, deux heures après le coup
  // d'envoi. La dernière passée (de moins d'une semaine) reste sur la Map,
  // « jouée », avec ses joueurs et le chemin vers le récap.
  const ligue = useMemo<MatchMap[]>(() => {
    const passee = (m: (typeof saison.journees)[number]) => {
      if (journeeJouee(saison, m.j)) return true;
      const e = ecartJours(m.date, aujourdhui);
      if (e == null) return false;
      if (e < 0) return true;
      return e === 0 && heure >= 0 && heure >= heureDe(m.heure || p.heure) + 2;
    };
    const ecartConvocation = ecartJours(p.jour.replace(/^\S+\s+/, ""), aujourdhui);
    const versMatch = (m: (typeof saison.journees)[number], joue: boolean): MatchMap => {
      const lignes = saison.entries.filter((e) => e.j === m.j);
      const presents = lignes.filter((e) => e.statut === "Présent").map((e) => e.player);
      const effectif = Math.max(EFFECTIF, lignes.length);
      const dedans = presents.includes(player.name);
      const e = ecartJours(m.date, aujourdhui);
      const convoquee = !joue && e != null && e === ecartConvocation;
      const { etat, texte } = joue
        ? { etat: { genre: "joue" } as EtatSticker, texte: dedans ? "Joué · tu y étais" : "Joué" }
        : convoquee
          ? etatLigue(p.mine === "present", p.presents.length)
          : etatLigue(dedans, presents.length);
      return {
        cle: `j${m.j}`,
        j: m.j,
        quand: joue ? { titre: m.date, jourCourt: m.date.toUpperCase().slice(0, 7), moment: "weekend" } : quand(m.date, null, aujourdhui),
        dateLabel: m.date,
        heure: m.heure || p.heure,
        terrain: terrainDeJournee(saison, m, p.lieu),
        presents: convoquee ? p.presents : presents,
        effectif: convoquee ? p.effectif : effectif,
        dedans: convoquee ? p.mine === "present" : dedans,
        etat,
        etatTexte: texte,
        joue,
        convoquee,
      };
    };

    const parDate = [...saison.journees].sort((a, b) => a.j - b.j);
    const aVenir = parDate.filter((m) => !passee(m)).map((m) => versMatch(m, false));
    const derniere = parDate.filter(passee).at(-1);
    const eDerniere = derniere ? ecartJours(derniere.date, aujourdhui) : null;
    const recente = derniere && (eDerniere == null || eDerniere >= -6) ? [versMatch(derniere, true)] : [];

    if (aVenir.length) return [...aVenir, ...recente];
    // Pas de journée à venir : la convocation du dimanche, si elle n'est pas
    // elle-même passée (l'admin ouvre la suivante en ouvrant l'app).
    if (ecartConvocation != null && ecartConvocation < 0) return recente;
    const dedans = p.mine === "present";
    const { etat, texte } = etatLigue(dedans, p.presents.length);
    return [
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
      },
      ...recente,
    ];
  }, [saison, player.name, aujourdhui, heure, p.heure, p.lieu, p.jour, p.mine, p.effectif, p.presents]);

  // Les matchs ouverts par les joueurs : un public montre ses places libres,
  // un privé n'apparaît qu'à ceux qui en sont.
  const { parties, moi, actif: partiesActives, recharger } = useParties();
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
        cle: `m${x.id}`,
        j: null,
        quand: quand(dateLabel, null, aujourdhui),
        dateLabel,
        heure: x.heure,
        terrain:
          x.lat != null && x.lng != null
            ? { id: -x.id, nom: x.lieu, adresse: x.adresse ?? "", lat: x.lat, lng: x.lng }
            : null,
        presents: venus,
        effectif: x.places,
        dedans: moiLa?.statut === "inscrit",
        etat,
        etatTexte: texte,
        partie: x,
      };
    });
    return [...ligue, ...ouverts];
  }, [ligue, parties, moi, aujourdhui]);

  // Sur la carte, dans l'ordre du temps : le dernier match joué à gauche, en
  // petit, puis ce qui arrive, du plus proche au plus loin. Le match « à la
  // une » est le prochain : c'est lui qu'on voit en ouvrant la Map, avec ce
  // qu'il lui manque. Le jour même, après le coup de sifflet, le match joué
  // garde la une jusqu'à minuit (on y cherche le récap) ; dès le lendemain,
  // la une passe au suivant. Les terrains enregistrés n'y sont plus — on ne
  // noie pas le match.
  const affiches = useMemo(() => {
    const ordre = (m: MatchMap) => (ecartJours(m.dateLabel, aujourdhui) ?? 99) * 24 + heureDe(m.heure);
    const aVenir = matchs.filter((m) => !m.joue).sort((a, b) => ordre(a) - ordre(b));
    const joue = matchs.filter((m) => m.joue).at(-1);
    return joue ? [joue, ...aVenir] : aVenir;
  }, [matchs, aujourdhui]);
  const une = useMemo(() => {
    const joue = affiches.find((m) => m.joue);
    if (joue && ecartJours(joue.dateLabel, aujourdhui) === 0) return joue;
    return affiches.find((m) => !m.joue) ?? affiches[0];
  }, [affiches, aujourdhui]);

  // Ouvrir un match : n'importe quel joueur, d'un bouton ou d'un terrain libre.
  const [ouvrir, setOuvrir] = useState<{ terrain: Terrain | null; jour?: string; heure?: string; n: number } | null>(null);
  const [dispos, setDispos] = useState(false);

  const [fiche, setFiche] = useState(false);
  const [ficheAdmin, setFicheAdmin] = useState(false);
  const [choix, setChoix] = useState<string | null>(null);
  // Toucher un match sur le plan le choisit et ouvre sa fiche — un instant
  // après, qu'on voie le sticker grandir et l'onde partir.
  const choisirSticker = useCallback((id: string) => {
    setChoix(id);
    setFicheAdmin(false);
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(() => setFiche(true), calme ? 0 : 320);
  }, []);
  // Le match choisi : celui qu'on a touché s'il est encore là, sinon la une.
  const choisi = affiches.find((m) => m.cle === choix) ?? une;

  // Le carrousel et le plan vont ensemble : faire glisser les cartes choisit
  // celle qui s'arrête au centre (le plan suit), et choisir sur le plan amène
  // sa carte au centre.
  const carrousel = useRef<HTMLDivElement>(null);
  const choisiCle = useRef<string | undefined>(undefined);
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
      if (cle && cle !== choisiCle.current) {
        navigator.vibrate?.(5);
        setChoix(cle);
      }
    }, 140);
  }, []);
  const cleChoisie = choisi?.cle;
  useEffect(() => {
    choisiCle.current = cleChoisie;
    const el = cleChoisie && carrousel.current?.querySelector<HTMLElement>(`[data-cle="${cleChoisie}"]`);
    if (!el) return;
    const calme = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ inline: "center", block: "nearest", behavior: calme ? "auto" : "smooth" });
  }, [cleChoisie]);
  const stickers = useMemo<StickerPlan[]>(
    () =>
      affiches
        // Deux matchs sur le même terrain (le joué, le suivant) : on ne les
        // empile pas ; le plan montre le choisi, sinon le premier.
        .filter((m, i) => {
          if (!m.terrain) return false;
          const memes = affiches.filter((x) => x.terrain?.id === m.terrain!.id);
          if (memes.some((x) => x.cle === choisi?.cle)) return m.cle === choisi?.cle;
          return affiches.indexOf(memes.find((x) => !x.joue) ?? memes[0]) === i;
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
        })),
    [affiches, choisi]
  );

  // Toi : ta position, quand tu la donnes.
  const [toi, setToi] = useState<ToiPlan | null>(null);
  const [cherchePosition, setCherchePosition] = useState(false);
  function localiser() {
    if (!("geolocation" in navigator)) {
      toast.error("Ce navigateur ne donne pas la position.");
      return;
    }
    setCherchePosition(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
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

  const ios = useEstIos();

  // La feuille de match du choisi : les équipes de sa journée, sinon celles
  // de la convocation une fois révélées (vendredi 19h ; l'admin, toujours).
  const feuille = useMemo(() => {
    if (!choisi || choisi.partie) return [];
    const deJournee = choisi.j != null ? feuilleDeJournee(journees.find((x) => x.j === choisi.j)) : [];
    if (deJournee.length || (choisi.j != null && !choisi.convoquee)) return deJournee;
    return p.equipesVisibles || admin ? feuilleDeConvocation(p.teams) : [];
  }, [choisi, journees, p.equipesVisibles, p.teams, admin]);

  const commune = choisi?.terrain?.commune ?? terrains.find((t) => t.commune)?.commune ?? "SFL";
  const n = affiches.filter((m) => !m.joue).length;
  const compte = n ? `${n} MATCH${n > 1 ? "S" : ""} OUVERT${n > 1 ? "S" : ""}` : "MATCH JOUÉ";

  function sauver(next: Saison, message: string) {
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
    <>
      {/* ─── Le plan, tout l'écran ─── */}
      <section className="fixed inset-0 isolate overflow-hidden bg-[#e9eae6] [--sous-entete:0.75rem] lg:[--sous-entete:1.25rem]">
        <div className="absolute inset-0">
          <CarteMap fond={fond} stickers={stickers} points={AUCUN_POINT} toi={toi} choisi={choisi?.cle ?? null} onChoisir={choisirSticker} className="h-full w-full" />
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
            d'onglets le 19/10), la bascule plan / satellite et, pour
            l'admin, le réglage des matchs — le lettrage garde sa place. */}
        <div className="absolute right-4 z-[510] flex flex-col items-end gap-2" style={{ top: haut }}>
          <Link
            href="/recherche"
            aria-label="Recherche"
            className="map-bord map-touche grid size-10 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
            style={{ background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
          >
            <Search className="size-[18px]" strokeWidth={2.2} />
          </Link>
          <button
            type="button"
            onClick={() => setFond((f) => (f === "plan" ? "satellite" : "plan"))}
            aria-label={fond === "plan" ? "Voir la photo satellite" : "Revenir au plan"}
            aria-pressed={fond === "satellite"}
            className="map-bord map-touche map-calques grid size-10 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
            style={fond === "satellite" ? { background: ENCRE, color: CLAIR, borderColor: "rgba(255,255,255,0.2)" } : { background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
          >
            <Layers className="size-[18px]" strokeWidth={2.2} />
          </button>
          {partiesActives && (
            <button
              type="button"
              onClick={() => setDispos(true)}
              aria-label="Mes dispos"
              className="map-bord map-touche grid size-10 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
              style={{ background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
            >
              <CalendarDays className="size-[18px]" strokeWidth={2.2} />
            </button>
          )}
          {admin && (
            <button
              type="button"
              onClick={() => ouvrirFiche(true)}
              aria-label="Régler les matchs et les terrains"
              className="map-bord map-touche grid size-10 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
              style={{ background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
            >
              <Settings2 className="size-[18px]" strokeWidth={2.2} />
            </button>
          )}
        </div>

        {/* En bas : les boutons, les cartes des matchs, les pastilles */}
        <div className="absolute inset-x-0 z-[510] flex flex-col items-center gap-3" style={{ bottom: bas }}>
          <div className="flex w-full items-center justify-center gap-2 px-4">
            {/* Tout joueur ouvre un match ; l'admin garde en plus la journée de ligue. */}
            {partiesActives && (
              <button
                type="button"
                onClick={() => setOuvrir((o) => ({ terrain: choisi?.partie ? null : (choisi?.terrain ?? null), n: (o?.n ?? 0) + 1 }))}
                className="map-monte map-touche flex h-11 items-center gap-2 rounded-full pr-[18px] pl-2 text-[15.5px] font-semibold shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
                style={{ background: ENCRE, color: CLAIR }}
              >
                <span className="grid size-7 place-items-center rounded-full" style={{ background: CLAIR, color: ENCRE }}>
                  <Plus className="size-[13px]" strokeWidth={3} />
                </span>
                Ouvrir un match
              </button>
            )}
            {admin && (
              <Link
                href="/admin"
                className="map-monte map-touche flex h-11 items-center gap-2 rounded-full px-[18px] text-[15.5px] font-semibold shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
                style={partiesActives ? { background: BLANC, color: ENCRE } : { background: ENCRE, color: CLAIR }}
              >
                {partiesActives ? "Journée" : "Ouvrir un match"}
              </Link>
            )}
            <button
              type="button"
              onClick={localiser}
              aria-label={toi ? "Revenir sur toi" : "Activer la localisation"}
              className="map-monte map-touche absolute right-4 grid size-11 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
              style={{ background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
            >
              <LocateFixed className={cn("size-4", cherchePosition && "animate-pulse")} strokeWidth={2.4} />
            </button>
          </div>

          {/* Le carrousel : une carte par match, celle du centre est la choisie.
              Toucher la choisie ouvre sa fiche. */}
          <div
            ref={carrousel}
            onScroll={suivreCarrousel}
            className="flex w-full snap-x snap-mandatory items-end gap-3 overflow-x-auto pr-[max(1rem,calc(50%-103px))] pb-3 [scrollbar-width:none]"
            style={{ paddingLeft: `max(1rem, calc(50% - ${affiches[0]?.joue ? LARGEUR_JOUE / 2 + 5 : 103}px))` }}
          >
            {affiches.map((m, i) => (
              <div key={m.cle} data-cle={m.cle} className="map-monte shrink-0 snap-center" style={{ ["--i" as string]: i + 1 }}>
                <CarteMatch
                  m={m}
                  choisi={m.cle === choisi?.cle}
                  une={m.cle === une?.cle && !m.joue}
                  dans={m.joue ? null : ecartJours(m.dateLabel, aujourdhui)}
                  loin={toi && m.terrain ? `à ${distanceLisible(toi, m.terrain)}` : null}
                  onToucher={() => (m.cle !== choisi?.cle ? setChoix(m.cle) : ouvrirFiche())}
                />
              </div>
            ))}
          </div>

          {choisi && (
            <div className="flex max-w-full items-center gap-2 px-4">
              {choisi.terrain ? (
                <>
                  <button
                    type="button"
                    onClick={() => ouvrirFiche()}
                    className="flex h-[30px] min-w-0 items-center gap-[7px] rounded-full px-3.5 shadow-[0_3px_6px_rgba(0,0,0,0.14)]"
                    style={{ background: BLANC, color: ENCRE }}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: ENCRE }} />
                    <span className="truncate text-[13px] font-semibold tracking-[-0.2px]">{choisi.terrain.nom}</span>
                  </button>
                  <a
                    href={urlItineraire(choisi.terrain, ios)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-[30px] shrink-0 items-center gap-[5px] rounded-full px-3 text-[12.5px] font-semibold shadow-[0_3px_6px_rgba(0,0,0,0.14)]"
                    style={{ background: BLANC, color: ENCRE }}
                  >
                    <Navigation className="size-[11px]" strokeWidth={2.6} /> Y aller
                  </a>
                </>
              ) : choisi.partie ? (
                <button
                  type="button"
                  onClick={() => ouvrirFiche()}
                  className="flex h-[30px] items-center rounded-full px-3.5 text-[13px] font-semibold shadow-[0_3px_6px_rgba(0,0,0,0.14)]"
                  style={{ background: BLANC, color: ENCRE }}
                >
                  {choisi.partie.lieu}
                </button>
              ) : admin ? (
                <button
                  type="button"
                  onClick={() => ouvrirFiche(true)}
                  className="flex h-[30px] items-center gap-[7px] rounded-full px-3.5 text-[13px] font-semibold shadow-[0_3px_6px_rgba(0,0,0,0.14)]"
                  style={{ background: BRAISE, color: ENCRE }}
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
      </section>

      {/* ─── La fiche : présence, lieu, et pour l'admin les réglages ─── */}
      <Sheet open={fiche} onOpenChange={setFiche}>
        <SheetContent side="bottom" className="max-h-[88dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <SheetHeader className="px-5 pt-5 pb-0">
            <p className="mono-label text-muted-foreground">
              {choisi?.partie ? `Ouvert par ${choisi.partie.organisateur}` : `${choisi?.j != null ? `J${choisi.j} · ` : ""}Sunday Five League`}
            </p>
            <SheetTitle className="text-[26px] font-bold tracking-tight">
              {ficheAdmin ? "Les matchs" : (choisi?.terrain?.nom ?? choisi?.partie?.lieu ?? (choisi?.j != null ? `Journée ${choisi.j}` : "Le match"))}
            </SheetTitle>
            {!ficheAdmin && choisi && (
              <p className="text-[14px] text-muted-foreground">
                {choisi.joue ? `Le match du ${dateLongue(choisi.dateLabel, aujourdhui)} · joué` : choisi.quand.titre} · {choisi.heure}
                {choisi.terrain ? ` · ${choisi.terrain.adresse}` : " · lieu à venir"}
              </p>
            )}
          </SheetHeader>
          <div className="flex flex-col gap-5 px-4">
            {ficheAdmin ? (
              <>
                <OuSeJouent saison={saison} matchs={ligue} terrains={terrains} onSauver={sauver} />
                <Terrains saison={saison} terrains={terrains} onSauver={sauver} />
              </>
            ) : (
              <>
                {choisi?.terrain && <Itineraire terrain={choisi.terrain} ios={ios} />}
                {/* Une journée : ses joueurs. La convocation : on y répond, comme avant. */}
                {choisi?.partie ? (
                  <FichePartie partie={choisi.partie} moi={moi} onChange={recharger} />
                ) : choisi?.j != null && !choisi.convoquee ? (
                  // Les équipes faites, la feuille de match dit déjà qui vient.
                  feuille.length === 0 && <Presents m={choisi} />
                ) : (
                  <PresencePanel />
                )}
                {choisi && feuille.length > 0 && (
                  <FeuilleDeMatch
                    key={choisi.cle}
                    terrains={feuille}
                    moi={player.name}
                    entete={{
                      surtitre: `${choisi.j != null ? `J${choisi.j} · ` : ""}Sunday Five League`,
                      quand: `${dateComplete(choisi.dateLabel, aujourdhui)} · ${choisi.heure}`,
                      ou: choisi.terrain ? choisi.terrain.nom : null,
                    }}
                  />
                )}
                {choisi?.joue && (
                  <Link
                    href="/ligue"
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background"
                  >
                    Voir le récap de la journée
                  </Link>
                )}
                {admin && !choisi?.partie && (
                  <button
                    type="button"
                    onClick={() => setFicheAdmin(true)}
                    className="flex h-11 items-center justify-center gap-2 rounded-full bg-secondary text-[14px] font-semibold"
                  >
                    <Settings2 className="size-4" /> Date, heure et adresse des matchs
                  </button>
                )}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {ouvrir && (
        <OuvrirMatch
          key={ouvrir.n}
          open
          onOpenChange={(o) => !o && setOuvrir(null)}
          terrains={terrains}
          terrainInitial={ouvrir.terrain}
          jourInitial={ouvrir.jour}
          heureInitial={ouvrir.heure}
          moi={moi}
          onOuvert={(id) => {
            recharger();
            setChoix(`m${id}`);
          }}
        />
      )}
      <MesDispos
        open={dispos}
        onOpenChange={setDispos}
        moi={moi}
        onOuvrir={(jour, h) => {
          setDispos(false);
          setOuvrir((o) => ({ terrain: null, jour, heure: h, n: (o?.n ?? 0) + 1 }));
        }}
      />
    </>
  );
}

/* ------------------------- La carte d'un match ------------------------- */

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
  onToucher,
}: {
  m: MatchMap;
  choisi: boolean;
  /** Le prochain match : la une de la Map, avec ses places. */
  une: boolean;
  /** Les jours avant le match (null : joué ou date illisible). */
  dans: number | null;
  loin: string | null;
  onToucher: () => void;
}) {
  const [c0, c1, c2] = FOND_MOMENT[m.quand.moment];
  const complet = m.etat.genre === "complet";
  const inscrits = m.etat.genre === "inscrits";
  const joue = !!m.joue;
  const titre = m.quand.titre;
  const rebours = compteARebours(dans);
  const [l, h] = joue ? [LARGEUR_JOUE, 104] : [196, 140];
  // Les places d'un match ouvert par un joueur : une encoche par joueur
  // attendu ; les vides sont celles qu'il manque, en braise. Une journée de
  // ligue n'a pas de plafond : pas de jauge, le compte des participants.
  const places = joue || !m.partie ? 0 : Math.min(m.effectif, 14);
  const venus = Math.min(m.presents.length, places);
  return (
    <div className={cn("carte-match relative", choisi && "carte-match--choisie", joue && "carte-match--joue")}>
      <button
        type="button"
        onClick={onToucher}
        className={cn("block p-[5px] text-left", joue ? "rounded-[20px] shadow-[0_5px_9px_rgba(0,0,0,0.18)]" : "rounded-[24px] shadow-[0_8px_12px_rgba(0,0,0,0.22)]")}
        style={{ background: BLANC }}
        aria-label={`${titre} ${m.heure}${m.terrain ? `, ${m.terrain.nom}` : ""}, ${m.etatTexte}`}
        aria-pressed={choisi}
      >
        <div
          className={cn("relative overflow-hidden", joue ? "rounded-[15px]" : "rounded-[19px]")}
          style={{ width: l, height: h, background: `linear-gradient(180deg, ${c0}, ${c1} 50%, ${c2})` }}
        >
          {m.terrain ? (
            // La vue aérienne du vrai terrain, comme dans l'app iPhone.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoSatellite(m.terrain.lat, m.terrain.lng, 392, 280, 0.0009)}
              alt=""
              loading="lazy"
              className={cn("absolute inset-0 h-full w-full object-cover", joue ? "grayscale" : complet && "saturate-[0.35]")}
            />
          ) : (
            <div
              className={cn("absolute top-1/2 left-1/2 size-[118px] -translate-x-1/2 -translate-y-[calc(50%+14px)]", (complet || joue) && "saturate-0")}
              dangerouslySetInnerHTML={{ __html: stadeSvg(m.quand.moment, { fond: false }) }}
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
            {!inscrits && <Jeton texte={m.etatTexte} ton={m.etat.genre} petit={joue} />}
            {!joue && (loin || rebours) && <Jeton texte={loin ?? rebours!} ton="neutre" />}
          </div>
          <div className={cn("absolute inset-x-0 bottom-0", joue ? "px-2.5 pb-2.5" : "px-3 pb-3")}>
            <p
              className="truncate font-black uppercase text-white/85"
              style={{ fontSize: joue ? 22 : titre.length > 10 ? 22 : titre.length > 7 ? 28 : 34, letterSpacing: joue ? -0.9 : -1.4, lineHeight: 1 }}
            >
              {titre}
            </p>
            <p className={cn("mt-1 truncate font-mono font-bold text-white/70 uppercase", joue ? "text-[8.5px] tracking-[0.8px]" : "text-[9.5px] tracking-[1px]")}>
              {heureCourte(m.heure)} ·{" "}
              {m.partie
                ? `${m.partie.genre === "exhibition" ? "Exhibition" : m.partie.visibilite === "prive" ? "Privé" : "Public"} · ${m.partie.organisateur}`
                : `${m.j != null ? `J${m.j} · ` : ""}Sunday Five`}
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
                        : { background: complet ? "rgba(255,255,255,0.25)" : "rgba(255,138,76,0.28)", boxShadow: complet ? undefined : `inset 0 0 0 1px ${BRAISE}`, ["--i" as string]: i - venus }
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </button>
      {!joue && m.presents.length > 0 && (
        <div className="pointer-events-none absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center" aria-hidden>
          {m.presents.slice(0, 3).map((nom, i) => (
            <span
              key={nom}
              className="grid size-6 place-items-center rounded-full border-[1.5px] text-[12px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
              style={{ background: teinte(nom), color: "rgba(10,11,13,0.78)", borderColor: BLANC, marginLeft: i ? -8 : 0 }}
            >
              {nom[0]}
            </span>
          ))}
          {m.presents.length > 3 && (
            <span
              className="-ml-2 flex h-6 items-center rounded-full border-[1.5px] px-1.5 text-[9px] font-bold"
              style={{ background: ENCRE, color: BLANC, borderColor: BLANC }}
            >
              +{m.presents.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** La photo satellite du terrain, et les trois façons d'y aller. */
function Itineraire({ terrain, ios }: { terrain: Terrain; ios: boolean }) {
  const liens = itineraires(terrain.lat, terrain.lng, terrain.nom);
  // Sur iPhone, Plans d'abord ; ailleurs, Google Maps d'abord.
  const ordre = ios ? liens : [liens[1], liens[0], liens[2]];
  return (
    <section className="flex flex-col gap-3">
      <div className="relative h-[200px] overflow-hidden rounded-[22px] border border-border bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSatellite(terrain.lat, terrain.lng, 800, 400, 0.0011)} alt={`Vue satellite de ${terrain.nom}`} className="h-full w-full object-cover" />
        {/* L'épingle sur le terrain : la photo est centrée sur lui. */}
        <span className="ajuster-pin pointer-events-none" style={{ left: "50%", top: "50%", cursor: "default" }} aria-hidden />
        <span className="absolute bottom-2 left-2 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
          {terrain.adresse || terrain.nom}
        </span>
      </div>
      <a
        href={ordre[0].url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground"
      >
        <Navigation className="size-4" /> Itinéraire avec {ordre[0].libelle}
      </a>
      <div className="grid grid-cols-2 gap-2">
        {ordre.slice(1).map((l) => (
          <a
            key={l.id}
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center rounded-full bg-secondary text-[14px] font-semibold"
          >
            {l.libelle}
          </a>
        ))}
      </div>
    </section>
  );
}

/** Les joueurs d'une journée, tels que l'admin les a convoqués. */
function Presents({ m }: { m: MatchMap }) {
  return (
    <section className="rounded-[26px] bg-card p-5">
      <div className="flex items-baseline justify-between">
        <p className="mono-label text-muted-foreground">{m.joue ? "Ils ont joué" : "Les joueurs"}</p>
        <p className="text-[22px] font-bold tabular-nums">
          {m.presents.length}
          <span className="text-muted-foreground">/{m.effectif}</span>
        </p>
      </div>
      {m.presents.length ? (
        <QuiVient className="mt-3" noms={m.presents} />
      ) : (
        <p className="mt-2 text-[13px] text-muted-foreground">Les joueurs arrivent avec la composition des équipes.</p>
      )}
      {m.dedans && <p className="mono-label mt-3 text-foreground">{m.joue ? "Tu y étais" : "Tu y es"}</p>}
    </section>
  );
}

function Jeton({ texte, ton, petit }: { texte: string; ton: EtatSticker["genre"] | "neutre"; petit?: boolean }) {
  const style =
    ton === "dedans"
      ? { background: CLAIR, color: ENCRE }
      : { background: "rgba(14,17,21,0.72)", color: ton === "manque" ? BRAISE : ton === "complet" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.15)" };
  return (
    <span className={cn("truncate rounded-full font-medium", petit ? "px-2 py-[3px] text-[10px]" : "px-2.5 py-[4.5px] text-[11px]")} style={style}>
      {texte}
    </span>
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
        className="font-semibold"
      >
        <MapPin className="size-4" /> {bouton}
      </Button>
    </div>
  );
}

/** Où se joue chaque match ouvert : son terrain, son heure, sa date. */
function OuSeJouent({
  saison,
  matchs,
  terrains,
  onSauver,
}: {
  saison: Saison;
  matchs: MatchMap[];
  terrains: Terrain[];
  onSauver: (next: Saison, message: string) => void;
}) {
  const [nouvelle, setNouvelle] = useState<number | "convocation" | null>(null);
  const journees = matchs.filter((m) => m.j != null);
  const meta = (j: number) => saison.journees.find((x) => x.j === j) as JourneeMeta;

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
            return (
              <li key={m.cle} className="flex flex-col gap-3 border-t border-border/60 px-5 py-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[15px] font-bold tracking-tight">
                    J{j} · {m.quand.titre}
                  </p>
                  <span className={cn("mono-label", m.terrain ? "text-muted-foreground" : "text-braise")}>
                    {m.terrain ? (mj.terrainId != null ? "sur la map" : "terrain par défaut") : "sans adresse"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
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
                      key={`h${j}-${mj.heure ?? m.heure}`}
                      defaultValue={mj.heure ?? m.heure}
                      placeholder="13h00"
                      onBlur={(e) => e.target.value.trim() && e.target.value !== (mj.heure ?? m.heure) && onSauver(updateJournee(saison, j, { heure: e.target.value.trim() }), `J${j} à ${e.target.value.trim()}.`)}
                    />
                  </label>
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[12px] text-muted-foreground">Terrain</span>
                  <select
                    value={nouvelle === j ? "nouveau" : (mj.terrainId ?? "")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "nouveau") return setNouvelle(j);
                      setNouvelle(null);
                      onSauver(updateJournee(saison, j, { terrainId: v ? Number(v) : undefined }), `J${j} : terrain enregistré.`);
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
                  className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
                >
                  <Star className="size-4" />
                </button>
              )}
              <button
                type="button"
                aria-label={`Ajuster ${t.nom} sur la photo satellite`}
                aria-pressed={ajuste === t.id}
                onClick={() => setAjuste((x) => (x === t.id ? null : t.id))}
                className={cn("grid size-8 place-items-center rounded-full", ajuste === t.id ? "bg-foreground text-background" : "bg-secondary text-muted-foreground")}
              >
                <Crosshair className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Retirer ${t.nom}`}
                onClick={() => onSauver(retirerTerrain(saison, t.id), `${t.nom} retiré de la Map.`)}
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
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
