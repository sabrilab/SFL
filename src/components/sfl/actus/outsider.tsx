"use client";

// L'outsider, dans les Actus, sous les divisions. Sabri, 23/10 : « si on a un
// gars qui est rang B […] et qui se retrouve en division 1, lui va faire
// l'objet d'une quête […] il ne faut pas oublier de le gonfler dans l'actu
// […] à la limite qu'il y ait une journée qui tourne autour de sa gueule ».
//
// Chaque dimanche de l'arc 1 (la saison des divisions) a son outsider, le
// mieux placé des rangs B de la D1 (lib/sfl/outsiders.ts), et la rubrique
// porte son nom : « La journée de Miken ». Sa fiche est noire dans les deux
// modes, comme les Missions Bola, à l'argent du rang B :
//   · sa carte en grand, l'insigne du rang B au coin ; sa place à l'XP à vie
//     et sa place en D1 : l'écart entre les deux fait l'histoire ;
//   · sa quête, en deux temps : tenir la D1 ce dimanche (sous 4 points, il
//     redescend), et gagner son rang A (l'XP qui lui manque ; en rayé, celle
//     des missions qu'il a signées pour le dimanche) ;
//   · les contrats signés contre lui, Suivre, et le partage au Vestiaire ;
//   · le chapitre d'avant, son verdict au tampon : tenu, tombé, accompli ;
//   · les autres rangs B de la D1, en petites cartes.
// Le dimanche se joue : le tampon de la D1 se pose dès que la feuille le
// donne. À minuit, le chapitre se ferme (le rang A se juge avec l'XP des
// missions, comptée à minuit) et le suivant s'ouvre sur l'outsider du
// dimanche d'après : le même tant qu'il tient, rang B et en D1.

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { ciblesDe, contratsSignes } from "@/components/sfl/map/contrats-map";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { BoutonSuivre } from "@/components/sfl/suivre";
import { useIdentites } from "@/hooks/use-identites";
import { useMissionsDeLaLigue, useXpLigue, type MissionsDeLaLigue } from "@/hooks/use-missions";
import { REGLES_DIVISIONS } from "@/lib/sfl/divisions";
import { prenom } from "@/lib/sfl/missions";
import { arcOutsider, POUR_RESTER_EN_D1, type Chapitre, type Outsider } from "@/lib/sfl/outsiders";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { preparerPiece } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";
import { BLANCS, Carte, Champ, Insigne, NOIRS, Pouls, Tampon } from "./missions";
import "./missions.css";

/** Les autres rangs B de la D1 montrés en petites cartes ; au-delà, leur nombre. */
const DANS_LA_RANGEE = 5;

const rangTexte = (n: number) => (n === 1 ? "1er" : `${n}e`);
const pts = (n: number) => `${n} pt${Math.abs(n) > 1 ? "s" : ""}`;
const pl = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
/** Le chapitre d'une journée : la J4 ouvre l'arc. */
const chapitreDe = (j: number) => j - REGLES_DIVISIONS.depuis + 1;

/** Le dimanche de l'outsider : celui qui se joue, jusqu'à minuit ; sinon le prochain. */
function dimancheDeLOutsider(lg: MissionsDeLaLigue | null, derniere: number): number {
  if (lg && lg.phase === "en-jeu" && lg.d.j >= REGLES_DIVISIONS.depuis && lg.d.j >= derniere) return lg.d.j;
  return derniere + 1;
}

/** En haut à droite : le match en cours, puis l'attente du verdict. */
function Moment({ lg, j }: { lg: MissionsDeLaLigue | null; j: number }) {
  if (!lg || lg.d.j !== j || lg.phase !== "en-jeu") return null;
  if (!lg.d.joue)
    return (
      <span className="mono-label flex shrink-0 items-center gap-2 text-foreground/80">
        <Pouls bat /> En jeu
      </span>
    );
  return <span className="mono-label shrink-0 text-foreground/55">Verdict à minuit</span>;
}

/** Ce que dit un chapitre fermé, à la troisième personne ou à toi. */
function phraseDe(c: Chapitre, qui: string, toi: boolean): string {
  switch (c.issue) {
    case "accomplie":
      return toi ? "Tu gagnes ton rang A" : `${qui} gagne son rang A`;
    case "chute":
      return toi ? "Tu retombes en D2" : `${qui} retombe en D2`;
    case "absent":
      return toi ? "Tu n'as pas joué" : `${qui} n'a pas joué`;
    default:
      return toi ? "Tu tiens la D1" : `${qui} tient la D1`;
  }
}

/** Le tampon d'un chapitre : tenu, tombé, accompli, absent. */
function TamponDe({ c }: { c: Chapitre }) {
  if (c.issue === "accomplie") return <Tampon petit>Accomplie</Tampon>;
  if (c.issue === "chute") return <Tampon petit ton="rouge">Tombé</Tampon>;
  if (c.issue === "absent") return <Tampon petit ton="gris">Absent</Tampon>;
  return <Tampon petit>Tenu</Tampon>;
}

