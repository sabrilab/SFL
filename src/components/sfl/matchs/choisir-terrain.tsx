"use client";

// Le terrain d'un match, parmi tous ceux du Nord (Sabri, 23/10 : « tous les
// terrains qui sont possibles sur tout le territoire du Nord ») : ceux du
// même genre que l'hippodrome de Marcq — foot en gazon synthétique, en plein
// air —, tirés du Recensement des équipements sportifs (lib/sfl/terrains-nord.ts,
// le tri et ses raisons dans tools/terrains-nord.ts), et ceux de la ligue à
// leur nom, en blanc sur le plan.
//
// En haut, la recherche (une ville, un stade), les formats et le plan
// (plan-terrains.tsx) ; dessous, la liste, du plus proche au plus loin : de
// ta position si tu la donnes (le viseur), sinon de ta ville, sinon de
// l'hippodrome. Déplacer le plan range la liste autour de ce qu'il montre ;
// toucher un point met son terrain en tête. Chaque ligne : la photo
// satellite (chargée quand elle approche de l'écran), la commune et la
// distance, les terrains par format, éclairé, en accès libre. La toucher
// choisit le terrain.
//
// Les formats (Sabri, 24/10 : « on fait actuellement du foot à 5 […] qu'on
// puisse filtrer facilement pour voir les terrains qui nous plaisent ») :
// une rangée de pastilles, à 3, à 5, à 7, à 8, à 11. En toucher une ne garde
// que les complexes qui ont un terrain à ce format, sur le plan comme dans la
// liste ; la retoucher les rend tous. Le choix est celui de la Map (le même
// partout, gardé par le téléphone : hooks/use-format-terrain.ts) ; si aucun
// complexe de ce format n'est en vue, le plan s'ouvre jusqu'aux plus proches.
//
// Un lieu absent du recensement (un five couvert, un city-stade) s'écrit
// dans la recherche : la dernière ligne le reprend tel quel, sans place sur
// la Map, comme l'ancien « Ailleurs ».
//
// Le recensement est sous Licence Ouverte : sa source et sa date sont citées
// au pied de la liste.

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Check, LocateFixed, PenLine } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SigleLigue } from "@/components/sfl/choix-ligue";
import { VueSatellite } from "@/components/sfl/map/vue-satellite";
import { PucesFormat } from "@/components/sfl/map/format-terrains";
import { useFormatTerrain } from "@/hooks/use-format-terrain";
import {
  aFormat,
  avecLaLigue,
  chercherTerrains,
  distanceLisible,
  km,
  lieuDuTerrain,
  lireTerrainsNord,
  surPlace,
  terrainsNordLus,
  type CatalogueTerrains,
  type TerrainPropose,
} from "@/lib/sfl/terrains-nord";
import type { Terrain } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const PlanTerrains = dynamic(() => import("./plan-terrains").then((m) => m.PlanTerrains), {
  ssr: false,
  loading: () => <div className="size-full bg-secondary" />,
});

type Point = { lat: number; lng: number };

/** Un lieu hors des terrains de la ligue : un terrain du Nord, ou un nom écrit en toutes lettres. */
export interface LieuChoisi {
  lieu: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  /** Le terrain recensé d'où il vient : sa photo, ses formats. */
  terrain?: TerrainPropose;
}

/** Lille, quand on ne sait rien d'autre. */
const LILLE: Point = { lat: 50.6329, lng: 3.0586 };

const calme = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** « 23/10/2026 » */
const dateCourte = (iso: string) => iso.split("-").reverse().join("/");

