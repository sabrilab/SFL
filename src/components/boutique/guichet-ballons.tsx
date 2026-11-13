"use client";

// Le guichet des Ballons, tel qu'il était sur l'ancienne boutique (les
// recharges sous « Bientôt », ce que les Ballons achètent, le lien vers le
// catalogue de cartes), déplacé ici le 12/11/2026 : il ne s'étale plus en
// vitrine, il s'ouvre depuis la petite entrée de l'en-tête (en-tete.tsx).
// Ses textes n'ont pas bougé ; son bouton a quitté l'or pour le ton neutre :
// dans la boutique, l'or reste aux cartes MVP. Le lien vers le catalogue de
// cartes n'est montré qu'à un joueur de la SFL : la Collection est fermée
// aux joueurs Bola (porte-sfl.tsx), le lien les renvoyait à Ma carte.
//
// Les recharges restent verrouillées tant qu'aucun paiement n'est branché.

import Link from "next/link";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Locked } from "@/components/sfl/locked";
import { useHorsSflEtat } from "@/hooks/use-hors-sfl";
import { BALLONS_PAR_EURO, RECHARGES } from "@/lib/sfl/ballons";
import { CARD_PRICES } from "@/lib/sfl/collection";

export const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const euros = (ballons: number) => (ballons / BALLONS_PAR_EURO).toFixed(2).replace(".", ",");

export function GuichetBallons({
  ouvert,
  onOpenChange,
}: {
  ouvert: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const sfl = useHorsSflEtat() === false;
  return (
    <Dialog open={ouvert} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto">
        <DialogTitle className="text-titre-fort font-bold tracking-tight">
          Acheter des Ballons
        </DialogTitle>
        <p className="-mt-1 text-corps leading-snug text-encre-3">
          La monnaie de la ligue, au taux de <b className="font-semibold text-encre-2">10 €
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
                  <span className="text-titre-fort leading-none font-extrabold tracking-tight tabular-nums">
                    {milliers(r.ballons)} ⚽
                  </span>
                  <span className="text-corps font-bold tabular-nums">{r.euros} €</span>
                </div>
                <p className="mono-label mt-1.5 text-encre-3">
                  {r.bonus ? `+${r.bonus} offerts` : "Taux normal"}
                </p>
              </div>
            ))}
          </div>
        </Locked>

        {/* Ce que les Ballons achètent — informatif, pas en vitrine */}
        <div className="mt-1 border-t border-contraste/8 pt-3.5">
          <p className="mono-label text-encre-4">Ce qu&apos;ils achètent</p>
          <div className="mt-2.5 flex flex-col gap-1.5">
            {(
              [
                ["Carte Standard", CARD_PRICES.simple],
                ["Carte Défensive", CARD_PRICES.def],
                ["Carte Impact", CARD_PRICES.impact],
                ["Carte MVP", CARD_PRICES.mvp],
              ] as const
            ).map(([label, prix]) => (
              <div key={label} className="flex items-baseline justify-between gap-3 text-corps">
                <span className="font-medium">{label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="mono-label text-encre-4">{euros(prix)} €</span>
                  <span className="font-bold tabular-nums">{prix} ⚽</span>
                </span>
              </div>
            ))}
          </div>
          {sfl && (
            <Link
              href="/collection"
              className="bouton-secondaire mt-3.5 block py-2.5 text-center text-ligne font-semibold"
            >
              Voir le catalogue de cartes
            </Link>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
