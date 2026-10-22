"use client";

// Ma carte — l'identité du joueur, rien d'autre.
//
// Ordre de lecture : qui je suis → ma carte (la simple) → mes badges (le
// prochain à viser, puis les trophées de fin de saison et les paliers, voir
// vitrine.tsx) → mes cartes, saison par saison, avec les cartes spéciales
// gagnées (carriere-joueur.tsx) → les raccourcis. La photo se change en
// touchant l'avatar.
//
// Le 22/10 (Sabri) : le profil de jeu (le radar) part sur le profil d'un
// joueur dans Recherche ; « Cartes de match » disparaît, les cartes gagnées
// sont ici, dans « Mes cartes » ; l'Arène n'est plus que la Collection.

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, Dumbbell, Layers, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { CartesCarriere } from "@/components/sfl/carriere-joueur";
import { ProfilePhoto } from "@/components/sfl/profile-photo";
import { VitrineBadges } from "@/components/sfl/vitrine";
import { ChoixBadge } from "@/components/sfl/choix-badge";
import { CarteOfficielle } from "@/components/sfl/carte-officielle";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { useGrandEcran } from "@/hooks/use-media-query";
import { FormulaireIdentite } from "@/components/sfl/identite";
import { useIdentites } from "@/hooks/use-identites";
import { cartesDeCarriere } from "@/lib/sfl/carriere";
import { rankPlayers } from "@/lib/sfl/engine";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonStats } from "@/components/layout/bouton-stats";

/* ------------------------------ Petits blocs ------------------------------ */

