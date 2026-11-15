"use client";

// Un match ou une séance d'un club (Bola Club, bola-app#14 : « convocation,
// appel, saisie rapide des stats → les cartes évoluent avec les règles Bola
// existantes »). Une page enfant du club, pour le staff de la catégorie :
//   · Convocation : chaque convoqué et sa réponse (« Présent », « Absent »,
//     « — »), le compte en tête ; tant que la séance est à venir, tous les
//     licenciés actifs de la catégorie y sont, chacun avec sa coche : la
//     toucher le convoque ou le retire ;
//   · Appel : par joueur, trois états, Présent, Retard, Absent ;
//   · Stats (un match) : le score, puis les buts et les passes de chaque
//     présent, en compteurs − / + ; « Enregistrer », dans une bande pleine au
//     bas de l'écran. Les cartes bougent aussitôt (lib/sfl/club/saison.ts :
//     jauges, « +1 », MVP du match), et le résultat arrive dans les actus.
// L'appel et les stats s'ouvrent le jour de la séance : avant, la page n'a
// que la convocation. La saisie des stats est gardée par la page : passer
// par « Appel » ne la perd pas ; « Enregistrer » s'éteint une fois fait.
// Rien n'est envoyé aux joueurs : la démonstration vit sur le téléphone.

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { jourLong } from "@/lib/sfl/club/actus";
import { convoquer, faireAppel, saisirStats } from "@/lib/sfl/club/mutations";
import { categorieDe, compteReponses, estDeLaCategorie, licenceActive, membreDe, seanceAVenir, seanceOuverte } from "@/lib/sfl/club/regles";
import { nomComplet, type EtatAppel, type LigneStats, type Membre, type Seance as SeanceClub } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { compteDit, titreSeance } from "./fil-club";
import { Compteur, PageEnfant, Segment } from "./puces";

type Vue = "convocation" | "appel" | "stats";

const ETATS: { id: EtatAppel; label: string }[] = [
  { id: "present", label: "Présent" },
  { id: "retard", label: "Retard" },
  { id: "absent", label: "Absent" },
];

function Ligne({ m, children, sous, eteinte = false }: { m: Membre; children: React.ReactNode; sous?: string; eteinte?: boolean }) {
  return (
    <li className="flex items-center gap-3 border-b border-foreground/[0.08] py-2.5 last:border-0">
      <CarteClub id={m.id} format="petite" className={cn(eteinte && "opacity-40")} />
      <span className={cn("flex min-w-0 flex-1 flex-col gap-0.5", eteinte && "opacity-40")}>
        <span className="truncate text-lecture font-semibold">{nomComplet(m)}</span>
        <span className="mono-label text-encre-3">{sous ?? m.poste}</span>
      </span>
      {children}
    </li>
  );
}

function Convocation({ s, joueurs }: { s: SeanceClub; joueurs: Membre[] }) {
  const { club, agir } = useClub();
  const n = compteReponses(s);
  // À venir : tous ceux qu'on peut convoquer, les convoqués d'abord dans l'ordre de l'effectif.
  const aVenir = seanceAVenir(s, club.jour);
  const lignes = aVenir ? club.membres.filter((m) => s.convoques.includes(m.id) || (estDeLaCategorie(m, s.categorie) && licenceActive(club, m.id))) : joueurs;
  return (
    <>
      <span className="mono-label text-encre-3">{n.presents + n.absents > 0 ? compteDit(n) : `${s.convoques.length} ${s.convoques.length > 1 ? "convoqués" : "convoqué"}`}</span>
      <ul className="flex flex-col">
        {lignes.map((m) => {
          const dedans = s.convoques.includes(m.id);
          const r = s.reponses[m.id];
          return (
            <Ligne key={m.id} m={m} eteinte={!dedans}>
              {dedans && (
                <span className={cn("mono-label shrink-0", r === "present" ? "text-foreground" : "text-encre-3")}>
                  {r === "present" ? "Présent" : r === "absent" ? "Absent" : "—"}
                </span>
              )}
              {aVenir && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={dedans}
                  aria-label={`Convoquer ${nomComplet(m)}`}
                  onClick={() => {
                    if (agir((c, moi) => convoquer(c, moi, s.id, m.id, !dedans))) navigator.vibrate?.(10);
                  }}
                  className={cn("grid size-11 shrink-0 place-items-center rounded-full transition-colors", dedans ? "bg-foreground text-background" : "ring-1 ring-foreground/20 ring-inset")}
                >
                  {dedans && <Check className="size-[18px]" strokeWidth={2.6} />}
                </button>
              )}
            </Ligne>
          );
        })}
      </ul>
    </>
  );
}

