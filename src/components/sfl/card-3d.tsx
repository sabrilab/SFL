"use client";

// Carte manipulable en 3D : on capture n'importe quel rendu CardShell
// (PlayerCard ou BoostCard, via la prop `render`) en trois calques
// transparents alignés (fond doré, joueur, statistiques) puis on les
// empile sur des plans Three.js à des profondeurs différentes — en
// tournant la carte, les calques se découvrent avec une vraie parallaxe,
// façon carte à collectionner Pokémon plutôt qu'un simple aplat texturé.
//
// Montage paresseux (IntersectionObserver) : la capture + le canvas
// WebGL ne démarrent que quand la carte entre dans le viewport, et le
// montage reste acquis ensuite — utile dès qu'on affiche ce composant en
// nombre (accueil, classements) sans épuiser les contextes WebGL.
//
// Vitesse d'ouverture : les polices de la carte sont mises en ligne une
// seule fois par session (policesEnLigne), et la photo vient du cache du
// navigateur — son URL est déjà versionnée (lib/sfl/photos), aucun besoin
// de « cacheBust », qui re-téléchargeait polices et photo à chaque calque.
// prechaufferCarte() lance tout ça dès qu'on pose le doigt sur une carte.
//
// Le dos (23/10, Sabri : « à l'arrière, on met Bola », de la même couleur
// que l'avant) : la face dit sa matière et son joueur (data-matiere,
// data-nom ; data-emission pour une carte d'époque, sa date et son numéro
// au dos aussi) ; on monte à côté d'elle, hors écran, le dos de la carte
// (DosCarte), qu'on photographie aussi — la 3D le colle derrière, et prend
// la tranche et le reflet de la même matière. La lumière qui passe sur la
// finition animée (data-card-part="lumiere") n'est pas photographiée : la 3D
// la fait passer elle-même.

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { toPng } from "html-to-image";
import { ChargementBola } from "@/components/sfl/chargement-bola";
import { DosCarte } from "@/components/sfl/dos-carte";
import { matiereDuNom, type HabillageCarte, type Matiere } from "@/components/sfl/finitions-carte";
import type { EmissionCarte } from "@/lib/sfl/epoques";
import { useBadgeRevision } from "@/hooks/use-badge-carte";
import { useHabillageRevision } from "@/hooks/use-habillage";
import { useIdentitesRevision } from "@/hooks/use-identites";
import { usePhotoRevision } from "@/hooks/use-player-photo";
import { IMAGE_EVENT } from "@/lib/sfl/badges-3d/rendu";

const chargerCanvas = () => import("./card-3d-canvas");

const CardCanvas = dynamic(() => chargerCanvas().then((m) => m.CardCanvas), {
  ssr: false,
});

