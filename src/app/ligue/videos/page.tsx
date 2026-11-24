"use client";

// Le fil vertical des Actus : les photos et les vidéos de Bola, une par
// écran (components/sfl/actus/fil-vertical.tsx). ?p=<id> ouvre sur une
// publication ; on y arrive par la rangée « Photos et vidéos » du fil.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { FilVertical } from "@/components/sfl/actus/fil-vertical";

function Fil() {
  const p = useSearchParams().get("p");
  return <FilVertical depart={p} />;
}

export default function PageFilVertical() {
  return (
    <Suspense>
      <Fil />
    </Suspense>
  );
}
