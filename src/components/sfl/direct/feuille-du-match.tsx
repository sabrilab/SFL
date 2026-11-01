"use client";

// La feuille de match en direct, au bord du terrain (Sabri, 01/11/2026 :
// « on a tous la possibilité d'ouvrir la feuille de match en direct et de la
// remplir […] à partir du moment où il y en a un qui a pris les stats, on
// prend avec son téléphone »). Lib : lib/sfl/feuille-direct.ts ; base :
// public.feuilles_direct (supabase/schema.sql).
//
// En haut, le tableau d'affichage (● NOIRS 3 – 1 BLANCS ○) et la minute de
// jeu, depuis la prise de la feuille ; dessous, qui la tient. Puis les deux
// camps côte à côte, chaque joueur avec sa carte, ses buts et ses passes.
//   · Celui qui tient la feuille touche un joueur : BUT, PASSE, ARRÊT,
//     INTERC., CONTRE SON CAMP, au pouce, avec un − pour corriger. Un but
//     enchaîne sur sa passe (un coéquipier, ou « Sans passe ») : un seul
//     geste, que ↶ défait d'un coup. En bas, sous le pouce, le dernier geste
//     et « Fin du match · 3 – 1 », un glissé scellé comme « Je viens » : la
//     feuille se scelle, le résultat et les chiffres entrent dans la saison.
//     Il peut passer la main à un joueur du match.
//   · Les autres (le reste du match, toute la ligue) la suivent en lecture,
//     en temps réel.
//   · L'admin (la page Journée) la reprend, la libère, ou la rouvre une fois
//     scellée ; il la tient alors comme un joueur.
// Noir et blanc, sans phrase d'aide ; haptiques sur chaque geste ; avec
// « Réduire les animations », rien ne bouge.

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PastilleMaillot } from "@/components/sfl/point-maillot";
import { ReponseScellee } from "@/components/sfl/reponse-scellee";
import { Feuille } from "@/components/sfl/admin/journee/ui";
import type { FeuillesDirect, GesteAdmin } from "@/hooks/use-feuilles-direct";
import {
  annulation,
  compte,
  etatDeLaFeuille,
  joueursDuMatch,
  libelleEntree,
  minuteDe,
  MOTS_DU_REFUS,
  pileDuJournal,
  scoreDeLaFeuille,
  type Compteur,
  type Equipes,
  type FeuilleDirect,
  type Geste,
} from "@/lib/sfl/feuille-direct";
import { haptique } from "@/lib/sfl/haptique";
import type { Saison } from "@/lib/sfl/saisie/types";
import { cn } from "@/lib/utils";

const prenom = (n: string) => n.split(" ")[0];

/** La minute de jeu, qui avance seule (au quart de minute). */
function useMinute(debut: string | null, fin: string | null): number | null {
  const [maintenant, setMaintenant] = useState<number | null>(null);
  useEffect(() => {
    if (!debut || fin) return;
    const tic = () => setMaintenant(Date.now());
    Promise.resolve().then(tic);
    const id = window.setInterval(tic, 15_000);
    return () => window.clearInterval(id);
  }, [debut, fin]);
  if (!debut) return null;
  if (fin) return minuteDe(debut, fin);
  return maintenant == null ? null : minuteDe(debut, new Date(maintenant));
}

/** ◉ EN DIRECT · 23′ ; ✓ FIN · 52′. */
export function PastilleDirect({ feuille, className }: { feuille: FeuilleDirect; className?: string }) {
  const minute = useMinute(feuille.debut, feuille.fin);
  return (
    <span className={cn("mono-label inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-background", className)}>
      <span aria-hidden>{feuille.fin ? "✓" : "◉"}</span>
      {feuille.fin ? "Fin" : "En direct"}
      {minute != null && <span className="opacity-70">· {minute}′</span>}
    </span>
  );
}

/** Le tableau d'affichage : ● NOIRS 3 – 1 BLANCS ○. */
export function TableauDAffichage({ score, grand = true }: { score: [number, number]; grand?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-3">
      <PastilleMaillot camp="Noirs" />
      <span className={cn("font-display leading-none tabular-nums", grand ? "text-affiche" : "text-titre-g")} aria-label={`${score[0]} à ${score[1]}`}>
        {score[0]} – {score[1]}
      </span>
      <PastilleMaillot camp="Blancs" />
    </div>
  );
}

