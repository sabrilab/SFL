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
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { LocateFixed, MapPin, Navigation, Plus, Search, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { SAISIE_EVENT, useSeason } from "@/components/sfl/season-provider";
import { usePresence } from "@/hooks/use-presence";
import { useSession } from "@/hooks/use-session";
import { saisieStore } from "@/lib/sfl/saisie/store";
import {
  ajouterTerrain,
  definirTerrainParDefaut,
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
import { FOND_MOMENT, heureCourte, stadeSvg, type EtatSticker, type Moment, type StickerPlan } from "@/components/sfl/map/stade";
import type { PointPlan, ToiPlan } from "@/components/sfl/map/carte-map";

const CarteMap = dynamic(() => import("@/components/sfl/map/carte-map").then((m) => m.CarteMap), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#e9eae6]" aria-hidden />,
});

interface Lieu {
  lat: number;
  lng: number;
  libelle: string;
  commune?: string;
}

const ENCRE = "#0A0B0D";
const CLAIR = "#EFEFEC";
const BLANC = "#F4F5F2";
const BRAISE = "#FF8A4C";
/** Les teintes des avatars de la grappe (des gris, comme dans l'app). */
const TEINTES = ["#CFCFCF", "#A4A4A4", "#F0F0F0", "#C4C4C4", "#E2E2DE", "#B8B8B4"];
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
    return { titre: dateLabel, jourCourt: dateLabel.toUpperCase().slice(0, 7), moment: weekend ? "weekend" : "semaine" };
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
}

function etatDe(dedans: boolean, manque: number): { etat: EtatSticker; texte: string } {
  if (dedans) return { etat: { genre: "dedans" }, texte: "Tu y es" };
  if (manque > 0) return { etat: { genre: "manque", n: manque }, texte: `Il manque ${manque}` };
  return { etat: { genre: "complet" }, texte: "Complet" };
}

