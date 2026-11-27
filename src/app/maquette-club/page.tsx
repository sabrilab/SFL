"use client";

// MAQUETTE (27/11/2026, non publiée) : Bola Club, l'app Bola personnalisée
// pour un club. Les mêmes onglets que Bola (Map, Ma carte, Actu), et pour le
// staff un quatrième, l'outil de gestion : « Mon équipe » pour l'entraîneur,
// « Le club » pour la présidente. Le club est celui de la démonstration
// (FC Démo, bola-app#14, SFL#270) : prénoms, noms et adversaires inventés.
//
//   ?ecran=map | match | carte | actu | clubs | equipe | club
//   ?role=joueur | parent | entraineur | president
//
// Rien ne vient de la base : une page publique, sans compte, pour les
// captures. Elle n'est pas faite pour être fusionnée.

import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, ChevronRight, Clock, MapPin, Megaphone, Plus, Shield, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BolaCard } from "@/components/sfl/bola-card";
import { CartePhoto } from "@/components/sfl/carte-photo";
import { CarteEntraineur } from "@/components/sfl/carte-entraineur";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { MATIERES_ARBITRE } from "@/components/sfl/skins-arbitre";
import type { Matiere } from "@/components/sfl/finitions-carte";
import { ActusIcon, CarteIcon, MapIcon } from "@/components/layout/nav-icons";
import { styleSnap } from "@/components/sfl/map/style-snap";
import { stickerHtml, type StickerPlan } from "@/components/sfl/map/stade";
import type { Blason } from "@/lib/sfl/blason";
import type { Stats } from "@/lib/sfl/engine";

type Role = "joueur" | "parent" | "entraineur" | "president";
type Ecran = "map" | "match" | "carte" | "actu" | "clubs" | "equipe" | "club";

/* ----------------------------- les données ----------------------------- */

const BLASON: Blason = { forme: "ecu", motif: "parti", couleurs: ["#0E4D32", "#F4F3EF", "#A7ADB4"], embleme: "initiales" };
const CLUB = { nom: "FC Démo", initiales: "FCD", lieu: "Stade municipal", adresse: "12 rue du Stade, Marcq-en-Barœul", lat: 50.6712, lng: 3.0968 };

const ADVERSES: Record<string, Blason> = {
  "AS Exemple": { forme: "rond", motif: "rayures", couleurs: ["#1B2A4A", "#E9E6DE", "#B9A46A"], embleme: "initiales" },
  "US Modèle": { forme: "blason", motif: "coupe", couleurs: ["#7A1F24", "#F2EFE8", "#C9CCD1"], embleme: "initiales" },
  "Olympique Témoin": { forme: "pointe", motif: "bande", couleurs: ["#F2F0EA", "#1A1B1E", "#8F949A"], embleme: "initiales" },
  "Étoile Factice": { forme: "ecu", motif: "chevron", couleurs: ["#0F3B5C", "#F4F3EF", "#D4B25C"], embleme: "initiales" },
  "Racing Essai": { forme: "ovale", motif: "uni", couleurs: ["#16161A", "#F4F3EF", "#B0B4BA"], embleme: "initiales" },
};
const sigle = (nom: string) =>
  nom
    .split(/\s+/)
    .map((m) => m[0])
    .join("")
    .toUpperCase()
    .slice(0, 3);

interface MatchClub {
  id: string;
  cat: string;
  adv: string;
  jour: string;
  jourCourt: string;
  heure: string;
  maison: boolean;
  lieu: string;
  ville: string;
  lat: number;
  lng: number;
  convoques: number;
  repondu: number;
}

// Le week-end des 28 et 29/11 : les quatre équipes du club.
const MATCHS: MatchClub[] = [
  { id: "u13", cat: "U13", adv: "AS Exemple", jour: "Samedi 28", jourCourt: "sam", heure: "14h00", maison: true, lieu: "Stade municipal, terrain 2", ville: "Marcq-en-Barœul", lat: CLUB.lat - 0.0016, lng: CLUB.lng - 0.0045, convoques: 14, repondu: 12 },
  { id: "u17", cat: "U17", adv: "US Modèle", jour: "Samedi 28", jourCourt: "sam", heure: "16h30", maison: false, lieu: "Stade Jean-Modèle", ville: "Tourcoing", lat: 50.7385, lng: 3.1795, convoques: 14, repondu: 14 },
  { id: "fem", cat: "Féminines", adv: "Étoile Factice", jour: "Dimanche 29", jourCourt: "dim", heure: "11h00", maison: false, lieu: "Complexe des Prés", ville: "Lambersart", lat: 50.6488, lng: 3.0218, convoques: 12, repondu: 9 },
  { id: "sen", cat: "Seniors", adv: "Olympique Témoin", jour: "Dimanche 29", jourCourt: "dim", heure: "15h00", maison: true, lieu: "Stade municipal, terrain d'honneur", ville: "Marcq-en-Barœul", lat: CLUB.lat + 0.0012, lng: CLUB.lng + 0.0052, convoques: 16, repondu: 15 },
  { id: "u13b", cat: "U13", adv: "Racing Essai", jour: "Mercredi 2", jourCourt: "mer", heure: "15h00", maison: false, lieu: "Stade du Moulin", ville: "Villeneuve-d'Ascq", lat: 50.6195, lng: 3.1405, convoques: 14, repondu: 3 },
];

const ST = (VIT: number, TIR: number, PAS: number, DRI: number, DEF: number, PHY: number): Stats => ({ VIT, TIR, PAS, DRI, DEF, PHY });

