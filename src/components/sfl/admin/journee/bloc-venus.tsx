"use client";

// Sous les terrains : ceux qui ont répondu « Je viens » et qui ne sont pas
// encore dans un camp (Sabri, 20/11/2026 : « tu me mets les gens qui ont
// répondu "je viens" en dessous des terrains […] que je puisse prendre,
// rester appuyé sur l'image du gars et venir le placer sur le terrain. Comme
// ça, ça m'évite de chercher ou de réouvrir une autre fenêtre »).
//
// Une rangée par match : chacun est rangé sous le match où la proposition le
// mettrait, le rond de son camp devant son prénom, les meilleurs niveaux
// d'abord (saisie/venus-sur-la-feuille.ts, venusAPlacer). Le titre d'une
// rangée, « Match 2 · 4 », montre ce terrain. Puis les remplaçants : qui n'a
// pas de place proposée, et les lignes d'un autre statut (absent, blessé).
//
// Le geste : un appui long sur une carte (à la souris, il suffit de tirer) la
// décroche ; elle suit le doigt, le terrain montre ses deux moitiés, les
// Noirs au fond et les Blancs devant, et la lâcher sur l'une l'y pose. Lâchée
// ailleurs, elle revient. Un toucher simple garde son sens d'avant : ouvrir
// la fiche de la ligne.
//
// L'appui long ne doit ni faire défiler la page, ni ouvrir le menu de l'image
// d'iOS : le touchmove est refusé tant qu'une carte est décrochée (écouteur
// non passif posé d'avance, Safari l'exige), le menu contextuel aussi. Près
// du haut ou du bas de l'écran, la page défile sous la carte tenue.

import { useEffect, useRef, useState, type PointerEvent as PointerEventReact, type RefObject } from "react";
import { createPortal } from "react-dom";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PointMaillot } from "@/components/sfl/point-maillot";
import { haptique } from "@/lib/sfl/haptique";
import type { Camp } from "@/lib/sfl/saisie/equipes";
import type { MatchEntry } from "@/lib/sfl/saisie/types";
import type { VenuAPlacer } from "@/lib/sfl/saisie/venus-sur-la-feuille";
import { cn } from "@/lib/utils";
import { Etiquette } from "./ui";

/** L'appui long, au doigt. */
const APPUI_MS = 240;
/** Au-delà, avant l'appui long : c'est un défilement, pas une prise. */
const JEU_PX = 9;
/** Les bandes, en haut et en bas de l'écran (au-dessus du geste du moment), où la page défile sous la carte tenue. */
const BORD_HAUT_PX = 110;
const BORD_BAS_PX = 230;

const prenom = (nom: string) => nom.split(" ")[0];

/** Le camp sous le doigt : la moitié du fond aux Noirs, celle de devant aux Blancs ; null hors du terrain. */
function campDansLaZone(zone: RefObject<HTMLElement | null>, x: number, y: number): Camp | null {
  const r = zone.current?.getBoundingClientRect();
  if (!r || x < r.left || x > r.right || y < r.top || y > r.bottom) return null;
  return y < r.top + r.height / 2 ? "Noirs" : "Blancs";
}

interface Prise {
  v: VenuAPlacer;
  x: number;
  y: number;
}

