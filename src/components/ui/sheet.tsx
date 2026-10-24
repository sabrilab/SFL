"use client"

// Les feuilles de l'app, et la fenêtre unique (Sabri, 24/10 : « quand on
// clique sur un joueur, il y a une modal qui s'ouvre. Ensuite, si on clique
// sur son profil, on aura encore une modal. Si on veut comparer avec sa
// carte à soi, il y aura encore une modal. C'est par-dessus, par-dessus,
// par-dessus. […] le rangement et la hiérarchisation au sein d'une même
// fenêtre, avec des boutons de retour en arrière. »).
//
// Une feuille ouverte depuis une feuille ne monte plus par-dessus : elle
// prend sa place, dans la même fenêtre, comme un écran poussé dans une
// feuille d'iPhone. En haut à gauche, le retour du design system
// (layout/bouton-retour.tsx) ramène à l'écran d'avant, là où on l'avait
// laissé ; la croix, la poignée tirée vers le bas et un toucher hors de la
// fenêtre la ferment tout entière ; Échap revient d'un écran. Chaque écran
// garde son dessin : tant qu'il est devant, la classe et le style de son
// SheetContent sont ceux de la fenêtre. Ceux de dessous restent montés,
// rangés derrière lui (invisibles, inertes), avec leur état et leur place.
//
// Rien à changer chez les feuilles : une <Sheet> rendue dans une feuille
// ouverte devient un écran de sa fenêtre, et son SheetContent y est posé
// (un portail dans la fenêtre). `aPart` la garde à part, par-dessus : le
// studio photo, qui refuse d'être fermé pendant qu'il travaille. Une carte
// touchée dans une fenêtre y est posée de même (card-viewer.tsx, `poser`).

import * as React from "react"
import { createPortal } from "react-dom"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { BoutonRetour } from "@/components/layout/bouton-retour"
import { XIcon } from "lucide-react"

type Cote = "top" | "right" | "bottom" | "left"
type Cadre = { className?: string; style?: React.CSSProperties }

interface Ecran {
  id: string
  /** Le retour : referme cet écran, comme sa croix le faisait (son onOpenChange(false)). */
  fermer: () => void
  /** Son nom, pour le retour de l'écran posé dessus (« Revenir à son profil »). */
  titre?: string
  /** Son dessin, celui de la fenêtre tant qu'il est devant. */
  cadre?: Cadre
}

/** Les gestes d'une fenêtre ; ils ne changent pas tant qu'elle vit. */
export interface Fenetre {
  /** Ferme toute la fenêtre. */
  fermer: () => void
  /** Pose un écran (une feuille : son SheetContent) devant les autres ; `titre` : son nom, pour le retour de l'écran posé dessus. */
  poser: (ecran: React.ReactNode, titre?: string) => void
  inscrire: (e: Ecran) => void
  maj: (id: string, m: Partial<Ecran>) => void
  retirer: (id: string) => void
  scene: (el: HTMLElement | null) => void
}

interface EtatFenetre {
  /** Les écrans posés sur la racine, dans l'ordre : le dernier est devant. */
  ecrans: Ecran[]
  /** Où ils se posent : dans la feuille, après la racine. */
  scene: HTMLElement | null
  /** Le nom de la racine, pour le retour du premier écran. */
  titre?: string
}

const FenetreContext = React.createContext<Fenetre | null>(null)
const EtatContext = React.createContext<EtatFenetre>({ ecrans: [], scene: null })
/** L'écran où l'on est : son id et son retour (la racine : "" et aucun). */
const EcranContext = React.createContext<{ id: string; retour: (() => void) | null }>({ id: "", retour: null })
const RACINE = { id: "", retour: null }

/** La fenêtre où l'on est ; null hors des feuilles. */
function useFenetre() {
  return React.useContext(FenetreContext)
}

/**
 * Le retour de l'écran où l'on est, pour l'écran qui le place lui-même dans
 * son en-tête (la carte touchée) ; null à la racine d'une fenêtre.
 */
