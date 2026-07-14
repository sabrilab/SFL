"use client";

// Collection — packs booster, catalogue de cartes numérotées (avec le
// vrai visuel de chaque carte, filtrable) et boutique. Économie 100%
// Ballons en v1 locale ; l'achat de Ballons en argent réel arrivera avec
// le backend (boutons "Bientôt" en attendant).

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { PackageOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/sfl/card-3d";
import { CollectionCardVisual } from "@/components/sfl/collection-card-visual";
import { PackOpening, PackVisual } from "@/components/sfl/pack-opening";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useBallons } from "@/hooks/use-ballons";
import {
  DAILY_DUEL_CAP,
  DAILY_DUEL_REWARD,
  DAILY_LOGIN_REWARD,
  DAILY_VOTE_REWARD,
} from "@/lib/sfl/ballons";
import {
  CATALOG,
  KIND_LABELS,
  PACK_COST,
  PACK_SIZE,
  buyCard,
  getOwned,
  openPack,
  type CardKind,
  type CollectionCard,
} from "@/lib/sfl/collection";

const KIND_STYLES: Record<string, string> = {
  simple: "bg-secondary text-foreground",
  rare: "bg-[#F2CE7B]/15 text-[#c9962e] dark:text-[#E8C87A]",
  def: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  impact: "bg-primary/12 text-primary",
  mvp: "bg-[#F4C542]/20 text-[#a87b12] dark:text-[#F4C542]",
};

const FILTERS: { id: CardKind | "all"; label: string }[] = [
  { id: "all", label: "Toutes" },
  { id: "simple", label: "Standard" },
  { id: "rare", label: "Rare" },
  { id: "def", label: "Défensive" },
  { id: "impact", label: "Impact" },
  { id: "mvp", label: "MVP" },
];

