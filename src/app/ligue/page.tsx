"use client";

// L'onglet Actus (ex-Ligue), à l'époque de la saison en cours : la course et
// le fil des dimanches (components/sfl/actus/course.tsx). Les saisons closes
// (/saisons/N) et le Wall of Fame (/palmares) sont les autres époques du même
// onglet ; leurs adresses et les anciens liens : actus/page-actus.tsx.

import { PageActus } from "@/components/sfl/actus/page-actus";

export default function ActusPage() {
  return <PageActus epoque="present" />;
}
