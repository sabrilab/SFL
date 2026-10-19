"use client";

// Ma carte — l'identité du joueur, rien d'autre.
//
// Ordre de lecture : qui je suis → ma carte (la simple) → mes badges (le
// prochain à viser, puis la fin de saison et les paliers, voir vitrine.tsx)
// → mon profil de jeu (le radar hexagonal, point faible en bleu) → les
// raccourcis. Les chiffres et la série sont dans les paliers ; la photo se
// change en touchant l'avatar.
//
// Tout le gameplay numérique (packs, catalogue, duels, matchs) a déménagé dans
// l'Arène : le profil ne porte plus de grille Collection, seulement le lien.

import Link from "next/link";
import { useState } from "react";
import { ChevronRight, Dumbbell, IdCard, Swords, Trophy } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { ChoixStyle } from "@/components/sfl/choix-style";
import { BOOST_LABELS } from "@/components/sfl/boost-card";
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
import { ovr, rankPlayers, STAT_KEYS, type Player } from "@/lib/sfl/engine";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";

/* ------------------------- Radar « PROFIL DE JEU » ------------------------ */
// Géométrie reprise du design : hexagone pointe en haut, centre (110,110),
// rayon 84, anneaux à 100/75/50/25 %, rayon de valeur = R × note/100.
// Polygone blanc, points blancs — sauf le point faible, en accent bleu.

const RADAR_LABELS: [number, number, number, "middle" | "start" | "end"][] = [
  [110, 10, 22, "middle"], // VIT
  [194, 58, 72, "start"], // TIR
  [194, 166, 180, "start"], // PAS
  [110, 216, 228, "middle"], // DRI
  [26, 166, 180, "end"], // DEF
  [26, 58, 72, "end"], // PHY
];

const STAT_FR: Record<string, string> = {
  VIT: "vitesse",
  TIR: "tir",
  PAS: "passe",
  DRI: "dribble",
  DEF: "défense",
  PHY: "physique",
};