const LIGNES: { quoi: Compteur; libelle: string }[] = [
  { quoi: "buts", libelle: "But" },
  { quoi: "passes", libelle: "Passe" },
  { quoi: "arrets", libelle: "Arrêt" },
  { quoi: "interceptions", libelle: "Interc." },
  { quoi: "csc", libelle: "Contre son camp" },
];

export type ModeFeuille = "auto" | "admin";

export function FeuilleDuMatch({
  open,
  onOpenChange,
  saison,
  j,
  equipes,
  label,
  direct,
  mode = "auto",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** La saison lue (les joueurs du match, ses buts d'équipe) : jamais écrite ici. */
  saison: Saison;
  j: number;
  equipes: Equipes;
  /** « Match 1 ». */
  label: string;
  direct: FeuillesDirect;
  /** « admin » : la page Journée (reprendre, libérer, rouvrir). */
  mode?: ModeFeuille;
}) {
  const feuille = direct.feuilleDe(equipes);
  const etat = etatDeLaFeuille(feuille, direct.monId);
  const tenir = etat === "mienne";
  const { noirs, blancs } = useMemo(() => joueursDuMatch(saison, j, equipes), [saison, j, equipes]);
  const c = useMemo(() => feuille?.compteurs ?? {}, [feuille]);
  const score = useMemo(() => scoreDeLaFeuille(saison, j, equipes, c), [saison, j, equipes, c]);
  const pile = useMemo(() => pileDuJournal(feuille?.journal ?? []), [feuille]);
  const dernier = pile[pile.length - 1];

  const [joueur, setJoueur] = useState<{ nom: string; camp: "noirs" | "blancs" } | null>(null);
  const [passeDe, setPasseDe] = useState<{ nom: string; camp: "noirs" | "blancs" } | null>(null);
  const [passer, setPasser] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  async function geste(gestes: Geste[]) {
    if (!tenir) return;
    if (gestes.every((g) => g.d === 1)) haptique.ajout();
    else haptique.retrait();
    const r = await direct.compter(equipes, gestes);
    if (!r.ok) {
      haptique.refus();
      toast.error(MOTS_DU_REFUS[r.refus]);
    }
  }

  async function adminGeste(g: GesteAdmin) {
    setEnvoi(true);
    const r = await direct.admin(equipes, g);
    setEnvoi(false);
    if (r.ok) haptique.sceau();
    else toast.error(MOTS_DU_REFUS[r.refus]);
  }

  const camps: { cle: "noirs" | "blancs"; camp: "Noirs" | "Blancs"; noms: string[] }[] = [
    { cle: "noirs", camp: "Noirs", noms: noirs },
    { cle: "blancs", camp: "Blancs", noms: blancs },
  ];
  const coequipiers = passeDe ? (passeDe.camp === "noirs" ? noirs : blancs).filter((n) => n !== passeDe.nom) : [];

  const prendre = (
    <button type="button" disabled={envoi} onClick={() => void adminGeste("reprendre")} className="bouton-principal h-12 text-lecture font-semibold">
      Prendre la feuille
    </button>
  );
  // Sous le pouce : le dernier geste et « Fin du match » pour qui tient la
  // feuille ; le sceau posé une fois scellée ; les gestes de l'admin.
  const bas =
    !feuille || etat === "libre" ? (
      mode === "admin" ? prendre : undefined
    ) : etat === "tenue" ? (
      mode === "admin" ? (
        <div className="flex gap-2">
          <button type="button" disabled={envoi} onClick={() => void adminGeste("reprendre")} className="bouton-principal h-12 flex-1 text-lecture font-semibold">
            Reprendre
          </button>
          <button type="button" disabled={envoi} onClick={() => void adminGeste("liberer")} className="bouton-secondaire h-12 flex-1 text-lecture font-semibold">
            Libérer
          </button>
        </div>
      ) : undefined
    ) : (
      <>
        {tenir && dernier && (
          <div className="flex items-center gap-2">
            <span className="mono-label min-w-0 flex-1 truncate text-encre-2">
              {minuteDe(feuille.debut, dernier.le)}′ · {libelleEntree(dernier)}
            </span>
            <button
              type="button"
              onClick={() => void geste(annulation(dernier))}
              aria-label="Défaire le dernier geste"
              className="bouton-secondaire grid size-11 shrink-0 place-items-center"
            >
              <Undo2 className="size-4" />
            </button>
          </div>
        )}
        <ReponseScellee
          mine={etat === "scellee" ? "present" : null}
          seul={{ r: "present", libelle: `Fin du match · ${score[0]} – ${score[1]}` }}
          scelles={{ present: `Fin · ${score[0]} – ${score[1]}` }}
          tonSeul="blanc"
          onRepondre={async () => {
            const r = await direct.sceller(equipes);
            if (!r.ok) {
              haptique.refus();
              toast.error(MOTS_DU_REFUS[r.refus]);
              return "dite";
            }
            haptique.sceau();
            return "ok";
          }}
        />
        {mode === "admin" && etat === "scellee" && (
          <button type="button" disabled={envoi} onClick={() => void adminGeste("rouvrir")} className="bouton-discret h-11 text-ligne font-semibold">
            Rouvrir la feuille
          </button>
        )}
      </>
    );

  return (
    <Feuille
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setJoueur(null);
          setPasseDe(null);
        }
        onOpenChange(o);
      }}
      titre={label}
      etat={feuille ? <PastilleDirect feuille={feuille} /> : null}
      haute
      bas={bas}
    >
      <TableauDAffichage score={score} />

      <div className="flex items-center justify-between gap-2">
        <span className="mono-label truncate text-encre-3">
          {feuille?.preneur_nom ? `Feuille · ${feuille.preneur_nom}` : feuille ? "Feuille · libre" : "Feuille · personne"}
        </span>
        {tenir && (
          <button type="button" onClick={() => setPasser(true)} className="bouton-discret mono-label h-9 shrink-0 px-3">
            Passer la main
          </button>
        )}
        {mode === "admin" && tenir && (
          <button type="button" disabled={envoi} onClick={() => void adminGeste("liberer")} className="bouton-discret mono-label h-9 shrink-0 px-3">
            Libérer
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {camps.map(({ cle, camp, noms }) => (
          <section key={cle} className="flex min-w-0 flex-col gap-1.5" aria-label={camp}>
            <PastilleMaillot camp={camp} className="self-start" />
            {noms.map((nom) => {
              const b = compte(c, nom, "buts");
              const p = compte(c, nom, "passes");
              const def = [
                compte(c, nom, "arrets") ? `ARR ${compte(c, nom, "arrets")}` : null,
                compte(c, nom, "interceptions") ? `INT ${compte(c, nom, "interceptions")}` : null,
                compte(c, nom, "csc") ? `CSC ${compte(c, nom, "csc")}` : null,
              ].filter(Boolean);
              return (
                <button
                  key={nom}
                  type="button"
                  disabled={!tenir}
                  onClick={() => {
                    haptique.choix();
                    setJoueur({ nom, camp: cle });
                  }}
                  className={cn(
                    "flex min-h-[60px] min-w-0 items-center gap-2 rounded-[18px] bg-card px-2 py-1.5 text-left",
                    tenir && "transition-transform active:scale-[0.97]"
                  )}
                >
                  <CarteDe name={nom} size={FORMAT_CARTE.petite * 0.82} inerte />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-corps font-semibold">{prenom(nom)}</span>
                    <span className="mono-label text-encre-2 tabular-nums">
                      {b} · {p}
                    </span>
                    {def.length > 0 && <span className="mono-label truncate text-micro text-encre-3">{def.join(" · ")}</span>}
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      {!tenir && dernier && feuille && (
        <p className="mono-label truncate text-center text-encre-3">
          {minuteDe(feuille.debut, dernier.le)}′ · {libelleEntree(dernier)}
        </p>
      )}

      {/* Le joueur touché : ses compteurs au pouce. */}
      <Feuille
        open={!!joueur && !passeDe}
        onOpenChange={(o) => !o && setJoueur(null)}
        titre={joueur ? prenom(joueur.nom) : ""}
        etat={joueur ? <PastilleMaillot camp={joueur.camp === "noirs" ? "Noirs" : "Blancs"} /> : null}
      >
        {joueur && (
          <div className="flex flex-col gap-2">
            {LIGNES.map(({ quoi, libelle }) => {
              const v = compte(c, joueur.nom, quoi);
              return (
                <div key={quoi} className="flex min-h-[60px] items-center gap-3 rounded-[18px] bg-card px-3">
                  <span className="min-w-0 flex-1 text-lecture font-semibold">{libelle}</span>
                  <button
                    type="button"
                    aria-label={`${libelle} : un de moins`}
                    disabled={v === 0}
                    onClick={() => void geste([{ joueur: joueur.nom, quoi, d: -1 }])}
                    className="bouton-secondaire grid size-11 shrink-0 place-items-center disabled:opacity-30"
                  >
                    <Minus className="size-4" />
                  </button>
                  <span className="w-8 text-center text-titre-fort font-bold tabular-nums">{v}</span>
                  <button
                    type="button"
                    aria-label={`${libelle} : un de plus`}
                    onClick={() => {
                      if (quoi === "buts" && (joueur.camp === "noirs" ? noirs : blancs).length > 1) {
                        haptique.choix();
                        setPasseDe(joueur);
                        return;
                      }
                      void geste([{ joueur: joueur.nom, quoi, d: 1 }]);
                    }}
                    className="bouton-principal grid size-14 shrink-0 place-items-center"
                  >
                    <Plus className="size-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </Feuille>

      {/* Un but : sa passe, d'un coéquipier, ou sans passe. */}
      <Feuille
        open={!!passeDe}
        onOpenChange={(o) => !o && setPasseDe(null)}
        titre={passeDe ? `But · ${prenom(passeDe.nom)}` : ""}
        bas={
          passeDe ? (
            <button
              type="button"
              onClick={() => {
                const b = passeDe;
                setPasseDe(null);
                setJoueur(null);
                void geste([{ joueur: b.nom, quoi: "buts", d: 1 }]);
              }}
              className="bouton-secondaire h-14 text-lecture font-semibold"
            >
              Sans passe
            </button>
          ) : undefined
        }
      >
        <div className="grid grid-cols-2 gap-2">
          {coequipiers.map((nom) => (
            <button
              key={nom}
              type="button"
              onClick={() => {
                const b = passeDe!;
                setPasseDe(null);
                setJoueur(null);
                void geste([
                  { joueur: b.nom, quoi: "buts", d: 1 },
                  { joueur: nom, quoi: "passes", d: 1 },
                ]);
              }}
              className="flex min-h-[64px] items-center gap-2 rounded-[18px] bg-card px-2 py-2 text-left transition-transform active:scale-[0.97]"
            >
              <CarteDe name={nom} size={FORMAT_CARTE.petite} inerte />
              <span className="min-w-0 truncate text-lecture font-semibold">{prenom(nom)}</span>
            </button>
          ))}
        </div>
      </Feuille>

      {/* Passer la main à un joueur du match. */}
      <Feuille open={passer} onOpenChange={setPasser} titre="Passer la main">
        <div className="grid grid-cols-2 gap-2">
          {[...noirs, ...blancs]
            .filter((n) => n !== feuille?.preneur_nom)
            .map((nom) => (
              <button
                key={nom}
                type="button"
                onClick={async () => {
                  setPasser(false);
                  const r = await direct.passer(equipes, nom);
                  if (r.ok) {
                    haptique.sceau();
                    toast.success(`Feuille · ${prenom(nom)}`);
                  } else toast.error(MOTS_DU_REFUS[r.refus]);
                }}
                className="flex min-h-[64px] items-center gap-2 rounded-[18px] bg-card px-2 py-2 text-left transition-transform active:scale-[0.97]"
              >
                <CarteDe name={nom} size={FORMAT_CARTE.petite} inerte />
                <span className="min-w-0 truncate text-lecture font-semibold">{prenom(nom)}</span>
              </button>
            ))}
        </div>
      </Feuille>
    </Feuille>
  );
}