function useRetourDEcran() {
  const { id, retour } = React.useContext(EcranContext)
  const { ecrans, titre } = React.useContext(EtatContext)
  if (!retour) return null
  const i = ecrans.findIndex((e) => e.id === id)
  return { retour, titre: i > 0 ? ecrans[i - 1].titre : titre }
}

type SheetProps = SheetPrimitive.Root.Props & {
  /** À part, par-dessus, même ouverte depuis une feuille. */
  aPart?: boolean
  /** Son nom, pour le retour d'un écran ouvert depuis elle (« son profil »). */
  titre?: string
  /** Les gestes de sa fenêtre, pour y poser un écran depuis dehors (la Map). */
  fenetreRef?: React.Ref<Fenetre | null>
}

function Sheet({ aPart, ...props }: SheetProps) {
  const fenetre = useFenetre()
  return fenetre && !aPart ? <EcranDeFenetre fenetre={fenetre} {...props} /> : <FenetreRacine {...props} />
}

/** Les détails d'une fermeture par le retour, pour les onOpenChange qui les liraient. */
function parLeRetour() {
  return {
    reason: "close-press",
    event: new Event("click"),
    trigger: undefined,
    isCanceled: false,
    isPropagationAllowed: false,
    cancel() {},
    allowPropagation() {},
    preventUnmountOnClose() {},
  } as unknown as SheetPrimitive.Root.ChangeEventDetails
}

const pareil = (e: Ecran, m: Partial<Ecran>) =>
  (!("titre" in m) || e.titre === m.titre) &&
  (!("cadre" in m) ||
    (e.cadre?.className === m.cadre?.className &&
      JSON.stringify(e.cadre?.style ?? null) === JSON.stringify(m.cadre?.style ?? null)))

function FenetreRacine({ titre, fenetreRef, open, onOpenChange, onOpenChangeComplete, actionsRef, children, ...props }: Omit<SheetProps, "aPart">) {
  const [ecrans, setEcrans] = React.useState<Ecran[]>([])
  const [poses, setPoses] = React.useState<{ id: number; ecran: React.ReactNode; titre?: string }[]>([])
  const [scene, setScene] = React.useState<HTMLElement | null>(null)
  const interne = React.useRef<SheetPrimitive.Root.Actions | null>(null)
  const gestes = actionsRef ?? interne
  /** Ce qu'un écran a dit de lui avant d'être inscrit (son dessin l'est avant lui). */
  const attentes = React.useRef(new Map<string, Partial<Ecran>>())
  const pile = React.useRef<Ecran[]>([])
  const aFermer = React.useRef<(() => void)[]>([])
  const numero = React.useRef(0)

  React.useLayoutEffect(() => {
    pile.current = ecrans
  }, [ecrans])

  // La fenêtre se ferme : ses écrans se referment avec elle, une fois la
  // feuille redescendue (sinon la racine reparaîtrait pendant qu'elle
  // descend) ; rouverte avant, tout de suite.
  const vider = React.useCallback(() => {
    const f = aFermer.current
    aFermer.current = []
    f.forEach((x) => x())
  }, [])
  React.useLayoutEffect(() => {
    if (!open) aFermer.current = pile.current.map((e) => e.fermer)
    else vider()
  }, [open, vider])

  const changer = (o: boolean, d: SheetPrimitive.Root.ChangeEventDetails) => {
    // Échap revient d'un écran ; à la racine, il ferme.
    const haut = pile.current.at(-1)
    if (!o && haut && d.reason === "escape-key") {
      d.cancel()
      haut.fermer()
      return
    }
    onOpenChange?.(o, d)
  }

  const fini = (o: boolean) => {
    if (!o) {
      vider()
      setPoses([])
    }
    onOpenChangeComplete?.(o)
  }

  const fenetre = React.useMemo<Fenetre>(
    () => ({
      fermer: () => gestes.current?.close(),
      poser: (ecran, titre) => {
        const id = ++numero.current
        setPoses((l) => [...l, { id, ecran, titre }])
      },
      inscrire: (e) => {
        const a = attentes.current.get(e.id)
        setEcrans((l) => [...l.filter((x) => x.id !== e.id), { ...e, ...a }])
      },
      maj: (id, m) => {
        attentes.current.set(id, { ...attentes.current.get(id), ...m })
        setEcrans((l) => {
          const e = l.find((x) => x.id === id)
          return !e || pareil(e, m) ? l : l.map((x) => (x.id === id ? { ...x, ...m } : x))
        })
      },
      retirer: (id) => {
        attentes.current.delete(id)
        setEcrans((l) => l.filter((x) => x.id !== id))
      },
      scene: setScene,
    }),
    [gestes]
  )
  React.useImperativeHandle(fenetreRef, () => fenetre, [fenetre])
  const etat = React.useMemo(() => ({ ecrans, scene, titre }), [ecrans, scene, titre])

  return (
    <FenetreContext.Provider value={fenetre}>
      <EtatContext.Provider value={etat}>
        <EcranContext.Provider value={RACINE}>
          <SheetPrimitive.Root
            data-slot="sheet"
            open={open}
            onOpenChange={changer}
            onOpenChangeComplete={fini}
            actionsRef={gestes}
            {...props}
          >
            {children as React.ReactNode}
            {poses.map((p) => (
              <Sheet key={p.id} open titre={p.titre} onOpenChange={(o) => !o && setPoses((l) => l.filter((x) => x.id !== p.id))}>
                {p.ecran}
              </Sheet>
            ))}
          </SheetPrimitive.Root>
        </EcranContext.Provider>
      </EtatContext.Provider>
    </FenetreContext.Provider>
  )
}

