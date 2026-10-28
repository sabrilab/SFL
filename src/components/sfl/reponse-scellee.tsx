"use client";

// La réponse scellée : « Je viens » ou « Pas dispo », dite une fois.
//
// Sabri, 27/10/2026 : on passait sur le match, on décochait « Je viens » ou
// on cochait « Pas dispo » sans le vouloir, on venait, on repartait, on
// revenait, et la liste ne voulait plus rien dire. Une fois qu'on a répondu
// à l'appel, la réponse se fige. Et ce moment-là doit se voir : « une
// animation stylée qui montre que c'est solennel », sur le modèle de la
// barre de progression en pixels de Claude sur ordinateur.
//
// Le geste (Sabri, 27/10 au soir : « c'est un truc à faire glisser […]
// comme si tu voulais déverrouiller […] sur iPhone ») : on GLISSE, comme
// « glisser pour déverrouiller » ou « glisser pour éteindre ». Une seule
// piste par réponse, le bouton rond au milieu : jusqu'au bout à droite,
// « Je viens » (le vert « y aller ») ; jusqu'au bout à gauche, « Pas
// dispo » (l'argent neutre, jamais de rouge). La grille de pixels (un
// tramage ordonné, la matrice de Bayer) s'allume derrière le bouton à
// mesure qu'il avance ; lâché avant le bout, il revient au milieu sur un
// ressort et rien n'est envoyé. Au bout, un tic sous le doigt, la réponse
// part, la piste s'efface et la pilule scellée se pose à sa place : la
// réponse, un cadenas, et ce qui reste des pixels en trame fine. Là où une
// seule réponse est offerte (prendre une place d'un match public), la piste
// n'a qu'un sens : le bouton part de la gauche et glisse vers la droite.
//
// Le doigt et la page : la piste ne prend que le glissé horizontal
// (touch-action: pan-y) ; un geste qui part à la verticale reste le
// défilement de la page, et le navigateur l'annule ici (pointercancel :
// le bouton revient). La position du bouton n'est pas un état React : une
// seule variable CSS (--glisse-p, de -1 à 1) que lisent le bouton, les
// libellés et chaque pixel ; déclarée par @property (scelle.css), elle se
// transitionne, et le ressort du retour est une simple transition.
//
// Les couleurs : la référence de Sabri était bleue, mais le bleu est
// réservé aux cartes Défensive (comme l'or au MVP et le rouge à l'Impact).
// Le sceau prend donc le ton du geste : le vert « y aller » pour Je viens,
// l'argent neutre pour Pas dispo ; les pixels sont d'encre ou de blanc.
// Les libellés ont le reflet discret d'iOS, une lumière qui passe vers le
// bout où il faut aller.
//
// Mouvement : avec « Réduire les animations », ni reflet ni ressort (la
// règle globale de globals.css éteint les durées : le bouton revient d'un
// coup) et le sceau se pose d'un coup. Au clavier : → ou ← mène le bouton
// au bout et y porte le focus, Entrée scelle. VoiceOver lit deux boutons,
// « Je viens » et « Pas dispo », posés chacun sur sa moitié de piste : les
// activer scelle sans attendre (un clic sans pointeur, déjà délibéré).
//
// La règle tient aussi en base (supabase/schema.sql : presence sans
// update ni delete pour le joueur ; match_feuille_gardee, match_sortie_gardee,
// match_entree_gardee et match_refus pour les matchs ouverts par un joueur).
// Seuls l'admin (et l'organisateur, pour son match) changent une réponse.

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { ChevronRight, ChevronsLeftRight, Lock } from "lucide-react";
import { toast } from "sonner";
import { tic } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";

export type ReponseScellable = "present" | "absent";
/**
 * ok : enregistrée ; figee : la base avait déjà une réponse ; erreur : rien
 * n'est parti ; dite : rien n'est parti, et l'écran l'a déjà dit.
 */
export type IssueReponse = "ok" | "figee" | "erreur" | "dite";

/** Le temps du sceau qui se pose, après le tic. */
const POSE = 440;
/** Le temps du ressort qui ramène le bouton (scelle.css, .glisse-piste). */
const RETOUR = 480;
/** La part de la course qui vaut « au bout » (le dernier pixel ne se vise pas). */
const BOUT = 0.96;
/** Le glissé qui engage le geste, et le vertical qui le laisse à la page (px). */
const ENGAGE = 6;
const VERTICAL = 10;
/** L'écart entre la piste et le bouton rond (px). */
const MARGE = 4;

