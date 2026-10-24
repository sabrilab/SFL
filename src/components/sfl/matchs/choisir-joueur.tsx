"use client";

// Ajouter un joueur à une place du terrain (terrain-places.tsx) : une liste
// qui s'ouvre sur le + touché. En haut, la recherche par nom ou identifiant ;
// dessous, cinq façons de trouver quelqu'un :
//   · Suivis  — ceux que tu suis (suivis.ts), en premier (Sabri, 22/10 :
//     « qu'on puisse ajouter les gens qu'on suit, qu'on puisse les voir en
//     priorité ») ;
//   · Libres  — ceux qui ont dit être libres à ce moment-là (leurs dispos) ;
//   · Près de toi — les joueurs de ta ville et des villes voisines (villes.ts) ;
//   · Partenaires — ceux avec qui tu as déjà joué (la saison, les archives) ;
//   · Tous — tout Bola, par ordre alphabétique.
// Dans chaque liste et dans la recherche, ceux que tu suis passent devant.
// Chaque joueur en petite carte ; le toucher l'invite. Le mode Team ajoute,
// en tête, l'invitation par lien (un nouveau y crée son compte), et invite
// plusieurs joueurs d'un coup (`plusieurs`, passe du 23/10) : toucher coche,
// le bouton du bas les invite tous. Ceux qui ne peuvent pas venir
// (`indispos` : une autre équipe, un départ…) restent visibles, grisés, la
// raison à la place du détail, en fin de liste : le capitaine sait pourquoi
// avant de toucher, au lieu d'une erreur après.

