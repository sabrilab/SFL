"use client";

// Les Missions Bola, dans les Actus, juste sous la convocation. Dès que
// l'admin a fait les équipes de la journée, chaque joueur de la feuille a ses
// trois missions (lib/sfl/missions.ts) : le contrat contre son rival, le défi
// du dimanche, la ligue.
//
// Sabri, 23/10 : « il faut les encadrer », « un truc d'espion », « dans
// l'ambiance des battles royales » (Apex, Call of Duty Mobile), « des vraies
// fiches de contrats », « des missions de rang S, des missions de rang A/B ».
// Chaque mission est donc une fiche de contrat (missions.css) :
//   · le bandeau rayé : Mission Bola, et le type (contrat, défi, ligue) ;
//   · son nom de code (Verrou, Remontada…), son rang et l'insigne du rang :
//     S l'or, A le mauve, B l'argent, selon la prime (rangDe) ;
//   · pour le contrat, la cible : sa carte sous le viseur, qui se verrouille
//     quand on accepte ; son rang au Pépite d'Or, son équipe. Le premier du
//     classement, lui, a son propre visage dans le viseur : « Reste en tête » ;
//   · l'objectif, la prime, le risque (accepter engage : ratée, la mission
//     coûte la moitié de sa prime, risqueDe), l'heure limite ;
//   · accepter ou passer jusqu'au coup d'envoi, puis le tampon du verdict.
// Le compte à rebours du haut court jusqu'au coup d'envoi ; le verdict tombe
// à mesure que la feuille se remplit et devient définitif à minuit. L'XP va
// au Niveau XP et au passe de la saison (Ma carte), jamais aux points Pépite.
//
// Le rival ne voit ton contrat que s'il a accepté le sien en face (la base ne
// le lui montre pas avant) : la fiche le dit alors, « Abdel a signé contre toi ».

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { useMissions, type LigneMission, type MesMissions, type Phase } from "@/hooks/use-missions";
import { rankPlayers } from "@/lib/sfl/engine";
import {
  NOM_DE_CODE,
  phrase,
  rangDe,
  risqueDe,
  XP_PARFAIT,
  type Creneau,
  type Rang,
  type Reponse,
} from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";
import "./missions.css";

const TYPE: Record<Creneau, string> = { contrat: "Contrat", defi: "Défi du dimanche", ligue: "La ligue" };
/** Les crans allumés à côté du rang : de la plus dure à la plus facile. */
const CRANS_DU_RANG: Record<Rang, number> = { S: 3, A: 2, B: 1 };
/** Les onglets de la feuille de match (lib/sfl/feuille.ts). */
const NOIRS = { fond: "#0A0B0D", encre: "#F4F5F2" };
const BLANCS = { fond: "#F4F3EF", encre: "#0A0B0D" };

type Repondre = (c: Creneau, r: Reponse["reponse"]) => void;
type EtatViseur = "libre" | "verrou" | "rate" | "eteint";

const rangTexte = (n: number) => (n === 1 ? "1er" : `${n}e`);
const pts = (n: number) => `${n} pt${Math.abs(n) > 1 ? "s" : ""}`;
const signe = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/** « Dim. 13h00 » : le jour du coup d'envoi, à l'heure de Paris. */
function limite(coupEnvoi: Date, heure: string): string {
  const jour = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "short" }).format(coupEnvoi);
  return `${jour.charAt(0).toUpperCase()}${jour.slice(1)} ${heure}`;
}

/** Le rang au Pépite d'Or (la liste publique) et les points d'un joueur. */
function useClassement() {
  const { players, allPlayers } = useSeason();
  return useMemo(() => {
    const classes = rankPlayers(players);
    const de = (nom: string) => {
      const p = classes.find((x) => x.name === nom);
      return { rang: p?.rank ?? null, pp: p?.pp ?? allPlayers.find((x) => x.name === nom)?.pp ?? 0 };
    };
    return { de, classes };
  }, [players, allPlayers]);
}

function Carte({ nom, size, onglet }: { nom: string; size: number; onglet?: { fond: string; encre: string } }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name === nom);
  return p ? <MiniCarte player={p} size={size} onglet={onglet} /> : <CarteDe name={nom} size={size} />;
}

