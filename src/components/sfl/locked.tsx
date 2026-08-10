import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Enveloppe une fonctionnalité pas encore ouverte : le contenu reste visible
 * (on voit ce qui arrive) mais grisé, inerte au clic, et marqué « Bientôt ».
 * Convention décidée avec l'admin : on montre la destination, on n'y donne
 * pas accès tant que le moteur (comptes, vote, vidéos…) n'existe pas.
 */
export function Locked({
  children,
  label = "Bientôt",
  note,
  className,
  chipClassName,
}: {
  children: React.ReactNode;
  label?: string;
  note?: string;
  className?: string;
  /** Position du badge — à surcharger sur les petits éléments (boutons)
      où top-3/right-3 recouvrirait le texte. */
  chipClassName?: string;
}) {
  return (
    <div className={cn("relative", className)} aria-disabled>
      <div className="pointer-events-none opacity-40 grayscale select-none" inert>
        {children}
      </div>
      <span
        className={cn(
          "absolute z-10 flex items-center gap-1.5 rounded-full bg-foreground/85 px-2.5 py-1 text-[11px] font-bold tracking-wide text-background uppercase",
          chipClassName ?? "top-3 right-3"
        )}
      >
        <Lock className="size-3" /> {label}
      </span>
      {note && (
        <p className="mt-2 px-1 text-[12px] leading-snug text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
