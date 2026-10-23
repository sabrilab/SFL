"use client";

// Les publications des Actus : une scène (cinematiques.tsx) et sa légende,
// avec, à droite, la partager au Vestiaire. Pas d'en-tête de compte sur
// chaque scène (« moins Instagram », Sabri, 22/10). L'onglet lui-même, la
// course et les dimanches, est dans course.tsx ; il les pose en mode film
// (ModeFil). Toucher une scène la rejoue ; toucher une carte l'ouvre en grand.

import Link from "next/link";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { VoteFigures } from "@/components/sfl/vote-figures";
import { useIdentites } from "@/hooks/use-identites";
import { useIsClient } from "@/hooks/use-is-client";
import { buteursDe, type Actu } from "@/lib/sfl/actus";
import { voteOuvert } from "@/lib/sfl/convocation-temps";
import { rankPlayers } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { computeStandings, entryPP } from "@/lib/sfl/saisie/engine";
import { journeeJouee } from "@/lib/sfl/saisie/mutations";
import { TROPHEES, NOM_METAL, metal } from "@/lib/sfl/trophees";
import { journeeAvecVote } from "@/lib/sfl/votes";
import { preparerPiece, type PieceLigue } from "@/lib/sfl/vestiaire";
import { Ecran } from "./ecran";
import { CineBadge, CineChiffre, CineCourse, CineDuo, CineEquipe, CineMontent, CineMvp, CinePodium, CinePresents, CineRecap, CineScore, CineSurface, CineToi, FORMAT_EQUIPE, FORMAT_MVP, FORMAT_SCORE } from "./cinematiques";
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

/**
 * Comment une publication se pose dans le fil (les variantes du fil,
 * fil-variantes.tsx) : « post », la scène puis sa légende (le fil de
 * /ligue) ; « film », les scènes bord à bord avec une ligne de sous-titre ;
 * « case », la scène en réduction dans une grille, qu'on ouvre en grand.
 */
export type Mode = "post" | "film" | "case";
export const ModeFil = createContext<{ mode: Mode; ouvrir?: (n: ReactNode) => void; hauteur?: number }>({ mode: "post" });

function Publication(props: Parameters<typeof PublicationPost>[0]) {
  const { mode, ouvrir, hauteur } = useContext(ModeFil);
  if (mode === "film") return <PublicationFilm {...props} />;
  if (mode === "case") {
    const { duree, media, ratio = 4 / 5, images, titre } = props;
    return (
      <article
        className="actu-case flex shrink-0 cursor-pointer flex-col gap-1.5 break-inside-avoid"
        style={hauteur ? { width: Math.min(hauteur * ratio, 300) } : undefined}
        onClickCapture={(e) => {
          e.stopPropagation();
          e.preventDefault();
          ouvrir?.(
            <ModeFil.Provider value={{ mode: "film" }}>
              <PublicationFilm {...props} />
            </ModeFil.Provider>
          );
        }}
      >
        <Reduit ratio={ratio}>
          {images ? <Ecran duree={images[0].duree} ratio={ratio}>{images[0].media}</Ecran> : <Ecran duree={duree} ratio={ratio}>{media}</Ecran>}
        </Reduit>
        <p className="line-clamp-1 px-0.5 text-[12px] leading-tight font-semibold text-foreground/80">{titre}</p>
      </article>
    );
  }
  return <PublicationPost {...props} />;
}

/**
 * Une scène en réduction : construite à la largeur d'un téléphone (390 px,
 * celle pour laquelle les cinématiques sont réglées), puis ramenée à la
 * largeur de sa case.
 */
export function Reduit({ ratio, children, base = 390 }: { ratio: number; children: ReactNode; base?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [l, setL] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const o = new ResizeObserver(([e]) => setL(e.contentRect.width));
    o.observe(el);
    return () => o.disconnect();
  }, []);
  const k = l / base;
  return (
    <div ref={ref} className="relative w-full overflow-hidden rounded-[14px]" style={{ height: l ? base / ratio * k : undefined, aspectRatio: l ? undefined : ratio }}>
      {l > 0 && (
        <div className="absolute top-0 left-0 origin-top-left" style={{ width: base, transform: `scale(${k})` }}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Le film : la scène bord à bord, puis une ligne de sous-titre, sans marge. */
function PublicationFilm({ j, date, saison, duree, media, ratio = 4 / 5, images, titre, partage, action }: Parameters<typeof PublicationPost>[0]) {
  const router = useRouter();
  return (
    <article className="actu-film flex flex-col bg-black">
      {images ? <Carrousel images={images} ratio={ratio} /> : <Ecran duree={duree} ratio={ratio}>{media}</Ecran>}
      <div className={cn("flex min-h-10 items-center gap-2 pr-1.5 pl-4", images && "pt-5")}>
        <span className="mono-label shrink-0 text-white/40">{[saison, j != null && `J${j}`, date].filter(Boolean).join(" · ")}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white/85">{titre}</span>
        {action}
        {partage && (
          <button
            type="button"
            aria-label="Partager au Vestiaire"
            onClick={() => {
              preparerPiece({ type: "ligue", ...partage, lignes: partage.lignes.slice(0, 6) });
              router.push("/vestiaire");
            }}
            className="grid size-8 shrink-0 place-items-center rounded-full text-white/55 transition-transform active:scale-90"
          >
            <MessageCircle className="size-[17px]" strokeWidth={1.8} />
          </button>
        )}
      </div>
    </article>
  );
}

function PublicationPost({
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

/* ------------------------------- Les genres ------------------------------- */

export function PublicationActu({ a, saison, enCours, onClassements }: { a: Actu; saison?: string; enCours: boolean; onClassements: () => void }) {
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
export function TonDimanche({ j, date }: { j: number; date: string }) {
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

/* ---------------------------------- Le fil ---------------------------------- */

export function VoteDuJour({ me }: { me: string }) {
  const isClient = useIsClient();
  const { journees } = useSeason();
  if (!isClient) return null;
  const maintenant = new Date();
  const ouvertes = journees.filter((j) => journeeAvecVote(j) && voteOuvert(j.date, maintenant));
  return (
    <>
      {ouvertes.map((j) => (
        <section key={j.j} className="glass mx-4 flex flex-col gap-3 rounded-[26px] p-[18px] md:mx-0">
          <h2 className="text-[17px] font-bold tracking-tight">
            Vote du jour <span className="text-foreground/40">· J{j.j}</span>
          </h2>
          <VoteFigures journee={j} me={me} />
        </section>
      ))}
    </>
  );
}