/** Le temps qui reste jusqu'au coup d'envoi, à la seconde : « 1 j 02:14:33 ». */
function CompteARebours({ fin }: { fin: Date }) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setT(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const s = Math.max(0, Math.floor((fin.getTime() - t) / 1000));
  const j = Math.floor(s / 86400);
  const deux = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="mono-label flex shrink-0 items-baseline gap-2 text-foreground/45">
      Expire dans
      <span className="text-[12px] text-foreground tabular-nums">
        {j > 0 && `${j} j `}
        {deux(Math.floor((s % 86400) / 3600))}:{deux(Math.floor((s % 3600) / 60))}:{deux(s % 60)}
      </span>
    </span>
  );
}

function Pouls({ bat }: { bat: boolean }) {
  return (
    <span className="relative flex size-2">
      {bat && (
        <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-60 motion-reduce:animate-none" />
      )}
      <span className="relative size-2 rounded-full bg-current" />
    </span>
  );
}

/** En haut à droite : le compte à rebours, puis le match en cours, puis le verdict. */
function Moment({ mm }: { mm: MesMissions }) {
  if (mm.phase === "ouvert") return <CompteARebours fin={mm.d.coupEnvoi} />;
  if (mm.phase === "en-jeu" && !mm.d.joue)
    return (
      <span className="mono-label flex shrink-0 items-center gap-2 text-foreground/80">
        <Pouls bat /> En jeu
      </span>
    );
  return (
    <span className="mono-label shrink-0 text-foreground/55">{mm.phase === "en-jeu" ? "Verdict à minuit" : "Verdict"}</span>
  );
}

