"use client";

// La feuille de match dans la fiche du match (Map) : chaque match sur son
// terrain, vu en légère perspective (le terrain couché, les cartes debout
// dessus, chacune avec son ombre), le logo BOLA au rond central. Chaque joueur
// est posé à son poste avec sa carte en pastille, la note aux couleurs de son
// équipe (noire chez les Noirs, blanche chez les Blancs). Mon équipe joue en
// bas, devant ; ma carte est cerclée. Plusieurs terrains le même jour : on
// passe de l'un à l'autre, la fiche s'ouvre sur le mien. Toucher une carte
// ouvre la fiche du joueur (fiche-joueur.tsx).
//
// « Partager la feuille » en fait une image au format story (1080 × 1920,
// noir, logo BOLA), celle qu'on envoyait dans le groupe Snap : la feuille de
// partage du téléphone s'ouvre, on choisit Snap. L'image est préparée dès que
// la fiche s'ouvre, pour que le geste de partage parte tout de suite (Safari
// refuse de partager si le geste a attendu trop longtemps) ; sans feuille de
// partage (ordinateur), elle se télécharge.
//
// Les terrains viennent de lib/sfl/feuille.ts ; l'image est la même
// composition, dessinée hors écran puis photographiée par html-to-image
// (déjà là pour la carte 3D).

import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { Share } from "lucide-react";
import { FicheJoueurSheet, type EquipeDuJour } from "@/components/sfl/fiche-joueur";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { placesSurDemiTerrain, monTerrain, type TerrainFeuille } from "@/lib/sfl/feuille";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

export interface EnTeteFeuille {
  /** « J8 · Sunday Five League ». */
  surtitre: string;
  /** « Dimanche 19 octobre · 13h00 ». */
  quand: string;
  /** « Urban Soccer, Lille Sud » ; null tant que le lieu n'est pas posé. */
  ou: string | null;
}

/** Une carte en pastille ; un joueur absent du vestiaire garde son initiale. */
function Pastille({
  player,
  nom,
  cote,
  onglet,
  onChoisir,
}: {
  player: Player | undefined;
  nom: string;
  cote: number;
  /** La note aux couleurs de l'équipe. */
  onglet: { fond: string; encre: string };
  /** Toucher la carte ouvre la fiche du joueur ; absent dans l'image. */
  onChoisir?: (p: Player) => void;
}) {
  if (player && onChoisir)
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onChoisir(player);
        }}
        aria-label={`Voir la fiche de ${player.name}`}
        className="shrink-0 transition-transform active:scale-95 motion-reduce:transition-none"
      >
        <PlayerCard player={player} size={cote / 254} onglet={onglet} />
      </button>
    );
  if (player) return <PlayerCard player={player} size={cote / 254} onglet={onglet} />;
  return (
    <div
      className="flex items-center justify-center bg-[#f4f3ef] font-bold text-[#0A0B0D]"
      style={{ width: cote, height: cote, borderRadius: "24%", fontSize: cote * 0.4 }}
    >
      {nom.slice(0, 1).toUpperCase()}
    </div>
  );
}

