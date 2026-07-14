"use client";

// Collection — packs booster, catalogue de cartes numérotées et boutique.
// Économie 100% Ballons en v1 locale ; l'achat de Ballons en argent réel
// arrivera avec le backend (boutons "Bientôt" en attendant).

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { PackageOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PlayerCard } from "@/components/sfl/player-card";
import { BoostCard } from "@/components/sfl/boost-card";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useIsClient } from "@/hooks/use-is-client";
import { useBallons } from "@/hooks/use-ballons";
import { ovr, type BoostType } from "@/lib/sfl/engine";
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
  type CollectionCard,
} from "@/lib/sfl/collection";

const KIND_STYLES: Record<string, string> = {
  simple: "bg-secondary text-foreground",
  rare: "bg-[#F2CE7B]/15 text-[#c9962e] dark:text-[#E8C87A]",
  def: "bg-sky-500/12 text-sky-600 dark:text-sky-400",
  impact: "bg-primary/12 text-primary",
  mvp: "bg-[#F4C542]/20 text-[#a87b12] dark:text-[#F4C542]",
};

function CardReveal({ card, index }: { card: CollectionCard; index: number }) {
  const isSpecial = card.kind !== "simple" && card.kind !== "rare";
  return (
    <motion.div
      initial={{ opacity: 0, rotateY: 90, scale: 0.7 }}
      animate={{ opacity: 1, rotateY: 0, scale: 1 }}
      transition={{ delay: 0.25 + index * 0.35, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="flex shrink-0 flex-col items-center gap-1.5"
    >
      {isSpecial ? (
        <BoostCard
          card={{
            player: card.player.name,
            type: card.kind as BoostType,
            ovr: ovr(card.player.stats),
            poste: card.player.poste,
            date: "Hors-série",
            stats: card.player.stats,
          }}
          size={0.42}
        />
      ) : (
        <PlayerCard player={card.player} mode={card.kind === "rare" ? "rare" : "simple"} size={0.42} />
      )}
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
          KIND_STYLES[card.kind]
        )}
      >
        {KIND_LABELS[card.kind]} · n°{card.serial}/{card.total}
      </span>
    </motion.div>
  );
}

export default function CollectionPage() {
  const { me } = useMyPlayer();
  const isClient = useIsClient();
  const balance = useBallons(me);
  const [opened, setOpened] = useState<CollectionCard[] | null>(null);
  const [packSeq, setPackSeq] = useState(0);
  // tick de re-lecture après achat/ouverture (owned relu à chaque rendu)
  const [, setTick] = useState(0);

  const owned = isClient ? getOwned(me) : {};
  const uniqueOwned = Object.keys(owned).length;

  function handleOpenPack() {
    const cards = openPack(me);
    if (!cards) {
      toast.error("Pas assez de Ballons", {
        description: `Il faut ${PACK_COST} ⚽ pour ouvrir un pack.`,
      });
      return;
    }
    setOpened(cards);
    setPackSeq((n) => n + 1);
    const special = cards.find((c) => c.kind !== "simple" && c.kind !== "rare");
    if (special) {
      toast.success(`Carte hors-série ${KIND_LABELS[special.kind]} !`, {
        description: `${special.player.name} · n°${special.serial}/${special.total} — trouvaille rarissime`,
      });
    }
  }

  function handleBuy(card: CollectionCard) {
    if (buyCard(me, card.id)) {
      setTick((n) => n + 1);
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
            <div
              className="flex h-40 w-28 flex-col items-center justify-center gap-2 rounded-2xl"
              style={{
                background:
                  "radial-gradient(120% 130% at 30% 20%, #241A06 0%, #120C03 60%, #060402 100%)",
                boxShadow: "0 0 26px rgba(240,190,90,.25), inset 0 0 0 2px #F2CE7B44",
              }}
            >
              <Sparkles className="size-6 text-[#F2CE7B]" />
              <span className="font-display text-lg text-[#F2CE7B] italic">SFL</span>
              <span className="text-[10px] font-bold tracking-widest text-[#C9964A] uppercase">
                Booster ×{PACK_SIZE}
              </span>
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

          <AnimatePresence mode="wait">
            {opened && (
              <motion.div
                key={packSeq}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl bg-card p-4"
              >
                <p className="mb-3 px-1 text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
                  Ton tirage
                </p>
                <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {opened.map((card, i) => (
                    <CardReveal key={`${packSeq}-${i}`} card={card} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </TabsContent>

        {/* ===== CARTES ===== */}
        <TabsContent value="cartes" className="mt-4">
          <p className="mb-3 px-1 text-sm text-muted-foreground">
            <strong className="font-semibold text-foreground">
              {uniqueOwned}/{CATALOG.length}
            </strong>{" "}
            cartes différentes dans ta collection.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {CATALOG.map((card) => {
              const count = owned[card.id] ?? 0;
              const has = count > 0;
              return (
                <div
                  key={card.id}
                  className={cn(
                    "flex flex-col gap-1 rounded-2xl bg-card px-3.5 py-3",
                    !has && "opacity-45"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="truncate text-sm font-bold">{card.player.name}</span>
                    <span className="shrink-0 text-[10px] font-semibold text-muted-foreground tabular-nums">
                      n°{card.serial}/{card.total}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-bold uppercase",
                        KIND_STYLES[card.kind]
                      )}
                    >
                      {KIND_LABELS[card.kind]}
                    </span>
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      {has ? `×${count}` : "—"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
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
                  <div
                    key={card.id}
                    className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3"
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
                      <Button size="sm" variant="secondary" onClick={() => handleBuy(card)}>
                        {card.price.toLocaleString("fr-FR")} ⚽
                      </Button>
                    )}
                  </div>
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
