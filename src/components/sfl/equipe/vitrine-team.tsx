"use client";

// Bola Team en vitrine (Sabri, 24/10 : « il faudrait aussi que les
// fonctionnalités qui sont dues à un abonnement soient montrées aux gens qui
// utilisent l'appli gratuitement »). À qui n'a pas accès au mode Team
// (hooks/use-acces-team.ts ; la règle d'accès vit en base, c'est celle du
// parrainage), la page Team montre ce qu'il y trouverait, au lieu de
// « Créer mon équipe » qu'on lui refuserait : un écusson à ses initiales et
// son maillot, qui passent d'une couleur de club à l'autre (immobiles avec
// « Réduire les animations »), ce que le mode apporte, et la porte : le lien
// d'un joueur SFL. La vue Championnat, elle, reste ouverte à tous.
//
// VitrineBola, la même en une ligne, se pose sous le classement de Bola
// (app/ligue-vierge) pour qui n'a pas d'équipe : elle mène au championnat.

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { useMediaQuery } from "@/hooks/use-media-query";
import { PALETTE, type Blason } from "@/lib/sfl/blason";

const hex = (id: string) => PALETTE.find((c) => c.id === id)?.hex ?? PALETTE[0].hex;

/** Quelques écussons de club, l'un après l'autre. */
const DEFILE: Blason[] = [
  { forme: "blason", motif: "bande", couleurs: [hex("noir"), hex("or"), hex("blanc")], embleme: "etoile" },
  { forme: "ecu", motif: "rayures", couleurs: [hex("ciel"), hex("blanc"), hex("marine")], embleme: "initiales" },
  { forme: "rond", motif: "parti", couleurs: [hex("rouge"), hex("blanc"), hex("noir")], embleme: "ballon" },
  { forme: "pointe", motif: "chevron", couleurs: [hex("vert"), hex("blanc"), hex("noir")], embleme: "couronne" },
  { forme: "ovale", motif: "cercle", couleurs: [hex("violet"), hex("or"), hex("blanc")], embleme: "eclair" },
];

const ATOUTS = ["Ton équipe de 5 à 7", "Ton écusson, tes couleurs", "Un championnat par divisions, sur 4 mois", "Buteurs, passeurs, récompenses"];

function useDefile(): Blason {
  const calme = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [i, setI] = useState(0);
  useEffect(() => {
    if (calme) return;
    const t = window.setInterval(() => setI((n) => (n + 1) % DEFILE.length), 2400);
    return () => window.clearInterval(t);
  }, [calme]);
  return DEFILE[i];
}

export function VitrineTeam({ initiales }: { initiales: string }) {
  const b = useDefile();
  const ini = initiales || "BT";
  return (
    <section className="flex flex-col items-center gap-5 rounded-[28px] bg-card px-5 pt-6 pb-5 text-center md:self-center md:px-[var(--fib-34)]">
      <div className="flex items-end justify-center gap-4">
        <Ecusson initiales={ini} fond="noir" blason={b} taille={96} />
        <Maillot initiales={ini} fond="noir" blason={b} taille={112} />
      </div>
      <h2 className="text-[26px] leading-none font-bold tracking-tight">Bola Team</h2>
      <ul className="flex flex-col gap-2 text-[14.5px] font-medium">
        {ATOUTS.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
      <span className="mono-label text-muted-foreground">Il te faut le lien d&apos;un joueur SFL</span>
    </section>
  );
}

/** La vitrine en une ligne, sous le classement de Bola. */
export function VitrineBola() {
  const b = useDefile();
  return (
    <Link
      href="/bola-team?vue=championnat"
      className="flex items-center gap-3 rounded-[22px] bg-card py-2.5 pr-3 pl-2.5 transition-transform active:scale-[0.98]"
    >
      <Ecusson initiales="BT" fond="noir" blason={b} taille={44} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15.5px] font-bold">Bola Team</span>
        <span className="truncate text-[12.5px] text-muted-foreground">Le championnat des équipes</span>
      </span>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
