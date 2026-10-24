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
// Les cartes suivent la hiérarchie de l'app (FORMAT_CARTE) : moyenne pour un
// choix, petite dans la liste où l'on choisit. L'XP va au Niveau XP et au
// passe, jamais aux points Pépite.

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { usePronosJournee, usePronosSaison, type MesPronos, type MesPronosSaison, type SujetVu } from "@/hooks/use-pronos";
import {
  choixPermis,
  PLAFOND_JOURNEE,
  TITRE_SAISON,
  XP_BUTEUR_DU_JOUR,
  XP_MEILLEUR_DU_JOUR,
  XP_VAINQUEUR,
  type Camp,
  type SujetSaison,
} from "@/lib/sfl/pronos";
import { cn } from "@/lib/utils";
import { BLANCS, NOIRS, Pouls } from "./missions";

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

function Verdict({ v, xp }: { v: SujetVu; xp: number }) {
  if (v.etat === "juste")
    return <span className="mono-label text-[#1f7a3a] dark:text-[#9fe0a8]">Juste · +{xp} XP</span>;
  if (v.etat === "faux") return <span className="mono-label text-foreground/45">Raté</span>;
  if (v.etat === "hors-delai") return <span className="mono-label text-foreground/45">Posé trop tard</span>;
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
        actif ? "border-foreground ring-2 ring-foreground ring-offset-2 ring-offset-background" : "border-foreground/15",
        !ton && "bg-background",
        ferme && !actif && "opacity-55"
      )}
      style={ton ? { background: ton.fond, color: ton.encre } : undefined}
    >
      <span className="text-[15px] leading-none font-bold">{libelle}</span>
      <span className="font-mono text-[11px] leading-none tabular-nums opacity-70">{part} %</span>
      {bon && <span className="absolute top-1.5 right-2 text-[11px] font-bold" aria-label="Le bon résultat">✓</span>}
      <span
        aria-hidden
        className="absolute bottom-0 left-0 h-[3px] bg-current opacity-35"
        style={{ width: `${part}%` }}
      />
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
  const prenoms = (l: string[]) => l.map((x) => identite.nom(x).split(" ")[0]).join(", ");
  return (
    <div className="flex flex-col gap-3 rounded-[18px] border border-foreground/10 bg-background p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label text-foreground/55">
          {m.label}
          {sien ? " · ton match" : ""}
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
      <p className="text-[12px] leading-[1.4] text-foreground/55">
        <span className="font-semibold text-foreground/75">Noirs</span> {prenoms(m.noirs)}
        <br />
        <span className="font-semibold text-foreground/75">Blancs</span> {prenoms(m.blancs)}
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

/** Choisir un joueur parmi des cartes : la liste se déplie sous la ligne. */
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
  droite: React.ReactNode;
  sous?: React.ReactNode;
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
    <div ref={ref} className="flex flex-col gap-3 rounded-[18px] border border-foreground/10 bg-background p-4">
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
              className="grid place-items-center rounded-[8px] border border-dashed border-foreground/30 text-[20px] text-foreground/45"
              style={{ width: 254 * FORMAT_CARTE.petite, height: 254 * FORMAT_CARTE.petite * 1.4 }}
            >
              +
            </span>
          )}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="mono-label text-foreground/55">{titre}</span>
          <span className="truncate text-[17px] leading-tight font-bold">
            {choisi ? identite.nom(choisi.name) : ferme ? "Aucun choix" : "Choisir"}
          </span>
          {choisi && total > 0 && (
            <span className="font-mono text-[11px] text-foreground/50 tabular-nums">{part(choisi.name)} % de la ligue</span>
          )}
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
                className={cn(
                  "flex shrink-0 flex-col items-center gap-1.5 rounded-[12px] p-1 transition-transform active:scale-95",
                  actif && "ring-2 ring-foreground"
                )}
              >
                <PlayerCard player={p} size={FORMAT_CARTE.moyenne} />
                <span className="max-w-[78px] truncate text-[12px] leading-none font-semibold">{identite.nom(nom).split(" ")[0]}</span>
                <span className="font-mono text-[10px] leading-none text-foreground/50 tabular-nums">{part(nom)} %</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Journee({ mp }: { mp: MesPronos }) {
  const ferme = mp.phase !== "ouvert";
  const bons = (sujet: string) => mp.sujets.get(sujet)!;
  const libelleBons = (v: SujetVu, identite: ReturnType<typeof useIdentites>) =>
    v.bons?.length ? v.bons.map((n) => identite.nom(n).split(" ")[0]).join(", ") : null;
  const identite = useIdentites();
  return (
    <div className="flex flex-col gap-3">
      {mp.p.matchs.map((m) => (
        <Match key={m.n} mp={mp} n={m.n} />
      ))}
      {(
        [
          ["buteur", "Le buteur du jour", XP_BUTEUR_DU_JOUR],
          ["pepite", "Le meilleur du jour", XP_MEILLEUR_DU_JOUR],
        ] as const
      ).map(([sujet, titre, xp]) => {
        const v = bons(sujet);
        const reponse = mp.p.joue ? libelleBons(v, identite) : null;
        return (
          <ChoixJoueur
            key={sujet}
            titre={titre}
            v={v}
            candidats={mp.p.joueurs}
            ferme={ferme}
            droite={v.etat === "attente" || !v.choix ? <span className="mono-label text-foreground/45">+{xp} XP</span> : <Verdict v={v} xp={xp} />}
            sous={reponse ? <span className="font-mono text-[11px] text-foreground/50">C&apos;est {reponse}</span> : undefined}
            onChoix={(nom) => void poser(mp, sujet, nom)}
          />
        );
      })}
    </div>
  );
}

