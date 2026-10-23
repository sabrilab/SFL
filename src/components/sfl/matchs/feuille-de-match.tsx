"use client";

// La feuille de match dans la fiche du match (Map) : chaque match sur son
// terrain, vu en légère perspective (le terrain couché, les cartes debout
// dessus, chacune avec son ombre), le logo BOLA au rond central. La
// perspective est calculée à la main (lib/sfl/terrain-vu.ts) et non laissée à
// la 3D CSS, que Safari aplatissait et que l'image ne savait pas photographier.
// Chaque joueur est posé à son poste avec sa carte en pastille, la note aux
// couleurs de son équipe (noire chez les Noirs, blanche chez les Blancs). Mon
// équipe joue en bas, devant ; ma carte est cerclée. Plusieurs matchs le
// même jour : on passe de l'un à l'autre, la fiche s'ouvre sur le mien.
// Toucher une carte ouvre la fiche du joueur (fiche-joueur.tsx). Quand les
// matchs ne se jouent pas tous à la même heure ou au même endroit, ou que
// l'admin a dit sur quel terrain (Sabri, 23/10), chacun le porte dans un coin.
//
// « Partager la feuille » en fait une image au format story (1080 × 1920,
// noir, logo BOLA) : le terrain qu'on regarde, dessiné comme dans l'app et
// agrandi. La feuille de partage du téléphone s'ouvre, on choisit Snap.
// L'image est préparée dès que la fiche s'ouvre, pour que le geste de partage
// parte tout de suite (Safari refuse de partager si le geste a attendu trop
// longtemps) ; sans feuille de partage (ordinateur), elle se télécharge.
//
// Les terrains viennent de lib/sfl/feuille.ts ; l'image est dessinée hors
// écran puis photographiée par html-to-image (déjà là pour la carte 3D).

