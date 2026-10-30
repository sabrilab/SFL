"use client";

// L'autre face du mode Passe : les Missions. Sabri, 26/10 : « il faudrait
// que, dans cette chose-là, je puisse voir aussi les missions et les choses
// qui me font gagner des XP, parce que là, je vois que les skins ». Comme
// dans un passe de combat (Fortnite : « Passe » et « Quêtes »), deux onglets
// en haut du mode (mode-passe.tsx) ; celui-ci se lit de haut en bas :
//   · les Missions Bola de la journée (actus/missions.tsx : les trois fiches,
//     accepter ou passer, le verdict). Les Actus ne gardent que les contrats
//     de rang S acceptés ; toutes les autres missions vivent ici. Sans
//     feuille encore, la prochaine journée attend ses missions ;
//   · ce qui rapporte de l'XP, ligne par ligne, avec ce que j'en ai tiré
//     cette saison (le barème vient des constantes de lib/sfl/missions.ts et
//     lib/sfl/pronos.ts : il suit leurs réglages) ;
//   · le journal : d'où vient chaque XP, pertes en rouge.
// Un joueur Bola (hors de la SFL) n'a ni les missions du dimanche ni ce qui
// ne s'y gagne (jouer le dimanche, contrat, défi, vote, trois sur trois) :
// il garde le reste et son journal (28/10/2026). À leur place, ses missions
// perso (missions-perso.tsx) et ce que rapportent ses matchs Bola validés ;
// son journal date ses lignes Bola (« 22 oct. · 19h30 ») au lieu d'une
// journée de la SFL (choix par défaut, 28/10).
// Sous les missions, pour tout le monde, les défis (defis.tsx) : le prochain
// badge de chaque famille, toujours là, même sans feuille (30/10).

import { useMemo } from "react";
import { ANTON } from "@/components/sfl/actus/ecran";
import { MissionsBola } from "@/components/sfl/actus/missions";
import { MissionsPerso } from "@/components/sfl/missions-perso";
import { Defis } from "@/components/sfl/defis";
import { PRIME_DEFI } from "@/lib/sfl/defis";
import { MISSIONS_PERSO, XP_MATCH_BOLA } from "@/lib/sfl/missions-perso";
import { useJoueurBola } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useHorsSfl } from "@/hooks/use-hors-sfl";
import { useMissions } from "@/hooks/use-missions";
import {
  FELICITATIONS_DONNEES_JOURNEE,
  PRIME,
  risqueDe,
  XP_DIMANCHE,
  XP_FELICITATION_DONNEE,
  XP_FELICITATION_RECUE,
  XP_FELICITATIONS_JOURNEE,
  XP_PARFAIT,
  type BilanXp,
  type Creneau,
  type Genre,
  type LigneXp,
} from "@/lib/sfl/missions";
import { XP_MATCH_ARBITRE } from "@/lib/sfl/missions-arbitre";
import { XP_RECRUE } from "@/components/sfl/skins-recrues";
import { PLAFOND_JOURNEE } from "@/lib/sfl/pronos";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { cn } from "@/lib/utils";

const xp = (n: number) => `${n.toLocaleString("fr-FR")} XP`;
const signe = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

const GENRES: Record<Creneau, Genre[]> = {
  contrat: ["finis-devant", "tiens-le", "passe-devant", "reste-en-tete"],
  defi: ["gagnez", "deux-passes", "record"],
  ligue: ["vote"],
};

/** « +110 à +200 », et ce que coûte la même mission ratée. */
function fourchette(c: Creneau): { gain: string; perte: string } {
  const primes = GENRES[c].map((g) => PRIME[g]);
  const bas = Math.min(...primes);
  const haut = Math.max(...primes);
  const r = (n: number) => risqueDe({ xp: n });
  return bas === haut
    ? { gain: `+${bas}`, perte: `−${r(bas)}` }
    : { gain: `+${bas} à +${haut}`, perte: `−${r(bas)} à −${r(haut)}` };
}

interface Source {
  cle: string;
  nom: string;
  gain: string;
  detail: string;
  /** Les lignes du journal qui en viennent. */
  de: (l: LigneXp) => boolean;
  /** Montrée seulement si elle a déjà rapporté (arbitrer). */
  discrete?: boolean;
  /** Ne se gagne qu'au dimanche de la SFL : pas pour un joueur Bola. */
  sfl?: boolean;
  /** Ne se gagne qu'en Bola : montrée à un joueur Bola, ou si elle a déjà rapporté. */
  bola?: boolean;
}

