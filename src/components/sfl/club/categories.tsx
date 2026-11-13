"use client";

// Les catégories d'un club (Bola Club, bola-app#14 : « créer, renommer,
// ranger joueurs et entraîneurs, déplacer un joueur »). Une fiche par
// catégorie : son nom, son compte de joueurs, ses entraîneurs ; la toucher
// la déplie sur ses joueurs, en lignes (carte petite, nom, poste), chacun
// avec « Déplacer ». L'admin crée et renomme une catégorie, et y range les
// entraîneurs ; l'entraîneur n'y voit que ses catégories et y déplace ses
// joueurs (lib/sfl/club/regles.ts, droits). Rien ne part en base : l'état de
// la démonstration vit sur le téléphone.

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useClub } from "@/hooks/use-club";
import { creerCategorie, deplacerJoueur, rangerEntraineur, renommerCategorie } from "@/lib/sfl/club/mutations";
import { aLAgeDe } from "@/lib/sfl/club/regles";
import { nomComplet, type Categorie, type Membre } from "@/lib/sfl/club/types";
import { cn } from "@/lib/utils";
import { CarteClub } from "./carte-club";
import { CHAMP, CIBLE, Feuille, FICHE, PageEnfant } from "./puces";

const BOUTON_LIGNE = cn(CIBLE, "bouton-secondaire shrink-0 px-3.5 py-2 text-corps font-semibold");

function FicheCategorie({ c, onDeplacer, onRenommer, onStaff }: { c: Categorie; onDeplacer: (m: Membre) => void; onRenommer: () => void; onStaff: () => void }) {
  const { club, droits } = useClub();
  const [ouverte, setOuverte] = useState(false);
  // Les licenciés de la catégorie : un joueur dont la licence est rendue n'y est plus.
  const joueurs = club.membres.filter((m) => m.categorie === c.id && droits.voitJoueur(m));
  const staff = club.staff.filter((s) => c.entraineurs.includes(s.id));
  const autres = club.categories.some((x) => x.id !== c.id && droits.gere(x.id));
  return (
    <section className={cn(FICHE, "flex flex-col")}>
      <button type="button" aria-expanded={ouverte} onClick={() => setOuverte((o) => !o)} className="flex items-center gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="titre-lettrage text-[22px] leading-none">{c.nom}</span>
          <span className="mono-label text-encre-3">
            {[`${joueurs.length} ${joueurs.length > 1 ? "joueurs" : "joueur"}`, ...staff.map(nomComplet)].join(" · ")}
          </span>
        </span>
        <ChevronDown className={cn("size-5 shrink-0 opacity-50 transition-transform", ouverte && "rotate-180")} />
      </button>
      {ouverte && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          {droits.administre && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={onRenommer} className={BOUTON_LIGNE}>
                Renommer
              </button>
              <button type="button" onClick={onStaff} className={BOUTON_LIGNE}>
                Ajouter un entraîneur
              </button>
            </div>
          )}
          <ul className="flex flex-col">
            {joueurs.map((m) => (
              <li key={m.id} className="flex items-center gap-3 border-t border-foreground/[0.08] py-2">
                <CarteClub id={m.id} format="petite" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-lecture font-semibold">{nomComplet(m)}</span>
                  <span className="mono-label text-encre-3">{m.poste}</span>
                </span>
                {autres && (
                  <button type="button" onClick={() => onDeplacer(m)} aria-label={`Déplacer ${nomComplet(m)}`} className={BOUTON_LIGNE}>
                    Déplacer
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function Categories() {
  const { club, droits, agir } = useClub();
  const [deplace, setDeplace] = useState<Membre | null>(null);
  const [renommee, setRenommee] = useState<Categorie | null>(null);
  const [staffDe, setStaffDe] = useState<Categorie | null>(null);
  const [nouvelle, setNouvelle] = useState(false);
  const [nom, setNom] = useState("");
  const miennes = club.categories.filter((c) => droits.gere(c.id)).sort((a, b) => a.ordre - b.ordre);
  // La catégorie dont on range le staff, telle qu'elle est maintenant.
  const rangee = staffDe ? (club.categories.find((c) => c.id === staffDe.id) ?? null) : null;
  return (
    <PageEnfant titre="Catégories">
      <div className="flex flex-col gap-3">
        {miennes.map((c) => (
          <FicheCategorie
            key={c.id}
            c={c}
            onDeplacer={setDeplace}
            onRenommer={() => {
              setNom(c.nom);
              setRenommee(c);
            }}
            onStaff={() => setStaffDe(c)}
          />
        ))}
      </div>
      {droits.administre && (
        <button
          type="button"
          onClick={() => {
            setNom("");
            setNouvelle(true);
          }}
          className="bouton-secondaire h-12 text-[15px] font-semibold"
        >
          Nouvelle catégorie
        </button>
      )}

      <Feuille titre="Déplacer" open={!!deplace} onOpenChange={(o) => !o && setDeplace(null)}>
        {deplace && (
          <>
            <span className="text-lecture font-semibold">{nomComplet(deplace)}</span>
            <div className="flex flex-col gap-2">
              {miennes
                .filter((c) => c.id !== deplace.categorie && aLAgeDe(deplace, c, club.jour))
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      if (agir((k, moi) => deplacerJoueur(k, moi, deplace.id, c.id))) {
                        navigator.vibrate?.(10);
                        setDeplace(null);
                      }
                    }}
                    className="bouton-secondaire flex h-12 items-center justify-between px-5 text-[15px] font-semibold"
                  >
                    {c.nom}
                    <span className="mono-label text-encre-3">{`${club.membres.filter((x) => x.categorie === c.id && droits.voitJoueur(x)).length} joueurs`}</span>
                  </button>
                ))}
            </div>
          </>
        )}
      </Feuille>

      <Feuille titre="Renommer" open={!!renommee} onOpenChange={(o) => !o && setRenommee(null)}>
        <input aria-label="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={20} className={CHAMP} />
        <button
          type="button"
          disabled={!nom.trim()}
          onClick={() => {
            if (renommee && agir((k, moi) => renommerCategorie(k, moi, renommee.id, nom))) setRenommee(null);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Enregistrer
        </button>
      </Feuille>

      <Feuille titre="Nouvelle catégorie" open={nouvelle} onOpenChange={setNouvelle}>
        <input aria-label="Nom" placeholder="Nom" value={nom} onChange={(e) => setNom(e.target.value)} maxLength={20} className={CHAMP} />
        <button
          type="button"
          disabled={!nom.trim()}
          onClick={() => {
            if (agir((k, moi) => creerCategorie(k, moi, nom))) setNouvelle(false);
          }}
          className="bouton-principal h-12 text-[15px] font-semibold"
        >
          Créer
        </button>
      </Feuille>

      <Feuille titre={rangee ? `Entraîneurs · ${rangee.nom}` : "Entraîneurs"} open={!!rangee} onOpenChange={(o) => !o && setStaffDe(null)}>
        {rangee && (
          <div className="flex flex-col gap-2">
            {club.staff
              .filter((s) => s.role === "entraineur")
              .map((s) => {
                const dedans = rangee.entraineurs.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    role="switch"
                    aria-checked={dedans}
                    onClick={() => agir((k, moi) => rangerEntraineur(k, moi, s.id, rangee.id, !dedans))}
                    className={cn("flex h-12 items-center justify-between px-5 text-[15px] font-semibold", dedans ? "bouton-principal" : "bouton-secondaire")}
                  >
                    {nomComplet(s)}
                  </button>
                );
              })}
          </div>
        )}
      </Feuille>
    </PageEnfant>
  );
}
