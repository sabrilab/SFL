"use client";

// Ma carte, quand on est arbitre (Sabri, 24/10). Un arbitre ne joue pas : ni
// Pépite d'Or, ni dimanches, ni passe. Sa page reprend l'ordre de Ma carte
// (profil/page.tsx) avec ce qui est à lui :
//   1. sa carte d'arbitre en grand (carte-arbitre.tsx ; la toucher l'ouvre
//      en plein écran, comme celle d'un joueur), son nom, son pseudo ;
//   2. trois chiffres : ses matchs arbitrés, sa satisfaction, ses notes ;
//   3. sa photo (le studio, comme tout le monde : ProfilePhoto) ;
//   4. ses missions d'arbitre de la journée (arbitre-missions.tsx), et la
//      ligne de son passe d'arbitre (arbitre-passe.tsx) : ses skins de
//      tenue, ses signes et ses grades ;
//   5. ses matchs, du plus récent au plus ancien, chacun avec sa
//      satisfaction (ou « à venir », ou « pas encore noté ») ;
//   6. « Se déconnecter ».

import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card3DEnGrand } from "@/components/sfl/carte-en-grand";
import { CarteArbitre } from "@/components/sfl/carte-arbitre";
import { MissionsArbitre } from "@/components/sfl/arbitre-missions";
import { PasseArbitre } from "@/components/sfl/arbitre-passe";
import { Chiffre } from "@/components/sfl/profil-joueur";
import { ProfilePhoto } from "@/components/sfl/profile-photo";
import { useSeason } from "@/components/sfl/season-provider";
import { useArbitres } from "@/hooks/use-arbitres";
import { useIdentites } from "@/hooks/use-identites";
import { useGrandEcran, useTresGrandEcran } from "@/hooks/use-media-query";
import { RACINE_PHI } from "@/hooks/use-format-carte";
import { satisfactionDe } from "@/lib/sfl/arbitres";
import { BoutonTheme } from "@/components/layout/bouton-theme";
import { BoutonDeconnexion } from "@/components/sfl/auth/bouton-deconnexion";

/** « Noirs 4 » contre « Blancs 5 » : les deux équipes d'un match. */
const affiche = (equipes: string[]) => (equipes.length === 2 ? `${equipes[0]} – ${equipes[1]}` : equipes.join(" – "));

export function ProfilArbitre({ nom }: { nom: string }) {
  const { journees, saison } = useSeason();
  const arbitres = useArbitres();
  const s = arbitres.stats(nom);
  const identite = useIdentites();
  const grand = useGrandEcran();
  const tresGrand = useTresGrandEcran();
  const [photoOuverte, setPhotoOuverte] = useState(false);
  const numero = saison.numero ?? 0;

  return (
    <div className="shell py-4 sm:py-8 lg:pt-[var(--fib-55)]">
      <div className="relative z-10 mb-[18px] flex items-center justify-between gap-3 lg:mb-[var(--fib-34)]">
        <h1 className="text-[30px] font-bold tracking-tight lg:text-[34px]">Ma carte</h1>
        <div className="flex items-center gap-2">
          <BoutonTheme />
          <Link
            href="/reglages"
            aria-label="Réglages"
            className="bouton-secondaire flex size-11 shrink-0 items-center justify-center gap-[3px]"
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="size-[4px] rounded-full bg-foreground/70" />
            ))}
          </Link>
        </div>
      </div>

      <div className="grille-or grid grid-cols-1 gap-[var(--fib-21)]">
        <div className="colonne-fixe flex min-w-0 flex-col items-center gap-[var(--fib-21)]">
          <div className="-mt-[var(--fib-21)] -mb-[var(--fib-34)]">
            <Card3DEnGrand
              cacheKey={`arbitre-${nom}-${s.satisfaction ?? "x"}-${s.matchs}-${s.avis}-${arbitres.habillages[nom] ?? ""}`}
              mode="simple"
              size={tresGrand ? 1.15 * RACINE_PHI : grand ? 1.15 : 1}
              render={(t) => <CarteArbitre nom={nom} size={t} />}
              titre={identite.nom(nom)}
              sousTitre={identite.pseudo(nom)}
            />
          </div>
          <div className="relative flex w-full flex-col items-center gap-[var(--fib-8)] text-center">
            <span className="titre-lettrage text-[34px] leading-[0.95] break-words">{identite.nom(nom)}</span>
            <span className="font-mono text-[12px] text-foreground/45">{identite.pseudo(nom)} · arbitre</span>
          </div>
          <div className="flex w-full items-stretch divide-x divide-foreground/10 border-y border-foreground/10 py-[var(--fib-13)]">
            <Chiffre valeur={s.matchs} quoi={s.matchs > 1 ? "Matchs arbitrés" : "Match arbitré"} />
            <Chiffre valeur={s.satisfaction ?? "–"} quoi="Satisfaction" />
            <Chiffre valeur={s.avis} quoi={s.avis > 1 ? "Notes" : "Note"} />
          </div>
          <button
            type="button"
            onClick={() => setPhotoOuverte(true)}
            className="bouton-secondaire flex w-full items-center justify-center py-3.5 text-[14px] font-semibold"
          >
            Ma photo
          </button>
        </div>

        <div className="flex min-w-0 flex-col gap-[var(--fib-21)]">
          <MissionsArbitre nom={nom} />
          <PasseArbitre nom={nom} saison={numero} />
          <section>
            <h2 className="mb-3 px-1 text-lg font-semibold tracking-tight">Mes matchs</h2>
            {s.liste.length === 0 ? (
              <p className="px-1 text-[14px] text-foreground/45">Aucun match pour l&apos;instant.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-foreground/10 border-y border-foreground/10">
                {s.liste.map((a) => {
                  const jr = a.saison === numero ? journees.find((x) => x.j === a.j) : undefined;
                  const sat = satisfactionDe(a.totaux);
                  return (
                    <li key={a.id} className="flex items-center gap-3 py-3">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="truncate text-[15px] font-semibold">{affiche(a.equipes)}</span>
                        <span className="font-mono text-[11px] text-foreground/45">
                          {a.saison === numero ? "" : `Saison ${a.saison} · `}J{a.j} · Match {a.n + 1}
                          {jr?.date ? ` · ${jr.date}` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        {a.joue && sat != null ? (
                          <>
                            <span className="text-[22px] leading-none font-black tracking-tight tabular-nums italic">{sat}</span>
                            <span className="font-mono text-[10px] text-foreground/45">
                              {a.totaux!.avis} note{a.totaux!.avis > 1 ? "s" : ""}
                            </span>
                          </>
                        ) : (
                          <span className="font-mono text-[11px] text-foreground/45">{a.joue ? "pas encore noté" : "à venir"}</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
          <BoutonDeconnexion className="w-full" />
        </div>
      </div>

      <Sheet open={photoOuverte} onOpenChange={setPhotoOuverte}>
        <SheetContent side="bottom" className="mx-auto w-full rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          <SheetTitle className="text-[19px] font-extrabold tracking-tight">Ma photo</SheetTitle>
          <ProfilePhoto name={nom} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
