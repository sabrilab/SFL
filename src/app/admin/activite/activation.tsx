"use client";

// Analytics → 2. Activation : un compte créé devient-il un joueur ?
//
// L'entonnoir des comptes créés sur la période (90 jours au plus : le
// parcours n'est lu que pour eux, ./parcours.ts) : l'app ouverte, la ville
// choisie, la carte faite au studio photo, les notifications activées, un
// match (une réponse à une convocation, ou un match de la Map rejoint), puis
// revenu un autre jour. Les joueurs se lisent étape par étape : qui bloque où.

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DAY, debutJour, pct, type Evenement, type Profil } from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";
import { Entonnoir, Section } from "./cadre";
import type { Parcours } from "./parcours";
import type { PhotoStudio } from "./vue";

/** Le parcours n'est lu que pour les comptes de moins de 90 jours (./page.tsx). */
export const FENETRE_ACTIVATION = 90 * DAY;

interface Pas {
  id: string;
  label: string;
  fait: (nom: string) => boolean;
}

/** Les étapes de l'activation et, pour chaque compte, s'il les a franchies. */
export function analyserActivation({
  profiles,
  evenements,
  studio,
  parcours,
  depuis,
  now,
}: {
  profiles: Profil[];
  evenements: Evenement[];
  studio: PhotoStudio[] | null;
  parcours: ReadonlyMap<string, Parcours> | null;
  depuis: number;
  now: number;
}) {
  const debut = Math.max(depuis, now - FENETRE_ACTIVATION);
  const cohorte = profiles.filter((p) => p.created_at != null && p.created_at >= debut).map((p) => p.name);
  const dans = new Set(cohorte);
  const jours = new Map<string, Set<number>>();
  const convoque = new Set<string>();
  for (const e of evenements) {
    if (!dans.has(e.name)) continue;
    let s = jours.get(e.name);
    if (!s) jours.set(e.name, (s = new Set()));
    s.add(debutJour(e.at));
    if (e.kind === "presence") convoque.add(e.name);
  }
  const carte = new Set((studio ?? []).filter((d) => dans.has(d.name)).map((d) => d.name));
  const pc = (n: string) => parcours?.get(n);
  const pas: Pas[] = [
    { id: "ouvert", label: "Ont ouvert l'app", fait: (n) => (jours.get(n)?.size ?? 0) > 0 },
    { id: "ville", label: "Ville choisie", fait: (n) => !!pc(n)?.ville },
    { id: "carte", label: "Carte faite au studio", fait: (n) => carte.has(n) },
    { id: "notifs", label: "Notifications activées", fait: (n) => !!pc(n)?.notifs },
    { id: "match", label: "Dans un match", fait: (n) => convoque.has(n) || (pc(n)?.dedans ?? 0) > 0 },
    { id: "revenu", label: "Revenu un autre jour", fait: (n) => (jours.get(n)?.size ?? 0) >= 2 },
  ];
  const lignes = pas.map((p) => {
    const oui = cohorte.filter(p.fait);
    return { ...p, oui, non: cohorte.filter((n) => !p.fait(n)) };
  });
  return { debut, cohorte, lignes, parcoursLu: parcours !== null };
}

export type Activation = ReturnType<typeof analyserActivation>;

export function ActivationEntonnoir({ a, onFiche }: { a: Activation; onFiche: (nom: string) => void }) {
  const [ouverte, setOuverte] = useState<string | null>(null);
  const marches = useMemo(
    () => [{ label: "Comptes créés", n: a.cohorte.length }, ...a.lignes.map((l) => ({ label: l.label, n: l.oui.length }))],
    [a]
  );
  if (a.cohorte.length === 0)
    return (
      <Section id="entonnoir-activation" titre="Du compte au joueur">
        <p className="text-corps text-encre-3">Aucun compte créé sur cette période.</p>
      </Section>
    );
  return (
    <Section
      id="entonnoir-activation"
      titre="Du compte au joueur"
      sous={`Les ${a.cohorte.length} comptes créés depuis le ${new Date(a.debut).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}. Chaque étape compte à part : un joueur peut en sauter une.`}
    >
      <Entonnoir marches={marches} pertes={false} />
      {!a.parcoursLu && <p className="mt-3 text-legende text-encre-3">La ville, les notifications et les matchs n&apos;ont pas pu être lus.</p>}
      <p className="mono-label mt-6 mb-1 text-micro text-encre-3">Qui bloque où</p>
      <div className="flex flex-col">
        {a.lignes.map((l) => (
          <div key={l.id} className="border-b border-foreground/6 last:border-0">
            <button
              onClick={() => setOuverte((o) => (o === l.id ? null : l.id))}
              className="flex w-full items-center gap-3 py-2.5 text-left"
            >
              <span className="min-w-0 flex-1 text-ligne font-semibold">{l.label}</span>
              <span className="text-legende text-encre-3 tabular-nums">
                {l.non.length} sans · {pct(l.oui.length / Math.max(1, a.cohorte.length))}
              </span>
              <ChevronDown className={cn("size-3.5 text-encre-4 transition-transform", ouverte === l.id && "rotate-180")} />
            </button>
            {ouverte === l.id && (
              <div className="flex flex-wrap gap-1.5 pb-3">
                {l.non.length === 0 ? (
                  <span className="text-petit text-encre-3">Tous l&apos;ont fait.</span>
                ) : (
                  [...l.non]
                    .sort((x, y) => x.localeCompare(y, "fr"))
                    .map((n) => (
                      <button key={n} onClick={() => onFiche(n)} className="bouton-secondaire px-2.5 py-1 text-petit font-semibold">
                        {n}
                      </button>
                    ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Section>
  );
}