/** Le dessin du terrain, en traits blancs ; `couche` les dit plus ou moins forts. */
function Lignes({ vertical, couche }: { vertical: boolean; couche: string }) {
  const trait = { borderColor: couche };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-[10px] rounded-[5px] border-[1.5px]" style={trait} />
      {vertical ? (
        <>
          <div className="absolute inset-x-[10px] top-1/2 border-t-[1.5px]" style={trait} />
          <div className="absolute left-1/2 top-[10px] h-[11%] w-[40%] -translate-x-1/2 rounded-b-[999px] border-[1.5px] border-t-0" style={trait} />
          <div className="absolute bottom-[10px] left-1/2 h-[11%] w-[40%] -translate-x-1/2 rounded-t-[999px] border-[1.5px] border-b-0" style={trait} />
        </>
      ) : (
        <>
          <div className="absolute inset-y-[10px] left-1/2 border-l-[1.5px]" style={trait} />
          <div className="absolute left-[10px] top-1/2 h-[42%] w-[9%] -translate-y-1/2 rounded-r-[999px] border-[1.5px] border-l-0" style={trait} />
          <div className="absolute right-[10px] top-1/2 h-[42%] w-[9%] -translate-y-1/2 rounded-l-[999px] border-[1.5px] border-r-0" style={trait} />
        </>
      )}
      <div
        className="absolute left-1/2 top-1/2 flex aspect-square -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px]"
        style={{ ...trait, width: vertical ? "33%" : "17%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
        <img src="/bola/symbole-blanc.svg" alt="" style={{ width: "52%", height: "52%", opacity: 0.85 }} />
      </div>
    </div>
  );
}

interface Pose {
  nom: string;
  equipe: string;
  couleur: string;
  encre: string;
  /** En % de la largeur. */
  x: number;
  /** En % de la hauteur (image) ; en px depuis la ligne médiane (app). */
  y: number;
}

/** Le cadre du terrain de l'app ; le terrain couché dedans, et son inclinaison. */
const CADRE_H = 540;
const TERRAIN = { l: 270, h: 540, incline: 56 };

/** Vertical : la profondeur (8 le but, 40 l'attaque) en px depuis la médiane du terrain couché. */
const depuisMediane = (profondeur: number) => 62 + ((40 - profondeur) / 32) * (TERRAIN.h / 2 - 98);

/**
 * Vertical : en perspective, les lignes qui se font face à la médiane se
 * chevaucheraient ; on les décale. Chez moi (devant), l'attaque se resserre ;
 * en face (au fond, donc plus petit), elle s'écarte.
 */
const ecart = (profondeur: number, chezMoi: boolean) =>
  profondeur < 16 ? 1 : chezMoi ? (profondeur < 32 ? 1.4 : 0.56) : profondeur < 32 ? 0.9 : 1.36;

/**
 * Les joueurs d'un terrain, posés. Vertical (l'app) : `bas` joue en bas.
 * Horizontal (l'image) : `bas` joue à gauche.
 */
function poser(t: TerrainFeuille, vertical: boolean, basEstA: boolean): Pose[] {
  const [bas, haut] = basEstA ? [t.a, t.b] : [t.b, t.a];
  const out: Pose[] = [];
  for (const [eq, chezMoi] of [
    [bas, true],
    [haut, false],
  ] as const) {
    const places = placesSurDemiTerrain(eq.joueurs.length);
    eq.joueurs.forEach((nom, i) => {
      const { profondeur, largeur } = places[i];
      const p = chezMoi ? profondeur : 100 - profondeur;
      out.push(
        vertical
          ? {
              nom,
              equipe: eq.nom,
              couleur: eq.couleur,
              encre: eq.encre,
              x: 50 + (largeur - 50) * ecart(profondeur, chezMoi),
              y: (chezMoi ? 1 : -1) * depuisMediane(profondeur),
            }
          : { nom, equipe: eq.nom, couleur: eq.couleur, encre: eq.encre, x: p, y: largeur }
      );
    });
  }
  return out;
}

const prenom = (nom: string) => nom.split(" ")[0];

export function FeuilleDeMatch({ terrains, moi, entete }: { terrains: TerrainFeuille[]; moi: string; entete: EnTeteFeuille }) {
  const { allPlayers } = useSeason();
  const parNom = useMemo(() => new Map(allPlayers.map((p) => [p.name, p])), [allPlayers]);
  const [choix, setChoix] = useState(() => monTerrain(terrains, moi));
  const t = terrains[Math.min(choix, terrains.length - 1)];

  const image = useImage(terrains, entete, parNom);
  const [fiche, setFiche] = useState<{ player: Player; equipe: EquipeDuJour } | null>(null);

  if (!t) return null;
  const basEstA = !t.b.joueurs.includes(moi);
  const [bas, haut] = basEstA ? [t.a, t.b] : [t.b, t.a];
  const poses = poser(t, true, basEstA);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="mono-label pl-1 text-muted-foreground">Feuille de match</p>
        {terrains.length > 1 && (
          <div className="flex gap-1 rounded-full bg-secondary p-[3px]">
            {terrains.map((x, i) => (
              <button
                key={x.label}
                type="button"
                onClick={() => setChoix(i)}
                className={cn(
                  "h-[30px] rounded-full px-3 text-[12.5px] font-semibold",
                  i === choix ? "bg-foreground text-background" : "text-foreground"
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#e9e8e3_0%,#d6d5d0_70%)] dark:bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
        style={{ height: CADRE_H, perspective: 1000, perspectiveOrigin: "50% 25%" }}
      >
        <div
          className="absolute left-1/2"
          style={{
            top: -34,
            width: TERRAIN.l,
            height: TERRAIN.h,
            marginLeft: -TERRAIN.l / 2,
            transformStyle: "preserve-3d",
            transform: `rotateX(${TERRAIN.incline}deg)`,
          }}
        >
          <div aria-hidden className="absolute inset-0 rounded-[10px] bg-[linear-gradient(180deg,#c4c3be_0%,#d2d1cc_100%)] dark:bg-[linear-gradient(180deg,#17191d_0%,#24272c_100%)]" />
          <div
            aria-hidden
            className="absolute inset-0 rounded-[10px]"
            style={{ backgroundImage: "repeating-linear-gradient(180deg, rgba(255,255,255,0.06) 0 50px, transparent 50px 100px)" }}
          />
          {/* L'épaisseur du terrain, vue par le bord avant. */}
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-[14px] rounded-b-[6px] bg-[#a9a8a3] dark:bg-[#08090b]"
            style={{ transformOrigin: "50% 100%", transform: "rotateX(-90deg)" }}
          />
          <Lignes vertical couche="rgba(255,255,255,0.7)" />
          {poses.map((p) => (
            <div key={p.nom} className="absolute size-0" style={{ left: `${p.x}%`, top: TERRAIN.h / 2 + p.y, transformStyle: "preserve-3d" }}>
              <div
                aria-hidden
                className="absolute left-[-22px] top-[-9px] h-[18px] w-[44px] rounded-full"
                style={{ background: "radial-gradient(closest-side, rgba(0,0,0,0.55), transparent)" }}
              />
              {/* La carte se relève face à nous. */}
              <div
                className="absolute bottom-0 left-0 flex flex-col items-center gap-1"
                style={{ transformOrigin: "50% 100%", transform: `translateX(-50%) rotateX(-${TERRAIN.incline}deg)` }}
              >
                {/* Ma carte, cerclée : un vrai cadre, les ombres portées se découpent mal en 3D. */}
                <div className={cn("flex rounded-[14px]", p.nom === moi && "bg-foreground p-[3px]")}>
                  <Pastille
                    player={parNom.get(p.nom)}
                    nom={p.nom}
                    cote={44}
                    onglet={{ fond: p.couleur, encre: p.encre }}
                    onChoisir={(player) =>
                      setFiche({
                        player,
                        equipe: { nom: p.equipe, couleur: p.couleur, encre: p.encre, terrain: terrains.length > 1 ? t.label : null },
                      })
                    }
                  />
                </div>
                <span
                  className="whitespace-nowrap rounded-full px-[7px] py-[2px] text-[11px] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
                  style={{ background: p.couleur, color: p.encre, fontWeight: p.nom === moi ? 800 : 600 }}
                >
                  {p.nom === moi ? "Toi" : prenom(p.nom)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <NomEquipe nom={haut.nom} couleur={haut.couleur} className="left-[18px] top-4" />
        <NomEquipe nom={bas.nom} couleur={bas.couleur} className="bottom-10 left-[18px]" />
      </div>

      <button
        type="button"
        disabled={!image.pret}
        onClick={image.partager}
        className="flex h-12 items-center justify-center gap-2 rounded-full bg-foreground text-[15px] font-semibold text-background disabled:opacity-40"
      >
        <Share className="size-[18px]" />
        Partager la feuille
      </button>
      {image.calque}
      <FicheJoueurSheet player={fiche?.player ?? null} equipe={fiche?.equipe ?? null} onClose={() => setFiche(null)} />
    </section>
  );
}

function NomEquipe({ nom, couleur, className }: { nom: string; couleur: string; className: string }) {
  return (
    <div className={cn("absolute flex items-center gap-[7px]", className)}>
      <span aria-hidden className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(128,128,128,0.6)]" style={{ background: couleur }} />
      <span className="text-[14px] font-extrabold text-[#0A0B0D] dark:text-white">{nom}</span>
    </div>
  );
}

/* ------------------------------ L'image ------------------------------ */

const LARGEUR = 540; // × 2 à l'export : 1080 × 1920
const HAUTEUR = 960;
const GRIS = "#8a8985";

/**
 * Dessine l'image hors écran, la photographie dès que la fiche est ouverte,
 * et rend le geste de partage immédiat.
 */
function useImage(terrains: TerrainFeuille[], entete: EnTeteFeuille, parNom: Map<string, Player>) {
  const ref = useRef<HTMLDivElement>(null);
  const cle = JSON.stringify([terrains, entete]);
  // L'image tient à la feuille qu'elle montre : une autre feuille, et elle est périmée.
  const [pris, setPris] = useState<{ cle: string; fichier: File } | null>(null);
  const fichier = pris?.cle === cle ? pris.fichier : null;

  useEffect(() => {
    let annule = false;
    // Laisse la fiche finir de monter, et les photos arriver.
    const minuteur = setTimeout(async () => {
      const noeud = ref.current;
      if (!noeud) return;
      try {
        await document.fonts?.ready;
        const blob = await toBlob(noeud, { pixelRatio: 2, cacheBust: true, width: LARGEUR, height: HAUTEUR });
        if (!annule && blob) setPris({ cle, fichier: new File([blob], "feuille-de-match-bola.png", { type: "image/png" }) });
      } catch {
        // Pas d'image : le bouton reste grisé, la feuille se lit quand même.
      }
    }, 600);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [cle]);

  async function partager() {
    if (!fichier) return;
    const donnees = { files: [fichier], title: "Feuille de match" };
    if (typeof navigator.canShare === "function" && navigator.canShare(donnees)) {
      try {
        await navigator.share(donnees);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError") toast.error("Le partage n'a pas pu s'ouvrir.");
      }
      return;
    }
    const url = URL.createObjectURL(fichier);
    const a = document.createElement("a");
    a.href = url;
    a.download = fichier.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const calque = (
    <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
      <div ref={ref}>
        <ImageFeuille terrains={terrains} entete={entete} parNom={parNom} />
      </div>
    </div>
  );

  return { pret: !!fichier, partager, calque };
}

/** L'image story : noir, logo BOLA, un terrain par match vu de côté. */
function ImageFeuille({ terrains, entete, parNom }: { terrains: TerrainFeuille[]; entete: EnTeteFeuille; parNom: Map<string, Player> }) {
  const n = Math.max(1, terrains.length);
  const terrainH = Math.min(320, Math.floor((640 - (n - 1) * 18) / n) - 34);
  const cote = n >= 3 ? 40 : 50;
  return (
    <div
      style={{
        width: LARGEUR,
        height: HAUTEUR,
        boxSizing: "border-box",
        padding: "48px 32px 32px",
        background: "#08090b",
        color: "#fff",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
          <img src="/bola/logo-blanc.svg" alt="" width={118} height={28} style={{ objectFit: "contain", objectPosition: "left center" }} />
          <span style={{ font: `500 12px/1 var(--font-jbmono), monospace`, letterSpacing: 1, color: GRIS, textTransform: "uppercase" }}>{entete.surtitre}</span>
        </div>
        <div style={{ font: "400 50px/1 var(--font-anton), Anton, sans-serif", letterSpacing: 0.5, textTransform: "uppercase" }}>Feuille de match</div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {entete.quand}
          {entete.ou && <span style={{ fontWeight: 500, color: GRIS }}> · {entete.ou}</span>}
        </div>
      </div>

      {terrains.map((t) => (
        <div key={t.label} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto minmax(0,1fr)", alignItems: "center" }}>
            <EquipeImage nom={t.a.nom} couleur={t.a.couleur} />
            <span style={{ font: "700 11px/1 var(--font-jbmono), monospace", letterSpacing: 1, color: GRIS, textTransform: "uppercase" }}>{t.label}</span>
            <EquipeImage nom={t.b.nom} couleur={t.b.couleur} droite />
          </div>
          <div style={{ position: "relative", height: terrainH, borderRadius: 18, overflow: "hidden", background: "#17191d" }}>
            <Lignes vertical={false} couche="rgba(255,255,255,0.22)" />
            {poser(t, false, true).map((p) => (
              <div
                key={p.nom}
                style={{
                  position: "absolute",
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: "translate(-50%, -50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Pastille player={parNom.get(p.nom)} nom={p.nom} cote={cote} onglet={{ fond: p.couleur, encre: p.encre }} />
                <span
                  style={{
                    padding: "2px 6px",
                    borderRadius: 999,
                    background: p.couleur,
                    color: p.encre,
                    boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.35)",
                    fontSize: n >= 3 ? 10 : 11,
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                  }}
                >
                  {prenom(p.nom)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
        <img src="/bola/symbole-blanc.svg" alt="" width={22} height={22} />
        <span style={{ font: "500 12px/1 var(--font-jbmono), monospace", letterSpacing: 0.6, color: GRIS }}>sfl-eight.vercel.app</span>
      </div>
    </div>
  );
}

function EquipeImage({ nom, couleur, droite }: { nom: string; couleur: string; droite?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexDirection: droite ? "row-reverse" : "row" }}>
      <span style={{ width: 13, height: 13, borderRadius: "50%", background: couleur, boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.6)" }} />
      <span style={{ font: "400 24px/1 var(--font-anton), Anton, sans-serif", textTransform: "uppercase", letterSpacing: 0.4 }}>{nom}</span>
    </div>
  );
}