function CardModal({
  card,
  count,
  onOpenChange,
  onBuy,
}: {
  card: CollectionCard | null;
  count: number;
  onOpenChange: (open: boolean) => void;
  onBuy: (card: CollectionCard) => void;
}) {
  const has = count > 0;
  return (
    <Dialog open={card !== null} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-xs flex-col items-center gap-4 bg-transparent p-0 shadow-none ring-0">
        <DialogTitle className="sr-only">
          {card ? `${KIND_LABELS[card.kind]} ${card.player.name}` : "Carte"}
        </DialogTitle>
        {card && (
          <>
            <div className={cn("transition-opacity", !has && "opacity-40 grayscale")}>
              <Card3D
                cacheKey={card.id}
                mode={card.kind === "simple" ? "simple" : "rare"}
                size={1.15}
                render={(s) => <CollectionCardVisual card={card} size={s} />}
              />
            </div>
            <div className="flex flex-col items-center gap-2 rounded-3xl bg-card px-5 py-4 text-center">
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase",
                  KIND_STYLES[card.kind]
                )}
              >
                {KIND_LABELS[card.kind]}
              </span>
              <span className="text-lg font-bold">{card.player.name}</span>
              <span className="text-xs font-medium text-muted-foreground">
                n°{card.serial}/{card.total} {has && `· ×${count} en collection`}
              </span>
              {!has && (
                <Button size="sm" className="mt-1 font-semibold" onClick={() => onBuy(card)}>
                  Acheter · {card.price.toLocaleString("fr-FR")} ⚽
                </Button>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CollectionPage() {
  const { me } = useMyPlayer();
  const isClient = useIsClient();
  const balance = useBallons(me);
  const [opening, setOpening] = useState<CollectionCard[] | null>(null);
  const [filter, setFilter] = useState<CardKind | "all">("all");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selected, setSelected] = useState<CollectionCard | null>(null);
  // tick de re-lecture après achat/ouverture (owned relu à chaque rendu)
  const [, setTick] = useState(0);

  const owned = isClient ? getOwned(me) : {};
  const uniqueOwned = Object.keys(owned).length;

  const filtered = CATALOG.filter((c) => filter === "all" || c.kind === filter).filter(
    (c) => !ownedOnly || (owned[c.id] ?? 0) > 0
  );

  function handleOpenPack() {
    const cards = openPack(me);
    if (!cards) {
      toast.error("Pas assez de Ballons", {
        description: `Il faut ${PACK_COST} ⚽ pour ouvrir un pack.`,
      });
      return;
    }
    // La cérémonie plein écran prend le relais, récap "Ton tirage" en 3D inclus.
    setOpening(cards);
    setTick((n) => n + 1);
  }

  function finishOpening() {
    if (!opening) return;
    const special = opening.find((c) => c.kind !== "simple" && c.kind !== "rare");
    if (special) {
      toast.success(`Carte hors-série ${KIND_LABELS[special.kind]} !`, {
        description: `${special.player.name} · n°${special.serial}/${special.total} — trouvaille rarissime`,
      });
    }
    setOpening(null);
  }

  function handleBuy(card: CollectionCard) {
    if (buyCard(me, card.id)) {
      setTick((n) => n + 1);
      setSelected(null);
      toast.success(`${KIND_LABELS[card.kind]} ${card.player.name} ajoutée à ta collection`, {
        description: `−${card.price} ⚽`,
      });
    } else {
      toast.error("Pas assez de Ballons", {
        description: `Cette carte coûte ${card.price} ⚽.`,
      });
    }
  }

  const specials = CATALOG.filter((c) => c.kind !== "simple" && c.kind !== "rare");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 py-4 sm:py-8">
      <AnimatePresence>
        {opening && <PackOpening cards={opening} onDone={finishOpening} />}
      </AnimatePresence>

      <div>
        <p className="text-[13px] font-medium text-muted-foreground">
          {isClient ? `${balance} Ballons disponibles` : "Ballons"}
        </p>
        <h1 className="text-[34px] font-bold tracking-tight">Collection</h1>
      </div>

      {/* Comment gagner des Ballons */}
      <div className="overflow-hidden rounded-3xl bg-card text-sm">
        {[
          [`Connexion du jour`, `+${DAILY_LOGIN_REWARD} ⚽`],
          [`Premier vote du jour (figures de match)`, `+${DAILY_VOTE_REWARD} ⚽`],
          [`Terminer ses ${DAILY_DUEL_CAP} duels du jour`, `+${DAILY_DUEL_REWARD} ⚽`],
        ].map(([label, gain], i) => (
          <div
            key={label}
            className={cn(
              "flex items-center justify-between px-5 py-3",
              i < 2 && "border-b border-border/60"
            )}
          >
            <span className="font-medium">{label}</span>
            <span className="font-bold text-primary tabular-nums">{gain}</span>
          </div>
        ))}
      </div>

      <Tabs defaultValue="packs">
        <TabsList className="w-full rounded-full bg-card p-1 dark:bg-card">
          <TabsTrigger value="packs" className="flex-1 rounded-full">
            Packs
          </TabsTrigger>
          <TabsTrigger value="cartes" className="flex-1 rounded-full">
            Cartes
          </TabsTrigger>
          <TabsTrigger value="boutique" className="flex-1 rounded-full">
            Boutique
          </TabsTrigger>
        </TabsList>

        {/* ===== PACKS ===== */}
        <TabsContent value="packs" className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-card p-6">
            <div className="flex h-[159px] w-[109px] items-center justify-center overflow-visible">
              <div className="scale-[0.62]">
                <PackVisual />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground">
              {PACK_SIZE} cartes par pack — Standard, Rare, et une chance infime de
              tomber sur une hors-série Défensive, Impact ou MVP.
            </p>
            <Button
              size="lg"
              onClick={handleOpenPack}
              disabled={!isClient || balance < PACK_COST}
              className="w-full max-w-xs font-semibold"
            >
              <PackageOpen /> Ouvrir un pack · {PACK_COST} ⚽
            </Button>
            {isClient && balance < PACK_COST && (
              <p className="text-xs text-muted-foreground">
                Il te manque {PACK_COST - balance} ⚽ — reviens après tes duels du jour.
              </p>
            )}
          </div>
        </TabsContent>

        {/* ===== CARTES ===== */}
        <TabsContent value="cartes" className="mt-4 flex flex-col gap-3">
          <p className="px-1 text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {uniqueOwned}/{CATALOG.length}
            </strong>{" "}
            cartes différentes dans ta collection. Touche une carte pour la voir en grand
            et la manipuler.
          </p>

          <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                  filter === f.id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
            <button
              onClick={() => setOwnedOnly((v) => !v)}
              className={cn(
                "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors",
                ownedOnly
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              Possédées
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {filtered.map((card) => {
              const count = owned[card.id] ?? 0;
              const has = count > 0;
              return (
                <button
                  key={card.id}
                  onClick={() => setSelected(card)}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-2 py-3 text-center transition-transform active:scale-95"
                >
                  <div className={cn("transition-opacity", !has && "opacity-30 grayscale")}>
                    <CollectionCardVisual card={card} size={0.32} />
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
                    n°{card.serial}/{card.total}
                  </span>
                  {has && count > 1 && (
                    <span className="rounded-full bg-primary/12 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                      ×{count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="rounded-3xl bg-card px-6 py-10 text-center text-sm text-muted-foreground">
              Aucune carte pour ce filtre.
            </div>
          )}

          <CardModal
            card={selected}
            count={selected ? (owned[selected.id] ?? 0) : 0}
            onOpenChange={(open) => !open && setSelected(null)}
            onBuy={handleBuy}
          />
        </TabsContent>

        {/* ===== BOUTIQUE ===== */}
        <TabsContent value="boutique" className="mt-4 flex flex-col gap-5">
          <section>
            <h2 className="mb-2 px-1 text-lg font-semibold tracking-tight">
              Cartes hors-série
            </h2>
            <p className="mb-3 px-1 text-sm text-muted-foreground">
              Les pièces maîtresses de la collection, numérotées au-delà du
              catalogue. Achat direct pour les plus déterminés.
            </p>
            <div className="flex flex-col gap-1.5">
              {specials.map((card) => {
                const has = (owned[card.id] ?? 0) > 0;
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelected(card)}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left"
                  >
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        KIND_STYLES[card.kind]
                      )}
                    >
                      {KIND_LABELS[card.kind]}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">
                      {card.player.name}
                      <span className="ml-1.5 text-[10px] font-semibold text-muted-foreground">
                        n°{card.serial}/{card.total}
                      </span>
                    </span>
                    {has ? (
                      <span className="text-xs font-semibold text-emerald-500">Obtenue ✓</span>
                    ) : (
                      <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold">
                        {card.price.toLocaleString("fr-FR")} ⚽
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-2 px-1 text-lg font-semibold tracking-tight">
              Packs de Ballons
            </h2>
            <p className="mb-3 px-1 text-sm text-muted-foreground">
              Pour compléter ta collection plus vite. Paiement réel disponible
              avec la prochaine version.
            </p>
            <div className="grid grid-cols-3 gap-2">
              {[
                [100, "0,99 €"],
                [550, "4,99 €"],
                [1200, "9,99 €"],
              ].map(([amount, price]) => (
                <div
                  key={amount}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-card px-3 py-4"
                >
                  <span className="text-xl font-bold tabular-nums">{amount} ⚽</span>
                  <span className="text-xs text-muted-foreground">{price}</span>
                  <Button size="sm" variant="secondary" disabled className="mt-1 w-full">
                    Bientôt
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