function AvatarPhoto({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const [broken, setBroken] = useState(false);
  return (
    <span className="glass-soft flex size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full text-[14px] font-bold">
      {broken ? (
        name[0]
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="size-full object-cover"
          // Le ref rattrape une image déjà en échec avant l'hydratation :
          // dans ce cas onError ne se redéclenche jamais.
          ref={(el) => {
            if (el && el.complete && el.naturalWidth === 0) setBroken(true);
          }}
          onError={() => setBroken(true)}
        />
      )}
    </span>
  );
}

export default function Profil() {
  const { player } = useMyPlayer();
  const { allPlayers, saison } = useSeason();
  // Sur sa propre fiche, on se classe parmi tout le monde — y compris les
  // joueurs masqués ailleurs dans l'app.
  const myRank =
    rankPlayers(allPlayers).find((p) => p.name === player.name)?.rank ?? allPlayers.length;
  // Mes cartes : celle de chaque saison et les cartes spéciales gagnées.
  const mesCartes = useMemo(() => cartesDeCarriere(saison, player.name), [saison, player.name]);
  // La carte est le sujet de la page : elle profite de la place quand il y en a.
  const grand = useGrandEcran();
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const identite = useIdentites();

  return (
    <div className="shell py-4 sm:py-8 lg:pt-[var(--fib-55)]">
      <div className="mb-[18px] flex items-center justify-between gap-3 lg:mb-[var(--fib-34)]">
        <h1 className="text-[30px] font-bold tracking-tight lg:text-[34px]">Ma carte</h1>
        <div className="flex items-center gap-2">
          <BoutonStats />
          <BoutonRecherche />
        </div>
      </div>
      {/* Deux colonnes dès qu'il y a la place, dans le rapport 1 : φ
          (grille-or, globals.css) : l'identité et la carte à gauche, les
          badges, les trophées, mes cartes et les raccourcis à droite. */}
      <div className="grille-or grid grid-cols-1 gap-[18px] lg:gap-y-[var(--fib-21)]">
      {/* La colonne d'identité reste à l'écran pendant qu'on parcourt le
          reste : la carte est le sujet de la page. */}
      <div className="flex min-w-0 flex-col gap-[18px] colonne-fixe lg:gap-[var(--fib-21)]">

      {/* Rangée d'identité : photo, nom, pseudo, menu réglages */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setPhotoOuverte(true)}
            aria-label="Changer ma photo"
            className="shrink-0 rounded-full"
          >
            <AvatarPhoto name={player.name} />
          </button>
          {/* Le nom et le pseudo se corrigent en les touchant (identite.tsx). */}
          <button
            type="button"
            onClick={() => setIdentiteOuverte(true)}
            aria-label="Modifier mon nom et mon pseudo"
            className="min-w-0 text-left"
          >
            <div className="truncate text-[19px] font-extrabold tracking-tight">{identite.nom(player.name)}</div>
            <div className="mt-0.5 truncate text-[12.5px] text-foreground/42">
              {`${identite.pseudo(player.name)} · ${player.poste} · ${myRank}e au Pépite d'Or`}
            </div>
          </button>
        </div>
        <Link
          href="/reglages"
          aria-label="Réglages"
          className="glass-soft flex size-[38px] shrink-0 flex-col items-center justify-center gap-[2.5px] rounded-full"
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-[3.5px] rounded-full bg-foreground/60" />
          ))}
        </Link>
      </div>

      {/* Ma carte */}
      <section className="flex flex-col items-center gap-3.5">
        <Card3D
          cacheKey={`profil-simple-${player.name}`}
          mode="simple"
          size={grand ? 1.15 : 0.88}
          render={(s) => <PlayerCard player={player} size={s} />}
        />
        <p className="mono-label text-center text-[9px] tracking-[0.12em] text-foreground/30">
          Glisse pour tourner · double-clic pour retourner
        </p>
      </section>

      {/* L'appel principal, pleine largeur juste sous la carte : la carte
          officielle (photo au maillot Bola). Puis l'historique et le badge. */}
      <CarteOfficielle player={player} className="-mt-1 w-full" />
      <div className="flex gap-[9px]">
        <Link
          href="/ligue?vue=matchs"
          className="glass-soft flex-1 rounded-full py-[15px] text-center text-[15px] font-semibold text-foreground/70"
        >
          Historique
        </Link>
        <ChoixBadge player={player} />
      </div>

      </div>

      <div className="flex min-w-0 flex-col gap-[18px] lg:gap-[var(--fib-21)]">
      {/* Mes badges : le prochain, la fin de saison, les paliers */}
      <div id="badges" className="scroll-mt-4">
        <VitrineBadges nom={player.name} />
      </div>

      {/* Mes cartes : la carte de chaque saison et les cartes spéciales gagnées */}
      {mesCartes.length > 0 && <CartesCarriere saisons={mesCartes} titre="Mes cartes" />}

      {/* Navigation du profil */}
      <section className="flex flex-col gap-2.5">
        {(
          [
            {
              href: "/palmares",
              icon: Trophy,
              label: "Wall of Fame",
              note: "Ton parcours, saison après saison",
            },
            {
              href: "/collection",
              icon: Layers,
              label: "Collection",
              note: "Packs et catalogue de cartes",
            },
          ] as const
        ).map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="glass-soft flex items-center gap-3.5 rounded-3xl p-4 transition-colors active:opacity-80"
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
          <div className="glass-soft flex items-center gap-3.5 rounded-3xl p-4">
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
      </div>

      {/* Le prénom, le nom, le pseudo et l'email : on y entre en touchant le nom */}
      <Sheet open={identiteOuverte} onOpenChange={setIdentiteOuverte}>
        <SheetContent side="bottom" className="mx-auto max-h-[92dvh] w-full overflow-y-auto rounded-t-[28px] px-6 pt-7 pb-8 sm:max-w-md">
          <SheetTitle className="sr-only">Mon nom et mon pseudo</SheetTitle>
          <FormulaireIdentite onFini={() => setIdentiteOuverte(false)} />
        </SheetContent>
      </Sheet>

      {/* La photo de profil, à part : on y entre en touchant l'avatar */}
      <Sheet open={photoOuverte} onOpenChange={setPhotoOuverte}>
        <SheetContent side="bottom" className="mx-auto w-full rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">Ma photo</SheetTitle>
          <ProfilePhoto name={player.name} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
