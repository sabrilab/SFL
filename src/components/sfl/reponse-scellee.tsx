"use client";

// La réponse scellée : « Je viens » ou « Pas dispo », dite une fois.
//
// Sabri, 27/10/2026 : on passait sur le match, on décochait « Je viens » ou
// on cochait « Pas dispo » sans le vouloir, on venait, on repartait, on
// revenait, et la liste ne voulait plus rien dire. Une fois qu'on a répondu
// à l'appel, les boutons se figent. Et ce moment-là doit se voir : « une
// animation stylée qui montre que c'est solennel », sur le modèle de la
// barre de progression en pixels de Claude sur ordinateur.
//
// Le geste : on TIENT le bouton. Une grille de pixels le remplit de gauche
// à droite (un tramage ordonné, la matrice de Bayer, comme une barre de
// progression qui avance en pixels) ; lâcher avant la fin la vide, et rien
// n'est envoyé. Un toucher qui passe en faisant défiler l'écran ne répond
// donc plus jamais : c'est la confirmation, portée par l'animation elle-même,
// sans fenêtre ni texte. Au bout (HOLD), un tic sous le doigt, la réponse
// part, les deux boutons s'effacent et la pilule scellée se pose à leur
// place : la réponse, un cadenas, et ce qui reste des pixels en trame fine.
//
// Les couleurs : la référence de Sabri était bleue, mais le bleu est
// réservé aux cartes Défensive (comme l'or au MVP et le rouge à l'Impact).
// Le sceau prend donc le ton du geste : le vert « y aller » pour Je viens,
// l'argent neutre pour Pas dispo ; les pixels sont d'encre ou de blanc.
//
// Mouvement : opacité et transformations seulement. Avec « Réduire les
// animations », la règle globale (globals.css) éteint les durées mais pas
// les délais : pendant qu'on tient, les pixels s'allument encore en place,
// sans fondu (une barre de progression, rien ne bouge), et le sceau se pose
// d'un coup. Au clavier et avec VoiceOver (un clic sans pointeur, déjà
// délibéré), la réponse est scellée sans attendre.
//
// La règle tient aussi en base (supabase/schema.sql : presence sans
// update ni delete pour le joueur ; match_feuille_gardee, match_sortie_gardee,
// match_entree_gardee et match_refus pour les matchs ouverts par un joueur).
// Seuls l'admin (et l'organisateur, pour son match) changent une réponse.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { tic } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";

export type ReponseScellable = "present" | "absent";
/**
 * ok : enregistrée ; figee : la base avait déjà une réponse ; erreur : rien
 * n'est parti ; dite : rien n'est parti, et l'écran l'a déjà dit.
 */
export type IssueReponse = "ok" | "figee" | "erreur" | "dite";

/** Le temps qu'il faut tenir pour sceller. */
export const HOLD = 700;
/** Le temps du sceau qui se pose, après le tic. */
const POSE = 440;

// La matrice de Bayer 4×4 : l'ordre dans lequel les pixels d'un carré s'allument.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
// La taille d'un pixel de la grille (px CSS, espace compris).
const PAS = 7;

type Phase =
  | { t: "repos" }
  | { t: "tient"; r: ReponseScellable; cols: number; rows: number }
  | { t: "lache"; r: ReponseScellable; cols: number; rows: number }
  | { t: "pose"; r: ReponseScellable; cols: number; rows: number };

const LIBELLES: Record<ReponseScellable, string> = { present: "Je viens", absent: "Pas dispo" };