/** Les familles de polices d'un nœud et de ses enfants (style calculé). */
function familles(node: HTMLElement): Set<string> {
  const set = new Set<string>();
  const parcourir = (el: Element) => {
    getComputedStyle(el)
      .fontFamily.split(",")
      .forEach((f) => set.add(f.trim().replace(/["']/g, "")));
    for (const enfant of el.children) parcourir(enfant);
  };
  parcourir(node);
  return set;
}

/** Vrai si un `unicode-range` (« U+0-FF, U+131, U+4?? ») couvre l'un des caractères. */
function couvre(plages: string, caracteres: Set<number>): boolean {
  if (!plages) return true;
  return plages.split(",").some((p) => {
    const [a, b] = p.trim().replace(/^U\+/i, "").split("-");
    const debut = parseInt(a.replace(/\?/g, "0"), 16);
    const fin = parseInt((b ?? a).replace(/\?/g, "F"), 16);
    for (const c of caracteres) if (c >= debut && c <= fin) return true;
    return false;
  });
}

const fichiersPolice = new Map<string, Promise<string>>();

function enDataUrl(url: string): Promise<string> {
  let p = fichiersPolice.get(url);
  if (!p) {
    p = fetch(url)
      .then((r) => r.blob())
      .then(
        (blob) =>
          new Promise<string>((ok, ko) => {
            const lecteur = new FileReader();
            lecteur.onload = () => ok(lecteur.result as string);
            lecteur.onerror = ko;
            lecteur.readAsDataURL(blob);
          })
      );
    p.catch(() => fichiersPolice.delete(url));
    fichiersPolice.set(url, p);
  }
  return p;
}

const policesParJeu = new Map<string, Promise<string | undefined>>();

/**
 * Le CSS des polices d'une carte, fichiers inclus en data URL, à donner à
 * html-to-image (fontEmbedCSS). Seuls les @font-face des familles de la
 * carte ET des alphabets de son texte sont gardés : Next découpe chaque
 * police en sous-ensembles (latin, cyrillique, grec, vietnamien…) et
 * html-to-image les embarquait tous — près de 30 fichiers, ~600 Ko,
 * relus pour chaque calque. Ici, quatre fichiers, préparés une fois par
 * session.
 */
function policesEnLigne(node: HTMLElement): Promise<string | undefined> {
  const fams = familles(node);
  const caracteres = new Set<number>();
  for (const c of node.textContent ?? "") caracteres.add(c.codePointAt(0)!);
  const regles: { css: string; url: string; src: string }[] = [];
  for (const feuille of Array.from(document.styleSheets)) {
    let liste: CSSRuleList;
    try {
      liste = feuille.cssRules;
    } catch {
      continue;
    }
    for (const r of Array.from(liste)) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      if (!fams.has(r.style.getPropertyValue("font-family").trim().replace(/["']/g, ""))) continue;
      if (!couvre(r.style.getPropertyValue("unicode-range"), caracteres)) continue;
      const src = r.style.getPropertyValue("src");
      const m = /url\(["']?([^"')]+)["']?\)/.exec(src);
      if (!m) continue;
      regles.push({ css: r.cssText, src: m[0], url: new URL(m[1], feuille.href ?? document.baseURI).href });
    }
  }
  const cle = regles.map((r) => r.css).join("\n");
  let css = policesParJeu.get(cle);
  if (!css) {
    css = Promise.all(regles.map(async (r) => r.css.replace(r.src, `url("${await enDataUrl(r.url)}")`)))
      .then((l) => l.join("\n"))
      // Échec : html-to-image cherchera les polices lui-même, comme avant.
      .catch(() => {
        policesParJeu.delete(cle);
        return undefined;
      });
    policesParJeu.set(cle, css);
  }
  return css;
}

/**
 * À appeler dès qu'on touche une carte qui va s'ouvrir en grand : le code
 * 3D se charge et les polices se préparent pendant que la pop-up s'ouvre.
 * `node` = la carte touchée (mêmes polices que la grande).
 */
export function prechaufferCarte(node?: HTMLElement | null) {
  void chargerCanvas();
  if (node) void document.fonts.ready.then(() => policesEnLigne(node));
}

/**
 * WebKit : Safari, et tout navigateur d'iPhone (Chrome, Firefox… y tournent
 * sur WebKit). Il peint les images d'une capture html-to-image (photo,
 * symbole, badge) après coup : la première capture d'un calque sort sans
 * elles, les suivantes les ont. C'est ce qui rendait la photo absente de la
 * 3D sur iPhone alors que la carte plate l'affichait.
 */
const WEBKIT =
  typeof navigator !== "undefined" &&
  /AppleWebKit/.test(navigator.userAgent) &&
  !/Chrome|Chromium|Android/.test(navigator.userAgent);

/**
 * La part du canvas qu'occupe la carte 3D posée (FILL_RATIO de card-3d-canvas,
 * recopié pour ne pas charger three ici). L'accueil s'en sert pour poser la
 * 3D pile sur une carte plate (accueil/etape-carte.tsx).
 */
export const REMPLISSAGE_3D = 0.72;

const TRANSPARENT_PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

export interface CapturedLayers {
  background: string;
  playerLayer: string;
  stats: string;
  /** Le dos (DosCarte), s'il a pu être photographié. */
  dos?: string;
  matiere: Matiere | null;
  width: number;
  height: number;
}

interface Dos {
  matiere: Matiere;
  nom: string;
  habillage?: HabillageCarte;
  /** Une carte d'époque : sa date d'émission et son numéro. */
  emission?: EmissionCarte;
}

/** Un attribut JSON de la face, ou undefined s'il manque ou ne se lit pas. */
function lireJson<T>(texte: string | undefined): T | undefined {
  try {
    return texte ? (JSON.parse(texte) as T) : undefined;
  } catch {
    return undefined;
  }
}

/** La matière, le joueur, l'habillage et l'émission que la face déclare (bola-card.tsx), pour son dos. */
function dosDe(node: HTMLElement): Dos | null {
  const corps = node.querySelector<HTMLElement>("[data-matiere]");
  if (!corps?.dataset.matiere) return null;
  const habillage = lireJson<HabillageCarte>(corps.dataset.habillage);
  // « Tes couleurs » : la matière du pays que porte l'habillage.
  const matiere = matiereDuNom(corps.dataset.matiere, habillage);
  return matiere
    ? { matiere, nom: corps.dataset.nom ?? "", habillage, emission: lireJson<EmissionCarte>(corps.dataset.emission) }
    : null;
}

/** Attend qu'un nœud soit monté, quelques images au plus. */
function attendreNoeud<T>(lire: () => T | null, images = 30): Promise<T | null> {
  return new Promise((fin) => {
    const essayer = (reste: number) => {
      const n = lire();
      if (n || reste <= 0) fin(n);
      else requestAnimationFrame(() => essayer(reste - 1));
    };
    essayer(images);
  });
}

// Capture le nœud une fois par calque : soit en excluant certaines parties
// (fond = tout sauf joueur/stats), soit en isolant une seule partie (son
// arborescence d'ancêtres reste incluse pour garder le même cadrage, mais
// leur fond est rendu transparent le temps de la capture).
async function captureLayer(
  node: HTMLElement,
  opts: { isolatePart?: "player" | "stats"; excludeParts?: string[] },
  fontEmbedCSS: string | undefined,
  pixelRatio = 3
): Promise<string> {
  const transparentEls: HTMLElement[] = [];
  let isolateEl: HTMLElement | null = null;

  if (opts.isolatePart) {
    isolateEl = node.querySelector(`[data-card-part="${opts.isolatePart}"]`);
    const frame = node.querySelector<HTMLElement>('[data-card-part="frame"]');
    const body = node.querySelector<HTMLElement>('[data-card-part="body"]');
    if (frame) transparentEls.push(frame);
    if (body) transparentEls.push(body);
  }

  const restores = transparentEls.map((el) => [el, el.style.background, el.style.boxShadow] as const);
  transparentEls.forEach((el) => {
    el.style.background = "transparent";
    el.style.boxShadow = "none";
  });

  try {
    return await toPng(node, {
      pixelRatio,
      fontEmbedCSS,
      // La photo change d'URL (?v=…) quand le joueur la change : sans ça,
      // le cache interne de html-to-image garderait l'ancienne.
      includeQueryParams: true,
      imagePlaceholder: TRANSPARENT_PX,
      filter: (n) => {
        if (isolateEl) {
          if (n === isolateEl) return true;
          if (n.contains(isolateEl) || isolateEl.contains(n)) return true;
          return false;
        }
        if (opts.excludeParts && n instanceof HTMLElement) {
          const part = n.dataset.cardPart;
          if (part && opts.excludeParts.includes(part)) return false;
        }
        return true;
      },
    });
  } finally {
    restores.forEach(([el, bg, shadow]) => {
      el.style.background = bg;
      el.style.boxShadow = shadow;
    });
  }
}

/**
 * Attend que les badges 3D de la carte aient leur image (badge-3d.tsx
 * marque l'emblème d'attente) : capturer avant, c'était capturer deux fois.
 * Vrai si tout est prêt, faux si le délai passe avant.
 */
function attendreBadges(node: HTMLElement, delai: number): Promise<boolean> {
  const pret = () => !node.querySelector("[data-attente-3d]");
  if (pret()) return Promise.resolve(true);
  return new Promise((fin) => {
    const verifier = () => requestAnimationFrame(() => pret() && finir(true));
    const minuterie = Number.isFinite(delai) ? setTimeout(() => finir(false), delai) : undefined;
    function finir(ok: boolean) {
      window.removeEventListener(IMAGE_EVENT, verifier);
      clearTimeout(minuterie);
      fin(ok);
    }
    window.addEventListener(IMAGE_EVENT, verifier);
  });
}

function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setInView(true);
      },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, inView]);
  return inView;
}

// `cacheKey` devient la React `key` du composant interne : quand elle
// change (nouveau joueur, nouveau highlight), React démonte et remonte
// entièrement l'instance plutôt que de réutiliser l'état — l'ancien
// rendu 3D ne peut donc jamais s'afficher périmé pendant la recapture,
// sans avoir besoin d'un setState synchrone dans l'effet.
export function Card3D(props: {
  size?: number;
  mode?: "simple" | "rare";
  cacheKey: string;
  render: (size: number) => ReactNode;
  startFace?: "front" | "back";
  interactive?: boolean;
  /**
   * true = la carte plate s'affiche tout de suite, photo comprise, à la place
   * du squelette ; la 3D la remplace, déjà posée, dès qu'elle est prête.
   * Pour la pop-up d'une carte qu'on vient de toucher.
   */
  apercu?: boolean;
  /** La définition des calques photographiés, en largeurs de carte de taille 1 (254 px) : 3, davantage pour une carte vue en grand. */
  definition?: number;
  /**
   * La scène qui montre les calques à la place du canvas d'ici : la carte en
   * plein écran (carte-en-grand.tsx). Le cadre remplit alors son parent, sans
   * squelette ni carte plate (la scène a la sienne).
   */
  scene?: (calques: CapturedLayers) => ReactNode;
}) {
  // Une photo posée ou changée (chez soi ou par un autre joueur) : la capture
  // repart, sinon la 3D garderait l'ancienne image. Même chose pour le badge
  // choisi pour la carte. Son image 3D, elle, est attendue par la capture
  // (attendreBadges) : la moindre image prête ailleurs ne relance plus tout.
  const revision = usePhotoRevision();
  const badges = useBadgeRevision();
  // Un nom ou un pseudo corrigé : la carte le porte, la capture repart.
  const identites = useIdentitesRevision();
  // Une finition choisie, un palier, un cran ou un rang gagné (use-habillage.ts).
  const habillages = useHabillageRevision();
  return <Card3DInner key={`${props.cacheKey}~${revision}~${badges}~${identites}~${habillages}`} {...props} />;
}

function Card3DInner({
  size = 1,
  mode = "simple",
  render,
  startFace = "front",
  interactive = true,
  apercu = false,
  definition = 3,
  scene,
}: {
  size?: number;
  /** Contrôle la couleur du bezel et l'intensité de l'effet holo. */
  mode?: "simple" | "rare";
  /** Rend le contenu CardShell (PlayerCard/BoostCard) à la taille donnée. */
  render: (size: number) => ReactNode;
  /** "back" démarre déjà retournée (le dos Bola) — pour les packs scellés. */
  startFace?: "front" | "back";
  /** false = décorative, ne répond pas au glissement (fans de pack). */
  interactive?: boolean;
  apercu?: boolean;
  definition?: number;
  scene?: (calques: CapturedLayers) => ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<HTMLDivElement>(null);
  const [captured, setCaptured] = useState<CapturedLayers | null>(null);
  /** Monte quand un badge 3D arrive après la capture : on recapture, sans repasser par le squelette. */
  const [essai, setEssai] = useState(0);
  const inView = useInView(wrapperRef);
  /** Taille de la carte source, lue dès son montage (l'aperçu en a besoin avant la capture). */
  const [source, setSource] = useState<{ width: number; height: number } | null>(null);
  /** La 3D a dessiné sa première image : l'aperçu plat peut s'effacer. */
  const [affichee, setAffichee] = useState(false);
  /** Le dos à monter hors écran pour le photographier, lu sur la face. */
  const [dos, setDos] = useState<Dos | null>(null);
  const dosRef = useRef<HTMLDivElement>(null);
  // En grand (scene), la face est photographiée à la taille de sa définition, en
  // pixels CSS, plutôt qu'à la taille 1 grossie : html-to-image ramène chaque
  // police à l'entier inférieur moins 0,1 (cloneCSSStyle). À la taille 1, le
  // microtexte (5,95 px) y perdait 18 %, la ligne de série 14 % : en plein écran,
  // les petits textes rétrécissaient quand la 3D remplaçait la carte plate.
  const echelle = scene ? definition : 1;

  useLayoutEffect(() => {
    const node = captureRef.current;
    if (!inView || !node) return;
    setDos(dosDe(node));
  }, [inView]);

  useLayoutEffect(() => {
    const node = captureRef.current;
    if (!apercu || !inView || !node) return;
    setSource({ width: node.offsetWidth, height: node.offsetHeight });
  }, [apercu, inView]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    async function run() {
      const node = captureRef.current;
      if (!node) return;
      try {
        await document.fonts.ready;
        // offsetWidth/offsetHeight (boîte de mise en page) plutôt que
        // getBoundingClientRect() : un ancêtre animé (ex. l'entrée d'une
        // carte de pack, rotateY + scale) déforme temporairement le
        // rectangle écran renvoyé par getBoundingClientRect(), ce qui
        // donnait une carte 3D étirée/écrasée à la capture.
        const width = node.offsetWidth;
        const height = node.offsetHeight;
        // Séquentiel : chaque capture bascule temporairement le fond de
        // certains nœuds partagés, donc deux captures concurrentes sur le
        // même arbre se marcheraient dessus.
        const prets = await attendreBadges(node, 600);
        if (cancelled) return;
        const polices = await policesEnLigne(node);
        const background = await captureLayer(node, { excludeParts: ["player", "stats", "lumiere"] }, polices, definition / echelle);
        if (cancelled) return;
        // Sur WebKit, une capture à blanc du calque joueur d'abord : elle
        // lui fait décoder la photo, que la vraie capture trouve prête.
        // (Avant, la carte se capturait deux fois par accident, ce qui le
        // masquait.)
        if (WEBKIT && node.querySelector('[data-card-part="player"] img')) {
          await captureLayer(node, { isolatePart: "player" }, polices, definition / echelle);
          if (cancelled) return;
        }
        const playerLayer = await captureLayer(node, { isolatePart: "player" }, polices, definition / echelle);
        if (cancelled) return;
        // Même chose pour le sigle SFL de la ligne de série (un masque CSS).
        if (WEBKIT && node.querySelector('[data-card-part="stats"] [role="img"]')) {
          await captureLayer(node, { isolatePart: "stats" }, polices, definition / echelle);
          if (cancelled) return;
        }
        const stats = await captureLayer(node, { isolatePart: "stats" }, polices, definition / echelle);
        if (cancelled) return;
        // Le dos, monté à côté de la face dès qu'elle a dit sa matière.
        let dosUrl: string | undefined;
        const dosNode = dosDe(node) ? await attendreNoeud(() => dosRef.current) : null;
        if (cancelled) return;
        if (dosNode) {
          try {
            dosUrl = await captureLayer(dosNode, { excludeParts: ["lumiere"] }, await policesEnLigne(dosNode), definition);
          } catch {
            // le dos de repli (uni, à la couleur de la carte) le remplacera
          }
          if (cancelled) return;
        }
        setCaptured({ background, playerLayer, stats, dos: dosUrl, matiere: dosDe(node)?.matiere ?? null, width, height });
        if (!prets) void attendreBadges(node, Infinity).then(() => !cancelled && setEssai((n) => n + 1));
      } catch {
        // rasterisation indisponible — la carte plate ci-dessous reste
        // affichée en repli
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [inView, essai, definition, echelle]);

  // Dimensions estimées avant capture (base CardShell ~260×376 avec
  // bannière) pour que le chargement occupe déjà la bonne place — la taille
  // exacte prend le relais dès que la capture aboutit.
  const dims = captured ?? source;
  const width = (dims ? dims.width : 260) * size;
  const height = (dims ? dims.height : 376) * size;

  return (
    <div ref={wrapperRef} style={scene ? { position: "absolute", inset: 0 } : { position: "relative", width, height }}>
      {/* Source de capture — hors-écran (clip par un parent de taille nulle,
          jamais opacity:0 sur le nœud capturé lui-même, sinon l'image
          rasterisée hérite de cette opacité et ressort vide). */}
      {inView && (
        <div style={{ position: "absolute", top: 0, left: 0, width: 0, height: 0, overflow: "hidden" }}>
          <div ref={captureRef} style={{ position: "absolute" }} aria-hidden>
            {render(echelle)}
          </div>
          {dos && (
            <div ref={dosRef} style={{ position: "absolute" }} aria-hidden>
              <DosCarte matiere={dos.matiere} nom={dos.nom} habillage={dos.habillage} emission={dos.emission} />
            </div>
          )}
        </div>
      )}

      {apercu && source && (
        // La carte plate, à la taille exacte de la 3D posée, par-dessus le
        // canvas jusqu'à sa première image, puis fondue.
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: source.width,
            height: source.height,
            transform: `translate(-50%, -50%) scale(${size * REMPLISSAGE_3D})`,
            opacity: affichee ? 0 : 1,
            transition: "opacity 220ms ease-out",
            pointerEvents: "none",
            zIndex: 1,
          }}
        >
          {render(1)}
        </div>
      )}

      {captured && scene ? (
        scene(captured)
      ) : captured ? (
        <CardCanvas
          background={captured.background}
          playerLayer={captured.playerLayer}
          stats={captured.stats}
          dos={captured.dos}
          matiere={captured.matiere}
          holo={mode === "rare"}
          mode={mode}
          startFace={startFace}
          interactive={interactive}
          posee={apercu}
          onAffichee={() => setAffichee(true)}
        />
      ) : apercu || scene ? null : (
        // Pendant la capture : jamais de carte 2D "flash" avant le rendu 3D,
        // la lune Bola qui se charge, à la place de la carte (24/10 : plus le
        // rectangle brun qui pulsait).
        <div style={{ width, height: height * 0.88, display: "grid", placeItems: "center" }}>
          <ChargementBola taille={Math.round(52 * size)} />
        </div>
      )}
    </div>
  );
}
