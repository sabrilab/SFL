"use client";

// Ma carte — le joueur, sa saison, sa progression.
//
// La deuxième page la plus vue de l'app. Sabri, le 22/10 : qu'elle « donne
// plus envie, qu'on comprenne mieux les choses et que ce soit mieux rangé »,
// comme le profil d'un joueur ouvert depuis la Recherche (profil-joueur.tsx),
// dont elle reprend l'ordre de lecture, du plus fort au plus fin :
//   1. moi : ma carte en grand (la toucher l'ouvre en plein écran, pour la
//      manipuler : carte-en-grand.tsx, Sabri, 24/10), mon nom dans le lettrage de la Map, mon
//      équipe de Bola Team qui mène à sa page (equipe/equipe-du-joueur.tsx,
//      24/10), mes abonnés comme sur Instagram (mes abonnés et mes abonnements, « Kader,
//      Anis et 32 autres te suivent » : suivre.tsx ; Sabri, 23/10), trois
//      chiffres de tête en Anton (mon rang au Pépite d'Or, ma note, mes
//      dimanches), puis la phrase qui me résume (fiche-joueur.ts, la même que
//      sur mon profil). Le nom se corrige en le touchant (identite.tsx).
//      Dessous, ma photo (la toucher ouvre « Ma photo »), la carte officielle
//      tant qu'elle n'est pas faite (carte-officielle.tsx ; ensuite, on la
//      refait depuis « Ma photo ») et le badge de ma carte ; enfin
//      « Personnaliser ma carte » (le skin, les signes et le badge, au choix :
//      personnaliser-carte.tsx, 24/10), puis « Inviter », mon lien de
//      parrainage (parrainage/page.tsx, 24/10) ;
//   2. le reste, en résumé (Sabri, 24/10 : « plus agréable à parcourir » ;
//      « si on veut approfondir dans une rubrique, on puisse y aller ») : une
//      liste groupée comme les Réglages d'un iPhone, une rangée par rubrique,
//      qui ouvre sa page enfant (ma-carte/rubriques.tsx) : ma saison
//      (/profil/saison), mon Niveau XP et le Passe Bola (/profil/xp), mon
//      évolution (/profil/evolution), mes badges et trophées
//      (/profil/badges), mes cartes (/profil/cartes) ;
//   3. « Se déconnecter », tout en bas, comme dans toute app
//      (bouton-deconnexion.tsx ; Sabri, le 22/10 : « plus accessible »).
// Le Wall of Fame est parti dans les Actus, où il est l'époque la plus
// longue, et la Collection est masquée pour l'instant (Sabri, 24/10 ;
// /palmares et /collection restent). Les épreuves sont cachées aussi (Sabri,
// 24/10 : « cache les épreuves dans ma carte ») : plus d'encart « Bientôt »,
// ni de liste dans le Passe Bola (passe-bola.tsx).
// « Historique » est parti : chaque dimanche de Ma saison ouvre son récap. Le
// rappel « Glisse pour tourner » aussi, comme sur le profil. Les réglages
// (« ⋯ ») sont en haut, à côté de la loupe et du rond qui passe l'app en
// clair ou en sombre (bouton-theme.tsx, 23/10).
//
// Le 22/10 (Sabri) : le profil de jeu (le radar) part sur le profil d'un
// joueur dans Recherche ; « Cartes de match » disparaît, les cartes gagnées
// sont ici, dans « Mes cartes » ; l'Arène n'est plus que la Collection.

