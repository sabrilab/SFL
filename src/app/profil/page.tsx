"use client";

// Ma carte — le joueur, sa saison, sa progression.
//
// La deuxième page la plus vue de l'app. Sabri, le 22/10 : qu'elle « donne
// plus envie, qu'on comprenne mieux les choses et que ce soit mieux rangé »,
// comme le profil d'un joueur ouvert depuis la Recherche (profil-joueur.tsx),
// dont elle reprend l'ordre de lecture, du plus fort au plus fin :
//   1. moi : ma carte en grand, mon nom en Anton, trois chiffres de tête (mon
//      rang au Pépite d'Or, ma note, mes dimanches), puis la phrase qui me
//      résume (fiche-joueur.ts, la même que sur mon profil). Le nom se
//      corrige en le touchant (identite.tsx). Dessous, ma photo (la toucher
//      ouvre « Ma photo »), la carte officielle et le badge de ma carte ;
//   2. ma saison : mon dernier dimanche en grand, mes points forts, mes
//      autres dimanches (ma-saison.tsx) ;
//   3. mon évolution : mon rang au Pépite d'Or ou la note de ma carte,
//      journée après journée (carriere-joueur.tsx) ;
//   4. mes badges : le prochain à viser, les trophées de fin de saison et
//      les paliers (vitrine.tsx) ;
//   5. mes cartes, saison par saison, avec les cartes spéciales gagnées ;
//   6. les raccourcis.
// « Historique » est parti : chaque dimanche de Ma saison ouvre son récap. Le
// rappel « Glisse pour tourner » aussi, comme sur le profil. Les réglages
// (« ⋯ ») sont en haut, à côté de la loupe.
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
import { CartesCarriere, CourbeCarriere } from "@/components/sfl/carriere-joueur";
import { MaSaison, type RangDuJour } from "@/components/sfl/ma-saison";
import { Chiffre } from "@/components/sfl/profil-joueur";
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
import { cartesDeCarriere, courbeDeCarriere } from "@/lib/sfl/carriere";
import { ovr, rankPlayers } from "@/lib/sfl/engine";
import { dimanchesDe, ficheJoueur } from "@/lib/sfl/fiche-joueur";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { isHidden } from "@/lib/sfl/hidden";
import { POSTES } from "@/lib/sfl/inscription";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonStats } from "@/components/layout/bouton-stats";

const ANTON = "var(--font-anton), Anton, sans-serif";

/* ------------------------------ Petits blocs ------------------------------ */

