"use client";

// Section Boutique — réplique de l'écran « BOUTIQUE matte » du design de
// référence : catégories en pilules, un produit à la une, la grille des
// articles, le solde de Ballons et le drop de la semaine.
//
// Les prix ne sont plus écrits à la main : chaque article porte son prix de
// vente en euros, et la boutique le convertit au taux de la ligue (1 Ballon =
// 1 centime, cf. ballons.ts). La marge se décide donc une seule fois, en
// fixant le prix en euros — le prix en Ballons suit tout seul.
//
// Le textile reste verrouillé : paiement, stocks et tailles ne sont pas
// branchés. Les recharges de Ballons aussi, tant qu'il n'y a pas de paiement.

import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";
import { BALLONS_PAR_EURO, RECHARGES, ballonsPourEuros } from "@/lib/sfl/ballons";
import { CARD_PRICES } from "@/lib/sfl/collection";
import Link from "next/link";

const CATS = ["Tout", "Maillots", "Survêts", "Montres", "Accessoires"] as const;

/** Prix de vente en euros — le prix en Ballons en découle. */
const UNE = { name: "Maillot SFL · domicile", note: "Floqué à ton nom et ton numéro", euros: 29 };

const ITEMS = [
  { tag: "SURVÊT", name: "Survêt club · veste + bas", euros: 44 },
  { tag: "MONTRE", name: "Montre SFL · série verte", euros: 63 },
  { tag: "CHAUSSETTES", name: "Chaussettes match · lot de 3", euros: 9 },
  { tag: "SAC", name: "Sac de sport · logo brodé", euros: 21 },
];

const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export default function Boutique() {
  const { player } = useMyPlayer();
  const ballons = useBallons(player.name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Boutique</h1>
        <p className="mt-1 text-[13px] text-foreground/42">
          Maillots, survêts, montres · payables en Ballons
        </p>
      </div>

      {/* Le solde — la seule chose vraiment vivante sur cette page */}
      <div className="glass flex items-center justify-between gap-3 rounded-3xl p-4">
        <div className="min-w-0">
          <p className="mono-label text-foreground/40">Ton solde</p>
          <div className="mt-1.5 flex items-baseline gap-[7px]">
            <span className="text-[26px] leading-none font-extrabold tracking-tight tabular-nums">
              {milliers(ballons)}
            </span>
            <span className="text-[15px]">⚽</span>
          </div>
          <p className="mt-1 text-[12.5px] text-foreground/42">
            Soit {(ballons / BALLONS_PAR_EURO).toFixed(2).replace(".", ",")} € de pouvoir
            d&apos;achat
          </p>
        </div>
        <Link
          href="/duel?mode=collection"
          className="shrink-0 rounded-full bg-foreground px-[18px] py-3 text-center text-[14px] font-bold text-background"
        >
          Cartes
        </Link>
      </div>

      {/* Ce que valent les cartes — le rayon le plus vivant de la ligue */}
      <section className="glass rounded-3xl p-5">
        <p className="mono-label text-primary">Le rayon cartes</p>
        <p className="mt-2 text-[12.5px] leading-snug text-foreground/45">
          Achetables à l&apos;unité dans <strong className="text-foreground/70">Arène →
          Collection</strong>, y compris les cartes des autres joueurs. Tu en reçois une copie :
          le propriétaire garde la sienne. Et en match, tu ne peux aligner que des cartes que tu
          possèdes.
        </p>
        <div className="mt-3.5 flex flex-col gap-2">
          {(
            [
              ["Standard", CARD_PRICES.simple],
              ["Rare", CARD_PRICES.rare],
              ["Défensive", CARD_PRICES.def],
              ["Impact", CARD_PRICES.impact],
              ["MVP", CARD_PRICES.mvp],
            ] as const
          ).map(([label, prix]) => (
            <div key={label} className="flex items-baseline justify-between gap-3">
              <span className="text-[13.5px] font-semibold">{label}</span>
              <span className="flex items-baseline gap-2">
                <span className="mono-label text-foreground/30">
                  {(prix / BALLONS_PAR_EURO).toFixed(2).replace(".", ",")} €
                </span>
                <span className="text-[15px] font-extrabold tabular-nums">{prix} ⚽</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Les recharges — le taux de la ligue, en clair */}
      <section>
        <div className="mb-2.5 flex items-baseline justify-between px-1">
          <h2 className="text-[16px] font-bold tracking-tight">Recharger</h2>
          <span className="mono-label text-foreground/35">10 € = 1 000 ⚽</span>
        </div>
        <Locked
          label="Bientôt"
          note="Le paiement n'est pas encore branché — tout se gagne en attendant : connexion, votes, duels."
        >
          <div className="grid grid-cols-2 gap-2.5">
            {RECHARGES.map((r) => (
              <div key={r.euros} className="glass rounded-[22px] px-4 py-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-[20px] leading-none font-extrabold tracking-tight tabular-nums">
                    {milliers(r.ballons)} ⚽
                  </span>
                  <span className="text-[14px] font-bold tabular-nums">{r.euros} €</span>
                </div>
                <p className="mono-label mt-2 text-foreground/40">
                  {r.bonus ? `+${r.bonus} offerts` : "Taux normal"}
                </p>
              </div>
            ))}
          </div>
        </Locked>
      </section>

      <Locked
        label="Bientôt"
        chipClassName="-top-9 right-0"
        note="Le textile ouvrira plus tard : stocks, tailles et livraison sont encore à caler."
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
                    {UNE.name}
                  </div>
                  <p className="mt-[5px] text-[13px] text-foreground/42">{UNE.note}</p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[22px] font-extrabold tracking-tight tabular-nums">
                    {milliers(ballonsPourEuros(UNE.euros))}
                  </div>
                  <div className="mono-label mt-[3px] text-primary">Ballons · {UNE.euros} €</div>
                </div>
              </div>
              <div className="mt-3.5 rounded-full bg-foreground py-[15px] text-center text-[15px] font-bold text-background">
                Échanger mes Ballons
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
                      {milliers(ballonsPourEuros(it.euros))}
                    </span>
                    <span className="mono-label text-primary">{it.euros} €</span>
                  </div>
                </div>
              </div>
            ))}
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
                  <span className="text-[17px] font-extrabold tabular-nums">
                    {milliers(ballonsPourEuros(63))}
                  </span>
                  <span className="mono-label text-primary">Ballons</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Locked>
    </div>
  );
}
