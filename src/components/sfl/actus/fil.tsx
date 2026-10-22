"use client";

// Le fil des Actus — l'onglet qui remplace la Ligue (Sabri, 22/10). En haut,
// « League | Bola | Team » (choix-ligue.tsx), puis un seul sélecteur, comme
// la Ligue d'avant, sans « Actus » puisqu'on y est : Classement, Match (Sabri, 22/10 : « faire un
// mix des deux et un équilibre » ; les classements complets et les matchs
// sont dans vues.tsx). Le fil, lui, se déroule en cinématiques
// (cinematiques.tsx) : les dimanches joués, du plus récent au plus ancien
// (la liste : lib/sfl/actus.ts), la prochaine journée glissée entre les
// premières scènes, et à la fin la saison passée.
// Pas d'en-tête de compte sur chaque scène (« moins Instagram ») : un
// chapitre par dimanche (« J2 · 18 oct. »), puis ses scènes, chacune avec sa
// légende et, à droite, la partager au Vestiaire. Toucher une scène la
// rejoue ; toucher une carte l'ouvre en grand.

import Link from "next/link";
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { SaisonArchiveProvider, useSeason } from "@/components/sfl/season-provider";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { BoutonRecherche } from "@/components/layout/bouton-recherche";
import { BoutonStats } from "@/components/layout/bouton-stats";
import { ChoixLigue } from "@/components/sfl/choix-ligue";
import { useIdentites } from "@/hooks/use-identites";
import { useIsClient } from "@/hooks/use-is-client";
import { filDeSaison, buteursDe, type Actu } from "@/lib/sfl/actus";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { rankPlayers } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import { journeeJouee, saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { TROPHEES, NOM_METAL, metal } from "@/lib/sfl/trophees";
import { journeeAvecVote } from "@/lib/sfl/votes";
import { preparerPiece, type PieceLigue } from "@/lib/sfl/vestiaire";
import { ANTON, Ecran } from "./ecran";
import { CineBadge, CineChiffre, CineCourse, CineDuo, CineEquipe, CineMontent, CineMvp, CinePodium, CinePresents, CineRecap, CineScore, CineSurface, CineToi, FORMAT_EQUIPE, FORMAT_MVP, FORMAT_SCORE } from "./cinematiques";
import { VueClassements, VueMatchs } from "./vues";
import { cn } from "@/lib/utils";

const DEF = Object.fromEntries(TROPHEES.map((d) => [d.id, d]));
const pl = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

/* ------------------------------ Une publication ------------------------------ */

/**
 * Le carrousel : plusieurs images côte à côte, aimantées ; chacune joue sa
 * scène quand elle arrive. Le compteur en haut à droite, les points dessous.
 */
function Carrousel({ images, ratio }: { images: { duree: number; media: ReactNode }[]; ratio: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  return (
    <div className="relative">
      <div
        ref={ref}
        className="actu-carrousel flex overflow-x-auto overscroll-x-contain"
        onScroll={(e) => {
          const el = e.currentTarget;
          setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {images.map((im, k) => (
          <div key={k} className="w-full shrink-0">
            <Ecran duree={im.duree} ratio={ratio}>{im.media}</Ecran>
          </div>
        ))}
      </div>
      <span className="pointer-events-none absolute top-3 right-3 z-20 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums backdrop-blur-sm">
        {i + 1}/{images.length}
      </span>
      <div className="pointer-events-none absolute inset-x-0 -bottom-[22px] flex justify-center gap-1.5">
        {images.map((_, k) => (
          <span key={k} className={cn("size-1.5 rounded-full transition-colors", k === i ? "bg-foreground" : "bg-foreground/25")} />
        ))}
      </div>
    </div>
  );
}

function Publication({
  duree,
  media,
  ratio = 4 / 5,
  images,
  titre,
  texte,
  partage,
  action,
}: {
  j?: number;
  date?: string;
  saison?: string;
  duree: number;
  media?: ReactNode;
  /** Le format de l'image : 4:5 par défaut, 9:16 en grand, 16:9, carré. */
  ratio?: number;
  /** Plusieurs images : un carrousel. */
  images?: { duree: number; media: ReactNode }[];
  titre: ReactNode;
  texte?: ReactNode;
  partage?: Omit<PieceLigue, "type">;
  action?: ReactNode;
}) {
  const router = useRouter();
  // Pas d'en-tête ni de rangée de boutons (Sabri, 22/10 : « moins Instagram ») :
  // l'image, puis sa légende ; on rejoue d'un toucher sur l'image.
  return (
    <article className="actu-publication flex flex-col">
      <div className="sm:overflow-hidden sm:rounded-[22px]">
        {images ? <Carrousel images={images} ratio={ratio} /> : <Ecran duree={duree} ratio={ratio}>{media}</Ecran>}
      </div>
      <div className={cn("flex items-start gap-2 pr-1.5 pl-4", images ? "pt-6" : "pt-2.5")}>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-semibold">{titre}</p>
          {texte && <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-foreground/55">{texte}</p>}
        </div>
        {action}
        {partage && (
          <button
            type="button"
            aria-label="Partager au Vestiaire"
            onClick={() => {
              preparerPiece({ type: "ligue", ...partage, lignes: partage.lignes.slice(0, 6) });
              router.push("/vestiaire");
            }}
            className="bouton-discret bouton--mauve -mt-1.5 grid size-9 shrink-0 place-items-center"
          >
            <MessageCircle className="size-[19px]" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * Le chapitre d'un dimanche : une seule fois par journée, au lieu d'un
 * en-tête sur chaque publication. Le numéro en grand, la date en petit.
 */
function Chapitre({ j, date, saison }: { j: number; date: string; saison?: string }) {
  return (
    <div className="actu-chapitre flex items-end gap-3 px-5 pt-3">
      <span className="text-[44px] leading-[0.8] tracking-tight" style={{ fontFamily: ANTON }}>
        J{j}
      </span>
      <span className="mono-label pb-0.5 text-foreground/45">{[saison, date].filter(Boolean).join(" · ")}</span>
      <span className="mb-1.5 h-px flex-1 bg-foreground/12" />
    </div>
  );
}

/* ------------------------------- Les genres ------------------------------- */

function PublicationActu({ a, saison, enCours, onClassements }: { a: Actu; saison?: string; enCours: boolean; onClassements: () => void }) {
  const id = useIdentites();
  const { me } = useMyPlayer();
  const { saison: s, players } = useSeason();
  const commun = { j: a.j, date: a.date, saison };
  switch (a.type) {
    case "score": {
      const { teamA, teamB, label } = a.match;
      const { a: ba, b: bb } = buteursDe(a.match);
      const buteurs = [...ba, ...bb].map((b) => `${id.nom(b.nom)}${b.buts > 1 ? ` (${b.buts})` : ""}`);
      return (
        <Publication
          {...commun}
          duree={a.variante % 3 === 0 ? 4.2 : a.variante % 2 ? 2.4 : 3.8}
          ratio={FORMAT_SCORE[a.variante % 3]}
          media={<CineScore match={a.match} j={a.j} variante={a.variante} />}
          titre={`${teamA.name} ${teamA.score} – ${teamB.score} ${teamB.name}`}
          texte={[label, buteurs.length ? `Buts : ${buteurs.join(", ")}` : null].filter(Boolean).join(" · ")}
          partage={{ titre: `${teamA.name} ${teamA.score} – ${teamB.score} ${teamB.name}`, j: a.j, lignes: [...ba, ...bb].slice(0, 6).map((b) => ({ n: b.nom, v: `${b.buts} ${pl(b.buts, "but", "buts")}` })) }}
        />
      );
    }
    case "mvp": {
      const m = a.mvp;
      const chiffres = [m.buts > 0 && `${m.buts} ${pl(m.buts, "but", "buts")}`, m.passes > 0 && `${m.passes} ${pl(m.passes, "passe", "passes")}`, `+${m.pp} pts`].filter(Boolean).join(" · ");
      return (
        <Publication
          {...commun}
          duree={a.variante % 4 === 0 ? 4.2 : 3.2}
          ratio={FORMAT_MVP[a.variante % 4]}
          media={<CineMvp mvp={m} j={a.j} variante={a.variante} />}
          titre={`${id.nom(m.nom)}, l'homme du dimanche`}
          texte={chiffres}
          partage={{ titre: "L'homme du dimanche", j: a.j, lignes: [{ n: m.nom, v: chiffres }] }}
        />
      );
    }
    case "badge": {
      const def = DEF[a.d.id];
      const mt = metal(a.d.palier)!;
      const seuil = def.paliers[a.d.palier - 1];
      return (
        <Publication
          {...commun}
          duree={2.8}
          media={<CineBadge d={a.d} j={a.j} variante={a.variante} />}
          titre={`${id.nom(a.d.nom)} décroche ${def.nom} ${NOM_METAL[mt].toLowerCase()}`}
          texte={`${seuil} ${seuil > 1 ? def.unite[1] : def.unite[0]}`}
          partage={{ titre: "Ils ont décroché", j: a.j, lignes: [{ n: a.d.nom, v: `${def.nom} · ${NOM_METAL[mt]}` }] }}
        />
      );
    }
    case "badges": {
      const titres = a.ds.map((d) => {
        const def = DEF[d.id];
        return { d, def, mt: metal(d.palier)! };
      });
      return (
        <Publication
          {...commun}
          duree={2.8}
          images={a.ds.map((d, k) => ({ duree: 2.8, media: <CineBadge d={d} j={a.j} variante={k} /> }))}
          titre={`${a.ds.length} badges décrochés à la J${a.j}`}
          texte={titres.map(({ d, def, mt }) => `${id.nom(d.nom)} · ${def.nom} ${NOM_METAL[mt].toLowerCase()}`).join(" · ")}
          partage={{ titre: "Ils ont décroché", j: a.j, lignes: titres.map(({ d, def, mt }) => ({ n: d.nom, v: `${def.nom} · ${NOM_METAL[mt]}` })) }}
        />
      );
    }
    case "chiffre":
      return (
        <Publication
          {...commun}
          duree={3}
          ratio={1}
          media={<CineChiffre nom={a.nom} n={a.n} quoi={a.quoi} j={a.j} />}
          titre={`${a.n} ${a.quoi === "buts" ? pl(a.n, "but", "buts") : pl(a.n, "passe", "passes")} pour ${id.nom(a.nom)} à la J${a.j}`}
          texte="Personne n'a fait mieux ce dimanche"
          partage={{ titre: `${a.n} ${a.quoi} en un dimanche`, j: a.j, lignes: [{ n: a.nom, v: `${a.n} ${a.quoi}` }] }}
        />
      );
    case "presents":
      return (
        <Publication
          {...commun}
          duree={3.2}
          media={<CinePresents noms={a.noms} j={a.j} />}
          titre={`Ils étaient ${a.noms.length} à la J${a.j}`}
          texte={a.noms.map((n) => id.nom(n)).join(", ")}
        />
      );
    case "equipe":
      return (
        <Publication
          {...commun}
          duree={2.6}
          ratio={FORMAT_EQUIPE[a.variante % 2]}
          media={<CineEquipe equipe={a.equipe} j={a.j} variante={a.variante} />}
          titre={`L'équipe type de la J${a.j}`}
          texte={a.equipe.map((e) => id.nom(e.nom)).join(", ")}
          partage={{ titre: "L'équipe type", j: a.j, lignes: a.equipe.map((e) => ({ n: e.nom, v: `+${e.pp} pts` })) }}
        />
      );
    case "duo":
      return (
        <Publication
          {...commun}
          duree={3}
          ratio={1}
          media={<CineDuo duo={a.duo} j={a.j} />}
          titre={`${id.nom(a.duo.passeur)} → ${id.nom(a.duo.buteur)}, ${a.duo.n} fois`}
          texte="La même passe, le même buteur"
          partage={{ titre: "Le duo", j: a.j, lignes: [{ n: a.duo.passeur, v: "passeur" }, { n: a.duo.buteur, v: `buteur · ×${a.duo.n}` }] }}
        />
      );
    case "montent": {
      const [m] = a.montent;
      return (
        <Publication
          {...commun}
          duree={3}
          media={<CineMontent montent={a.montent} j={a.j} />}
          titre={`${id.nom(m.nom)} gagne ${m.gain} ${pl(m.gain, "place", "places")}`}
          texte={[`${m.rang + m.gain}e → ${m.rang}e au Pépite d'Or`, ...a.montent.slice(1, 4).map((x) => `${id.nom(x.nom)} ▲${x.gain}`)].join(" · ")}
          partage={{ titre: "Ils montent", j: a.j, lignes: a.montent.map((x) => ({ n: x.nom, v: `▲ ${x.gain} · ${x.rang}e` })) }}
        />
      );
    }
    case "podium": {
      const top = rankPlayers(players).slice(0, 3);
      return (
        <Publication
          {...commun}
          duree={3}
          media={<CinePodium j={a.j} />}
          titre={`Le podium du Pépite d'Or après la J${a.j}`}
          texte={top.map((p) => `${p.rank}. ${id.nom(p.name)} ${p.pp} pts`).join(" · ")}
          partage={{ titre: "Le podium du Pépite d'Or", j: a.j, lignes: top.map((p) => ({ n: p.name, v: `${p.rank}e · ${p.pp} pts` })) }}
          action={
            <button type="button" onClick={onClassements} className="bouton-discret bouton--or -mt-1 flex shrink-0 items-center gap-0.5 py-1.5 pr-1 pl-2.5 text-[13.5px] font-semibold">
              Classements <ChevronRight className="size-4" />
            </button>
          }
        />
      );
    }
    case "course": {
      const classes = rankPlayers(players);
      const [p1, p2] = classes;
      const moi = classes.find((p) => p.name === me);
      const devant = moi && moi.rank > 1 ? classes.find((p) => p.rank === moi.rank - 1) : undefined;
      const texte = devant && moi ? `Toi : ${moi.rank}e, ${devant.pp - moi.pp} ${pl(devant.pp - moi.pp, "pt", "pts")} derrière ${id.nom(devant.name)}` : undefined;
      return (
        <Publication
          {...commun}
          duree={3.2}
          media={<CineCourse moi={me} />}
          titre={p1 && p2 ? `${id.nom(p1.name)} mène avec ${p1.pp - p2.pp} ${pl(p1.pp - p2.pp, "pt", "pts")} d'avance` : "La course au Pépite d'Or"}
          texte={texte}
          partage={{ titre: "La course", j: a.j, lignes: classes.slice(0, 5).map((p) => ({ n: p.name, v: `${p.pp} pts` })) }}
        />
      );
    }
    case "surface":
      return (
        <Publication
          {...commun}
          duree={3}
          ratio={1}
          media={<CineSurface surface={a.surface} j={a.j} />}
          titre="À un pas du prochain badge"
          texte={a.surface.slice(0, 3).map((x) => id.nom(x.nom)).join(", ")}
          partage={{ titre: "Dans la surface", j: a.j, lignes: a.surface.map((x) => ({ n: x.nom, v: `${DEF[x.id].nom} · plus que ${x.reste}` })) }}
        />
      );
    case "recap": {
      const joueurs = new Set(s.entries.filter((e) => e.j === a.j && e.statut === "Présent" && !e.extraTime && !isHidden(e.player)).map((e) => e.player)).size;
      return (
        <Publication
          {...commun}
          duree={2.8}
          ratio={1}
          media={<CineRecap j={a.j} date={a.date} buts={a.buts} matchs={a.matchs} joueurs={joueurs} />}
          titre={`La J${a.j} en entier`}
          texte={`${a.buts} ${pl(a.buts, "but", "buts")} · ${a.matchs} ${pl(a.matchs, "match", "matchs")} · ${joueurs} joueurs`}
          action={
            enCours ? (
              <Link href={`/ligue/journee?j=${a.j}`} className="bouton-discret bouton--vert -mt-1 flex shrink-0 items-center gap-0.5 py-1.5 pr-1 pl-2.5 text-[13.5px] font-semibold">
                Le récap <ChevronRight className="size-4" />
              </Link>
            ) : null
          }
        />
      );
    }
  }
}

/** Ton dimanche : la première publication du fil, si tu as joué le dernier. */
function TonDimanche({ j, date }: { j: number; date: string }) {
  const { player, me } = useMyPlayer();
  const { saison } = useSeason();
  const lignes = saison.entries.filter((e) => e.j === j && e.player === me);
  const joue = lignes.some((e) => e.statut === "Présent" && !e.extraTime);
  const delta = useMemo(() => {
    const avant = Math.max(0, ...saison.journees.map((m) => m.j).filter((x) => x < j && journeeJouee(saison, x)));
    if (!avant) return 0;
    const rang = (s: typeof saison) => rankPlayers(computeStandings(s).filter((p) => !isHidden(p.name))).find((p) => p.name === me)?.rank;
    const r1 = rang({ ...saison, entries: saison.entries.filter((e) => e.j <= j) });
    const r0 = rang({ ...saison, entries: saison.entries.filter((e) => e.j <= avant) });
    return r0 && r1 ? r0 - r1 : 0;
  }, [saison, j, me]);
  if (!joue || !player) return null;
  const buts = lignes.reduce((t, e) => t + e.buts, 0);
  const passes = lignes.reduce((t, e) => t + e.passes, 0);
  const pp = lignes.reduce((t, e) => t + entryPP(e), 0);
  return (
    <Publication
      j={j}
      date={date}
      duree={3.6}
      ratio={9 / 16}
      media={<CineToi p={player} j={j} buts={buts} passes={passes} pp={pp} delta={delta} reel />}
      titre="Ton dimanche"
      texte={[buts > 0 && `${buts} ${pl(buts, "but", "buts")}`, passes > 0 && `${passes} ${pl(passes, "passe", "passes")}`, `+${pp} pts`, delta > 0 ? `▲ ${delta} au Pépite d'Or` : delta < 0 ? `▼ ${-delta} au Pépite d'Or` : null].filter(Boolean).join(" · ")}
      partage={{ titre: "Mon dimanche", j, lignes: [{ n: me, v: `${buts} buts · ${passes} passes · +${pp} pts` }] }}
    />
  );
}

/* ------------------------------- Une saison ------------------------------- */

function FilSaison({ enCours, onClassements, nom, apres }: { enCours: boolean; onClassements: () => void; nom?: string; apres?: ReactNode }) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const fil = useMemo(() => filDeSaison(saison, journees, me, enCours), [saison, journees, me, enCours]);
  // Le fil se déroule par paquets : on ne construit que ce qu'on approche.
  const [n, setN] = useState(8);
  const fin = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = fin.current;
    if (!el) return;
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setN((x) => x + 8), { rootMargin: "1200px 0px" });
    o.observe(el);
    return () => o.disconnect();
  }, [fil.length, n]);
  const dernier = fil[0];
  return (
    <>
      {enCours && dernier && <Chapitre j={dernier.j} date={dernier.date} />}
      {enCours && dernier && <TonDimanche j={dernier.j} date={dernier.date} />}
      {fil.slice(0, n).map((a, i) => (
        <Fragment key={a.id}>
          {/* La prochaine journée, entre les premières publications : on y répond en passant. */}
          {i === 2 && apres}
          {(i === 0 ? !enCours : a.j !== fil[i - 1].j) && <Chapitre j={a.j} date={a.date} />}
          <PublicationActu a={a} saison={nom} enCours={enCours} onClassements={onClassements} />
        </Fragment>
      ))}
      {fil.length <= 2 && apres}
      {n < fil.length && <div ref={fin} className="h-px" />}
    </>
  );
}

/** La saison passée, au bout du fil : montée seulement quand on y arrive. */
function SaisonPassee({ onClassements }: { onClassements: () => void }) {
  const { saison } = useSeason();
  const archive = saison.archives?.[saison.archives.length - 1];
  const s = useMemo(() => (archive ? saisonDepuisArchive(archive) : null), [archive]);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const o = new IntersectionObserver(([e]) => e.isIntersecting && setVisible(true), { rootMargin: "900px 0px" });
    o.observe(el);
    return () => o.disconnect();
  }, [visible]);
  if (!archive || !s) return null;
  return (
    <>
      <div ref={ref} className="flex items-center gap-3 px-5 pt-2">
        <span className="h-px flex-1 bg-foreground/10" />
        <span className="mono-label text-foreground/40">{archive.nom}</span>
        <span className="h-px flex-1 bg-foreground/10" />
      </div>
      {visible && (
        <SaisonArchiveProvider saison={s}>
          <FilSaison enCours={false} onClassements={onClassements} nom={archive.nom} />
        </SaisonArchiveProvider>
      )}
    </>
  );
}

/* ---------------------------------- Le fil ---------------------------------- */

function VoteDuJour({ me }: { me: string }) {
  const isClient = useIsClient();
  const { journees } = useSeason();
  if (!isClient) return null;
  const maintenant = new Date();
  const ouvertes = journees.filter((j) => journeeAvecVote(j) && voteOuvert(j.date, maintenant));
  return (
    <>
      {ouvertes.map((j) => (
        <section key={j.j} className="glass mx-4 flex flex-col gap-3 rounded-[26px] p-[18px]">
          <h2 className="text-[17px] font-bold tracking-tight">
            Vote du jour <span className="text-foreground/40">· J{j.j}</span>
          </h2>
          <VoteFigures journee={j} me={me} />
        </section>
      ))}
    </>
  );
}

type Vue = "actus" | "classements" | "matchs";
// Pas de bouton « Actus » : on y est déjà (Sabri, 22/10). Toucher le bouton
// actif ramène au fil.
const VUES: [Vue, string][] = [
  ["classements", "Classement"],
  ["matchs", "Match"],
];

/**
 * L'onglet : « League | Bola | Team », puis deux boutons, Classement et Match,
 * comme la Ligue d'avant (Sabri, 22/10 : « faire un mix des deux et un équilibre ») : le fil
 * en cinématiques, les classements complets, les matchs.
 */
export function FilActus({ vueDepart = "actus" }: { vueDepart?: Vue }) {
  const { me } = useMyPlayer();
  const [vue, setVue] = useState<Vue>(vueDepart);

  return (
    <div className="mx-auto flex w-full max-w-[470px] flex-col gap-6 pt-2 pb-8 sm:pt-6">
      <div className="flex items-center justify-between px-5">
        <h1 className="sr-only">Actus</h1>
        <ChoixLigue actif="/ligue" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <BoutonStats className="size-10 sm:size-11" />
          <BoutonRecherche className="size-10 sm:size-11" />
        </div>
      </div>
      <div className="-mt-1 px-5">
        <div className="flex gap-2" role="tablist" aria-label="Vue">
          {VUES.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={vue === id}
              onClick={() => {
                setVue(vue === id ? "actus" : id);
                document.getElementById("app-scroll")?.scrollTo({ top: 0 });
              }}
              className={cn(
                "flex-1 px-3 py-2.5 text-[14px] font-semibold whitespace-nowrap",
                vue === id ? "bouton-principal" : "bouton-secondaire",
                id === "classements" ? "bouton--or" : "bouton--vert"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {vue === "classements" ? (
        <VueClassements vote={<VoteDuJour me={me} />} />
      ) : vue === "matchs" ? (
        <VueMatchs />
      ) : (
        <>
          <VoteDuJour me={me} />
          <FilSaison
            enCours
            onClassements={() => setVue("classements")}
            apres={
              <div className="px-4">
                <PresencePanel compact />
              </div>
            }
          />
          <SaisonPassee onClassements={() => setVue("classements")} />
        </>
      )}
    </div>
  );
}