function Insigne({ rang }: { rang: Rang }) {
  return (
    <span className="fiche__insigne" aria-hidden>
      <span className="fiche__hexa" />
      <span className="fiche__hexa fiche__hexa--coeur" />
      <span className="fiche__lettre">{rang}</span>
    </span>
  );
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

/** Le viseur posé sur une carte ; il rejoue son verrouillage à chaque changement d'état. */
function Viseur({ etat, petit }: { etat: EtatViseur; petit?: boolean }) {
  return (
    <span key={etat} className={cn("fiche__viseur", `fiche__viseur--${etat}`, petit && "fiche__viseur--petit")} aria-hidden>
      {etat === "verrou" && <span className="viseur__balayage" />}
      <span className="viseur__coin viseur__coin--hg" />
      <span className="viseur__coin viseur__coin--hd" />
      <span className="viseur__coin viseur__coin--bg" />
      <span className="viseur__coin viseur__coin--bd" />
      <span className="viseur__trait viseur__trait--h" />
      <span className="viseur__trait viseur__trait--b" />
      <span className="viseur__trait viseur__trait--g" />
      <span className="viseur__trait viseur__trait--d" />
    </span>
  );
}

function etatViseur(l: LigneMission, phase: Phase): EtatViseur {
  if (l.reponse?.reponse !== "acceptee") return phase === "ouvert" ? "libre" : "eteint";
  if (l.verdict.etat === "ratee") return "rate";
  return l.verdict.etat === "annulee" ? "eteint" : "verrou";
}

function Champ({ label, grand, children }: { label: string; grand?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="mono-label text-white/45">{label}</dt>
      <dd
        className={cn(
          "min-w-0 break-words",
          grand ? "titre-lettrage text-[24px] leading-[0.95]" : "text-[15px] leading-[1.2] font-bold"
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** La cible du contrat : sa carte sous le viseur, et ce qu'on sait d'elle. */
function Cible({ l, mm }: { l: LigneMission; mm: MesMissions }) {
  const { d, joueur, phase } = mm;
  const { de, classes } = useClassement();
  const etat = etatViseur(l, phase);
  const onglet = (n: string) => {
    const c = d.camps.get(n);
    return c ? (c.equipe === "noirs" ? NOIRS : BLANCS) : undefined;
  };
  const { m } = l;

  // Plusieurs joueurs à passer, à égalité : une rangée de cartes, chacune sous son viseur.
  if (m.genre === "passe-devant" && m.cibles.length > 1) {
    const montres = m.cibles.slice(0, 3);
    return (
      <div className="flex flex-col gap-3">
        <div className="flex justify-center gap-5">
          {montres.map((n) => (
            <div key={n} className="flex w-[78px] flex-col items-center gap-2.5">
              <div className="relative">
                <div className={cn(etat === "rate" && "fiche__carte--ratee")}>
                  <Carte nom={n} size={FORMAT_CARTE.moyenne} onglet={onglet(n)} />
                </div>
                <Viseur etat={etat} petit />
              </div>
              <span className="line-clamp-2 text-center text-[13px] leading-tight font-bold break-words">
                <Nom n={n} />
              </span>
              <span className="mono-label text-white/45">{pts(de(n).pp)}</span>
            </div>
          ))}
        </div>
        {m.cibles.length > montres.length && (
          <span className="mono-label self-center text-white/45">{m.cibles.length} cibles</span>
        )}
      </div>
    );
  }

  const cible = m.genre === "reste-en-tete" ? joueur : m.cibles[0];
  if (!cible) return null;
  const c = de(cible);
  let troisieme: React.ReactNode = null;
  if (m.genre === "reste-en-tete") {
    const second = classes.find((p) => p.name !== joueur);
    if (second)
      troisieme = (
        <Champ label="Derrière toi">
          <Nom n={second.name} /> · {pts(second.pp)}
        </Champ>
      );
  } else if (m.genre === "passe-devant") {
    const ecart = c.pp - de(joueur).pp;
    troisieme = <Champ label="Écart">{ecart > 0 ? pts(ecart) : "À égalité"}</Champ>;
  } else {
    const camp = d.camps.get(cible);
    if (camp) troisieme = <Champ label="Équipe">{camp.equipe === "noirs" ? "Noirs" : "Blancs"}</Champ>;
  }

  return (
    <div className="flex items-center gap-6">
      <div className="relative ml-[7px] shrink-0">
        <div className={cn(etat === "rate" && "fiche__carte--ratee")}>
          <Carte nom={cible} size={FORMAT_CARTE.grande} onglet={onglet(cible)} />
        </div>
        <Viseur etat={etat} />
      </div>
      <dl className="flex min-w-0 flex-1 flex-col gap-4">
        <Champ label="Cible" grand>
          {m.genre === "reste-en-tete" ? "Toi" : <Nom n={cible} />}
        </Champ>
        <Champ label="Pépite d'Or">
          {c.rang ? `${rangTexte(c.rang)} · ` : ""}
          {pts(c.pp)}
        </Champ>
        {troisieme}
      </dl>
    </div>
  );
}

/** L'escouade : toi et tes coéquipiers du dimanche, pour les défis qui se gagnent à plusieurs. */
function Escouade({ mm }: { mm: MesMissions }) {
  const { d, joueur } = mm;
  const moi = d.camps.get(joueur);
  if (!moi) return null;
  const avec = [...d.camps]
    .filter(([n, c]) => n !== joueur && c.terrain === moi.terrain && c.equipe === moi.equipe)
    .map(([n]) => n)
    .sort((a, b) => (d.avant.get(b) ?? 0) - (d.avant.get(a) ?? 0));
  if (avec.length === 0) return null;
  const onglet = moi.equipe === "noirs" ? NOIRS : BLANCS;
  const montres = avec.slice(0, avec.length > 5 ? 4 : 5);
  return (
    <div className="flex flex-col gap-2.5">
      <span className="mono-label text-white/45">Ton escouade · {moi.equipe === "noirs" ? "Noirs" : "Blancs"}</span>
      <div className="flex items-center gap-1.5">
        {[joueur, ...montres].map((n) => (
          <Carte key={n} nom={n} size={FORMAT_CARTE.petite} onglet={onglet} />
        ))}
        {avec.length > montres.length && (
          <span className="mono-label pl-1.5 text-white/45">+{avec.length - montres.length}</span>
        )}
      </div>
    </div>
  );
}

/** Prime, risque et délai : ce que la mission rapporte, ce qu'elle coûte ratée, jusqu'à quand. */
function Champs({ l, mm }: { l: LigneMission; mm: MesMissions }) {
  const chiffre = "text-[25px] leading-none";
  return (
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
        <span className="truncate text-[15px] leading-[25px] font-bold">
          {mm.phase === "ouvert" ? limite(mm.d.coupEnvoi, mm.d.heure) : mm.phase === "en-jeu" ? "Minuit" : "Définitif"}
        </span>
      </div>
    </div>
  );
}

function Tampon({ ton, children }: { ton?: "rouge" | "gris"; children: React.ReactNode }) {
  return <span className={cn("tampon", ton && `tampon--${ton}`)}>{children}</span>;
}

/** Accepter ou passer jusqu'au coup d'envoi ; ensuite, ce qui est en jeu, puis le tampon du verdict. */
function Action({ l, mm, attente, repondre }: { l: LigneMission; mm: MesMissions; attente: boolean; repondre: Repondre }) {
  // Le contrat est au masculin ; le défi et la ligue sont des missions.
  const contrat = l.m.creneau === "contrat";
  const e = contrat ? "" : "e";
  const r = l.reponse?.reponse ?? null;
  const dire = (x: Reponse["reponse"]) => repondre(l.m.creneau, x);

  if (mm.phase === "ouvert") {
    if (r === null)
      return (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={attente}
            onClick={() => dire("acceptee")}
            className="bouton-principal bouton--vert h-12 flex-1 text-[15px] font-bold"
          >
            Accepter {contrat ? "le contrat" : "la mission"}
          </button>
          <button
            type="button"
            disabled={attente}
            onClick={() => dire("passee")}
            className="bouton-discret h-12 px-4 text-[14px] font-semibold"
          >
            Passer
          </button>
        </div>
      );
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 pl-1">
        {r === "acceptee" ? (
          <Tampon key="acceptee">Accepté{e}</Tampon>
        ) : (
          <Tampon key="passee" ton="gris">
            Passé{e}
          </Tampon>
        )}
        {r === "acceptee" ? (
          <button
            type="button"
            disabled={attente}
            onClick={() => dire("passee")}
            className="bouton-discret h-11 px-4 text-[14px] font-semibold"
          >
            Passer
          </button>
        ) : (
          <button
            type="button"
            disabled={attente}
            onClick={() => dire("acceptee")}
            className="bouton-secondaire bouton--vert h-11 px-5 text-[14px] font-bold"
          >
            Accepter
          </button>
        )}
      </div>
    );
  }

  if (r !== "acceptee")
    return (
      <div className="flex min-h-12 items-center pl-1">
        <Tampon ton="gris">{r === "passee" ? `Passé${e}` : `Expiré${e}`}</Tampon>
      </div>
    );
  const v = l.verdict;
  const detail = v.detail ? <span className="font-mono text-[12px] leading-[1.35] text-white/55">{v.detail}</span> : null;
  if (v.etat === "en-jeu")
    return (
      <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-1.5 pl-1">
        <span className="fiche__ton flex items-center gap-2">
          <Pouls bat={mm.phase === "en-jeu"} />
          <span className="mono-label">{mm.phase === "fini" ? "En attente de la feuille" : "En jeu"}</span>
        </span>
        {detail}
      </div>
    );
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-4 gap-y-4 pl-1">
      {v.etat === "reussie" ? (
        <Tampon key="reussie">
          Accompli{e} · +{l.m.xp} XP
        </Tampon>
      ) : v.etat === "ratee" ? (
        <Tampon key="ratee" ton="rouge">
          Échec · −{risqueDe(l.m)} XP
        </Tampon>
      ) : (
        <Tampon key="annulee" ton="gris">
          Annulé{e}
        </Tampon>
      )}
      {detail}
    </div>
  );
}

function Fiche({ l, mm, attente, repondre }: { l: LigneMission; mm: MesMissions; attente: boolean; repondre: Repondre }) {
  const identite = useIdentites();
  const rang = rangDe(l.m);
  const code = NOM_DE_CODE[l.m.genre];
  const camp = mm.d.camps.get(mm.joueur);
  const type =
    l.m.creneau === "contrat" && camp?.label.startsWith("Terrain") ? `${TYPE.contrat} · ${camp.label}` : TYPE[l.m.creneau];
  const acceptee = l.reponse?.reponse === "acceptee";
  const apres = mm.phase !== "ouvert";
  const rival = l.m.creneau === "contrat" && mm.enFace ? l.m.cibles[0] : null;
  return (
    <article
      aria-label={`Mission ${code}, rang ${rang}`}
      className={cn(
        // Noire dans les deux modes, comme une carte : la classe dark garde au
        // mode sombre ce qu'elle contient (boutons, textes).
        "fiche dark mx-4 md:mx-0",
        `fiche--${rang}`,
        apres && acceptee && l.verdict.etat === "reussie" && "fiche--reussie",
        apres && acceptee && l.verdict.etat === "ratee" && "fiche--ratee",
        apres && (!acceptee || l.verdict.etat === "annulee") && "fiche--eteinte"
      )}
    >
      <div className="fiche__bandeau">
        <span className="fiche__etiquette">Mission Bola</span>
        <span className="fiche__type mono-label text-white/75">{type}</span>
      </div>
      <div className="flex flex-col gap-5 px-[18px] pt-4 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2.5 pt-1.5">
            <h3 className="titre-lettrage text-[32px] leading-[0.9] break-words">{code}</h3>
            <Difficulte rang={rang} />
          </div>
          <Insigne rang={rang} />
        </div>
        {l.m.creneau === "contrat" && <Cible l={l} mm={mm} />}
        {(l.m.genre === "gagnez" || l.m.genre === "deux-passes") && <Escouade mm={mm} />}
        {rival && (
          <span className="fiche__duel mono-label">
            {identite.nom(rival).split(" ")[0]} a signé contre toi
          </span>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="mono-label text-white/45">Objectif</span>
          <p className="text-[20px] leading-[1.15] font-bold tracking-[-0.3px]">{phrase(l.m, identite.nom)}</p>
        </div>
        <Champs l={l} mm={mm} />
        <Action l={l} mm={mm} attente={attente} repondre={repondre} />
      </div>
    </article>
  );
}

export function MissionsBola({ className }: { className?: string }) {
  const mm = useMissions();
  const identite = useIdentites();
  const [attente, setAttente] = useState(false);
  // La notification « Missions Bola » ouvre /ligue#missions : on y descend une fois le bloc là.
  const ref = useRef<HTMLElement>(null);
  const present = !!mm;
  useEffect(() => {
    if (present && window.location.hash === "#missions") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (!mm) return null;
  const { d, joueur, apercu, lignes, phase, xp } = mm;

  const repondre = async (c: Creneau, r: Reponse["reponse"]) => {
    setAttente(true);
    try {
      await mm.repondre(c, r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réponse refusée.");
    } finally {
      setAttente(false);
    }
  };

  return (
    <section ref={ref} id="missions" aria-labelledby="titre-missions" className={cn("flex scroll-mt-4 flex-col gap-4", className)}>
      <div className="flex flex-col gap-1.5 px-5 md:px-0">
        <div className="flex items-baseline justify-between gap-3">
          <span className="mono-label truncate text-foreground/45">
            J{d.j} · {d.date}
            {apercu ? ` · ${identite.nom(joueur).split(" ")[0]}` : ""}
          </span>
          <Moment mm={mm} />
        </div>
        <h2 id="titre-missions" className="titre-lettrage text-[30px] leading-[0.95]">
          Missions Bola
        </h2>
      </div>

      {lignes.map((l) => (
        <Fiche key={l.m.creneau} l={l} mm={mm} attente={attente} repondre={(c, r) => void repondre(c, r)} />
      ))}

      {/* Le bonus des trois ; puis, une fois la feuille remplie, l'XP du dimanche. */}
      {(phase === "ouvert" || d.joue) && (
        <div className="flex items-baseline justify-between gap-3 px-5 md:px-0">
          <span className="mono-label text-foreground/45">
            {phase === "ouvert" ? "Les trois accomplies" : phase === "en-jeu" ? "À minuit" : "Ton dimanche"}
          </span>
          <span className={cn("mono-label", phase !== "ouvert" && xp < 0 ? "text-[#c8352b] dark:text-[#ff9b9d]" : "text-foreground/70")}>
            {phase === "ouvert" ? `+${XP_PARFAIT} XP de bonus` : `${signe(xp)} XP`}
          </span>
        </div>
      )}
    </section>
  );
}
