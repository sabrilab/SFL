"use client";

// Le Flair (les pronos Bola ; nom choisi par Sabri le 24/10), dans les Actus, juste sous les Missions Bola (lib/sfl/
// pronos.ts). Sabri, 24/10 : « que le joueur puisse pronostiquer des choses
// dans les matchs à venir ou les journées », « qui finira meilleur buteur,
// qui finira meilleure Pépite d'Or ».
//
//   · la journée, dès que ses équipes sont faites : chaque match, Noirs, nul
//     ou Blancs (sur ton propre match, ton camp seulement), puis le buteur et
//     le meilleur du jour, choisis sur les cartes de la feuille. Sous chaque
//     choix, la part de la ligue. Tout ferme au premier coup d'envoi ; le
//     verdict tombe avec la feuille, définitif à minuit ;
//   · la saison : la Pépite d'Or, le meilleur buteur, le meilleur passeur,
//     avec la prime qu'un choix posé maintenant rapporterait (plus tôt, plus
//     d'XP) et celui qui mène aujourd'hui.
//
// Sabri, 24/10 au soir : « il faut qu'il soit mieux réfléchi et mieux intégré
// dans les actus […] qu'on puisse déplier des choses, bien comprendre ce qui
// se passe ». Le Flair est donc une seule fiche noire, de la famille des
// Missions Bola et des contrats (dans les deux modes), faite de trois plis :
//   · la journée : replié, ce que tu as choisi match par match (ou « — »),
//     puis le verdict de chacun ; déplié, les choix ;
//   · la saison : replié, tes trois choix et la prime d'un choix posé
//     maintenant ; déplié, les cartes ;
//   · comment ça marche : les règles, en cinq lignes.
// Un pli s'ouvre à la fois. La fiche dit d'un coup d'œil où tu en es :
// « 2 / 4 choisis », « +60 XP », « Ferme dans 15:42 ».
//
// Les cartes suivent la hiérarchie de l'app (FORMAT_CARTE) : moyenne dans la
// liste où l'on choisit, petite une fois choisie. L'XP va au Niveau XP et au
// passe, jamais aux points Pépite.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { usePronosJournee, usePronosSaison, type MesPronos, type MesPronosSaison, type SujetVu } from "@/hooks/use-pronos";
import {
  choixPermis,
  PLAFOND_JOURNEE,
  PRIME_SAISON_MAX,
  PRIME_SAISON_MIN,
  PRIME_SAISON_PAS,
  SUJETS_SAISON,
  TITRE_SAISON,
  XP_BUTEUR_DU_JOUR,
  XP_MEILLEUR_DU_JOUR,
  XP_VAINQUEUR,
  xpSujet,
  type Camp,
  type SujetSaison,
} from "@/lib/sfl/pronos";
import { cn } from "@/lib/utils";
import { BLANCS, NOIRS, Pouls } from "./missions";
import "./flair.css";

const NOM_CAMP: Record<Camp, string> = { noirs: "Noirs", nul: "Nul", blancs: "Blancs" };

const pourcent = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);
const totalDe = (parts: [string, number][]) => parts.reduce((a, [, n]) => a + n, 0);