function Saison({ ms }: { ms: MesPronosSaison }) {
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
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-2 md:px-0">
        <h3 className="titre-lettrage text-[22px] leading-[0.95]">Saison {ms.saison}</h3>
        <span className="mono-label text-foreground/45">Jugée à la fin</span>
      </div>
      <div className="mx-4 flex flex-col gap-3 md:mx-0">
        {(["pepite", "buteur", "passeur"] as SujetSaison[]).map((sujet) => {
          const v = ms.sujets.get(sujet)!;
          const meneurs = v.bons?.length ? v.bons.map((n) => identite.nom(n).split(" ")[0]).join(", ") : null;
          return (
            <ChoixJoueur
              key={sujet}
              titre={TITRE_SAISON[sujet]}
              v={v}
              candidats={ordre(sujet)}
              ferme={false}
              droite={<span className="mono-label text-foreground/70">+{v.prime ?? ms.primeMaintenant} XP</span>}
              sous={meneurs ? <span className="font-mono text-[11px] text-foreground/50">En tête : {meneurs}</span> : undefined}
              onChoix={(nom) => void poser({ poser: (s, c) => ms.poser(s as SujetSaison, c) }, sujet, nom)}
            />
          );
        })}
      </div>
    </div>
  );
}

export function PronosBola({ className }: { className?: string }) {
  const mp = usePronosJournee();
  const ms = usePronosSaison();
  const ref = useRef<HTMLElement>(null);
  const present = !!mp || !!ms;
  useEffect(() => {
    if (present && window.location.hash === "#pronos") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (!present) return null;
  return (
    <section ref={ref} id="pronos" aria-labelledby="titre-pronos" className={cn("flex scroll-mt-4 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label truncate text-foreground/45">{mp ? `J${mp.p.j} · ${mp.p.date}` : "La saison"}</span>
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
      {mp && (
        <div className="mx-4 md:mx-0">
          <Journee mp={mp} />
        </div>
      )}
      {mp && (
        <div className="flex items-baseline justify-between gap-3 px-5 md:px-0">
          <span className="mono-label text-foreground/45">Par journée</span>
          <span className="mono-label text-foreground/70">{PLAFOND_JOURNEE} XP au plus</span>
        </div>
      )}
      {ms && <Saison ms={ms} />}
    </section>
  );
}