export function BlocVenus({
  matchs,
  remplacants,
  autres,
  courant,
  onCourant,
  zone,
  onSurvol,
  onPoser,
  onToucher,
  onLigne,
}: {
  /** Les rangées par match, dans l'ordre des terrains. */
  matchs: { n: number; joueurs: VenuAPlacer[] }[];
  remplacants: VenuAPlacer[];
  /** Les lignes d'un autre statut (absent justifié, blessé…) : elles ne se glissent pas. */
  autres: { e: MatchEntry; i: number }[];
  courant: number;
  onCourant: (n: number) => void;
  /** Le terrain affiché : y lâcher une carte la pose, au fond chez les Noirs, devant chez les Blancs. */
  zone: RefObject<HTMLDivElement | null>;
  /** Une carte est tenue : au-dessus de quel camp (null : hors du terrain) ; undefined quand elle est lâchée. */
  onSurvol: (camp: Camp | null | undefined) => void;
  onPoser: (v: VenuAPlacer, camp: Camp) => void;
  onToucher: (v: VenuAPlacer) => void;
  onLigne: (i: number) => void;
}) {
  const [prise, setPrise] = useState<Prise | null>(null);
  const tenue = useRef<Prise | null>(null);
  const attente = useRef<{ v: VenuAPlacer; x: number; y: number; id: number; minuteur: ReturnType<typeof setTimeout> | null } | null>(null);
  const vientDeGlisser = useRef(false);
  const dernier = useRef<Camp | null | undefined>(undefined);
  const racine = useRef<HTMLElement>(null);
  const defile = useRef<number | null>(null);
  const doigt = useRef({ x: 0, y: 0 });

  // Les gestes de la page, lus au moment du geste : les écouteurs ne se reposent
  // pas quand la page se redessine sous une carte tenue (elle la lâcherait).
  const page = useRef({ onSurvol, onPoser, zone });
  useEffect(() => {
    page.current = { onSurvol, onPoser, zone };
  });
  const prendre = useRef<(v: VenuAPlacer, x: number, y: number) => void>(() => {});

  // Le doigt, où qu'il aille : suivi sur le document tant qu'une carte est touchée.
  useEffect(() => {
    const campSous = (x: number, y: number) => campDansLaZone(page.current.zone, x, y);
    const survoler = (camp: Camp | null | undefined) => {
      if (dernier.current === camp) return;
      if (camp && dernier.current !== undefined) haptique.choix();
      dernier.current = camp;
      page.current.onSurvol(camp);
    };
    const lacher = (poser: boolean) => {
      const a = attente.current;
      if (a?.minuteur) clearTimeout(a.minuteur);
      attente.current = null;
      if (defile.current != null) cancelAnimationFrame(defile.current);
      defile.current = null;
      const t = tenue.current;
      tenue.current = null;
      if (!t) return;
      setPrise(null);
      survoler(undefined);
      vientDeGlisser.current = true;
      setTimeout(() => (vientDeGlisser.current = false), 350);
      const camp = poser ? campSous(doigt.current.x, doigt.current.y) : null;
      if (camp) page.current.onPoser(t.v, camp);
    };
    prendre.current = (v, x, y) => {
      tenue.current = { v, x, y };
      doigt.current = { x, y };
      setPrise({ v, x, y });
      haptique.ajout();
      survoler(campSous(x, y));
      // La page défile sous la carte tenue près des bords.
      const pas = () => {
        if (!tenue.current) return;
        const boite = document.getElementById("app-scroll");
        const { x: dx, y: dy } = doigt.current;
        const sens = dy < BORD_HAUT_PX ? -1 : dy > window.innerHeight - BORD_BAS_PX ? 1 : 0;
        if (sens && boite) {
          boite.scrollBy(0, sens * 10);
          survoler(campSous(dx, dy));
        }
        defile.current = requestAnimationFrame(pas);
      };
      defile.current = requestAnimationFrame(pas);
    };
    const bouge = (e: PointerEvent) => {
      const a = attente.current;
      if (tenue.current) {
        doigt.current = { x: e.clientX, y: e.clientY };
        setPrise({ v: tenue.current.v, x: e.clientX, y: e.clientY });
        survoler(campSous(e.clientX, e.clientY));
        return;
      }
      if (!a || e.pointerId !== a.id) return;
      if (Math.hypot(e.clientX - a.x, e.clientY - a.y) <= JEU_PX) return;
      // À la souris, tirer suffit ; au doigt, c'est un défilement.
      if (e.pointerType === "mouse") prendre.current(a.v, e.clientX, e.clientY);
      else lacher(false);
    };
    const leve = () => lacher(true);
    const annule = () => lacher(false);
    const menu = (e: Event) => {
      if (tenue.current || attente.current) e.preventDefault();
    };
    // Une carte tenue ne fait pas défiler : écouteur non passif, posé avant le toucher (Safari l'exige).
    const retenir = (e: TouchEvent) => {
      if (tenue.current && e.cancelable) e.preventDefault();
    };
    const el = racine.current;
    document.addEventListener("pointermove", bouge);
    document.addEventListener("pointerup", leve);
    document.addEventListener("pointercancel", annule);
    document.addEventListener("contextmenu", menu);
    el?.addEventListener("touchmove", retenir, { passive: false });
    return () => {
      lacher(false);
      document.removeEventListener("pointermove", bouge);
      document.removeEventListener("pointerup", leve);
      document.removeEventListener("pointercancel", annule);
      document.removeEventListener("contextmenu", menu);
      el?.removeEventListener("touchmove", retenir);
    };
  }, []);

  function appuyer(e: PointerEventReact, v: VenuAPlacer) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const { clientX: x, clientY: y, pointerId: id } = e;
    if (attente.current?.minuteur) clearTimeout(attente.current.minuteur);
    attente.current = {
      v,
      x,
      y,
      id,
      minuteur: e.pointerType === "mouse" ? null : setTimeout(() => attente.current && prendre.current(v, attente.current.x, attente.current.y), APPUI_MS),
    };
  }

  const carte = (v: VenuAPlacer) => (
    <button
      key={`${v.ligne ?? "v"}-${v.nom}`}
      type="button"
      draggable={false}
      onPointerDown={(e) => appuyer(e, v)}
      onClick={() => {
        if (vientDeGlisser.current) return;
        onToucher(v);
      }}
      aria-label={[v.nom, v.camp, v.match != null ? `Match ${v.match}` : null].filter(Boolean).join(", ")}
      className={cn(
        "flex shrink-0 flex-col items-center gap-1 select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none",
        prise?.v.nom === v.nom && "opacity-25"
      )}
    >
      <span className={cn("rounded-[13px] p-[2px]", v.ligne == null && "border-[1.5px] border-dashed border-foreground/40")}>
        <CarteDe name={v.nom} size={FORMAT_CARTE.petite} inerte />
      </span>
      <span className="mono-label flex max-w-[72px] items-center gap-1 text-micro text-encre-2">
        {v.camp && <PointMaillot camp={v.camp} className="size-2" />}
        <span className="truncate">{prenom(v.nom)}</span>
      </span>
    </button>
  );

  const rangee = "-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
  const aPlacer = matchs.reduce((n, m) => n + m.joueurs.length, 0);

  return (
    <section ref={racine} className="flex flex-col gap-3">
      {aPlacer > 0 && <Etiquette>Je viens · {aPlacer}</Etiquette>}
      {matchs.map((m) => (
        <div key={m.n} className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              haptique.choix();
              onCourant(m.n);
            }}
            aria-pressed={courant === m.n}
            className={cn("mono-label self-start rounded-full px-2.5 py-1", courant === m.n ? "bg-foreground text-background" : "bg-secondary text-encre-2")}
          >
            Match {m.n} · {m.joueurs.length}
          </button>
          <div className={rangee}>{m.joueurs.map(carte)}</div>
        </div>
      ))}
      {(remplacants.length > 0 || autres.length > 0) && (
        <div className="flex flex-col gap-2">
          <Etiquette>Remplaçants · {remplacants.length + autres.length}</Etiquette>
          <div className={rangee}>
            {remplacants.map(carte)}
            {autres.map(({ e, i }) => (
              <button key={`l${i}`} type="button" onClick={() => onLigne(i)} className="flex shrink-0 flex-col items-center gap-1 opacity-70">
                <span className="p-[2px]">
                  <CarteDe name={e.player} size={FORMAT_CARTE.petite} inerte />
                </span>
                <span className="mono-label max-w-[72px] truncate text-micro text-encre-2">{e.statut}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* La carte tenue : elle suit le doigt, au-dessus de tout. */}
      {prise &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed top-0 left-0 z-[200] will-change-transform"
            style={{ transform: `translate(${prise.x}px, ${prise.y}px) translate(-50%, -78%) scale(1.25)` }}
          >
            <span className="flex rounded-[13px] shadow-[0_14px_30px_rgba(0,0,0,0.45)]">
              <CarteDe name={prise.v.nom} size={FORMAT_CARTE.petite} inerte />
            </span>
          </div>,
          document.body
        )}
    </section>
  );
}