/** Le temps qui reste avant le premier coup d'envoi : « 1 j 02:14 ». */
function FermeDans({ fin }: { fin: Date }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const m = Math.max(0, Math.floor((fin.getTime() - t) / 60_000));
  const j = Math.floor(m / 1440);
  const deux = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="mono-label flex shrink-0 items-baseline gap-2 text-foreground/45">
      Ferme dans
      <span className="text-[12px] text-foreground tabular-nums">
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

/**
 * Un pli de la fiche : sa ligne (titre, où tu en es, ce que ça rapporte) se
 * touche pour déplier ; replié, le résumé reste sous la ligne.
 */
function Pli({
  titre,
  etat,
  droite,
  resume,
  ouvert,
  onBascule,
  children,
}: {
  titre: string;
  etat?: ReactNode;
  droite?: ReactNode;
  resume?: ReactNode;
  ouvert: boolean;
  onBascule: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flair__pli" data-ouvert={ouvert || undefined}>
      <button type="button" aria-expanded={ouvert} onClick={onBascule} className="flair__ligne">
        <span className="flex min-w-0 flex-1 flex-col gap-1 text-left">
          <span className="text-[17px] leading-tight font-bold">{titre}</span>
          {etat && <span className="mono-label truncate text-white/55">{etat}</span>}
        </span>
        {droite && <span className="mono-label shrink-0 text-white/75">{droite}</span>}
        <ChevronDown aria-hidden className="flair__chevron size-[18px] shrink-0 text-white/55" />
      </button>
      {resume && !ouvert && <div className="px-4 pb-4">{resume}</div>}
      <div className="flair__depli">
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}

/** Une puce du résumé : « M1 Blancs », « Buteur — » ; verte si c'est juste, barrée si c'est raté. */
function Puce({ quoi, valeur, etat }: { quoi: string; valeur: string | null; etat?: SujetVu["etat"] }) {
  return (
    <span className={cn("flair__puce", valeur && "flair__puce--pose", etat === "juste" && "flair__puce--juste", etat === "faux" && "flair__puce--faux")}>
      <span className="text-white/50">{quoi}</span>
      <span className="font-semibold">{valeur ?? "—"}</span>
      {etat === "juste" && <span aria-label="juste">✓</span>}
    </span>
  );
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
      <span className="text-[15px] leading-none font-bold">{libelle}</span>
      <span className="font-mono text-[11px] leading-none tabular-nums opacity-70">{part} %</span>
      {bon && <span className="absolute top-1.5 right-2 text-[11px] font-bold" aria-label="Le bon résultat">✓</span>}
      <span aria-hidden className="absolute bottom-0 left-0 h-[3px] bg-current opacity-35" style={{ width: `${part}%` }} />
    </button>
  );
}

function Match({ mp, n }: { mp: MesPronos; n: number }) {
  const identite = useIdentites();
  const m = mp.p.matchs.find((x) => x.n === n)!;
  const v = mp.sujets.get(`match:${n}`)!;
  const permis = choixPermis(mp.p, n, mp.joueur);
  const sien = permis.length === 1;
  const total = totalDe(v.parts);
  const ferme = mp.phase !== "ouvert";
  const prenoms = (l: string[]) => l.map((x) => prenomDe(identite, x)).join(", ");
  return (
    <div className="flair__bloc flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label text-white/55">
          {m.label}
          {sien ? " · ton match, ton camp" : ""}
        </span>
        <Verdict v={v} xp={XP_VAINQUEUR} />
      </div>
      <div className="flex gap-2">
        {(["noirs", "nul", "blancs"] as Camp[]).map((c) => {
          const part = pourcent(v.parts.find(([x]) => x === c)?.[1] ?? 0, total);
          return (
            <Choix
              key={c}
              libelle={NOM_CAMP[c]}
              part={part}
              actif={v.choix === c}
              bon={!!v.bons?.includes(c)}
              ferme={ferme || !permis.includes(c)}
              ton={c === "noirs" ? NOIRS : c === "blancs" ? BLANCS : undefined}
              onClick={() => void poser(mp, `match:${n}`, v.choix === c ? null : c)}
            />
          );
        })}
      </div>
      <p className="text-[12px] leading-[1.4] text-white/55">
        <span className="font-semibold text-white/80">Noirs</span> {prenoms(m.noirs)}
        <br />
        <span className="font-semibold text-white/80">Blancs</span> {prenoms(m.blancs)}
      </p>
    </div>
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
              className="grid place-items-center rounded-[8px] border border-dashed border-white/30 text-[20px] text-white/50"
              style={{ width: 254 * FORMAT_CARTE.petite, height: 254 * FORMAT_CARTE.petite * 1.4 }}
            >
              +
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="mono-label text-white/55">{titre}</span>
          <span className="truncate text-[17px] leading-tight font-bold">
            {choisi ? identite.nom(choisi.name) : ferme ? "Aucun choix" : "Choisir"}
          </span>
          {choisi && total > 0 && <span className="font-mono text-[11px] text-white/50 tabular-nums">{part(choisi.name)} % de la ligue</span>}
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
                <span className="max-w-[78px] truncate text-[12px] leading-none font-semibold">{prenomDe(identite, nom)}</span>
                <span className="font-mono text-[10px] leading-none text-white/50 tabular-nums">{part(nom)} %</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SUJETS_JOUR = [
  ["buteur", "Le buteur du jour", "Buteur", XP_BUTEUR_DU_JOUR],
  ["pepite", "Le meilleur du jour", "Meilleur", XP_MEILLEUR_DU_JOUR],
] as const;

/** Le pli de la journée : les matchs, le buteur et le meilleur du jour. */
function PliJournee({ mp, ouvert, onBascule }: { mp: MesPronos; ouvert: boolean; onBascule: () => void }) {
  const identite = useIdentites();
  const ferme = mp.phase !== "ouvert";
  const sujets = [...mp.sujets.values()];
  const poses = sujets.filter((v) => v.choix).length;
  const justes = sujets.filter((v) => v.etat === "juste");
  const gagne = Math.min(PLAFOND_JOURNEE, justes.reduce((a, v) => a + xpSujet(v.sujet), 0));
  const juge = mp.p.joue && sujets.some((v) => v.bons);
  const nomChoix = (sujet: string, choix: string | null) =>
    !choix ? null : sujet.startsWith("match:") ? NOM_CAMP[choix as Camp] : prenomDe(identite, choix);
  const etat = juge
    ? `${justes.length} juste${justes.length > 1 ? "s" : ""} sur ${poses}`
    : ferme
      ? poses
        ? `${poses} choix · verdict avec la feuille`
        : "Fermé · aucun choix"
      : `${poses} / ${sujets.length} choisis`;
  const droite = juge ? (gagne ? <span className="text-[#9fe0a8]">+{gagne} XP</span> : "0 XP") : `${PLAFOND_JOURNEE} XP au plus`;
  return (
    <Pli
      titre={`La journée ${mp.p.j}`}
      etat={etat}
      droite={droite}
      ouvert={ouvert}
      onBascule={onBascule}
      resume={
        <div className="flex flex-wrap gap-1.5">
          {mp.p.matchs.map((m, i) => {
            const v = mp.sujets.get(`match:${m.n}`)!;
            return <Puce key={m.n} quoi={`M${i + 1}`} valeur={nomChoix(v.sujet, v.choix)} etat={v.etat} />;
          })}
          {SUJETS_JOUR.map(([sujet, , court]) => {
            const v = mp.sujets.get(sujet)!;
            return <Puce key={sujet} quoi={court} valeur={nomChoix(sujet, v.choix)} etat={v.etat} />;
          })}
        </div>
      }
    >
      {mp.p.matchs.map((m) => (
        <Match key={m.n} mp={mp} n={m.n} />
      ))}
      {SUJETS_JOUR.map(([sujet, titre, , xp]) => {
        const v = mp.sujets.get(sujet)!;
        const reponse = mp.p.joue && v.bons?.length ? v.bons.map((n) => prenomDe(identite, n)).join(", ") : null;
        return (
          <ChoixJoueur
            key={sujet}
            titre={titre}
            v={v}
            candidats={mp.p.joueurs}
            ferme={ferme}
            droite={v.etat === "attente" || !v.choix ? <span className="mono-label text-white/50">+{xp} XP</span> : <Verdict v={v} xp={xp} />}
            sous={reponse ? <span className="font-mono text-[11px] text-white/50">C&apos;est {reponse}</span> : undefined}
            onChoix={(nom) => void poser(mp, sujet, nom)}
          />
        );
      })}
    </Pli>
  );
}

const COURT_SAISON: Record<SujetSaison, string> = { pepite: "Pépite d'Or", buteur: "Buteur", passeur: "Passeur" };

/** Le pli de la saison : la Pépite d'Or, le meilleur buteur, le meilleur passeur. */
function PliSaison({ ms, ouvert, onBascule }: { ms: MesPronosSaison; ouvert: boolean; onBascule: () => void }) {
  const identite = useIdentites();
  const { allPlayers } = useSeason();
  // Les candidats dans l'ordre qui aide à choisir : les buteurs par buts, les passeurs par passes D.
  const ordre = (sujet: SujetSaison) => {
    if (sujet === "pepite") return ms.candidats;
    const n = (nom: string) => {
      const p = allPlayers.find((x) => x.name === nom);
      return (sujet === "buteur" ? p?.buts : p?.passes) ?? 0;
    };
    return [...ms.candidats].sort((a, b) => n(b) - n(a));
  };
  const sujets = SUJETS_SAISON.map((s) => [s, ms.sujets.get(s)!] as const);
  const poses = sujets.filter(([, v]) => v.choix).length;
  return (
    <Pli
      titre={`La saison ${ms.saison}`}
      etat={`${poses} / 3 choisis`}
      droite={`+${ms.primeMaintenant} XP chacun`}
      ouvert={ouvert}
      onBascule={onBascule}
      resume={
        <div className="flex flex-wrap gap-1.5">
          {sujets.map(([s, v]) => (
            <Puce key={s} quoi={COURT_SAISON[s]} valeur={v.choix ? prenomDe(identite, v.choix) : null} />
          ))}
        </div>
      }
    >
      {sujets.map(([sujet, v]) => {
        const meneurs = v.bons?.length ? v.bons.map((n) => prenomDe(identite, n)).join(", ") : null;
        return (
          <ChoixJoueur
            key={sujet}
            titre={TITRE_SAISON[sujet]}
            v={v}
            candidats={ordre(sujet)}
            ferme={false}
            droite={<span className="mono-label text-white/75">+{v.prime ?? ms.primeMaintenant} XP</span>}
            sous={meneurs ? <span className="font-mono text-[11px] text-white/50">En tête aujourd&apos;hui : {meneurs}</span> : undefined}
            onChoix={(nom) => void poser({ poser: (s, c) => ms.poser(s as SujetSaison, c) }, sujet, nom)}
          />
        );
      })}
    </Pli>
  );
}

/** Le pli des règles : ce qui se joue, ce que ça rapporte, quand c'est jugé. */
function PliRegles({ ouvert, onBascule }: { ouvert: boolean; onBascule: () => void }) {
  const lignes: [string, string][] = [
    ["Quand", "Dès que les équipes de la journée sont faites, jusqu'au premier coup d'envoi. Après, plus rien ne bouge."],
    ["La journée", `Le vainqueur de chaque match +${XP_VAINQUEUR} XP, le buteur du jour +${XP_BUTEUR_DU_JOUR}, le meilleur du jour (le plus de points Pépite) +${XP_MEILLEUR_DU_JOUR}. ${PLAFOND_JOURNEE} XP au plus par journée.`],
    ["Ton match", "Sur ton propre match, tu ne peux miser que sur ton camp."],
    ["La saison", `La Pépite d'Or, le meilleur buteur, le meilleur passeur. Plus tôt tu choisis, plus ça rapporte : ${PRIME_SAISON_MAX} XP avant la première journée, ${PRIME_SAISON_PAS} de moins à chaque journée jouée, jamais moins de ${PRIME_SAISON_MIN}. Changer d'avis prend la prime du moment.`],
    ["Le verdict", "La journée se juge avec la feuille de match, définitif à minuit ; la saison, à sa clôture. Ex æquo en tête : tout le monde a juste. L'XP va au Niveau XP et au passe, jamais aux points Pépite."],
  ];
  return (
    <Pli titre="Comment ça marche" ouvert={ouvert} onBascule={onBascule}>
      <dl className="flex flex-col gap-3">
        {lignes.map(([quoi, texte]) => (
          <div key={quoi} className="flex flex-col gap-1">
            <dt className="mono-label text-white/50">{quoi}</dt>
            <dd className="text-[13px] leading-[1.45] text-white/85">{texte}</dd>
          </div>
        ))}
      </dl>
    </Pli>
  );
}

type Ouvert = "journee" | "saison" | "regles" | null;

export function PronosBola({ className }: { className?: string }) {
  const mp = usePronosJournee();
  const ms = usePronosSaison();
  const ref = useRef<HTMLElement>(null);
  // Arrivé par le lien /ligue#pronos : la journée déjà dépliée.
  const [ouvert, setOuvert] = useState<Ouvert>(() =>
    typeof window !== "undefined" && window.location.hash === "#pronos" ? "journee" : null
  );
  const present = !!mp || !!ms;
  useEffect(() => {
    if (present && window.location.hash === "#pronos") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (!present) return null;
  const bascule = (o: Exclude<Ouvert, null>) => () => setOuvert((x) => (x === o ? null : o));
  return (
    <section ref={ref} id="pronos" aria-labelledby="titre-pronos" className={cn("flex scroll-mt-4 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label truncate text-foreground/45">{mp ? `J${mp.p.j} · ${mp.p.date}` : `Saison ${ms?.saison ?? ""}`}</span>
          {mp &&
            (mp.phase === "ouvert" ? (
              <FermeDans fin={mp.p.coupEnvoi} />
            ) : mp.phase === "en-jeu" && !mp.p.joue ? (
              <span className="mono-label flex shrink-0 items-center gap-2 text-foreground/80">
                <Pouls bat /> En jeu
              </span>
            ) : (
              <span className="mono-label shrink-0 text-foreground/55">{mp.phase === "en-jeu" ? "Verdict à minuit" : "Verdict"}</span>
            ))}
        </div>
        <h2 id="titre-pronos" className="titre-lettrage text-[30px] leading-[0.95]">
          Le Flair
        </h2>
      </div>
      <div className="flair mx-4 md:mx-0">
        {mp && <PliJournee mp={mp} ouvert={ouvert === "journee"} onBascule={bascule("journee")} />}
        {ms && <PliSaison ms={ms} ouvert={ouvert === "saison"} onBascule={bascule("saison")} />}
        <PliRegles ouvert={ouvert === "regles"} onBascule={bascule("regles")} />
      </div>
    </section>
  );
}
