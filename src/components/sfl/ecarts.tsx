"use client";

// La course — les écarts entre joueurs, mis en avant dans la Ligue.
//
// Un classement dit qui est devant ; l'écart dit si ça se joue encore. Ici :
// l'avance du leader, le duel le plus serré, une barre par joueur à l'échelle
// du leader avec son retard en points, et toi, où que tu sois, avec ce qu'il
// te manque pour passer le joueur devant.
//
// Tant que la saison en cours n'a rien de joué, la course est celle — finie —
// de la saison passée, annoncée comme telle.

import { useMemo } from "react";
import { AuVestiaireRond } from "@/components/sfl/au-vestiaire";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { rankPlayers, type RankedPlayer } from "@/lib/sfl/engine";
import { publicOnly } from "@/lib/sfl/hidden";
import { deriveSeason } from "@/lib/sfl/saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { cn } from "@/lib/utils";
import { Nom } from "@/components/sfl/nom";

const pts = (n: number) => `${n} pt${n > 1 ? "s" : ""}`;

export function Ecarts({ className, max = 8 }: { className?: string; max?: number }) {
  const { players, saison } = useSeason();
  const { player: moi } = useMyPlayer();

  const { classes, source } = useMemo(() => {
    const jouee = saison.journees.some((m) => journeeJouee(saison, m.j));
    if (jouee) return { classes: rankPlayers(players), source: null as string | null };
    const derniere = saison.archives?.[saison.archives.length - 1];
    if (!derniere) return { classes: [] as RankedPlayer[], source: null };
    return {
      classes: rankPlayers(publicOnly(deriveSeason(saisonDepuisArchive(derniere)).players)),
      source: `${derniere.nom} · classement final`,
    };
  }, [players, saison]);

  const actifs = classes.filter((p) => p.pp > 0);
  if (actifs.length < 2) return null;

  const tete = actifs.slice(0, max);
  const leader = actifs[0];
  const second = actifs.find((p) => p.pp < leader.pp);
  const coLeaders = actifs.filter((p) => p.pp === leader.pp);

  // Le duel le plus serré du haut de tableau : deux voisins, le plus petit écart non nul.
  let duel: [RankedPlayer, RankedPlayer, number] | null = null;
  for (let i = 1; i < tete.length; i++) {
    const e = tete[i - 1].pp - tete[i].pp;
    if (e > 0 && (!duel || e < duel[2])) duel = [tete[i - 1], tete[i], e];
  }

  const monRang = actifs.findIndex((p) => p.name === moi.name);
  const moiDedans = monRang >= 0 && monRang < max;
  const devant = monRang > 0 ? actifs.slice(0, monRang).reverse().find((p) => p.pp > actifs[monRang].pp) : undefined;

  const titre =
    coLeaders.length > 1
      ? `${coLeaders.map((p) => p.name).join(", ")} à égalité en tête, ${pts(leader.pp)}.`
      : `${leader.name} mène avec ${pts(leader.pp - (second?.pp ?? 0))} d'avance sur ${second?.name ?? "le reste"}.`;

  const ligne = (p: RankedPlayer) => {
    const retard = leader.pp - p.pp;
    const estMoi = p.name === moi.name;
    return (
      <li key={p.name} className={cn("flex items-center gap-3 px-3.5 py-2.5", estMoi && "bg-foreground/[0.07]")}>
        <span className="w-[20px] text-[13px] font-bold text-foreground/45 tabular-nums">{p.rank}</span>
        <MiniCarte player={p} size={FORMAT_CARTE.petite} detail={`${p.rank}e au Pépite d'Or · ${pts(p.pp)}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-[14px] font-semibold", estMoi && "font-bold")}><Nom n={p.name} /></span>
            <span className="shrink-0 text-[14px] font-bold tabular-nums">{p.pp}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="relative h-[5px] flex-1 overflow-hidden rounded-full bg-foreground/[0.08]">
              <span
                className={cn("absolute inset-y-0 left-0 rounded-full", retard === 0 ? "bg-foreground" : "bg-foreground/55")}
                style={{ width: `${Math.max(4, (p.pp / leader.pp) * 100)}%` }}
              />
            </span>
            <span className={cn("w-[52px] shrink-0 text-right font-mono text-[11px] tabular-nums", retard === 0 ? "text-foreground" : "text-foreground/50")}>
              {retard === 0 ? "en tête" : `−${retard}`}
            </span>
          </div>
        </div>
      </li>
    );
  };

  return (
    <section className={cn("glass flex flex-col gap-3.5 rounded-[26px] p-[18px]", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[17px] font-bold tracking-tight">La course au Pépite d&apos;Or</h2>
        <span className="flex items-center gap-2">
          {source && <span className="mono-label shrink-0 text-foreground/40">{source}</span>}
          <AuVestiaireRond
            piece={{
              type: "ligue",
              titre: "La course au Pépite d'Or",
              lignes: tete.slice(0, 5).map((p) => ({ n: p.name, v: p.pp === leader.pp ? `${p.pp} pts` : `−${leader.pp - p.pp}` })),
            }}
          />
        </span>
      </div>
      <p className="text-[15px] leading-snug font-semibold text-balance">{titre}</p>

      {duel && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-[16px] bg-foreground/[0.06] px-3.5 py-2.5 text-[13px]">
          <span className="mono-label text-foreground/45">Le duel le plus serré</span>
          <span className="font-semibold">
            {duel[0].name} – {duel[1].name}
          </span>
          <span className="text-foreground/55">· {pts(duel[2])} d&apos;écart</span>
        </div>
      )}

      <ol className="-mx-1 overflow-hidden rounded-[18px] bg-foreground/[0.03]">
        {tete.map(ligne)}
        {!moiDedans && monRang >= 0 && (
          <>
            <li aria-hidden className="px-3.5 py-0.5 text-center text-[11px] text-foreground/30">
              ···
            </li>
            {ligne(actifs[monRang])}
          </>
        )}
      </ol>

      {monRang >= 0 && (
        <p className="text-[13px] text-foreground/60">
          {monRang === 0
            ? coLeaders.length > 1
              ? "Tu partages la tête : un point de plus et elle est à toi."
              : `Tu mènes. Ton avance : ${pts(leader.pp - (second?.pp ?? 0))}.`
            : devant
              ? `${source ? "La saison passée, toi" : "Toi"} : ${actifs[monRang].rank}e, à ${pts(devant.pp - actifs[monRang].pp)} de ${devant.name} et à ${pts(leader.pp - actifs[monRang].pp)} de la tête.`
              : null}
        </p>
      )}
    </section>
  );
}
