"use client";

// Les actus d'un club (Bola Club, bola-app#14 : « L'onglet Actus servirait à
// voir les actus du club »). Le fil de lib/sfl/club/actus.ts, une fiche par
// publication, la plus proche d'abord :
//   · la convocation d'un match ou d'un entraînement à venir : où, quand, et
//     le compte des réponses ; un joueur (ou son parent) y répond « Présent »
//     ou « Absent » ; l'entraîneur de la catégorie l'ouvre ;
//   · le dernier résultat de chaque catégorie : le score en Anton, les
//     buteurs, le MVP du match en carte moyenne ;
//   · les cartes qui montent : les joueurs dont la carte officielle vient de
//     changer, en cartes moyennes, et ce qu'elles ont pris (« TIR +1 ») ;
//   · les annonces du staff, signées.
// L'entraîneur (dans ses catégories) et l'admin publient une annonce depuis
// la tête du fil. Rien n'est envoyé : ni notification, ni message.

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { STAT_KEYS, type StatKey } from "@/lib/sfl/engine";
import { abrege, estGardien } from "@/lib/sfl/gardien";
import { filDuClub, jourLong, jourMoyen, type Publication } from "@/lib/sfl/club/actus";
import { publierAnnonce, repondreConvocation } from "@/lib/sfl/club/mutations";
import { categorieDe, compteReponses, membreDe } from "@/lib/sfl/club/regles";
import { nomCourt, type Seance } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { CHAMP, Feuille, FICHE, NOMBRE, Puces } from "./puces";
import { useCategorieChoisie } from "./rail-categories";

const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;

/** « FC Démo – AS Exemple », ou « Entraînement ». */
export const titreSeance = (club: { nom: string }, s: Seance) => (s.genre === "match" ? `${club.nom} – ${s.adversaire}` : "Entraînement");

function Etiquette({ genre, categorie }: { genre: string; categorie: string | null }) {
  const { club } = useClub();
  return <span className="mono-label text-encre-3">{`${genre} · ${categorie ? (categorieDe(club, categorie)?.nom ?? "") : club.nom}`}</span>;
}

