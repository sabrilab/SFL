"use client";

// Personnaliser ma carte, depuis Ma carte. Sabri, 24/10 : « il faut choisir,
// parmi les filtres qu'il a, celui qu'il veut mettre en avant, et parmi les
// badges qu'il a aussi. Ça ne doit pas être imposé, et il faut qu'on
// comprenne à quoi correspondent tel et tel filtre, et skin ». Rien n'est
// porté d'office (use-habillage.ts) : la carte de base tant qu'il n'a rien
// choisi. Une feuille, la carte en haut, qui change à chaque choix, puis :
//   · le skin : un seul à la fois, ou aucun ; chacun dit ce qu'il est et
//     comment on l'a (le palier du Passe Bola, ou offert). Ceux qu'il n'a pas
//     encore restent visibles, au cadenas : c'est ce qui donne envie ;
//   · les signes : autant qu'il veut, chacun s'allume ou s'éteint ;
//   · le badge : le meilleur (par défaut), un badge gagné ou aucun ; chacun
//     dit comment il a été gagné.
// Le rang (XP à vie) et le cran du cadre (missions réussies) restent sur la
// carte : ils disent ce qu'il a fait, ils ne se choisissent pas.

import { useState } from "react";
import { Check, Lock, Palette } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Badge3D, nomBadge } from "@/components/sfl/badge-3d";
import type { Finition, HabillageCarte, Signe } from "@/components/sfl/finitions-carte";
import { ChoixPays, Mini } from "@/components/sfl/passe-bola";
import { PlayerCard } from "@/components/sfl/player-card";
import { useSeason } from "@/components/sfl/season-provider";
import { COULEURS_PAYS, PAYS_PAR_DEFAUT } from "@/components/sfl/skins-passe";
import { useChoixBadge } from "@/hooks/use-badge-carte";
import { finitionsDe, useChoixHabillage, useHabillage, usePalierMax } from "@/hooks/use-habillage";
import { badgesGagnes, cleBadge, type BadgeCarte } from "@/lib/sfl/badge-carte";
import { choisirBadge } from "@/lib/sfl/badges-choisis";
import type { Player } from "@/lib/sfl/engine";
import { CLASSEMENTS } from "@/lib/sfl/fin-de-saison";
import { SKINS_OFFERTS } from "@/lib/sfl/finitions-offertes";
import { choisirHabillage } from "@/lib/sfl/habillages-choisis";
import { PASSE_BOLA } from "@/lib/sfl/passe";
import { NOM_METAL, TROPHEES, metal } from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";

const SKINS = PASSE_BOLA.filter((p) => p.genre === "skin");
const SIGNES = PASSE_BOLA.filter((p) => p.genre === "signe");

const ordinal = (n: number) => (n === 1 ? "1er" : `${n}e`);

/** Ce qu'est le badge, et comment il a été gagné, en court. */
function commentBadge(b: BadgeCarte): { quoi: string; court: string } {
  if (b.famille === "saison") {
    const c = CLASSEMENTS.find((x) => x.id === b.id)!;
    return { quoi: "Un podium de fin de saison.", court: `${ordinal(b.rang)} · classement ${c.nom}` };
  }
  const t = TROPHEES.find((x) => x.id === b.id)!;
  const seuil = t.paliers[b.palier - 1];
  return {
    quoi: `${t.inscription.charAt(0).toUpperCase()}${t.inscription.slice(1)}`,
    court: `Palier ${NOM_METAL[metal(b.palier)!].toLowerCase()} · ${seuil} ${t.unite[seuil > 1 ? 1 : 0]}`,
  };
}

function Ligne({
  actif,
  ouvert = true,
  onClick,
  vignette,
  titre,
  quoi,
  comment,
}: {
  actif: boolean;
  ouvert?: boolean;
  onClick?: () => void;
  vignette: React.ReactNode;
  titre: string;
  quoi?: string;
  comment: string;
}) {
  return (
    <button
      type="button"
      disabled={!ouvert}
      onClick={onClick}
      aria-pressed={ouvert ? actif : undefined}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-[18px] px-3 py-2.5 text-left transition-colors",
        actif ? "bg-foreground/[0.14] ring-1 ring-foreground/40" : "bg-foreground/[0.05] active:bg-foreground/10",
        !ouvert && "opacity-55"
      )}
    >
      <span className="relative h-[71px] w-11 shrink-0 overflow-hidden rounded-[7px]">{vignette}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] leading-tight font-bold">{titre}</span>
        {quoi && <span className="text-[13px] leading-[1.3] text-foreground/70">{quoi}</span>}
        <span className="mono-label text-foreground/45">{comment}</span>
      </span>
      {ouvert ? (
        actif && <Check className="size-5 shrink-0" aria-hidden />
      ) : (
        <Lock className="size-4 shrink-0 text-foreground/50" aria-hidden />
      )}
    </button>
  );
}

function Rubrique({ titre, sous, children }: { titre: string; sous: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="mono-label text-foreground/60">{titre}</h3>
        <span className="mono-label text-foreground/40">{sous}</span>
      </div>
      {children}
    </section>
  );
}

