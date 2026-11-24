"use client";

// La fiche d'un joueur dans l'onglet Joueurs de l'admin (24/11/2026) : ce qui
// était éparpillé entre Les accès, l'Effectif et le tableau complet, au
// toucher de sa ligne. Sa carte, son identifiant, son mot de passe (choisi,
// à choisir, pas de compte), Joue ou Ne joue pas, et le tableau complet pour
// le reste (poste fin, profil, stats).
//
// Un mot de passe provisoire ferme ses sessions (/api/comptes/reinitialiser) :
// il passe par une confirmation. Il ne s'affiche qu'ici, une fois.

import { useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Feuille } from "@/components/sfl/admin/journee/ui";
import { Confirmer, type Confirmation } from "@/components/sfl/admin/confirmer";
import { supabase } from "@/lib/supabase";
import { neJouePas } from "@/lib/sfl/hidden";
import { poserJoue } from "@/lib/sfl/non-joueurs";
import { famillePoste, libelleVu, texteDAcces } from "@/lib/sfl/admin-joueurs";
import { haptique } from "@/lib/sfl/haptique";
import { cn } from "@/lib/utils";
import { Ligne, Liste, SegmenteClair, SURFACE, Tete } from "../ui-admin";
import { appelAdmin, type Compte } from "./donnees";

export function FicheJoueur({
  nom,
  affiche,
  poste,
  compte,
  vu,
  onOpenChange,
  onChange,
}: {
  /** Le joueur ouvert ; null ferme la feuille. */
  nom: string | null;
  /** Son nom affiché (identités) ; à défaut, le nom de saison. */
  affiche?: string;
  poste?: string;
  compte?: Compte;
  vu?: string;
  onOpenChange: (o: boolean) => void;
  /** Son compte ou son « Joue » a changé : relire. */
  onChange: () => void;
}) {
  const [provisoire, setProvisoire] = useState<{ nom: string; user: string; password: string } | null>(null);
  const [copie, setCopie] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [, setRev] = useState(0);
  // La feuille garde son dernier joueur le temps de se refermer.
  const [dernier, setDernier] = useState<string | null>(nom);
  if (nom && nom !== dernier) {
    setDernier(nom);
    setProvisoire(null);
    setCopie(false);
    setErreur(null);
  }
  const n = nom ?? dernier;
  if (!n) return null;
  const montre = provisoire?.nom === n ? provisoire : null;

  async function donner(route: "/api/comptes/creer" | "/api/comptes/reinitialiser") {
    if (!n) return;
    setOccupe(true);
    setErreur(null);
    try {
      const { json } = await appelAdmin(route, { name: n });
      if (typeof json.error === "string") {
        haptique.refus();
        setErreur(json.error);
      } else if (typeof json.password === "string") {
        haptique.sceau();
        setProvisoire({ nom: n, user: String(json.user ?? compte?.user ?? ""), password: json.password });
        setCopie(false);
      }
      onChange();
    } catch {
      setErreur("Serveur injoignable.");
    }
    setOccupe(false);
  }

  async function regler(joue: boolean) {
    if (!n) return;
    const { data } = await supabase().from("profiles").select("id").eq("name", n).maybeSingle();
    const id = (data as { id?: string } | null)?.id;
    if (!id) {
      haptique.refus();
      toast(`${n} n'a pas de compte.`);
      return;
    }
    const fait = await poserJoue(id, joue);
    if (!fait.ok) {
      haptique.refus();
      toast(fait.raison ?? "Refusé");
      return;
    }
    haptique.sceau();
    setRev((x) => x + 1);
    onChange();
  }

  function copier() {
    if (!montre) return;
    void navigator.clipboard?.writeText(texteDAcces(montre.nom, montre.user, montre.password)).then(
      () => {
        haptique.sceau();
        setCopie(true);
      },
      () => {}
    );
  }

  const motDePasse = compte?.sansCompte ? "pas de compte" : compte?.aChanger ? "à choisir" : compte ? "choisi" : "…";
  const famille = famillePoste(poste);

  return (
    <>
      <Feuille
        open={!!nom}
        onOpenChange={onOpenChange}
        titre={affiche ?? n}
        bas={
          montre ? (
            <button type="button" onClick={copier} className="bouton-principal flex h-12 items-center justify-center gap-2 text-lecture font-semibold">
              {copie ? <Check className="size-4" strokeWidth={2} /> : <Copy className="size-4" strokeWidth={2} />}
              {copie ? "Copié" : "Copier pour l'envoyer"}
            </button>
          ) : compte?.sansCompte ? (
            <button
              type="button"
              disabled={occupe}
              onClick={() => void donner("/api/comptes/creer")}
              className="bouton-principal flex h-12 items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-60"
            >
              {occupe && <Loader2 className="size-4 animate-spin" />}
              Créer son compte
            </button>
          ) : compte ? (
            <button
              type="button"
              disabled={occupe}
              onClick={() =>
                setConfirmation({
                  titre: `Mot de passe provisoire pour ${n} ?`,
                  detail: "Ses sessions se ferment.",
                  action: "Donner",
                  faire: () => void donner("/api/comptes/reinitialiser"),
                })
              }
              className="bouton-secondaire flex h-12 items-center justify-center gap-2 text-lecture font-semibold disabled:opacity-60"
            >
              {occupe && <Loader2 className="size-4 animate-spin" />}
              Mot de passe provisoire
            </button>
          ) : undefined
        }
      >
        <div className="flex flex-col items-center gap-2 pt-1">
          <Tete nom={n} cote={78} />
          <span className="text-corps text-encre-3">{[famille, vu ? libelleVu(new Date(vu), new Date()) : null].filter(Boolean).join(" · ")}</span>
        </div>
        <div className={cn(SURFACE, "divide-y divide-border/60 overflow-hidden")}>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4">
            <span className="text-lecture text-encre-3">Identifiant</span>
            <span className="font-mono text-lecture">{montre?.user ?? compte?.user ?? "…"}</span>
          </div>
          <div className="flex min-h-12 items-center justify-between gap-3 px-4">
            <span className="text-lecture text-encre-3">{montre ? "Mot de passe provisoire" : "Mot de passe"}</span>
            <span className={cn("text-lecture", montre ? "font-mono" : compte?.sansCompte || compte?.aChanger ? "font-medium" : "text-encre-2")}>
              {montre?.password ?? motDePasse}
            </span>
          </div>
        </div>
        {!compte?.sansCompte && (
          <SegmenteClair
            label="Joue"
            options={[
              { id: "joue", libelle: "Joue" },
              { id: "non", libelle: "Ne joue pas" },
            ]}
            valeur={neJouePas(n) ? "non" : "joue"}
            onChange={(v) => void regler(v === "joue")}
          />
        )}
        <Liste>
          <Ligne titre="Fiche complète" href="/admin/tableau?onglet=joueurs" />
        </Liste>
        {erreur && <p className="px-1 text-corps font-medium text-foreground">{erreur}</p>}
      </Feuille>
      <Confirmer confirmation={confirmation} onFermer={() => setConfirmation(null)} />
    </>
  );
}
