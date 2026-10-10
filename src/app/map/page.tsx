"use client";

// La Map — la première section de l'app, à l'image de la carte de « Jouer »
// de l'app iOS BOLA : un plan clair, le match de la Sunday Five League posé en
// sticker mini-stade sur son terrain, la commune en lettrage découpé, le
// compte des matchs en étiquette, et en bas la carte du match dans son bord
// blanc, avec le lieu et le chemin pour y aller. « Toi » apparaît quand tu
// donnes ta position.
//
// Ici, les matchs sont ceux de la SFL : la convocation ouverte. On y répond
// comme avant, depuis le tableau de présence sous la carte. Les terrains
// vivent dans la saison (`saison.terrains`) : l'admin les pose une fois, avec
// leur adresse ; la convocation garde son lieu en texte et la Map retrouve le
// terrain par son nom (sinon le terrain par défaut).

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
  retirerTerrain,
  terrainDuMatch,
} from "@/lib/sfl/saisie/mutations";
import type { Saison, Terrain } from "@/lib/sfl/saisie/types";
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

function teinte(nom: string): string {
  let h = 0;
  for (const c of nom) h = (h * 31 + (c.codePointAt(0) ?? 0)) >>> 0;
  return TEINTES[h % TEINTES.length];
}

/** Le jour de la semaine à Paris, 1 = lundi … 7 = dimanche. */
function jourIsoParis(d = new Date()): number {
  const nom = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", weekday: "short" }).format(d);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(nom) + 1;
}

// Deux lectures du navigateur, rendues 0 / false côté serveur pour que
// l'hydratation parte du même point, puis vraies au premier rendu client.
const rienAEcouter = () => () => {};
const useJourIso = () => useSyncExternalStore(rienAEcouter, jourIsoParis, () => 0);
const useEstIos = () =>
  useSyncExternalStore(rienAEcouter, () => /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent), () => false);

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

