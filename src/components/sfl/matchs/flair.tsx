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
// Sabri, 31/10 : « pour chaque match […] le meilleur buteur, le meilleur
// passeur et le MVP du match », « le meilleur passeur du jour », « des choix
// en fonction des matchs, pas juste qui va gagner », « que ça fasse vraiment
// stylé ». Chaque match a son bloc : qui gagne, l'écart (serré, net, large),
// le duel (deux cartes face à face : qui finit devant l'autre), puis son
// MVP, son buteur et son passeur, choisis parmi ses seuls joueurs ; la
// journée a le sien (le meilleur, le buteur, le passeur du jour). Une jauge
// sous le titre compte les choix posés. FlairDeLaJournee met toute la journée
// sur une page (Ma carte → Le Flair), pour qui ne joue pas : le blessé, le
// remplaçant, la tribune, dont le plafond monte (PLAFOND_TRIBUNE).
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
  DETAIL_ECART,
  duelPermis,
  ECARTS,
  NOM_ECART,
  PLAFOND_TRIBUNE,
  SUJETS_JOUR,
  TITRE_JOUR,
  TITRE_MATCH,
  xpSujet,
  type Camp,
  type MatchProno,
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
  detail,
  part,
  actif,
  bon,
  ferme,
  ton,
  onClick,
}: {
  libelle: string;
  detail?: string;
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
      {detail && <span className="text-legende leading-none opacity-60">{detail}</span>}
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
    <div ref={ref} className="flex flex-col gap-3">
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

/** Ce que rapporte un sujet, ou son verdict une fois jugé. */
function Gain({ v }: { v: SujetVu }) {
  const xp = xpSujet(v.sujet);
  return v.choix && v.etat !== "attente" ? <Verdict v={v} xp={xp} /> : <span className="mono-label text-white/50">+{xp} XP</span>;
}

/** Une question à boutons (qui gagne, l'écart) : son titre, son gain, ses choix. */
function Question({ titre, v, children }: { titre: string; v: SujetVu; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label text-white/55">{titre}</span>
        <Gain v={v} />
      </div>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

/** Le duel d'un match : deux cartes face à face, on touche celle qui finira devant. */
function Duel({ mp, m, ferme }: { mp: MesPronos; m: MatchProno; ferme: boolean }) {
  const { allPlayers } = useSeason();
  const identite = useIdentites();
  const v = mp.sujets.get(`duel:${m.n}`);
  if (!v || !m.duel) return null;
  const ok = duelPermis(mp.p, m.n, mp.joueur);
  const total = totalDe(v.parts);
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label text-white/55">
          {TITRE_MATCH.duel} · qui finit devant{ok.length === 1 ? " · toi" : ""}
        </span>
        <Gain v={v} />
      </div>
      <div className="flex items-stretch gap-2">
        {m.duel.map((nom, i) => {
          const p = allPlayers.find((x) => x.name === nom);
          const actif = v.choix === nom;
          const part = pourcent(v.parts.find(([x]) => x === nom)?.[1] ?? 0, total);
          const ton = i === 0 ? NOIRS : BLANCS;
          return (
            <span key={nom} className="contents">
              {i === 1 && (
                <span aria-hidden className="titre-lettrage self-center text-titre-m text-white/35">
                  vs
                </span>
              )}
              <button
                type="button"
                disabled={ferme || !ok.includes(nom)}
                aria-pressed={actif}
                onClick={() => void poser(mp, v.sujet, actif ? null : nom)}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1.5 overflow-hidden rounded-[14px] border px-2 pt-2.5 pb-2 transition-transform active:scale-[0.97] disabled:active:scale-100",
                  actif ? "border-white ring-2 ring-white ring-offset-2 ring-offset-[#0b0a0e]" : "border-white/15",
                  (ferme || !ok.includes(nom)) && !actif && "opacity-50"
                )}
                style={{ background: ton.fond, color: ton.encre }}
              >
                {p && <PlayerCard player={p} size={FORMAT_CARTE.moyenne} />}
                <span className="max-w-full truncate text-lecture leading-none font-bold">{prenomDe(identite, nom)}</span>
                <span className="font-mono text-legende leading-none tabular-nums opacity-70">{part} %</span>
                {v.bons?.includes(nom) && <span className="absolute top-1.5 right-2 text-legende font-bold" aria-label="Le bon résultat">✓</span>}
                <span aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-current opacity-35" style={{ width: `${part}%` }} />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** Un sujet à cartes (MVP, buteur, passeur) : le choix, et la rangée qui se déplie. */
function SujetJoueur({ mp, sujet, titre, candidats, ferme }: { mp: MesPronos; sujet: string; titre: string; candidats: string[]; ferme: boolean }) {
  const identite = useIdentites();
  const v = mp.sujets.get(sujet);
  if (!v) return null;
  const reponse = mp.p.joue && v.bons?.length ? v.bons.map((n) => prenomDe(identite, n)).join(", ") : null;
  return (
    <ChoixJoueur
      titre={titre}
      v={v}
      candidats={candidats}
      ferme={ferme}
      droite={<Gain v={v} />}
      sous={reponse ? <span className="font-mono text-legende text-white/50">C&apos;est {reponse}</span> : undefined}
      onChoix={(nom) => void poser(mp, sujet, nom)}
    />
  );
}

/** Le bloc d'un match : qui gagne, l'écart, le duel, son MVP, son buteur, son passeur. */
function BlocMatch({ mp, m, entete }: { mp: MesPronos; m: MatchProno; entete?: boolean }) {
  const ferme = mp.phase !== "ouvert";
  const v = mp.sujets.get(`match:${m.n}`)!;
  const e = mp.sujets.get(`ecart:${m.n}`)!;
  const permis = choixPermis(mp.p, m.n, mp.joueur);
  const sien = permis.length === 1;
  const total = totalDe(v.parts);
  const totalE = totalDe(e.parts);
  const ici = [...m.noirs, ...m.blancs];
  const plusieurs = mp.p.matchs.length > 1;
  return (
    <div className="flair__bloc flex flex-col gap-4">
      {entete && (
        <div className="flex items-baseline justify-between gap-3">
          <span className="titre-lettrage text-titre leading-none">{plusieurs ? m.label : "Le match"}</span>
          <span className="mono-label text-white/45">
            {m.noirs.length} contre {m.blancs.length}
          </span>
        </div>
      )}
      <Question titre={`${!entete && plusieurs ? `Qui gagne le ${m.label.toLowerCase()} ?` : "Qui gagne ?"}${sien ? " · ton camp" : ""}`} v={v}>
        {(["noirs", "nul", "blancs"] as Camp[]).map((c) => (
          <Choix
            key={c}
            libelle={NOM_CAMP[c]}
            part={pourcent(v.parts.find(([x]) => x === c)?.[1] ?? 0, total)}
            actif={v.choix === c}
            bon={!!v.bons?.includes(c)}
            ferme={ferme || !permis.includes(c)}
            ton={c === "noirs" ? NOIRS : c === "blancs" ? BLANCS : undefined}
            onClick={() => void poser(mp, v.sujet, v.choix === c ? null : c)}
          />
        ))}
      </Question>
      <Question titre={TITRE_MATCH.ecart} v={e}>
        {ECARTS.map((c) => (
          <Choix
            key={c}
            libelle={NOM_ECART[c]}
            detail={DETAIL_ECART[c]}
            part={pourcent(e.parts.find(([x]) => x === c)?.[1] ?? 0, totalE)}
            actif={e.choix === c}
            bon={!!e.bons?.includes(c)}
            ferme={ferme}
            onClick={() => void poser(mp, e.sujet, e.choix === c ? null : c)}
          />
        ))}
      </Question>
      <Duel mp={mp} m={m} ferme={ferme} />
      {(["mvp", "buteur", "passeur"] as const).map((g) => (
        <SujetJoueur key={g} mp={mp} sujet={`${g}:${m.n}`} titre={`${TITRE_MATCH[g]} du match`} candidats={ici} ferme={ferme} />
      ))}
    </div>
  );
}

/** Le bloc de la journée : le meilleur, le buteur et le passeur du jour, sur toute la feuille. */
function BlocJour({ mp, devant = [] }: { mp: MesPronos; devant?: string[] }) {
  const ferme = mp.phase !== "ouvert";
  const ici = new Set(devant);
  const candidats = [...mp.p.joueurs.filter((x) => ici.has(x)), ...mp.p.joueurs.filter((x) => !ici.has(x))];
  return (
    <div className="flair__bloc flex flex-col gap-4">
      <span className="titre-lettrage text-titre leading-none">La journée</span>
      {SUJETS_JOUR.map((s) => (
        <SujetJoueur key={s} mp={mp} sujet={s} titre={TITRE_JOUR[s]} candidats={candidats} ferme={ferme} />
      ))}
    </div>
  );
}

/** L'en-tête : le titre, ce qui reste avant la fermeture ou le verdict, et la jauge des choix posés. */
function EnTete({ mp, id, titre, sujets }: { mp: MesPronos; id: string; titre: string; sujets: string[] }) {
  const vus = sujets.map((s) => mp.sujets.get(s)).filter((v): v is SujetVu => !!v);
  const poses = vus.filter((v) => v.choix).length;
  const juge = mp.p.joue && vus.some((x) => x.bons);
  const gagne = Math.min(
    mp.plafond,
    [...mp.sujets.values()].filter((x) => x.etat === "juste").reduce((a, x) => a + xpSujet(x.sujet), 0)
  );
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={id} className="titre-lettrage text-titre-m leading-[0.95]">
          {titre}
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
      <div className="flex items-center gap-3">
        <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/10" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full bg-white transition-[width] duration-500" style={{ width: `${pourcent(poses, vus.length)}%` }} />
        </span>
        <span className="mono-label shrink-0 text-white/55 tabular-nums">
          {poses}/{vus.length} choix
        </span>
      </div>
    </div>
  );
}

function Pied({ mp }: { mp: MesPronos }) {
  const tribune = mp.plafond === PLAFOND_TRIBUNE;
  return (
    <p className="mono-label text-white/45">
      {`Toute la journée · ${mp.plafond} XP au plus${tribune ? " depuis la tribune" : ""} · `}
      {mp.phase === "ouvert" ? "ferme au premier coup d'envoi" : "définitif à minuit"}
    </p>
  );
}

const sujetsDe = (mp: MesPronos, m: MatchProno | null) =>
  [...mp.sujets.keys()].filter((s) => !s.includes(":") || (m != null && s.endsWith(`:${m.n}`)));

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
  const m = useMemo(() => (mp && (j == null || j === mp.p.j) ? leMatch(mp, noirs, blancs) : null), [mp, j, noirs, blancs]);
  if (!mp || !m) return null;
  return (
    <section aria-labelledby={`flair-${m.n}`} className="flair flex flex-col gap-4 p-4">
      <EnTete mp={mp} id={`flair-${m.n}`} titre="Le Flair" sujets={sujetsDe(mp, m)} />
      <BlocMatch mp={mp} m={m} />
      <BlocJour mp={mp} devant={[...m.noirs, ...m.blancs]} />
      <Pied mp={mp} />
    </section>
  );
}

/** Toute la journée du Flair sur une page (Ma carte → Le Flair) : la journée, puis chaque match. */
export function FlairDeLaJournee({ mp }: { mp: MesPronos }) {
  return (
    <section aria-labelledby="flair-journee" className="flair flex flex-col gap-4 p-4">
      <EnTete mp={mp} id="flair-journee" titre={`J${mp.p.j}`} sujets={[...mp.sujets.keys()]} />
      <BlocJour mp={mp} />
      {mp.p.matchs.map((m) => (
        <BlocMatch key={m.n} mp={mp} m={m} entete />
      ))}
      <Pied mp={mp} />
    </section>
  );
}
