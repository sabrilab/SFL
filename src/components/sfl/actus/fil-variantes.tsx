"use client";

// Le fil des Actus, en variantes à comparer (Sabri, 22/10 : « des variantes
// améliorées de la section Actus »). Les mêmes cinématiques, les mêmes faits
// (lib/sfl/actus.ts), posés autrement ; l'en-tête, Classement et Match restent
// ceux de /ligue (FilActus). Page d'essai : /ligue/fil?v=1..5.
//   1 · Le fil      : celui de /ligue, tel quel ;
//   2 · Le film     : les scènes bord à bord, une ligne de sous-titre, et un
//                     intertitre animé qui ouvre chaque dimanche ;
//   3 · Le journal  : chaque dimanche en une page de magazine, la grande
//                     scène en tête, les autres en grille, qu'on ouvre en grand ;
//   4 · La course   : la course au Pépite d'Or en tête du fil, le classement
//                     complet à un toucher, puis le film ;
//   5 · Les rangées : un dimanche par rangée, ses scènes glissées de côté.
// Une scène ouverte en grand se ferme toujours : la croix, le fond, Échap.

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronRight, X } from "lucide-react";
import { useMyPlayer } from "@/components/sfl/player-provider";
import {
  SaisonArchiveProvider,
  useSeason,
} from "@/components/sfl/season-provider";
import { PresencePanel } from "@/components/sfl/presence-panel";
import { filDeSaison, type Actu } from "@/lib/sfl/actus";
import { saisonDepuisArchive } from "@/lib/sfl/saisie/mutations";
import { ANTON, Ecran, Lettres, Rouleau, t } from "./ecran";
import { CineCourse } from "./cinematiques";
import {
  ModeFil,
  PublicationActu,
  TonDimanche,
  VoteDuJour,
  type Mode,
} from "./fil";
import { cn } from "@/lib/utils";

export const VARIANTES_FIL = [
  "Le fil",
  "Le film",
  "Le journal",
  "La course",
  "Les rangées",
] as const;

type Dimanche = { j: number; date: string; items: Actu[] };

function parDimanche(fil: Actu[]): Dimanche[] {
  const out: Dimanche[] = [];
  for (const a of fil) {
    const d = out[out.length - 1];
    if (d && d.j === a.j) d.items.push(a);
    else out.push({ j: a.j, date: a.date, items: [a] });
  }
  return out;
}

/** L'intertitre d'un dimanche : le numéro qui claque, la date, les buts en rouleaux. */
function Intertitre({
  j,
  date,
  saison,
}: {
  j: number;
  date: string;
  saison?: string;
}) {
  const { journees } = useSeason();
  const meta = journees.find((x) => x.j === j);
  const buts = (meta?.matches ?? []).reduce(
    (s, m) => s + m.teamA.score + m.teamB.score,
    0,
  );
  const matchs = meta?.matches?.length ?? 0;
  return (
    <Ecran duree={1.6} ratio={2.3} fond="#000">
      <div className="absolute inset-0 flex items-center gap-5 px-6">
        <span
          className="leading-[0.8] tracking-tight"
          style={{ fontFamily: ANTON, fontSize: 104 }}
        >
          <Lettres
            texte={`J${j}`}
            a={0.05}
            pas={0.08}
            anim="a-claque"
            du={0.45}
          />
        </span>
        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="a-fondu mono-label text-white/45" style={t(0.35)}>
            {[saison, date].filter(Boolean).join(" · ")}
          </span>
          {buts > 0 && (
            <span
              className="flex items-baseline gap-1.5 text-white"
              style={{ fontFamily: ANTON, fontSize: 30 }}
            >
              <Rouleau n={buts} a={0.45} du={1} />
              <span className="mono-label text-[10px] text-white/55">
                buts · {matchs} matchs
              </span>
            </span>
          )}
        </span>
        <span
          aria-hidden
          className="a-barre absolute right-0 bottom-[22%] left-6 h-px origin-left bg-white/15"
          style={t(0.5, 0.9)}
        />
      </div>
    </Ecran>
  );
}

/** Une scène ouverte en grand, par-dessus tout. */
function Modale({
  contenu,
  fermer,
}: {
  contenu: ReactNode;
  fermer: () => void;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && fermer();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [fermer]);
  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 backdrop-blur-md"
      onClick={fermer}
    >
      <div
        className="relative w-full max-w-[470px]"
        onClick={(e) => e.stopPropagation()}
      >
        {contenu}
      </div>
      <button
        type="button"
        aria-label="Fermer"
        onClick={fermer}
        className="glass absolute right-4 grid size-11 place-items-center rounded-full"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <X className="size-5" />
      </button>
    </div>,
    document.body,
  );
}

/** Ouvrir une scène en grand : fourni par FilVariante. */
const Ouvrir = createContext<((n: ReactNode) => void) | undefined>(undefined);

function Avec({
  mode,
  hauteur,
  children,
}: {
  mode: Mode;
  hauteur?: number;
  children: ReactNode;
}) {
  const ouvrir = useContext(Ouvrir);
  return (
    <ModeFil.Provider value={{ mode, ouvrir, hauteur }}>
      {children}
    </ModeFil.Provider>
  );
}