/** Une feuille ouverte dans une fenêtre : un écran de cette fenêtre, sans fenêtre à elle. */
function EcranDeFenetre({ fenetre, titre, fenetreRef, open, onOpenChange, children }: Omit<SheetProps, "aPart"> & { fenetre: Fenetre }) {
  const id = React.useId()
  const changer = React.useRef(onOpenChange)
  const nom = React.useRef(titre)
  const { inscrire, maj, retirer } = fenetre
  React.useLayoutEffect(() => {
    changer.current = onOpenChange
  })
  const retour = React.useCallback(() => changer.current?.(false, parLeRetour()), [])
  React.useImperativeHandle(fenetreRef, () => fenetre, [fenetre])

  React.useLayoutEffect(() => {
    nom.current = titre
    maj(id, { titre })
  }, [maj, id, titre])
  React.useLayoutEffect(() => {
    if (!open) return
    inscrire({ id, fermer: retour, titre: nom.current })
    return () => retirer(id)
  }, [open, id, retour, inscrire, retirer])

  const ecran = React.useMemo(() => ({ id, retour }), [id, retour])
  if (!open) return null
  return <EcranContext.Provider value={ecran}>{children as React.ReactNode}</EcranContext.Provider>
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs",
        className
      )}
      {...props}
    />
  )
}

type ContentProps = SheetPrimitive.Popup.Props & {
  side?: Cote
  showCloseButton?: boolean
  /**
   * Une fenêtre ouverte depuis ce qui n'est pas une feuille (la pile de
   * joueurs de la Map) : un retour, à gauche de la croix, y ramène.
   */
  onRetour?: () => void
}

function SheetContent(props: ContentProps) {
  const fenetre = useFenetre()
  const { id } = React.useContext(EcranContext)
  return fenetre && id ? <ContenuDEcran fenetre={fenetre} id={id} {...props} /> : <ContenuRacine {...props} />
}

const FEUILLE =
  "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm"

/**
 * Un écran rangé derrière celui de devant : posé comme il l'était (sa classe
 * à lui), invisible, inerte, à la hauteur de la fenêtre. Ses enfants gardent
 * leur état, ses listes leur place.
 */
