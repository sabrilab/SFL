"use client";

// Les couleurs de Bola Club (lib/sfl/club/couleurs.ts) : la version choisie
// posée sur <html data-couleurs> tant qu'on est dans /club, et retirée en
// sortant (le reste de l'app garde son noir et blanc) ; pour la version
// « club », les variables tirées de l'écusson. La police des titres (Libre
// Caslon Condensed, celle de la landing et de la maquette Bola Club) est
// chargée ici, sans bloquer la page. La pastille « Couleurs · Vif », à côté de celle de la démo,
// passe à la version suivante ; ?couleurs=pelouse|club la pose.

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useClub } from "@/hooks/use-club";
import { CLE_COULEURS, estVersion, VERSION_DEFAUT, VERSIONS, variablesDuClub, type VersionCouleurs } from "@/lib/sfl/club/couleurs";

const POLICE_TITRE = "https://fonts.googleapis.com/css2?family=Libre+Caslon+Condensed:wght@400..700&display=swap";

const abonnes = new Set<() => void>();
function lire(): VersionCouleurs {
  try {
    const v = localStorage.getItem(CLE_COULEURS);
    return estVersion(v) ? v : VERSION_DEFAUT;
  } catch {
    return VERSION_DEFAUT;
  }
}
export function choisirCouleurs(v: VersionCouleurs) {
  try {
    localStorage.setItem(CLE_COULEURS, v);
  } catch {}
  abonnes.forEach((f) => f());
}
const ecouter = (f: () => void) => {
  abonnes.add(f);
  return () => void abonnes.delete(f);
};

export function useCouleurs(): VersionCouleurs {
  return useSyncExternalStore(ecouter, lire, () => VERSION_DEFAUT);
}

export function CouleursClub() {
  const { club } = useClub();
  const version = useCouleurs();
  const demande = useSearchParams().get("couleurs");
  useEffect(() => {
    if (estVersion(demande)) choisirCouleurs(demande);
  }, [demande]);
  // La police des titres, ajoutée une fois à <head> sans retenir la page (une
  // feuille « precedence » de React suspend le rendu tant qu'elle charge).
  useEffect(() => {
    if (document.querySelector(`link[href="${POLICE_TITRE}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = POLICE_TITRE;
    document.head.appendChild(l);
  }, []);
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.couleurs = version;
    const vars = version === "club" ? variablesDuClub(club.blason.couleurs) : {};
    for (const [k, v] of Object.entries(vars)) html.style.setProperty(k, v);
    return () => {
      delete html.dataset.couleurs;
      for (const k of Object.keys(vars)) html.style.removeProperty(k);
    };
  }, [version, club.blason.couleurs]);
  const k = VERSIONS.findIndex((v) => v.id === version);
  const suivante = VERSIONS[(k + 1) % VERSIONS.length];
  return (
    <>
      <button
        type="button"
        onClick={() => choisirCouleurs(suivante.id)}
        aria-label={`Couleurs : ${VERSIONS[k].label} ; passer à ${suivante.label}`}
        className="grid h-11 place-items-center px-1 transition-opacity active:opacity-60"
      >
        <span className="flex items-center gap-1.5 rounded-full border border-foreground/20 px-3 py-[5px] text-[12px] leading-none font-semibold">
          <span className="size-2 rounded-full" style={{ background: "var(--club-accent)" }} />
          {VERSIONS[k].label}
        </span>
      </button>
    </>
  );
}
