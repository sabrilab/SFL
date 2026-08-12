"use client";

// Section Boutique — réplique de l'écran « BOUTIQUE matte » du design de
// référence : catégories en pilules, un produit à la une, la grille des
// articles, et le drop de la semaine.
//
// LES PRODUITS D'ABORD. Les prix des Ballons, les paliers de recharge et le
// tarif des cartes ne s'étalent plus en vitrine : ils vivent derrière le
// bouton « Acheter des Ballons ». On entre dans une boutique pour regarder
// des maillots, pas pour lire une grille tarifaire.
//
// Les prix ne sont pas écrits à la main : chaque article porte son prix de
// vente en euros, et la boutique le convertit au taux de la ligue (1 Ballon =
// 1 centime, cf. ballons.ts). La marge se décide donc une seule fois, en
// fixant le prix en euros — le prix en Ballons suit tout seul.
//
// Le textile reste verrouillé : paiement, stocks et tailles ne sont pas
// branchés. Les recharges aussi, tant qu'il n'y a pas de paiement.

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useBallons } from "@/hooks/use-ballons";
import { BALLONS_PAR_EURO, RECHARGES, ballonsPourEuros } from "@/lib/sfl/ballons";
import { CARD_PRICES } from "@/lib/sfl/collection";

const CATS = ["Tout", "Maillots", "Survêts", "Montres", "Accessoires"] as const;

/** Prix de vente en euros — le prix en Ballons en découle. */
const UNE = { name: "Maillot SFL · domicile", note: "Floqué à ton nom et ton numéro", euros: 29 };

const ITEMS = [
  { tag: "SURVÊT", name: "Survêt club · veste + bas", euros: 44 },
  { tag: "MONTRE", name: "Montre SFL · série verte", euros: 63 },
  { tag: "CHAUSSETTES", name: "Chaussettes match · lot de 3", euros: 9 },
  { tag: "SAC", name: "Sac de sport · logo brodé", euros: 21 },
];

const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const euros = (ballons: number) => (ballons / BALLONS_PAR_EURO).toFixed(2).replace(".", ",");

/* ------------------------- Le guichet des Ballons ------------------------- */