/** La photo satellite d'un terrain, chargée quand sa ligne approche de l'écran. */
function Vignette({ t, racine, className }: { t: TerrainPropose; racine?: RefObject<HTMLElement | null>; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [vue, setVue] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || vue) return;
    const io = new IntersectionObserver(
      (e) => {
        if (!e.some((x) => x.isIntersecting)) return;
        setVue(true);
        io.disconnect();
      },
      { root: racine?.current ?? null, rootMargin: "240px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [vue, racine]);
  return (
    <span ref={ref} className={cn("relative shrink-0 overflow-hidden bg-secondary", className)}>
      {vue && <VueSatellite lat={t.lat} lng={t.lng} demi={0.0008} rapport={1} hauteur={56} className="absolute inset-0 size-full" />}
    </span>
  );
}

/** Le terrain retenu, sous les choix de la feuille : sa photo, son adresse, ce qu'il y a sur place. Sans `onToucher`, il ne fait que se montrer. */
export function TerrainRetenu({ t, onToucher }: { t: TerrainPropose; onToucher?: () => void }) {
  const detail = surPlace(t);
  const contenu = (
    <>
      <Vignette t={t} className="size-14 rounded-[13px]" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-[15px] leading-tight font-semibold">{t.nom}</span>
        <span className="truncate text-[12.5px] leading-tight text-muted-foreground">{t.adresse || t.commune}</span>
        {detail && <span className="mono-label truncate text-muted-foreground/80">{detail}</span>}
      </span>
    </>
  );
  const forme = "flex items-center gap-3 rounded-[18px] bg-card p-2 pr-3 text-left";
  if (!onToucher) return <div className={forme}>{contenu}</div>;
  return (
    <button type="button" onClick={onToucher} className={cn(forme, "transition-transform active:scale-[0.98]")}>
      {contenu}
    </button>
  );
}

export function ChoisirTerrain({
  open,
  onOpenChange,
  ligue,
  ici: iciConnu,
  actuel,
  onLigue,
  onLieu,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Les terrains de la ligue (saison.terrains). */
  ligue: Terrain[];
  /** Ta position si tu l'as donnée sur la Map, sinon ta ville. */
  ici: Point | null;
  /** Le terrain déjà choisi (« ligue-1 », « I593780006 ») : il ouvre la liste. */
  actuel: string | null;
  onLigue: (id: number) => void;
  onLieu: (l: LieuChoisi) => void;
}) {
  const [catalogue, setCatalogue] = useState<CatalogueTerrains | null>(terrainsNordLus);
  const [erreur, setErreur] = useState(false);
  const [q, setQ] = useState("");
  const [position, setPosition] = useState<Point | null>(null);
  const [cherchePosition, setCherchePosition] = useState(false);
  const ici = position ?? iciConnu;
  // Un terrain du Nord déjà choisi s'ouvre en tête, le plan posé sur lui.
  const [focus, setFocus] = useState<string | null>(actuel && !actuel.startsWith("ligue-") ? actuel : null);
  const tous = useMemo(() => avecLaLigue(catalogue?.terrains ?? [], ligue), [catalogue, ligue]);
  const format = useFormatTerrain();
  // Le point d'où la liste se range : le terrain déjà choisi, toi, l'hippodrome.
  const [origine, setOrigine] = useState<Point>(() => {
    const t = ligue.find((x) => `ligue-${x.id}` === actuel) ?? ligue.find((x) => x.defaut) ?? ligue[0];
    return (actuel && !actuel.startsWith("ligue-") ? terrainsNordLus()?.terrains.find((x) => x.id === actuel) : null) ?? iciConnu ?? t ?? LILLE;
  });
  const [cadrage, setCadrage] = useState<{ n: number; sur: "centre" | "terrains" | "proches" }>({ n: 0, sur: "centre" });
  const liste = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || catalogue) return;
    let fini = false;
    lireTerrainsNord()
      .then((c) => !fini && setCatalogue(c))
      .catch(() => !fini && setErreur(true));
    return () => {
      fini = true;
    };
  }, [open, catalogue]);

  // Une recherche : le plan cadre ce qu'elle trouve, une fois la frappe posée.
  useEffect(() => {
    if (!q.trim()) return;
    const id = setTimeout(() => setCadrage((c) => ({ n: c.n + 1, sur: "terrains" })), 350);
    return () => clearTimeout(id);
  }, [q]);

  const trouves = useMemo(() => chercherTerrains(aFormat(tous, format), q), [tous, format, q]);
  const ranges = useMemo(
    () =>
      trouves
        .map((t) => ({ t, d: km(origine, t) }))
        .sort((a, b) => a.d - b.d)
        .map((x) => x.t),
    [trouves, origine]
  );
  const enTete = focus ? ranges.find((t) => t.id === focus) : undefined;
  const lignes = enTete ? [enTete, ...ranges.filter((t) => t !== enTete)] : ranges;
  const ecrit = q.trim().slice(0, 120);

  function enHaut() {
    liste.current?.scrollTo({ top: 0, behavior: calme() ? "auto" : "smooth" });
  }

  function localiser() {
    if (!("geolocation" in navigator)) {
      toast.error("Ce navigateur ne donne pas la position.");
      return;
    }
    setCherchePosition(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPosition(p);
        setOrigine(p);
        setFocus(null);
        setCadrage((c) => ({ n: c.n + 1, sur: "centre" }));
        setCherchePosition(false);
        enHaut();
      },
      (err) => {
        setCherchePosition(false);
        toast.error(err.code === err.PERMISSION_DENIED ? "Active ta position dans les réglages du navigateur." : "On ne te trouve pas.");
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  }

  function choisir(t: TerrainPropose) {
    navigator.vibrate?.(8);
    if (t.ligue != null) onLigue(t.ligue);
    else onLieu({ lieu: lieuDuTerrain(t), adresse: t.adresse || null, lat: t.lat, lng: t.lng, terrain: t });
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-3 data-[side=bottom]:h-[88dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]"
      >
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[24px] font-bold tracking-tight">Terrains du Nord</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <div className="flex gap-2">
            <Input
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setFocus(null);
              }}
              placeholder="Ville ou stade"
              autoCorrect="off"
              spellCheck={false}
              aria-label="Chercher une ville ou un stade"
              className="h-11 flex-1 rounded-full px-4 text-[16px]"
            />
            <button
              type="button"
              onClick={localiser}
              disabled={cherchePosition}
              aria-label="Autour de moi"
              className={cn("bouton-secondaire grid size-11 shrink-0 place-items-center", cherchePosition && "animate-pulse")}
            >
              <LocateFixed className="size-5" strokeWidth={2.1} />
            </button>
          </div>

          <PucesFormat
            sur="feuille"
            onChoix={() => {
              setCadrage((c) => ({ n: c.n + 1, sur: "proches" }));
              enHaut();
            }}
            className="shrink-0 gap-2"
          />

          <div className="relative h-[min(34dvh,300px)] shrink-0 overflow-hidden rounded-[22px] border border-border bg-secondary">
            <PlanTerrains
              terrains={trouves}
              focus={enTete ?? null}
              centre={origine}
              cadrage={cadrage}
              ici={ici}
              onToucher={(id) => {
                setFocus(id);
                enHaut();
              }}
              onDeplace={(c) => {
                setOrigine(c);
                enHaut();
              }}
              className="h-full w-full"
            />
          </div>

          <div ref={liste} className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto overscroll-contain px-1 pb-2">
            {catalogue && (
              <p className="mono-label px-1 pb-0.5 text-muted-foreground tabular-nums">
                {trouves.length === 0 ? "Aucun terrain" : `${trouves.length} terrain${trouves.length > 1 ? "s" : ""}`}
              </p>
            )}
            {lignes.map((t) => {
              const detail = surPlace(t);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => choisir(t)}
                  aria-current={t.id === actuel || undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-[18px] bg-card p-2 pr-3 text-left transition-transform active:scale-[0.98]",
                    t.id === enTete?.id && "ring-2 ring-foreground"
                  )}
                >
                  <Vignette t={t} racine={liste} className="size-14 rounded-[13px]" />
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-[15px] leading-tight font-semibold">{t.nom}</span>
                      {t.ligue != null && <SigleLigue ligue="sfl" hauteur={10} className="text-muted-foreground" />}
                    </span>
                    <span className="truncate text-[12.5px] leading-tight text-muted-foreground">
                      {t.commune}
                      {ici && ` · ${distanceLisible(km(ici, t))}`}
                    </span>
                    {detail && <span className="mono-label truncate text-muted-foreground/80">{detail}</span>}
                  </span>
                  {t.id === actuel && <Check className="size-5 shrink-0" strokeWidth={2.4} />}
                </button>
              );
            })}
            {ecrit && (
              <button
                type="button"
                onClick={() => {
                  onLieu({ lieu: ecrit, adresse: null, lat: null, lng: null });
                  onOpenChange(false);
                }}
                className="flex items-center gap-3 rounded-[18px] bg-card p-2 pr-3 text-left transition-transform active:scale-[0.98]"
              >
                <span className="grid size-14 shrink-0 place-items-center rounded-[13px] bg-secondary">
                  <PenLine className="size-5 text-muted-foreground" strokeWidth={2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate text-[15px] leading-tight font-semibold">« {ecrit} »</span>
                  <span className="mono-label text-muted-foreground/80">Ailleurs</span>
                </span>
              </button>
            )}
            {!catalogue && !erreur && (
              <div className="flex flex-col gap-1.5" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[72px] animate-pulse rounded-[18px] bg-card" />
                ))}
              </div>
            )}
            {erreur && <p className="py-8 text-center text-[14px] text-muted-foreground">Les terrains ne se chargent pas.</p>}
            {catalogue && (
              <p className="px-1 pt-3 text-[10.5px] leading-snug text-muted-foreground/70">
                {catalogue.source} · {catalogue.licence} · {dateCourte(catalogue.date)}
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
