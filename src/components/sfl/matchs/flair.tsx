"use client";

// Le Flair sur la feuille de match (nom choisi par Sabri le 24/10). Sabri,
// 24/10 au soir : « il ne faudrait pas que ça fasse l'objet d'une section
// dans l'actu […] intègre-le dans les feuilles de match. Une fois qu'elles
// sont sorties, les joueurs peuvent directement, sur les feuilles de match,
// parier sur qui gagne et qui est le meilleur joueur ».
//
// Sous le terrain de chaque match (feuille-de-match.tsx), une fiche noire,
// dans les deux modes :
//   · Qui gagne ? Noirs, nul ou Blancs pour ce match-là (sur ton propre
//     match, ton camp seulement), avec la part de la ligue sous chaque choix ;
//   · le meilleur du jour (le plus de points Pépite) et le buteur du jour,
//     choisis sur les cartes de la feuille, ce match d'abord ;
//   · en pied, ce que ça rapporte.
// Tout ferme au premier coup d'envoi de la journée ; le verdict tombe avec la
// feuille remplie, définitif à minuit. Les règles et l'XP ne changent pas
// (lib/sfl/pronos.ts) : l'XP va au Niveau XP et au passe, jamais aux points
// Pépite. Le Flair ne vit que sur la journée en cours (usePronosJournee) :
// une feuille d'une autre journée n'en a pas.
//
// Les cartes suivent la hiérarchie de l'app (FORMAT_CARTE) : moyenne dans la
// rangée où l'on choisit, petite une fois choisie.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { usePronosJournee, type MesPronos, type SujetVu } from "@/hooks/use-pronos";
import {
  choixPermis,
  PLAFOND_JOURNEE,
  XP_BUTEUR_DU_JOUR,
  XP_MEILLEUR_DU_JOUR,
  XP_VAINQUEUR,
  xpSujet,
  type Camp,
} from "@/lib/sfl/pronos";
import { cn } from "@/lib/utils";
import { BLANCS, NOIRS, Pouls } from "@/components/sfl/actus/missions";
import "./flair.css";

const NOM_CAMP: Record<Camp, string> = { noirs: "Noirs", nul: "Nul", blancs: "Blancs" };

const pourcent = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);
const totalDe = (parts: [string, number][]) => parts.reduce((a, [, n]) => a + n, 0);

/** Le temps qui reste avant le premier coup d'envoi : « 1 j 02:14 ». */
export function FermeDans({ fin }: { fin: Date }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const m = Math.max(0, Math.floor((fin.getTime() - t) / 60_000));
  const j = Math.floor(m / 1440);
  const deux = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="mono-label flex shrink-0 items-baseline gap-2 text-white/50">
      Ferme dans
      <span className="text-petit text-white tabular-nums">
        {j > 0 && `${j} j `}
        {deux(Math.floor((m % 1440) / 60))}:{deux(m % 60)}
      </span>
    </span>
  );
}

type Identite = ReturnType<typeof useIdentites>;
const prenomDe = (identite: Identite, nom: string) => identite.nom(nom).split(" ")[0];

function Verdict({ v, xp }: { v: SujetVu; xp: number }) {
  if (v.etat === "juste") return <span className="mono-label text-[#9fe0a8]">Juste · +{xp} XP</span>;
  if (v.etat === "faux") return <span className="mono-label text-white/45">Raté</span>;
  if (v.etat === "hors-delai") return <span className="mono-label text-white/45">Posé trop tard</span>;
  return null;
}