export default function MapPage() {
  const { saison } = useSeason();
  const session = useSession();
  const admin = !!session?.admin;
  const p = usePresence();
  const { player } = useMyPlayer();

  const terrains = useMemo(() => saison.terrains ?? [], [saison.terrains]);
  const terrainMatch = useMemo(() => terrainDuMatch(saison, p.lieu), [saison, p.lieu]);

  // Le moment et les libellés du match : aujourd'hui, demain, ou dimanche.
  const jourIso = useJourIso();
  const dimanche = p.jour.toLowerCase().startsWith("dim");
  const aujourdhui = dimanche ? jourIso === 7 : false;
  const demain = dimanche ? jourIso === 6 : false;
  const moment: Moment = aujourdhui ? "jour" : dimanche ? "weekend" : "semaine";
  const titre = aujourdhui ? "Aujourd'hui" : demain ? "Demain" : p.jour;
  const jourCourt = aujourdhui ? "AUJ." : demain ? "DEMAIN" : `${p.jour.slice(0, 3)}.`;

  const manque = Math.max(0, p.effectif - p.presents.length);
  const dedans = p.mine === "present";
  const etat = useMemo<EtatSticker>(
    () => (dedans ? { genre: "dedans" } : manque > 0 ? { genre: "manque", n: manque } : { genre: "complet" }),
    [dedans, manque]
  );
  const etatTexte = dedans ? "Tu y es" : manque > 0 ? `Il manque ${manque}` : "Complet";

  const stickers = useMemo<StickerPlan[]>(
    () =>
      terrainMatch
        ? [{ id: `t${terrainMatch.id}`, lat: terrainMatch.lat, lng: terrainMatch.lng, moment, jourCourt, heure: p.heure, etat, nom: terrainMatch.nom }]
        : [],
    [terrainMatch, moment, jourCourt, p.heure, etat]
  );
  const points = useMemo<PointPlan[]>(
    () => terrains.filter((t) => t.id !== terrainMatch?.id).map((t) => ({ id: `p${t.id}`, lat: t.lat, lng: t.lng, nom: t.nom })),
    [terrains, terrainMatch]
  );
  const [choix, setChoix] = useState<string | null>(null);
  const choisirSticker = useCallback((id: string) => setChoix(id), []);
  // Le sticker choisi : celui qu'on a touché s'il est encore là, sinon le premier.
  const choisi = choix && stickers.some((s) => s.id === choix) ? choix : (stickers[0]?.id ?? null);

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

  const commune = terrainMatch?.commune ?? terrains.find((t) => t.commune)?.commune ?? "SFL";
  const compte = !terrains.length ? "AUCUN TERRAIN" : terrainMatch ? "1 MATCH OUVERT" : "RIEN D'OUVERT";
  const loin = toi && terrainMatch ? `à ${distanceLisible(toi, terrainMatch)}` : null;

  function sauver(next: Saison, message: string) {
    saisieStore.save(next);
    window.dispatchEvent(new Event(SAISIE_EVENT));
    toast.success(message);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* ─── Le plan, pleine largeur sur téléphone ─── */}
      <section className="relative isolate h-[calc(100dvh-14.5rem)] min-h-[560px] w-full overflow-hidden bg-[#e9eae6] sm:mx-auto sm:h-[640px] sm:max-w-[1000px] sm:rounded-[28px]">
        <div className="absolute inset-0">
          <CarteMap stickers={stickers} points={points} toi={toi} choisi={choisi} onChoisir={choisirSticker} className="h-full w-full" />
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

        {/* En bas : les boutons, la carte du match, les pastilles */}
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

          {terrainMatch ? (
            <>
              <CarteMatch
                titre={titre}
                heure={p.heure}
                moment={moment}
                etatTexte={etatTexte}
                etat={etat}
                loin={loin}
                presents={p.presents}
                onOuvrir={() => document.getElementById("presence")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              />
              <div className="flex max-w-full items-center gap-2 px-4">
                <span className="flex h-[30px] min-w-0 items-center gap-[7px] rounded-full px-3.5 shadow-[0_3px_6px_rgba(0,0,0,0.14)]" style={{ background: BLANC, color: ENCRE }}>
                  <span className="size-1.5 shrink-0 rounded-full" style={{ background: ENCRE }} />
                  <span className="truncate text-[13px] font-semibold tracking-[-0.2px]">{terrainMatch.nom}</span>
                </span>
                <a
                  href={urlItineraire(terrainMatch, ios)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-[30px] shrink-0 items-center gap-[5px] rounded-full px-3 text-[12.5px] font-semibold shadow-[0_3px_6px_rgba(0,0,0,0.14)]"
                  style={{ background: BLANC, color: ENCRE }}
                >
                  <Navigation className="size-[11px]" strokeWidth={2.6} /> Y aller
                </a>
              </div>
            </>
          ) : (
            <CarteVide texte={terrains.length ? "Rien d'ouvert" : "Aucun terrain"} />
          )}
        </div>
      </section>

      {/* ─── Sous le plan : répondre à la convocation, comme avant ─── */}
      <div className="shell flex flex-col gap-5">
        <div id="presence" className="scroll-mt-4">
          <PresencePanel />
        </div>
        {terrainMatch && (
          <p className="px-1 text-[13px] text-muted-foreground">
            {terrainMatch.nom} · {terrainMatch.adresse}
          </p>
        )}
        {admin && <Terrains saison={saison} terrains={terrains} onSauver={sauver} />}
      </div>
    </div>
  );
}

/* ------------------------- La carte du match ------------------------- */

function CarteMatch({
  titre,
  heure,
  moment,
  etatTexte,
  etat,
  loin,
  presents,
  onOuvrir,
}: {
  titre: string;
  heure: string;
  moment: Moment;
  etatTexte: string;
  etat: EtatSticker;
  loin: string | null;
  presents: string[];
  onOuvrir: () => void;
}) {
  const [c0, c1, c2] = FOND_MOMENT[moment];
  const complet = etat.genre === "complet";
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onOuvrir}
        className="block rounded-[24px] p-[5px] text-left shadow-[0_8px_12px_rgba(0,0,0,0.22)]"
        style={{ background: BLANC }}
        aria-label={`${titre} ${heure}, ${etatTexte}`}
      >
        <div className="relative h-[140px] w-[196px] overflow-hidden rounded-[19px]" style={{ background: `linear-gradient(180deg, ${c0}, ${c1} 50%, ${c2})` }}>
          <div
            className={cn("absolute top-1/2 left-1/2 size-[118px] -translate-x-1/2 -translate-y-[calc(50%+14px)]", complet && "saturate-0")}
            dangerouslySetInnerHTML={{ __html: stadeSvg(moment, { fond: false }) }}
          />
          <div className="absolute inset-x-0 bottom-0 h-[62%] bg-gradient-to-b from-transparent via-[rgba(4,5,7,0.4)] to-[rgba(3,4,6,0.82)]" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1 p-2.5">
            <Jeton texte={etatTexte} ton={etat.genre} />
            {loin && <Jeton texte={loin} ton="neutre" />}
          </div>
          <div className="absolute inset-x-0 bottom-0 px-3 pb-3.5">
            <p
              className="truncate font-black uppercase text-white/85"
              style={{ fontSize: titre.length > 8 ? 26 : 34, letterSpacing: -1.4, lineHeight: 1 }}
            >
              {titre}
            </p>
            <p className="mt-1 font-mono text-[9.5px] font-bold tracking-[1px] text-white/70 uppercase">
              {heureCourte(heure)} · Sunday Five
            </p>
          </div>
        </div>
      </button>
      {presents.length > 0 && (
        <div className="pointer-events-none absolute -bottom-3 left-1/2 flex -translate-x-1/2 items-center" aria-hidden>
          {presents.slice(0, 3).map((nom, i) => (
            <span
              key={nom}
              className="grid size-6 place-items-center rounded-full border-[1.5px] text-[12px] font-bold shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
              style={{ background: teinte(nom), color: "rgba(10,11,13,0.78)", borderColor: BLANC, marginLeft: i ? -8 : 0 }}
            >
              {nom[0]}
            </span>
          ))}
          {presents.length > 3 && (
            <span
              className="-ml-2 flex h-6 items-center rounded-full border-[1.5px] px-1.5 text-[9px] font-bold"
              style={{ background: ENCRE, color: BLANC, borderColor: BLANC }}
            >
              +{presents.length - 3}
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

function CarteVide({ texte }: { texte: string }) {
  return (
    <div className="flex h-[130px] w-[300px] max-w-[calc(100vw-32px)] items-center gap-3.5 rounded-[22px] px-[18px] shadow-[0_6px_12px_rgba(0,0,0,0.18)]" style={{ background: BLANC, color: ENCRE }}>
      <div className="size-[84px] shrink-0" dangerouslySetInnerHTML={{ __html: stadeSvg("semaine", { fantome: true }) }} />
      <p className="text-[20px] font-bold tracking-tight">{texte}</p>
    </div>
  );
}

/* ----------------------------- Côté admin ----------------------------- */

function Terrains({
  saison,
  terrains,
  onSauver,
}: {
  saison: Saison;
  terrains: Terrain[];
  onSauver: (next: Saison, message: string) => void;
}) {
  const [nom, setNom] = useState("");
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
      if (data.resultats?.length === 1) setChoisi(data.resultats[0]);
      if (!data.erreur && !data.resultats?.length) toast.error("Aucun lieu trouvé pour cette adresse.");
    } catch {
      toast.error("Le service d'adresses est injoignable.");
    } finally {
      setCherche(false);
    }
  }

  function ajouter() {
    if (!choisi || !nom.trim()) return;
    onSauver(
      ajouterTerrain(saison, { nom: nom.trim(), adresse: adresse.trim(), lat: choisi.lat, lng: choisi.lng, commune: choisi.commune }),
      `${nom.trim()} est sur la Map.`
    );
    setNom("");
    setAdresse("");
    setLieux([]);
    setChoisi(null);
  }

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

      <div className="flex flex-col gap-3 border-t border-border/60 px-5 py-4">
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

        <Button disabled={!choisi || !nom.trim()} onClick={ajouter} className="font-semibold">
          <Plus className="size-4" /> Ajouter sur la Map
        </Button>
      </div>
    </section>
  );
}