/** Les U13 du FC Démo (ceux de la démonstration, demo.ts de SFL#270). */
const U13: { p: string; n: string; poste: string; note: number; plus?: number; attente?: boolean; reponse?: "oui" | "non" | null }[] = [
  { p: "Timéo", n: "Aubrac", poste: "AT", note: 73, plus: 3, reponse: "oui" },
  { p: "Basile", n: "Kerlan", poste: "G", note: 71, reponse: "oui" },
  { p: "Maël", n: "Pradel", poste: "DC", note: 70, plus: 1, reponse: "oui" },
  { p: "Noé", n: "Florac", poste: "DC", note: 69, reponse: "oui" },
  { p: "Sacha", n: "Montclar", poste: "DG", note: 70, reponse: "non" },
  { p: "Eliott", n: "Nérac", poste: "DD", note: 68, reponse: "oui" },
  { p: "Marius", n: "Orsay", poste: "MDC", note: 72, plus: 2, reponse: "oui" },
  { p: "Gaspard", n: "Lavergne", poste: "MC", note: 71, reponse: "oui" },
  { p: "Titouan", n: "Estève", poste: "MC", note: 69, reponse: null },
  { p: "Lubin", n: "Zeller", poste: "MC", note: 70, reponse: "oui" },
  { p: "Côme", n: "Islet", poste: "AG", note: 71, reponse: "oui" },
  { p: "Léandre", n: "Ussel", poste: "AD", note: 70, reponse: "oui" },
  { p: "Aloïs", n: "Castelnau", poste: "AT", note: 68, reponse: "oui" },
  { p: "Malo", n: "Belcourt", poste: "G", note: 67, reponse: "oui" },
  { p: "Ewen", n: "Hautefort", poste: "DC", note: 66, attente: true, reponse: null },
];

const TIMEO = { prenom: "Timéo", nom: "Aubrac", poste: "AT", note: 73, stats: ST(78, 74, 69, 76, 52, 66) };

/* ----------------------------- les cartes ------------------------------ */

const PARENT: Matiere = { ...MATIERES_ARBITRE.craie, titre: "PARENT" };
const DIRIGEANT: Matiere = { ...MATIERES_ARBITRE.raye, titre: "PRÉSIDENTE" };
const ZERO = ST(0, 0, 0, 0, 0, 0);

function CarteJoueur({ size, prenom = TIMEO.prenom, nom = TIMEO.nom, poste = TIMEO.poste, note = TIMEO.note }: { size: number; prenom?: string; nom?: string; poste?: string; note?: number }) {
  if (254 * size < 170) return <CartePhoto name={`${prenom} ${nom}`} affiche={prenom} position={poste} overall={note} size={size} photo={null} />;
  return <BolaCard name={`${prenom} ${nom}`} affiche={prenom} username="u13 · fc démo" position={poste} overall={note} stats={TIMEO.stats} size={size} photo={null} numero={9} />;
}

function CarteParent({ size }: { size: number }) {
  return (
    <BolaCard
      edition="arbitre"
      matiere={PARENT}
      name="Claire Aubrac"
      affiche="Claire"
      username="timéo · u13"
      position="parent"
      overall={0}
      stats={ZERO}
      size={size}
      photo={null}
      arbitre={{ note: "12", stats: [["vus", 12], ["dép", 5], ["cov", 3], ["sai", 2]] }}
    />
  );
}

function CarteDirigeant({ size }: { size: number }) {
  return (
    <BolaCard
      edition="arbitre"
      matiere={DIRIGEANT}
      name="Hortense Valmont"
      affiche="Hortense"
      username="fc démo"
      position="présidente"
      overall={0}
      stats={ZERO}
      size={size}
      photo={null}
      arbitre={{ note: "62", stats: [["lic", 62], ["éq", 4], ["bén", 9], ["sai", 3]] }}
    />
  );
}

function CarteCoach({ size }: { size: number }) {
  return (
    <CarteEntraineur
      nom="Corentin Delorme"
      affiche="Corentin"
      pseudo="corentin"
      equipe={{ nom: "FC Démo U13", initiales: CLUB.initiales, fond: "noir", blason: BLASON }}
      stats={{ RES: 78, PRES: 84, COH: 76 }}
      size={size}
    />
  );
}

/* ------------------------------ les briques ----------------------------- */

const SURFACE = "glass-soft rounded-champ";

function Rubrique({ children, droite }: { children: ReactNode; droite?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-1">
      <span className="mono-label text-encre-3">{children}</span>
      {droite && <span className="text-corps text-encre-3 tabular-nums">{droite}</span>}
    </div>
  );
}

function Ligne({ titre, sous, droite, i, avant, fort }: { titre: ReactNode; sous?: ReactNode; droite?: ReactNode; i: number; avant?: ReactNode; fort?: boolean }) {
  return (
    <div className="flex items-center gap-3 pl-4">
      {avant}
      <div className={cn("flex min-h-12 flex-1 items-center gap-3 py-2.5 pr-4", i > 0 && "border-t border-border/60")}>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-lecture font-medium">{titre}</span>
          {sous && <span className={cn("truncate text-corps", fort ? "font-medium text-foreground" : "text-encre-2")}>{sous}</span>}
        </span>
        {droite && <span className="shrink-0 text-lecture text-encre-3 tabular-nums">{droite}</span>}
        <ChevronRight className="size-4 shrink-0 text-encre-4" />
      </div>
    </div>
  );
}

function Segmente({ options, valeur, className }: { options: string[]; valeur: string; className?: string }) {
  return (
    <span className={cn("flex rounded-[10px] bg-secondary p-0.5 text-corps font-medium", className)}>
      {options.map((o) => (
        <span key={o} className={cn("flex-1 rounded-[8px] px-3 py-1 text-center whitespace-nowrap", o === valeur ? "bg-background text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-encre-3")}>
          {o}
        </span>
      ))}
    </span>
  );
}

