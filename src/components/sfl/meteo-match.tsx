"use client";

// L'aperçu météo d'un match (Sabri, 24/10 : « mettre un aperçu de la météo
// pour voir, à telle heure, ce que ça prévoit »). La prévision et sa source :
// lib/sfl/meteo.ts.
//
// Composé comme une pièce imprimée de la carte, pas comme une appli météo :
// les coins de repère du portrait, l'étiquette en mono, la température en
// Anton, le ciel en pictogramme gravé (traits et hachures à l'encre,
// meteo-pictos.tsx, aucune icône toute faite), les chiffres du match en trois colonnes
// sous un filet, puis l'heure d'avant et les heures du match, le match
// souligné d'une accolade. Dessous, la source en microtexte, avec l'heure où
// elle a été lue. Encre seule (currentColor) : juste en clair comme en
// sombre, sans or, bleu ni rouge (réservés aux cartes MVP, Défensive, Impact).
//
// Deux tailles : `pleine` (la fiche du match sur la Map) et `ligne` (la
// convocation des Actus : le ciel, la température et le vent sur une ligne,
// puis les heures).
//
// Rien ne s'affiche hors de la prévision (au-delà de 15 jours, match passé)
// ni quand la source ne répond pas.

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ANTON } from "@/components/sfl/actus/ecran";
import {
  cielDeLHeure,
  datePrevisible,
  FRAICHEUR_MS,
  heureDuMatch,
  heuresAutour,
  lireMeteo,
  RAFALES_FORTES,
  type HeureMeteo,
  type Prevision,
} from "@/lib/sfl/meteo";
import { minutesDe } from "@/lib/sfl/matchs-du-jour";
import { PictoMeteo } from "@/components/sfl/meteo-pictos";

/** La prévision d'un terrain pour un jour, relue quand elle vieillit et quand l'app revient au premier plan. */
function usePrevision(lat: number | null, lng: number | null, date: string | null): Prevision | null {
  const [p, setP] = useState<Prevision | null>(null);
  useEffect(() => {
    if (lat == null || lng == null || !date) return;
    let fini = false;
    const lire = () =>
      lireMeteo(lat, lng, date).then((x) => {
        if (!fini) setP(x);
      });
    lire();
    const visible = () => document.visibilityState === "visible" && lire();
    document.addEventListener("visibilitychange", visible);
    const minuterie = window.setInterval(lire, FRAICHEUR_MS);
    return () => {
      fini = true;
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(minuterie);
    };
  }, [lat, lng, date]);
  return p && p.date === date ? p : null;
}

const arrondi = (n: number) => Math.round(n);
const heureLue = (ms: number) =>
  new Date(ms).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });

export interface MeteoMatchProps {
  lat: number | null | undefined;
  lng: number | null | undefined;
  /** AAAA-MM-JJ. */
  date: string | null;
  /** Le coup d'envoi, « 13h00 », « 14h30 ». */
  heure: string;
  /** Aujourd'hui à Paris, AAAA-MM-JJ. */
  aujourdhui: string;
  taille?: "pleine" | "ligne";
  className?: string;
}

export function MeteoMatch({ lat, lng, date, heure, aujourdhui, taille = "pleine", className }: MeteoMatchProps) {
  const ok = lat != null && lng != null && datePrevisible(date, aujourdhui);
  const prevision = usePrevision(ok ? lat : null, ok ? lng : null, ok ? date : null);
  const minutes = minutesDe(heure);
  if (!ok || !prevision || minutes == null) return null;
  const h = Math.floor(minutes / 60);
  const match = heureDuMatch(prevision, h);
  if (!match) return null;
  const autour = heuresAutour(prevision, h);
  const ciel = cielDeLHeure(match);
  const micro = `${prevision.date.split("-").reverse().join(".")} · ${lat.toFixed(3)}N ${lng.toFixed(3)}E`;
  const source = `${prevision.meteoFrance ? "Météo-France · " : ""}Open-Meteo · lu à ${heureLue(prevision.lueA)}`;

  if (taille === "ligne") {
    return (
      <div className={cn("flex flex-col gap-2.5", className)} aria-label={`Météo à ${h} h : ${ciel.libelle}, ${arrondi(match.temperature)} degrés`}>
        <div className="flex items-center gap-3">
          <PictoMeteo ciel={ciel.ciel} className="size-8 shrink-0" />
          <span className="text-[30px] leading-none" style={{ fontFamily: ANTON }}>
            {arrondi(match.temperature)}°
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-bold">{ciel.libelle}</span>
            <span className="mono-label truncate text-[9px] text-foreground/50 dark:text-white/50">
              {h}h · vent {arrondi(match.vent)} · rafales {arrondi(match.rafales)} km/h
            </span>
          </span>
        </div>
        <Heures heures={autour} h={h} />
        <Source texte={source} micro={micro} />
      </div>
    );
  }

  return (
    <section
      className={cn("relative px-4 pt-4 pb-3", className)}
      aria-label={`Météo au coup d'envoi, ${h} h : ${ciel.libelle}, ${arrondi(match.temperature)} degrés, rafales ${arrondi(match.rafales)} kilomètres heure`}
    >
      <Coins />
      <p className="mono-label text-foreground/55">Météo · coup d&apos;envoi {h}h</p>
      <div className="mt-2.5 flex items-center gap-3.5">
        <span className="text-[56px] leading-[0.82] tracking-tight" style={{ fontFamily: ANTON }}>
          {arrondi(match.temperature)}°
        </span>
        <PictoMeteo ciel={ciel.ciel} className="size-12 shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-[17px] font-bold tracking-tight">{ciel.libelle}</span>
          {match.ressenti != null && Math.abs(match.ressenti - match.temperature) >= 1 && (
            <span className="text-[13px] text-foreground/55">ressenti {arrondi(match.ressenti)}°</span>
          )}
        </span>
      </div>
      <div className="mt-3.5 grid grid-cols-3 border-t border-foreground/15 pt-2.5">
        <Chiffre label="Pluie" valeur={match.pluie != null ? `${arrondi(match.pluie)} %` : `${match.mm.toFixed(1).replace(".", ",")} mm`} />
        <Chiffre label="Vent" valeur={`${arrondi(match.vent)}`} unite="km/h" />
        <Chiffre label="Rafales" valeur={`${arrondi(match.rafales)}`} unite="km/h" fort={match.rafales >= RAFALES_FORTES} />
      </div>
      <Heures heures={autour} h={h} className="mt-3 border-t border-foreground/15 pt-2.5" />
      <Source texte={source} micro={micro} className="mt-2.5" />
    </section>
  );
}

