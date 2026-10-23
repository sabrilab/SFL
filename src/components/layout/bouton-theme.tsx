"use client";

// Le mode clair et le mode sombre, d'un toucher, en haut de Ma carte (Sabri,
// le 23/10 : « un mode clair et un mode sombre, qu'on peut accéder
// facilement »). Le symbole est celui de l'Apparence d'iOS, un rond à moitié
// plein ; il fait un demi-tour à chaque bascule (une animation, pas une
// transition : next-themes coupe les transitions le temps de changer de
// couleurs). Le toucher prend le mode opposé à celui qu'on voit ; « Auto »,
// qui suit le téléphone, est dans les réglages avec les deux autres
// (reglages/page.tsx).

import { useState } from "react";
import { useTheme } from "next-themes";
import { useModeClair } from "@/hooks/use-mode-clair";
import { useIsClient } from "@/hooks/use-is-client";
import { cn } from "@/lib/utils";

export function BoutonTheme({ className }: { className?: string }) {
  const { setTheme } = useTheme();
  const clair = useModeClair();
  const isClient = useIsClient();
  const [tours, setTours] = useState(0);
  return (
    <button
      type="button"
      onClick={() => {
        setTheme(clair ? "dark" : "light");
        setTours((n) => n + 1);
      }}
      aria-label={!isClient ? "Mode clair ou sombre" : clair ? "Passer en mode sombre" : "Passer en mode clair"}
      className={cn("bouton-secondaire flex size-11 shrink-0 items-center justify-center", className)}
    >
      <svg
        key={tours}
        width="21"
        height="21"
        viewBox="0 0 24 24"
        aria-hidden
        className={cn(tours > 0 && "theme-demi-tour")}
        style={{ transform: `rotate(${clair ? 180 : 0}deg)` }}
      >
        <circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 3.4a8.6 8.6 0 0 1 0 17.2z" fill="currentColor" />
      </svg>
    </button>
  );
}