const range = (className?: string) =>
  cn("flex flex-col gap-4", className, "pointer-events-none invisible absolute inset-x-0 top-0 max-h-full overflow-hidden")

/**
 * La rangée du haut : la croix (et la poignée d'une feuille du bas), et le
 * retour quand il y en a un. Sans retour, elle est posée sur le contenu
 * (sticky) ; avec, elle prend sa place au-dessus de lui (`enFlux`), pour que
 * le retour ne recouvre pas son titre.
 */
function Rangee({ side, retour, titre, enFlux }: { side: Cote; retour?: (() => void) | null; titre?: string; enFlux?: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none sticky top-0 z-30 flex h-14 shrink-0 items-center px-3",
        !enFlux && "-mb-[4.5rem]",
        retour ? "justify-between" : "justify-end"
      )}
    >
      {retour && <BoutonRetour onRetour={retour} titre={titre ?? "l'écran d'avant"} className="pointer-events-auto" />}
      {side === "bottom" && <Poignee />}
      <SheetPrimitive.Close
        data-slot="sheet-close"
        render={
          <Button
            variant="ghost"
            className="pointer-events-auto rounded-full bg-popover/80 backdrop-blur-sm"
            size="icon-sm"
          />
        }
      >
        <XIcon
        />
        <span className="sr-only">Fermer</span>
      </SheetPrimitive.Close>
    </div>
  )
}

