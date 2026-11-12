"use client";

// Un match ou une séance d'un club (Bola Club, bola-app#14 : « convocation,
// appel, saisie rapide des stats → les cartes évoluent avec les règles Bola
// existantes »). Une page enfant du club, pour le staff de la catégorie :
//   · Convocation : chaque convoqué et sa réponse (« Présent », « Absent »,
//     « — »), le compte en tête ;
//   · Appel : par joueur, trois états, Présent, Retard, Absent ;
//   · Stats (un match) : le score, puis les buts et les passes de chaque
//     présent, en compteurs − / + ; « Enregistrer ». Les cartes bougent
//     aussitôt (lib/sfl/club/saison.ts : jauges, « +1 », MVP du match), et le
//     résultat arrive dans les actus du club.
// Rien n'est envoyé aux joueurs : la démonstration vit sur le téléphone.

import { useState } from "react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { jourLong } from "@/lib/sfl/club/actus";
import { faireAppel, saisirStats } from "@/lib/sfl/club/mutations";
import { categorieDe, compteReponses, membreDe } from "@/lib/sfl/club/regles";
import { nomComplet, type EtatAppel, type LigneStats, type Membre, type Seance as SeanceClub } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { titreSeance } from "./fil-club";
import { Compteur, PageEnfant, Segment } from "./puces";

type Vue = "convocation" | "appel" | "stats";

const ETATS: { id: EtatAppel; label: string }[] = [
  { id: "present", label: "Présent" },
  { id: "retard", label: "Retard" },
  { id: "absent", label: "Absent" },
];

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

function Ligne({ m, children, sous }: { m: Membre; children: React.ReactNode; sous?: string }) {
  return (
    <li className="flex items-center gap-3 border-b border-foreground/[0.08] py-2.5 last:border-0">
      <CarteClub id={m.id} format="petite" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-lecture font-semibold">{nomComplet(m)}</span>
        <span className="mono-label text-encre-3">{sous ?? m.poste}</span>
      </span>
      {children}
    </li>
  );
}

function Convocation({ s, joueurs }: { s: SeanceClub; joueurs: Membre[] }) {
  const n = compteReponses(s);
  return (
    <>
      <span className="mono-label text-encre-3">
        {[pluriel(n.presents, "présent", "présents"), pluriel(n.absents, "absent", "absents"), `${n.sansReponse} sans réponse`].join(" · ")}
      </span>
      <ul className="flex flex-col">
        {joueurs.map((m) => {
          const r = s.reponses[m.id];
          return (
            <Ligne key={m.id} m={m}>
              <span className={cn("mono-label shrink-0", r === "present" ? "text-foreground" : "text-encre-3")}>
                {r === "present" ? "Présent" : r === "absent" ? "Absent" : "—"}
              </span>
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
                  className={cn("h-10 text-corps font-semibold", etat === e.id ? "bouton-principal" : "bouton-secondaire text-encre-2")}
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

function Stats({ s, joueurs }: { s: SeanceClub; joueurs: Membre[] }) {
  const { club, agir } = useClub();
  const [score, setScore] = useState(s.score ?? { nous: 0, eux: 0 });
  const [stats, setStats] = useState<Record<string, LigneStats>>(s.stats);
  const presents = joueurs.filter((m) => (s.appel[m.id] ?? "present") !== "absent");
  const poser = (id: string, quoi: keyof LigneStats, n: number) => {
    const avant = stats[id] ?? { buts: 0, passes: 0 };
    const ligne = { ...avant, [quoi]: n };
    setStats({ ...stats, [id]: ligne });
    // Un but de plus pour un joueur monte le score avec lui.
    const buts = Object.entries({ ...stats, [id]: ligne }).reduce((t, [k, l]) => t + (presents.some((m) => m.id === k) ? l.buts : 0), 0);
    if (buts > score.nous) setScore({ ...score, nous: buts });
  };
  const enregistrer = () => {
    if (!agir((c, moi) => saisirStats(c, moi, s.id, score, stats))) return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Enregistré");
  };
  return (
    <>
      <div className="flex flex-col gap-3 rounded-[22px] bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 text-lecture font-semibold">{club.nom}</span>
          <Compteur nom={`Score de ${club.nom}`} valeur={score.nous} onChange={(n) => setScore({ ...score, nous: n })} max={40} grand />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-foreground/[0.08] pt-3">
          <span className="min-w-0 flex-1 text-lecture font-semibold">{s.adversaire}</span>
          <Compteur nom={`Score de ${s.adversaire}`} valeur={score.eux} onChange={(n) => setScore({ ...score, eux: n })} max={40} grand />
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
      <button type="button" onClick={enregistrer} className="bouton-principal sticky bottom-[calc(env(safe-area-inset-bottom,0px)+96px)] z-20 h-12 text-[15px] font-semibold">
        Enregistrer
      </button>
    </>
  );
}

export function SeanceDuClub({ id }: { id: string }) {
  const { club, droits } = useClub();
  const s = club.seances.find((x) => x.id === id);
  const match = s?.genre === "match";
  const [vue, setVue] = useState<Vue | null>(null);
  if (!s || !droits.gere(s.categorie)) return <PageEnfant titre="Séance">{null}</PageEnfant>;
  const joueurs = s.convoques.map((j) => membreDe(club, j)).filter((m): m is Membre => !!m);
  // Un match joué s'ouvre sur ses stats, une séance passée sur son appel, une convocation sur ses réponses.
  const actuelle: Vue = vue ?? (match && s.score ? "stats" : Object.keys(s.appel).length ? "appel" : "convocation");
  const vues: { id: Vue; label: string }[] = [
    { id: "convocation", label: "Convocation" },
    { id: "appel", label: "Appel" },
    ...(match ? [{ id: "stats" as const, label: "Stats" }] : []),
  ];
  return (
    <PageEnfant titre={`${categorieDe(club, s.categorie)?.nom ?? ""} · ${titreSeance(club, s)}`} sous={`${jourLong(s.jour)} · ${s.heure} · ${s.lieu}`}>
      <Segment nom="Vue" choix={vues} actif={actuelle} onChange={setVue} />
      {actuelle === "convocation" ? <Convocation s={s} joueurs={joueurs} /> : actuelle === "appel" ? <Appel s={s} joueurs={joueurs} /> : <Stats key={s.id} s={s} joueurs={joueurs} />}
    </PageEnfant>
  );
}
