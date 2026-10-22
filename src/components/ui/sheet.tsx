"use client"

import * as React from "react"
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
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

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetPrimitive.Popup.Props & {
  side?: "top" | "right" | "bottom" | "left"
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Popup
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm",
          className
        )}
        {...props}
      >
        {/* La croix ne part jamais avec le défilement (collée en haut de la
            feuille), et une feuille du bas se ferme aussi en la tirant vers
            le bas par sa poignée — Sabri, 22/10 : des fenêtres qu'on
            n'arrivait plus à fermer. */}
        {showCloseButton && (
          <div className="pointer-events-none sticky top-0 z-30 -mb-[4.5rem] flex h-14 shrink-0 items-start justify-end px-3 pt-3">
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
        )}
        {children}
      </SheetPrimitive.Popup>
    </SheetPortal>
  )
}

/** La poignée d'une feuille du bas : la tirer vers le bas fait suivre la
 *  feuille au doigt, et au-delà de 90 px (ou d'un geste vif) la ferme. Au
 *  doigt (touch, la page ne doit pas défiler) comme à la souris. */
function Poignee() {
  const ref = React.useRef<HTMLDivElement>(null)
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
      if (dy > 90 || vif) f.querySelector<HTMLElement>('[data-slot="sheet-close"]')?.click()
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
  }, [])
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-auto absolute inset-x-16 top-0 flex h-9 touch-none justify-center pt-2"
    >
      <span className="h-[5px] w-10 rounded-full bg-foreground/25" />
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

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base font-medium text-foreground",
        className
      )}
      {...props}
    />
  )
}

function SheetDescription({
  className,
  ...props
}: SheetPrimitive.Description.Props) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
