"use client";

// Le match en direct de l'entraîneur (Bola Club ; demande de Bola, 28/11 :
// « gérer ses compos en direct, ses changements en direct, faire des prises
// de notes sur l'adversaire »). Une page enfant d'un match, pour son staff,
// tenue d'une main au bord du terrain :
//   · en haut, le score en grand et le chrono de la mi-temps, avec Reprendre
//     ou Pause, puis Mi-temps et Fin du match ; la pastille rouge « Direct »
//     tant que le chrono tourne ;
//   · quatre gros boutons : But, But adverse (en rouge), Changement, Carton ;
//   · Terrain : le système (selon le format de l'âge), les joueurs à leur
//     poste sur la pelouse, chacun avec ses minutes, ses buts, son jaune ;
//     toucher un joueur ouvre ce qu'on peut faire de lui (le remplacer,
//     l'échanger de poste, un but, un carton) ; le banc dessous ;
//   · Fil : ce qui s'est passé, minute par minute ; une erreur se retire ;
//   · Adversaire : des notes en un toucher (les plus courantes) ou écrites.
// La fin pose le score, les buts, les passes et l'appel sur la séance : les
// cartes bougent comme après une saisie. La logique est dans
// lib/sfl/club/direct.ts ; ici, rien que l'écran.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeftRight, Pause, Play, Plus, RectangleVertical, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { categorieDe, membreDe } from "@/lib/sfl/club/regles";
import {
  annulerEvenement,
  butContre,
  butPour,
  carton,
  changerSysteme,
  chrono,
  chronoDit,
  echangerPostes,
  lancerDirect,
  minuteDe,
  noterAdversaire,
  placesDe,
  remplacer,
  scoreDe,
  SYSTEMES,
  tempsDeJeu,
  terminerDirect,
  type Direct,
  type EvenementDirect,
} from "@/lib/sfl/club/direct";
import type { Club, Membre, Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { titreSeance } from "./fil-club";
import { CHAMP, Feuille, FICHE, NOMBRE, PageEnfant, puce, Segment, TitreSection } from "./puces";

type Vue = "terrain" | "fil" | "adversaire";
type Action = "but" | "changement" | "carton" | null;

const horloge = () => Date.now();

/** Les notes qu'un entraîneur prend le plus souvent sur l'adversaire, en un toucher. */
const NOTES_RAPIDES = [
  "Jeu long du gardien",
  "Pressing haut",
  "Rapide en contre",
  "Bloc bas",
  "Fort sur coups de pied arrêtés",
  "Faible de la tête",
  "Côté gauche faible",
  "Côté droit faible",
  "Leur 9 prend la profondeur",
  "Fatigués",
];

const court = (m: Membre | null) => (m ? `${m.prenom} ${m.nom[0]}.` : "?");
const initiales = (m: Membre | null) => (m ? `${m.prenom[0]}${m.nom[0]}` : "?");

/** L'heure qui avance : une fois par seconde tant que le chrono tourne. */
function useMaintenant(tourne: boolean) {
  const [t, setT] = useState(horloge);
  useEffect(() => {
    if (!tourne) return;
    const id = setInterval(() => setT(horloge()), 1000);
    return () => clearInterval(id);
  }, [tourne]);
  return tourne ? t : 0;
}

/* --------------------------------- Pelouse --------------------------------- */

function Pelouse({
  club,
  d,
  maintenant,
  choisi,
  onChoisir,
}: {
  club: Club;
  d: Direct;
  maintenant: number;
  choisi: string | null;
  onChoisir: (id: string) => void;
}) {
  const places = placesDe(d);
  const temps = tempsDeJeu(d, maintenant);
  const buts = (id: string) => d.evenements.filter((e) => e.type === "but" && e.joueur === id).length;
  const jaune = (id: string) => d.evenements.some((e) => e.type === "carton" && e.carton === "jaune" && e.joueur === id);
  const W = 100;
  const H = 132;
  const y = (v: number) => 6 + (v / 100) * (H - 12);
  const ligne = { fill: "none", stroke: "var(--terrain-craie, rgba(255,255,255,0.85))", strokeWidth: 0.6 } as const;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full rounded-[22px]" role="img" aria-label="La compo sur le terrain">
      <rect width={W} height={H} fill="var(--terrain-pelouse, #2f7d47)" />
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={i} y={(i * H) / 8} width={W} height={H / 16} fill="var(--terrain-bande, #2a7240)" />
      ))}
      <rect x={4} y={4} width={W - 8} height={H - 8} {...ligne} />
      <line x1={4} x2={W - 4} y1={H / 2} y2={H / 2} {...ligne} />
      <circle cx={W / 2} cy={H / 2} r={11} {...ligne} />
      <rect x={24} y={4} width={52} height={18} {...ligne} />
      <rect x={38} y={4} width={24} height={7} {...ligne} />
      <rect x={24} y={H - 22} width={52} height={18} {...ligne} />
      <rect x={38} y={H - 11} width={24} height={7} {...ligne} />
      <rect x={43} y={1.5} width={14} height={2.5} fill="rgba(255,255,255,0.35)" />
      <rect x={43} y={H - 4} width={14} height={2.5} fill="rgba(255,255,255,0.35)" />
      {d.terrain.map((id, i) => {
        const p = places[i];
        if (!p) return null;
        const cx = p[0];
        const cy = y(p[1]);
        if (!id) {
          return <circle key={`vide-${i}`} cx={cx} cy={cy} r={5.6} fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth={0.6} strokeDasharray="1.4 1.2" />;
        }
        const m = membreDe(club, id);
        const ici = choisi === id;
        const b = buts(id);
        return (
          <g key={id} onClick={() => onChoisir(id)} className="cursor-pointer" role="button" aria-label={court(m)}>
            <circle cx={cx} cy={cy} r={8.5} fill="transparent" />
            {ici && <circle cx={cx} cy={cy} r={7.4} fill="none" stroke="var(--club-accent, #3fcb74)" strokeWidth={1.4} />}
            <circle cx={cx} cy={cy} r={5.6} fill={i === 0 ? "#111111" : "#ffffff"} />
            <text x={cx} y={cy + 1.6} textAnchor="middle" fontSize={4.4} fontWeight={800} fill={i === 0 ? "#ffffff" : "#0b1a10"}>
              {initiales(m)}
            </text>
            <text x={cx} y={cy + 10.4} textAnchor="middle" fontSize={3.6} fontWeight={700} fill="#ffffff" style={{ paintOrder: "stroke" }} stroke="rgba(0,0,0,0.35)" strokeWidth={0.8}>
              {m?.prenom ?? "?"}
            </text>
            <text x={cx} y={cy + 14.4} textAnchor="middle" fontSize={3} fontWeight={600} fill="rgba(255,255,255,0.75)">
              {`${temps[id] ?? 0}'`}
            </text>
            {jaune(id) && <rect x={cx + 3.4} y={cy - 7} width={2.6} height={3.6} rx={0.4} fill="var(--attente, #ffb020)" />}
            {b > 0 && (
              <g>
                <circle cx={cx - 4.8} cy={cy - 4.6} r={2.4} fill="var(--club-accent, #3fcb74)" />
                <text x={cx - 4.8} y={cy - 3.5} textAnchor="middle" fontSize={3} fontWeight={800} fill="var(--club-accent-encre, #052614)">
                  {b}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ----------------------------------- Fil ----------------------------------- */

function ditEvenement(club: Club, e: EvenementDirect): { titre: string; detail?: string; ton: "accent" | "rouge" | "attente" | "neutre" } {
  const nom = (id?: string | null) => court(id ? membreDe(club, id) : null);
  if (e.type === "but") return { titre: e.joueur ? `But de ${nom(e.joueur)}` : "But", detail: e.passeur ? `Passe de ${nom(e.passeur)}` : undefined, ton: "accent" };
  if (e.type === "butContre") return { titre: "But adverse", ton: "rouge" };
  if (e.type === "changement") return { titre: `${nom(e.entre)} entre`, detail: `${nom(e.sort)} sort`, ton: "neutre" };
  return e.carton === "rouge" ? { titre: `Rouge pour ${nom(e.joueur)}`, ton: "rouge" } : { titre: `Jaune pour ${nom(e.joueur)}`, ton: "attente" };
}

function Fil({ club, s, d }: { club: Club; s: Seance; d: Direct }) {
  const { agir } = useClub();
  const evs = [...d.evenements].sort((a, b) => b.minute - a.minute);
  if (!evs.length) return <p className="px-1 text-corps text-encre-3">Rien encore.</p>;
  return (
    <ol className={cn(FICHE, "flex flex-col px-4 py-1")}>
      {evs.map((e) => {
        const t = ditEvenement(club, e);
        const retirable = !d.fini && e.type !== "changement" && !(e.type === "carton" && e.carton === "rouge");
        return (
          <li key={e.id} className="flex items-center gap-3 border-b border-contraste/[0.07] py-3 last:border-b-0">
            <span style={{ ...NOMBRE, fontSize: 22 }} className="w-9 shrink-0 text-right tabular-nums text-encre-2">{`${e.minute}'`}</span>
            <span
              className={cn(
                "size-2.5 shrink-0 rounded-full",
                t.ton === "accent" ? "bg-[var(--club-accent)]" : t.ton === "rouge" ? "bg-[var(--non)]" : t.ton === "attente" ? "bg-[var(--attente)]" : "bg-contraste/30",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className={cn("block text-lecture leading-snug font-semibold", t.ton === "rouge" && "text-[var(--non)]")}>{t.titre}</span>
              {t.detail && <span className="block text-corps text-encre-3">{t.detail}</span>}
            </span>
            {retirable && (
              <button
                type="button"
                aria-label="Retirer"
                onClick={() => agir((cl, moi) => annulerEvenement(cl, moi, s.id, e.id)) && toast("Retiré")}
                className="grid size-9 shrink-0 place-items-center rounded-full text-encre-3"
              >
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* -------------------------------- Adversaire -------------------------------- */

function Adversaire({ s, d }: { s: Seance; d: Direct }) {
  const { agir } = useClub();
  const [texte, setTexte] = useState("");
  const noter = (t: string) => {
    if (!agir((cl, moi) => noterAdversaire(cl, moi, s.id, t, horloge()))) return;
    navigator.vibrate?.(10);
    setTexte("");
  };
  return (
    <div className="flex flex-col gap-3">
      {!d.fini && (
        <>
          <div className="-mx-5 flex flex-wrap gap-2 px-5">
            {NOTES_RAPIDES.map((n) => (
              <button key={n} type="button" onClick={() => noter(n)} className={puce(false)}>
                {n}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              aria-label="Une note sur l'adversaire"
              placeholder="Leur 10 décroche, leur gardien sort mal…"
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              maxLength={200}
              rows={2}
              className={cn(CHAMP, "h-auto flex-1 resize-none py-3")}
            />
            <button type="button" aria-label="Noter" disabled={!texte.trim()} onClick={() => noter(texte)} className="bouton-principal grid size-12 shrink-0 place-items-center">
              <Plus className="size-5" strokeWidth={2.4} />
            </button>
          </div>
        </>
      )}
      {d.notes.length > 0 && (
        <ol className={cn(FICHE, "flex flex-col px-4 py-1")}>
          {[...d.notes].reverse().map((n) => (
            <li key={n.id} className="flex gap-3 border-b border-contraste/[0.07] py-3 last:border-b-0">
              <span style={{ ...NOMBRE, fontSize: 22 }} className="w-9 shrink-0 text-right tabular-nums text-encre-2">{`${n.minute}'`}</span>
              <span className="min-w-0 flex-1 text-lecture leading-snug">{n.texte}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ------------------------------ Les feuilles ------------------------------ */

function ChoixJoueurs({ club, ids, actif, onChoisir, aucun }: { club: Club; ids: string[]; actif: string | null; onChoisir: (id: string | null) => void; aucun?: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {aucun && (
        <button type="button" onClick={() => onChoisir(null)} className={puce(actif === null)}>
          {aucun}
        </button>
      )}
      {ids.map((id) => (
        <button key={id} type="button" onClick={() => onChoisir(id)} className={puce(actif === id)}>
          {court(membreDe(club, id))}
        </button>
      ))}
    </div>
  );
}

function FeuilleBut({ club, s, d, open, onClose, buteurDe }: { club: Club; s: Seance; d: Direct; open: boolean; onClose: () => void; buteurDe: string | null }) {
  const { agir } = useClub();
  const [buteur, setButeur] = useState<string | null>(buteurDe);
  const [passeur, setPasseur] = useState<string | null>(null);
  const surTerrain = d.terrain.filter((x): x is string => !!x);
  const valider = () => {
    if (!agir((cl, moi) => butPour(cl, moi, s.id, buteur, passeur, horloge()))) return;
    navigator.vibrate?.([12, 40, 12]);
    toast.success(buteur ? `But de ${court(membreDe(club, buteur))}` : "But");
    onClose();
  };
  return (
    <Feuille titre="But" open={open} onOpenChange={(o) => !o && onClose()}>
      <span className="mono-label text-encre-3">Buteur</span>
      <ChoixJoueurs club={club} ids={surTerrain} actif={buteur} onChoisir={(id) => (setButeur(id), id === passeur && setPasseur(null))} />
      <span className="mono-label text-encre-3">Passe décisive</span>
      <ChoixJoueurs club={club} ids={surTerrain.filter((x) => x !== buteur)} actif={passeur} onChoisir={setPasseur} aucun="Aucune" />
      <button type="button" disabled={!buteur} onClick={valider} className="bouton-principal h-12 text-[15px] font-semibold">
        But
      </button>
    </Feuille>
  );
}

function FeuilleChangement({ club, s, d, open, onClose, sortDe }: { club: Club; s: Seance; d: Direct; open: boolean; onClose: () => void; sortDe: string | null }) {
  const { agir } = useClub();
  const [sort, setSort] = useState<string | null>(sortDe);
  const [entre, setEntre] = useState<string | null>(null);
  const exclus = new Set(d.evenements.filter((e) => e.type === "carton" && e.carton === "rouge").map((e) => e.joueur));
  const valider = () => {
    if (!sort || !entre || !agir((cl, moi) => remplacer(cl, moi, s.id, sort, entre, horloge()))) return;
    navigator.vibrate?.(10);
    toast.success(`${court(membreDe(club, entre))} entre`);
    onClose();
  };
  return (
    <Feuille titre="Changement" open={open} onOpenChange={(o) => !o && onClose()}>
      <span className="mono-label text-encre-3">Sort</span>
      <ChoixJoueurs club={club} ids={d.terrain.filter((x): x is string => !!x)} actif={sort} onChoisir={setSort} />
      <span className="mono-label text-encre-3">Entre</span>
      {d.banc.filter((x) => !exclus.has(x)).length ? (
        <ChoixJoueurs club={club} ids={d.banc.filter((x) => !exclus.has(x))} actif={entre} onChoisir={setEntre} />
      ) : (
        <span className="text-corps text-encre-3">Personne sur le banc.</span>
      )}
      <button type="button" disabled={!sort || !entre} onClick={valider} className="bouton-principal h-12 text-[15px] font-semibold">
        Faire le changement
      </button>
    </Feuille>
  );
}

function FeuilleCarton({ club, s, d, open, onClose, joueurDe }: { club: Club; s: Seance; d: Direct; open: boolean; onClose: () => void; joueurDe: string | null }) {
  const { agir } = useClub();
  const [joueur, setJoueur] = useState<string | null>(joueurDe);
  const donner = (c: "jaune" | "rouge") => {
    if (!joueur || !agir((cl, moi) => carton(cl, moi, s.id, joueur, c, horloge()))) return;
    navigator.vibrate?.(14);
    toast(c === "rouge" ? `Rouge : ${court(membreDe(club, joueur))} sort` : `Jaune pour ${court(membreDe(club, joueur))}`);
    onClose();
  };
  return (
    <Feuille titre="Carton" open={open} onOpenChange={(o) => !o && onClose()}>
      <ChoixJoueurs club={club} ids={d.terrain.filter((x): x is string => !!x)} actif={joueur} onChoisir={setJoueur} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!joueur} onClick={() => donner("jaune")} className="bouton-secondaire flex h-12 items-center justify-center gap-2 text-[15px] font-semibold">
          <RectangleVertical className="size-4 fill-[var(--attente)] text-[var(--attente)]" />
          Jaune
        </button>
        <button type="button" disabled={!joueur} onClick={() => donner("rouge")} className="bouton-rouge flex h-12 items-center justify-center gap-2 text-[15px] font-semibold disabled:opacity-40">
          <RectangleVertical className="size-4 fill-white" />
          Rouge
        </button>
      </div>
    </Feuille>
  );
}

/** Ce qu'on fait d'un joueur touché sur le terrain : le remplacer, l'échanger de poste, un but, un carton. */
function FeuilleJoueur({
  club,
  s,
  d,
  id,
  onClose,
  onAction,
}: {
  club: Club;
  s: Seance;
  d: Direct;
  id: string | null;
  onClose: () => void;
  onAction: (a: Exclude<Action, null>, id: string) => void;
}) {
  const { agir } = useClub();
  const m = id ? membreDe(club, id) : null;
  const autres = d.terrain.filter((x): x is string => !!x && x !== id);
  const echanger = (avec: string) => {
    if (!id || !agir((cl, moi) => echangerPostes(cl, moi, s.id, id, avec))) return;
    navigator.vibrate?.(8);
    onClose();
  };
  return (
    <Feuille titre={m ? `${m.prenom} ${m.nom}` : "Joueur"} open={!!id} onOpenChange={(o) => !o && onClose()}>
      {id && (
        <>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => onAction("changement", id)} className="bouton-secondaire flex h-12 items-center justify-center gap-1.5 text-corps font-semibold">
              <Repeat className="size-4" />
              Remplacer
            </button>
            <button type="button" onClick={() => onAction("but", id)} className="bouton-principal flex h-12 items-center justify-center text-corps font-semibold">
              But
            </button>
            <button type="button" onClick={() => onAction("carton", id)} className="bouton-secondaire flex h-12 items-center justify-center gap-1.5 text-corps font-semibold">
              <RectangleVertical className="size-4" />
              Carton
            </button>
          </div>
          <span className="mono-label flex items-center gap-1.5 text-encre-3">
            <ArrowLeftRight className="size-3.5" />
            Échanger de poste avec
          </span>
          <ChoixJoueurs club={club} ids={autres} actif={null} onChoisir={(x) => x && echanger(x)} />
        </>
      )}
    </Feuille>
  );
}

/* ---------------------------------- Page ----------------------------------- */

export function DirectDuMatch({ id }: { id: string }) {
  const { club, droits, agir } = useClub();
  const router = useRouter();
  const s = club.seances.find((x) => x.id === id);
  const d = s?.direct;
  const maintenant = useMaintenant(!!d && d.repris !== null && !d.fini);
  const [vue, setVue] = useState<Vue>("terrain");
  const [action, setAction] = useState<{ type: Exclude<Action, null>; joueur: string | null; cle: number } | null>(null);
  const [choisi, setChoisi] = useState<string | null>(null);
  const [fin, setFin] = useState(false);

  if (!s || s.genre !== "match" || !droits.gere(s.categorie)) return <PageEnfant titre="Direct">{null}</PageEnfant>;
  const titre = titreSeance(club, s);
  const sur = categorieDe(club, s.categorie)?.nom;

  if (!d) {
    return (
      <PageEnfant sur={sur} titre={titre} sous={`${s.heure} · ${s.lieu}`}>
        <button
          type="button"
          disabled={!!s.score}
          onClick={() => agir((cl, moi) => lancerDirect(cl, moi, s.id)) && navigator.vibrate?.(10)}
          className="bouton-rouge flex h-14 items-center justify-center gap-2 text-[16px] font-semibold"
        >
          <span className="size-2.5 rounded-full bg-white" />
          Préparer le direct
        </button>
      </PageEnfant>
    );
  }

  const t = maintenant || 0;
  const score = scoreDe(d);
  const tourne = d.repris !== null && !d.fini;
  const minute = minuteDe(d, t);
  const ouvrir = (type: Exclude<Action, null>, joueur: string | null = null) => {
    setChoisi(null);
    setAction({ type, joueur, cle: horloge() });
  };
  const format = d.terrain.length as 5 | 8 | 11;
  const etat = d.fini ? "Terminé" : tourne ? "Direct" : d.ecoule === 0 && d.periode === 1 ? "Avant le match" : d.ecoule === 0 ? "Mi-temps" : "Pause";

  return (
    <PageEnfant sur={sur} titre={titre}>
      {/* Le score et le chrono. */}
      <div className={cn(FICHE, "flex flex-col gap-4 p-4")}>
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-petit font-bold tracking-wide uppercase",
              tourne ? "bg-[var(--non)] text-white" : "bg-contraste/10 text-encre-2",
            )}
          >
            {tourne && <span className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />}
            {etat}
          </span>
          <span className="mono-label text-encre-3">{d.fini ? "Fin" : d.periode === 1 ? "1re mi-temps" : "2e mi-temps"}</span>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="truncate text-right text-lecture font-semibold">{club.nom}</span>
          <span style={{ ...NOMBRE, fontSize: 64 }} className="tabular-nums">
            {score.nous}
            <span className="px-2 text-encre-4">–</span>
            <span className={cn(score.eux > score.nous && "text-[var(--non)]")}>{score.eux}</span>
          </span>
          <span className="truncate text-lecture font-semibold">{s.adversaire ?? "Adversaire"}</span>
        </div>
        <div className="flex items-center gap-3">
          <span style={{ ...NOMBRE, fontSize: 40 }} className="flex-1 tabular-nums">
            {chronoDit(d, t)}
          </span>
          {!d.fini && (
            <>
              <button
                type="button"
                aria-label={tourne ? "Pause" : "Reprendre"}
                onClick={() => agir((cl, moi) => chrono(cl, moi, s.id, tourne ? "pause" : "demarrer", horloge())) && navigator.vibrate?.(10)}
                className={cn(tourne ? "bouton-secondaire" : "bouton-principal", "flex h-11 items-center gap-1.5 px-4 text-corps font-semibold whitespace-nowrap")}
              >
                {tourne ? <Pause className="size-4" /> : <Play className="size-4" />}
                {tourne ? "Pause" : d.ecoule === 0 ? "Coup d'envoi" : "Reprendre"}
              </button>
              {d.periode === 1 ? (
                <button
                  type="button"
                  disabled={d.ecoule === 0 && !tourne}
                  onClick={() => agir((cl, moi) => chrono(cl, moi, s.id, "mitemps", horloge())) && toast("Mi-temps")}
                  className="bouton-secondaire h-11 px-4 text-corps font-semibold whitespace-nowrap"
                >
                  Mi-temps
                </button>
              ) : (
                <button type="button" onClick={() => setFin(true)} className="bouton-secondaire h-11 px-4 text-corps font-semibold whitespace-nowrap">
                  Fin
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Les quatre gestes du bord du terrain. */}
      {!d.fini && (
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => ouvrir("but")} className="bouton-principal h-14 text-[16px] font-semibold">
            But
          </button>
          <button
            type="button"
            onClick={() => agir((cl, moi) => butContre(cl, moi, s.id, horloge())) && (navigator.vibrate?.(20), toast("But adverse"))}
            className="bouton-rouge h-14 text-[16px] font-semibold"
          >
            But adverse
          </button>
          <button type="button" onClick={() => ouvrir("changement")} className="bouton-secondaire flex h-12 items-center justify-center gap-2 text-lecture font-semibold">
            <Repeat className="size-4" />
            Changement
          </button>
          <button type="button" onClick={() => ouvrir("carton")} className="bouton-secondaire flex h-12 items-center justify-center gap-2 text-lecture font-semibold">
            <RectangleVertical className="size-4" />
            Carton
          </button>
        </div>
      )}

      <Segment
        nom="Vue"
        choix={[
          { id: "terrain", label: "Terrain" },
          { id: "fil", label: `Fil${d.evenements.length ? ` · ${d.evenements.length}` : ""}` },
          { id: "adversaire", label: `Adversaire${d.notes.length ? ` · ${d.notes.length}` : ""}` },
        ]}
        actif={vue}
        onChange={setVue}
      />

      {vue === "terrain" ? (
        <div className="flex flex-col gap-3">
          {!d.fini && SYSTEMES[format] && (
            <div className="-mx-5 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
              {SYSTEMES[format].map((x) => (
                <button key={x.id} type="button" onClick={() => agir((cl, moi) => changerSysteme(cl, moi, s.id, x.id))} className={puce(d.systeme === x.id)}>
                  {x.id}
                </button>
              ))}
            </div>
          )}
          <Pelouse club={club} d={d} maintenant={t} choisi={choisi} onChoisir={(x) => !d.fini && setChoisi(x)} />
          <TitreSection droite={<span className="mono-label text-encre-3">{`${d.banc.length}`}</span>}>Banc</TitreSection>
          {d.banc.length ? (
            <ul className={cn(FICHE, "flex flex-col px-4 py-1")}>
              {d.banc.map((b) => {
                const m = membreDe(club, b);
                const joue = tempsDeJeu(d, t)[b];
                return (
                  <li key={b} className="flex items-center gap-3 border-b border-contraste/[0.07] py-2.5 last:border-b-0">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-contraste/10 text-petit font-bold">{initiales(m)}</span>
                    <span className="min-w-0 flex-1 text-lecture font-semibold">{m ? `${m.prenom} ${m.nom}` : "?"}</span>
                    <span className="text-corps text-encre-3 tabular-nums">{joue ? `${joue}'` : "—"}</span>
                    {!d.fini && (
                      <button type="button" aria-label={`Faire entrer ${m?.prenom ?? ""}`} onClick={() => ouvrir("changement")} className="bouton-secondaire h-9 px-3 text-corps font-semibold">
                        Entrer
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-1 text-corps text-encre-3">Personne sur le banc.</p>
          )}
        </div>
      ) : vue === "fil" ? (
        <Fil club={club} s={s} d={d} />
      ) : (
        <Adversaire s={s} d={d} />
      )}

      {d.fini && (
        <Link href={`/club/seance/${encodeURIComponent(s.id)}`} className="bouton-principal flex h-12 items-center justify-center text-[15px] font-semibold">
          Voir les stats du match
        </Link>
      )}

      {/* Les feuilles : une clé neuve à chaque ouverture, pour repartir des bons choix. */}
      {action?.type === "but" && <FeuilleBut key={action.cle} club={club} s={s} d={d} open onClose={() => setAction(null)} buteurDe={action.joueur} />}
      {action?.type === "changement" && <FeuilleChangement key={action.cle} club={club} s={s} d={d} open onClose={() => setAction(null)} sortDe={action.joueur} />}
      {action?.type === "carton" && <FeuilleCarton key={action.cle} club={club} s={s} d={d} open onClose={() => setAction(null)} joueurDe={action.joueur} />}
      <FeuilleJoueur club={club} s={s} d={d} id={choisi} onClose={() => setChoisi(null)} onAction={(a, j) => ouvrir(a, j)} />

      <Feuille titre="Fin du match" open={fin} onOpenChange={setFin}>
        <span style={{ ...NOMBRE, fontSize: 56 }} className="text-center tabular-nums">{`${score.nous} – ${score.eux}`}</span>
        <span className="text-center text-corps text-encre-3">{`${minute}' · ${d.evenements.filter((e) => e.type === "but").length} buts, ${d.notes.length} notes sur l'adversaire`}</span>
        <button
          type="button"
          onClick={() => {
            if (!agir((cl, moi) => terminerDirect(cl, moi, s.id, horloge()))) return;
            navigator.vibrate?.([12, 40, 12]);
            toast.success("Match enregistré : les cartes bougent");
            setFin(false);
            router.push(`/club/seance/${encodeURIComponent(s.id)}`);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Enregistrer le match
        </button>
      </Feuille>
    </PageEnfant>
  );
}