export function ReponseScellee({
  mine,
  onRepondre,
  onScellee,
  ouvert = true,
  libelles,
  seul,
  tonSeul = "vert",
  taille = "md",
  className,
}: {
  /** La réponse connue (base ou saison) : non nulle, le sceau est posé. */
  mine: ReponseScellable | null;
  /** Envoie la réponse. Appelé une seule fois, au bout du geste. */
  onRepondre: (r: ReponseScellable) => Promise<IssueReponse>;
  /** Le sceau est posé (après son animation) : recharger, fermer… */
  onScellee?: (r: ReponseScellable) => void;
  /** Faux : les réponses sont closes, les boutons éteints. */
  ouvert?: boolean;
  libelles?: Partial<Record<ReponseScellable, string>>;
  /** Un seul bouton (prendre une place d'un match public : c'est un « Je viens »). */
  seul?: { r: ReponseScellable; libelle: string };
  /** Le ton du bouton seul (la braise quand il manque des joueurs). */
  tonSeul?: "vert" | "braise";
  taille?: "md" | "sm";
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ t: "repos" });
  // La réponse que je viens de sceller, en attendant que la base la renvoie.
  const [scellee, setScellee] = useState<ReponseScellable | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tenu = useRef(false);
  const vivant = useRef(true);
  useEffect(
    () => () => {
      vivant.current = false;
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    []
  );

  const nom = (r: ReponseScellable) => (seul && seul.r === r ? LIBELLES[r] : (libelles?.[r] ?? LIBELLES[r]));
  const hauteur = taille === "sm" ? "h-10 text-[13px]" : "h-[50px] text-[15px]";
  const affichee = mine ?? scellee;

  const sceller = useCallback(
    async (r: ReponseScellable, cols: number, rows: number) => {
      tic([10, 30, 16]);
      setPhase({ t: "pose", r, cols, rows });
      const issue = await onRepondre(r).catch((): IssueReponse => "erreur");
      if (!vivant.current) return;
      if (issue === "ok") {
        setScellee(r);
        // Le sceau finit de se poser, puis l'écran reprend la main.
        minuteur.current = setTimeout(() => {
          if (!vivant.current) return;
          setPhase({ t: "repos" });
          onScellee?.(r);
        }, POSE);
        return;
      }
      setPhase({ t: "repos" });
      if (issue === "figee") toast("Ta réponse est déjà donnée.");
      else if (issue === "erreur") toast.error("Réponse impossible à enregistrer. Réessaie dans un instant.");
    },
    [onRepondre, onScellee]
  );

  const commencer = (r: ReponseScellable, el: HTMLElement) => {
    if (!ouvert || phase.t === "pose") return;
    const { width, height } = el.getBoundingClientRect();
    const cols = Math.max(8, Math.round(width / PAS));
    const rows = Math.max(3, Math.round(height / PAS));
    tenu.current = true;
    setPhase({ t: "tient", r, cols, rows });
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => {
      if (!tenu.current) return;
      tenu.current = false;
      // La pilule entière : la grille du sceau couvre toute la rangée.
      const rangee = el.parentElement?.getBoundingClientRect();
      void sceller(r, rangee ? Math.max(8, Math.round(rangee.width / PAS)) : cols, rows);
    }, HOLD);
  };

  const lacher = () => {
    if (!tenu.current) return;
    tenu.current = false;
    if (minuteur.current) clearTimeout(minuteur.current);
    setPhase((p) => (p.t === "tient" ? { ...p, t: "lache" } : p));
    minuteur.current = setTimeout(() => vivant.current && setPhase((p) => (p.t === "lache" ? { t: "repos" } : p)), 200);
  };

  // Sceau posé, plus rien à toucher.
  if (affichee && phase.t !== "pose") {
    return <Pilule r={affichee} libelle={nom(affichee)} hauteur={hauteur} className={className} />;
  }

  const boutons: { r: ReponseScellable; libelle: string; cls: string }[] = seul
    ? [{ r: seul.r, libelle: seul.libelle, cls: cn("bouton-principal", tonSeul === "braise" ? "bouton--braise" : "bouton--vert", "font-semibold") }]
    : [
        { r: "present", libelle: nom("present"), cls: "bouton-principal bouton--vert font-bold" },
        { r: "absent", libelle: nom("absent"), cls: "bouton-secondaire bouton--rouge font-semibold" },
      ];

  return (
    <div className={cn("relative", className)}>
      <div className={cn("flex gap-2", phase.t === "pose" && "scelle-efface")}>
        {boutons.map((b) => {
          const actif = phase.t !== "repos" && phase.r === b.r && phase.t !== "pose";
          return (
            <button
              key={b.r}
              type="button"
              disabled={!ouvert || phase.t === "pose"}
              data-scelle={b.r}
              className={cn("scelle-bouton flex flex-1 items-center justify-center overflow-hidden", hauteur, b.cls)}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                commencer(b.r, e.currentTarget);
              }}
              onPointerUp={lacher}
              onPointerLeave={lacher}
              onPointerCancel={lacher}
              onContextMenu={(e) => e.preventDefault()}
              onClick={(e) => {
                // Clavier, VoiceOver : un clic sans pointeur, déjà délibéré.
                if (e.detail !== 0 || !ouvert || phase.t !== "repos") return;
                const { width, height } = e.currentTarget.getBoundingClientRect();
                const rangee = e.currentTarget.parentElement?.getBoundingClientRect();
                void sceller(b.r, Math.max(8, Math.round((rangee?.width ?? width) / PAS)), Math.max(3, Math.round(height / PAS)));
              }}
            >
              {actif && (phase.t === "tient" || phase.t === "lache") && (
                <Grille cols={phase.cols} rows={phase.rows} mode="remplit" lache={phase.t === "lache"} />
              )}
              <span className="relative">{b.libelle}</span>
            </button>
          );
        })}
      </div>
      {phase.t === "pose" && (
        <Pilule
          r={phase.r}
          libelle={nom(phase.r)}
          hauteur={hauteur}
          className="absolute inset-0 scelle-arrive"
          grille={{ cols: phase.cols, rows: phase.rows }}
        />
      )}
    </div>
  );
}

