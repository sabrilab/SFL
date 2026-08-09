"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-4 z-40 md:hidden"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
    >
      {/* Bulle flottante : la barre reste collée en bas mais vit dans sa
          propre pilule translucide, détachée des bords de l'écran. */}
      <div className="glass mx-auto flex max-w-md items-center justify-around rounded-full px-2 py-1.5">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="relative flex flex-col items-center gap-1 rounded-full px-3 py-2.5"
            >
              {active && (
                <motion.span
                  layoutId="bottom-nav-pill"
                  className="pill-emboss absolute inset-0 rounded-lg"
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                />
              )}
              <Icon
                className={cn(
                  "relative size-[22px] transition-colors",
                  active ? "text-foreground" : "text-muted-foreground/60",
                  // Section verrouillée : l'onglet mène à l'aperçu, mais son
                  // icône reste éteinte pour signaler l'indisponibilité.
                  item.locked && !active && "opacity-45"
                )}
                strokeWidth={active ? 2.2 : 1.8}
              />
              <span
                className={cn(
                  "relative size-1 rounded-full transition-colors",
                  active ? "bg-primary" : "bg-transparent"
                )}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