const primesPerso = MISSIONS_PERSO.map((m) => m.xp);

/** Le joueur connecté joue en Bola, hors de la SFL (la saison ou la base le disent). */
export function useHorsDeLaSfl(): boolean {
  const bola = useJoueurBola();
  const hors = useHorsSfl();
  return bola || hors;
}

const SOURCES: Source[] = [
  {
    cle: "match-bola",
    nom: "Jouer un match Bola",
    gain: `+${XP_MATCH_BOLA}`,
    detail: "validé",
    de: (l) => l.bola === true && !l.mission,
    bola: true,
  },
  {
    cle: "perso",
    nom: "Missions perso",
    gain: `+${Math.min(...primesPerso)} à +${Math.max(...primesPerso)}`,
    detail: "une fois par semaine chacune",
    de: (l) => l.mission?.creneau === "perso",
    bola: true,
  },
  {
    cle: "defis",
    nom: "Défis",
    gain: `+${Math.min(...PRIME_DEFI)} à +${Math.max(...PRIME_DEFI)}`,
    detail: "chaque badge franchi",
    de: (l) => !!l.defi,
  },
  {
    cle: "jouer",
    nom: "Jouer le dimanche",
    gain: `+${XP_DIMANCHE}`,
    detail: "sur la feuille de match",
    de: (l) => l.quoi === "Dimanche joué",
    sfl: true,
  },
  ...(["contrat", "defi", "ligue"] as const).map((c) => {
    const f = fourchette(c);
    return {
      cle: c,
      nom: c === "contrat" ? "Contrat" : c === "defi" ? "Défi du dimanche" : "La ligue · vote",
      gain: f.gain,
      detail: `${f.perte} si ratée`,
      de: (l: LigneXp) => l.mission?.creneau === c,
      sfl: true,
    };
  }),
  {
    cle: "parfait",
    nom: "Trois sur trois",
    gain: `+${XP_PARFAIT}`,
    detail: "les trois missions du dimanche",
    de: (l) => !!l.parfait,
    sfl: true,
  },
  {
    cle: "flair",
    nom: "Le Flair",
    gain: `+${PLAFOND_JOURNEE}`,
    detail: "au plus, par journée",
    de: (l) => l.quoi.startsWith("Flair"),
  },
  {
    cle: "recues",
    nom: "Félicitations reçues",
    gain: `+${XP_FELICITATION_RECUE}`,
    detail: `chacune · ${XP_FELICITATIONS_JOURNEE} au plus par journée`,
    de: (l) => l.quoi === "Félicitations reçues",
  },
  {
    cle: "donnees",
    nom: "Félicitations données",
    gain: `+${XP_FELICITATION_DONNEE}`,
    detail: `chacune · ${FELICITATIONS_DONNEES_JOURNEE * XP_FELICITATION_DONNEE} au plus par journée`,
    de: (l) => l.quoi === "Félicitations données",
  },
  {
    cle: "arbitre",
    nom: "Arbitrer",
    gain: `+${XP_MATCH_ARBITRE}`,
    detail: "par match",
    de: (l) => /arbitré/.test(l.quoi),
    discrete: true,
  },
  {
    cle: "recrues",
    nom: "Recrues",
    gain: `+${XP_RECRUE}`,
    detail: "par recrue · son 1er match",
    de: (l) => !!l.horsRang && !l.bola,
    discrete: true,
  },
];

/** Les sources d'XP tenues aux journées de la SFL. */
const JOURNEE_SFL = new Set(["flair", "recues", "donnees"]);

/** La prochaine journée, quand ses missions ne sont pas encore là. */
function Attente() {
  const { saison } = useSeason();
  const j = saison.journees.find((m) => !journeeJouee(saison, m.j));
  return (
    <section className="flex flex-col gap-1.5 px-5">
      <span className="mono-label text-white/45">{j ? `J${j.j} · ${j.date}` : "Fin de saison"}</span>
      <h2 className="titre-lettrage text-[30px] leading-[0.95]">Missions Bola</h2>
      <p className="text-[14px] font-semibold text-white/55">
        {j ? "Elles tombent avec les équipes." : "Elles reviennent avec la prochaine saison."}
      </p>
    </section>
  );
}