function Chiffres({ items }: { items: [string, string][] }) {
  return (
    <div className={cn(SURFACE, "grid px-2 py-3.5")} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map(([v, l], i) => (
        <span key={l} className={cn("flex flex-col items-center gap-1", i > 0 && "border-l border-border/60")}>
          <span className="font-[family-name:var(--font-anton)] text-titre-l leading-none tabular-nums">{v}</span>
          <span className="text-petit text-encre-3">{l}</span>
        </span>
      ))}
    </div>
  );
}

/** La note de sept. à aujourd'hui : une ligne fine sur sa ligne de base. */
function Courbe({ points, de, a }: { points: number[]; de: string; a: string }) {
  const W = 320;
  const H = 86;
  const min = Math.min(...points) - 1;
  const max = Math.max(...points) + 1;
  const x = (i: number) => 8 + (i * (W - 16)) / (points.length - 1);
  const y = (v: number) => 10 + (1 - (v - min) / (max - min)) * (H - 26);
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const fin = points[points.length - 1];
  return (
    <div className={cn(SURFACE, "px-4 pt-3.5 pb-3")}>
      <div className="flex items-baseline justify-between">
        <span className="flex items-baseline gap-2">
          <span className="font-[family-name:var(--font-anton)] text-titre-l leading-none tabular-nums">{fin}</span>
          <span className="text-corps font-medium text-[#1FA055]">+{fin - points[0]} depuis septembre</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" aria-hidden>
        <line x1="8" x2={W - 8} y1={H - 14} y2={H - 14} stroke="currentColor" strokeOpacity="0.12" />
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r={i === points.length - 1 ? 4 : 2.2} fill="currentColor" />
        ))}
        <text x="8" y={H - 1} className="fill-current text-[10px] opacity-40">
          {de}
        </text>
        <text x={W - 8} y={H - 1} textAnchor="end" className="fill-current text-[10px] opacity-40">
          {a}
        </text>
      </svg>
    </div>
  );
}

function Tete({ titre, sous, droite }: { titre: string; sous?: string; droite?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-1 pt-[max(env(safe-area-inset-top),14px)]">
      <div className="flex min-w-0 flex-col">
        <h1 className="text-titre-l font-bold tracking-tight">{titre}</h1>
        {sous && <span className="text-corps text-encre-3">{sous}</span>}
      </div>
      {droite}
    </header>
  );
}


/** La vraie barre de l'app (liquid-tabbar) ; quatre onglets pour le staff. */
function Barre({ role, actif, clair }: { role: Role; actif: "map" | "carte" | "actu" | "gestion"; clair?: boolean }) {
  const onglets: { id: typeof actif; libelle: string; icone: (plein: boolean) => ReactNode; marque?: number }[] = [
    { id: "map", libelle: "Map", icone: (p) => <MapIcon plein={p} />, marque: role === "joueur" || role === "parent" ? 1 : undefined },
    { id: "carte", libelle: "Ma carte", icone: (p) => <CarteIcon plein={p} /> },
    { id: "actu", libelle: "Actu", icone: (p) => <ActusIcon plein={p} /> },
  ];
  if (role === "entraineur") onglets.push({ id: "gestion", libelle: "Mon équipe", icone: () => <Users className="size-6" strokeWidth={1.6} />, marque: 2 });
  if (role === "president") onglets.push({ id: "gestion", libelle: "Le club", icone: () => <Shield className="size-6" strokeWidth={1.6} />, marque: 2 });
  const index = onglets.findIndex((o) => o.id === actif);
  const n = onglets.length;
  const encre = clair ? "#0a0b0d" : "#ffffff";
  return (
    <div dir="ltr" className="fixed left-1/2 z-40 flex -translate-x-1/2" style={{ bottom: "max(calc(env(safe-area-inset-bottom) - 4px), 14px)", width: "min(calc(100% - 32px), 430px)" }}>
      <nav className="liquid-tabbar relative flex min-w-0 flex-1" data-clair={clair ? "" : undefined} style={{ ["--onglet" as string]: index, ...(clair && { ["--tabbar-verre" as string]: "rgba(250, 250, 252, 0.72)", ["--foreground" as string]: "#0a0b0d", ["--tabbar-trou" as string]: "#eeeef0" }) }}>
        <span aria-hidden className="pointer-events-none absolute top-1 bottom-1 left-1 rounded-full" style={{ background: clair ? "rgba(10,11,13,0.07)" : "rgba(255,255,255,0.1)", width: `calc((100% - 8px) / ${n})`, transform: `translateX(${index * 100}%)` }} />
        {onglets.map((o) => {
          const choisi = o.id === actif;
          return (
            <span key={o.libelle} className="liquid-tabbar__onglet" style={{ color: encre }}>
              <span className="relative flex">
                {o.icone(choisi)}
                {o.marque && (
                  <span className="absolute -top-2 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full px-[5px] text-petit leading-none font-bold text-white tabular-nums" style={{ background: "#FF3B30", boxShadow: `0 0 0 2px ${clair ? "#ffffff" : "#0a0b0d"}` }}>
                    {o.marque}
                  </span>
                )}
              </span>
              <span className="liquid-tabbar__libelle" style={{ fontWeight: choisi ? 600 : 500 }}>
                {o.libelle}
              </span>
            </span>
          );
        })}
      </nav>
    </div>
  );
}

const ROLE_LIBELLE: Record<Role, string> = { joueur: "Joueur", parent: "Parent", entraineur: "Entraîneur", president: "Présidente" };

/** Qui regarde (la maquette seulement) : en haut à droite. */
function Vue({ role, clair }: { role: Role; clair?: boolean }) {
  return (
    <span className={cn("rounded-full px-2.5 py-1 text-petit font-semibold", clair ? "bg-black/80 text-white" : "bg-white/12 text-white")}>
      vue {ROLE_LIBELLE[role].toLowerCase()}
    </span>
  );
}

