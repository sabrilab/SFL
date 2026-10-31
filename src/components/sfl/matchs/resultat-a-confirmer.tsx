"use client";

// « Résultat du match » : l'écran qui s'affiche pour confirmer ou infirmer
// (Sabri, 28/10 : « Par un écran qui s'affiche confirmer ou infirmer les
// résultats »). Il arrive à l'ouverture de l'app (invitation-carte.tsx), au
// toucher de la notification (/?resultat=id), ou depuis la fiche du match et
// Bola (« Voir le résultat »). Un résultat déjà répondu, ou décidé, s'y
// revoit en lecture (resultat_du_match, le score touché dans Mes derniers
// matchs) : l'état et mon sceau à la place de la piste.
//
// Sur le noir, dans les deux thèmes, comme les autres écrans d'ouverture :
// le score (mon équipe à pleine encre, l'autre effacée), ma ligne avec ma
// carte, la feuille entière en deux colonnes (le ou les MVP marqués), puis
// la réponse. Encre et papier seulement : l'or reste aux cartes MVP.
//
// La réponse est la réponse scellée (reponse-scellee.tsx, la règle du 27/10 :
// dite une fois, en glissé, contre les touchers involontaires) : à droite
// « Confirmer » (le vert « y aller »), à gauche « Infirmer » (l'argent
// neutre, jamais de rouge). Arrivé au bout vers « Infirmer », la piste cède
// la place à une ligne « Motif », facultative, et au bouton « Infirmer » qui
// envoie aussitôt. Le sceau posé reste un instant, puis le match suivant en
// attente prend sa place, ou l'écran se ferme. La croix ferme pour cette
// ouverture : l'écran revient tant que la fenêtre est ouverte, et le silence
// vaut accord au bout de 24 h (supabase/schema.sql, etat_resultat).
//
// Le champ « Motif » est toujours monté (caché sous la piste) : il prend le
// focus dans le geste même qui atteint « Infirmer ». Sur iPhone, Safari
// n'ouvre pas le clavier hors d'un toucher : il faut alors toucher le champ.
//
// Lisible dehors, au soleil : seul le score adverse s'efface (40 %) ; la
// colonne adverse reste à 75 %, les absents à 55 %. Les stats suivent la
// notation de Bola (« 1 B · 2 P »), lues « 1 but, 2 passes ».
//
// Tic au scellement (la réponse scellée), double tic à l'envoi réussi.
// « Réduire les animations » : rien ne glisse, le sceau se pose d'un coup.

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { MiniCarte, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { carteNeutre } from "@/components/sfl/qui-vient";
import {
  ReponseScellee,
  type IssueReponse,
} from "@/components/sfl/reponse-scellee";
import { useSeason } from "@/components/sfl/season-provider";
import { tic } from "@/lib/sfl/haptique";
import {
  MOTIF_MAX,
  issueResultat,
  libelleEtat,
  maLigne,
  matchDe,
  mvpsDuResultat,
  statsCourtes,
  statsLues,
  type LigneResultat,
  type ResultatAConfirmer,
} from "@/lib/sfl/confirmation-resultat";
import {
  direErreur,
  libelleJour,
  mesResultatsAConfirmer,
  repondreResultat,
} from "@/lib/sfl/matchs";
import { cn } from "@/lib/utils";

/** Le sceau reste à l'écran, puis la suite. */
const TENUE_MS = 1200;

const LIBELLES = { present: "Confirmer", absent: "Infirmer" } as const;
const SCELLES = { present: "Confirmé", absent: "Infirmé" } as const;

/** La carte d'un joueur : la sienne s'il en a une, sinon la carte neutre à son poste. */
function Carte({ l, size }: { l: LigneResultat; size: number }) {
  const { allPlayers } = useSeason();
  const cle = l.name.trim().toLowerCase();
  const p = allPlayers.find((x) => x.name.toLowerCase() === cle) ?? {
    ...carteNeutre(l.name),
    poste: l.poste ?? "—",
  };
  return <MiniCarte player={p} size={size} cle={`resultat-${l.id}`} />;
}

const MVP = () => (
  <span className="shrink-0 rounded-full bg-white px-1.5 py-0.5 text-etiquette leading-none font-bold tracking-wide text-black">
    MVP
  </span>
);

export function ResultatsAConfirmer({
  file,
  moi,
  apercu = false,
  onFini,
}: {
  /** Les résultats en attente, du plus ancien au plus récent. */
  file: ResultatAConfirmer[];
  /** Mon id (profiles). */
  moi: string | null;
  /** Une démonstration : rien n'est envoyé. */
  apercu?: boolean;
  onFini: () => void;
}) {
  const [liste, setListe] = useState(file);
  const [i, setI] = useState(0);
  const r = liste[i] ?? null;

  function suivant() {
    if (i + 1 < liste.length) setI(i + 1);
    else onFini();
  }

  /** La feuille vient d'être corrigée : la nouvelle version prend la place de l'ancienne. */
  async function relire() {
    const neuves = await mesResultatsAConfirmer().catch(() => null);
    if (!neuves) return;
    const restantes = liste
      .slice(i)
      .map((x) => neuves.find((n) => n.id === x.id))
      .filter((x): x is ResultatAConfirmer => !!x);
    if (restantes.length === 0) return onFini();
    setListe(restantes);
    setI(0);
  }

  if (!r) return null;
  return (
    <motion.div
      key="resultat"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="Résultat du match"
      className="dark fixed inset-0 z-[55] flex flex-col bg-black text-white"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "max(env(safe-area-inset-bottom), 21px)",
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        <Ecran
          key={`${r.id}-${r.version}`}
          r={r}
          moi={moi}
          rang={liste.length > 1 ? { i, n: liste.length } : null}
          apercu={apercu}
          onSuivant={suivant}
          onRelire={relire}
          onFermer={onFini}
        />
      </AnimatePresence>
    </motion.div>
  );
}

type Phase =
  | { t: "choix" }
  | { t: "motif" }
  | { t: "envoi" }
  | { t: "fait"; rep: "present" | "absent" };

function Ecran({
  r,
  moi,
  rang,
  apercu,
  onSuivant,
  onRelire,
  onFermer,
}: {
  r: ResultatAConfirmer;
  moi: string | null;
  rang: { i: number; n: number } | null;
  apercu: boolean;
  onSuivant: () => void;
  onRelire: () => void;
  onFermer: () => void;
}) {
  const reduit = useReducedMotion();
  const [phase, setPhase] = useState<Phase>({ t: "choix" });
  const [motif, setMotif] = useState("");
  const champ = useRef<HTMLInputElement | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (minuteur.current) clearTimeout(minuteur.current);
    },
    [],
  );
  const motifVisible = phase.t === "motif" || phase.t === "envoi";

  const mvps = new Set(mvpsDuResultat(r));
  const mienne = r.lignes.find((l) => l.id === moi) ?? null;
  const monCamp = mienne && mienne.equipe !== "absent" ? mienne.equipe : null;
  const camp = (e: "clairs" | "fonces") =>
    r.lignes
      .filter((l) => l.equipe === e)
      .sort(
        (a, b) =>
          b.buts + b.passes - (a.buts + a.passes) ||
          b.passes - a.passes ||
          a.name.localeCompare(b.name, "fr"),
      );
  const absents = r.lignes.filter((l) => l.equipe === "absent");

  /** Envoie la réponse ; « ok » une fois la base d'accord. */
  async function envoyer(rep: "confirme" | "infirme"): Promise<IssueReponse> {
    if (apercu) {
      tic([8, 40, 8]);
      return "ok";
    }
    try {
      await repondreResultat(
        r.id,
        r.version,
        rep,
        rep === "infirme" ? motif : undefined,
      );
      tic([8, 40, 8]);
      return "ok";
    } catch (e) {
      const dit = direErreur(e);
      toast(dit);
      if (/corrigée/.test(dit)) onRelire();
      else if (/déjà donnée|déjà décidé/.test(dit)) onSuivant();
      return "dite";
    }
  }

  function tenir(rep: "present" | "absent") {
    setPhase({ t: "fait", rep });
    minuteur.current = setTimeout(onSuivant, TENUE_MS);
  }

  async function infirmer() {
    setPhase({ t: "envoi" });
    const issue = await envoyer("infirme");
    if (issue === "ok") tenir("absent");
    else setPhase({ t: "motif" });
  }

  const entree = (k: number) =>
    reduit
      ? {}
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: {
            type: "spring" as const,
            stiffness: 260,
            damping: 26,
            delay: 0.06 * k,
          },
        };

  return (
    <motion.div
      initial={reduit ? false : { opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={
        reduit
          ? { opacity: 0, transition: { duration: 0 } }
          : { opacity: 0, x: -24 }
      }
      transition={{ type: "spring", stiffness: 300, damping: 32 }}
      className="mx-auto flex min-h-0 w-full max-w-[420px] flex-1 flex-col px-[21px]"
    >
      <div className="flex h-[55px] shrink-0 items-center justify-between">
        <span className="mono-label text-white/55">
          Résultat du match{rang ? ` · ${rang.i + 1}/${rang.n}` : ""}
        </span>
        <button
          type="button"
          onClick={onFermer}
          aria-label="Fermer"
          className="bouton-discret -mr-2 grid size-10 place-items-center rounded-full"
        >
          <X className="size-5 text-white/70" strokeWidth={2.2} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-[8px] pb-[13px]">
        <div className="my-auto flex flex-col gap-[21px] [@media(max-height:739px)]:gap-[13px]">
          <motion.p
            {...entree(0)}
            className="mono-label text-center text-legende text-white/45"
          >
            {matchDe(r.organisateur.split(" ")[0])} · {libelleJour(r.jour)} ·{" "}
            {r.heure} · {r.lieu}
          </motion.p>

          {/* Le score : mon équipe à pleine encre. */}
          <motion.div
            {...entree(1)}
            role="img"
            aria-label={`Clairs ${r.scoreClairs}, Foncés ${r.scoreFonces}`}
            className="grid grid-cols-[1fr_auto_1fr] items-end gap-3 text-center"
          >
            {(["clairs", "fonces"] as const).map((e, k) => (
              <div
                key={e}
                className={cn(
                  "flex flex-col items-center gap-1.5",
                  k === 1 && "col-start-3",
                  monCamp && monCamp !== e && "opacity-40",
                )}
              >
                <span className="mono-label text-white/60">
                  {e === "clairs" ? "Clairs" : "Foncés"}
                </span>
                <span className="text-[64px] leading-[0.9] font-extrabold tracking-tight tabular-nums [@media(max-height:739px)]:text-[52px]">
                  {e === "clairs" ? r.scoreClairs : r.scoreFonces}
                </span>
              </div>
            ))}
            <span className="col-start-2 row-start-1 pb-2 text-nom font-bold text-white/25">
              –
            </span>
          </motion.div>

          {/* Ma ligne. */}
          {mienne && (
            <motion.div
              {...entree(2)}
              className="flex items-center gap-4 rounded-[22px] bg-white/[0.06] p-3 pr-4"
            >
              <Carte l={mienne} size={FORMAT_CARTE.petite * 1.15} />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 truncate text-titre font-bold">
                  <span className="truncate">
                    <Nom n={mienne.name} />
                  </span>
                  {mvps.has(mienne.id) && <MVP />}
                </span>
                <span className="text-lecture font-semibold text-white/75 tabular-nums">
                  {maLigne(mienne)}
                </span>
              </div>
            </motion.div>
          )}

          {/* La feuille entière, en deux colonnes. */}
          <motion.div
            {...entree(3)}
            className="grid grid-cols-2 gap-x-[21px] gap-y-1"
          >
            {(["clairs", "fonces"] as const).map((e) => (
              <ul
                key={e}
                className={cn(
                  "flex flex-col gap-[7px]",
                  monCamp && monCamp !== e && "opacity-75",
                )}
              >
                {camp(e).map((l) => (
                  <li
                    key={l.id}
                    className="flex items-center gap-1.5 text-ligne leading-tight"
                  >
                    <span
                      className={cn(
                        "min-w-0 flex-1 truncate font-semibold",
                        l.id === moi ? "text-white" : "text-white/80",
                      )}
                    >
                      <Nom n={l.name} />
                    </span>
                    {mvps.has(l.id) && <MVP />}
                    <span
                      aria-label={statsLues(l)}
                      className="shrink-0 font-mono text-legende whitespace-nowrap text-white/60 tabular-nums"
                    >
                      {statsCourtes(l)}
                    </span>
                  </li>
                ))}
              </ul>
            ))}
            {absents.length > 0 && (
              <p className="col-span-2 mt-2 truncate text-corps text-white/55">
                <span className="mono-label mr-2 text-etiquette text-white/45">
                  Absents
                </span>
                {absents.map((l, k) => (
                  <span key={l.id}>
                    {k > 0 && ", "}
                    <Nom n={l.name} />
                  </span>
                ))}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      {/* La réponse, ou en lecture l'état et mon sceau. */}
      <div className="relative shrink-0 pt-[8px]">
        {/* Le motif, monté d'avance : le focus se donne dans le geste même. */}
        <form
          id={`motif-${r.id}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (phase.t === "motif") void infirmer();
          }}
          aria-hidden={!motifVisible || undefined}
          className={cn(
            motifVisible
              ? "mb-2"
              : "pointer-events-none absolute inset-x-0 top-[8px] opacity-0",
          )}
        >
          <input
            ref={champ}
            value={motif}
            onChange={(e) => setMotif(e.target.value.slice(0, MOTIF_MAX))}
            maxLength={MOTIF_MAX}
            placeholder="Motif"
            enterKeyHint="send"
            aria-label="Motif"
            tabIndex={motifVisible ? 0 : -1}
            className="h-[50px] w-full rounded-full bg-white/[0.08] px-5 text-lecture text-white outline-none placeholder:text-white/40 focus:ring-1 focus:ring-white/30"
          />
        </form>
        <AnimatePresence mode="wait" initial={false}>
          {r.lecture && (
            <motion.div key="lecture" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className={cn(
                    "mono-label",
                    r.etat === "compte" ? "text-white" : "text-white/60",
                  )}
                >
                  {libelleEtat(r.etat, r.c, r.n)}
                </span>
                {issueResultat(r, false) && (
                  <span className="mono-label text-right text-white/60">
                    {issueResultat(r, false)}
                  </span>
                )}
              </div>
              {r.mienne && (
                <ReponseScellee
                  mine={r.mienne === "confirme" ? "present" : "absent"}
                  libelles={LIBELLES}
                  scelles={SCELLES}
                  onRepondre={async () => "figee"}
                />
              )}
            </motion.div>
          )}
          {!r.lecture && phase.t === "choix" && (
            <motion.div
              key="piste"
              exit={{ opacity: 0, transition: { duration: reduit ? 0 : 0.14 } }}
            >
              <ReponseScellee
                mine={null}
                libelles={LIBELLES}
                scelles={SCELLES}
                onRepondre={async (rep) => {
                  if (rep === "absent") {
                    // Le motif d'abord, facultatif : rien ne part encore. Le
                    // focus avant tout await, dans le geste.
                    champ.current?.focus({ preventScroll: true });
                    setPhase({ t: "motif" });
                    return "dite";
                  }
                  return envoyer("confirme");
                }}
                onScellee={(rep) => {
                  // Le sceau est posé dans la piste même : il reste, puis la suite.
                  if (rep === "present")
                    minuteur.current = setTimeout(onSuivant, TENUE_MS);
                }}
              />
            </motion.div>
          )}
          {!r.lecture && motifVisible && (
            <motion.div
              key="motif"
              initial={reduit ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduit ? 0 : 0.14 } }}
              className="grid grid-cols-[auto_1fr] gap-2"
            >
              <button
                type="button"
                disabled={phase.t === "envoi"}
                onClick={() => {
                  champ.current?.blur();
                  setPhase({ t: "choix" });
                }}
                className="bouton-discret h-[50px] px-5 text-lecture font-semibold text-white/60"
              >
                Annuler
              </button>
              <button
                type="submit"
                form={`motif-${r.id}`}
                disabled={phase.t === "envoi"}
                className="bouton-secondaire h-[50px] text-lecture font-semibold disabled:opacity-50"
              >
                Infirmer
              </button>
            </motion.div>
          )}
          {!r.lecture && phase.t === "fait" && (
            <motion.div
              key="fait"
              initial={reduit ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.24, ease: [0.2, 0.9, 0.3, 1] }}
            >
              <ReponseScellee
                mine={phase.rep}
                libelles={LIBELLES}
                scelles={SCELLES}
                onRepondre={async () => "figee"}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
