"use client";

// La bibliothèque d'exercices d'un club (Bola Club) : les 30 exercices de
// Bola (lib/sfl/club/exercices.ts), puis ceux que le staff du club écrit.
// Les puces des thèmes filtrent ; une ligne se déplie sur ce qu'on y
// travaille, l'espace, le matériel, le déroulé et sa variante. La même liste
// sert à choisir un exercice pour le programme d'une séance (`onAjouter` :
// le rond « + » au bout de chaque ligne). Noir et blanc ; rien ne part en base.

import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { exercicesDuClub, themeDit, THEMES } from "@/lib/sfl/club/exercices";
import { creerExercice } from "@/lib/sfl/club/mutations";
import { membreDe } from "@/lib/sfl/club/regles";
import {
  nomComplet,
  type Exercice,
  type ThemeExercice,
} from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, Compteur, Feuille, FICHE, PageEnfant, Puces, teinteDe } from "./puces";
import { LegendeTerrain, TerrainExercice } from "./terrain-exercice";

type Filtre = ThemeExercice | "tous";

/** « Technique · 12 min · 6 à 12 joueurs ». */
export const exerciceDit = (e: Exercice, minutes = e.minutes) =>
  [
    themeDit(e.theme),
    `${minutes} min`,
    e.joueurs[0] === e.joueurs[1]
      ? `${e.joueurs[0]} joueurs`
      : `${e.joueurs[0]} à ${e.joueurs[1]} joueurs`,
  ].join(" · ");

/** Le détail d'un exercice : ce qu'on y travaille, l'installation, le déroulé. */
export function DetailExercice({ e }: { e: Exercice }) {
  const { club } = useClub();
  const auteur = e.auteur
    ? (club.staff.find((s) => s.id === e.auteur) ?? membreDe(club, e.auteur))
    : null;
  return (
    <div className="flex flex-col gap-3">
      <TerrainExercice e={e} />
      <LegendeTerrain />
      <p className="text-lecture text-pretty">{e.but}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {(
          [
            ["Espace", e.espace],
            ["Matériel", e.materiel],
          ] as const
        )
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="mono-label pt-0.5 text-encre-3">{k}</dt>
              <dd className="text-corps text-encre-2">{v}</dd>
            </div>
          ))}
      </dl>
      <ol className="flex flex-col gap-2">
        {e.deroule.map((l, i) => (
          <li key={i} className="flex gap-3 text-corps">
            <span className="mono-label w-4 shrink-0 pt-0.5 text-encre-3 tabular-nums">
              {i + 1}
            </span>
            <span className="text-pretty">{l}</span>
          </li>
        ))}
      </ol>
      {e.variante && (
        <p className="flex gap-3 text-corps text-encre-2">
          <span className="mono-label shrink-0 pt-0.5 text-encre-3">
            Variante
          </span>
          <span className="text-pretty">{e.variante}</span>
        </p>
      )}
      {auteur && (
        <span className="mono-label text-encre-3">
          Écrit par {nomComplet(auteur)}
        </span>
      )}
    </div>
  );
}

function LigneExercice({
  e,
  onAjouter,
}: {
  e: Exercice;
  onAjouter?: (e: Exercice) => void;
}) {
  const [ouverte, setOuverte] = useState(false);
  return (
    <li className={cn(FICHE, "trait-teinte flex flex-col overflow-hidden")} style={teinteDe(e.theme)}>
      <div className="flex items-center gap-2 pr-3">
        <button
          type="button"
          aria-expanded={ouverte}
          onClick={() => setOuverte((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-4 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-lecture font-semibold text-balance">
              {e.nom}
            </span>
            <span className="mono-label text-encre-3">
              <span className="text-[var(--teinte)]">{themeDit(e.theme)}</span>
              {exerciceDit(e).slice(themeDit(e.theme).length)}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-[18px] shrink-0 opacity-40 transition-transform",
              ouverte && "rotate-180",
            )}
          />
        </button>
        {onAjouter && (
          <button
            type="button"
            aria-label={`Ajouter ${e.nom}`}
            onClick={() => onAjouter(e)}
            className="grid size-11 shrink-0 place-items-center rounded-full bg-foreground text-background transition-transform active:scale-95"
          >
            <Plus className="size-[18px]" strokeWidth={2.6} />
          </button>
        )}
      </div>
      {ouverte && (
        <div className="border-t border-foreground/[0.08] px-4 pt-3 pb-4">
          <DetailExercice e={e} />
        </div>
      )}
    </li>
  );
}

/** La liste filtrée par thème ; `onAjouter` en fait un choix pour un programme. */
export function ListeExercices({
  onAjouter,
  className,
}: {
  onAjouter?: (e: Exercice) => void;
  className?: string;
}) {
  const { club } = useClub();
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const tous = exercicesDuClub(club);
  const choix = [
    { id: "tous" as const, label: "Tous", sous: String(tous.length) },
    ...THEMES.map((t) => ({ id: t.id, label: t.label })),
  ];
  const liste =
    filtre === "tous" ? tous : tous.filter((e) => e.theme === filtre);
  // Ceux du club d'abord : ce sont les siens.
  const ranges = [
    ...liste.filter((e) => e.origine === "club"),
    ...liste.filter((e) => e.origine === "bola"),
  ];
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Puces
        nom="Thème"
        choix={choix}
        actif={filtre}
        onChange={setFiltre}
        className="-mx-5"
      />
      <ul className="flex flex-col gap-2">
        {ranges.map((e) => (
          <LigneExercice key={e.id} e={e} onAjouter={onAjouter} />
        ))}
      </ul>
    </div>
  );
}