function Sources({ b, saison }: { b: BilanXp; saison: number }) {
  const horsSfl = useHorsDeLaSfl();
  const lignes = useMemo(() => b.lignes.filter((l) => l.saison === saison), [b.lignes, saison]);
  return (
    <section className="flex flex-col" aria-labelledby="titre-gagner-xp">
      <div className="flex items-baseline justify-between px-5 pb-2">
        <h2 id="titre-gagner-xp" className="titre-lettrage text-[26px]">
          Gagner de l&apos;XP
        </h2>
        <span className="font-mono text-[12px] text-white/50 tabular-nums">
          {xp(b.saison)}
          {horsSfl ? "" : " cette saison"}
        </span>
      </div>
      {SOURCES.map((s) => {
        const miennes = lignes.filter(s.de);
        if (s.discrete && miennes.length === 0) return null;
        if (s.sfl && horsSfl) return null;
        // Le Flair et les félicitations se jouent sur les journées de la SFL :
        // hors de la SFL, seulement s'il en a déjà gagné (revue, 28/10).
        if (horsSfl && JOURNEE_SFL.has(s.cle) && miennes.length === 0) return null;
        if (s.bola && !horsSfl && miennes.length === 0) return null;
        const total = miennes.reduce((a, l) => a + l.xp, 0);
        const fois = miennes.filter((l) => l.xp > 0).length;
        return (
          <div key={s.cle} className="mp-source">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-[15px] font-semibold">{s.nom}</span>
                <span className="mp-source__gain tabular-nums">{s.gain}</span>
              </span>
              <span className="truncate font-mono text-[11px] text-white/45">{s.detail}</span>
            </div>
            <span className={cn("flex shrink-0 flex-col items-end", miennes.length === 0 && "text-white/25")}>
              <span className={cn("tabular-nums", total < 0 && "text-[#ff9b9d]")} style={{ fontFamily: ANTON, fontSize: 22, lineHeight: 1 }}>
                {miennes.length ? signe(total) : "—"}
              </span>
              {fois > 0 && <span className="font-mono text-[10px] text-white/45 tabular-nums">×{fois}</span>}
            </span>
          </div>
        );
      })}
    </section>
  );
}

function Journal({ b, saison }: { b: BilanXp; saison: number }) {
  if (b.lignes.length === 0) return null;
  return (
    <section className="flex flex-col" aria-labelledby="titre-journal-xp">
      <h2 id="titre-journal-xp" className="titre-lettrage px-5 pb-2 text-[26px]">
        Journal
      </h2>
      {b.lignes.slice(0, 20).map((l, i) => (
        <div key={`${l.saison}-${l.j}-${l.quoi}-${i}`} className="flex items-center gap-3 border-t border-white/8 px-5 py-3">
          <span className={cn("shrink-0 whitespace-nowrap font-mono text-[11px] text-white/45", l.bola ? "w-[60px]" : "w-[44px]")}>
            {l.bola ? l.date.split(" · ")[0] : l.saison === saison ? `J${l.j}` : `S${l.saison} J${l.j}`}
          </span>
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{l.quoi}</span>
          <span className={cn("font-mono text-[13px] font-bold tabular-nums", l.xp < 0 && "text-[#ff9b9d]")}>{signe(l.xp)}</span>
        </div>
      ))}
    </section>
  );
}

/** La face Missions du mode Passe : elle défile, le reste du mode reste en place. */
export function VueMissions({ b, saison, nom }: { b: BilanXp; saison: number; nom: string }) {
  const mm = useMissions();
  const horsSfl = useHorsDeLaSfl();
  return (
    <div className="mp-missions">
      {horsSfl ? <MissionsPerso /> : mm ? <MissionsBola /> : <Attente />}
      <Defis nom={nom} />
      <Sources b={b} saison={saison} />
      <Journal b={b} saison={saison} />
    </div>
  );
}

/** Des missions à signer : le mode s'ouvre alors sur elles. */
export function useMissionsASigner(): number {
  const mm = useMissions();
  const horsSfl = useHorsDeLaSfl();
  if (horsSfl || !mm || mm.apercu || mm.phase !== "ouvert") return 0;
  return mm.lignes.filter((l) => !l.reponse).length;
}
