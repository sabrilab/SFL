"use client";

// Ajouter un joueur à une place du terrain (terrain-places.tsx) : une liste
// qui s'ouvre sur le + touché. En haut, la recherche par nom ou identifiant ;
// dessous, trois façons de trouver quelqu'un :
//   · Libres  — ceux qui ont dit être libres à ce moment-là (leurs dispos) ;
//   · Près de toi — les joueurs de ta ville et des villes voisines (villes.ts) ;
//   · Partenaires — ceux avec qui tu as déjà joué (la saison, les archives) ;
//   · Tous — tout Bola, par ordre alphabétique.
// Chaque joueur en petite carte ; le toucher l'invite. Le mode Team ajoute,
// en tête, l'invitation par lien (un nouveau y crée son compte).

import { useMemo, useState } from "react";
import { Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { Nom } from "@/components/sfl/nom";
import { chercherProfils, type Profil } from "@/lib/sfl/matchs";
import { maVille, villeDe } from "@/lib/sfl/villes";
import { cn } from "@/lib/utils";

type Onglet = "libres" | "pres" | "partenaires" | "tous";

/** Distance entre deux points, en km (haversine). */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const d = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(d));
}

const PRES_KM = 30;

interface Ligne {
  profil: Profil;
  detail: string;
}

export function ChoisirJoueur({
  open,
  onOpenChange,
  profils,
  exclus,
  libres,
  moiNom,
  onChoisir,
  onLien,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  profils: Profil[];
  /** Déjà sur le terrain (et moi). */
  exclus: Set<string>;
  /** Les identifiants des joueurs libres à ce moment-là. */
  libres: Set<string>;
  moiNom: string;
  onChoisir: (p: Profil) => void;
  /** Inviter quelqu'un qui n'a pas encore de compte : un lien à partager. */
  onLien?: () => void;
}) {
  const { saison } = useSeason();
  const [q, setQ] = useState("");
  const candidats = useMemo(() => profils.filter((p) => !exclus.has(p.id)), [profils, exclus]);

  const listes = useMemo(() => {
    const libresL: Ligne[] = candidats.filter((p) => libres.has(p.id)).map((profil) => ({ profil, detail: "Libre à ce moment-là" }));

    const ici = maVille(moiNom);
    const presL: Ligne[] = ici
      ? candidats
          .map((profil) => {
            const v = villeDe(profil.name);
            return v ? { profil, v, d: km(ici, v) } : null;
          })
          .filter((x): x is NonNullable<typeof x> => !!x && x.d <= PRES_KM)
          .sort((a, b) => a.d - b.d)
          .map(({ profil, v, d }) => ({ profil, detail: d < 1 ? v.ville : `${v.ville} · ${Math.round(d)} km` }))
      : [];

    // Les journées où chacun était présent, saison en cours et archives.
    const entrees = [
      ...saison.entries.map((e) => ({ ...e, s: saison.numero ?? 0 })),
      ...(saison.archives ?? []).flatMap((a) => a.entries.map((e) => ({ ...e, s: a.numero }))),
    ].filter((e) => e.statut === "Présent");
    const mesJours = new Set(entrees.filter((e) => e.player === moiNom).map((e) => `${e.s}-${e.j}`));
    const ensemble = new Map<string, number>();
    for (const e of entrees) {
      if (e.player === moiNom || !mesJours.has(`${e.s}-${e.j}`)) continue;
      ensemble.set(e.player, (ensemble.get(e.player) ?? 0) + 1);
    }
    const partenairesL: Ligne[] = candidats
      .filter((p) => ensemble.has(p.name))
      .sort((a, b) => (ensemble.get(b.name) ?? 0) - (ensemble.get(a.name) ?? 0))
      .map((profil) => {
        const n = ensemble.get(profil.name) ?? 0;
        return { profil, detail: `${n} match${n > 1 ? "s" : ""} ensemble` };
      });

    const tousL: Ligne[] = [...candidats]
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map((profil) => ({ profil, detail: villeDe(profil.name)?.ville ?? profil.username }));

    return { libres: libresL, pres: presL, partenaires: partenairesL, tous: tousL };
  }, [candidats, libres, moiNom, saison]);

  const onglets = (
    [
      ["libres", "Libres"],
      ["pres", "Près de toi"],
      ["partenaires", "Partenaires"],
      ["tous", "Tous"],
    ] as const
  ).filter(([id]) => id === "tous" || listes[id].length > 0);
  const [choix, setChoix] = useState<Onglet | null>(null);
  const onglet: Onglet | null = onglets.some(([id]) => id === choix) ? choix : (onglets[0]?.[0] ?? null);

  const recherche = q.trim()
    ? chercherProfils(candidats, q).map((profil) => ({ profil, detail: profil.username }))
    : null;
  const lignes: Ligne[] = recherche ?? (onglet ? listes[onglet] : []);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[24px] font-bold tracking-tight">Ajouter un joueur</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          {onLien && (
            <button
              type="button"
              onClick={onLien}
              className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-3 text-left transition-transform active:scale-[0.98]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-foreground text-background">
                <Link2 className="size-5" strokeWidth={2.2} />
              </span>
              <span className="flex-1 text-[15px] font-semibold">Inviter par lien</span>
            </button>
          )}
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou identifiant" autoCapitalize="none" autoCorrect="off" />
          {!recherche && onglets.length > 1 && (
            <div className="grid grid-flow-col gap-1 rounded-full bg-secondary p-1">
              {onglets.map(([id, libelle]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChoix(id)}
                  className={cn(
                    "py-2 text-[13.5px] font-semibold",
                    onglet === id ? "bouton-principal" : "bouton-discret text-muted-foreground"
                  )}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-2">
            {lignes.map(({ profil, detail }) => (
              <button
                key={profil.id}
                type="button"
                onClick={() => {
                  onChoisir(profil);
                  setQ("");
                  onOpenChange(false);
                }}
                className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
              >
                <CarteDe name={profil.name} size={FORMAT_CARTE.petite} inerte />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold"><Nom n={profil.name} /></span>
                  <span className="truncate text-[12.5px] text-muted-foreground">{detail}</span>
                </span>
                <span className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-[13px] font-semibold text-background">Inviter</span>
              </button>
            ))}
            {recherche && lignes.length === 0 && <p className="py-8 text-center text-[14px] text-muted-foreground">Personne à ce nom.</p>}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
