"use client";

// Section Profil — l'identité du joueur, rien d'autre.
//
// Ordre de lecture : qui je suis → mes deux cartes (simple et rare, au choix)
// → mon profil de jeu (le radar hexagonal, point faible en bleu) → mes
// chiffres → ma série de dimanches → ma photo → les mini-jeux « Les bases »
// (verrouillés) → les raccourcis.
//
// Tout le gameplay numérique (packs, catalogue, duels, matchs) a déménagé dans
// l'Arène : le profil ne porte plus de grille Collection, seulement le lien.

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, Dumbbell, IdCard, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card3D } from "@/components/sfl/card-3d";
import { PlayerCard } from "@/components/sfl/player-card";
import { BOOST_LABELS } from "@/components/sfl/boost-card";
import { ProfilePhoto } from "@/components/sfl/profile-photo";
import { Locked } from "@/components/sfl/locked";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import { username } from "@/lib/sfl/usernames";
import { ovr, rankPlayers, rareStats, STAT_KEYS, type Player } from "@/lib/sfl/engine";

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
  const { allPlayers, journees, boostCards, saison } = useSeason();
  // Sur sa propre fiche, on se classe parmi tout le monde — y compris les
  // joueurs masqués ailleurs dans l'app.
  const myRank =
    rankPlayers(allPlayers).find((p) => p.name === player.name)?.rank ?? allPlayers.length;
  const myCards = boostCards.filter((c) => c.player === player.name);
  const cardStats = rareStats(player.stats);
  // Les deux visages de la carte : la simple (les notes brutes) et la rare
  // (celle qui sert partout ailleurs dans l'app).
  const [face, setFace] = useState<"simple" | "rare">("rare");

  // Série de dimanches : journées jouées consécutives, en remontant depuis
  // la dernière journée disputée.
  const playedJs = journees.filter((j) => (j.matches ?? []).length > 0).map((j) => j.j);
  const mine = new Set(
    saison.entries
      .filter((e) => e.player === player.name && e.statut === "Présent" && !e.extraTime)
      .map((e) => e.j)
  );
  let streak = 0;
  for (let i = playedJs.length - 1; i >= 0; i--) {
    if (mine.has(playedJs[i])) streak += 1;
    else break;
  }

  const nbTitres = myCards.length;
  const dernierTitre = myCards[myCards.length - 1];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[18px] px-5 py-4 sm:py-8">
      <h1 className="text-[30px] font-bold tracking-tight">Profil</h1>

      {/* Rangée d'identité : photo, nom, pseudo, menu réglages */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <AvatarPhoto name={player.name} />
          <div className="min-w-0">
            <div className="truncate text-[19px] font-extrabold tracking-tight">{player.name}</div>
            <div className="mt-0.5 truncate text-[12.5px] text-foreground/42">
              {`${username(player.name)} · ${player.poste} · ${myRank}e au Pépite d'Or`}
            </div>
          </div>
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

      {/* Mes deux cartes : la simple et la rare, au choix */}
      <section className="flex flex-col items-center gap-3.5">
        <div className="glass flex w-full max-w-[240px] rounded-full p-1">
          {(
            [
              ["simple", "Simple"],
              ["rare", "Rare"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setFace(id)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors",
                face === id ? "bg-foreground text-background" : "text-foreground/45"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <Card3D
          key={face}
          cacheKey={`profil-${face}-${player.name}`}
          mode={face}
          size={0.88}
          render={(s) => <PlayerCard player={player} mode={face} size={s} />}
        />
        <p className="mono-label text-center text-[9px] tracking-[0.12em] text-foreground/30">
          Glisse pour tourner · double-clic pour retourner
        </p>
      </section>

      {/* Les deux actions du design : partage (bientôt) + historique */}
      <div className="flex gap-[9px]">
        <Locked label="Bientôt" className="flex-1" chipClassName="-top-2.5 right-1">
          <span className="block rounded-full bg-foreground py-[15px] text-center text-[15px] font-bold text-background">
            Partager ma carte
          </span>
        </Locked>
        <Link
          href="/stats"
          className="glass-soft w-[128px] rounded-full py-[15px] text-center text-[15px] font-semibold text-foreground/70"
        >
          Historique
        </Link>
      </div>

      {/* PROFIL DE JEU — le radar hexagonal du design */}
      <ProfilRadar stats={cardStats} overall={ovr(cardStats)} />

      {/* Bento de stats 2×2 */}
      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            [player.pp, "Points Pépite"],
            [player.buts, "Buts"],
            [player.passes, "Passes décisives"],
            [player.matchs, "Matchs joués"],
          ] as const
        ).map(([value, label]) => (
          <div key={label} className="glass rounded-[22px] p-[15px]">
            <div className="flex items-start justify-between">
              <div className="text-[28px] leading-none font-extrabold tracking-tight tabular-nums">
                {value}
              </div>
              <span className="glass-soft size-[26px] rounded-full" />
            </div>
            <p className="mono-label mt-2.5 text-foreground/40">{label}</p>
          </div>
        ))}
      </div>

      {/* La série de dimanches */}
      {streak > 0 && (
        <div className="glass flex items-center justify-between rounded-[22px] p-4">
          <div className="flex items-baseline gap-2">
            <span className="text-[26px] leading-none font-extrabold tracking-tight text-primary tabular-nums">
              {streak}
            </span>
            <span className="mono-label text-foreground/40">
              Dimanche{streak > 1 ? "s" : ""} de série
            </span>
          </div>
          <div className="flex items-center gap-[9px]">
            <span className="text-[13px] font-semibold text-foreground/55">Actif</span>
            <span className="flex size-[30px] items-center justify-center rounded-full bg-foreground">
              <Check className="size-3.5 text-background" strokeWidth={3} />
            </span>
          </div>
        </div>
      )}

      {/* Photo de profil — l'interim façon réseaux sociaux */}
      <section className="glass rounded-[26px] p-4">
        <ProfilePhoto name={player.name} />
      </section>

      {/* Les bases — mini-jeux à ballons, verrouillés pour l'instant */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-[16px] font-bold tracking-tight">Les bases</h2>
            <p className="mt-1 text-[12.5px] text-foreground/42">
              Mini-jeux · chaque module rapporte des ballons
            </p>
          </div>
          <span className="glass-soft flex shrink-0 items-center gap-[5px] rounded-full px-[11px] py-1.5">
            <span className="text-[12px] leading-none">⚽</span>
            <span className="mono-label text-primary">Bientôt</span>
          </span>
        </div>
        <Locked label="Bientôt" note="Les mini-jeux à ballons arrivent avec les comptes joueurs.">
          <div className="glass relative overflow-hidden rounded-[26px]">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "repeating-linear-gradient(115deg, rgba(255,255,255,0.045) 0 10px, rgba(255,255,255,0.01) 10px 20px)",
              }}
            />
            <div className="relative flex flex-col gap-10 p-[17px]">
              <div className="flex items-start justify-between gap-2.5">
                <span className="mono-label rounded-full border border-white/16 bg-white/10 px-[11px] py-[5px] text-foreground/75">
                  Module 1
                </span>
                <span className="flex shrink-0 items-center gap-[5px] rounded-full border border-primary/32 bg-primary/14 px-2.5 py-[5px]">
                  <span className="text-[11px] leading-none">⚽</span>
                  <span className="mono-label text-primary">+40</span>
                </span>
              </div>
              <div>
                <p className="mono-label text-foreground/38">Étape 1/4</p>
                <h3 className="mt-[7px] text-[25px] leading-[1.12] font-extrabold tracking-tight">
                  Lis ta carte comme un pro
                </h3>
                <p className="mt-[7px] text-[13px] leading-[1.45] text-foreground/50">
                  GÉN, critères, boosts : comprends tout ce que ta carte raconte.
                </p>
                <div className="mt-3.5 flex items-center justify-between gap-2.5">
                  <span className="mono-label text-foreground/42">3 min · Quiz</span>
                  <span className="rounded-full bg-foreground px-[17px] py-2.5 text-[13px] font-bold text-background">
                    Commencer
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-[18px] rounded-full bg-foreground/70" />
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-1.5 rounded-full bg-foreground/20" />
            ))}
          </div>
        </Locked>
      </section>

      {/* Navigation du profil */}
      <section className="flex flex-col gap-2.5">
        {(
          [
            {
              href: "/carte",
              icon: IdCard,
              label: "Ma carte",
              note: dernierTitre
                ? `${nbTitres} titre${nbTitres > 1 ? "s" : ""} · dernier : ${BOOST_LABELS[dernierTitre.type]}`
                : "Carte, boosts et évolution EvoDay",
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
  );
}
