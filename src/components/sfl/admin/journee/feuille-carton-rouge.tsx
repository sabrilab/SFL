"use client";

// Le carton rouge direct (Sabri, 13/11/2026 : « Suspends le compte d'Anis
// Bouzenita et envoie-lui un message : […] carton rouge »). Hors de toute
// série de retards : l'admin choisit le joueur, la journée qu'il manquera
// (la prochaine pas encore jouée d'abord) et, s'il veut, un message. Le
// carton entre dans la saison (Saison.cartonsRouges, lib/sfl/cartons.ts) :
// la suspension, l'animation à l'ouverture de l'app et la notification sont
// celles du rouge de trois retards. La notification part dès que la saison
// est en base (annoncerCartonsApresEnvoi).
//
// En dessous, les rouges déjà donnés : « Retirer » efface le carton et la
// suspension (après confirmation). Lever une suspension sans retirer le
// carton se fait comme avant, en touchant le suspendu dans « Ajouter ».
//
// Sans phrase d'aide ; noir et blanc, le rouge seulement sur le carton.

import { useMemo, useState } from "react";
import { ChoisirJoueurs } from "@/components/sfl/admin/choisir-joueurs";
import { PetitCarton } from "@/components/sfl/cartons/carton-recu";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { donnerCartonRouge, MESSAGE_CARTON_MAX, retirerCartonRouge } from "@/lib/sfl/cartons";
import { annoncerCartonsApresEnvoi } from "@/lib/sfl/cartons-annonce";
import { haptique } from "@/lib/sfl/haptique";
import { journeeJouee } from "@/lib/sfl/saisie/engine";
import type { Saison } from "@/lib/sfl/saisie/types";
import type { Confirmation } from "@/components/sfl/admin/confirmer";
import { Etiquette, Feuille, Pastille } from "./ui";

const AUCUNE_PLACE = new Map<string, string>();

/** Les journées qu'un carton peut suspendre : la première pas encore jouée, et les deux d'après. */
export function journeesSuspendables(saison: Pick<Saison, "entries" | "journees">): number[] {
  const nums = saison.journees.map((m) => m.j);
  const max = nums.length ? Math.max(...nums) : 0;
  let premiere = 1;
  for (let j = 1; j <= max + 1; j++) {
    if (!journeeJouee(saison, j)) {
      premiere = j;
      break;
    }
  }
  return [premiere, premiere + 1, premiere + 2];
}

export function FeuilleCartonRouge({
  open,
  onOpenChange,
  saison,
  par,
  faire,
  confirmer,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  saison: Saison;
  par: string;
  faire: (f: (s: Saison) => Saison, label: string) => boolean;
  confirmer: (c: Confirmation) => void;
}) {
  const choix = useMemo(() => journeesSuspendables(saison), [saison]);
  const [joueur, setJoueur] = useState<string | null>(null);
  const [pour, setPour] = useState<number>(choix[0]);
  const [message, setMessage] = useState("");
  const [choisir, setChoisir] = useState(false);
  const donnes = [...(saison.cartonsRouges ?? [])].sort((a, b) => b.le.localeCompare(a.le));

  function donner() {
    if (!joueur) return;
    confirmer({
      titre: `Carton rouge à ${joueur} ?`,
      detail: `Suspendu pour la J${pour}. Il le reçoit tout de suite.`,
      action: "Donner",
      faire: () => {
        if (faire((s) => donnerCartonRouge(s, joueur, pour, message, par, new Date()), `Carton rouge à ${joueur} · J${pour}`)) {
          haptique.sceau();
          annoncerCartonsApresEnvoi();
          setJoueur(null);
          setMessage("");
          onOpenChange(false);
        }
      },
    });
  }

  return (
    <>
      <Feuille
        open={open}
        onOpenChange={onOpenChange}
        titre="Carton rouge"
        bas={
          <button type="button" disabled={!joueur} onClick={donner} className="bouton-principal h-12 text-lecture font-semibold disabled:opacity-40">
            {joueur ? `Donner le carton rouge · J${pour}` : "Donner le carton rouge"}
          </button>
        }
      >
        <section className="flex flex-col gap-2">
          <Etiquette>Joueur</Etiquette>
          {joueur ? (
            <button type="button" onClick={() => setChoisir(true)} className="flex items-center gap-3 text-left">
              <CarteDe name={joueur} size={FORMAT_CARTE.petite} inerte />
              <span className="text-lecture font-semibold">{joueur}</span>
            </button>
          ) : (
            <div className="flex">
              <Pastille pointille onClick={() => setChoisir(true)}>
                Choisir
              </Pastille>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <Etiquette>Suspendu pour</Etiquette>
          <div className="flex flex-wrap gap-1.5">
            {choix.map((j) => (
              <Pastille key={j} actif={pour === j} onClick={() => setPour(j)}>
                J{j}
              </Pastille>
            ))}
          </div>
        </section>

        <label className="flex flex-col gap-2">
          <Etiquette>Message</Etiquette>
          <textarea
            value={message}
            maxLength={MESSAGE_CARTON_MAX}
            rows={2}
            autoComplete="off"
            onChange={(e) => setMessage(e.target.value)}
            className="glass-soft w-full min-w-0 resize-none rounded-[18px] px-4 py-3 text-lecture outline-none"
          />
        </label>

        {donnes.length > 0 && (
          <section className="flex flex-col gap-2">
            <Etiquette>Donnés</Etiquette>
            <ul className="flex flex-col gap-1.5">
              {donnes.map((d) => (
                <li key={`${d.joueur}-${d.pour}`} className="flex items-center gap-3 rounded-[18px] bg-contraste/5 px-3.5 py-2.5">
                  <PetitCarton couleur="rouge" taille={1.25} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-ligne font-bold">
                      {d.joueur} · J{d.pour}
                    </span>
                    {d.message && <span className="truncate text-corps text-encre-3">{d.message}</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      confirmer({
                        titre: `Retirer le carton rouge de ${d.joueur} ?`,
                        detail: `Il pourra jouer la J${d.pour}.`,
                        action: "Retirer",
                        faire: () => {
                          if (faire((s) => retirerCartonRouge(s, d.joueur, d.pour), `Carton rouge de ${d.joueur} retiré`)) haptique.sceau();
                        },
                      })
                    }
                    className="mono-label h-9 shrink-0 rounded-full bg-secondary px-3.5 text-encre-2"
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Feuille>
      <ChoisirJoueurs
        open={choisir}
        onOpenChange={setChoisir}
        saison={saison}
        titre="Carton rouge à"
        places={AUCUNE_PLACE}
        onChoisir={(nom) => {
          setJoueur(nom);
          setChoisir(false);
        }}
      />
    </>
  );
}
