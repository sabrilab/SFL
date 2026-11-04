"use client";

// Analytics → 4. Revenu. Aucun paiement réel n'est en place (modèle du
// 19/10/2026 : les matchs gratuits, la carrière payante plus tard) : la
// partie le dit, puis montre ce qui annonce le revenu, la monnaie de l'app
// qu'on dépense déjà : les packs ouverts contre de l'XP (table achats_xp),
// combien de joueurs en ouvrent, et lesquels partent le plus.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { pct } from "@/lib/sfl/retention";
import { Barres } from "./graphiques";
import { Section } from "./cadre";

interface Achat {
  joueur: string;
  article: string;
  at: number;
}

/** « pack-afrique » → « Pack afrique ». */
const nomPack = (a: string) => {
  const s = a.replace(/^pack-/, "").replace(/-/g, " ");
  return `Pack ${s}`;
};

export function Revenu({
  depuis,
  actifs,
  garde,
}: {
  depuis: number;
  /** Les joueurs venus sur la période (la part de ceux qui ouvrent un pack). */
  actifs: number;
  /** Le public regardé, par identifiant (les achats sont rangés par id). */
  garde: (id: string) => boolean;
}) {
  const [achats, setAchats] = useState<Achat[] | null | "erreur">(null);

  useEffect(() => {
    let annule = false;
    void (async () => {
      const lu: Achat[] = [];
      for (let debut = 0; ; debut += 1000) {
        const { data, error } = await supabase()
          .from("achats_xp")
          .select("joueur, article, le")
          .order("id")
          .range(debut, debut + 999);
        if (error) {
          if (!annule) setAchats("erreur");
          return;
        }
        lu.push(...((data ?? []) as { joueur: string; article: string; le: string }[]).map((r) => ({
          joueur: r.joueur,
          article: r.article,
          at: new Date(r.le).getTime(),
        })));
        if (!data || data.length < 1000) break;
      }
      if (!annule) setAchats(lu);
    })();
    return () => {
      annule = true;
    };
  }, []);

  const a = useMemo(() => {
    if (!Array.isArray(achats)) return null;
    const vus = achats.filter((x) => x.at >= depuis && garde(x.joueur));
    const joueurs = new Set(vus.map((x) => x.joueur)).size;
    const parPack = new Map<string, number>();
    for (const x of vus) parPack.set(x.article, (parPack.get(x.article) ?? 0) + 1);
    const packs = [...parPack.entries()].map(([k, value]) => ({ label: nomPack(k), value })).sort((x, y) => y.value - x.value);
    return { n: vus.length, joueurs, packs };
  }, [achats, depuis, garde]);

  return (
    <>
      <Section id="argent" titre="Ce que Bola gagne">
        <div className="flex items-baseline gap-2.5">
          <span className="text-titre-m font-extrabold tracking-tight tabular-nums">0 €</span>
          <span className="text-corps text-encre-3">Aucun paiement n&apos;est encore en place.</span>
        </div>
      </Section>
      <Section id="packs" titre="Les packs ouverts en XP" sous="La monnaie de l'app qu'on dépense déjà : le signe de ce qui se vendra.">
        {achats === "erreur" ? (
          <p className="text-corps text-encre-3">Les packs n&apos;ont pas pu être lus.</p>
        ) : !a ? (
          <p className="text-corps text-encre-3">Lecture…</p>
        ) : a.n === 0 ? (
          <p className="text-corps text-encre-3">Aucun pack ouvert sur cette période.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="glass-soft rounded-2xl px-3.5 py-3">
                <p className="mono-label text-micro text-encre-3">Packs ouverts</p>
                <p className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">{a.n}</p>
              </div>
              <div className="glass-soft rounded-2xl px-3.5 py-3">
                <p className="mono-label text-micro text-encre-3">Joueurs</p>
                <p className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">{a.joueurs}</p>
                {actifs > 0 && <p className="mt-1.5 text-legende text-encre-3">{pct(a.joueurs / actifs)} des actifs</p>}
              </div>
            </div>
            <div className="mt-4">
              <Barres lignes={a.packs} />
            </div>
          </>
        )}
      </Section>
    </>
  );
}