import { useMemo, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { Nom } from "@/components/sfl/nom";
import { useSuivis } from "@/hooks/use-suivis";
import { chercherProfils, type Profil } from "@/lib/sfl/matchs";
import { partenaires } from "@/lib/sfl/partenaires";
import { maVille, villeDe } from "@/lib/sfl/villes";
import { cn } from "@/lib/utils";

type Onglet = "suivis" | "libres" | "pres" | "partenaires" | "tous";

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

/** Ceux qui ne peuvent pas venir, en fin de liste ; l'ordre gardé entre les autres. */
function enFin(l: Ligne[], indispos?: Map<string, string>): Ligne[] {
  if (!indispos?.size) return l;
  return [...l.filter((x) => !indispos.has(x.profil.id)), ...l.filter((x) => indispos.has(x.profil.id))];
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
  plusieurs,
  indispos,
  titre,
  geste = "Inviter",
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
  /** Cocher plusieurs joueurs (au plus `max`), puis les inviter ensemble. */
  plusieurs?: { max: number; onInviter: (ps: Profil[]) => void };
  /** Ceux qui ne peuvent pas venir : identifiant → la raison, dite sur leur ligne. */
  indispos?: Map<string, string>;
  /** Le titre de la liste, et le mot de chaque ligne (un message privé : « Écrire »). */
  titre?: string;
  geste?: string;
}) {
  const { saison } = useSeason();
  const suivis = useSuivis();
  const [q, setQ] = useState("");
  const [coches, setCoches] = useState<Profil[]>([]);
  const candidats = useMemo(() => profils.filter((p) => !exclus.has(p.id)), [profils, exclus]);
  const fermer = (o: boolean) => {
    if (!o) {
      setQ("");
      setCoches([]);
    }
    onOpenChange(o);
  };

  const listes = useMemo(() => {
    // Ceux que je suis passent devant, l'ordre de chaque liste gardé entre eux.
    const devant = (l: Ligne[]) => [
      ...l.filter((x) => suivis.suit(moiNom, x.profil.name)),
      ...l.filter((x) => !suivis.suit(moiNom, x.profil.name)),
    ];
    const ensemble = partenaires(saison, moiNom);

    const suivisL: Ligne[] = candidats
      .filter((p) => suivis.suit(moiNom, p.name))
      .sort((a, b) => (ensemble.get(b.name) ?? 0) - (ensemble.get(a.name) ?? 0) || a.name.localeCompare(b.name, "fr"))
      .map((profil) => ({
        profil,
        detail: suivis.suit(profil.name, moiNom) ? "Vous vous suivez" : (villeDe(profil.name)?.ville ?? profil.username),
      }));

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

    return {
      suivis: enFin(suivisL, indispos),
      libres: enFin(devant(libresL), indispos),
      pres: enFin(devant(presL), indispos),
      partenaires: enFin(devant(partenairesL), indispos),
      tous: enFin(devant(tousL), indispos),
    };
  }, [candidats, libres, moiNom, saison, suivis, indispos]);

  const onglets = (
    [
      ["suivis", "Suivis"],
      ["libres", "Libres"],
      ["pres", "Près de toi"],
      ["partenaires", "Partenaires"],
      ["tous", "Tous"],
    ] as const
  ).filter(([id]) => id === "tous" || listes[id].length > 0);
  const [choix, setChoix] = useState<Onglet | null>(null);
  const onglet: Onglet | null = onglets.some(([id]) => id === choix) ? choix : (onglets[0]?.[0] ?? null);

  const recherche = q.trim()
    ? enFin(
        chercherProfils(
          [...candidats].sort((a, b) => Number(suivis.suit(moiNom, b.name)) - Number(suivis.suit(moiNom, a.name))),
          q
        ).map((profil) => ({ profil, detail: profil.username })),
        indispos
      )
    : null;
  const lignes: Ligne[] = recherche ?? (onglet ? listes[onglet] : []);
  const plein = !!plusieurs && coches.length >= plusieurs.max;

  return (
    <Sheet open={open} onOpenChange={fermer}>
      <SheetContent side="bottom" className="data-[side=bottom]:h-[80dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-[24px] font-bold tracking-tight">{titre ?? (plusieurs ? "Inviter des joueurs" : "Ajouter un joueur")}</SheetTitle>
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
            <div className="flex gap-1 overflow-x-auto rounded-full bg-secondary p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {onglets.map(([id, libelle]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setChoix(id)}
                  className={cn(
                    "flex-1 px-3 py-2 text-[13.5px] font-semibold whitespace-nowrap",
                    onglet === id ? "bouton-principal" : "bouton-discret text-muted-foreground"
                  )}
                >
                  {libelle}
                </button>
              ))}
            </div>
          )}
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-2">
            {lignes.map(({ profil, detail }) => {
              const raison = indispos?.get(profil.id);
              const coche = coches.some((c) => c.id === profil.id);
              const bloque = !!raison || (plein && !coche);
              return (
                <button
                  key={profil.id}
                  type="button"
                  disabled={bloque}
                  aria-pressed={plusieurs ? coche : undefined}
                  onClick={() => {
                    if (plusieurs) {
                      setCoches((l) => (coche ? l.filter((c) => c.id !== profil.id) : [...l, profil]));
                      return;
                    }
                    onChoisir(profil);
                    fermer(false);
                  }}
                  className={cn(
                    "flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.98] disabled:active:scale-100",
                    // Le contenu s'efface, pas la ligne : pas de calque translucide.
                    bloque && "[&>*]:opacity-45"
                  )}
                >
                  <CarteDe name={profil.name} size={FORMAT_CARTE.petite} inerte />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[15px] font-semibold"><Nom n={profil.name} /></span>
                    <span className="truncate text-[12.5px] text-muted-foreground">{raison ?? detail}</span>
                  </span>
                  {raison ? null : plusieurs ? (
                    <span
                      aria-hidden
                      className={cn(
                        "grid size-[26px] shrink-0 place-items-center rounded-full transition-colors",
                        coche ? "bg-foreground text-background" : "shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]"
                      )}
                    >
                      {coche && <Check className="size-4" strokeWidth={3} />}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full bg-foreground px-3.5 py-1.5 text-[13px] font-semibold text-background">{geste}</span>
                  )}
                </button>
              );
            })}
            {recherche && lignes.length === 0 && <p className="py-8 text-center text-[14px] text-muted-foreground">Personne à ce nom.</p>}
          </div>
          {plusieurs && coches.length > 0 && (
            <button
              type="button"
              onClick={() => {
                plusieurs.onInviter(coches);
                fermer(false);
              }}
              className="bouton-principal bouton--mauve h-12 shrink-0 text-[15px] font-semibold"
            >
              Inviter {coches.length === 1 ? coches[0].name.split(" ")[0] : `${coches.length} joueurs`}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
