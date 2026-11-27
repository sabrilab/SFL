"use client";

// Les blessures d'un joueur (Bola Club), sur sa fiche (fiche-joueur-club.tsx),
// pour son staff, lui-même et son parent. La blessure en cours : la zone
// allumée sur la silhouette des schémas de Bola Agent, depuis quand, et la
// reprise en six étapes (lib/sfl/club/suivi.ts, ETAPES_REPRISE), l'étape du
// jour en blanc. Le staff la fait avancer quand l'étape d'avant s'est passée
// sans douleur ; une blessure sérieuse attend le feu vert du médecin avant le
// contact. « En parler à l'agent » ouvre l'agent de l'entraîneur sur ce
// joueur. Les anciennes, en une ligne chacune. Le staff en note une nouvelle.

import Link from "next/link";
import { useState } from "react";
import { Check, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { jourMoyen } from "@/lib/sfl/club/actus";
import { avancerReprise, declarerBlessure, feuVertMedecin } from "@/lib/sfl/club/mutations";
import { blessureEnCours, blessuresDe, ETAPE_CONTACT, ETAPES_REPRISE, GRAVITES, joursDepuis } from "@/lib/sfl/club/suivi";
import type { Blessure, Membre } from "@/lib/sfl/club/types";
import { COTES, NOM_ZONE, ZONES_CORPS, type Cote, type ZoneCorps } from "@/lib/sfl/schemas-coach";
import { cn } from "@/lib/utils";
import { SchemaVue } from "../schemas-coach";
import { CHAMP, Feuille, FICHE, Puces, Segment, TitreSection } from "./puces";

/** Les zones qu'un entraîneur de foot note le plus, d'abord. */
const ZONES: ZoneCorps[] = ["chevilles", "genoux", "ischios", "adducteurs", "quadriceps", "mollets", "pieds", "lombaires", "fessiers", "epaules", "tete"];
const COTE_DIT: Record<Cote, string> = { droit: "Droit", gauche: "Gauche", "les deux": "Les deux" };

/** Une zone d'un seul côté, au singulier, accordée : « Cheville gauche », « Genou droit », « Ischios droits ». */
const SEULE: Partial<Record<ZoneCorps, [string, "f" | "m" | "mp" | "fp"]>> = {
  chevilles: ["Cheville", "f"],
  genoux: ["Genou", "m"],
  pieds: ["Pied", "m"],
  ischios: ["Ischios", "mp"],
  adducteurs: ["Adducteurs", "mp"],
  quadriceps: ["Quadriceps", "m"],
  mollets: ["Mollet", "m"],
  fessiers: ["Fessier", "m"],
  epaules: ["Épaule", "f"],
  biceps: ["Biceps", "m"],
  triceps: ["Triceps", "m"],
  "avant-bras": ["Avant-bras", "m"],
  obliques: ["Obliques", "mp"],
  pectoraux: ["Pectoraux", "mp"],
};

export function ditBlessure(b: Pick<Blessure, "zone" | "cote">): string {
  const s = SEULE[b.zone];
  if (b.cote === "les deux" || !s) return b.cote === "les deux" && s ? `${NOM_ZONE[b.zone]}, des deux côtés` : NOM_ZONE[b.zone];
  const [nom, g] = s;
  const c = b.cote === "droit" ? "droit" : "gauche";
  const accord = c === "gauche" ? (g.endsWith("p") ? "gauches" : "gauche") : g === "f" ? "droite" : g === "fp" ? "droites" : g === "mp" ? "droits" : "droit";
  return `${nom} ${accord}`;
}

function Reprise({ b, staff }: { b: Blessure; staff: boolean }) {
  const { club, agir } = useClub();
  const bloque = b.gravite === "serieuse" && !b.feuVert && b.etape + 1 >= ETAPE_CONTACT;
  const fin = b.etape >= ETAPES_REPRISE.length - 1;
  const avancer = () => {
    if (!agir((cl, moi) => avancerReprise(cl, moi, b.id))) return;
    navigator.vibrate?.(10);
    toast.success(fin ? "Retour complet" : `Étape suivante : ${ETAPES_REPRISE[b.etape + 1].nom}`);
  };
  return (
    <div className={cn(FICHE, "flex flex-col gap-4 p-4")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <span className="block text-titre leading-tight font-bold">{ditBlessure(b)}</span>
          <span className="mt-1 block text-corps text-encre-3">
            {`${GRAVITES.find((g) => g.id === b.gravite)?.label} · il y a ${joursDepuis(b.jour, club.jour)} jours`}
          </span>
          {b.note && <span className="mt-2 block text-corps leading-snug text-encre-2">{b.note}</span>}
        </div>
      </div>
      <SchemaVue schema={{ type: "corps", zones: [{ zone: b.zone, cote: b.cote }], legende: ditBlessure(b) }} />
      <ol className="flex flex-col">
        {ETAPES_REPRISE.map((e, i) => {
          const faite = i < b.etape;
          const ici = i === b.etape;
          return (
            <li key={e.nom} className="flex gap-3 py-2">
              <span
                className={cn(
                  "mt-px grid size-6 shrink-0 place-items-center rounded-full text-petit font-bold tabular-nums",
                  ici ? "bg-foreground text-background" : faite ? "bg-contraste/15 text-encre-2" : "border border-contraste/15 text-encre-4",
                )}
              >
                {faite ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-lecture leading-snug font-semibold", !ici && !faite && "text-encre-3")}>{e.nom}</span>
                {ici && <span className="mt-0.5 block text-corps leading-snug text-encre-3">{e.detail}</span>}
                {i === ETAPE_CONTACT && b.gravite === "serieuse" && (
                  <span className="mt-0.5 block text-corps leading-snug text-encre-3">{b.feuVert ? "Feu vert du médecin donné" : "Après le feu vert du médecin"}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      {staff && (
        <div className="flex flex-col gap-2">
          {bloque ? (
            <button
              type="button"
              onClick={() => agir((cl, moi) => feuVertMedecin(cl, moi, b.id)) && toast.success("Feu vert noté")}
              className="bouton-principal h-12 text-[15px] font-semibold"
            >
              Le médecin a donné son feu vert
            </button>
          ) : (
            <button type="button" onClick={avancer} className="bouton-principal h-12 text-[15px] font-semibold">
              {fin ? "Retour complet" : "Étape passée sans douleur"}
            </button>
          )}
          <Link
            href={`/club/agent?joueur=${encodeURIComponent(b.membre)}`}
            className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold"
          >
            <Sparkles className="size-4" strokeWidth={2.2} />
            En parler à l&apos;agent
          </Link>
        </div>
      )}
    </div>
  );
}

export function Blessures({ m }: { m: Membre }) {
  const { club, droits, agir } = useClub();
  const staff = droits.gereJoueur(m);
  const [ouvert, setOuvert] = useState(false);
  const [zone, setZone] = useState<ZoneCorps>("chevilles");
  const [cote, setCote] = useState<Cote>("droit");
  const [gravite, setGravite] = useState<Blessure["gravite"]>("legere");
  const [note, setNote] = useState("");
  const enCours = blessureEnCours(club, m.id);
  const anciennes = blessuresDe(club, m.id).filter((b) => b.retour);
  if (!enCours && !anciennes.length && !staff) return null;
  const noter = () => {
    if (!agir((cl, moi) => declarerBlessure(cl, moi, m.id, { zone, cote, gravite, note }))) return;
    navigator.vibrate?.(10);
    toast.success("Blessure notée");
    setNote("");
    setOuvert(false);
  };
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Blessures</TitreSection>
      {enCours && <Reprise b={enCours} staff={staff} />}
      {anciennes.length > 0 && (
        <ul className={cn(FICHE, "flex flex-col px-4 py-1")}>
          {anciennes.map((b) => (
            <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-contraste/[0.07] py-2.5 last:border-b-0">
              <span className="text-lecture font-semibold">{ditBlessure(b)}</span>
              <span className="text-corps text-encre-3">{`${jourMoyen(b.jour)} → ${jourMoyen(b.retour!)}`}</span>
            </li>
          ))}
        </ul>
      )}
      {staff && !enCours && (
        <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold">
          <Plus className="size-4" strokeWidth={2.4} />
          Noter une blessure
        </button>
      )}
      <Feuille titre="Blessure" open={ouvert} onOpenChange={setOuvert}>
        <Puces nom="Zone" className="-mx-5" choix={ZONES.filter((z) => (ZONES_CORPS as readonly string[]).includes(z)).map((z) => ({ id: z, label: NOM_ZONE[z] }))} actif={zone} onChange={setZone} />
        <Segment nom="Côté" choix={COTES.map((c) => ({ id: c, label: COTE_DIT[c] }))} actif={cote} onChange={setCote} />
        <Segment nom="Gravité" choix={GRAVITES.map((g) => ({ id: g.id, label: g.label }))} actif={gravite} onChange={setGravite} />
        <span className="px-1 text-corps text-encre-3">{`Reprise : ${GRAVITES.find((g) => g.id === gravite)?.duree}`}</span>
        <textarea
          aria-label="Ce qui s'est passé"
          placeholder="Ce qui s'est passé, ce qu'a dit le médecin"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={300}
          rows={3}
          className={cn(CHAMP, "h-auto resize-none py-3")}
        />
        <button type="button" onClick={noter} className="bouton-principal h-12 text-[15px] font-semibold">
          Noter
        </button>
      </Feuille>
    </section>
  );
}