function Convocation({ p }: { p: Extract<Publication, { genre: "convocation" }> }) {
  const { club, droits, agir } = useClub();
  const s = p.seance;
  const n = compteReponses(s);
  const joueur = droits.joueur && s.convoques.includes(droits.joueur.id) ? droits.joueur : null;
  const reponse = joueur ? s.reponses[joueur.id] : undefined;
  const repondre = (r: "present" | "absent") => {
    if (agir((c, moi) => repondreConvocation(c, moi, s.id, r))) navigator.vibrate?.(10);
  };
  return (
    <article className={cn(FICHE, "flex flex-col gap-3 p-4")}>
      <Etiquette genre="Convocation" categorie={p.categorie} />
      <div className="flex flex-col gap-1">
        <h2 className="text-titre-fort leading-tight font-bold tracking-tight">{titreSeance(club, s)}</h2>
        <span className="text-corps text-encre-2">{`${jourLong(s.jour)} · ${s.heure} · ${s.lieu}`}</span>
      </div>
      <span className="mono-label text-encre-3">
        {[pluriel(n.presents, "présent", "présents"), pluriel(n.absents, "absent", "absents"), `${n.sansReponse} sans réponse`].join(" · ")}
      </span>
      {joueur && (
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["present", "Présent"],
              ["absent", "Absent"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={reponse === id}
              onClick={() => repondre(id)}
              className={cn("h-11 text-lecture font-semibold", reponse === id ? "bouton-principal" : "bouton-secondaire")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {droits.gere(s.categorie) && (
        <Link href={`/club/seance/${s.id}`} className="bouton-secondaire flex h-11 items-center justify-center text-lecture font-semibold">
          Ouvrir
        </Link>
      )}
    </article>
  );
}

function Resultat({ p }: { p: Extract<Publication, { genre: "resultat" }> }) {
  const { club, droits } = useClub();
  const s = p.seance;
  const score = s.score!;
  const nom = (id: string) => {
    const m = membreDe(club, id);
    return m ? nomCourt(m) : "";
  };
  const corps = (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 text-lecture leading-tight font-semibold">{club.nom}</span>
      <span style={{ ...NOMBRE, fontSize: 40 }} className="shrink-0 tabular-nums" aria-label={`${score.nous} à ${score.eux}`}>
        {score.nous}
        <span className="mx-1.5 text-foreground/30">–</span>
        {score.eux}
      </span>
      <span className="min-w-0 flex-1 text-right text-lecture leading-tight font-semibold">{s.adversaire}</span>
    </div>
  );
  return (
    <article className={cn(FICHE, "flex flex-col gap-3 p-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <Etiquette genre="Résultat" categorie={p.categorie} />
        <span className="mono-label text-encre-3">{jourMoyen(s.jour)}</span>
      </div>
      {droits.gere(s.categorie) ? (
        <Link href={`/club/seance/${s.id}`} className="transition-opacity active:opacity-60">
          {corps}
        </Link>
      ) : (
        corps
      )}
      {p.buteurs.length > 0 && (
        <span className="text-corps text-encre-2">{p.buteurs.map((b) => `${nom(b.id)}${b.buts > 1 ? ` ×${b.buts}` : ""}`).join(" · ")}</span>
      )}
      {p.mvp.length > 0 && (
        <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-foreground/[0.08] pt-3">
          {p.mvp.map((id) => (
            <div key={id} className="flex items-center gap-3">
              <CarteClub id={id} format="moyenne" />
              <span className="flex flex-col gap-1">
                <span className="mono-label text-encre-3">MVP</span>
                <span className="text-lecture font-semibold">{nom(id)}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

const gains = (g: Partial<Record<StatKey, number>>, gardien: boolean) =>
  STAT_KEYS.filter((k) => g[k])
    .map((k) => `${abrege(k, gardien)} +${g[k]}`)
    .join(" · ");

function CartesQuiMontent({ p }: { p: Extract<Publication, { genre: "cartes" }> }) {
  const { club } = useClub();
  return (
    <article className={cn(FICHE, "flex flex-col gap-3 py-4")}>
      <span className="px-4">
        <Etiquette genre="Cartes qui montent" categorie={p.categorie} />
      </span>
      <div className="flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {p.cartes.map((c) => {
          const m = membreDe(club, c.id);
          return (
            <div key={c.id} className="flex shrink-0 flex-col items-center gap-2">
              <CarteClub id={c.id} format="moyenne" />
              <span className="mono-label max-w-[86px] text-center leading-snug text-encre-2">{gains(c.gains, estGardien(m?.poste))}</span>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function AnnonceDuStaff({ p }: { p: Extract<Publication, { genre: "annonce" }> }) {
  const { club } = useClub();
  const auteur = club.staff.find((s) => s.id === p.annonce.auteur);
  return (
    <article className={cn(FICHE, "flex flex-col gap-3 p-4")}>
      <div className="flex items-baseline justify-between gap-3">
        <Etiquette genre="Annonce" categorie={p.categorie} />
        <span className="mono-label text-encre-3">{jourMoyen(p.jour)}</span>
      </div>
      <p className="text-titre leading-snug font-semibold text-pretty">{p.annonce.texte}</p>
      {auteur && <span className="text-corps text-encre-2">{nomCourt(auteur)}</span>}
    </article>
  );
}

const TOUT = "tout";

/** Publier une annonce : le texte, la catégorie (une des siennes ; l'admin, tout le club aussi). */
function Publier({ depart }: { depart: string | null }) {
  const { club, droits, agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [texte, setTexte] = useState("");
  const miennes = club.categories.filter((c) => droits.gere(c.id)).sort((a, b) => a.ordre - b.ordre);
  const choix = [...(droits.administre ? [{ id: TOUT, label: "Tout le club" }] : []), ...miennes.map((c) => ({ id: c.id, label: c.nom }))];
  const [cible, setCible] = useState<string | null>(null);
  const actuelle = cible ?? (depart && miennes.some((c) => c.id === depart) ? depart : (choix[0]?.id ?? TOUT));
  if (!choix.length) return null;
  const publier = () => {
    if (!agir((c, moi) => publierAnnonce(c, moi, actuelle === TOUT ? null : actuelle, texte))) return;
    navigator.vibrate?.([10, 40, 18]);
    toast.success("Publié");
    setTexte("");
    setOuvert(false);
  };
  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold">
        <Plus className="size-4" strokeWidth={2.4} />
        Publier
      </button>
      <Feuille titre="Annonce" open={ouvert} onOpenChange={setOuvert}>
        <textarea aria-label="Annonce" value={texte} onChange={(e) => setTexte(e.target.value)} rows={4} maxLength={400} className={cn(CHAMP, "resize-none")} />
        <Puces nom="Catégorie" choix={choix} actif={actuelle} onChange={setCible} className="-mx-5" />
        <button type="button" disabled={!texte.trim()} onClick={publier} className="bouton-principal h-12 text-[15px] font-semibold">
          Publier
        </button>
      </Feuille>
    </>
  );
}

export function FilClub() {
  const { club, moi, role } = useClub();
  const [categorie] = useCategorieChoisie();
  const fil = filDuClub(club, moi, categorie);
  return (
    <div className="flex flex-col gap-3 px-5">
      {(role === "admin" || role === "entraineur") && <Publier depart={categorie} />}
      {fil.map((p) =>
        p.genre === "convocation" ? (
          <Convocation key={p.id} p={p} />
        ) : p.genre === "resultat" ? (
          <Resultat key={p.id} p={p} />
        ) : p.genre === "cartes" ? (
          <CartesQuiMontent key={p.id} p={p} />
        ) : (
          <AnnonceDuStaff key={p.id} p={p} />
        ),
      )}
      {fil.length === 0 && <span className="mono-label py-8 text-center text-encre-3">Rien pour l&apos;instant</span>}
    </div>
  );
}
