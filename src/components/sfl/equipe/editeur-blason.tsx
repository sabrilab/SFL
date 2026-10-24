"use client";

// Dessiner l'écusson de son équipe (Sabri, 24/10 : « designer un vrai
// écusson d'équipe et choisir de vraies couleurs d'équipe ») : l'écusson et
// le maillot en grand, qui changent à chaque toucher, puis la forme, le
// motif, les trois couleurs (le fond, le motif, les détails : on touche une
// des trois pastilles, puis une couleur de club) et l'emblème : un signe
// (initiales, figure, forme géométrique) ou, sur la rangée d'après, un animal. Chaque choix
// se montre déjà peint aux couleurs de l'équipe, pas en pictogramme.
//
// EditeurBlason sert à la création de l'équipe (creer-equipe.tsx) ;
// FicheBlason, au capitaine (ou au vice) qui le retouche ensuite, depuis la
// page Team.

import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Ecusson } from "@/components/sfl/equipe/ecusson";
import { Maillot } from "@/components/sfl/equipe/maillot";
import { EMBLEMES, FORMES, MOTIFS, PALETTE, blasonParDefaut, encreSur, memeBlason, type Blason } from "@/lib/sfl/blason";
import { dessinerBlason, direErreurEquipe, type Equipe, type Fond } from "@/lib/sfl/equipes";
import { cn } from "@/lib/utils";

const ROLES_COULEUR = ["Fond", "Motif", "Détails"] as const;

function Choix({ actif, onClick, label, children }: { actif: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={actif}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "grid shrink-0 place-items-center rounded-[16px] p-1 transition-[transform,background-color] active:scale-95",
        actif ? "bg-contraste/12 ring-2 ring-contraste/70" : "bg-card"
      )}
    >
      {children}
    </button>
  );
}

function Rangee({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono-label text-muted-foreground">{titre}</span>
      <div className="-mx-4 flex gap-1.5 overflow-x-auto overscroll-x-contain px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

export function EditeurBlason({
  valeur,
  onChange,
  initiales,
  fond,
  apercu = true,
}: {
  valeur: Blason;
  onChange: (b: Blason) => void;
  initiales: string;
  fond: Fond;
  /** L'écusson et le maillot en grand, au-dessus des choix. */
  apercu?: boolean;
}) {
  const [teinte, setTeinte] = useState<0 | 1 | 2>(0);
  const avec = (p: Partial<Blason>) => onChange({ ...valeur, ...p });
  const ini = initiales || "?";
  return (
    <div className="flex flex-col gap-4">
      {apercu && (
        <div className="flex items-end justify-center gap-5 py-1">
          <Ecusson initiales={ini} fond={fond} blason={valeur} taille={108} />
          <Maillot initiales={ini} fond={fond} blason={valeur} taille={124} />
        </div>
      )}
      <Rangee titre="Forme">
        {FORMES.map((f) => (
          <Choix key={f.id} actif={valeur.forme === f.id} label={f.label} onClick={() => avec({ forme: f.id })}>
            <Ecusson initiales={ini} fond={fond} blason={{ ...valeur, forme: f.id }} taille={44} />
          </Choix>
        ))}
      </Rangee>
      <Rangee titre="Motif">
        {MOTIFS.map((m) => (
          <Choix key={m.id} actif={valeur.motif === m.id} label={m.label} onClick={() => avec({ motif: m.id })}>
            <Ecusson initiales={ini} fond={fond} blason={{ ...valeur, motif: m.id }} taille={44} />
          </Choix>
        ))}
      </Rangee>
      <div className="flex flex-col gap-2">
        <span className="mono-label text-muted-foreground">Couleurs</span>
        <div className="grid grid-cols-3 gap-2">
          {ROLES_COULEUR.map((r, i) => (
            <button
              key={r}
              type="button"
              aria-pressed={teinte === i}
              onClick={() => setTeinte(i as 0 | 1 | 2)}
              className={cn(
                "flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 text-[13px] font-semibold transition-colors",
                teinte === i ? "bg-contraste/12 ring-2 ring-contraste/70" : "bg-card text-muted-foreground"
              )}
            >
              <span className="size-6 shrink-0 rounded-full border border-contraste/25" style={{ background: valeur.couleurs[i] }} />
              {r}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-8 gap-2 pt-1 sm:grid-cols-[repeat(15,minmax(0,1fr))]">
          {PALETTE.map((c) => {
            const pris = valeur.couleurs[teinte] === c.hex;
            return (
              <button
                key={c.id}
                type="button"
                aria-label={c.label}
                aria-pressed={pris}
                onClick={() => {
                  const couleurs = [...valeur.couleurs] as Blason["couleurs"];
                  couleurs[teinte] = c.hex;
                  avec({ couleurs });
                }}
                className={cn(
                  "grid aspect-square place-items-center rounded-full border border-contraste/20 transition-transform active:scale-90",
                  pris && "ring-2 ring-contraste ring-offset-2 ring-offset-background"
                )}
                style={{ background: c.hex }}
              >
                {pris && <Check className="size-3.5" strokeWidth={3} style={{ color: encreSur(c.hex) }} />}
              </button>
            );
          })}
        </div>
      </div>
      {(["signe", "animal"] as const).map((famille) => (
        <Rangee key={famille} titre={famille === "signe" ? "Emblème" : "Animal"}>
          {EMBLEMES.filter((e) => e.famille === famille).map((e) => (
            <Choix key={e.id} actif={valeur.embleme === e.id} label={e.label} onClick={() => avec({ embleme: e.id })}>
              <Ecusson initiales={ini} fond={fond} blason={{ ...valeur, embleme: e.id }} taille={44} />
            </Choix>
          ))}
        </Rangee>
      ))}
    </div>
  );
}

/** Le capitaine (ou son vice) retouche l'écusson et les couleurs de son équipe. */
export function FicheBlason({
  equipe,
  open,
  onOpenChange,
  apercu,
  onEnregistre,
}: {
  equipe: Equipe | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  apercu?: boolean;
  onEnregistre: () => void;
}) {
  const depart = equipe ? (equipe.blason ?? blasonParDefaut(equipe.fond)) : null;
  const [brouillon, setBrouillon] = useState<Blason | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const b = brouillon ?? depart;
  const fermer = (o: boolean) => {
    if (!o) setBrouillon(null);
    onOpenChange(o);
  };
  async function enregistrer() {
    if (!equipe || !b) return;
    if (apercu) {
      toast("Aperçu : rien n'est enregistré.");
      return;
    }
    setEnvoi(true);
    try {
      await dessinerBlason(equipe.id, b);
      navigator.vibrate?.([10, 40, 18]);
      toast.success("Écusson enregistré.");
      fermer(false);
      onEnregistre();
    } catch (e) {
      toast.error(direErreurEquipe(e));
    } finally {
      setEnvoi(false);
    }
  }
  return (
    <Sheet open={open && !!equipe} onOpenChange={fermer}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {equipe && b && (
          <>
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="pr-10 text-[24px] font-bold tracking-tight">{equipe.nom}</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-5 px-4">
              <EditeurBlason valeur={b} onChange={setBrouillon} initiales={equipe.initiales} fond={equipe.fond} />
              <Button
                variant="vert"
                disabled={envoi || memeBlason(b, equipe.blason)}
                onClick={enregistrer}
                className="h-12 rounded-full text-[15px] font-semibold"
              >
                Enregistrer l&apos;écusson
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