function AvatarPhoto({ name }: { name: string }) {
  const src = usePlayerPhoto(name);
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-foreground/10 text-[14px] font-bold">
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
  // Mon rang : celui du classement de la Ligue (sans les joueurs masqués),
  // où je figure toujours, même masqué.
  const myRank = useMemo(
    () =>
      rankPlayers(allPlayers.filter((p) => !isHidden(p.name) || p.name === player.name)).find((p) => p.name === player.name)
        ?.rank ?? null,
    [allPlayers, player.name]
  );
  // Mes cartes : celle de chaque saison et les cartes spéciales gagnées.
  const mesCartes = useMemo(() => cartesDeCarriere(saison, player.name), [saison, player.name]);
  const fiche = useMemo(() => ficheJoueur(saison, player, allPlayers), [saison, player, allPlayers]);
  const dimanches = useMemo(() => dimanchesDe(saison, player.name), [saison, player.name]);
  const joues = dimanches.filter((d) => !d.horsMatch).length;
  const courbe = useMemo(() => courbeDeCarriere(saison, player.name), [saison, player.name]);
  // Ma place au Pépite d'Or après chaque journée de la saison, et les places
  // gagnées ou perdues depuis la précédente : la courbe les a déjà.
  const rangs = useMemo(() => {
    const m = new Map<number, RangDuJour>();
    let avant: number | null = null;
    for (const p of courbe) {
      if (p.saison !== (saison.numero ?? 0)) continue;
      m.set(p.j, { rang: p.rang, ecart: avant != null && p.rang != null ? avant - p.rang : null });
      avant = p.rang;
    }
    return m;
  }, [courbe, saison.numero]);
  // La carte est le sujet de la page : elle profite de la place quand il y en a.
  const grand = useGrandEcran();
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const identite = useIdentites();
  const poste = POSTES.find((p) => p.id === player.poste)?.label ?? player.poste;

  return (
    <div className="shell py-4 sm:py-8 lg:pt-[var(--fib-55)]">
      <div className="relative z-10 mb-[18px] flex items-center justify-between gap-3 lg:mb-[var(--fib-34)]">
        <h1 className="text-[30px] font-bold tracking-tight lg:text-[34px]">Ma carte</h1>
        <div className="flex items-center gap-2">
          <BoutonStats />
          <BoutonRecherche />
          <Link
            href="/reglages"
            aria-label="Réglages"
            className="bouton-secondaire flex size-11 shrink-0 items-center justify-center gap-[3px]"
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-[4px] rounded-full bg-foreground/70" />
            ))}
          </Link>
        </div>
      </div>
      {/* Deux colonnes dès qu'il y a la place, dans le rapport 1 : φ
          (grille-or, globals.css) : moi à gauche, ma saison et le reste à
          droite. */}
      <div className="grille-or grid grid-cols-1 gap-[var(--fib-21)]">
        {/* 1. Moi. La colonne reste à l'écran pendant qu'on parcourt le
            reste : la carte est le sujet de la page. */}
        <div className="colonne-fixe flex min-w-0 flex-col items-center gap-[var(--fib-21)]">
          {/* Le cadre de la 3D garde autour de la carte de quoi la tourner :
              ses bords vides passent un peu sous le titre et sous mon nom,
              qui restent au-dessus (relative) et se touchent normalement. */}
          <div className="-mt-[var(--fib-21)] -mb-[var(--fib-34)]">
            <Card3D
              cacheKey={`profil-simple-${player.name}`}
              mode="simple"
              size={grand ? 1.15 : 1}
              render={(s) => <PlayerCard player={player} size={s} />}
            />
          </div>
          <button
            type="button"
            onClick={() => setIdentiteOuverte(true)}
            aria-label={`${identite.nom(player.name)}, ${identite.pseudo(player.name)}. Modifier mon nom et mon pseudo`}
            className="relative flex w-full flex-col items-center gap-[var(--fib-8)] text-center"
          >
            <span style={{ fontFamily: ANTON }} className="text-[44px] leading-[0.92] tracking-[0.3px] break-words uppercase">
              {identite.nom(player.name)}
            </span>
            <span className="font-mono text-[12px] text-foreground/45">
              {identite.pseudo(player.name)} · {poste.toLowerCase()}
            </span>
          </button>
          <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
            <Chiffre valeur={myRank != null && (joues > 0 || player.pp !== 0) ? ordinal(myRank) : "–"} quoi="Pépite d'Or" />
            <Chiffre valeur={ovr(player.stats)} quoi="Général" />
            <Chiffre valeur={joues} quoi={joues > 1 ? "Dimanches" : "Dimanche"} />
          </div>
          <p className="w-full text-[19px] leading-[1.25] font-bold tracking-[-0.4px]">{fiche.synthese}</p>
          {/* Ma photo, ma carte officielle (photo au maillot Bola), le badge de ma carte. */}
          <div className="flex w-full items-center gap-[9px]">
            <button
              type="button"
              onClick={() => setPhotoOuverte(true)}
              aria-label="Ma photo"
              className="bouton-secondaire bouton--or flex size-[52px] shrink-0 items-center justify-center"
            >
              <AvatarPhoto name={player.name} />
            </button>
            <CarteOfficielle player={player} className="min-w-0 flex-1" />
            <ChoixBadge player={player} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-[var(--fib-21)]">
          {/* 2. Ma saison : mon dernier dimanche, mes points forts, mes dimanches */}
          <MaSaison saison={`Saison ${saison.numero ?? 0}`} dimanches={dimanches} forts={fiche.forts} rangs={rangs} />

          {/* 3. Mon évolution, journée après journée : d'abord mon rang, si
              j'en ai un cette saison */}
          <CourbeCarriere points={courbe} depart={joues > 0 ? "rang" : "note"} />

          {/* 4. Mes badges : le prochain, la fin de saison, les paliers */}
          <div id="badges" className="scroll-mt-4">
            <VitrineBadges nom={player.name} />
          </div>

          {/* 5. Mes cartes : la carte de chaque saison et les cartes spéciales gagnées */}
          {mesCartes.length > 0 && <CartesCarriere saisons={mesCartes} titre="Mes cartes" />}

          {/* 6. Les raccourcis */}
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

      {/* La photo de profil, à part : on y entre en touchant la photo */}
      <Sheet open={photoOuverte} onOpenChange={setPhotoOuverte}>
        <SheetContent side="bottom" className="mx-auto w-full rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">Ma photo</SheetTitle>
          <ProfilePhoto name={player.name} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
