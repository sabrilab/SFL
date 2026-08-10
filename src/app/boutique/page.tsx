"use client";

// Section Boutique — réplique de l'écran « BOUTIQUE matte » du design de
// référence : catégories en pilules, un produit à la une (visuel hachuré,
// badge, prix, action blanche), la grille des articles, le solde de Ballons
// et le drop de la semaine.
//
// Verrouillée : décision de l'admin, on ne l'ouvre pas encore (paiements,
// stocks et échelle de points à définir). Les prix sont en points seulement —
// la ligue paie avec ce qui se gagne sur le terrain.

import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";

const CATS = ["Tout", "Maillots", "Survêts", "Montres", "Accessoires"] as const;

const ITEMS = [
  { tag: "SURVÊT", name: "Survêt club · veste + bas", pts: "4 400" },
  { tag: "MONTRE", name: "Montre SFL · série verte", pts: "6 300" },
  { tag: "CHAUSSETTES", name: "Chaussettes match · lot de 3", pts: "900" },
  { tag: "SAC", name: "Sac de sport · logo brodé", pts: "2 100" },
];

export default function Boutique() {
  const { player } = useMyPlayer();
  const ballons = useBallons(player.name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Boutique</h1>
        <p className="mt-1 text-[13px] text-foreground/42">
          Maillots, survêts, montres · payables en points
        </p>
      </div>

      <Locked
        label="Bientôt"
        chipClassName="-top-9 right-0"
        note="La boutique ouvrira plus tard : les prix en points, les stocks et les drops sont encore à caler."
      >
        <div className="flex flex-col gap-4">
          {/* Catégories */}
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {CATS.map((c, i) => (
              <span
                key={c}
                className={
                  i === 0
                    ? "shrink-0 rounded-full bg-foreground px-[15px] py-2.5 text-[13px] font-bold text-background"
                    : "glass-soft shrink-0 rounded-full px-[15px] py-2.5 text-[13px] font-semibold text-foreground/72"
                }
              >
                {c}
              </span>
            ))}
          </div>

          {/* Le produit à la une */}
          <div className="glass overflow-hidden rounded-[26px]">
            <div
              className="relative"
              style={{
                height: 210,
                background:
                  "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 9px, rgba(255,255,255,0.012) 9px 18px), radial-gradient(120% 90% at 70% 15%, rgba(255,255,255,0.07), rgba(0,0,0,0) 60%)",
              }}
            >
              <span className="mono-label absolute top-3.5 left-3.5 rounded-full border border-white/16 bg-white/10 px-[11px] py-[5px] text-foreground/80">
                Nouveau · Domicile 25/26
              </span>
              <span className="mono-label absolute right-3.5 bottom-3.5 text-foreground/35">
                Visuel produit
              </span>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[19px] leading-[1.25] font-bold tracking-tight">
                    Maillot SFL · domicile
                  </div>
                  <p className="mt-[5px] text-[13px] text-foreground/42">
                    Floqué à ton nom et ton numéro
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[22px] font-extrabold tracking-tight tabular-nums">2 900</div>
                  <div className="mono-label mt-[3px] text-primary">Points</div>
                </div>
              </div>
              <div className="mt-3.5 rounded-full bg-foreground py-[15px] text-center text-[15px] font-bold text-background">
                Échanger mes points
              </div>
            </div>
          </div>

          {/* La grille */}
          <div className="grid grid-cols-2 gap-[11px]">
            {ITEMS.map((it) => (
              <div key={it.name} className="glass overflow-hidden rounded-[22px]">
                <div
                  className="relative"
                  style={{
                    height: 112,
                    background:
                      "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 9px, rgba(255,255,255,0.012) 9px 18px), rgba(255,255,255,0.02)",
                  }}
                >
                  <span className="mono-label absolute top-2.5 left-2.5 text-foreground/40">
                    {it.tag}
                  </span>
                </div>
                <div className="px-3 pt-3 pb-3.5">
                  <div className="text-[14px] leading-[1.3] font-bold tracking-tight">{it.name}</div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[16px] font-extrabold tracking-tight tabular-nums">
                      {it.pts}
                    </span>
                    <span className="mono-label text-primary">Points</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Le solde */}
          <div className="glass flex items-center justify-between gap-3 rounded-3xl p-4">
            <div>
              <p className="mono-label text-foreground/40">Ton solde</p>
              <div className="mt-1.5 flex items-baseline gap-[7px]">
                <span className="text-[26px] leading-none font-extrabold tracking-tight tabular-nums">
                  {ballons.toLocaleString("fr-FR")}
                </span>
                <span className="text-[15px]">⚽</span>
              </div>
              <p className="mt-1 text-[12.5px] text-foreground/42">
                1 dimanche joué = 120 Ballons
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-foreground px-[18px] py-3 text-[14px] font-bold text-background">
              Échanger
            </span>
          </div>

          {/* Le drop de la semaine */}
          <div className="glass rounded-3xl p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-bold tracking-tight">Drop de la semaine</h2>
              <span className="mono-label text-[#FF6B5E]">Fin dans 2 j</span>
            </div>
            <div className="mt-3 flex gap-[11px]">
              <span
                className="size-24 shrink-0 rounded-[18px] border border-white/8"
                style={{
                  background:
                    "repeating-linear-gradient(115deg, rgba(255,255,255,0.06) 0 9px, rgba(255,255,255,0.012) 9px 18px), rgba(255,255,255,0.03)",
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold">Montre SFL · série verte</div>
                <p className="mt-1 text-[12.5px] leading-[1.45] text-foreground/42">
                  Bracelet nylon, cadran noir mat, index vert. 200 pièces.
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[17px] font-extrabold tabular-nums">6 300</span>
                  <span className="mono-label text-primary">Points</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Locked>
    </div>
  );
}
