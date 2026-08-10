"use client";

// Section Profil — le hub du joueur : sa carte, sa collection, ses duels,
// ses réglages, et l'entrée (verrouillée) vers les épreuves.
// Les écrans existants restent leurs propres pages ; ici on oriente.

import Link from "next/link";
import {
  ChevronRight,
  Dumbbell,
  IdCard,
  Package,
  Settings,
  Swords,
} from "lucide-react";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { ProfilePhoto } from "@/components/sfl/profile-photo";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { ovr, rankPlayers } from "@/lib/sfl/engine";

const LINKS = [
  { href: "/carte", icon: IdCard, label: "Ma carte", note: "Carte, boosts et évolution EvoDay" },
  { href: "/collection", icon: Package, label: "Collection", note: "Packs, cartes à collectionner, Ballons" },
  { href: "/duel", icon: Swords, label: "Arène", note: "Duels de cartes et simulation de match" },
  { href: "/reglages", icon: Settings, label: "Réglages", note: "Thème, profil et préférences" },
] as const;

export default function Profil() {
  const { player } = useMyPlayer();
  const { players, boostCards } = useSeason();
  const myRank = rankPlayers(players).find((p) => p.name === player.name)?.rank ?? players.length;
  const myBoosts = boostCards.filter((c) => c.player === player.name).length;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-4 sm:py-8">
      <div>
        <h1 className="text-[30px] font-bold tracking-tight">Profil</h1>
        <p className="text-sm text-muted-foreground">
          {player.poste} · #{myRank} au Pépite d&apos;Or · OVR {ovr(player.stats)}
        </p>
      </div>

      {/* Identité : photo + carte côte à côte */}
      <section className="rounded-3xl bg-card p-4">
        <ProfilePhoto name={player.name} />
      </section>

      <section className="flex items-center gap-4">
        <Card3D
          cacheKey={`profil-${player.name}`}
          mode="rare"
          size={0.55}
          render={(s) => <PlayerCard player={player} mode="rare" size={s} />}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          {(
            [
              ["Points Pépite", `${player.pp} pts`],
              ["Buts · Passes", `${player.buts} · ${player.passes}`],
              ["Matchs joués", `${player.matchs}`],
              ["Cartes boost", `${myBoosts}`],
            ] as const
          ).map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-2 border-b border-border/50 pb-2 last:border-0"
            >
              <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
              <span className="text-lg font-bold tracking-tight tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Navigation du profil */}
      <section className="flex flex-col gap-2.5">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex items-center gap-3.5 rounded-3xl bg-card p-4 transition-colors hover:bg-accent active:opacity-80"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/10">
              <l.icon className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">{l.label}</span>
              <span className="block text-[13px] text-muted-foreground">{l.note}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}

        {/* Les épreuves — verrouillées : les défis filmés qui rempliront la
            carte critère par critère arrivent avec la V2. */}
        <Locked label="Bientôt">
          <div className="flex items-center gap-3.5 rounded-3xl bg-card p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-foreground/10">
              <Dumbbell className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold">Les épreuves</span>
              <span className="block text-[13px] text-muted-foreground">
                Jonglage, sprint… tes stats mesurées sur le terrain
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </Locked>
      </section>
    </div>
  );
}
