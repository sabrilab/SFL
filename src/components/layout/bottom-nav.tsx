"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
      <div className="mx-auto flex max-w-md items-center justify-around rounded-full bg-background/75 px-2 py-1.5 shadow-lg shadow-black/25 ring-1 ring-border/60 backdrop-blur-xl">
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
              className={cn(
                "flex flex-col items-center gap-1 rounded-full px-3 py-2.5 transition-colors",
                active ? "text-foreground" : "text-muted-foreground/60 hover:text-muted-foreground"
              )}
            >
              <Icon className="size-[22px]" strokeWidth={active ? 2.2 : 1.8} />
              <span
                className={cn(
                  "size-1 rounded-full transition-all",
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
