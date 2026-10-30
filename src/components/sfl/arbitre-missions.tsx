"use client";

// Les missions d'arbitre, sur sa carte (Sabri, 24/10 : « que les arbitres,
// eux aussi, aient des missions et des aspects différents de ceux des
// joueurs, qu'ils puissent activer, accepter et refuser aussi des
// missions »). Le moteur est dans lib/sfl/missions-arbitre.ts.
//
// Les mêmes fiches de contrat que les joueurs (actus/missions.tsx, la DA
// Lune) : le bandeau, le nom de code et son rang, l'objectif, la prime et le
// risque, accepter ou passer jusqu'au coup d'envoi, puis le tampon du
// verdict, qui tombe le mardi à minuit quand les notes des joueurs ferment.
// Ce qui change : ce qu'il vise, ses matchs de la journée à la place d'une
// cible, et la note des joueurs à la place de la feuille.

import { useState } from "react";
import { toast } from "sonner";
import { ANTON } from "@/components/sfl/actus/ecran";
import { Insigne, Pouls, Tampon } from "@/components/sfl/actus/missions";
import { useMissionsArbitre, type LigneMissionArbitre, type MissionsArbitre } from "@/hooks/use-arbitres";
import { repondreMissionArbitre } from "@/lib/sfl/arbitres";
import { rangDe, risqueDe, XP_PARFAIT, type Rang } from "@/lib/sfl/missions";
import { NOM_DE_CODE_ARBITRE, phraseArbitre, type ReponseArbitre } from "@/lib/sfl/missions-arbitre";
import { cn } from "@/lib/utils";
import "./actus/missions.css";
import "./actus/lune.css";