function ContenuRacine({ className, style, children, side = "right", showCloseButton = true, onRetour, ...props }: ContentProps) {
  const fenetre = useFenetre()
  const { ecrans } = React.useContext(EtatContext)
  const [popup, setPopup] = React.useState<HTMLDivElement | null>(null)
  const poserScene = React.useCallback((el: HTMLDivElement | null) => fenetre?.scene(el), [fenetre])
  const haut = ecrans.at(-1)
  useBascule(popup, haut?.id ?? "", ["", ...ecrans.map((e) => e.id)].join(" "))
  const classe = className as string | undefined
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        ref={setPopup}
        data-slot="sheet-content"
        data-side={side}
        className={cn(FEUILLE, haut ? haut.cadre?.className : classe)}
        style={haut ? haut.cadre?.style : style}
        {...props}
      >
        {/* La croix ne part jamais avec le défilement (collée en haut de la
            feuille), et une feuille du bas se ferme aussi en la tirant vers
            le bas par sa poignée — Sabri, 22/10 : des fenêtres qu'on
            n'arrivait plus à fermer. */}
        <div data-ecran="" data-side={side} className={haut ? range(classe) : "contents"} inert={!!haut} aria-hidden={haut ? true : undefined}>
          {showCloseButton && <Rangee side={side} retour={onRetour} enFlux={!!onRetour} />}
          {children as React.ReactNode}
        </div>
        <div ref={poserScene} className="contents" />
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

/** Le SheetContent d'un écran posé dans une fenêtre : il y entre par un portail. */
function ContenuDEcran({ fenetre, id, className, style, children, side = "bottom", showCloseButton = true }: ContentProps & { fenetre: Fenetre; id: string }) {
  const { ecrans, scene, titre } = React.useContext(EtatContext)
  const { retour } = React.useContext(EcranContext)
  const { maj } = fenetre
  const classe = className as string | undefined
  const allure = style as React.CSSProperties | undefined
  React.useLayoutEffect(() => {
    maj(id, { cadre: { className: classe, style: allure } })
  }, [maj, id, classe, allure])
  const i = ecrans.findIndex((e) => e.id === id)
  const devant = i >= 0 && i === ecrans.length - 1
  if (!scene) return null
  return createPortal(
    <div data-ecran={id} data-side={side} className={devant ? "contents" : range(classe)} inert={!devant} aria-hidden={devant ? undefined : true}>
      {showCloseButton && <Rangee side={side} retour={retour} titre={i > 0 ? ecrans[i - 1].titre : titre} enFlux />}
      {children as React.ReactNode}
    </div>,
    scene
  )
}

const GLISSE = "cubic-bezier(0.22, 1, 0.36, 1)"

/**
 * Le passage d'un écran à l'autre, dans la fenêtre `popup` : l'écran qu'on
 * quitte garde sa place (le défilement de la fenêtre), celui qui revient
 * retrouve la sienne, celui qui arrive s'ouvre en haut. La fenêtre passe
 * d'une hauteur à l'autre, l'écran qui arrive glisse (de la droite en
 * avançant, de la gauche en revenant ; un fondu si l'on réduit les
 * animations), et le focus suit : le retour de l'écran qui arrive, ou ce
 * qu'on avait touché en revenant. `ids` : la racine et les écrans, dans
 * l'ordre, séparés d'une espace.
 */
function useBascule(popup: HTMLElement | null, devant: string, ids: string) {
  const etat = React.useRef<{ el: HTMLElement | null; id: string; top: number; hauteur: number }>({ el: null, id: "", top: 0, hauteur: 0 })
  const places = React.useRef(new Map<string, number>())
  const focus = React.useRef(new Map<string, HTMLElement>())

  React.useEffect(() => {
    if (!popup) return
    const noter = () => {
      if (etat.current.el === popup) etat.current.top = popup.scrollTop
    }
    const mesure = new ResizeObserver(() => {
      if (etat.current.el === popup) etat.current.hauteur = popup.getBoundingClientRect().height
    })
    popup.addEventListener("scroll", noter, { passive: true })
    mesure.observe(popup)
    return () => {
      popup.removeEventListener("scroll", noter)
      mesure.disconnect()
    }
  }, [popup])

  React.useLayoutEffect(() => {
    const e = etat.current
    if (!popup) return
    if (e.el !== popup) {
      // Une fenêtre (r)ouverte : tout repart d'elle.
      etat.current = { el: popup, id: devant, top: popup.scrollTop, hauteur: popup.getBoundingClientRect().height }
      places.current.clear()
      focus.current.clear()
      return
    }
    if (e.id === devant) return
    const avance = ids.split(" ").includes(e.id)
    if (avance) {
      places.current.set(e.id, e.top)
      const actif = document.activeElement
      if (actif instanceof HTMLElement && popup.contains(actif)) focus.current.set(e.id, actif)
    } else places.current.delete(e.id)
    const top = avance ? 0 : (places.current.get(devant) ?? 0)
    popup.scrollTo({ top })
    const hauteur = popup.getBoundingClientRect().height
    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!reduit && e.hauteur > 0 && Math.abs(hauteur - e.hauteur) > 2) {
      popup.animate([{ height: `${e.hauteur}px` }, { height: `${hauteur}px` }], { duration: 320, easing: GLISSE })
    }
    const ecran = popup.querySelector<HTMLElement>(`[data-ecran="${CSS.escape(devant)}"]`)
    if (ecran) {
      for (const enfant of ecran.children) {
        ;(enfant as HTMLElement).animate(
          reduit
            ? [{ opacity: 0 }, { opacity: 1 }]
            : [
                { opacity: 0, translate: `${avance ? 32 : -32}px 0` },
                { opacity: 1, translate: "0 0" },
              ],
          { duration: reduit ? 160 : 300, easing: GLISSE }
        )
      }
    }
    if (avance) ecran?.querySelector<HTMLElement>('[data-slot="retour"]')?.focus({ preventScroll: true })
    else {
      const f = focus.current.get(devant)
      focus.current.delete(devant)
      if (f?.isConnected) f.focus({ preventScroll: true })
    }
    etat.current = { el: popup, id: devant, top, hauteur }
  }, [popup, devant, ids])
}

/** La poignée d'une feuille du bas : la tirer vers le bas fait suivre la
 *  feuille au doigt, et au-delà de 90 px (ou d'un geste vif) la ferme. Au
 *  doigt (touch, la page ne doit pas défiler) comme à la souris. Une feuille
 *  sans la croix par défaut la pose elle-même (`barre` : sa couleur, sur un
 *  verre clair). Elle ferme toute la fenêtre, quel que soit l'écran devant. */
