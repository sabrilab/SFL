"use client";

// L'admin d'un club (Bola Club, bola-app#14 : « licences x / total,
// invitations, staff, palier d'abonnement affiché »), pour le président ou
// le secrétaire. Une page enfant du club :
//   · Licences : celles qui sont prises sur le total, en Anton, une jauge,
//     et le détail (actives, invitations, accord parental en attente,
//     libres) ;
//   · Inviter : « Copier le lien », « Importer une liste » (une ligne par
//     licencié : « Prénom Nom, 12/03/2014, U13 ») ; rien n'est envoyé, une
//     invitation n'est ici qu'une ligne de la démonstration ;
//   · Staff : les entraîneurs et leurs catégories ; « Ajouter » mène au
//     rangement des catégories ;
//   · Écusson : celui du club, ses couleurs ne vivent que là ; « Modifier »
//     ouvre l'éditeur des écussons de Bola Team (equipe/editeur-blason.tsx) ;
//   · Abonnement : le palier du club et les autres, à titre indicatif.
//     Aucun bouton : rien ne se paie dans l'app.
// Noir et blanc, clair comme sombre.

import Link from "next/link";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { EditeurBlason } from "@/components/sfl/equipe/editeur-blason";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { useClub } from "@/hooks/use-club";
import { fondDe, memeBlason, type Blason } from "@/lib/sfl/blason";
import { changerBlason, importerListe } from "@/lib/sfl/club/mutations";
import { compteLicences } from "@/lib/sfl/club/regles";
import { LICENCE_EN_PLUS, PALIERS, nomComplet, type Palier } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CHAMP, Feuille, FICHE, NOMBRE, PageEnfant, TitreSection } from "./puces";

const euros = (n: number) => `${n.toLocaleString("fr-FR").replace(/ | /g, " ")} €`;