/** Le chapitre d'avant : son outsider, ce que le dimanche a fait de lui. */
function Precedent({ c, me }: { c: Chapitre; me: string }) {
  const id = useIdentites();
  const toi = c.outsider.nom === me;
  return (
    <div className="flex items-center gap-3 border-b border-white/10 pb-4">
      <Carte nom={c.outsider.nom} size={FORMAT_CARTE.petite} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="mono-label truncate text-white/45">
          Chapitre {chapitreDe(c.j)} · J{c.j}
          {c.issue !== "absent" && ` · ${pts(c.points)}`}
        </span>
        <span className="text-[14px] leading-tight font-bold break-words">{phraseDe(c, prenom(id.nom(c.outsider.nom)), toi)}</span>
      </div>
      <TamponDe c={c} />
    </div>
  );
}

/** La case d'une étape de la quête : un hexagone, plein une fois l'étape passée. */
function Case({ faite, ratee }: { faite?: boolean; ratee?: boolean }) {
  return <span className={cn("quete__case", faite && "quete__case--faite", ratee && "quete__case--ratee")} aria-hidden />;
}

/**
 * La quête : tenir la D1 ce dimanche, puis le rang A. Le dimanche joué, la
 * D1 a son tampon ; le rang A se juge à minuit, au chapitre suivant.
 */
function Quete({ c, toi, enDirect, enJeu }: { c: Chapitre; toi: boolean; enDirect: boolean; enJeu: number }) {
  const o = c.outsider;
  // Absent tant que la feuille se remplit : peut-être pas encore saisi.
  const tranche = c.issue === "tient" || c.issue === "chute" || c.issue === "accomplie";
  const seuil = o.xp + o.pourLeRangA;
  const acquis = seuil > 0 ? o.xp / seuil : 0;
  const possible = seuil > 0 ? Math.min(1, (o.xp + enJeu) / seuil) : 0;
  return (
    <div className="flex flex-col gap-2.5">
      <span className="mono-label text-white/45">{toi ? "Ta quête" : "Sa quête"}</span>
      <ol className="quete">
        <li>
          <Case faite={tranche && c.issue !== "chute"} ratee={c.issue === "chute"} />
          <span className="quete__quoi">Tenir la D1</span>
          {tranche ? (
            c.issue === "chute" ? (
              <Tampon petit ton="rouge">
                Tombé · {pts(c.points)}
              </Tampon>
            ) : (
              <Tampon petit>Tenu · {pts(c.points)}</Tampon>
            )
          ) : enDirect ? (
            <span className="fiche__ton flex items-center gap-1.5">
              <Pouls bat />
              <span className="mono-label">En jeu</span>
            </span>
          ) : (
            <span className="mono-label text-white/70">{POUR_RESTER_EN_D1} pts dimanche</span>
          )}
        </li>
        <li className="flex-wrap">
          <Case />
          <span className="quete__quoi">{toi ? "Gagner ton rang A" : "Gagner son rang A"}</span>
          <span className="mono-label fiche__ton">À {o.pourLeRangA} XP</span>
          <span className="quete__barre" aria-hidden>
            <span className="quete__acquis" style={{ width: `${acquis * 100}%` }} />
            {possible > acquis && (
              <span className="quete__possible" style={{ left: `${acquis * 100}%`, width: `${(possible - acquis) * 100}%` }} />
            )}
          </span>
          {enJeu > 0 && (
            <span className="mono-label text-white/45">
              +{enJeu} XP en jeu dans {toi ? "tes" : "ses"} missions
            </span>
          )}
        </li>
      </ol>
    </div>
  );
}

/** Lui en grand : sa carte, l'insigne du rang B au coin, ses deux places. */
function Heros({ o, toi, onglet, partager }: { o: Outsider; toi: boolean; onglet?: { fond: string; encre: string }; partager: () => void }) {
  return (
    <div className="flex items-center gap-6">
      <div className="outsider__heros ml-[3px] shrink-0">
        <Carte nom={o.nom} size={FORMAT_CARTE.grande} onglet={onglet} />
        <span className="outsider__insigne">
          <Insigne rang="B" />
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <dl className="flex flex-col gap-4">
          <Champ label="L'outsider" grand>
            {toi ? "Toi" : <Nom n={o.nom} />}
          </Champ>
          <Champ label="XP à vie">
            <span className="fiche__ton">Rang B</span> · {rangTexte(o.placeXp)} sur {o.surXp}
          </Champ>
          <Champ label="Division 1">
            {rangTexte(o.placeD1)} sur {o.surD1}
          </Champ>
        </dl>
        <div className="flex items-center gap-1">
          <BoutonSuivre nom={o.nom} petit />
          <button
            type="button"
            aria-label="Partager au Vestiaire"
            onClick={partager}
            className="grid size-9 shrink-0 place-items-center rounded-full text-white/60 transition-transform active:scale-90"
          >
            <MessageCircle className="size-[18px]" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </div>
  );
}

