"use client";

// Le championnat de Bola Team, à l'écran (Sabri, 24/10 : « inspire-toi d'un
// championnat comme la Ligue 1 […] c'est des classements d'équipes. Les buts
// et les passes D peuvent être comptabilisés, mais ça donne mieux juste un
// classement des buteurs et des passeurs de ce championnat »). Les règles et
// le calcul : lib/sfl/championnat-team.ts.
//
// De haut en bas :
//   · la saison (« Saison 1 », ses dates) et, dès qu'il y en a plusieurs,
//     les divisions (D1, D2…), la mienne d'abord ;
//   · le tableau, comme celui de la Ligue 1 : rang, écusson, équipe, joués,
//     différence, points (et victoires, nuls, défaites, buts dès que la
//     place le permet, la forme sur ordinateur). Le podium de la D1 en or,
//     argent et bronze ; les places qui montent liserées de vert, celles qui
//     descendent de rouge ; mon équipe surlignée ;
//   · les buteurs et les passeurs du championnat ;
//   · les récompenses de la saison : le champion, le meilleur buteur, le
//     meilleur passeur (« en tête » tant que la saison court) ;
//   · les derniers résultats, un amical marqué comme tel.
// Sur tablette et ordinateur, deux colonnes au nombre d'or : le tableau à
// gauche, le reste à droite.

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Trophy } from "lucide-react";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson, EcussonVide } from "@/components/sfl/equipe/ecusson";
import { LIGNE_PODIUM, RangMetal } from "@/components/sfl/rang-metal";
import { Nom } from "@/components/sfl/nom";
import {
  championnat,
  periodeSaison,
  saisonEnCours,
  zone,
  type Classe,
  type Division,
  type MatchTeam,
} from "@/lib/sfl/championnat-team";
import type { EquipeTeam } from "@/lib/sfl/equipes";
import { libelleJour } from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