/** Un bouton de choix, avec la part de la ligue dessous. */
function Choix({
  libelle,
  part,
  actif,
  bon,
  ferme,
  ton,
  onClick,
}: {
  libelle: string;
  part: number;
  actif: boolean;
  bon: boolean;
  ferme: boolean;
  ton?: { fond: string; encre: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={ferme}
      aria-pressed={actif}
      onClick={onClick}
      className={cn(
        "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-1 overflow-hidden rounded-[14px] border px-2 py-2 transition-transform active:scale-[0.97] disabled:active:scale-100",
        actif ? "border-white ring-2 ring-white ring-offset-2 ring-offset-[#0b0a0e]" : "border-white/15",
        !ton && "bg-white/[0.06] text-white",
        ferme && !actif && "opacity-50"
      )}
      style={ton ? { background: ton.fond, color: ton.encre } : undefined}
    >
      <span className="text-lecture leading-none font-bold">{libelle}</span>
      <span className="font-mono text-legende leading-none tabular-nums opacity-70">{part} %</span>
      {bon && <span className="absolute top-1.5 right-2 text-legende font-bold" aria-label="Le bon résultat">✓</span>}
      <span aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-current opacity-35" style={{ width: `${part}%` }} />
    </button>
  );
}

async function poser(mp: { poser: (s: string, c: string | null) => Promise<void> }, sujet: string, choix: string | null) {
  try {
    await mp.poser(sujet, choix);
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Choix refusé.");
  }
}

/** Choisir un joueur parmi des cartes : la rangée se déplie sous la ligne. */
function ChoixJoueur({
  titre,
  v,
  candidats,
  ferme,
  droite,
  sous,
  onChoix,
}: {
  titre: string;
  v: SujetVu;
  candidats: string[];
  ferme: boolean;
  droite: ReactNode;
  sous?: ReactNode;
  onChoix: (nom: string | null) => void;
}) {
  const { allPlayers } = useSeason();
  const identite = useIdentites();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const joueur = (nom: string) => allPlayers.find((p) => p.name === nom);
  const choisi = v.choix ? joueur(v.choix) : undefined;
  const total = totalDe(v.parts);
  const part = (nom: string) => pourcent(v.parts.find(([x]) => x === nom)?.[1] ?? 0, total);
  useEffect(() => {
    if (ouvert) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ouvert]);
  return (
    <div ref={ref} className="flair__bloc flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <button
          type="button"
          disabled={ferme}
          onClick={() => setOuvert((o) => !o)}
          aria-expanded={ouvert}
          aria-label={choisi ? `${titre} : ${choisi.name}. Changer` : `${titre} : choisir`}
          className="shrink-0 transition-transform active:scale-95"
        >
          {choisi ? (
            <PlayerCard player={choisi} size={FORMAT_CARTE.petite} />
          ) : (
            <span
              className="grid place-items-center rounded-[8px] border border-dashed border-white/30 text-titre-fort text-white/50"
              style={{ width: 254 * FORMAT_CARTE.petite, height: 254 * FORMAT_CARTE.petite * 1.4 }}
            >
              +
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="mono-label text-white/55">{titre}</span>
          <span className="truncate text-titre leading-tight font-bold">
            {choisi ? identite.nom(choisi.name) : ferme ? "Aucun choix" : "Choisir"}
          </span>
          {choisi && total > 0 && <span className="font-mono text-legende text-white/50 tabular-nums">{part(choisi.name)} % de la ligue</span>}
          {sous}
        </div>
        <div className="shrink-0 text-right">{droite}</div>
      </div>
      {ouvert && !ferme && (
        <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {candidats.map((nom) => {
            const p = joueur(nom);
            if (!p) return null;
            const actif = v.choix === nom;
            return (
              <button
                key={nom}
                type="button"
                aria-pressed={actif}
                onClick={() => {
                  onChoix(actif ? null : nom);
                  setOuvert(false);
                }}
                className={cn("flex shrink-0 flex-col items-center gap-1.5 rounded-[12px] p-1 transition-transform active:scale-95", actif && "ring-2 ring-white")}
              >
                <PlayerCard player={p} size={FORMAT_CARTE.moyenne} />
                <span className="max-w-[78px] truncate text-petit leading-none font-semibold">{prenomDe(identite, nom)}</span>
                <span className="font-mono text-etiquette leading-none text-white/50 tabular-nums">{part(nom)} %</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SUJETS_JOUR = [
  ["pepite", "Le meilleur du jour", XP_MEILLEUR_DU_JOUR],
  ["buteur", "Le buteur du jour", XP_BUTEUR_DU_JOUR],
] as const;

/** Le match de la journée du Flair qui a ces joueurs ; null si ce n'est pas elle. */
function leMatch(mp: MesPronos, noirs: string[], blancs: string[]) {
  const ici = new Set([...noirs, ...blancs]);
  let meilleur: { n: number; communs: number } | null = null;
  for (const m of mp.p.matchs) {
    const communs = [...m.noirs, ...m.blancs].filter((x) => ici.has(x)).length;
    if (!meilleur || communs > meilleur.communs) meilleur = { n: m.n, communs };
  }
  // Au moins la moitié des joueurs en commun : la même affiche, pas un autre dimanche.
  return meilleur && meilleur.communs * 2 >= ici.size ? mp.p.matchs.find((m) => m.n === meilleur.n)! : null;
}

/**
 * Le Flair d'un match, sous son terrain. Rien quand la feuille n'est pas
 * celle de la journée en cours (j différent, ou d'autres joueurs).
 */
export function FlairDuMatch({ j, noirs, blancs }: { j: number | null; noirs: string[]; blancs: string[] }) {
  const mp = usePronosJournee();
  const identite = useIdentites();
  const m = useMemo(() => (mp && (j == null || j === mp.p.j) ? leMatch(mp, noirs, blancs) : null), [mp, j, noirs, blancs]);
  if (!mp || !m) return null;
  const sujet = `match:${m.n}`;
  const v = mp.sujets.get(sujet)!;
  const permis = choixPermis(mp.p, m.n, mp.joueur);
  const sien = permis.length === 1;
  const total = totalDe(v.parts);
  const ferme = mp.phase !== "ouvert";
  const juge = mp.p.joue && [...mp.sujets.values()].some((x) => x.bons);
  const gagne = Math.min(
    PLAFOND_JOURNEE,
    [...mp.sujets.values()].filter((x) => x.etat === "juste").reduce((a, x) => a + xpSujet(x.sujet), 0)
  );
  // Ce match d'abord dans les rangées de cartes, puis le reste de la journée.
  const ici = new Set([...m.noirs, ...m.blancs]);
  const candidats = [...mp.p.joueurs.filter((x) => ici.has(x)), ...mp.p.joueurs.filter((x) => !ici.has(x))];
  return (
    <section aria-labelledby={`flair-${m.n}`} className="flair flex flex-col gap-4 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`flair-${m.n}`} className="titre-lettrage text-titre-m leading-[0.95]">
          Le Flair
        </h3>
        {mp.phase === "ouvert" ? (
          <FermeDans fin={mp.p.coupEnvoi} />
        ) : juge ? (
          <span className={cn("mono-label shrink-0", gagne ? "text-[#9fe0a8]" : "text-white/55")}>
            {mp.phase === "en-jeu" ? "Verdict à minuit · " : ""}+{gagne} XP
          </span>
        ) : (
          <span className="mono-label flex shrink-0 items-center gap-2 text-white/80">
            <Pouls bat={mp.phase === "en-jeu"} /> {mp.phase === "en-jeu" ? "En jeu" : "Fermé"}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label text-white/55">
            {mp.p.matchs.length > 1 ? `Qui gagne le ${m.label.toLowerCase()} ?` : "Qui gagne ?"}
            {sien ? " · ton camp" : ""}
          </span>
          {v.choix && v.etat !== "attente" ? <Verdict v={v} xp={XP_VAINQUEUR} /> : <span className="mono-label text-white/50">+{XP_VAINQUEUR} XP</span>}
        </div>
        <div className="flex gap-2">
          {(["noirs", "nul", "blancs"] as Camp[]).map((c) => (
            <Choix
              key={c}
              libelle={NOM_CAMP[c]}
              part={pourcent(v.parts.find(([x]) => x === c)?.[1] ?? 0, total)}
              actif={v.choix === c}
              bon={!!v.bons?.includes(c)}
              ferme={ferme || !permis.includes(c)}
              ton={c === "noirs" ? NOIRS : c === "blancs" ? BLANCS : undefined}
              onClick={() => void poser(mp, sujet, v.choix === c ? null : c)}
            />
          ))}
        </div>
      </div>

      {SUJETS_JOUR.map(([s, titre, xp]) => {
        const vs = mp.sujets.get(s)!;
        const reponse = mp.p.joue && vs.bons?.length ? vs.bons.map((n) => prenomDe(identite, n)).join(", ") : null;
        return (
          <ChoixJoueur
            key={s}
            titre={titre}
            v={vs}
            candidats={candidats}
            ferme={ferme}
            droite={vs.etat === "attente" || !vs.choix ? <span className="mono-label text-white/50">+{xp} XP</span> : <Verdict v={vs} xp={xp} />}
            sous={reponse ? <span className="font-mono text-legende text-white/50">C&apos;est {reponse}</span> : undefined}
            onChoix={(nom) => void poser(mp, s, nom)}
          />
        );
      })}

      <p className="mono-label text-white/45">
        {mp.phase === "ouvert"
          ? `Toute la journée · ${PLAFOND_JOURNEE} XP au plus · ferme au premier coup d'envoi`
          : `Toute la journée · ${PLAFOND_JOURNEE} XP au plus · définitif à minuit`}
      </p>
    </section>
  );
}
