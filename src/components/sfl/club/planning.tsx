"use client";

// Le planning d'un staff (Bola Club) : ses séances semaine par semaine
// (lib/sfl/club/planning.ts), du lundi au dimanche. En tête, la semaine et
// ses flèches (« Cette semaine » y ramène), les puces de ses catégories
// (plus « Toutes » quand il en a plusieurs) ; puis chaque jour, et ses
// séances : l'heure en Anton, l'entraînement ou le match, la catégorie et le
// lieu, et ce qui reste à faire (le programme d'un entraînement, les
// réponses d'une convocation, le score d'un match joué). Une séance mène à sa
// page (seance.tsx). « Planifier » crée un entraînement, ou le même chaque
// semaine pour 2 à 20 semaines (mutations.ts, planifierEntrainements) ;
// « Exercices » ouvre la bibliothèque. Rien n'est envoyé.

import Link from "next/link";
import { useState } from "react";
import {
  BookOpen,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { programmeDit } from "@/lib/sfl/club/exercices";
import {
  plusJours,
  planifierEntrainements,
  SEMAINES_MAX,
} from "@/lib/sfl/club/mutations";
import {
  jourCourt,
  lundiDe,
  semaineDite,
  semaineDuPlanning,
} from "@/lib/sfl/club/planning";
import { jourLong } from "@/lib/sfl/club/actus";
import { categorieDe, compteReponses } from "@/lib/sfl/club/regles";
import type { Club, Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { titreSeance } from "./fil-club";
import {
  CHAMP,
  Compteur,
  Feuille,
  FICHE,
  NOMBRE,
  PageEnfant,
  Puces,
  Segment,
} from "./puces";

const TOUTES = "toutes";

/** Ce qui reste à faire sur une séance, ou ce qu'elle a donné. */
function etatDe(club: Club, s: Seance): { texte: string; aFaire: boolean } {
  if (s.genre === "match") {
    if (s.score)
      return { texte: `${s.score.nous} – ${s.score.eux}`, aFaire: false };
    const n = compteReponses(s);
    return {
      texte: `${n.presents} présents · ${n.sansReponse} sans réponse`,
      aFaire: false,
    };
  }
  const p = programmeDit(s.programme);
  if (p) return { texte: p, aFaire: false };
  return s.jour >= club.jour
    ? { texte: "Programme à écrire", aFaire: true }
    : { texte: "Sans programme", aFaire: false };
}

function LigneSeance({ s }: { s: Seance }) {
  const { club } = useClub();
  const etat = etatDe(club, s);
  const passee = s.jour < club.jour;
  return (
    <li>
      <Link
        href={`/club/seance/${s.id}`}
        className={cn(
          FICHE,
          "flex items-center gap-4 py-3.5 pr-3 pl-4 transition-transform active:scale-[0.99]",
          passee && "opacity-60",
        )}
      >
        <span
          style={{ ...NOMBRE, fontSize: 26 }}
          className="w-[4.25rem] shrink-0 tabular-nums"
        >
          {s.heure.replace("h", ":")}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-lecture font-semibold">
            {titreSeance(club, s)}
          </span>
          <span className="mono-label truncate text-encre-3">
            {categorieDe(club, s.categorie)?.nom} · {s.lieu}
          </span>
          <span
            className={cn(
              "flex items-center gap-1.5 text-corps",
              etat.aFaire ? "font-semibold text-foreground" : "text-encre-2",
            )}
          >
            {etat.aFaire && (
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-foreground"
              />
            )}
            {etat.texte}
          </span>
        </span>
        <ChevronRight
          className="size-5 shrink-0 opacity-40"
          strokeWidth={2.2}
        />
      </Link>
    </li>
  );
}

const REPETITION = [
  { id: "une", label: "Une fois" },
  { id: "semaine", label: "Chaque semaine" },
] as const;

function Planifier({
  depart,
  onPlanifie,
}: {
  depart: string | null;
  onPlanifie: (jour: string) => void;
}) {
  const { club, droits, agir } = useClub();
  const miennes = club.categories
    .filter((c) => droits.gere(c.id))
    .sort((a, b) => a.ordre - b.ordre);
  const [ouvert, setOuvert] = useState(false);
  const [cible, setCible] = useState<string | null>(null);
  const [jour, setJour] = useState("");
  const [heure, setHeure] = useState("");
  const [lieu, setLieu] = useState<string | null>(null);
  const [rythme, setRythme] =
    useState<(typeof REPETITION)[number]["id"]>("semaine");
  const [semaines, setSemaines] = useState(8);
  if (!miennes.length) return null;
  const categorie =
    cible ??
    (depart && miennes.some((c) => c.id === depart) ? depart : miennes[0].id);
  // L'heure et le lieu de son dernier entraînement.
  const dernier = club.seances
    .filter((s) => s.categorie === categorie && s.genre === "entrainement")
    .at(-1);
  const lieuDit = lieu ?? dernier?.lieu ?? "";
  const heureDite = heure || (dernier ? dernier.heure.replace("h", ":") : "");
  const n = rythme === "une" ? 1 : semaines;
  const planifier = () => {
    const avant = club.seances.length;
    let apres = avant;
    const ok = agir((c, moi) => {
      const r = planifierEntrainements(
        c,
        moi,
        { categorie, jour, heure: heureDite.replace(":", "h"), lieu: lieuDit },
        n,
      );
      if (r.ok) apres = r.club.seances.length;
      return r;
    });
    if (!ok) return;
    const poses = apres - avant;
    navigator.vibrate?.([10, 40, 18]);
    toast.success(
      poses > 1
        ? `${poses} entraînements au planning`
        : "Entraînement au planning",
    );
    onPlanifie(jour);
    setJour("");
    setOuvert(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="bouton-principal flex h-11 items-center justify-center gap-2 text-lecture font-semibold"
      >
        <CalendarPlus className="size-4" strokeWidth={2.4} />
        Planifier
      </button>
      <Feuille titre="Entraînement" open={ouvert} onOpenChange={setOuvert}>
        <Puces
          nom="Catégorie"
          choix={miennes.map((c) => ({ id: c.id, label: c.nom }))}
          actif={categorie}
          onChange={setCible}
          className="-mx-5"
        />
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <input
            aria-label="Premier jour"
            type="date"
            min={club.jour}
            value={jour}
            onChange={(e) => setJour(e.target.value)}
            className={cn(CHAMP, "min-w-0")}
          />
          <input
            aria-label="Heure"
            type="time"
            value={heureDite}
            onChange={(e) => setHeure(e.target.value)}
            className={cn(CHAMP, "w-[8.75rem]")}
          />
        </div>
        <input
          aria-label="Lieu"
          placeholder="Lieu"
          value={lieuDit}
          onChange={(e) => setLieu(e.target.value)}
          maxLength={60}
          className={CHAMP}
        />
        <Segment
          nom="Répétition"
          choix={REPETITION}
          actif={rythme}
          onChange={setRythme}
        />
        {rythme === "semaine" && (
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span className="text-lecture font-semibold">
                {semaines} semaines
              </span>
              {jour && (
                <span className="mono-label text-encre-3">
                  Jusqu&apos;au {jourLong(plusJours(jour, 7 * (semaines - 1)))}
                </span>
              )}
            </span>
            <Compteur
              nom="Semaines"
              valeur={semaines}
              onChange={(v) => setSemaines(Math.max(2, v))}
              max={SEMAINES_MAX}
            />
          </div>
        )}
        <button
          type="button"
          disabled={!jour || !heureDite || !lieuDit.trim()}
          onClick={planifier}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Planifier
        </button>
      </Feuille>
    </>
  );
}

export function PlanningDuClub() {
  const { club, moi, droits } = useClub();
  const miennes = club.categories
    .filter((c) => droits.gere(c.id))
    .sort((a, b) => a.ordre - b.ordre);
  const cetteSemaine = lundiDe(club.jour);
  const [lundi, setLundi] = useState(cetteSemaine);
  const [filtre, setFiltre] = useState<string>(TOUTES);
  if (!miennes.length) return <PageEnfant titre="Planning">{null}</PageEnfant>;
  const choix = [
    ...(miennes.length > 1 ? [{ id: TOUTES, label: "Toutes" }] : []),
    ...miennes.map((c) => ({ id: c.id, label: c.nom })),
  ];
  const actif = choix.some((c) => c.id === filtre) ? filtre : choix[0].id;
  const categorie = actif === TOUTES ? null : actif;
  const jours = semaineDuPlanning(club, moi, lundi, categorie);
  const total = jours.reduce((t, j) => t + j.seances.length, 0);
  return (
    <PageEnfant titre="Planning" sous={semaineDite(lundi)}>
      <div className="grid grid-cols-2 gap-2">
        <Planifier
          depart={categorie}
          onPlanifie={(j) => setLundi(lundiDe(j))}
        />
        <Link
          href="/club/exercices"
          className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold"
        >
          <BookOpen className="size-4" strokeWidth={2.4} />
          Exercices
        </Link>
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Semaine d'avant"
            onClick={() => setLundi(plusJours(lundi, -7))}
            className="bouton-secondaire grid size-11 shrink-0 place-items-center"
          >
            <ChevronLeft className="size-5" strokeWidth={2.2} />
          </button>
          <button
            type="button"
            disabled={lundi === cetteSemaine}
            onClick={() => setLundi(cetteSemaine)}
            className={cn(
              "flex-1 py-2 text-center text-corps font-semibold",
              lundi === cetteSemaine
                ? "text-foreground"
                : "text-encre-2 underline underline-offset-4",
            )}
          >
            {lundi === cetteSemaine
              ? "Cette semaine"
              : "Revenir à cette semaine"}
          </button>
          <button
            type="button"
            aria-label="Semaine d'après"
            onClick={() => setLundi(plusJours(lundi, 7))}
            className="bouton-secondaire grid size-11 shrink-0 place-items-center"
          >
            <ChevronRight className="size-5" strokeWidth={2.2} />
          </button>
        </div>
        {choix.length > 1 && (
          <Puces
            nom="Catégorie"
            choix={choix}
            actif={actif}
            onChange={setFiltre}
            className="-mx-5"
          />
        )}
      </div>
      <ol className="flex flex-col gap-5">
        {jours.map(({ jour, seances }) => {
          const { nom, numero } = jourCourt(jour);
          const aujourdhui = jour === club.jour;
          return (
            <li
              key={jour}
              className={cn(
                "flex flex-col gap-2",
                !seances.length && "opacity-45",
              )}
            >
              <span
                className={cn(
                  "mono-label flex items-baseline gap-2",
                  aujourdhui ? "text-foreground" : "text-encre-3",
                )}
              >
                <span>
                  {nom} {numero}
                </span>
                {aujourdhui && <span>· Aujourd&apos;hui</span>}
              </span>
              {seances.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {seances.map((s) => (
                    <LigneSeance key={s.id} s={s} />
                  ))}
                </ul>
              ) : (
                <span className="h-px bg-foreground/[0.08]" />
              )}
            </li>
          );
        })}
      </ol>
      {total === 0 && (
        <span className="mono-label -mt-2 text-center text-encre-3">
          Rien cette semaine
        </span>
      )}
    </PageEnfant>
  );
}