import { useEffect, useMemo, useRef, useState } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { Share } from "lucide-react";
import {
  FicheJoueurSheet,
  type EquipeDuJour,
} from "@/components/sfl/fiche-joueur";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { useSeason } from "@/components/sfl/season-provider";
import {
  placesSurDemiTerrain,
  monTerrain,
  type TerrainFeuille,
} from "@/lib/sfl/feuille";
import { ovr, type Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";
import { projeter, TERRAIN } from "@/lib/sfl/terrain-vu";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { Nom } from "@/components/sfl/nom";

export interface EnTeteFeuille {
  /** « J8 · Sunday Five League ». */
  surtitre: string;
  /** « Dimanche 19 octobre ». */
  jour: string;
  /** « 13h00 » : celle d'un match qui n'a pas la sienne. */
  heure: string;
  /** « Urban Soccer, Lille Sud » ; null tant que le lieu n'est pas posé. */
  ou: string | null;
}

/**
 * Une carte en pastille, dessinée comme la maquette validée : un cadre papier,
 * la photo (ou une silhouette grise sans photo), la note dans un onglet aux
 * couleurs de l'équipe.
 */
export function Pastille({
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
  const photo = usePhotoPerso(nom);
  const r = cote * 0.24;
  const carte = (
    <div
      className="relative overflow-hidden"
      style={{
        width: cote,
        height: cote,
        borderRadius: r,
        background: "#f4f3ef",
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}
    >
      <div
        className="absolute overflow-hidden"
        style={{
          inset: cote * 0.095,
          borderRadius: r * 0.8,
          background: "#cfceca",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- photographié aussi par html-to-image
          <img src={photo} alt="" className="size-full object-cover" />
        ) : (
          <svg aria-hidden viewBox="0 0 40 40" className="size-full">
            <circle cx="20" cy="16" r="7.5" fill="#b4b3ae" />
            <path d="M5 40c1-9 7-14 15-14s14 5 15 14z" fill="#b4b3ae" />
          </svg>
        )}
      </div>
      {player && (
        <div
          className="absolute right-0 bottom-0 flex items-center justify-center italic"
          style={{
            minWidth: cote * 0.55,
            height: cote * 0.38,
            padding: `0 ${cote * 0.09}px`,
            boxSizing: "border-box",
            borderTopLeftRadius: cote * 0.14,
            background: onglet.fond,
            color: onglet.encre,
            boxShadow: `inset 1px 1px 0 ${onglet.encre}33`,
            font: `italic 900 ${cote * 0.27}px/1 var(--font-inter), Inter, system-ui, sans-serif`,
            letterSpacing: "-0.03em",
          }}
        >
          {ovr(player.stats)}
        </div>
      )}
    </div>
  );
  if (!player || !onChoisir) return carte;
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
      {carte}
    </button>
  );
}

interface Pose {
  nom: string;
  equipe: string;
  couleur: string;
  encre: string;
  /** En % de la largeur du terrain. */
  x: number;
  /** En px depuis la ligne médiane. */
  y: number;
}

/** Le cadre du terrain, dans l'app comme dans l'image. */
export const CADRE_H = 540;

/** Vertical : la profondeur (8 le but, 40 l'attaque) en px depuis la médiane du terrain couché. */
export const depuisMediane = (profondeur: number) =>
  62 + ((40 - profondeur) / 32) * (TERRAIN.h / 2 - 98);

/**
 * Vertical : en perspective, les lignes qui se font face à la médiane se
 * chevaucheraient ; on les décale. Chez moi (devant), l'attaque se resserre ;
 * en face (au fond, donc plus petit), elle s'écarte.
 */
export const ecart = (profondeur: number, chezMoi: boolean) =>
  profondeur < 16
    ? 1
    : chezMoi
      ? profondeur < 32
        ? 1.4
        : 0.56
      : profondeur < 32
        ? 0.9
        : 1.36;

/** Les joueurs d'un terrain, posés : `bas` joue en bas, devant. */
function poser(t: TerrainFeuille, basEstA: boolean): Pose[] {
  const [bas, haut] = basEstA ? [t.a, t.b] : [t.b, t.a];
  const out: Pose[] = [];
  for (const [eq, chezMoi] of [
    [bas, true],
    [haut, false],
  ] as const) {
    const places = placesSurDemiTerrain(eq.joueurs.length);
    eq.joueurs.forEach((nom, i) => {
      const { profondeur, largeur } = places[i];
      out.push({
        nom,
        equipe: eq.nom,
        couleur: eq.couleur,
        encre: eq.encre,
        x: 50 + (largeur - 50) * ecart(profondeur, chezMoi),
        y: (chezMoi ? 1 : -1) * depuisMediane(profondeur),
      });
    });
  }
  return out;
}

const prenom = (nom: string) => nom.split(" ")[0];

export function FeuilleDeMatch({
  terrains,
  moi,
  entete,
}: {
  terrains: TerrainFeuille[];
  moi: string;
  entete: EnTeteFeuille;
}) {
  const { allPlayers } = useSeason();
  const parNom = useMemo(
    () => new Map(allPlayers.map((p) => [p.name, p])),
    [allPlayers],
  );
  const [choix, setChoix] = useState(() => monTerrain(terrains, moi));
  const t = terrains[Math.min(choix, terrains.length - 1)];

  const basEstA = !t?.b.joueurs.includes(moi);
  // L'image montre le terrain qu'on regarde, tel qu'on le voit.
  const image = useImage(
    t ? { terrain: t, basEstA, label: terrains.length > 1 ? t.label : null } : null,
    entete,
    parNom,
  );
  const [fiche, setFiche] = useState<{
    player: Player;
    equipe: EquipeDuJour;
  } | null>(null);

  if (!t) return null;
  const [bas, haut] = basEstA ? [t.a, t.b] : [t.b, t.a];
  const poses = poser(t, basEstA);
  // Des matchs à des heures ou des lieux différents : chacun dit les siens,
  // et le terrain qu'il occupe sur place quand l'admin l'a donné.
  const heures = new Set(terrains.map((x) => x.heure)).size > 1;
  const lieux = new Set(terrains.map((x) => x.ou)).size > 1;
  const horaire = [heures && t.heure, lieux && t.ou, t.terrain].filter(Boolean).join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="mono-label pl-1 text-muted-foreground">
          Feuille de match
        </p>
        {terrains.length > 1 && (
          <div className="flex gap-1 rounded-full bg-secondary p-[3px]">
            {terrains.map((x, i) => (
              <button
                key={x.label}
                type="button"
                onClick={() => setChoix(i)}
                className={cn(
                  "h-[30px] px-3 text-[12.5px] font-semibold",
                  i === choix
                    ? "bouton-principal"
                    : "bouton-discret",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <TerrainVu
        poses={poses}
        haut={haut}
        bas={bas}
        moi={moi}
        parNom={parNom}
        horaire={horaire}
        onChoisir={(p, player) =>
          setFiche({
            player,
            equipe: {
              nom: p.equipe,
              couleur: p.couleur,
              encre: p.encre,
              terrain: terrains.length > 1 ? t.label : null,
            },
          })
        }
      />

      <button
        type="button"
        disabled={!image.pret}
        onClick={image.partager}
        className="bouton-principal bouton--mauve flex h-12 items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40"
      >
        <Share className="size-[18px]" />
        Partager la feuille
      </button>
      {image.calque}
      <FicheJoueurSheet
        player={fiche?.player ?? null}
        equipe={fiche?.equipe ?? null}
        onClose={() => setFiche(null)}
      />
    </section>
  );
}

/**
 * Le terrain vu en perspective (lib/sfl/terrain-vu.ts) : le terrain est un
 * dessin SVG déjà projeté, chaque carte un point projeté et une échelle, les
 * plus proches devant. Le même dans l'app et dans l'image partagée.
 */
function TerrainVu({
  poses,
  haut,
  bas,
  moi,
  parNom,
  horaire,
  onChoisir,
}: {
  poses: Pose[];
  haut: { nom: string; couleur: string };
  bas: { nom: string; couleur: string };
  /** Ma carte, cerclée et nommée « Toi » ; absent dans l'image. */
  moi?: string;
  parNom: Map<string, Player>;
  /** « 14h30 · Croix · Terrain 3 » : l'heure et le lieu de ce match quand ils diffèrent des autres, son terrain sur place ; absent dans l'image. */
  horaire?: string;
  onChoisir?: (p: Pose, player: Player) => void;
}) {
  const { l, h } = TERRAIN;
  const places = poses
    .map((p) => {
      const u = (p.x / 100) * l;
      const v = h / 2 + p.y;
      return { p, u, v, ...projeter(u, v) };
    })
    .sort((a, b) => a.v - b.v);
  const centre = projeter(l / 2, h / 2);
  const logo = { l: 46 * centre.k, h: projeter(l / 2, h / 2 + 23).y - projeter(l / 2, h / 2 - 23).y };
  return (
    <div
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: CADRE_H }}
    >
      <SolTerrain ombres={places} />
      {/* Le logo couché au rond central ; en <img>, que html-to-image sait embarquer. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
      <img
        src="/bola/symbole-blanc.svg"
        alt=""
        aria-hidden
        className="absolute"
        style={{
          left: `calc(50% - ${logo.l / 2}px)`,
          top: centre.y - logo.l / 2,
          width: logo.l,
          height: logo.l,
          transform: `scaleY(${logo.h / logo.l})`,
          opacity: 0.85,
        }}
      />
      {places.map(({ p, x, y, k }) => {
        const player = parNom.get(p.nom);
        return (
          <div
            key={p.nom}
            className="absolute size-0"
            style={{ left: `calc(50% + ${x}px)`, top: y }}
          >
            <div
              className="absolute bottom-0 left-0 flex flex-col items-center gap-1"
              style={{
                transformOrigin: "50% 100%",
                transform: `translateX(-50%) scale(${k})`,
              }}
            >
              {/* Ma carte, cerclée d'un vrai cadre. */}
              <div className={cn("flex rounded-[15px]", p.nom === moi && "bg-white p-[3px]")}>
                <div className={cn("flex rounded-[12px]", p.nom === moi && "bg-[#1b1d21] p-[2px]")}>
                  <Pastille
                    player={player}
                    nom={p.nom}
                    cote={42}
                    onglet={{ fond: p.couleur, encre: p.encre }}
                    onChoisir={onChoisir && ((pl) => onChoisir(p, pl))}
                  />
                </div>
              </div>
              <span
                className="whitespace-nowrap rounded-full px-[7px] py-[2px] text-[11px] shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
                style={{
                  background: p.couleur,
                  color: p.encre,
                  fontWeight: p.nom === moi ? 800 : 600,
                }}
              >
                {p.nom === moi ? "Toi" : prenom(p.nom)}
              </span>
            </div>
          </div>
        );
      })}
      <NomEquipe nom={haut.nom} couleur={haut.couleur} className="left-[18px] top-4" />
      <NomEquipe nom={bas.nom} couleur={bas.couleur} className="bottom-[70px] left-[18px]" />
      {horaire && (
        <span className="absolute top-3.5 right-3.5 max-w-[55%] truncate rounded-full bg-black/55 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
          {horaire}
        </span>
      )}
    </div>
  );
}

function NomEquipe({
  nom,
  couleur,
  className,
}: {
  nom: string;
  couleur: string;
  className: string;
}) {
  return (
    <div className={cn("absolute flex items-center gap-[7px]", className)}>
      <span
        aria-hidden
        className="size-3 rounded-full shadow-[inset_0_0_0_1px_rgba(128,128,128,0.6)]"
        style={{ background: couleur }}
      />
      <span className="text-[14px] font-extrabold text-[#0A0B0D] dark:text-white">
        <Nom n={nom} />
      </span>
    </div>
  );
}

/* ------------------------------ L'image ------------------------------ */

const LARGEUR = 540; // × 2 à l'export : 1080 × 1920
const HAUTEUR = 960;
const GRIS = "#8a8985";
/** Le terrain de l'image : le cadre de l'app sur un téléphone (358 px), agrandi. */
const CADRE_APP = 358;
const ZOOM = 1.3;

interface SujetImage {
  terrain: TerrainFeuille;
  basEstA: boolean;
  /** « Match 2 » quand il y en a plusieurs. */
  label: string | null;
}

/**
 * Dessine l'image hors écran, la photographie dès que la fiche est ouverte,
 * et rend le geste de partage immédiat.
 */
function useImage(
  sujet: SujetImage | null,
  entete: EnTeteFeuille,
  parNom: Map<string, Player>,
) {
  const ref = useRef<HTMLDivElement>(null);
  const cle = JSON.stringify([sujet, entete]);
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
        const blob = await toBlob(noeud, {
          pixelRatio: 2,
          cacheBust: true,
          width: LARGEUR,
          height: HAUTEUR,
        });
        if (!annule && blob)
          setPris({
            cle,
            fichier: new File([blob], "feuille-de-match-bola.png", {
              type: "image/png",
            }),
          });
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
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare(donnees)
    ) {
      try {
        await navigator.share(donnees);
      } catch (e) {
        if ((e as Error)?.name !== "AbortError")
          toast.error("Le partage n'a pas pu s'ouvrir.");
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

  const calque = sujet && (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0"
      style={{ left: -10000 }}
    >
      <div ref={ref}>
        <ImageFeuille sujet={sujet} entete={entete} parNom={parNom} />
      </div>
    </div>
  );

  return { pret: !!fichier, partager, calque };
}

/**
 * L'image story : noir, logo BOLA, et le terrain tel qu'il est dans l'app
 * (le même dessin, agrandi), celui qu'on regarde quand on partage.
 */
function ImageFeuille({
  sujet,
  entete,
  parNom,
}: {
  sujet: SujetImage;
  entete: EnTeteFeuille;
  parNom: Map<string, Player>;
}) {
  const { terrain: t, basEstA } = sujet;
  const [bas, haut] = basEstA ? [t.a, t.b] : [t.b, t.a];
  return (
    <div
      style={{
        width: LARGEUR,
        height: HAUTEUR,
        boxSizing: "border-box",
        padding: "40px 32px 28px",
        background: "#08090b",
        color: "#fff",
        fontFamily: "var(--font-inter), Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ alignSelf: "stretch", display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
          <img
            src="/bola/logo-blanc.svg"
            alt=""
            width={118}
            height={28}
            style={{ objectFit: "contain", objectPosition: "left center" }}
          />
          <span
            style={{
              font: `500 12px/1 var(--font-jbmono), monospace`,
              letterSpacing: 1,
              color: GRIS,
              textTransform: "uppercase",
            }}
          >
            {entete.surtitre}
          </span>
        </div>
        <div
          style={{
            font: "900 35px/1 var(--font-inter), Inter, system-ui, sans-serif",
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
          }}
        >
          Feuille de match
        </div>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {sujet.label && <span>{sujet.label} · </span>}
          {entete.jour} · {t.heure ?? entete.heure}
          {(t.ou ?? entete.ou) && (
            <span style={{ fontWeight: 500, color: GRIS }}> · {t.ou ?? entete.ou}</span>
          )}
          {t.terrain && <span style={{ fontWeight: 500, color: GRIS }}> · {t.terrain}</span>}
        </div>
      </div>

      <div style={{ width: CADRE_APP * ZOOM, height: CADRE_H * ZOOM, flexShrink: 0 }}>
        <div
          style={{
            width: CADRE_APP,
            transform: `scale(${ZOOM})`,
            transformOrigin: "0 0",
          }}
        >
          <TerrainVu poses={poser(t, basEstA)} haut={haut} bas={bas} parNom={parNom} />
        </div>
      </div>

      <div
        style={{
          alignSelf: "stretch",
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image */}
        <img src="/bola/symbole-blanc.svg" alt="" width={22} height={22} />
        <span
          style={{
            font: "500 12px/1 var(--font-jbmono), monospace",
            letterSpacing: 0.6,
            color: GRIS,
          }}
        >
          sfl-eight.vercel.app
        </span>
      </div>
    </div>
  );
}
