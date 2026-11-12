"use client";

// L'effectif d'un club (Bola Club, bola-app#14 : « tous les joueurs en
// cartes, hiérarchie grande / moyenne / petite, filtre catégorie + poste,
// tri note / progression du mois / présences / buts »). Sous le rail des
// catégories : les puces de poste (Tous, Gardiens, Défenseurs, Milieux,
// Attaquants), le tri (Note, Progression, Présences, Buts ; dans l'adresse,
// ?tri=), le compte, puis les joueurs dans la hiérarchie de l'app (mini-
// carte.tsx) : le premier du tri en carte grande, les deux suivants en
// moyennes, les autres en lignes, carte petite et valeur du tri en Anton.
// Toucher un joueur : sa fiche pour celui qui le gère (son entraîneur,
// l'admin) et pour lui-même ou son parent ; sinon sa carte en grand.
// Rangee et Tete servent aussi aux classements (classements-club.tsx).

import Link from "next/link";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useClub } from "@/hooks/use-club";
import { LIGNES_POSTES, trierEffectif, type LigneClassee, type LignePoste, type TriEffectif } from "@/lib/sfl/club/classements";
import { categorieDe, estDeLaCategorie } from "@/lib/sfl/club/regles";
import { nomComplet, type Membre } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub, type FormatCarte } from "./carte-club";
import { LIGNE, NOMBRE, Puces, Segment } from "./puces";
import { useCategorieChoisie } from "./rail-categories";

const TRIS: { id: TriEffectif; label: string }[] = [
  { id: "note", label: "Note" },
  { id: "progression", label: "Progression" },
  { id: "presences", label: "Présences" },
  { id: "buts", label: "Buts" },
];

const TOUS = "tous";
const POSTES: { id: LignePoste | typeof TOUS; label: string }[] = [{ id: TOUS, label: "Tous" }, ...LIGNES_POSTES.map((l) => ({ id: l.id, label: l.label }))];

/** « U13 · MC » : la catégorie et le poste d'un joueur. */
export function useSousLigne() {
  const { club } = useClub();
  return (m: Membre) => `${categorieDe(club, m.categorie)?.nom ?? ""} · ${m.poste}`;
}

/** Un joueur qu'on touche : sa fiche si ce point de vue la voit, sinon sa carte en grand. */
function Joueur({ m, format, children, className }: { m: Membre; format: FormatCarte; children: React.ReactNode; className?: string }) {
  const { droits } = useClub();
  if (droits.voitFiche(m))
    return (
      <Link href={`/club/joueur/${m.id}`} className={cn("transition-transform active:scale-[0.98]", className)}>
        <CarteClub id={m.id} format={format} inerte />
        {children}
      </Link>
    );
  return (
    <div className={className}>
      <CarteClub id={m.id} format={format} />
      {children}
    </div>
  );
}

/** Les trois premiers : le premier en carte grande, au milieu ; les deux suivants en moyennes. */
export function Tete({ lignes, sansValeur = false }: { lignes: LigneClassee[]; sansValeur?: boolean }) {
  const [un, deux, trois] = lignes;
  if (!un) return null;
  const marche = (l: LigneClassee | undefined, format: FormatCarte) =>
    l ? (
      <Joueur key={l.membre.id} m={l.membre} format={format} className="flex min-w-0 flex-1 flex-col items-center gap-2">
        <span className="flex max-w-full flex-col items-center gap-0.5">
          <span className="max-w-full truncate text-corps font-semibold">{nomComplet(l.membre)}</span>
          {!sansValeur && (
            <span style={{ ...NOMBRE, fontSize: format === "grande" ? 30 : 22 }} className="tabular-nums">
              {l.libelle}
            </span>
          )}
        </span>
      </Joueur>
    ) : (
      <span key={format} className="flex-1" />
    );
  return (
    <div className="flex items-end justify-center gap-3 px-5">
      {marche(deux, "moyenne")}
      {marche(un, "grande")}
      {marche(trois, "moyenne")}
    </div>
  );
}

/** Une ligne : le rang (un classement), la carte petite, le nom, la catégorie et le poste, la valeur en Anton. */
export function Rangee({ l, rang }: { l: LigneClassee; rang?: boolean }) {
  const sous = useSousLigne();
  return (
    <Joueur m={l.membre} format="petite" className={LIGNE}>
      {rang && (
        <span style={{ ...NOMBRE, fontSize: 20 }} className="order-first w-7 shrink-0 text-center text-foreground/40 tabular-nums">
          {l.rang}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-lecture font-semibold">{nomComplet(l.membre)}</span>
        <span className="mono-label text-encre-3">{sous(l.membre)}</span>
      </span>
      <span style={{ ...NOMBRE, fontSize: 24 }} className="shrink-0 pr-1 text-right tabular-nums">
        {l.libelle}
      </span>
    </Joueur>
  );
}

export function Effectif() {
  const { club, droits } = useClub();
  const [categorie] = useCategorieChoisie();
  const params = useSearchParams();
  const pathname = usePathname();
  const [poste, setPoste] = useState<LignePoste | typeof TOUS>(TOUS);
  const brut = params.get("tri");
  const tri: TriEffectif = TRIS.some((t) => t.id === brut) ? (brut as TriEffectif) : "note";
  const trier = (t: TriEffectif) => {
    const p = new URLSearchParams(params.toString());
    if (t === "note") p.delete("tri");
    else p.set("tri", t);
    const q = p.toString();
    window.history.replaceState(null, "", q ? `${pathname}?${q}` : pathname);
  };
  const postes = poste === TOUS ? null : LIGNES_POSTES.find((l) => l.id === poste)!.postes;
  const membres = club.membres.filter(
    (m) =>
      (categorie ? estDeLaCategorie(m, categorie) : droits.lit(m.categorie) || (m.surclasseEn !== null && droits.lit(m.surclasseEn))) &&
      (!postes || (postes as readonly string[]).includes(m.poste)),
  );
  const lignes = trierEffectif(club, membres, tri);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <Puces nom="Poste" choix={POSTES} actif={poste} onChange={setPoste} />
        <Segment nom="Tri" choix={TRIS} actif={tri} onChange={trier} className="mx-5" />
      </div>
      <span className="mono-label px-5 text-encre-3">{`${lignes.length} ${lignes.length > 1 ? "joueurs" : "joueur"}`}</span>
      {/* Triée par note, la carte la dit déjà. */}
      <Tete lignes={lignes.slice(0, 3)} sansValeur={tri === "note"} />
      <div className="flex flex-col gap-2 px-5">
        {lignes.slice(3).map((l) => (
          <Rangee key={l.membre.id} l={l} />
        ))}
      </div>
    </div>
  );
}