export function RubriqueOutsider({ className }: { className?: string }) {
  const router = useRouter();
  const { saison, allPlayers } = useSeason();
  const { me } = useMyPlayer();
  const id = useIdentites();
  const xp = useXpLigue();
  const lg = useMissionsDeLaLigue();
  const derniere = useMemo(
    () => Math.max(0, ...saison.journees.map((m) => m.j).filter((j) => journeeJouee(saison, j))),
    [saison]
  );
  const j = dimancheDeLOutsider(lg, derniere);
  const arc = useMemo(() => (xp ? arcOutsider(saison, xp.journal, allPlayers, j) : null), [xp, saison, allPlayers, j]);
  if (!arc) return null;

  const c = arc.chapitre;
  const heros = c?.outsider.nom;
  const toi = heros === me;
  // Ce dimanche dans les missions : son équipe, ses missions signées, les contrats sur lui.
  const ceDimanche = lg && lg.d.j === j ? lg : null;
  const camp = heros ? ceDimanche?.d.camps.get(heros) : undefined;
  const signees = heros && ceDimanche ? [...contratsSignes(ceDimanche), ...ceDimanche.defis, ...ceDimanche.ligue].filter((e) => e.joueur === heros) : [];
  const contre = heros && ceDimanche ? contratsSignes(ceDimanche).filter((e) => e.joueur !== heros && ciblesDe(e).includes(heros)).length : 0;
  const enDirect = !!ceDimanche && ceDimanche.phase === "en-jeu";
  // Toi d'abord parmi les autres rangs B de la D1.
  const autres = arc.outsiders.slice(1).sort((a, b) => Number(b.nom === me) - Number(a.nom === me));
  const montres = autres.slice(0, autres.length > DANS_LA_RANGEE ? DANS_LA_RANGEE - 1 : DANS_LA_RANGEE);
  const date = saison.journees.find((m) => m.j === j)?.date;
  const titre = c ? (toi ? "Ta journée" : `La journée de ${prenom(id.nom(c.outsider.nom))}`) : "L'outsider";

  const partager = () => {
    if (!c) return;
    preparerPiece({
      type: "ligue",
      titre: `La journée de ${prenom(id.nom(c.outsider.nom))}`,
      j,
      lignes: [
        { n: c.outsider.nom, v: `Rang B · ${rangTexte(c.outsider.placeD1)} de la D1` },
        { l: "XP à vie", v: `${rangTexte(c.outsider.placeXp)} sur ${c.outsider.surXp}` },
        { l: "Sa quête", v: `${POUR_RESTER_EN_D1} pts pour tenir la D1 · rang A à ${c.outsider.pourLeRangA} XP` },
      ],
    });
    router.push("/vestiaire");
  };

  return (
    <section id="outsider" aria-labelledby="titre-outsider" className={cn("flex scroll-mt-4 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label truncate text-foreground/45">
            Arc {arc.arc} · J{j}
            {date ? ` · ${date}` : ""}
          </span>
          <Moment lg={lg} j={j} />
        </div>
        <h2 id="titre-outsider" className="titre-lettrage text-[30px] leading-[0.95] break-words">
          {titre}
        </h2>
      </div>

      <article
        aria-label={c ? `L'outsider : ${id.nom(c.outsider.nom)}, rang B en D1` : "L'outsider"}
        className="fiche fiche--B fiche--outsider dark mx-4 md:mx-0"
      >
        <div className="fiche__bandeau">
          <span className="fiche__etiquette">L&apos;outsider</span>
          <span className="fiche__type mono-label text-white/75">Chapitre {chapitreDe(c ? j : (arc.precedent?.j ?? j))}</span>
        </div>
        <div className="flex flex-col gap-5 px-[18px] pt-4 pb-5">
          {arc.precedent && <Precedent c={arc.precedent} me={me} />}
          {c && (
            <>
              <Heros o={c.outsider} toi={toi} onglet={camp ? (camp.equipe === "noirs" ? NOIRS : BLANCS) : undefined} partager={partager} />
              {contre > 0 && (
                <span className="fiche__duel mono-label">
                  {pl(contre, "contrat signé", "contrats signés")} contre {toi ? "toi" : "lui"}
                </span>
              )}
              <Quete c={c} toi={toi} enDirect={enDirect} enJeu={signees.reduce((a, e) => a + e.m.xp, 0)} />
            </>
          )}
          {autres.length > 0 && (
            <div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
              <span className="mono-label text-white/45">{pl(autres.length, "autre rang B", "autres rangs B")} en D1</span>
              <div className="flex items-center gap-1.5">
                {montres.map((o) => (
                  <Carte key={o.nom} nom={o.nom} size={FORMAT_CARTE.petite} />
                ))}
                {autres.length > montres.length && (
                  <span className="mono-label pl-1.5 text-white/45">+{autres.length - montres.length}</span>
                )}
              </div>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}