function Appel({ s, joueurs }: { s: SeanceClub; joueurs: Membre[] }) {
  const { agir } = useClub();
  return (
    <ul className="flex flex-col">
      {joueurs.map((m) => {
        const etat = s.appel[m.id];
        return (
          <li key={m.id} className="flex flex-col gap-2 border-b border-foreground/[0.08] py-3 last:border-0">
            <span className="flex items-center gap-3">
              <CarteClub id={m.id} format="petite" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-lecture font-semibold">{nomComplet(m)}</span>
                <span className="mono-label text-encre-3">{m.poste}</span>
              </span>
            </span>
            <span role="radiogroup" aria-label={`Appel de ${nomComplet(m)}`} className="grid grid-cols-3 gap-1.5">
              {ETATS.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  role="radio"
                  aria-checked={etat === e.id}
                  onClick={() => agir((c, moi) => faireAppel(c, moi, s.id, m.id, e.id))}
                  className={cn("h-11 text-corps font-semibold", etat === e.id ? "bouton-principal" : "bouton-secondaire text-encre-2")}
                >
                  {e.label}
                </button>
              ))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** La saisie en cours d'un match : gardée par la page, elle survit au passage par « Appel ». */
interface Brouillon {
  score: { nous: number; eux: number };
  stats: Record<string, LigneStats>;
  /** Changée depuis le dernier « Enregistrer ». */
  sale: boolean;
}

function Stats({ s, joueurs, brouillon, onBrouillon }: { s: SeanceClub; joueurs: Membre[]; brouillon: Brouillon; onBrouillon: (b: Brouillon) => void }) {
  const { club, agir } = useClub();
  const { score, stats } = brouillon;
  const presents = joueurs.filter((m) => (s.appel[m.id] ?? "present") !== "absent");
  const poser = (id: string, quoi: keyof LigneStats, n: number) => {
    const avant = stats[id] ?? { buts: 0, passes: 0 };
    const suivantes = { ...stats, [id]: { ...avant, [quoi]: n } };
    // Un but de plus pour un joueur monte le score avec lui.
    const buts = Object.entries(suivantes).reduce((t, [k, l]) => t + (presents.some((m) => m.id === k) ? l.buts : 0), 0);
    onBrouillon({ score: buts > score.nous ? { ...score, nous: buts } : score, stats: suivantes, sale: true });
  };
  const enregistrer = () => {
    if (!agir((c, moi) => saisirStats(c, moi, s.id, score, stats))) return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Enregistré");
    onBrouillon({ score, stats, sale: false });
  };
  return (
    <>
      <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-lecture font-semibold">{club.nom}</span>
          <Compteur nom={`Score de ${club.nom}`} valeur={score.nous} onChange={(n) => onBrouillon({ score: { ...score, nous: n }, stats, sale: true })} max={40} grand />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.08] pt-3">
          <span className="min-w-0 flex-1 text-lecture font-semibold">{s.adversaire}</span>
          <Compteur nom={`Score de ${s.adversaire}`} valeur={score.eux} onChange={(n) => onBrouillon({ score: { ...score, eux: n }, stats, sale: true })} max={40} grand />
        </div>
      </div>
      <ul className="flex flex-col">
        {presents.map((m) => (
          <li key={m.id} className="flex flex-col gap-2.5 border-b border-foreground/[0.08] py-3 last:border-0">
            <span className="flex items-center gap-3">
              <CarteClub id={m.id} format="petite" />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-lecture font-semibold">{nomComplet(m)}</span>
                <span className="mono-label text-encre-3">{m.poste}</span>
              </span>
            </span>
            <span className="grid grid-cols-2 gap-3">
              {(
                [
                  ["buts", "Buts"],
                  ["passes", "Passes"],
                ] as const
              ).map(([quoi, label]) => (
                <span key={quoi} className="flex items-center justify-between gap-2">
                  <span className="mono-label text-encre-3">{label}</span>
                  <Compteur nom={`${label} de ${nomComplet(m)}`} valeur={stats[m.id]?.[quoi] ?? 0} onChange={(n) => poser(m.id, quoi, n)} />
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {/* Une bande pleine jusqu'au bas de l'écran : la liste passe dessous sans se lire à travers le bouton. */}
      <div className="sticky bottom-0 z-20 -mx-5 -mb-4 bg-gradient-to-t from-background from-[82%] to-transparent px-5 pt-7 pb-[calc(env(safe-area-inset-bottom,0px)+104px)]">
        <button type="button" disabled={!brouillon.sale} onClick={enregistrer} className="bouton-principal h-12 w-full text-[15px] font-semibold">
          Enregistrer
        </button>
      </div>
    </>
  );
}

export function SeanceDuClub({ id }: { id: string }) {
  const { club, droits } = useClub();
  const s = club.seances.find((x) => x.id === id);
  const match = s?.genre === "match";
  const [vue, setVue] = useState<Vue | null>(null);
  const [saisie, setSaisie] = useState<Brouillon | null>(null);
  if (!s || !droits.gere(s.categorie)) return <PageEnfant titre="Séance">{null}</PageEnfant>;
  const joueurs = s.convoques.map((j) => membreDe(club, j)).filter((m): m is Membre => !!m);
  // Avant le jour de la séance, il n'y a que la convocation : ni appel, ni stats.
  const ouverte = seanceOuverte(s, club.jour);
  const vues: { id: Vue; label: string }[] = [
    { id: "convocation", label: "Convocation" },
    ...(ouverte ? [{ id: "appel" as const, label: "Appel" }] : []),
    ...(ouverte && match ? [{ id: "stats" as const, label: "Stats" }] : []),
  ];
  // Un match joué s'ouvre sur ses stats, une séance passée sur son appel, une convocation sur ses réponses.
  const voulue: Vue = vue ?? (match && s.score ? "stats" : Object.keys(s.appel).length ? "appel" : "convocation");
  const actuelle: Vue = vues.some((v) => v.id === voulue) ? voulue : "convocation";
  // Une saisie jamais enregistrée (un match du jour) reste à enregistrer, même à 0 – 0.
  const brouillon: Brouillon = saisie ?? { score: s.score ?? { nous: 0, eux: 0 }, stats: s.stats, sale: s.score === null };
  return (
    <PageEnfant sur={categorieDe(club, s.categorie)?.nom} titre={titreSeance(club, s)} sous={`${jourLong(s.jour)} · ${s.heure} · ${s.lieu}`}>
      {vues.length > 1 && <Segment nom="Vue" choix={vues} actif={actuelle} onChange={setVue} />}
      {actuelle === "convocation" ? (
        <Convocation s={s} joueurs={joueurs} />
      ) : actuelle === "appel" ? (
        <Appel s={s} joueurs={joueurs} />
      ) : (
        <Stats s={s} joueurs={joueurs} brouillon={brouillon} onBrouillon={setSaisie} />
      )}
    </PageEnfant>
  );
}