/** La pilule scellée : la réponse et son cadenas, sur une trame fine de son ton. */
function Pilule({
  r,
  libelle,
  hauteur,
  className,
  grille,
}: {
  r: ReponseScellable;
  libelle: string;
  hauteur: string;
  className?: string;
  /** Pendant la pose : la grille pleine qui se dissout dans la trame. */
  grille?: { cols: number; rows: number };
}) {
  return (
    <div
      role="status"
      aria-label={`${libelle}, réponse scellée`}
      className={cn(
        "scelle-pilule flex items-center justify-center gap-2 overflow-hidden rounded-full font-semibold",
        r === "present" ? "scelle--vert" : "scelle--argent",
        hauteur,
        className
      )}
    >
      {grille && <Grille cols={grille.cols} rows={grille.rows} mode="dissout" />}
      <Lock className="scelle-cadenas relative size-[14px] shrink-0" strokeWidth={2.4} aria-hidden />
      <span className="relative">{libelle}</span>
    </div>
  );
}

/**
 * La grille de pixels. « remplit » : chaque pixel s'allume à son seuil, de
 * gauche à droite, tramé par Bayer (la barre de progression). « dissout » :
 * pleine au départ, elle s'éteint dans l'ordre de Bayer et laisse la trame.
 */
function Grille({ cols, rows, mode, lache = false }: { cols: number; rows: number; mode: "remplit" | "dissout"; lache?: boolean }) {
  const pixels = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const b = BAYER[y % 4][x % 4] / 16;
      const delai =
        mode === "remplit"
          ? // Le front avance de gauche à droite ; la trame le rend granuleux.
            Math.round(((x + b * 3) / (cols + 3)) * HOLD * 0.94)
          : Math.round(b * 260);
      pixels.push(<i key={y * cols + x} style={{ "--d": `${delai}ms` } as CSSProperties} />);
    }
  }
  return (
    <span
      aria-hidden
      className={cn("scelle-grille", mode === "remplit" ? "scelle-grille--remplit" : "scelle-grille--dissout", lache && "scelle-grille--lache")}
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {pixels}
    </span>
  );
}
