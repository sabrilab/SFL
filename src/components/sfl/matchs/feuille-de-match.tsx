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
// Chaque joueur y porte le maillot de son camp, sa photo repeinte par le
// code (lib/sfl/maillot-des-photos.ts), dans l'app comme dans l'image.
// Toucher une carte ouvre la fiche du joueur (fiche-joueur.tsx). Quand les
// matchs ne se jouent pas tous à la même heure ou au même endroit, ou que
// l'admin a dit sur quel terrain (Sabri, 23/10), chacun le porte dans un coin.
//
// « Partager la feuille » en fait une image au format story (1080 × 1920,
// noir, logo BOLA, l'heure en grand) : le terrain dessiné comme dans l'app et
// agrandi. Plusieurs matchs le même jour : une image par match, toutes
// partagées d'un coup (Sabri, 24/10). La feuille de partage du téléphone
// s'ouvre, on choisit Snap.
// L'image est préparée dès que la fiche s'ouvre, pour que le geste de partage
// parte tout de suite (Safari refuse de partager si le geste a attendu trop
// longtemps) ; sans feuille de partage (ordinateur), elle se télécharge.
// Elle part seule, sans titre : sur iPhone, un titre arrive à l'app choisie
// comme un texte à part, avant l'image, et Snap s'y perdait.
//
// Sous le terrain de la journée en cours, Le Flair de ce match : qui gagne, le
// meilleur et le buteur du jour (matchs/flair.tsx).
//
// Les terrains viennent de lib/sfl/feuille.ts ; l'image est dessinée hors
// écran puis photographiée par html-to-image (déjà là pour la carte 3D).

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toBlob } from "html-to-image";
import { toast } from "sonner";
import { Share } from "lucide-react";
import {
  FicheJoueurSheet,
  type EquipeDuJour,
} from "@/components/sfl/fiche-joueur";
import { usePhotoPerso } from "@/hooks/use-player-photo";
import { usePhotoAuMaillot, useVersionMaillots } from "@/hooks/use-photo-au-maillot";
import { useSeason } from "@/components/sfl/season-provider";
import {
  placesSurDemiTerrain,
  monTerrain,
  type TerrainFeuille,
} from "@/lib/sfl/feuille";
import { ovr, type Player } from "@/lib/sfl/engine";
import type { Camp } from "@/lib/sfl/maillots";
import { cn } from "@/lib/utils";
import { projeter, TERRAIN } from "@/lib/sfl/terrain-vu";
import { SolTerrain } from "@/components/sfl/matchs/sol-terrain";
import { Nom } from "@/components/sfl/nom";
import { FlairDuMatch } from "@/components/sfl/matchs/flair";

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
  maillot,
  onChoisir,
}: {
  player: Player | undefined;
  nom: string;
  cote: number;
  /** La note aux couleurs de l'équipe. */
  onglet: { fond: string; encre: string };
  /** Le camp du joueur : sa photo porte ce maillot-là. */
  maillot?: Camp;
  /** Toucher la carte ouvre la fiche du joueur ; absent dans l'image. */
  onChoisir?: (p: Player) => void;
}) {
  const photo = usePhotoAuMaillot(usePhotoPerso(nom), maillot);
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
          <img
            src={photo}
            alt=""
            // Chargée comme html-to-image la relit : l'image partagée la trouve en cache.
            crossOrigin={photo.startsWith("data:") ? undefined : "anonymous"}
            // L'adresse d'origine : l'image partagée y repeint la photo à sa taille (useImage).
            data-photo={photo}
            className="size-full object-cover"
          />
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
  camp: Camp;
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
        camp: eq.camp,
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
  j = null,
  avantFlair = null,
}: {
  terrains: TerrainFeuille[];
  moi: string;
  entete: EnTeteFeuille;
  /** La journée de la feuille, pour Le Flair (matchs/flair.tsx) ; null pour la convocation. */
  j?: number | null;
  /** Ce qui passe entre les terrains et Le Flair (la page du lieu : le compte à rebours et la journée en étapes). */
  avantFlair?: ReactNode;
}) {
  const { allPlayers } = useSeason();
  const parNom = useMemo(
    () => new Map(allPlayers.map((p) => [p.name, p])),
    [allPlayers],
  );
  const [choix, setChoix] = useState(() => monTerrain(terrains, moi));
  const t = terrains[Math.min(choix, terrains.length - 1)];
  // Plusieurs matchs : on glisse d'un terrain à l'autre (Sabri, 31/10), les
  // pastilles suivent et y mènent. Au départ, le terrain où je joue.
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const r = rail.current;
    if (r) r.scrollLeft = choix * r.clientWidth;
    // Une seule fois, à l'ouverture : ensuite c'est le doigt qui mène.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const suivre = () => {
    const r = rail.current;
    if (!r) return;
    const i = Math.round(r.scrollLeft / r.clientWidth);
    if (i !== choix && i >= 0 && i < terrains.length) setChoix(i);
  };
  const aller = (i: number) => {
    const r = rail.current;
    if (r) r.scrollTo({ left: i * r.clientWidth, behavior: "smooth" });
    setChoix(i);
  };

  // Une image par match du jour, chaque terrain tel qu'on le voit dans l'app.
  const sujets = useMemo(
    () =>
      terrains.map((x) => ({
        terrain: x,
        basEstA: !x.b.joueurs.includes(moi),
        label: terrains.length > 1 ? x.label : null,
      })),
    [terrains, moi],
  );
  const image = useImage(sujets, entete, parNom);
  const [fiche, setFiche] = useState<{
    player: Player;
    equipe: EquipeDuJour;
  } | null>(null);

  if (!t) return null;
  // Des matchs à des heures ou des lieux différents : chacun dit les siens,
  // et le terrain qu'il occupe sur place quand l'admin l'a donné.
  const heures = new Set(terrains.map((x) => x.heure)).size > 1;
  const lieux = new Set(terrains.map((x) => x.ou)).size > 1;
  const horaireDe = (x: TerrainFeuille) => [heures && x.heure, lieux && x.ou, x.terrain].filter(Boolean).join(" · ");

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        {/* Avec plus de deux matchs, les pastilles prennent toute la ligne. */}
        {terrains.length <= 2 && (
          <p className="mono-label pl-1 text-muted-foreground">
            Feuille de match
          </p>
        )}
        {terrains.length > 1 && (
          <div className={cn("flex gap-1 rounded-full bg-secondary p-[3px]", terrains.length > 2 && "flex-1")}>
            {terrains.map((x, i) => (
              <button
                key={x.label}
                type="button"
                onClick={() => aller(i)}
                className={cn(
                  "h-[30px] whitespace-nowrap px-3 text-corps font-semibold", terrains.length > 2 && "flex-1",
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

      <div
        ref={rail}
        onScroll={suivre}
        className="-mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto [scrollbar-width:none]"
      >
        {terrains.map((x) => {
          const basA = !x.b.joueurs.includes(moi);
          const [bas, haut] = basA ? [x.a, x.b] : [x.b, x.a];
          return (
            <div key={x.label} className="w-full shrink-0 snap-center px-4">
              <TerrainVu
                poses={poser(x, basA)}
                haut={haut}
                bas={bas}
                moi={moi}
                parNom={parNom}
                horaire={horaireDe(x)}
                onChoisir={(p, player) =>
                  setFiche({
                    player,
                    equipe: {
                      nom: p.equipe,
                      camp: p.camp,
                      couleur: p.couleur,
                      encre: p.encre,
                      terrain: terrains.length > 1 ? x.label : null,
                    },
                  })
                }
              />
            </div>
          );
        })}
      </div>

      {avantFlair && <div className="mt-2 flex flex-col gap-5">{avantFlair}</div>}

      <FlairDuMatch j={j} noirs={t.a.joueurs} blancs={t.b.joueurs} />

      <button
        type="button"
        disabled={!image.pret}
        onClick={image.partager}
        className="bouton-principal bouton--mauve flex h-12 items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-40"
      >
        <Share className="size-[18px]" />
        {terrains.length > 1 ? `Partager les ${terrains.length} feuilles` : "Partager la feuille"}
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
      className="relative w-full overflow-hidden rounded-[22px] bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff_0%,#e6e8e3_70%)] dark:bg-[radial-gradient(120%_80%_at_50%_0%,#22252a_0%,#111214_70%)]"
      style={{ height: CADRE_H }}
    >
      <SolTerrain ombres={places} />
      {/* Le logo couché au rond central ; en <img>, que html-to-image sait
          embarquer. Blanc sur la nuit, noir sur le papier du mode clair. */}
      {["/bola/symbole-blanc.svg", "/bola/symbole-noir.svg"].map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element -- photographié par html-to-image
        <img
          key={src}
          src={src}
          alt=""
          aria-hidden
          className={cn("absolute", i === 0 ? "hidden dark:block" : "dark:hidden")}
          style={{
            left: `calc(50% - ${logo.l / 2}px)`,
            top: centre.y - logo.l / 2,
            width: logo.l,
            height: logo.l,
            transform: `scaleY(${logo.h / logo.l})`,
            opacity: 0.85,
          }}
        />
      ))}
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
              <div className={cn("flex rounded-[15px]", p.nom === moi && "bg-[#0a0b0d] p-[3px] dark:bg-white")}>
                <div className={cn("flex rounded-[12px]", p.nom === moi && "bg-white p-[2px] dark:bg-[#1b1d21]")}>
                  <Pastille
                    player={player}
                    nom={p.nom}
                    cote={42}
                    onglet={{ fond: p.couleur, encre: p.encre }}
                    maillot={p.camp}
                    onChoisir={onChoisir && ((pl) => onChoisir(p, pl))}
                  />
                </div>
              </div>
              <span
                className="whitespace-nowrap rounded-full px-[7px] py-[2px] text-legende shadow-[inset_0_0_0_1px_rgba(128,128,128,0.45)]"
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
        <span className="absolute top-3.5 right-3.5 max-w-[55%] truncate rounded-full bg-black/55 px-2.5 py-1 text-petit font-semibold text-white backdrop-blur">
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
      <span className="text-ligne font-extrabold text-[#0A0B0D] dark:text-white">
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

/** Les prises d'une image avant de la garder telle quelle. */
const ESSAIS = 5;
/** Un gif transparent d'un pixel. */
const VIDE = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
/** Le gris sous la photo d'une carte (Pastille) : ce qu'on voit quand elle manque. */
const GRIS_SANS_PHOTO = [0xcf, 0xce, 0xca];

/**
 * Chaque photo de l'image, repeinte à la taille de sa carte (deux fois, pour
 * l'export) en JPEG, et posée telle quelle dans la balise : une image légère,
 * au bon type, que Safari dessine sans aller la chercher. Une photo qui ne se
 * repeint pas (pas encore là, refusée) reste à son adresse.
 */
async function poserLesPhotos(noeud: HTMLElement) {
  const imgs = Array.from(noeud.querySelectorAll<HTMLImageElement>("img[data-photo]"));
  await Promise.all(
    imgs.map(async (img) => {
      const adresse = img.dataset.photo!;
      if (img.dataset.posee === adresse) return;
      try {
        const source = new Image();
        if (!adresse.startsWith("data:") && !adresse.startsWith("blob:")) source.crossOrigin = "anonymous";
        source.src = adresse;
        await source.decode();
        const boite = img.getBoundingClientRect();
        const echelle = 2 * Math.max(1, boite.width / img.offsetWidth || 1);
        const l = Math.max(1, Math.round(img.offsetWidth * echelle));
        const h = Math.max(1, Math.round(img.offsetHeight * echelle));
        // object-cover : la photo couvre la carte, centrée.
        const k = Math.max(l / source.naturalWidth, h / source.naturalHeight);
        const sl = l / k;
        const sh = h / k;
        const toile = document.createElement("canvas");
        toile.width = l;
        toile.height = h;
        toile
          .getContext("2d")!
          .drawImage(source, (source.naturalWidth - sl) / 2, (source.naturalHeight - sh) / 2, sl, sh, 0, 0, l, h);
        const data = toile.toDataURL("image/jpeg", 0.9);
        if (img.dataset.photo !== adresse) return;
        img.src = data;
        await img.decode();
        img.dataset.posee = adresse;
      } catch {
        // Elle reste à son adresse : html-to-image ira la chercher.
      }
    }),
  );
}

/**
 * L'image a-t-elle toutes ses photos ? On lit, sur chaque carte qui en a une,
 * quelques points : tous du gris d'une carte vide, elle manque.
 */
async function photosPresentes(noeud: HTMLElement, blob: Blob): Promise<boolean> {
  // Seules les photos posées comptent : une photo qui n'a pas pu se charger
  // manquera à toutes les prises.
  const imgs = Array.from(noeud.querySelectorAll<HTMLImageElement>("img[data-posee]"));
  if (!imgs.length) return true;
  try {
    const image = await createImageBitmap(blob);
    const origine = noeud.getBoundingClientRect();
    const kx = image.width / origine.width;
    const ky = image.height / origine.height;
    const toile = document.createElement("canvas");
    toile.width = 1;
    toile.height = 1;
    const ctx = toile.getContext("2d", { willReadFrequently: true })!;
    const lire = (x: number, y: number) => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.drawImage(image, Math.round(x), Math.round(y), 1, 1, 0, 0, 1, 1);
      return ctx.getImageData(0, 0, 1, 1).data;
    };
    const grise = (p: Uint8ClampedArray) => GRIS_SANS_PHOTO.every((c, i) => Math.abs(p[i] - c) <= 4);
    const toutes = imgs.every((img) => {
      const b = img.getBoundingClientRect();
      const x = (b.left - origine.left) * kx;
      const y = (b.top - origine.top) * ky;
      const l = b.width * kx;
      const h = b.height * ky;
      // Le haut et le milieu : l'onglet de la note couvre le coin bas droit.
      const points = [
        [0.5, 0.35],
        [0.3, 0.25],
        [0.35, 0.55],
      ];
      return !points.every(([u, v]) => grise(lire(x + u * l, y + v * h)));
    });
    image.close();
    return toutes;
  } catch {
    // Rien pour regarder : l'image est gardée telle quelle.
    return true;
  }
}

interface SujetImage {
  terrain: TerrainFeuille;
  basEstA: boolean;
  /** « Match 2 » quand il y en a plusieurs. */
  label: string | null;
}

/**
 * Dessine les images hors écran, les photographie dès que la fiche est
 * ouverte, et rend le geste de partage immédiat.
 */
function useImage(
  sujets: SujetImage[],
  entete: EnTeteFeuille,
  parNom: Map<string, Player>,
) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  // Une photo repeinte au maillot qui arrive : les images se reprennent, avec elle.
  const maillots = useVersionMaillots();
  const cle = JSON.stringify([sujets, entete, maillots]);
  // Les images tiennent aux feuilles qu'elles montrent : d'autres feuilles, et elles sont périmées.
  const [pris, setPris] = useState<{ cle: string; fichiers: File[] } | null>(null);
  const fichiers = pris?.cle === cle ? pris.fichiers : null;

  useEffect(() => {
    let annule = false;
    // Laisse la fiche finir de monter, et les photos arriver.
    const minuteur = setTimeout(async () => {
      const noeuds = refs.current.slice(0, sujets.length);
      if (!noeuds.length || noeuds.some((n) => !n)) return;
      try {
        await document.fonts?.ready;
        // Les photos, repeintes à la taille de leur carte et posées dans
        // l'image : html-to-image n'a plus à les chercher.
        for (const noeud of noeuds) await poserLesPhotos(noeud!);
        if (annule) return;
        const prendreTout = async () => {
          const blobs: Blob[] = [];
          for (const noeud of noeuds) {
            // Safari (et tout navigateur d'iPhone) peut dessiner l'image avant
            // d'y avoir posé les photos : elle sort avec des cartes grises.
            // On regarde chaque carte de l'image, et on la reprend tant
            // qu'il en manque une (Sabri, 24/10 : « Snap » sans les photos).
            let blob: Blob | null = null;
            for (let essai = 0; essai < ESSAIS && !annule; essai++) {
              blob = await toBlob(noeud!, {
                pixelRatio: 2,
                // Les photos changent d'adresse avec elles (?v=…) ; une photo
                // repeinte (blob:) ne se relit pas si on lui ajoute un paramètre.
                includeQueryParams: true,
                // Un logo qui ne se charge pas laisse un vide, pas l'image entière.
                imagePlaceholder: VIDE,
                width: LARGEUR,
                height: HAUTEUR,
              });
              if (!blob || (await photosPresentes(noeud!, blob))) break;
            }
            if (annule || !blob) return;
            blobs.push(blob);
          }
          setPris({
            cle,
            fichiers: blobs.map(
              (blob, i) =>
                new File(
                  [blob],
                  blobs.length > 1 ? `feuille-de-match-${i + 1}-bola.png` : "feuille-de-match-bola.png",
                  { type: "image/png" },
                ),
            ),
          });
        };
        await prendreTout();
        // Les logos aussi peuvent manquer à la première prise de Safari :
        // la seconde les a, et remplace la première.
        if (!annule && navigator.vendor.startsWith("Apple")) await prendreTout();
      } catch {
        // Pas d'image : le bouton reste grisé, la feuille se lit quand même.
      }
    }, 600);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
    // La clé dit tout ce que montrent les images.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);

  async function partager() {
    if (!fichiers) return;
    // Les fichiers seuls. Avec un titre, Safari met dans la feuille de partage
    // un texte à part, avant les images : Snap (comme Instagram ou WhatsApp)
    // prend ce texte et laisse les images, ou reste bloqué.
    const donnees = { files: fichiers };
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
    for (const fichier of fichiers) {
      const url = URL.createObjectURL(fichier);
      const a = document.createElement("a");
      a.href = url;
      a.download = fichier.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }

  const calque = sujets.length > 0 && (
    <div
      aria-hidden
      className="pointer-events-none fixed top-0"
      style={{ left: -10000 }}
    >
      {sujets.map((sujet, i) => (
        <div
          key={sujet.terrain.label}
          ref={(n) => {
            refs.current[i] = n;
          }}
        >
          <ImageFeuille sujet={sujet} entete={entete} parNom={parNom} />
        </div>
      ))}
    </div>
  );

  return { pret: !!fichiers, partager, calque };
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
    // Noire dans les deux modes : la classe dark garde au terrain sa nuit.
    <div
      className="dark"
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
              font: `500 12px/1 var(--font-inter), system-ui, sans-serif`,
              letterSpacing: 1,
              color: GRIS,
              textTransform: "uppercase",
            }}
          >
            {entete.surtitre}
          </span>
        </div>
        {/* L'heure en grand, en face du titre (Sabri, 24/10). */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div
            style={{
              font: "900 35px/1 var(--font-inter), Inter, system-ui, sans-serif",
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
            }}
          >
            Feuille de match
          </div>
          <div style={{ font: "64px/0.82 var(--font-anton), Anton, sans-serif", whiteSpace: "nowrap" }}>
            {t.heure ?? entete.heure}
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sujet.label && <span>{sujet.label} · </span>}
          {entete.jour}
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
            font: "500 12px/1 var(--font-inter), system-ui, sans-serif",
            letterSpacing: 0.6,
            color: GRIS,
          }}
        >
          getbola.app
        </span>
      </div>
    </div>
  );
}
