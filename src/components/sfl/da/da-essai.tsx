"use client";

// Le sélecteur des DA à l'essai (lib/sfl/da.ts) : il n'apparaît que sur une
// adresse qui porte ?da=, ou après, tant qu'une variante est posée. En haut à
// gauche, discret : 0 (en ligne), puis 1 à 4, et le nom de celle qu'on voit.

import { useEffect } from "react";
import { DAS, daDeDepart, poserDa, useDa, useDaEssai } from "@/lib/sfl/da";
import "./da.css";

export function DaEssai() {
  const da = useDa();
  const visible = useDaEssai();
  useEffect(() => {
    const n = daDeDepart();
    poserDa(n, n !== 0 || new URLSearchParams(window.location.search).has("da"));
  }, []);
  if (!visible) return null;
  return (
    <div className="da-essai" role="group" aria-label="Direction artistique à l'essai">
      {DAS.map((d) => (
        <button key={d.n} type="button" aria-pressed={d.n === da} onClick={() => poserDa(d.n)}>
          {d.n}
        </button>
      ))}
      <span className="da-essai__nom">{DAS[da].nom}</span>
    </div>
  );
}
