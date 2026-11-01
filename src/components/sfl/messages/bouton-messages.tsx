"use client";

// Le bouton des messages privés, en haut du Vestiaire, à côté de la loupe :
// l'avion de papier, comme les messages d'Instagram, et en rouge ce que je
// n'ai pas lu. Il ouvre la liste de mes conversations (/messages).

import Link from "next/link";
import { Send } from "lucide-react";
import { useMessagesPrives } from "@/hooks/use-messages-prives";
import { cn } from "@/lib/utils";

export function BoutonMessages({ className }: { className?: string }) {
  const { nonLus } = useMessagesPrives();
  return (
    <Link
      href="/messages"
      aria-label={nonLus > 0 ? `Messages, ${nonLus} pas lu${nonLus > 1 ? "s" : ""}` : "Messages"}
      className={cn("bouton-secondaire relative flex size-11 shrink-0 items-center justify-center", className)}
    >
      <Send className="size-[18px] -translate-x-px translate-y-px" strokeWidth={2.1} />
      {nonLus > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-legende leading-none font-bold text-white tabular-nums"
          style={{ background: "#FF3B30", boxShadow: "0 0 0 2px var(--background)" }}
        >
          {nonLus > 9 ? "9+" : nonLus}
        </span>
      )}
    </Link>
  );
}