function ProfilRadar({ stats, overall }: { stats: Player["stats"]; overall: number }) {
  const CX = 110;
  const CY = 110;
  const R = 84;
  const angle = (i: number) => -Math.PI / 2 + (i * Math.PI) / 3;
  const px = (i: number, r: number) => (CX + Math.cos(angle(i)) * r).toFixed(1);
  const py = (i: number, r: number) => (CY + Math.sin(angle(i)) * r).toFixed(1);
  const ring = (f: number) => STAT_KEYS.map((_, i) => `${px(i, R * f)},${py(i, R * f)}`).join(" ");
  const value = (i: number) => (R * stats[STAT_KEYS[i]]) / 100;

  const worst = STAT_KEYS.reduce((a, k) => (stats[k] < stats[a] ? k : a), STAT_KEYS[0]);
  const best = STAT_KEYS.reduce((a, k) => (stats[k] > stats[a] ? k : a), STAT_KEYS[0]);

  return (
    <section className="glass flex flex-col items-center rounded-[28px] px-[18px] pt-6 pb-5">
      <div className="flex w-full items-start justify-between">
        <div>
          <p className="mono-label text-foreground/40">Profil de jeu</p>
          <p className="mt-[5px] text-[12.5px] text-foreground/45">Six critères, saison 2025</p>
        </div>
        <div className="text-right">
          <div className="text-[30px] leading-none font-extrabold tracking-tight">{overall}</div>
          <p className="mono-label mt-[5px] text-foreground/40">Général</p>
        </div>
      </div>

      <svg viewBox="-12 -10 244 248" className="mt-2.5 w-full max-w-[258px] overflow-visible">
        <polygon points={ring(1)} fill="rgba(255,255,255,0.035)" stroke="rgba(255,255,255,0.14)" strokeWidth="1" />
        <polygon points={ring(0.75)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <polygon points={ring(0.5)} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
        <polygon points={ring(0.25)} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <path
          d={STAT_KEYS.map((_, i) => `M${CX},${CY} L${px(i, R)},${py(i, R)}`).join(" ")}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
        <polygon
          points={STAT_KEYS.map((_, i) => `${px(i, value(i))},${py(i, value(i))}`).join(" ")}
          fill="rgba(255,255,255,0.16)"
          stroke="#fff"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {STAT_KEYS.map((k, i) => (
          <circle
            key={k}
            cx={px(i, value(i))}
            cy={py(i, value(i))}
            r="3.4"
            fill={k === worst ? "#6FA8FF" : "#fff"}
          />
        ))}
        <g
          style={{ fontFamily: "var(--font-jbmono)", fontSize: 9, letterSpacing: 1.4 }}
          fill="rgba(255,255,255,0.45)"
        >
          {STAT_KEYS.map((k, i) => (
            <text key={k} x={RADAR_LABELS[i][0]} y={RADAR_LABELS[i][1]} textAnchor={RADAR_LABELS[i][3]}>
              {k}
            </text>
          ))}
        </g>
        <g style={{ fontSize: 13, fontWeight: 800 }} fill="#fff">
          {STAT_KEYS.map((k, i) => (
            <text
              key={k}
              x={RADAR_LABELS[i][0]}
              y={RADAR_LABELS[i][2]}
              textAnchor={RADAR_LABELS[i][3]}
              fill={k === worst ? "#6FA8FF" : "#fff"}
            >
              {stats[k]}
            </text>
          ))}
        </g>
      </svg>

      <div className="mt-3.5 flex w-full items-center justify-between border-t border-white/9 pt-3.5">
        {/* Une carte parfaitement plate n'a pas de point faible : le dire, plutôt
            que d'annoncer « −0 » sur un critère pris au hasard. */}
        {stats[best] === stats[worst] ? (
          <p className="text-[12.5px] text-foreground/45">Profil parfaitement équilibré</p>
        ) : (
          <>
            <p className="text-[12.5px] text-foreground/45">Point faible : {STAT_FR[worst]}</p>
            <p className="mono-label text-primary">
              −{stats[best] - stats[worst]} VS {best}
            </p>
          </>
        )}
      </div>
    </section>
  );
}

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
  const { allPlayers, boostCards } = useSeason();
  // Sur sa propre fiche, on se classe parmi tout le monde — y compris les
  // joueurs masqués ailleurs dans l'app.
  const myRank =
    rankPlayers(allPlayers).find((p) => p.name === player.name)?.rank ?? allPlayers.length;
  const myCards = boostCards.filter((c) => c.player === player.name);
  // La carte affichée est la simple : les notes brutes du joueur.
  const cardStats = player.stats;
  // La carte est le sujet de la page : elle profite de la place quand il y en a.
  const grand = useGrandEcran();
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const [identiteOuverte, setIdentiteOuverte] = useState(false);
  const identite = useIdentites();

  const nbTitres = myCards.length;
  const dernierTitre = myCards[myCards.length - 1];

  return (
    <div className="shell py-4 sm:py-8 lg:pt-[var(--fib-55)]">
      <div className="mb-[18px] flex items-center justify-between gap-3 lg:mb-[var(--fib-34)]">
        <h1 className="text-[30px] font-bold tracking-tight lg:text-[34px]">Ma carte</h1>
        <BoutonRecherche />
      </div>
      {/* Deux colonnes dès qu'il y a la place, dans le rapport 1 : φ
          (grille-or, globals.css) : l'identité et la carte à gauche, les
          badges, le profil de jeu et les raccourcis à droite. */}
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
        <ChoixStyle player={player} className="flex-1" />
        <ChoixBadge player={player} />
      </div>

      </div>

      <div className="flex min-w-0 flex-col gap-[18px] lg:gap-[var(--fib-21)]">
      {/* Mes badges : le prochain, la fin de saison, les paliers */}
      <div id="badges" className="scroll-mt-4">
        <VitrineBadges nom={player.name} />
      </div>

      {/* PROFIL DE JEU — le radar hexagonal du design */}
      <ProfilRadar stats={cardStats} overall={ovr(cardStats)} />

      {/* Navigation du profil */}
      <section className="flex flex-col gap-2.5">
        {(
          [
            {
              href: "/carte",
              icon: IdCard,
              label: "Cartes de match",
              note: dernierTitre
                ? `${nbTitres} titre${nbTitres > 1 ? "s" : ""} · dernier : ${BOOST_LABELS[dernierTitre.type]}`
                : "Carte, boosts et évolution EvoDay",
            },
            {
              href: "/palmares",
              icon: Trophy,
              label: "Wall of Fame",
              note: "Ton parcours, saison après saison",
            },
            {
              href: "/duel",
              icon: Swords,
              label: "Arène",
              note: "Duels, matchs et collection de cartes",
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