const DUREES = [5, 8, 10, 12, 15, 20, 25, 30];

function Ecrire() {
  const { agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [theme, setTheme] = useState<ThemeExercice>("technique");
  const [minutes, setMinutes] = useState(15);
  const [min, setMin] = useState(6);
  const [max, setMax] = useState(14);
  const [espace, setEspace] = useState("");
  const [materiel, setMateriel] = useState("");
  const [but, setBut] = useState("");
  const [deroule, setDeroule] = useState("");
  const ecrire = () => {
    if (
      !agir((c, moi) =>
        creerExercice(c, moi, {
          nom,
          theme,
          minutes,
          joueurs: [min, Math.max(min, max)],
          espace,
          materiel,
          but,
          deroule,
        }),
      )
    )
      return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Exercice ajouté");
    setNom("");
    setEspace("");
    setMateriel("");
    setBut("");
    setDeroule("");
    setOuvert(false);
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold"
      >
        <Plus className="size-4" strokeWidth={2.4} />
        Écrire un exercice
      </button>
      <Feuille titre="Exercice" open={ouvert} onOpenChange={setOuvert}>
        <input
          aria-label="Nom"
          placeholder="Nom"
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          maxLength={50}
          className={CHAMP}
        />
        <Puces
          nom="Thème"
          choix={THEMES}
          actif={theme}
          onChange={setTheme}
          className="-mx-5"
        />
        <Puces
          nom="Durée"
          choix={DUREES.map((d) => ({ id: String(d), label: `${d} min` }))}
          actif={String(minutes)}
          onChange={(d) => setMinutes(Number(d))}
          className="-mx-5"
        />
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label text-encre-3">Joueurs</span>
          <span className="flex items-center gap-3">
            <Compteur nom="Au moins" valeur={min} onChange={setMin} max={30} />
            <span className="mono-label text-encre-3">à</span>
            <Compteur
              nom="Au plus"
              valeur={Math.max(min, max)}
              onChange={setMax}
              max={30}
            />
          </span>
        </div>
        <input
          aria-label="Espace"
          placeholder="Espace (20 × 15 m)"
          value={espace}
          onChange={(e) => setEspace(e.target.value)}
          maxLength={60}
          className={CHAMP}
        />
        <input
          aria-label="Matériel"
          placeholder="Matériel"
          value={materiel}
          onChange={(e) => setMateriel(e.target.value)}
          maxLength={80}
          className={CHAMP}
        />
        <input
          aria-label="Ce qu'on travaille"
          placeholder="Ce qu'on travaille"
          value={but}
          onChange={(e) => setBut(e.target.value)}
          maxLength={160}
          className={CHAMP}
        />
        <textarea
          aria-label="Déroulé, une étape par ligne"
          placeholder={"Une étape par ligne"}
          value={deroule}
          onChange={(e) => setDeroule(e.target.value)}
          rows={4}
          className={cn(CHAMP, "resize-none")}
        />
        <button
          type="button"
          disabled={nom.trim().length < 2 || !deroule.trim()}
          onClick={ecrire}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Ajouter
        </button>
      </Feuille>
    </>
  );
}

/** La page de la bibliothèque, pour le staff. */
export function BibliothequeDuClub() {
  const { club, droits } = useClub();
  const staff =
    droits.administre || club.categories.some((c) => droits.gere(c.id));
  if (!staff) return <PageEnfant titre="Exercices">{null}</PageEnfant>;
  const siens = club.exercices.length;
  return (
    <PageEnfant
      titre="Exercices"
      sous={siens ? `Bola · ${club.nom} ${siens}` : undefined}
    >
      <Ecrire />
      <ListeExercices />
    </PageEnfant>
  );
}