export default function MapPage() {
  const { saison } = useSeason();
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();
  const { player } = useMyPlayer();
  const aujourdhui = useAujourdhui();

  const terrains = useMemo(() => saison.terrains ?? [], [saison.terrains]);

  // Les journées pas encore jouées, chacune sur son terrain ; sinon la convocation.
  const matchs = useMemo<MatchMap[]>(() => {
    const ouvertes = saison.journees.filter((m) => !journeeJouee(saison, m.j)).sort((a, b) => a.j - b.j);
    if (ouvertes.length) {
      return ouvertes.map((m) => {
        const lignes = saison.entries.filter((e) => e.j === m.j);
        const presents = lignes.filter((e) => e.statut === "Présent").map((e) => e.player);
        const effectif = Math.max(EFFECTIF, lignes.length);
        const dedans = presents.includes(player.name);
        const { etat, texte } = etatDe(dedans, Math.max(0, effectif - presents.length));
        return {
          cle: `j${m.j}`,
          j: m.j,
          quand: quand(m.date, null, aujourdhui),
          dateLabel: m.date,
          heure: m.heure || p.heure,
          terrain: terrainDeJournee(saison, m, p.lieu),
          presents,
          effectif,
          dedans,
          etat,
          etatTexte: texte,
        };
      });
    }
    const dedans = p.mine === "present";
    const { etat, texte } = etatDe(dedans, Math.max(0, p.effectif - p.presents.length));
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
    ];
  }, [saison, player.name, aujourdhui, p.heure, p.lieu, p.jour, p.mine, p.effectif, p.presents]);

  const stickers = useMemo<StickerPlan[]>(
    () =>
      matchs
        .filter((m) => m.terrain)
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
    [matchs]
  );
  const points = useMemo<PointPlan[]>(() => {
    const occupes = new Set(matchs.map((m) => m.terrain?.id));
    return terrains.filter((t) => !occupes.has(t.id)).map((t) => ({ id: `p${t.id}`, lat: t.lat, lng: t.lng, nom: t.nom }));
  }, [terrains, matchs]);

  const [choix, setChoix] = useState<string | null>(null);
  const choisirSticker = useCallback((id: string) => setChoix(id), []);
  // Le match choisi : celui qu'on a touché s'il est encore là, sinon le premier.
  const choisi = matchs.find((m) => m.cle === choix) ?? matchs[0];

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

  const commune = choisi?.terrain?.commune ?? terrains.find((t) => t.commune)?.commune ?? "SFL";
  const n = matchs.length;
  const compte = `${n} MATCH${n > 1 ? "S" : ""} OUVERT${n > 1 ? "S" : ""}`;

  function sauver(next: Saison, message: string) {
    saisieStore.save(next);
    window.dispatchEvent(new Event(SAISIE_EVENT));
    toast.success(message);
  }

  const versAdresse = () => document.getElementById("ou-se-joue")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Le plan, pleine largeur sur téléphone ─── */}
      <section className="relative isolate h-[calc(100dvh-14.5rem)] min-h-[560px] w-full overflow-hidden bg-[#e9eae6] sm:mx-auto sm:h-[640px] sm:max-w-[1000px] sm:rounded-[28px]">
        <div className="absolute inset-0">
          <CarteMap stickers={stickers} points={points} toi={toi} choisi={choisi?.cle ?? null} onChoisir={choisirSticker} className="h-full w-full" />
        </div>
        {/* Voile en haut : le lettrage et l'en-tête restent lisibles sur le plan.
            Tout ce qui est posé sur le plan passe au-dessus des calques de
            Leaflet (z-index 400 et plus). */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] h-36 bg-gradient-to-b from-[rgba(8,9,11,0.45)] to-transparent" />

        {/* La commune en lettrage, le compte en étiquette — sous l'en-tête de l'app */}
        <div className="pointer-events-none absolute top-[4.75rem] left-5 z-[510] flex flex-col items-start">
          <span
            className="lettrage -rotate-[4deg]"
            style={{ ["--taille" as string]: commune.length <= 7 ? "34px" : commune.length <= 10 ? "28px" : commune.length <= 14 ? "22px" : "18px" }}
          >
            {commune}
          </span>
          <span
            className="-mt-1 ml-2.5 inline-flex h-[19px] rotate-[3deg] items-center rounded-full border-[1.5px] px-2 font-mono text-[9px] font-bold tracking-[1.2px] shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
            style={{ background: ENCRE, color: BLANC, borderColor: BLANC }}
          >
            {compte}
          </span>
        </div>

        {/* En bas : les boutons, les cartes des matchs, les pastilles */}
        <div className="absolute inset-x-0 bottom-0 z-[510] flex flex-col items-center gap-3 pb-4">
          <div className="flex w-full items-center justify-center px-4">
            {admin && (
              <Link
                href="/admin"
                className="flex h-11 items-center gap-2 rounded-full pr-[18px] pl-2 text-[15.5px] font-semibold shadow-[0_6px_10px_rgba(0,0,0,0.22)]"
                style={{ background: ENCRE, color: CLAIR }}
              >
                <span className="grid size-7 place-items-center rounded-full" style={{ background: CLAIR, color: ENCRE }}>
                  <Plus className="size-[13px]" strokeWidth={3} />
                </span>
                Ouvrir un match
              </Link>
            )}
            <button
              type="button"
              onClick={localiser}
              aria-label={toi ? "Revenir sur toi" : "Activer la localisation"}
              className="absolute right-4 grid size-11 place-items-center rounded-full border shadow-[0_3px_8px_rgba(0,0,0,0.16)]"
              style={{ background: BLANC, color: ENCRE, borderColor: "rgba(10,11,13,0.1)" }}
            >
              <LocateFixed className={cn("size-4", cherchePosition && "animate-pulse")} strokeWidth={2.4} />
            </button>
          </div>

          {/* Le carrousel : une carte par match, celle du centre est la choisie. */}
          <div className="flex w-full snap-x snap-mandatory gap-3 overflow-x-auto px-[max(1rem,calc(50%-103px))] pb-3 [scrollbar-width:none]">
            {matchs.map((m) => (
              <div key={m.cle} className="shrink-0 snap-center">
                <CarteMatch
                  m={m}
                  choisi={m.cle === choisi?.cle}
                  loin={toi && m.terrain ? `à ${distanceLisible(toi, m.terrain)}` : null}
                  onToucher={() => {
                    if (m.cle !== choisi?.cle) setChoix(m.cle);
                    else document.getElementById("presence")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                />
              </div>
            ))}
          </div>

          {choisi && (
            <div className="flex max-w-full items-center gap-2 px-4">
              {choisi.terrain ? (
                <>
                  <span className="flex h-[30px] min-w-0 items-center gap-[7px] rounded-full px-3.5 shadow-[0_3px_6px_rgba(0,0,0,0.14)]" style={{ background: BLANC, color: ENCRE }}>
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: ENCRE }} />
                    <span className="truncate text-[13px] font-semibold tracking-[-0.2px]">{choisi.terrain.nom}</span>
                  </span>
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
              ) : admin ? (
                <button
                  type="button"
                  onClick={versAdresse}
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

      {/* ─── Sous le plan : répondre à la convocation, comme avant ─── */}
      <div className="shell flex flex-col gap-5">
        {admin && <OuSeJouent saison={saison} matchs={matchs} terrains={terrains} onSauver={sauver} />}
        <div id="presence" className="scroll-mt-4">
          <PresencePanel />
        </div>
        {admin && <Terrains saison={saison} terrains={terrains} onSauver={sauver} />}
      </div>
    </div>
  );
}

/* ------------------------- La carte d'un match ------------------------- */

function CarteMatch({
  m,
  choisi,
  loin,
  onToucher,
}: {
  m: MatchMap;
  choisi: boolean;
  loin: string | null;
  onToucher: () => void;
}) {
  const [c0, c1, c2] = FOND_MOMENT[m.quand.moment];
  const complet = m.etat.genre === "complet";
  const titre = m.quand.titre;
  return (
    <div className={cn("relative transition-transform duration-300", !choisi && "scale-[0.88] opacity-80")}>
      <button
        type="button"
        onClick={onToucher}
        className="block rounded-[24px] p-[5px] text-left shadow-[0_8px_12px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC }}
        aria-label={`${titre} ${m.heure}${m.terrain ? `, ${m.terrain.nom}` : ""}, ${m.etatTexte}`}
        aria-pressed={choisi}
      >
        <div className="relative h-[140px] w-[196px] overflow-hidden rounded-[19px]" style={{ background: `linear-gradient(180deg, ${c0}, ${c1} 50%, ${c2})` }}>
          <div
            className={cn("absolute top-1/2 left-1/2 size-[118px] -translate-x-1/2 -translate-y-[calc(50%+14px)]", complet && "saturate-0")}
            dangerouslySetInnerHTML={{ __html: stadeSvg(m.quand.moment, { fond: false }) }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-b from-transparent via-[rgba(4,5,7,0.4)] to-[rgba(3,4,6,0.82)]" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-2.5">
            <Jeton texte={m.etatTexte} ton={m.etat.genre} />
            {loin && <Jeton texte={loin} ton="neutre" />}
          </div>
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3.5">
            <p
              className="truncate font-black uppercase text-white/85"
              style={{ fontSize: titre.length > 8 ? 26 : 34, letterSpacing: -1.4, lineHeight: 1 }}
            >
              {titre}
            </p>
            <p className="mt-1 truncate font-mono text-[9.5px] font-bold tracking-[1px] text-white/70 uppercase">
              {heureCourte(m.heure)} · {m.j != null ? `J${m.j} · ` : ""}Sunday Five
            </p>
          </div>
        </div>
      </button>
      {m.presents.length > 0 && (
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

function Jeton({ texte, ton }: { texte: string; ton: "manque" | "dedans" | "complet" | "neutre" }) {
  const style =
    ton === "dedans"
      ? { background: CLAIR, color: ENCRE }
      : { background: "rgba(14,17,21,0.72)", color: ton === "manque" ? BRAISE : ton === "complet" ? "rgba(255,255,255,0.5)" : "rgba(255,255,255,0.92)", boxShadow: "inset 0 0 0 0.5px rgba(255,255,255,0.15)" };
  return (
    <span className="truncate rounded-full px-2.5 py-[4.5px] text-[11px] font-medium" style={style}>
      {texte}
    </span>
  );
}

/* ----------------------------- Côté admin ----------------------------- */

/** Une adresse → les lieux possibles ; l'admin choisit le bon. */
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

  async function chercher() {
    const q = adresse.trim();
    if (q.length < 3) return;
    setCherche(true);
    setChoisi(null);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const data = (await res.json()) as { resultats: Lieu[]; erreur?: string };
      if (data.erreur) toast.error(data.erreur);
      setLieux(data.resultats ?? []);
      if (data.resultats?.length) setChoisi(data.resultats[0]);
      if (!data.erreur && !data.resultats?.length) toast.error("Aucun lieu trouvé pour cette adresse. Ajoute la ville.");
    } catch {
      toast.error("Le service d'adresses est injoignable.");
    } finally {
      setCherche(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Nom du terrain</span>
        <Input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Five du canal" maxLength={40} />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Adresse</span>
        <div className="flex gap-2">
          <Input
            value={adresse}
            onChange={(e) => {
              setAdresse(e.target.value);
              setLieux([]);
              setChoisi(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void chercher();
              }
            }}
            placeholder="12 rue du Stade, Lille"
          />
          <Button type="button" variant="secondary" disabled={cherche || adresse.trim().length < 3} onClick={chercher}>
            <Search className="size-4" /> {cherche ? "…" : "Chercher"}
          </Button>
        </div>
      </label>

      {lieux.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {lieux.map((l) => (
            <li key={`${l.lat},${l.lng}`}>
              <button
                type="button"
                onClick={() => setChoisi(l)}
                aria-pressed={choisi === l}
                className={cn(
                  "w-full rounded-xl border px-3 py-2 text-left text-[12px] leading-snug",
                  choisi === l ? "border-foreground bg-secondary" : "border-border text-muted-foreground"
                )}
              >
                {l.libelle}
              </button>
            </li>
          ))}
        </ul>
      )}

      <Button
        disabled={!choisi || !nom.trim()}
        onClick={() => {
          if (!choisi || !nom.trim()) return;
          onPlacer(nom.trim(), adresse.trim(), choisi);
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
  return (
    <section className="overflow-hidden rounded-[26px] bg-card">
      <div className="px-5 pt-4 pb-3">
        <p className="mono-label text-muted-foreground">Admin · terrains</p>
        <h2 className="mt-0.5 text-[17px] font-bold tracking-tight">Les terrains de la ligue</h2>
      </div>

      {terrains.length > 0 && (
        <ul className="border-t border-border/60">
          {terrains.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-b-0">
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
                aria-label={`Retirer ${t.nom}`}
                onClick={() => onSauver(retirerTerrain(saison, t.id), `${t.nom} retiré de la Map.`)}
                className="grid size-8 place-items-center rounded-full bg-secondary text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </button>
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