export function PersonnaliserCarte({ player }: { player: Player }) {
  const nom = player.name;
  const { saison } = useSeason();
  const [ouvert, setOuvert] = useState(false);
  const palierMax = usePalierMax(nom);
  const choix = useChoixHabillage(nom);
  const porte = useHabillage(nom);
  const mesSkins = finitionsDe(nom, palierMax);
  const offerts = mesSkins.filter((f) => !SKINS.some((s) => s.habille?.finition === f));
  const badges = badgesGagnes(saison, nom);
  const choixBadge = useChoixBadge(nom) ?? "auto";
  const badgeActif = choixBadge === "aucun" ? "aucun" : badges.some((b) => cleBadge(b) === choixBadge) ? choixBadge : "auto";
  const pays = choix.pays ?? PAYS_PAR_DEFAUT;
  const base: HabillageCarte = { cran: porte.cran, rang: porte.rang };

  const porterSkin = (f: Finition | "-") =>
    void choisirHabillage(nom, { ...choix, finition: f, pays: f === "couleurs" ? pays : choix.pays });
  const basculerSigne = (g: Signe) =>
    void choisirHabillage(nom, {
      ...choix,
      signes: choix.signes.includes(g) ? choix.signes.filter((x) => x !== g) : [...choix.signes, g],
    });
  const vignette = (h: HabillageCarte) => <Mini player={player} habillage={{ ...base, ...h }} l={44} h={71} />;
  const nSkins = mesSkins.length;
  const nSignes = SIGNES.filter((s) => s.n <= palierMax).length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="bouton-secondaire bouton--or flex w-full items-center justify-center gap-2 py-3.5 text-[14px] font-semibold"
      >
        <Palette className="size-4" />
        Personnaliser ma carte
      </button>

      <Sheet open={ouvert} onOpenChange={setOuvert}>
        <SheetContent
          side="bottom"
          className="mx-auto max-h-[92dvh] w-full gap-0 overflow-y-auto rounded-t-[28px] px-4 pt-6 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] sm:max-w-md"
        >
          <SheetTitle className="px-1 text-[19px] font-extrabold tracking-tight">Ma carte</SheetTitle>
          <div className="mt-4 mb-6 flex justify-center">
            <PlayerCard player={player} size={0.62} />
          </div>

          <div className="flex flex-col gap-7">
            <Rubrique titre="Skin" sous={`${nSkins} à toi`}>
              <Ligne
                actif={!porte.finition}
                onClick={() => porterSkin("-")}
                vignette={vignette({})}
                titre="Carte de base"
                quoi="Ta carte de saison, sans skin."
                comment="Toujours à toi"
              />
              {SKINS.map((p) => {
                const f = p.habille!.finition as Finition;
                const a = mesSkins.includes(f);
                return (
                  <div key={p.n} className="flex flex-col gap-2">
                    <Ligne
                      actif={porte.finition === f}
                      ouvert={a}
                      onClick={() => porterSkin(f)}
                      vignette={vignette({ finition: f, pays: f === "couleurs" ? pays : undefined })}
                      titre={f === "couleurs" && a ? `${p.nom} · ${COULEURS_PAYS[pays]?.nom ?? ""}` : p.nom}
                      quoi={p.quoi}
                      comment={a ? `Passe Bola · palier ${p.n}` : `À gagner · palier ${p.n} du Passe Bola`}
                    />
                    {f === "couleurs" && porte.finition === "couleurs" && (
                      <div className="-mx-4">
                        <ChoixPays pays={pays} onChoisir={(x) => void choisirHabillage(nom, { ...choix, finition: "couleurs", pays: x })} />
                      </div>
                    )}
                  </div>
                );
              })}
              {offerts.map((f) => (
                <Ligne
                  key={f}
                  actif={porte.finition === f}
                  onClick={() => porterSkin(f)}
                  vignette={vignette({ finition: f })}
                  titre={SKINS_OFFERTS[f]?.titre ?? f}
                  quoi={SKINS_OFFERTS[f]?.quoi}
                  comment={SKINS_OFFERTS[f]?.comment ?? "Offert"}
                />
              ))}
            </Rubrique>

            <Rubrique titre="Signes" sous={`${nSignes} à toi`}>
              {SIGNES.map((p) => {
                const g = p.habille!.signe as Signe;
                const a = p.n <= palierMax;
                return (
                  <Ligne
                    key={p.n}
                    actif={a && choix.signes.includes(g)}
                    ouvert={a}
                    onClick={() => basculerSigne(g)}
                    vignette={vignette({ signes: [g] })}
                    titre={p.nom}
                    quoi={p.quoi}
                    comment={a ? `Passe Bola · palier ${p.n}` : `À gagner · palier ${p.n} du Passe Bola`}
                  />
                );
              })}
            </Rubrique>

            <Rubrique titre="Badge" sous={`${badges.length} à toi`}>
              {badges.length > 0 && (
                <Ligne
                  actif={badgeActif === "auto"}
                  onClick={() => void choisirBadge(nom, "auto")}
                  vignette={<span className="flex h-full items-center justify-center"><Badge3D badge={badges[0]} largeur={40} /></span>}
                  titre="Le meilleur"
                  quoi={`${nomBadge(badges[0])}. Il change tout seul quand tu gagnes mieux.`}
                  comment="Par défaut"
                />
              )}
              {badges.map((b) => (
                <Ligne
                  key={cleBadge(b)}
                  actif={badgeActif === cleBadge(b)}
                  onClick={() => void choisirBadge(nom, cleBadge(b))}
                  vignette={<span className="flex h-full items-center justify-center"><Badge3D badge={b} largeur={40} /></span>}
                  titre={nomBadge(b)}
                  quoi={commentBadge(b).quoi}
                  comment={commentBadge(b).court}
                />
              ))}
              <Ligne
                actif={badgeActif === "aucun"}
                onClick={() => void choisirBadge(nom, "aucun")}
                vignette={<span className="flex h-full items-center justify-center"><span className="size-8 rounded-full border-[1.5px] border-dashed border-foreground/40" /></span>}
                titre="Aucun"
                quoi={badges.length ? "Le coin de ta carte reste vide." : "Gagne un palier ou un podium pour en porter un."}
                comment="Sans badge"
              />
            </Rubrique>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