function Pilules<T extends string | number>({ choix, actif, onChange, label }: { choix: { id: T; label: string }[]; actif: T; onChange: (id: T) => void; label: string }) {
  return (
    <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label={label}>
      {choix.map((c) => (
        <button
          key={c.id}
          type="button"
          role="tab"
          aria-selected={actif === c.id}
          onClick={() => onChange(c.id)}
          className={cn("shrink-0 px-4 py-2 text-[13px] font-semibold whitespace-nowrap", actif === c.id ? "bouton-principal" : "bouton-secondaire text-foreground/60")}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Tableau({ d, equipes, mienne }: { d: Division; equipes: Map<number, EquipeTeam>; mienne: number | null }) {
  const joue = d.lignes.some((l) => l.j > 0);
  const col = "w-6 text-center tabular-nums";
  return (
    <div className="overflow-hidden rounded-[22px] bg-card">
      <div className="mono-label flex items-center gap-2 px-3 pt-3 pb-2 text-foreground/40">
        <span className="w-[3px]" />
        <span className="w-[26px] text-center">#</span>
        <span className="flex-1">Équipe</span>
        <span className={col}>J</span>
        <span className={cn(col, "hidden sm:block")}>G</span>
        <span className={cn(col, "hidden sm:block")}>N</span>
        <span className={cn(col, "hidden sm:block")}>P</span>
        <span className={cn(col, "hidden lg:block")}>BP</span>
        <span className={cn(col, "hidden lg:block")}>BC</span>
        <span className="w-8 text-center">Diff</span>
        <span className="w-8 text-center">Pts</span>
        <span className="hidden w-[68px] text-center xl:block">Forme</span>
      </div>
      <ol>
        {d.lignes.map((l) => {
          const e = equipes.get(l.equipe);
          if (!e) return null;
          const z = joue ? zone(d, l) : null;
          const podium = z === "podium" && l.rang <= 3 ? (l.rang as 1 | 2 | 3) : null;
          return (
            <li
              key={l.equipe}
              className={cn(
                "flex items-center gap-2 border-t border-contraste/[0.06] px-3 py-2",
                podium && LIGNE_PODIUM[podium],
                l.equipe === mienne && "bg-primary/10"
              )}
            >
              <span
                aria-hidden
                className={cn("h-7 w-[3px] rounded-full", z === "monte" ? "bg-[#16924A]" : z === "descend" ? "bg-[#D3212C]" : "bg-transparent")}
              />
              {joue && l.j > 0 ? <RangMetal rang={podium ?? l.rang} /> : <span className="w-[26px] text-center text-foreground/30">–</span>}
              <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={26} />
              <span className={cn("min-w-0 flex-1 truncate text-[14.5px] font-semibold", e.dissoute && "text-muted-foreground line-through")}>{e.nom}</span>
              <span className={cn(col, "text-[14px] text-foreground/70")}>{l.j}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 sm:block")}>{l.g}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 sm:block")}>{l.n}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 sm:block")}>{l.p}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 lg:block")}>{l.bp}</span>
              <span className={cn(col, "hidden text-[14px] text-foreground/70 lg:block")}>{l.bc}</span>
              <span className="w-8 text-center text-[14px] text-foreground/70 tabular-nums">{l.diff > 0 ? `+${l.diff}` : l.diff}</span>
              <span className="w-8 text-center text-[16px] font-extrabold tabular-nums">{l.pts}</span>
              <span className="hidden w-[68px] justify-center gap-[3px] xl:flex">
                {l.forme.map((r, i) => (
                  <span
                    key={i}
                    className={cn(
                      "grid size-[12px] place-items-center rounded-full text-[7px] font-black text-white",
                      r === "V" ? "bg-[#16924A]" : r === "N" ? "bg-[#9AA0A6]" : "bg-[#D3212C]"
                    )}
                  >
                    {r}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      {joue && (d.montent > 0 || d.descendent > 0) && (
        <div className="mono-label flex gap-4 border-t border-contraste/[0.06] px-4 py-2.5 text-foreground/45">
          {d.montent > 0 && (
            <span className="flex items-center gap-1.5">
              <ArrowUp className="size-3 text-[#16924A]" strokeWidth={3} />
              Montée
            </span>
          )}
          {d.descendent > 0 && (
            <span className="flex items-center gap-1.5">
              <ArrowDown className="size-3 text-[#D3212C]" strokeWidth={3} />
              Descente
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function ListeJoueurs({ joueurs, cle, equipes, unite }: { joueurs: Classe[]; cle: "buts" | "passes"; equipes: Map<number, EquipeTeam>; unite: string }) {
  const [tout, setTout] = useState(false);
  if (joueurs.length === 0) return <div className="rounded-[22px] bg-card px-5 py-6 text-center text-[14px] text-muted-foreground">Personne pour l&apos;instant.</div>;
  return (
    <div className="flex flex-col gap-1.5">
      {joueurs.slice(0, tout ? undefined : 10).map((c) => {
        const e = equipes.get(c.equipe);
        return (
          <div key={c.joueur} className={cn("flex items-center gap-3 rounded-[18px] bg-card px-3 py-2", c.rang <= 3 && LIGNE_PODIUM[c.rang as 1 | 2 | 3])}>
            <RangMetal rang={c.rang} />
            <CarteDe name={c.name} size={FORMAT_CARTE.petite} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[14.5px] font-semibold">
                <Nom n={c.name} />
              </span>
              {e && <span className="truncate text-[12px] text-muted-foreground">{e.nom}</span>}
            </span>
            {e && <Ecusson initiales={e.initiales} fond={e.fond} blason={e.blason} taille={22} />}
            <span className="w-14 text-right text-[18px] font-extrabold tabular-nums">
              {c[cle]}
              <span className="mono-label ml-1 text-foreground/40">{unite}</span>
            </span>
          </div>
        );
      })}
      {!tout && joueurs.length > 10 && (
        <button type="button" onClick={() => setTout(true)} className="bouton-secondaire self-center px-5 py-2.5 text-[13px] font-semibold">
          Tout le classement · {joueurs.length}
        </button>
      )}
    </div>
  );
}

function Recompense({ titre, enTete, children }: { titre: string; enTete: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 rounded-[22px] bg-card px-2 pt-3 pb-3 text-center">
      <span className="mono-label text-[#94640f] dark:text-[#e2b13c]">{titre}</span>
      {children}
      {enTete && <span className="mono-label text-foreground/40">En tête</span>}
    </div>
  );
}

export function ChampionnatTeam({
  equipes,
  matchs,
  mienne,
  maintenant,
}: {
  equipes: EquipeTeam[];
  matchs: MatchTeam[];
  mienne: number | null;
  maintenant?: Date;
}) {
  const c = useMemo(() => {
    const now = maintenant ?? new Date();
    return championnat(saisonEnCours(now), equipes, matchs, now);
  }, [maintenant, equipes, matchs]);
  const parId = useMemo(() => new Map(equipes.map((e) => [e.id, e])), [equipes]);
  const maDivision = (mienne != null ? c.divisionDe.get(mienne) : null) ?? 1;
  const [division, setDivision] = useState<number | null>(null);
  const [vue, setVue] = useState<"buts" | "passes">("buts");
  const d = c.divisions.find((x) => x.n === (division ?? maDivision)) ?? c.divisions[0];
  const engagees = c.divisions.reduce((n, x) => n + x.lignes.length, 0);
  const valides = c.matchs.filter((x) => x.etat.etat === "valide");
  const d1 = c.divisions[0];
  const champion = d1?.lignes[0] && d1.lignes[0].j > 0 ? parId.get(d1.lignes[0].equipe) : null;
  const buteur = c.buteurs[0] ?? null;
  const passeur = c.passeurs[0] ?? null;

  return (
    <div className="flex flex-col gap-6 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)]">
      <section className="flex flex-col gap-3 md:min-w-0">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="text-[24px] leading-none font-bold tracking-tight">Saison {c.saison}</h2>
            <span className="mono-label text-muted-foreground">{periodeSaison(c.saison)}</span>
          </div>
          {engagees > 0 && (
            <span className="mono-label shrink-0 text-muted-foreground">
              {engagees} équipe{engagees > 1 ? "s" : ""}
            </span>
          )}
        </div>
        {c.divisions.length > 1 && (
          <Pilules
            label="Division"
            choix={c.divisions.map((x) => ({ id: x.n, label: x.nom }))}
            actif={d?.n ?? 1}
            onChange={(n) => setDivision(n)}
          />
        )}
        {d && d.lignes.length > 0 ? (
          <Tableau d={d} equipes={parId} mienne={mienne} />
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-[22px] bg-card px-5 py-8 text-center">
            <EcussonVide taille={56} className="text-foreground/25" />
            <span className="text-[14px] text-muted-foreground">Aucune équipe engagée pour l&apos;instant.</span>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-6 md:min-w-0">
        <section className="flex flex-col gap-3">
          <Pilules
            label="Classement des joueurs"
            choix={[
              { id: "buts" as const, label: "Buteurs" },
              { id: "passes" as const, label: "Passeurs" },
            ]}
            actif={vue}
            onChange={setVue}
          />
          <ListeJoueurs
            key={vue}
            joueurs={vue === "buts" ? c.buteurs : c.passeurs}
            cle={vue}
            equipes={parId}
            unite={vue === "buts" ? "buts" : "pd"}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="px-1 text-[17px] font-bold tracking-tight">Récompenses</h2>
          <div className="grid grid-cols-3 gap-2">
            <Recompense titre="Champion" enTete={!c.finie && !!champion}>
              {champion ? (
                <>
                  <span className="relative">
                    <Ecusson initiales={champion.initiales} fond={champion.fond} blason={champion.blason} taille={46} />
                    <Trophy className="absolute -top-1 -right-2 size-4 text-[#d9a531]" strokeWidth={2.4} />
                  </span>
                  <span className="w-full truncate text-[12.5px] font-semibold">{champion.nom}</span>
                </>
              ) : (
                <>
                  <EcussonVide taille={46} className="text-foreground/25" />
                  <span className="text-[12.5px] text-muted-foreground">–</span>
                </>
              )}
            </Recompense>
            {[
              { titre: "Buteur", j: buteur, v: buteur?.buts, u: "buts" },
              { titre: "Passeur", j: passeur, v: passeur?.passes, u: "pd" },
            ].map((r) => (
              <Recompense key={r.titre} titre={r.titre} enTete={!c.finie && !!r.j}>
                {r.j ? (
                  <>
                    <CarteDe name={r.j.name} size={FORMAT_CARTE.petite} />
                    <span className="w-full truncate text-[12.5px] font-semibold">{r.j.name.split(" ")[0]}</span>
                    <span className="mono-label text-foreground/60">
                      {r.v} {r.u}
                    </span>
                  </>
                ) : (
                  <span className="py-3 text-[12.5px] text-muted-foreground">–</span>
                )}
              </Recompense>
            ))}
          </div>
        </section>

        {valides.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-[17px] font-bold tracking-tight">Derniers résultats</h2>
            {valides.slice(0, 8).map(({ m, etat, compte }) => {
              if (etat.etat !== "valide") return null;
              const a = parId.get(m.de);
              const b = parId.get(m.a);
              if (!a || !b) return null;
              return (
                <div key={m.id} className="flex flex-col gap-1.5 rounded-[20px] bg-card px-3 py-2.5">
                  <span className="mono-label flex justify-between text-foreground/40">
                    <span>{libelleJour(m.jour)}</span>
                    {etat.forfaitDe != null ? <span>Forfait</span> : !compte ? <span>Amical</span> : null}
                  </span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <span className="flex min-w-0 items-center justify-end gap-2">
                      <span className="truncate text-right text-[13.5px] font-semibold">{a.nom}</span>
                      <Ecusson initiales={a.initiales} fond={a.fond} blason={a.blason} taille={24} />
                    </span>
                    <span className="font-display text-[22px] leading-none tabular-nums">
                      {etat.buts[0]} <span className="text-foreground/25">–</span> {etat.buts[1]}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <Ecusson initiales={b.initiales} fond={b.fond} blason={b.blason} taille={24} />
                      <span className="truncate text-[13.5px] font-semibold">{b.nom}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