// La matrice de Bayer 4×4 : l'ordre dans lequel les pixels d'un carré s'allument.
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];
// La taille d'un pixel de la grille (px CSS, espace compris).
const PAS = 7;

/** Les mesures de la piste, prises au début du geste. */
export type MesuresPiste = {
  largeur: number;
  hauteur: number;
  /** Un seul sens : le bouton part de la gauche. */
  seul: boolean;
};

/** La course du bouton, du repos au bout (px). */
export function course({ largeur, hauteur, seul }: MesuresPiste): number {
  const k = hauteur - 2 * MARGE;
  return Math.max(1, seul ? largeur - 2 * MARGE - k : largeur / 2 - MARGE - k / 2);
}

type Phase = { t: "repos" } | { t: "pose"; r: ReponseScellable; cols: number; rows: number };

const LIBELLES: Record<ReponseScellable, string> = { present: "Je viens", absent: "Pas dispo" };

export function ReponseScellee({
  mine,
  onRepondre,
  onScellee,
  ouvert = true,
  libelles,
  scelles,
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
  /** Faux : les réponses sont closes, la piste éteinte. */
  ouvert?: boolean;
  libelles?: Partial<Record<ReponseScellable, string>>;
  /** Le libellé du sceau posé, quand il diffère du geste (« Confirmer » → « Confirmé »). */
  scelles?: Partial<Record<ReponseScellable, string>>;
  /** Un seul sens (prendre une place d'un match public : c'est un « Je viens »). */
  seul?: { r: ReponseScellable; libelle: string };
  /** Le ton de la piste à un sens (la braise quand il manque des joueurs). */
  tonSeul?: "vert" | "braise";
  taille?: "md" | "sm";
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>({ t: "repos" });
  // La réponse que je viens de sceller, en attendant que la base la renvoie.
  const [scellee, setScellee] = useState<ReponseScellable | null>(null);
  // La grille n'existe que le temps d'un geste (et de son retour).
  const [mesures, setMesures] = useState<MesuresPiste | null>(null);
  const piste = useRef<HTMLDivElement | null>(null);
  const cibles = useRef<Partial<Record<ReponseScellable, HTMLButtonElement | null>>>({});
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retour = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geste = useRef<{ id: number; x: number; y: number; engage: boolean; course: number; depart: number } | null>(
    null
  );
  const fini = useRef(false);
  const vivant = useRef(true);
  useEffect(() => {
    // Remonté (le double montage du mode strict, en dev) : de nouveau vivant.
    vivant.current = true;
    return () => {
      vivant.current = false;
      if (minuteur.current) clearTimeout(minuteur.current);
      if (retour.current) clearTimeout(retour.current);
    };
  }, []);

  const nom = (r: ReponseScellable) => (seul && seul.r === r ? LIBELLES[r] : (libelles?.[r] ?? LIBELLES[r]));
  const sceau = (r: ReponseScellable) => scelles?.[r] ?? nom(r);
  const hauteur = taille === "sm" ? "h-10 text-[13px]" : "h-[50px] text-[15px]";
  const affichee = mine ?? scellee;
  const unSens = !!seul;

  /** Pose le bouton à p (de -1, Pas dispo, à 1, Je viens), sans rendu React. */
  const placer = (p: number) => piste.current?.style.setProperty("--glisse-p", String(Math.round(p * 1000) / 1000));
  const tirer = (oui: boolean) => {
    const el = piste.current;
    if (!el) return;
    if (oui) el.dataset.glisse = "tire";
    else delete el.dataset.glisse;
  };

  /** Mesure la piste, monte la grille et règle la course du bouton. */
  const mesurer = (): number => {
    const el = piste.current;
    if (!el) return 1;
    if (retour.current) clearTimeout(retour.current);
    const { width, height } = el.getBoundingClientRect();
    const m = { largeur: width, hauteur: height, seul: unSens };
    const c = course(m);
    el.style.setProperty("--course", `${c}px`);
    setMesures((prev) => (prev && prev.largeur === m.largeur && prev.hauteur === m.hauteur ? prev : m));
    return c;
  };

  /** Le bouton revient au repos sur son ressort ; la grille part après lui. */
  const revenir = () => {
    tirer(false);
    placer(0);
    if (retour.current) clearTimeout(retour.current);
    retour.current = setTimeout(() => vivant.current && setMesures(null), RETOUR);
  };

  const sceller = async (r: ReponseScellable) => {
    const el = piste.current;
    const { width, height } = el?.getBoundingClientRect() ?? { width: 320, height: 50 };
    const cols = Math.max(8, Math.round(width / PAS));
    const rows = Math.max(3, Math.round(height / PAS));
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
    fini.current = false;
    setPhase({ t: "repos" });
    // Rien n'est parti : le bouton revient au milieu.
    revenir();
    if (issue === "figee") toast("Ta réponse est déjà donnée.");
    else if (issue === "erreur") toast.error("Réponse impossible à enregistrer. Réessaie dans un instant.");
  };

  const libre = ouvert && phase.t === "repos";

  const poser = (e: PointerEvent<HTMLDivElement>) => {
    if (!ouvert || phase.t !== "repos" || fini.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // Un deuxième doigt ne vole pas le geste du premier.
    if (geste.current) return;
    geste.current = { id: e.pointerId, x: e.clientX, y: e.clientY, engage: false, course: 1, depart: 0 };
  };

  const bouger = (e: PointerEvent<HTMLDivElement>) => {
    const g = geste.current;
    if (!g || g.id !== e.pointerId || fini.current) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.engage) {
      if (Math.abs(dy) > VERTICAL && Math.abs(dy) > Math.abs(dx)) {
        // Le doigt fait défiler la page : la piste le laisse.
        geste.current = null;
        return;
      }
      if (Math.abs(dx) < ENGAGE || Math.abs(dx) < Math.abs(dy)) return;
      g.engage = true;
      g.course = mesurer();
      // Repris en plein ressort, le bouton part d'où il est, sans saut.
      const el = piste.current;
      const ici = el ? parseFloat(getComputedStyle(el).getPropertyValue("--glisse-p")) : 0;
      g.depart = Number.isFinite(ici) ? ici : 0;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Le pointeur est déjà parti : le geste finira sur pointerup.
      }
      tirer(true);
    }
    const p = Math.max(unSens ? 0 : -1, Math.min(1, g.depart + dx / g.course));
    placer(p);
    if (Math.abs(p) >= BOUT) {
      // Au bout : la réponse part, plus rien ne bouge.
      fini.current = true;
      geste.current = null;
      tirer(false);
      placer(Math.sign(p));
      const r: ReponseScellable = unSens ? seul!.r : p > 0 ? "present" : "absent";
      void sceller(r);
    }
  };

  const lever = (e: PointerEvent<HTMLDivElement>) => {
    const g = geste.current;
    if (!g || g.id !== e.pointerId) return;
    geste.current = null;
    if (g.engage && !fini.current) revenir();
  };

  // Au clavier : → et ← mènent le bouton au bout et y portent le focus ; Entrée scelle.
  const viser = (r: ReponseScellable | null) => {
    if (!libre || fini.current) return;
    if (r === null) {
      revenir();
      return;
    }
    mesurer();
    tirer(false);
    placer(r === "present" || unSens ? 1 : -1);
    cibles.current[unSens ? seul!.r : r]?.focus();
  };
  const touche = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      viser(unSens ? seul!.r : "present");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      viser(unSens ? null : "absent");
    } else if (e.key === "Escape") {
      viser(null);
    }
  };

  // Sceau posé, plus rien à toucher.
  if (affichee && phase.t !== "pose") {
    return <Pilule r={affichee} libelle={sceau(affichee)} hauteur={hauteur} className={className} />;
  }

  const cotes: { r: ReponseScellable; libelle: string; cote: "d" | "g" | "seul" }[] = seul
    ? [{ r: seul.r, libelle: seul.libelle, cote: "seul" }]
    : [
        { r: "absent", libelle: nom("absent"), cote: "g" },
        { r: "present", libelle: nom("present"), cote: "d" },
      ];

  return (
    <div className={cn("relative", className)}>
      <div
        ref={piste}
        aria-disabled={!ouvert || undefined}
        className={cn(
          "glisse-piste",
          taille === "sm" ? "glisse-piste--sm" : "glisse-piste--md",
          unSens && "glisse-piste--seul",
          unSens && tonSeul === "braise" && "glisse-piste--braise",
          hauteur,
          phase.t === "pose" && "scelle-efface"
        )}
        onPointerDown={poser}
        onPointerMove={bouger}
        onPointerUp={lever}
        onPointerCancel={lever}
        onLostPointerCapture={(e) => {
          // Au toucher, le navigateur capture d'office le doigt sur la cible
          // touchée ; la piste le reprend au début du glissé, et la cible le
          // perd : ce n'est pas la fin du geste.
          if (e.target === e.currentTarget) lever(e);
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={touche}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null) && !fini.current && !geste.current) viser(null);
        }}
      >
        {mesures && <GrilleGlisse mesures={mesures} />}
        {cotes.map((c) => (
          <span key={`l-${c.r}`} aria-hidden className={cn("glisse-libelle", `glisse-libelle--${c.cote}`)}>
            {c.libelle}
          </span>
        ))}
        {cotes.map((c) => (
          <button
            key={c.r}
            ref={(b) => {
              cibles.current[c.r] = b;
            }}
            type="button"
            disabled={!ouvert || phase.t === "pose"}
            data-scelle={c.r}
            className={cn("glisse-cible", `glisse-cible--${c.cote}`)}
            onClick={(e) => {
              // Clavier, VoiceOver : un clic sans pointeur, déjà délibéré.
              if (e.detail !== 0 || !libre || fini.current) return;
              fini.current = true;
              mesurer();
              placer(c.r === "present" || unSens ? 1 : -1);
              void sceller(c.r);
            }}
          >
            {c.libelle}
          </button>
        ))}
        <span aria-hidden className="glisse-bouton">
          {unSens ? (
            <ChevronRight className="size-[18px]" strokeWidth={2.4} />
          ) : (
            <ChevronsLeftRight className="size-[17px]" strokeWidth={2.2} />
          )}
        </span>
      </div>
      {phase.t === "pose" && (
        <Pilule
          r={phase.r}
          libelle={sceau(phase.r)}
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
      {grille && <GrilleDissout cols={grille.cols} rows={grille.rows} />}
      <Lock className="scelle-cadenas relative size-[14px] shrink-0" strokeWidth={2.4} aria-hidden />
      <span className="relative">{libelle}</span>
    </div>
  );
}