function Poignee({ barre = "bg-foreground/25" }: { barre?: string }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const fenetre = useFenetre()
  React.useEffect(() => {
    const el = ref.current
    const f = el?.closest<HTMLElement>('[data-slot="sheet-content"]')
    if (!el || !f) return
    let y0: number | null = null
    let t0 = 0
    const debut = (y: number, t: number) => {
      y0 = y
      t0 = t
    }
    const suivre = (y: number) => {
      if (y0 == null) return
      f.style.transition = "none"
      f.style.translate = `0 ${Math.max(0, y - y0)}px`
    }
    const fin = (y: number | null, t: number) => {
      const dy = y0 != null && y != null ? y - y0 : 0
      const vif = dy > 30 && dy / Math.max(1, t - t0) > 0.6
      y0 = null
      f.style.transition = ""
      f.style.translate = ""
      if (!(dy > 90 || vif)) return
      if (fenetre) fenetre.fermer()
      else f.querySelector<HTMLElement>('[data-slot="sheet-close"]')?.click()
    }
    let dernierY: number | null = null
    const tStart = (e: TouchEvent) => {
      dernierY = e.touches[0].clientY
      debut(dernierY, e.timeStamp)
    }
    const tMove = (e: TouchEvent) => {
      if (y0 == null) return
      e.preventDefault()
      dernierY = e.touches[0].clientY
      suivre(dernierY)
    }
    const tEnd = (e: TouchEvent) => fin(dernierY, e.timeStamp)
    const pDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return
      debut(e.clientY, e.timeStamp)
      const pMove = (m: PointerEvent) => suivre(m.clientY)
      const pUp = (u: PointerEvent) => {
        window.removeEventListener("pointermove", pMove)
        window.removeEventListener("pointerup", pUp)
        fin(u.clientY, u.timeStamp)
      }
      window.addEventListener("pointermove", pMove)
      window.addEventListener("pointerup", pUp)
    }
    el.addEventListener("touchstart", tStart, { passive: true })
    el.addEventListener("touchmove", tMove, { passive: false })
    el.addEventListener("touchend", tEnd)
    el.addEventListener("touchcancel", tEnd)
    el.addEventListener("pointerdown", pDown)
    return () => {
      el.removeEventListener("touchstart", tStart)
      el.removeEventListener("touchmove", tMove)
      el.removeEventListener("touchend", tEnd)
      el.removeEventListener("touchcancel", tEnd)
      el.removeEventListener("pointerdown", pDown)
    }
  }, [fenetre])
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-auto absolute inset-x-16 top-0 flex h-9 touch-none justify-center pt-2"
    >
      <span className={cn("h-[5px] w-10 rounded-full", barre)} />
    </div>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-0.5 p-4", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn("mt-auto flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

// Dans un écran posé, le titre et la description restent de simples
// éléments : ils ne prennent pas à la fenêtre son nom, qui est celui de sa
// racine (et le lui laisseraient vide en partant).
function SheetTitle({ className, render, ...props }: SheetPrimitive.Title.Props) {
  const { id } = React.useContext(EcranContext)
  const classe = cn("font-heading text-base font-medium text-foreground", className as string | undefined)
  if (id) return <h2 data-slot="sheet-title" className={classe} {...(props as React.ComponentProps<"h2">)} />
  return <SheetPrimitive.Title data-slot="sheet-title" className={classe} render={render} {...props} />
}

function SheetDescription({ className, render, ...props }: SheetPrimitive.Description.Props) {
  const { id } = React.useContext(EcranContext)
  const classe = cn("text-sm text-muted-foreground", className as string | undefined)
  if (id) return <p data-slot="sheet-description" className={classe} {...(props as React.ComponentProps<"p">)} />
  return <SheetPrimitive.Description data-slot="sheet-description" className={classe} render={render} {...props} />
}

export {
  Poignee,
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
  useFenetre,
  useRetourDEcran,
}
