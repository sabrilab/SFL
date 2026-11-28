"use client";

// Le matériel du club (Bola Club) : l'inventaire que tient le staff, ligne
// par ligne (ballons, plots, chasubles, mini-buts…), avec sa quantité en − / +
// et ce qui est à remplacer ; « Ajouter » une ligne. L'admin y vient de
// « Gérer le club », l'entraîneur de son planning. Ce qu'une séance demande se
// lit sur son programme (programme.tsx, « À prévoir »). Rien ne part en base.

import { useState } from "react";
import { BriefcaseMedical, Dumbbell, Goal, Plus, Shirt, TrafficCone, Volleyball, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useClub } from "@/hooks/use-club";
import { ajouterMateriel, compterMateriel } from "@/lib/sfl/club/mutations";
import type { Materiel } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, Compteur, Feuille, FICHE, NOMBRE, PageEnfant } from "./puces";

/** La famille d'une ligne, devinée à son nom : son dessin et sa couleur (app/club/couleurs.css). */
const FAMILLES: { id: string; nom: string; motif: RegExp; icone: LucideIcon; teinte: string }[] = [
  { id: "ballons", nom: "Ballons", motif: /ballon/i, icone: Volleyball, teinte: "var(--th-technique)" },
  { id: "balisage", nom: "Balisage", motif: /plot|coupelle|haie|échelle|cerceau|piquet/i, icone: TrafficCone, teinte: "var(--th-echauffement)" },
  { id: "chasubles", nom: "Chasubles", motif: /chasuble|maillot|brassard/i, icone: Shirt, teinte: "var(--th-finition)" },
  { id: "buts", nom: "Buts", motif: /but/i, icone: Goal, teinte: "var(--th-jeu)" },
  { id: "soins", nom: "Soins", motif: /secours|soin|glace|pharmacie/i, icone: BriefcaseMedical, teinte: "var(--non)" },
  { id: "physique", nom: "Préparation", motif: /.*/, icone: Dumbbell, teinte: "var(--th-renforcement)" },
];
const familleDe = (nom: string) => FAMILLES.find((f) => f.motif.test(nom))!;

function Ligne({ m }: { m: Materiel }) {
  const { agir } = useClub();
  const [ouverte, setOuverte] = useState(false);
  const bons = m.quantite - m.aRemplacer;
  const f = familleDe(m.nom);
  const Icone = f.icone;
  return (
    <li className={cn(FICHE, "flex flex-col")} style={{ "--teinte": f.teinte } as React.CSSProperties}>
      <button type="button" aria-expanded={ouverte} onClick={() => setOuverte((o) => !o)} className="flex items-center gap-3 px-3.5 py-3 text-left">
        <span className="teinte grid size-11 shrink-0 place-items-center rounded-full">
          <Icone className="size-5" strokeWidth={2.2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-lecture font-semibold">{m.nom}</span>
          {m.aRemplacer > 0 && (
            <span className="w-fit rounded-full px-2 py-0.5 text-petit font-semibold" style={{ color: "var(--attente)", background: "color-mix(in srgb, var(--attente) 16%, transparent)" }}>
              {m.aRemplacer} à remplacer
            </span>
          )}
        </span>
        <span style={{ ...NOMBRE, fontSize: 30 }} className="text-[var(--teinte)] tabular-nums">
          {bons}
        </span>
      </button>
      {ouverte && (
        <div className="flex flex-col gap-3 border-t border-foreground/[0.08] px-4 pt-3 pb-4">
          <span className="flex items-center justify-between gap-3">
            <span className="mono-label text-encre-3">En tout</span>
            <Compteur nom={`Quantité de ${m.nom}`} valeur={m.quantite} max={999} onChange={(n) => agir((c, moi) => compterMateriel(c, moi, m.id, n, Math.min(m.aRemplacer, n)))} />
          </span>
          <span className="flex items-center justify-between gap-3">
            <span className="mono-label text-encre-3">À remplacer</span>
            <Compteur nom={`${m.nom} à remplacer`} valeur={m.aRemplacer} max={m.quantite} onChange={(n) => agir((c, moi) => compterMateriel(c, moi, m.id, m.quantite, n))} />
          </span>
        </div>
      )}
    </li>
  );
}

export function MaterielDuClub() {
  const { club, droits, agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [nom, setNom] = useState("");
  const [quantite, setQuantite] = useState(10);
  const staff = droits.administre || club.categories.some((c) => droits.gere(c.id));
  if (!staff) return <PageEnfant titre="Matériel">{null}</PageEnfant>;
  const aRemplacer = club.materiel.reduce((t, m) => t + m.aRemplacer, 0);
  const ajouter = () => {
    if (!agir((c, moi) => ajouterMateriel(c, moi, nom, quantite))) return;
    navigator.vibrate?.(10);
    toast.success("Ajouté");
    setNom("");
    setOuvert(false);
  };
  return (
    <PageEnfant titre="Matériel" sous={aRemplacer ? `${aRemplacer} à remplacer` : undefined}>
      <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire flex h-11 items-center justify-center gap-2 text-lecture font-semibold">
        <Plus className="size-4" strokeWidth={2.4} />
        Ajouter
      </button>
      <div className="grid grid-cols-3 gap-2">
        {FAMILLES.filter((f) => club.materiel.some((m) => familleDe(m.nom).id === f.id))
          .slice(0, 3)
          .map((f) => {
            const n = club.materiel.filter((m) => familleDe(m.nom).id === f.id).reduce((t, m) => t + m.quantite - m.aRemplacer, 0);
            return (
              <div key={f.id} className="flex flex-col gap-1 rounded-[20px] p-3.5" style={{ background: `color-mix(in srgb, ${f.teinte} 18%, transparent)` }}>
                <span style={{ ...NOMBRE, fontSize: 32, color: f.teinte }} className="tabular-nums">
                  {n}
                </span>
                <span className="text-corps font-semibold text-encre-2">{f.nom}</span>
              </div>
            );
          })}
      </div>
      <ul className="flex flex-col gap-2">
        {club.materiel.map((m) => (
          <Ligne key={m.id} m={m} />
        ))}
      </ul>
      <Feuille titre="Matériel" open={ouvert} onOpenChange={setOuvert}>
        <input aria-label="Nom" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={40} className={CHAMP} />
        <span className="flex items-center justify-between gap-3">
          <span className="mono-label text-encre-3">Quantité</span>
          <Compteur nom="Quantité" valeur={quantite} max={999} onChange={setQuantite} />
        </span>
        <button type="button" disabled={nom.trim().length < 2} onClick={ajouter} className="bouton-principal h-12 text-[15px] font-semibold">
          Ajouter
        </button>
      </Feuille>
    </PageEnfant>
  );
}
