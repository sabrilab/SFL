"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}
    >
      <nav className="pointer-events-auto flex w-full max-w-sm items-center gap-1 rounded-2xl border bg-background/85 p-1.5 shadow-lg shadow-black/10 backdrop-blur-xl dark:shadow-black/40">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[11px] font-medium transition-all",
                active
                  ? "bg-primary/12 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon
                className={cn("size-5 transition-transform", active && "scale-110")}
                strokeWidth={active ? 2.4 : 2}
              />
              {item.label}
              <span
                className={cn(
                  "h-1 w-1 rounded-full transition-opacity",
                  active ? "bg-primary opacity-100" : "opacity-0"
                )}
              />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