import Link from "next/link";
import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card3DEnGrand } from "@/components/sfl/carte-en-grand";
import { PlayerCard } from "@/components/sfl/player-card";
import { Chiffre } from "@/components/sfl/profil-joueur";
import { ReseauJoueur } from "@/components/sfl/suivre";
import { AppartenancesJoueur } from "@/components/sfl/badge-sfl";
import { ProfilePhoto } from "@/components/sfl/profile-photo";
import { ChoixBadge } from "@/components/sfl/choix-badge";
import { PersonnaliserCarte } from "@/components/sfl/personnaliser-carte";
import { CarteOfficielle } from "@/components/sfl/carte-officielle";
import { RubriquesMaCarte, useMaCarte } from "@/components/sfl/ma-carte/rubriques";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { useGrandEcran, useTresGrandEcran } from "@/hooks/use-media-query";
import { RACINE_PHI } from "@/hooks/use-format-carte";
import { useDivision } from "@/hooks/use-division";
import { nomDivision } from "@/lib/sfl/divisions";
import { FormulaireIdentite } from "@/components/sfl/identite";
import { useIdentites } from "@/hooks/use-identites";
import { useRangXp, useXp } from "@/hooks/use-missions";
import { ovr, rankPlayers } from "@/lib/sfl/engine";
import { ordinal } from "@/lib/sfl/fin-de-saison";
import { isHidden } from "@/lib/sfl/hidden";
import { POSTES } from "@/lib/sfl/inscription";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonStats } from "@/components/layout/bouton-stats";
import { BoutonTheme } from "@/components/layout/bouton-theme";
import { BoutonDeconnexion } from "@/components/sfl/auth/bouton-deconnexion";

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
  const { allPlayers } = useSeason();
  const division = useDivision(player.name);
  // Mon rang : celui du classement de la Ligue (sans les joueurs masqués),
  // où je figure toujours, même masqué.
  const myRank = useMemo(
    () =>
      rankPlayers(allPlayers.filter((p) => !isHidden(p.name) || p.name === player.name)).find((p) => p.name === player.name)
        ?.rank ?? null,
    [allPlayers, player.name]
  );
  const { fiche, joues } = useMaCarte();
  // La carte est le sujet de la page : elle profite de la place quand il y en
  // a, et d'un cran de plus (√φ) sur les très grands écrans.
  const grand = useGrandEcran();
  const tresGrand = useTresGrandEcran();
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const identite = useIdentites();
  const poste = POSTES.find((p) => p.id === player.poste)?.label ?? player.poste;
  const xp = useXp(player.name);
  const rangXp = useRangXp(player.name);

  return (
    <div className="shell py-4 sm:py-8 lg:pt-[var(--fib-55)]">
      <div className="relative z-10 mb-[18px] flex items-center justify-between gap-3 lg:mb-[var(--fib-34)]">
        <h1 className="text-[30px] font-bold tracking-tight lg:text-[34px]">Ma carte</h1>
        <div className="flex items-center gap-2">
          <BoutonStats />
          <BoutonRecherche />
          <BoutonTheme />
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
            <Card3DEnGrand
              cacheKey={`profil-simple-${player.name}`}
              mode="simple"
              size={tresGrand ? 1.15 * RACINE_PHI : grand ? 1.15 : 1}
              render={(s) => <PlayerCard player={player} size={s} />}
              titre={identite.nom(player.name)}
              sousTitre={identite.pseudo(player.name)}
            />
          </div>
          <div className="relative flex w-full flex-col items-center gap-[var(--fib-13)]">
            <button
              type="button"
              onClick={() => setIdentiteOuverte(true)}
              aria-label={`${identite.nom(player.name)}, ${identite.pseudo(player.name)}. Modifier mon nom et mon pseudo`}
              className="flex w-full flex-col items-center gap-[var(--fib-8)] text-center"
            >
              <span className="titre-lettrage text-[34px] leading-[0.95] break-words">
                {identite.nom(player.name)}
              </span>
              <span className="font-mono text-[12px] text-foreground/45">
                {identite.pseudo(player.name)} · {poste.toLowerCase()}
                {xp && ` · niveau XP ${xp.niveau}`}
                {rangXp && ` · rang ${rangXp.rang}`}
              </span>
            </button>
            <AppartenancesJoueur nom={player.name} />
            <ReseauJoueur nom={player.name} />
          </div>
          <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
            <Chiffre valeur={myRank != null && (joues > 0 || player.pp !== 0) ? ordinal(myRank) : "–"} quoi="Pépite d'Or" />
            {division && <Chiffre valeur={nomDivision(division)} quoi="Division" />}
            <Chiffre valeur={ovr(player.stats)} quoi="Général" />
            <Chiffre valeur={joues} quoi={joues > 1 ? "Dimanches" : "Dimanche"} />
          </div>
          <p className="w-full text-[19px] leading-[1.25] font-bold tracking-[-0.4px]">{fiche.synthese}</p>
          {/* Ma photo, ma carte officielle (photo au maillot Bola) tant
              qu'elle n'est pas faite, le badge de ma carte. Sans elle, les
              deux ronds se centrent. */}
          <div className="flex w-full items-center justify-center gap-[9px]">
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
          {/* Personnaliser ma carte : le skin, les signes et le badge, au choix (personnaliser-carte.tsx) */}
          <PersonnaliserCarte player={player} />
          {/* Inviter : mon lien et mon code de parrainage (parrainage/page.tsx) */}
          <Link
            href="/parrainage"
            className="bouton-secondaire bouton--mauve flex w-full items-center justify-center gap-2 py-3.5 text-[14px] font-semibold"
          >
            <UserPlus className="size-4" />
            Inviter
          </Link>
        </div>

        <div className="flex min-w-0 flex-col gap-[var(--fib-21)]">
          {/* 2. Le reste en résumé : une rangée par rubrique, qui ouvre sa page
              (ma saison, mon Niveau XP, mon évolution, mes badges, mes cartes :
              ma-carte/rubriques.tsx) */}
          <RubriquesMaCarte />

          {/* 6. Se déconnecter */}
          <BoutonDeconnexion className="w-full" />
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