/* --------------------------------- Map --------------------------------- */

/** Le match du week-end que ce rôle regarde d'abord. */
const MIEN: Record<Role, string | null> = { joueur: "u13", parent: "u13", entraineur: "u13", president: null };

function etatDe(m: MatchClub, role: Role): StickerPlan["etat"] {
  if (MIEN[role] === m.id) {
    if (role === "joueur") return { genre: "dedans" };
    if (role === "parent") return { genre: "equipe", texte: "Timéo y joue" };
    if (role === "entraineur") return { genre: "equipe", texte: `${m.repondu}/${m.convoques} ont répondu` };
  }
  return { genre: "equipe", texte: m.cat };
}

function PlanClub({ role, choisi }: { role: Role; choisi: string | null }) {
  const boite = useRef<HTMLDivElement>(null);
  const [maison, setMaison] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!boite.current) return;
    const map = new maplibregl.Map({
      container: boite.current,
      style: styleSnap(),
      bounds: [
        [3.0218, 50.6195],
        [3.1795, 50.7385],
      ],
      fitBoundsOptions: { padding: { top: 200, bottom: choisi ? 520 : 290, left: 90, right: 90 } },
      pitch: 0,
      attributionControl: false,
      interactive: true,
    });
    (window as unknown as { __plan: maplibregl.Map }).__plan = map;
    const reperes: maplibregl.Marker[] = [];
    MATCHS.filter((m) => !m.maison).forEach((m, k) => {
      const est = m.id === (choisi ?? MIEN[role]);
      const s: StickerPlan = { id: m.id, lat: m.lat, lng: m.lng, moment: m.jourCourt === "mer" ? "semaine" : "weekend", jourCourt: m.jourCourt, heure: m.heure, etat: etatDe(m, role), nom: `${m.cat} · ${m.adv}` };
      const el = document.createElement("div");
      el.className = "stk-ancre";
      el.style.width = "0px";
      el.style.height = "0px";
      el.style.zIndex = String(est ? 20 : 3 + k);
      el.innerHTML = stickerHtml(s, est);
      reperes.push(new maplibregl.Marker({ element: el, anchor: "top-left" }).setLngLat([m.lng, m.lat]).addTo(map));
    });
    const el = document.createElement("div");
    el.style.zIndex = "10";
    reperes.push(new maplibregl.Marker({ element: el, anchor: "bottom" }).setLngLat([CLUB.lng, CLUB.lat]).addTo(map));
    setMaison(el);
    return () => {
      reperes.forEach((r) => r.remove());
      map.remove();
    };
  }, [role, choisi]);
  return (
    <>
      <div className="absolute inset-0">
        <div ref={boite} className="h-full w-full" />
      </div>
      {maison &&
        createPortal(
          <div className="flex flex-col items-center" style={{ filter: "drop-shadow(0 6px 14px rgba(20,12,4,0.28))" }}>
            <div className="flex flex-col gap-1.5 rounded-[22px] bg-white p-1.5 pr-2">
              <div className="flex items-center gap-2 pr-2">
                <Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={44} />
                <span className="flex flex-col leading-tight">
                  <span className="text-[15px] font-bold tracking-tight text-[#0a0b0d]">{CLUB.nom}</span>
                  <span className="text-[11.5px] font-medium text-[#0a0b0d]/55">la maison</span>
                </span>
              </div>
              {MATCHS.filter((m) => m.maison).map((m) => {
                const mien = MIEN[role] === m.id;
                const etat = etatDe(m, role);
                const dit = etat.genre === "dedans" ? "tu y es" : etat.genre === "equipe" && mien ? etat.texte : null;
                return (
                  <span key={m.id} className={cn("flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 text-[12px] font-semibold", mien ? "bg-[#0a0b0d] text-white" : "bg-black/[0.05] text-[#0a0b0d]")}>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-bold uppercase", mien ? "bg-white text-[#0a0b0d]" : "bg-[#0a0b0d] text-white")}>
                      {m.jourCourt} {m.heure.replace("h00", "h")}
                    </span>
                    <span className="whitespace-nowrap">{m.cat}</span>
                    {dit && <span className="whitespace-nowrap text-white/60">· {dit}</span>}
                  </span>
                );
              })}
            </div>
            <span className="h-3 w-[3px] rounded-b bg-white" />
            <span className="size-3 rounded-full border-2 border-white bg-[#0E4D32]" />
          </div>,
          maison
        )}
    </>
  );
}

function TuileMatch({ m, role }: { m: MatchClub; role: Role }) {
  const mien = MIEN[role] === m.id;
  const ligne =
    role === "joueur"
      ? mien
        ? "Tu es convoqué · rdv 13 h 15"
        : `${m.convoques} convoqués`
      : role === "parent"
        ? mien
          ? "Timéo est convoqué · rdv 13 h 15"
          : `${m.convoques} convoqués`
        : role === "entraineur"
          ? mien
            ? `${m.repondu} sur ${m.convoques} ont répondu`
            : `${m.convoques} convoqués`
          : `${m.repondu} sur ${m.convoques} ont répondu`;
  return (
    <div className={cn("flex w-[262px] shrink-0 snap-center flex-col gap-2.5 rounded-[22px] bg-white/95 p-3.5 text-[#0a0b0d] shadow-[0_8px_24px_rgba(20,12,4,0.14)] backdrop-blur-xl", mien && "ring-2 ring-[#0a0b0d]")}>
      <div className="flex items-center justify-between text-[12px] font-semibold text-[#0a0b0d]/55">
        <span>
          {m.jour} · {m.heure.replace("h", " h ")}
        </span>
        <span>{m.cat}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={34} />
        <span className="text-[13px] font-semibold text-[#0a0b0d]/40">{m.maison ? "reçoit" : "chez"}</span>
        <Ecusson initiales={sigle(m.adv)} fond="blanc" blason={ADVERSES[m.adv]} taille={34} />
        <span className="min-w-0 truncate text-[15px] font-bold tracking-tight">{m.adv}</span>
      </div>
      <div className="flex items-center gap-1.5 text-[12.5px] text-[#0a0b0d]/60">
        <MapPin className="size-3.5 shrink-0" />
        <span className="truncate">{m.maison ? `À la maison · ${m.lieu.split(", ")[1]}` : `${m.ville} · ${m.lieu}`}</span>
      </div>
      <div className={cn("text-[13px] font-semibold", mien ? "text-[#0a0b0d]" : "text-[#0a0b0d]/55")}>{ligne}</div>
    </div>
  );
}