/** Une colonne de chiffres : l'étiquette en mono, la valeur en gras. Les rafales fortes passent en encre pleine, en négatif. */
function Chiffre({ label, valeur, unite, fort }: { label: string; valeur: string; unite?: string; fort?: boolean }) {
  return (
    <span className="flex flex-col gap-1">
      <span className="mono-label text-[9px] text-foreground/50">{label}</span>
      <span className="flex items-baseline gap-1">
        <span
          className={cn(
            "text-[19px] leading-none font-bold tabular-nums tracking-tight",
            fort && "-ml-1 mr-0.5 rounded-[3px] bg-foreground px-1 py-0.5 text-background",
          )}
        >
          {valeur}
        </span>
        {unite && <span className="text-[11px] text-foreground/50">{unite}</span>}
      </span>
    </span>
  );
}

/** L'heure d'avant et les heures du match ; le match (son heure et la suivante) souligné d'une accolade. */
function Heures({ heures, h, className }: { heures: HeureMeteo[]; h: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-4", className)}>
      {heures.map((x) => {
        const dans = x.h === h || x.h === h + 1;
        return (
          <span key={x.h} className={cn("relative flex flex-col items-center gap-1 pb-2", !dans && "opacity-45")}>
            <span className="mono-label text-[9px]">{x.h}h</span>
            <PictoMeteo ciel={cielDeLHeure(x).ciel} className="size-6" />
            <span className="text-[13px] font-bold tabular-nums">{arrondi(x.temperature)}°</span>
            <span className="text-[10px] tabular-nums text-foreground/55">{arrondi(x.rafales)} km/h</span>
            {dans && (
              <span
                aria-hidden
                className={cn(
                  "absolute bottom-0 h-1.5 border-b border-foreground/60",
                  x.h === h ? "right-0 left-3 rounded-bl-[3px] border-l" : "right-3 left-0 rounded-br-[3px] border-r",
                )}
              />
            )}
          </span>
        );
      })}
    </div>
  );
}

/** La source ; à côté, en microtexte comme la ligne de la carte, le jour et la position du terrain. */
function Source({ texte, micro, className }: { texte: string; micro: string; className?: string }) {
  return (
    <p className={cn("flex items-center gap-2 overflow-hidden", className)}>
      <span className="mono-label shrink-0 text-[8px] text-foreground/45">{texte}</span>
      <span aria-hidden className="min-w-0 flex-1 overflow-hidden font-mono text-[5px] tracking-[0.18em] whitespace-nowrap text-foreground/30 uppercase">
        {`${micro} · `.repeat(10)}
      </span>
    </p>
  );
}

/** Les coins de repère du portrait de la carte. */
function Coins() {
  const c = "pointer-events-none absolute size-2.5 border-foreground/35";
  return (
    <span aria-hidden>
      <span className={cn(c, "top-0 left-0 border-t border-l")} />
      <span className={cn(c, "top-0 right-0 border-t border-r")} />
      <span className={cn(c, "bottom-0 left-0 border-b border-l")} />
      <span className={cn(c, "right-0 bottom-0 border-b border-r")} />
    </span>
  );
}