function Licences() {
  const { club } = useClub();
  const n = compteLicences(club);
  const prises = n.total - n.libres;
  const lignes: [string, number][] = [
    ["Actives", n.actives],
    ["Invitations", n.invitations],
    ["Accord parental", n.accords],
    ["Libres", n.libres],
  ];
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Licences</TitreSection>
      <div className={cn(FICHE, "flex flex-col gap-4 p-4")}>
        <span style={{ ...NOMBRE, fontSize: 64 }} className="tabular-nums" aria-label={`${n.actives} licences actives sur ${n.total}`}>
          {n.actives}
          <span className="text-foreground/30"> / {n.total}</span>
        </span>
        <span className="flex h-2 overflow-hidden rounded-full bg-foreground/12" aria-hidden>
          <span className="h-full bg-foreground" style={{ width: `${(n.actives / n.total) * 100}%` }} />
          <span className="h-full bg-foreground/40" style={{ width: `${((prises - n.actives) / n.total) * 100}%` }} />
        </span>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5">
          {lignes.map(([nom, v]) => (
            <div key={nom} className="flex items-baseline justify-between gap-3">
              <dt className="mono-label text-encre-3">{nom}</dt>
              <dd style={{ ...NOMBRE, fontSize: 22 }} className="tabular-nums">
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

function Inviter() {
  const { agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [liste, setListe] = useState("");
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/club`);
      toast.success("Lien copié");
    } catch {
      toast.error("Le lien n'a pas pu être copié.");
    }
  };
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Inviter</TitreSection>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={copier} className="bouton-secondaire h-12 text-lecture font-semibold">
          Copier le lien
        </button>
        <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire h-12 text-lecture font-semibold">
          Importer une liste
        </button>
      </div>
      <Feuille titre="Importer une liste" open={ouvert} onOpenChange={setOuvert}>
        <textarea
          aria-label="Liste"
          placeholder="Prénom Nom, 12/03/2014, U13"
          value={liste}
          onChange={(e) => setListe(e.target.value)}
          rows={6}
          className={cn(CHAMP, "resize-none")}
        />
        <button
          type="button"
          disabled={!liste.trim()}
          onClick={() => {
            if (!agir((c, moi) => importerListe(c, moi, liste))) return;
            toast.success("Importé");
            setListe("");
            setOuvert(false);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Importer
        </button>
      </Feuille>
    </section>
  );
}

function Staff() {
  const { club } = useClub();
  return (
    <section className="flex flex-col gap-3">
      <TitreSection
        droite={
          <Link href="/club/categories" className="bouton-secondaire relative px-3.5 py-2 text-corps font-semibold after:absolute after:inset-x-0 after:-inset-y-1 after:content-['']">
            Ajouter
          </Link>
        }
      >
        Staff
      </TitreSection>
      <ul className={cn(FICHE, "flex flex-col px-4")}>
        {club.staff
          .filter((s) => s.role === "entraineur")
          .map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border-b border-foreground/[0.08] py-3 last:border-0">
              <span className="min-w-0 truncate text-lecture font-semibold">{nomComplet(s)}</span>
              <span className="mono-label shrink-0 text-encre-3">
                {club.categories
                  .filter((c) => c.entraineurs.includes(s.id))
                  .sort((a, b) => a.ordre - b.ordre)
                  .map((c) => c.nom)
                  .join(" · ") || "—"}
              </span>
            </li>
          ))}
      </ul>
    </section>
  );
}

function EcussonDuClub() {
  const { club, agir } = useClub();
  const [ouvert, setOuvert] = useState(false);
  const [brouillon, setBrouillon] = useState<Blason | null>(null);
  const b = brouillon ?? club.blason;
  const fermer = (o: boolean) => {
    if (!o) setBrouillon(null);
    setOuvert(o);
  };
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Écusson</TitreSection>
      <div className={cn(FICHE, "flex items-center justify-between gap-4 p-4")}>
        <Ecusson initiales={club.initiales} fond={fondDe(club.blason)} blason={club.blason} taille={96} />
        <button type="button" onClick={() => setOuvert(true)} className="bouton-secondaire px-5 py-3 text-lecture font-semibold">
          Modifier
        </button>
      </div>
      <Feuille titre="Écusson" open={ouvert} onOpenChange={fermer}>
        <div className="flex justify-center py-1">
          <Ecusson initiales={club.initiales} fond={fondDe(b)} blason={b} taille={108} />
        </div>
        <EditeurBlason valeur={b} onChange={setBrouillon} initiales={club.initiales} fond={fondDe(b)} apercu={false} />
        <button
          type="button"
          disabled={memeBlason(b, club.blason)}
          onClick={() => {
            if (!agir((c, moi) => changerBlason(c, moi, b))) return;
            navigator.vibrate?.([10, 40, 18]);
            toast.success("Enregistré");
            fermer(false);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Enregistrer
        </button>
      </Feuille>
    </section>
  );
}

function Abonnement() {
  const { club } = useClub();
  const mien = PALIERS[club.palier];
  const autres = (Object.keys(PALIERS) as Palier[]).filter((p) => p !== club.palier);
  const mensuels = (Object.keys(PALIERS) as Palier[]).map((p) => PALIERS[p].mois).join(" / ");
  return (
    <section className="flex flex-col gap-3">
      <TitreSection>Abonnement</TitreSection>
      <div className={cn(FICHE, "flex flex-col gap-4 p-4")}>
        <div className="flex items-end justify-between gap-3">
          <span className="titre-lettrage text-[26px] leading-none">{mien.nom}</span>
          <span className="text-lecture font-semibold">{euros(mien.an)} HT / an</span>
        </div>
        <ul className="flex flex-col border-t border-foreground/[0.08] pt-1">
          {[
            ...autres.map((p) => [PALIERS[p].nom, euros(PALIERS[p].an)] as const),
            ["Licence en plus", `${euros(LICENCE_EN_PLUS)} / an`] as const,
            ["Mensuel", `${mensuels} €`] as const,
          ].map(([nom, prix]) => (
            <li key={nom} className="flex items-baseline justify-between gap-3 py-2">
              <span className="mono-label text-encre-3">{nom}</span>
              <span className="text-corps font-semibold text-encre-2 tabular-nums">{prix}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AdminClub() {
  const { club, droits } = useClub();
  if (!droits.administre) return <PageEnfant titre={club.nom}>{null}</PageEnfant>;
  return (
    <PageEnfant titre={club.nom}>
      <Licences />
      <Inviter />
      <Staff />
      <EcussonDuClub />
      <Abonnement />
      <Link href="/club/categories" className="bouton-secondaire flex h-12 items-center justify-between px-5 text-[15px] font-semibold">
        Catégories
        <ChevronRight className="size-5 opacity-50" strokeWidth={2.2} />
      </Link>
    </PageEnfant>
  );
}