function EcranMap({ role }: { role: Role }) {
  const ordre = [...MATCHS].sort((a, b) => (a.id === MIEN[role] ? -1 : b.id === MIEN[role] ? 1 : 0));
  return (
    <div className="light fixed inset-0 overflow-hidden bg-[#f3f0e8]">
      <PlanClub role={role} choisi={null} />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-white/70 to-transparent" />
      <div className="absolute inset-x-4 top-[max(env(safe-area-inset-top),14px)] z-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pr-4 pl-1.5 shadow-[0_4px_16px_rgba(20,12,4,0.1)] backdrop-blur-xl">
          <Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={32} />
          <span className="flex flex-col leading-tight text-[#0a0b0d]">
            <span className="text-[14px] font-bold tracking-tight">Cette semaine</span>
            <span className="text-[11.5px] font-medium text-[#0a0b0d]/55">5 matchs · 2 à la maison</span>
          </span>
        </div>
        <Vue role={role} clair />
      </div>
      <div className="absolute inset-x-0 bottom-[96px] z-20 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {ordre.map((m) => (
          <TuileMatch key={m.id} m={m} role={role} />
        ))}
      </div>
      <Barre role={role} actif="map" clair />
    </div>
  );
}

/* ------------------------------ le match ------------------------------- */

function EcranMatch({ role }: { role: Role }) {
  const m = MATCHS[0];
  const viennent = U13.filter((j) => j.reponse === "oui");
  return (
    <div className="light fixed inset-0 overflow-hidden bg-[#f3f0e8]">
      <PlanClub role={role} choisi="u13" />
      <div className="absolute inset-x-0 bottom-0 z-30 flex max-h-[74%] flex-col rounded-t-[28px] bg-white text-[#0a0b0d] shadow-[0_-10px_40px_rgba(20,12,4,0.18)]">
        <span className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/15" />
        <div className="flex items-start justify-between px-5 pt-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[13px] font-semibold text-black/50">
              U13 · {m.jour} novembre · 14 h 00
            </span>
            <span className="text-[24px] leading-tight font-bold tracking-tight">FC Démo – AS Exemple</span>
          </div>
          <span className="grid size-8 place-items-center rounded-full bg-black/6">
            <X className="size-4" />
          </span>
        </div>
        <div className="flex items-center justify-center gap-6 py-4">
          <Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={64} />
          <span className="text-[13px] font-semibold text-black/35">reçoit</span>
          <Ecusson initiales="AE" fond="blanc" blason={ADVERSES["AS Exemple"]} taille={64} />
        </div>
        <div className="mx-5 overflow-hidden rounded-[16px] bg-black/[0.035]">
          <div className="flex items-center gap-3 px-4 py-3">
            <MapPin className="size-4 text-black/50" />
            <span className="flex flex-col">
              <span className="text-[15px] font-medium">À la maison · terrain 2</span>
              <span className="text-[13px] text-black/50">{CLUB.adresse}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 border-t border-black/6 px-4 py-3">
            <Clock className="size-4 text-black/50" />
            <span className="text-[15px] font-medium">Rendez-vous 13 h 15 au vestiaire</span>
          </div>
        </div>
        <div className="flex items-baseline justify-between px-5 pt-4 pb-2">
          <span className="mono-label text-black/45">Convoqués</span>
          <span className="text-[13px] text-black/45 tabular-nums">12 viennent sur 14</span>
        </div>
        <div className="grid grid-cols-6 gap-x-1.5 gap-y-2.5 overflow-y-auto px-5 pb-3">
          {viennent.map((j) => (
            <span key={j.p} className="flex flex-col items-center gap-1">
              <CarteJoueur size={46 / 254} prenom={j.p} nom={j.n} poste={j.poste} note={j.note} />
              <span className="max-w-full truncate text-[11px] font-medium">{j.p}</span>
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2 border-t border-black/6 px-5 pt-3 pb-[max(env(safe-area-inset-bottom),18px)]">
          {role === "parent" && <span className="text-[13px] font-medium text-black/50">Pour Timéo</span>}
          <div className="flex gap-2">
            <span className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[#0a0b0d] text-[15px] font-semibold text-white">
              <Check className="size-4" /> {role === "parent" ? "Il vient" : "Je viens"}
            </span>
            <span className="flex h-12 flex-1 items-center justify-center rounded-full bg-black/6 text-[15px] font-semibold">{role === "parent" ? "Il ne peut pas" : "Absent"}</span>
          </div>
          {role === "parent" && (
            <span className="flex h-11 items-center justify-center gap-2 rounded-full border border-black/10 text-[14px] font-semibold">
              <Plus className="size-4" /> Je peux emmener 2 enfants
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Ma carte ------------------------------ */

function Page({ children, role, actif }: { children: ReactNode; role: Role; actif: "carte" | "actu" | "gestion" }) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex max-w-[480px] flex-col gap-5 px-4 pb-[130px]">{children}</div>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-[120px] bg-gradient-to-t from-background from-40% to-transparent" />
      <Barre role={role} actif={actif} />
    </div>
  );
}

const TAILLE = 0.97; // ~63 % d'un téléphone de 390 px, comme Ma carte

function EcranCarte({ role }: { role: Role }) {
  const carte =
    role === "joueur" ? <CarteJoueur size={TAILLE} /> : role === "parent" ? <CarteParent size={TAILLE} /> : role === "entraineur" ? <CarteCoach size={TAILLE} /> : <CarteDirigeant size={TAILLE} />;
  const sous = { joueur: "Attaquant · U13 · FC Démo", parent: "Maman de Timéo · U13 · FC Démo", entraineur: "Entraîneur · U13 et U17 · FC Démo", president: "Présidente · FC Démo" }[role];
  return (
    <Page role={role} actif="carte">
      <Tete titre="Ma carte" droite={<Vue role={role} />} />
      <div className="flex flex-col items-center gap-3 pt-1">
        {carte}
        <span className="text-corps text-encre-3">{sous}</span>
      </div>

      {role === "joueur" && (
        <>
          <div className="flex flex-col gap-2">
            <Rubrique droite="sept. → nov.">Ta note</Rubrique>
            <Courbe points={[70, 70, 71, 71, 72, 72, 73, 73]} de="sept." a="aujourd'hui" />
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique>Ta saison</Rubrique>
            <Chiffres items={[["8", "matchs"], ["5", "buts"], ["3", "passes"], ["92%", "présence"]]} />
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique>Prochain match</Rubrique>
            <div className={cn(SURFACE, "overflow-hidden")}>
              <Ligne i={0} titre="FC Démo – AS Exemple" sous="Samedi 14 h · à la maison · tu es convoqué" fort avant={<Ecusson initiales="AE" fond="blanc" blason={ADVERSES["AS Exemple"]} taille={34} />} />
            </div>
          </div>
        </>
      )}

      {role === "parent" && (
        <>
          <div className="flex flex-col gap-2">
            <Rubrique droite="U13">Timéo</Rubrique>
            <div className={cn(SURFACE, "flex items-center gap-4 p-4")}>
              <CarteJoueur size={78 / 254} />
              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-titre font-semibold">Timéo Aubrac</span>
                <span className="text-corps text-encre-2">Attaquant · 12 ans</span>
                <span className="text-corps font-medium text-[#1FA055]">+3 depuis septembre</span>
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique droite="sept. → nov.">Sa note</Rubrique>
            <Courbe points={[70, 70, 71, 71, 72, 72, 73, 73]} de="sept." a="aujourd'hui" />
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique>Sa saison</Rubrique>
            <Chiffres items={[["8", "matchs"], ["5", "buts"], ["3", "passes"], ["92%", "présence"]]} />
          </div>
          <div className={cn(SURFACE, "overflow-hidden")}>
            <Ligne i={0} titre="Samedi 14 h · FC Démo – AS Exemple" sous="Timéo est convoqué · rdv 13 h 15" fort />
            <Ligne i={1} titre="Mercredi 18 h · entraînement" sous="Stade municipal, terrain 1" />
            <Ligne i={2} titre="Autorisation parentale" droite="donnée" />
          </div>
        </>
      )}

      {role === "entraineur" && (
        <>
          <div className="flex flex-col gap-2">
            <Rubrique>Tes équipes</Rubrique>
            <div className={cn(SURFACE, "overflow-hidden")}>
              <Ligne i={0} titre="U13" sous="15 joueurs · 5 V · 2 N · 1 D" droite="2e" avant={<Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={34} />} />
              <Ligne i={1} titre="U17" sous="15 joueurs · 4 V · 1 N · 3 D" droite="5e" avant={<Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={34} />} />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique droite="ce mois">Ceux qui montent</Rubrique>
            <div className={cn(SURFACE, "grid grid-cols-3 gap-2 px-3 py-4")}>
              {U13.filter((j) => j.plus)
                .sort((a, b) => (b.plus ?? 0) - (a.plus ?? 0))
                .map((j) => (
                  <span key={j.p} className="flex flex-col items-center gap-1.5">
                    <CarteJoueur size={64 / 254} prenom={j.p} nom={j.n} poste={j.poste} note={j.note} />
                    <span className="text-corps font-medium">{j.p}</span>
                    <span className="text-petit font-semibold text-[#1FA055]">+{j.plus}</span>
                  </span>
                ))}
            </div>
          </div>
        </>
      )}

      {role === "president" && (
        <>
          <div className="flex flex-col gap-2">
            <Rubrique>Ton club</Rubrique>
            <Chiffres items={[["62", "licenciés"], ["4", "équipes"], ["3", "entraîneurs"], ["9", "bénévoles"]]} />
          </div>
          <div className="flex flex-col gap-2">
            <Rubrique droite="5 matchs">Cette semaine</Rubrique>
            <div className={cn(SURFACE, "overflow-hidden")}>
              {MATCHS.slice(0, 4).map((m, i) => (
                <Ligne key={m.id} i={i} titre={`${m.cat} · ${m.adv}`} sous={`${m.jour} · ${m.heure.replace("h", " h ")} · ${m.maison ? "à la maison" : m.ville}`} />
              ))}
            </div>
          </div>
        </>
      )}
    </Page>
  );
}

/* --------------------------------- Actu -------------------------------- */

function Post({ qui, quand, children, blason = BLASON, ini = CLUB.initiales }: { qui: string; quand: string; children: ReactNode; blason?: Blason; ini?: string }) {
  return (
    <article className={cn(SURFACE, "flex flex-col gap-3 p-4")}>
      <div className="flex items-center gap-2.5">
        <Ecusson initiales={ini} fond="noir" blason={blason} taille={32} />
        <span className="flex flex-col leading-tight">
          <span className="text-lecture font-semibold">{qui}</span>
          <span className="text-petit text-encre-3">{quand}</span>
        </span>
      </div>
      {children}
    </article>
  );
}

function Score({ a, b, sa, sb, ba, bb, ia, ib }: { a: string; b: string; sa: number; sb: number; ba: Blason; bb: Blason; ia: string; ib: string }) {
  return (
    <div className="flex items-center justify-between rounded-[14px] bg-foreground/[0.04] px-4 py-4">
      <span className="flex w-24 flex-col items-center gap-1.5">
        <Ecusson initiales={ia} fond="noir" blason={ba} taille={48} />
        <span className="text-corps font-medium">{a}</span>
      </span>
      <span className="font-[family-name:var(--font-anton)] text-[44px] leading-none tabular-nums">
        {sa} – {sb}
      </span>
      <span className="flex w-24 flex-col items-center gap-1.5">
        <Ecusson initiales={ib} fond="blanc" blason={bb} taille={48} />
        <span className="truncate text-corps font-medium">{b}</span>
      </span>
    </div>
  );
}

function EcranActu({ role, autres }: { role: Role; autres: boolean }) {
  return (
    <Page role={role} actif="actu">
      <Tete titre="Actu" droite={<Vue role={role} />} />
      <Segmente options={["FC Démo", "Les clubs Bola"]} valeur={autres ? "Les clubs Bola" : "FC Démo"} />
      {!autres ? (
        <>
          {role === "president" && (
            <div className={cn(SURFACE, "flex items-center gap-3 px-4 py-3")}>
              <Megaphone className="size-5 text-encre-2" />
              <span className="flex-1 text-lecture text-encre-3">Écrire au club…</span>
              <span className="rounded-full bg-foreground px-3 py-1.5 text-corps font-semibold text-background">Publier</span>
            </div>
          )}
          <Post qui="Seniors" quand="Dimanche · J9">
            <Score a="FC Démo" b="Olymp. Témoin" sa={3} sb={1} ba={BLASON} bb={ADVERSES["Olympique Témoin"]} ia="FCD" ib="OT" />
            <span className="text-lecture">Troisième victoire de suite. Le terrain d&apos;honneur a fait le plein.</span>
          </Post>
          <Post qui="U13 · le joueur du mois" quand="Lundi">
            <div className="flex items-center gap-4">
              <CarteJoueur size={96 / 254} />
              <span className="flex flex-col gap-1">
                <span className="text-titre font-semibold">Timéo Aubrac</span>
                <span className="text-corps text-encre-2">5 buts en novembre · 70 → 73</span>
                <span className="text-corps text-encre-3">Choisi par Corentin</span>
              </span>
            </div>
          </Post>
          <Post qui="Hortense Valmont · présidente" quand="Mardi">
            <span className="text-lecture">Tournoi de Noël le samedi 20 décembre, toutes les catégories. Les parents qui peuvent tenir la buvette, répondez ici.</span>
            <div className="flex gap-2">
              <span className="rounded-full bg-foreground/[0.06] px-3 py-1.5 text-corps font-medium">✋ 14 parents</span>
              <span className="rounded-full bg-foreground/[0.06] px-3 py-1.5 text-corps font-medium">💬 6</span>
            </div>
          </Post>
          <Post qui="Féminines" quand="Dimanche · J9">
            <Score a="Étoile Factice" b="FC Démo" sa={0} sb={2} ba={ADVERSES["Étoile Factice"]} bb={BLASON} ia="EF" ib="FCD" />
          </Post>
        </>
      ) : (
        <>
          <Post qui="US Modèle" quand="Dimanche" blason={ADVERSES["US Modèle"]} ini="USM">
            <Score a="US Modèle" b="Racing Essai" sa={2} sb={2} ba={ADVERSES["US Modèle"]} bb={ADVERSES["Racing Essai"]} ia="USM" ib="RE" />
            <span className="text-lecture">Le derby se joue jusqu&apos;à la 90e. Rendez-vous samedi contre vos U17.</span>
          </Post>
          <div className="flex flex-col gap-2">
            <Rubrique droite="U13 · novembre">Les meilleurs des clubs Bola</Rubrique>
            <div className={cn(SURFACE, "grid grid-cols-3 gap-2 px-3 py-4")}>
              {[
                { p: "Timéo", n: "Aubrac", c: "FC Démo", note: 73 },
                { p: "Ilan", n: "Gensac", c: "US Modèle", note: 74 },
                { p: "Kenzo", n: "Peyrac", c: "Racing Essai", note: 72 },
              ].map((j) => (
                <span key={j.p} className="flex flex-col items-center gap-1.5">
                  <CarteJoueur size={64 / 254} prenom={j.p} nom={j.n} note={j.note} />
                  <span className="text-corps font-medium">{j.p}</span>
                  <span className="text-petit text-encre-3">{j.c}</span>
                </span>
              ))}
            </div>
          </div>
          <Post qui="Racing Essai" quand="Samedi" blason={ADVERSES["Racing Essai"]} ini="RE">
            <span className="text-lecture">Nos U11 cherchent un tournoi en janvier. Un club Bola partant ?</span>
          </Post>
        </>
      )}
    </Page>
  );
}

/* ------------------------- Mon équipe (entraîneur) ---------------------- */

function EcranEquipe() {
  const non = U13.filter((j) => j.reponse === "non");
  const sans = U13.filter((j) => j.reponse === null && !j.attente);
  return (
    <Page role="entraineur" actif="gestion">
      <Tete titre="Mon équipe" droite={<Vue role="entraineur" />} />
      <Segmente options={["U13", "U17"]} valeur="U13" />

      <div className="flex flex-col gap-2">
        <Rubrique droite="samedi 14 h">Convocation · AS Exemple</Rubrique>
        <div className={cn(SURFACE, "flex flex-col gap-4 p-4")}>
          <div className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-anton)] text-[44px] leading-none tabular-nums">12</span>
            <span className="text-lecture text-encre-2">viennent sur 14</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {non.map((j) => (
              <span key={j.p} className="flex items-center gap-3">
                <CarteJoueur size={36 / 254} prenom={j.p} nom={j.n} poste={j.poste} note={j.note} />
                <span className="flex-1 text-lecture font-medium">{j.p}</span>
                <span className="text-corps text-encre-3">absent · malade</span>
              </span>
            ))}
            {sans.map((j) => (
              <span key={j.p} className="flex items-center gap-3">
                <CarteJoueur size={36 / 254} prenom={j.p} nom={j.n} poste={j.poste} note={j.note} />
                <span className="flex-1 text-lecture font-medium">{j.p}</span>
                <span className="rounded-full bg-foreground px-3 py-1 text-corps font-semibold text-background">Relancer</span>
              </span>
            ))}
          </div>
          <span className="flex h-11 items-center justify-center rounded-full bg-foreground/[0.07] text-lecture font-semibold">Faire la compo</span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique>La semaine</Rubrique>
        <div className={cn(SURFACE, "overflow-hidden")}>
          <Ligne i={0} titre="Mercredi 18 h · entraînement" sous="L'appel à faire sur place" />
          <Ligne i={1} titre="Mercredi 2 · Racing Essai" sous="Convocation à envoyer" fort />
          <Ligne i={2} titre="Après le match" sous="Score, buteurs, notes des joueurs" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique droite="15">Effectif</Rubrique>
        <div className={cn(SURFACE, "grid grid-cols-5 gap-x-1.5 gap-y-3 px-3 py-4")}>
          {U13.map((j) => (
            <span key={j.p} className={cn("flex flex-col items-center gap-1", j.attente && "opacity-40")}>
              <CarteJoueur size={52 / 254} prenom={j.p} nom={j.n} poste={j.poste} note={j.note} />
              <span className="max-w-full truncate text-petit font-medium">{j.p}</span>
            </span>
          ))}
        </div>
        <span className="px-1 text-corps text-encre-3">Ewen attend l&apos;accord de ses parents.</span>
      </div>
    </Page>
  );
}

/* ---------------------------- Le club (présidente) ---------------------- */

function EcranClub() {
  return (
    <Page role="president" actif="gestion">
      <Tete titre="Le club" droite={<Vue role="president" />} />
      <div className={cn(SURFACE, "flex items-center gap-4 p-4")}>
        <Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={64} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-titre-m font-bold tracking-tight">{CLUB.nom}</span>
          <span className="truncate text-corps text-encre-2">{CLUB.lieu}</span>
          <span className="truncate text-corps text-encre-3">{CLUB.adresse}</span>
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique droite="Club 200">Licences</Rubrique>
        <div className={cn(SURFACE, "flex flex-col gap-3 p-4")}>
          <div className="flex items-baseline gap-2">
            <span className="font-[family-name:var(--font-anton)] text-[44px] leading-none tabular-nums">62</span>
            <span className="text-lecture text-encre-2">actives sur 200</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
            <div className="h-full rounded-full bg-foreground" style={{ width: "31%" }} />
          </div>
          <span className="flex h-11 items-center justify-center gap-2 rounded-full bg-foreground text-lecture font-semibold text-background">
            <Plus className="size-4" /> Inviter des licenciés
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique>À faire</Rubrique>
        <div className={cn(SURFACE, "overflow-hidden")}>
          <Ligne i={0} titre="2 accords parentaux" sous="Ewen et Soan, U13 : pas convoqués avant" fort />
          <Ligne i={1} titre="5 invitations sans réponse" sous="Envoyées il y a plus de 7 jours" />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique droite="4">Équipes</Rubrique>
        <div className={cn(SURFACE, "overflow-hidden")}>
          {[
            ["U13", "Corentin Delorme", "15"],
            ["U17", "Corentin Delorme", "15"],
            ["Seniors", "Mathis Tavernier", "18"],
            ["Féminines", "Solène Garrigue", "12"],
          ].map(([c, e, n], i) => (
            <Ligne key={c} i={i} titre={c} sous={e} droite={n} avant={<Ecusson initiales={CLUB.initiales} fond="noir" blason={BLASON} taille={34} />} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Rubrique>Le club</Rubrique>
        <div className={cn(SURFACE, "overflow-hidden")}>
          <Ligne i={0} titre="Logo, couleurs, adresse" />
          <Ligne i={1} titre="Terrains et créneaux" droite="3" />
          <Ligne i={2} titre="Staff et bénévoles" droite="12" />
          <Ligne i={3} titre="Parents" droite="31" />
        </div>
      </div>
    </Page>
  );
}

/* --------------------------------- page -------------------------------- */

function Maquette() {
  const q = useSearchParams();
  const ecran = (q.get("ecran") ?? "map") as Ecran;
  const role = (q.get("role") ?? "joueur") as Role;
  if (ecran === "map") return <EcranMap role={role} />;
  if (ecran === "match") return <EcranMatch role={role} />;
  if (ecran === "carte") return <EcranCarte role={role} />;
  if (ecran === "actu" || ecran === "clubs") return <EcranActu role={role} autres={ecran === "clubs"} />;
  if (ecran === "equipe") return <EcranEquipe />;
  return <EcranClub />;
}

export default function Page_() {
  return (
    <Suspense fallback={null}>
      <Maquette />
    </Suspense>
  );
}