/** Une saison, posée selon la variante. */
function Saison({
  v,
  enCours,
  nom,
  onClassements,
  apres,
}: {
  v: number;
  enCours: boolean;
  nom?: string;
  onClassements: () => void;
  apres?: ReactNode;
}) {
  const { saison, journees } = useSeason();
  const { me } = useMyPlayer();
  const dimanches = useMemo(
    () => parDimanche(filDeSaison(saison, journees, me, enCours)),
    [saison, journees, me, enCours],
  );
  const pub = (a: Actu) => (
    <PublicationActu
      key={a.id}
      a={a}
      saison={nom}
      enCours={enCours}
      onClassements={onClassements}
    />
  );
  const premier = dimanches[0];

  if (v === 5)
    return (
      <>
        {dimanches.map((d, i) => (
          <Fragment key={d.j}>
            {i === 1 && apres}
            <section className="flex flex-col gap-2.5">
              <div className="flex items-end gap-2.5 px-5">
                <span
                  className="text-[34px] leading-[0.8]"
                  style={{ fontFamily: ANTON }}
                >
                  J{d.j}
                </span>
                <span className="mono-label text-foreground/45">
                  {[nom, d.date].filter(Boolean).join(" · ")}
                </span>
                <span className="mono-label ml-auto text-foreground/35">
                  {d.items.length} scènes
                </span>
              </div>
              <div className="actu-carrousel flex items-start gap-3 overflow-x-auto overscroll-x-contain px-5 [scroll-padding-inline:20px]">
                {/* Les scènes d'une rangée à la même hauteur (leur largeur suit leur format), les larges bornées. */}
                <Avec mode="case" hauteur={340}>
                  {enCours && d === premier && (
                    <TonDimanche j={d.j} date={d.date} />
                  )}
                  {d.items.map(pub)}
                </Avec>
              </div>
            </section>
          </Fragment>
        ))}
        {dimanches.length === 1 && apres}
      </>
    );

  if (v === 3)
    return (
      <>
        {dimanches.map((d, i) => {
          const [tete, ...reste] = d.items;
          return (
            <Fragment key={d.j}>
              {i === 1 && apres}
              <section className="flex flex-col gap-3">
                <Intertitre j={d.j} date={d.date} saison={nom} />
                <Avec mode="film">
                  {enCours && d === premier ? (
                    <TonDimanche j={d.j} date={d.date} />
                  ) : (
                    pub(tete)
                  )}
                </Avec>
                <div className="columns-2 gap-3 px-4 [&>*]:mb-4">
                  <Avec mode="case">
                    {(enCours && d === premier ? d.items : reste).map(pub)}
                  </Avec>
                </div>
              </section>
            </Fragment>
          );
        })}
        {dimanches.length === 1 && apres}
      </>
    );

  // 2 et 4 : le film.
  return (
    <div className="flex flex-col">
      {dimanches.map((d, i) => (
        <Fragment key={d.j}>
          {i === 1 && apres}
          <section className="flex flex-col">
            <Intertitre j={d.j} date={d.date} saison={nom} />
            <Avec mode="film">
              {enCours && d === premier && (
                <TonDimanche j={d.j} date={d.date} />
              )}
              {d.items
                .filter((a) => !(v === 4 && a.type === "course"))
                .map(pub)}
            </Avec>
          </section>
        </Fragment>
      ))}
      {dimanches.length === 1 && apres}
    </div>
  );
}

/** La course en tête du fil (variante 4), le classement complet à un toucher. */
function Course({ onClassements }: { onClassements: () => void }) {
  const { me } = useMyPlayer();
  return (
    <section className="flex flex-col">
      <Ecran duree={3.2}>
        <CineCourse moi={me} />
      </Ecran>
      <button
        type="button"
        onClick={onClassements}
        className="flex items-center justify-between bg-black px-4 py-3 text-left"
      >
        <span>
          <span className="mono-label block text-white/40">
            Pépite d&apos;Or · en direct
          </span>
          <span className="text-[15px] font-semibold">Tout le classement</span>
        </span>
        <ChevronRight className="size-5 text-white/60" />
      </button>
    </section>
  );
}

export function FilVariante({
  v,
  onClassements,
}: {
  v: number;
  onClassements: () => void;
}) {
  const { saison } = useSeason();
  const { me } = useMyPlayer();
  const [ouvert, setOuvert] = useState<ReactNode>(null);
  const fermer = useCallback(() => setOuvert(null), []);
  const archive = saison.archives?.[saison.archives.length - 1];
  const s = useMemo(
    () => (archive ? saisonDepuisArchive(archive) : null),
    [archive],
  );
  return (
    <Ouvrir.Provider value={setOuvert}>
      <div
        className={cn("flex flex-col", v === 2 || v === 4 ? "gap-0" : "gap-7")}
      >
        <VoteDuJour me={me} />
        {v === 4 && <Course onClassements={onClassements} />}
        <Saison
          v={v}
          enCours
          onClassements={onClassements}
          apres={
            <div className={cn("px-4", (v === 2 || v === 4) && "py-6")}>
              <PresencePanel compact />
            </div>
          }
        />
        {archive && s && (
          <SaisonArchiveProvider saison={s}>
            <Saison
              v={v}
              enCours={false}
              nom={archive.nom}
              onClassements={onClassements}
            />
          </SaisonArchiveProvider>
        )}
        {ouvert && <Modale contenu={ouvert} fermer={fermer} />}
      </div>
    </Ouvrir.Provider>
  );
}
