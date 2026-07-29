// État de chargement de route. Sans ce fichier, une navigation vers une page
// lente laisse l'écran précédent figé sans aucun signal. Deviendra visible dès
// que les données viendront du réseau plutôt que du localStorage.

import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <Skeleton className="h-7 w-40 rounded-lg" />
      <Skeleton className="mt-3 h-4 w-64 rounded-lg" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  );
}