/**
 * La grille du glissé : chaque pixel a son seuil (--s, la distance au point
 * de départ du bouton, tramée par Bayer) et son sens (--sens : 1 à droite,
 * -1 à gauche) ; il s'allume quand le bouton le dépasse (scelle.css). À
 * droite (ou sur une piste à un sens), le ton du geste ; à gauche, l'argent.
 * Exportée pour le diaporama des nouveautés, qui rejoue le geste.
 */
export function GrilleGlisse({ mesures }: { mesures: MesuresPiste }) {
  const { largeur, hauteur, seul } = mesures;
  const cols = Math.max(8, Math.round(largeur / PAS));
  const rows = Math.max(3, Math.round(hauteur / PAS));
  const k = hauteur - 2 * MARGE;
  const c = course(mesures);
  const origine = seul ? MARGE + k / 2 : largeur / 2;
  const pixels = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const b = BAYER[y % 4][x % 4] / 16;
      const px = ((x + 0.5) * largeur) / cols;
      const sens = seul || px >= origine ? 1 : -1;
      // Le pixel s'allume quand le bord avant du bouton l'atteint, à la trame près.
      const s = Math.max(0.04, Math.abs(px - origine) / (c + k / 2) + (b - 0.5) * 0.2);
      pixels.push(
        <i
          key={y * cols + x}
          className={sens > 0 ? "d" : undefined}
          style={{ "--s": Math.round(s * 1000) / 1000, "--sens": sens } as CSSProperties}
        />
      );
    }
  }
  return (
    <span
      aria-hidden
      className="glisse-grille"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {pixels}
    </span>
  );
}

/** À la pose : la grille pleine qui s'éteint dans l'ordre de Bayer et laisse la trame. */
function GrilleDissout({ cols, rows }: { cols: number; rows: number }) {
  const pixels = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const b = BAYER[y % 4][x % 4] / 16;
      pixels.push(<i key={y * cols + x} style={{ "--d": `${Math.round(b * 260)}ms` } as CSSProperties} />);
    }
  }
  return (
    <span
      aria-hidden
      className="scelle-grille scelle-grille--dissout"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {pixels}
    </span>
  );
}
