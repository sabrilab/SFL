"use client";

// Le Wall of Fame : depuis le 24/10, une époque de l'onglet Actus (Sabri : le
// mettre « dans la section Actu »), la dernière de la rangée, après les
// saisons (components/sfl/actus/epoques.tsx, wall-of-fame.tsx). L'adresse
// reste : les anciens liens y mènent toujours, et le journal d'activité
// compte ses ouvertures (lib/sfl/retention.ts).

import { PageActus } from "@/components/sfl/actus/page-actus";

export default function WallOfFamePage() {
  return <PageActus epoque="palmares" />;
}