function GuichetBallons({
  ouvert,
  onOpenChange,
}: {
  ouvert: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={ouvert} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogTitle className="text-[20px] font-bold tracking-tight">
          Acheter des Ballons
        </DialogTitle>
        <p className="-mt-1 text-[13px] leading-snug text-foreground/45">
          La monnaie de la ligue, au taux de <b className="font-semibold text-foreground/70">10 €
          pour 1 000 ⚽</b>. Tout se gagne aussi en jouant : connexion, votes, duels, convocation,
          compositions.
        </p>

        {/* La ligne de titre reste libre à droite : c'est là que se pose la
            pastille « Bientôt », sinon elle recouvrait un palier de recharge. */}
        <span className="mono-label mt-1 text-primary">Les recharges</span>
        <Locked
          label="Bientôt"
          chipClassName="-top-7 right-0"
          note="Le paiement n'est pas encore branché — tout se gagne en attendant."
        >
          <div className="grid grid-cols-2 gap-2.5">
            {RECHARGES.map((r) => (
              <div key={r.euros} className="glass rounded-[20px] px-3.5 py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[18px] leading-none font-extrabold tracking-tight tabular-nums">
                    {milliers(r.ballons)} ⚽
                  </span>
                  <span className="text-[13px] font-bold tabular-nums">{r.euros} €</span>
                </div>
                <p className="mono-label mt-1.5 text-foreground/40">
                  {r.bonus ? `+${r.bonus} offerts` : "Taux normal"}
                </p>
              </div>
            ))}
          </div>
        </Locked>

        {/* Ce que les Ballons achètent — informatif, pas en vitrine */}
        <div className="mt-1 border-t border-white/8 pt-3.5">
          <p className="mono-label text-foreground/35">Ce qu&apos;ils achètent</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {(
              [
                ["Carte Standard", CARD_PRICES.simple],
                ["Carte Rare", CARD_PRICES.rare],
                ["Carte Défensive", CARD_PRICES.def],
                ["Carte Impact", CARD_PRICES.impact],
                ["Carte MVP", CARD_PRICES.mvp],
              ] as const
            ).map(([label, prix]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium">{label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="mono-label text-foreground/25">{euros(prix)} €</span>
                  <span className="font-bold tabular-nums">{prix} ⚽</span>
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/duel?mode=collection"
            className="glass-soft mt-3.5 block rounded-full py-2.5 text-center text-[13.5px] font-semibold text-foreground/70"
          >
            Voir le catalogue de cartes
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* --------------------------------- l'écran -------------------------------- */

export default function Boutique() {
  const { player } = useMyPlayer();
  const ballons = useBallons(player.name);
  const [guichet, setGuichet] = useState(false);

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-bold tracking-tight">Boutique</h1>
          <p className="mt-1 text-[13px] text-foreground/42">
            Maillots, survêts, montres · payables en Ballons
          </p>
        </div>
      </div>

      {/* Le petit espace des Ballons : le solde, et de quoi en avoir plus.
          Une ligne, pas une devanture. */}
      <div className="glass-soft flex items-center justify-between gap-2 rounded-full py-2 pr-2 pl-4">
        <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-[17px] font-extrabold tabular-nums">{milliers(ballons)}</span>
          <span className="text-[13px]">⚽</span>
          <span className="mono-label truncate text-foreground/35">Ballons</span>
        </span>
        <button
          onClick={() => setGuichet(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3.5 py-2 text-[13px] font-bold whitespace-nowrap text-background transition-transform active:scale-95"
        >
          <Plus className="size-3.5" strokeWidth={3} />
          {/* Le libellé entier ne tient pas à côté d'un solde à cinq chiffres sur
              390 px : il s'abrège plutôt que de casser la pilule en deux lignes. */}
          {/* Deux libellés entiers plutôt qu'une phrase coupée en deux : le gap
              du flex s'ajouterait à l'espace du texte et « des » se décollerait. */}
          <span className="sm:hidden">Acheter</span>
          <span className="hidden sm:inline">Acheter des Ballons</span>
        </button>
      </div>

      <GuichetBallons ouvert={guichet} onOpenChange={setGuichet} />

      {/* ------------------------- Les produits ------------------------- */}
      {/* La pastille « Bientôt » se pose sur cette ligne de titre : au-dessus du
          bloc elle retombait sur le bouton d'achat, dedans elle recouvrait les
          catégories. */}
      <div className="relative mt-1">
        <h2 className="mb-2.5 px-1 text-[17px] font-bold tracking-tight">Le rayon</h2>
        <Locked
          label="Bientôt"
          chipClassName="-top-8 right-1"
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
            <div className="glass overflow-hidden rounded-[26px] lg:flex lg:items-stretch">
              <div
                className="relative lg:w-[46%] lg:shrink-0"
                style={{
                  minHeight: 210,
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
              <div className="flex flex-1 flex-col justify-center p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[19px] leading-[1.25] font-bold tracking-tight">
                      {UNE.name}
                    </div>
                    <p className="mt-[5px] text-[13px] text-foreground/42">{UNE.note}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[22px] font-extrabold tracking-tight tabular-nums">
                      {milliers(ballonsPourEuros(UNE.euros))}
                    </div>
                    <div className="mono-label mt-[3px] text-primary">Ballons</div>
                  </div>
                </div>
                <div className="mt-3.5 rounded-full bg-foreground py-[15px] text-center text-[15px] font-bold text-background">
                  Échanger mes Ballons
                </div>
              </div>
            </div>

            {/* La grille */}
            <div className="grid grid-cols-2 gap-[11px] lg:grid-cols-4">
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
                    <div className="text-[14px] leading-[1.3] font-bold tracking-tight">
                      {it.name}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between">
                      <span className="text-[16px] font-extrabold tracking-tight tabular-nums">
                        {milliers(ballonsPourEuros(it.euros))}
                      </span>
                      <span className="mono-label text-primary">Ballons</span>
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
    </div>
  );
}
