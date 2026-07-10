import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" />
      <h1 className="text-lg font-semibold">Pas de connexion</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Cette page n&apos;est pas disponible hors-ligne. Reconnecte-toi pour continuer.
      </p>
    </div>
  );
}