const CRANS_DU_RANG: Record<Rang, number> = { S: 3, A: 2, B: 1 };
const signe = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** « Dim. 13h00 » : le jour du coup d'envoi, à l'heure de Paris. */
function limite(d: Date, heure: string): string {
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(d);
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${heure}`;
}

function Difficulte({ rang }: { rang: Rang }) {
  return (
    <span className="flex items-end gap-2.5">
      <span className="mono-label fiche__ton leading-none">Rang {rang}</span>
      <span className="flex items-end gap-[3px]" aria-hidden>
        {[6, 9, 12].map((h, i) => (
          <span key={h} className={cn("fiche__cran", i < CRANS_DU_RANG[rang] && "fiche__cran--on")} style={{ height: h }} />
        ))}
      </span>
    </span>
  );
}

function Action({ l, mm, attente, repondre }: { l: LigneMissionArbitre; mm: MissionsArbitre; attente: boolean; repondre: (r: ReponseArbitre["reponse"]) => void }) {
  const r = l.reponse?.reponse ?? null;
  if (mm.phase === "ouvert") {
    if (r === null)
      return (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={attente}
            onClick={() => repondre("acceptee")}
            className="bouton-principal bouton--vert h-12 flex-1 text-lecture font-bold"
          >
            Accepter la mission
          </button>
          <button type="button" disabled={attente} onClick={() => repondre("passee")} className="bouton-discret h-12 px-4 text-ligne font-semibold">
            Passer
          </button>
        </div>
      );
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 pl-1">
        {r === "acceptee" ? <Tampon key="a">Acceptée</Tampon> : <Tampon key="p" ton="gris">Passée</Tampon>}
        <button
          type="button"
          disabled={attente}
          onClick={() => repondre(r === "acceptee" ? "passee" : "acceptee")}
          className={cn(
            "h-11 text-ligne",
            r === "acceptee" ? "bouton-discret px-4 font-semibold" : "bouton-secondaire bouton--vert px-5 font-bold"
          )}
        >
          {r === "acceptee" ? "Passer" : "Accepter"}
        </button>
      </div>
    );
  }
  if (r !== "acceptee")
    return (
      <div className="flex min-h-12 items-center pl-1">
        <Tampon ton="gris">{r === "passee" ? "Passée" : "Expirée"}</Tampon>
      </div>
    );
  const v = l.verdict;
  const detail = v.detail ? <span className="font-mono text-petit leading-[1.35] text-white/55">{v.detail}</span> : null;
  if (v.etat === "en-jeu")
    return (
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 pl-1">
        <span className="fiche__ton flex items-center gap-2">
          <Pouls bat />
          <span className="mono-label">{mm.d?.joue ? "Les joueurs notent" : "En jeu"}</span>
        </span>
        {detail}
      </div>
    );
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-4 pl-1">
      {v.etat === "reussie" ? (
        <Tampon key="r">Accomplie · +{l.m.xp} XP</Tampon>
      ) : (
        <Tampon key="x" ton="rouge">
          Échec · −{risqueDe(l.m)} XP
        </Tampon>
      )}
      {detail}
    </div>
  );
}

function Fiche({ l, mm, attente, repondre }: { l: LigneMissionArbitre; mm: MissionsArbitre; attente: boolean; repondre: (r: ReponseArbitre["reponse"]) => void }) {
  const d = mm.d!;
  const rang = rangDe(l.m);
  const code = NOM_DE_CODE_ARBITRE[l.m.creneau];
  const acceptee = l.reponse?.reponse === "acceptee";
  const apres = mm.phase !== "ouvert";
  const chiffre = "text-titre-g leading-none";
  return (
    <article
      aria-label={`Mission ${code}, rang ${rang}`}
      className={cn(
        "fiche dark",
        `fiche--${rang}`,
        apres && acceptee && l.verdict.etat === "reussie" && "fiche--reussie",
        apres && acceptee && l.verdict.etat === "ratee" && "fiche--ratee",
        apres && !acceptee && "fiche--eteinte"
      )}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Mission Bola</span>
        <span className="fiche__type mono-label text-white/75">Arbitre</span>
      </div>
      <div className="flex flex-col gap-5 px-[18px] pt-4 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5 pt-1.5">
            <h3 className="titre-lettrage text-nom leading-[0.9] break-words">{code}</h3>
            <Difficulte rang={rang} />
          </div>
          <Insigne rang={rang} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="mono-label text-white/45">Objectif</span>
          <p className="text-titre-fort leading-[1.15] font-bold tracking-[-0.3px]">{phraseArbitre(l.m, d.arbitrages.length)}</p>
        </div>
        <div className="fiche__champs">
          <div>
            <span className="mono-label text-white/45">Prime</span>
            <span className="fiche__ton flex items-baseline gap-1">
              <span className={chiffre} style={{ fontFamily: ANTON }}>
                +{l.m.xp}
              </span>
              <span className="mono-label">XP</span>
            </span>
          </div>
          <div>
            <span className="mono-label text-white/45">Risque</span>
            <span className="flex items-baseline gap-1 text-[#ff9b9d]">
              <span className={chiffre} style={{ fontFamily: ANTON }}>
                −{risqueDe(l.m)}
              </span>
              <span className="mono-label">XP</span>
            </span>
          </div>
          <div>
            <span className="mono-label text-white/45">{mm.phase === "ouvert" ? "Avant" : "Verdict"}</span>
            <span className="truncate text-lecture leading-[25px] font-bold">
              {mm.phase === "ouvert" ? limite(d.coupEnvoi, d.heure) : mm.phase === "en-jeu" ? "Mardi 0h" : "Définitif"}
            </span>
          </div>
        </div>
        <Action l={l} mm={mm} attente={attente} repondre={repondre} />
      </div>
    </article>
  );
}

/** Ses trois missions de la journée, sous ses chiffres ; rien tant que l'admin ne l'a désigné sur aucun match. */
export function MissionsArbitre({ nom }: { nom: string }) {
  const mm = useMissionsArbitre(nom);
  const [attente, setAttente] = useState(false);
  const d = mm.d;
  if (!d) return null;
  const repondre = (c: LigneMissionArbitre["m"]["creneau"]) => async (r: ReponseArbitre["reponse"]) => {
    setAttente(true);
    const e = await repondreMissionArbitre(d.saison, d.j, c, r);
    setAttente(false);
    if (e) toast.error(e);
    else if (typeof navigator !== "undefined") navigator.vibrate?.(8);
  };
  const xpJournee = mm.journal.filter((l) => l.saison === d.saison && l.j === d.j).reduce((s, l) => s + l.xp, 0);
  const matchs = d.arbitrages.map((a) => `Match ${a.n + 1}${a.equipes.length === 2 ? ` · ${a.equipes[0]} – ${a.equipes[1]}` : ""}`);

  return (
    <section aria-labelledby="titre-missions-arbitre" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 px-1">
        <span className="mono-label truncate text-encre-3">
          J{d.j} · {d.date} · {d.heure}
        </span>
        <h2 id="titre-missions-arbitre" className="titre-lettrage text-titre-l leading-[0.95]">
          Missions d&apos;arbitre
        </h2>
        {matchs.map((m) => (
          <span key={m} className="font-mono text-petit text-encre-3">
            {m}
          </span>
        ))}
      </div>
      {mm.lignes.map((l) => (
        <Fiche key={l.m.creneau} l={l} mm={mm} attente={attente} repondre={(r) => void repondre(l.m.creneau)(r)} />
      ))}
      <div className="flex items-baseline justify-between gap-3 px-1">
        <span className="mono-label text-encre-3">
          {mm.phase === "ouvert" ? "Les trois accomplies" : mm.phase === "en-jeu" ? "Mardi à minuit" : "Ta journée"}
        </span>
        <span className={cn("mono-label", mm.phase === "fini" && xpJournee < 0 ? "text-[#c8352b] dark:text-[#ff9b9d]" : "text-encre-2")}>
          {mm.phase === "ouvert" ? `+${XP_PARFAIT} XP de bonus` : `${signe(xpJournee)} XP`}
        </span>
      </div>
    </section>
  );
}
