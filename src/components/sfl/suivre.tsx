"use client";

// Suivre un joueur (Sabri, 22/10 : « voir le nombre de followers de chaque
// utilisateur quand on clique sur sa carte […] qu'on puisse les suivre »).
// Le bouton se pose partout où l'on ouvre sa carte : son profil
// (profil-joueur.tsx), sa fiche de match (fiche-joueur.tsx), sa carte en
// grand (card-viewer.tsx).
//
// Ses abonnés comme sur Instagram (Sabri, 23/10 : « on voit les gens qui le
// suivent, comme sur Instagram […] trois personnes qui le suivent, que tu
// connais ») : ses abonnés et ses abonnements en chiffres, puis « Suivi par
// Kader, Anis et 3 autres que tu connais » avec leurs petites cartes. Ceux
// qu'on connaît : ceux qu'on suit, puis ceux avec qui on a joué
// (partenaires.ts), les plus fidèles d'abord. Sur Ma carte, les siens :
// « Kader, Anis et 32 autres te suivent ». Toucher un chiffre ou la ligne
// ouvre les listes, chacun en petite carte, ceux qu'on connaît d'abord, qu'on
// suit d'ici.
//
// Le bouton est mauve (« les autres », boutons.css) tant qu'on ne suit pas ;
// suivi, il passe en pilule cerclée. « Suivre en retour » quand c'est lui qui
// nous suit. Rien sur sa propre carte, ni pour un joueur sans compte. Sur le
// verre clair de la carte en grand (`clair`) : l'encre, puis la nacre posée.
// Les suivis vivent dans lib/sfl/suivis.ts.

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useIdentites } from "@/hooks/use-identites";
import { useSuivis, type Suivis } from "@/hooks/use-suivis";
import { partenaires } from "@/lib/sfl/partenaires";
import { nePlusSuivre, suivre } from "@/lib/sfl/suivis";
import { cn } from "@/lib/utils";

export const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un);

const PHI = (1 + Math.sqrt(5)) / 2;
/**
 * Les visages de « Suivi par » : la pastille, un cran sous la petite (30 px).
 * Lu au rendu, pas au chargement : mini-carte → card-viewer → suivre →
 * mini-carte est un cycle, et selon l'ordre des imports FORMAT_CARTE n'est
 * pas encore défini quand ce module se charge.
 */
const visage = () => FORMAT_CARTE.petite / PHI;

type Onglet = "abonnes" | "abonnements";

/** Le bouton Suivre d'un joueur. */
export function BoutonSuivre({
  nom,
  petit = false,
  clair = false,
  className,
}: {
  nom: string;
  petit?: boolean;
  /** Sur le verre clair de la carte en grand. */
  clair?: boolean;
  className?: string;
}) {
  const { me } = useMyPlayer();
  const s = useSuivis();
  if (!me || nom === me || !s.suivable(nom)) return null;
  const suivi = s.suit(me, nom);
  const retour = !suivi && s.suit(nom, me);

  async function basculer() {
    navigator.vibrate?.(8);
    const erreur = suivi ? await nePlusSuivre(me, nom) : await suivre(me, [nom]);
    if (erreur) toast.error(erreur);
  }

  return (
    <button
      type="button"
      aria-pressed={suivi}
      onClick={(e) => {
        e.stopPropagation();
        void basculer();
      }}
      className={cn(
        clair
          ? suivi
            ? "bouton-givre"
            : "bouton-encre bouton--mauve"
          : suivi
            ? "bouton-secondaire"
            : "bouton-principal bouton--mauve",
        "flex shrink-0 items-center justify-center gap-1.5 font-semibold whitespace-nowrap",
        petit ? "h-8 px-3.5 text-[13px]" : "h-10 px-6 text-[14px]",
        className
      )}
    >
      {suivi && <Check className={petit ? "size-3.5" : "size-4"} strokeWidth={2.4} />}
      {suivi ? "Suivi" : retour ? "Suivre en retour" : "Suivre"}
    </button>
  );
}

/**
 * Des noms dans l'ordre de ce qu'ils sont pour moi : ceux que je suis, puis
 * ceux avec qui j'ai le plus joué, puis les autres par leurs points.
 * `connus` : ceux que je suis ou avec qui j'ai joué.
 */
function useProches(): (noms: string[]) => { ordre: string[]; connus: string[] } {
  const s = useSuivis();
  const { me } = useMyPlayer();
  const { saison, allPlayers } = useSeason();
  const ensemble = useMemo(() => (me ? partenaires(saison, me) : new Map<string, number>()), [saison, me]);
  const points = useMemo(() => new Map(allPlayers.map((p) => [p.name, p.pp])), [allPlayers]);
  return useMemo(() => {
    const suivi = (n: string) => !!me && s.suit(me, n);
    return (noms) => {
      const ordre = [...noms].sort(
        (a, b) =>
          Number(suivi(b)) - Number(suivi(a)) ||
          (ensemble.get(b) ?? 0) - (ensemble.get(a) ?? 0) ||
          (points.get(b) ?? 0) - (points.get(a) ?? 0) ||
          a.localeCompare(b, "fr")
      );
      return { ordre, connus: ordre.filter((n) => suivi(n) || ensemble.has(n)) };
    };
  }, [s, me, ensemble, points]);
}

/** Les petites cartes de « Suivi par », la première devant. */
function Visages({ noms, clair }: { noms: string[]; clair: boolean }) {
  return (
    <span aria-hidden className="flex shrink-0 items-center">
      {noms.map((n, i) => (
        <span
          key={n}
          className={cn("relative flex rounded-[24%] ring-2", clair ? "ring-[#f2f1ee]" : "ring-background", i > 0 && "-ml-[11px]")}
          style={{ zIndex: noms.length - i }}
        >
          <CarteDe name={n} size={visage()} inerte />
        </span>
      ))}
    </span>
  );
}

/**
 * Ses abonnés et ses abonnements en chiffres, puis qui le suit, avec leurs
 * petites cartes : « Suivi par Kader, Anis et 3 autres que tu connais » (sur
 * Ma carte, « … te suivent »). Chaque morceau ouvre les listes.
 */
export function ReseauJoueur({
  nom,
  clair = false,
  centre = true,
  className,
}: {
  nom: string;
  /** Sur le verre clair de la carte en grand. */
  clair?: boolean;
  /** Centré sous un nom (profil, Ma carte), sinon calé à gauche. */
  centre?: boolean;
  className?: string;
}) {
  const s = useSuivis();
  const { me } = useMyPlayer();
  const id = useIdentites();
  const proches = useProches();
  const [onglet, setOnglet] = useState<Onglet>("abonnes");
  const [ouvert, setOuvert] = useState(false);
  const ouvrir = (o: Onglet) => {
    setOnglet(o);
    setOuvert(true);
  };
  if (!s.suivable(nom) && s.abonnes(nom).length === 0) return null;

  const moi = !!me && nom === me;
  const abonnes = s.abonnes(nom);
  const abonnements = s.abonnements(nom);
  // Jamais « suivi par toi » : on se compte, on ne se montre pas.
  const { ordre, connus } = proches(abonnes.filter((n) => n !== me));
  const montres = moi || connus.length === 0 ? ordre : connus;
  const noms = montres.slice(0, 2);
  const reste = montres.length - noms.length;

  const fort = clair ? "text-[#0a0b0d]" : "text-foreground";
  const doux = clair ? "text-[#0a0b0d]/55" : "text-foreground/45";
  const gras = (n: string) => (
    <span key={n} className={cn("font-semibold", fort)}>
      {id.nom(n)}
    </span>
  );
  const autres = reste > 0 && (
    <span className={cn("font-semibold", fort)}>
      {reste} {pluriel(reste, "autre", "autres")}
    </span>
  );
  const liste =
    noms.length === 1 ? (
      gras(noms[0])
    ) : reste === 0 ? (
      <>
        {gras(noms[0])} et {gras(noms[1])}
      </>
    ) : (
      <>
        {gras(noms[0])}, {gras(noms[1])} et {autres}
      </>
    );

  return (
    <div className={cn("flex w-full flex-col gap-[var(--fib-8)]", centre ? "items-center" : "items-start", className)}>
      <div className={cn("flex items-center gap-[var(--fib-13)] font-mono text-[13px]", doux)}>
        {(
          [
            ["abonnes", abonnes.length, pluriel(abonnes.length, "abonné", "abonnés")],
            ["abonnements", abonnements.length, pluriel(abonnements.length, "abonnement", "abonnements")],
          ] as const
        ).map(([o, n, libelle]) => (
          <button
            key={o}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              ouvrir(o);
            }}
            className="transition-transform active:scale-95 motion-reduce:transition-none"
          >
            <span className={cn("font-bold tabular-nums", fort)}>{n}</span> {libelle}
          </button>
        ))}
      </div>
      {noms.length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            ouvrir("abonnes");
          }}
          className={cn(
            "flex items-center gap-2.5 text-[13.5px] leading-[1.3] transition-transform active:scale-[0.98] motion-reduce:transition-none",
            centre ? "max-w-[300px]" : "max-w-full",
            doux
          )}
        >
          <Visages noms={montres.slice(0, 3)} clair={clair} />
          <span className="min-w-0 text-left">
            {moi ? (
              <>
                {liste} {montres.length > 1 ? "te suivent" : "te suit"}
              </>
            ) : (
              <>
                Suivi par {liste}
                {reste > 0 && connus.length > 0 && " que tu connais"}
              </>
            )}
          </span>
        </button>
      )}
      <ListeSuivis nom={nom} ouvert={ouvert} onglet={onglet} onOnglet={setOnglet} onFermer={() => setOuvert(false)} />
    </div>
  );
}

/** Ce qu'un joueur de la liste est pour moi. */
function lien(n: string, me: string, s: Suivis, ensemble: Map<string, number>, pseudo: string): string {
  if (n === me) return "Toi";
  if (s.suit(me, n) && s.suit(n, me)) return "Vous vous suivez";
  if (s.suit(n, me)) return "Te suit";
  const m = ensemble.get(n);
  if (m) return `${m} ${pluriel(m, "match", "matchs")} ensemble`;
  return pseudo;
}

/** Ses abonnés, ses abonnements : chacun en petite carte, ceux que je connais d'abord, avec de quoi le suivre. */
function ListeSuivis({
  nom,
  ouvert,
  onglet,
  onOnglet,
  onFermer,
}: {
  nom: string;
  ouvert: boolean;
  onglet: Onglet;
  onOnglet: (o: Onglet) => void;
  onFermer: () => void;
}) {
  const s = useSuivis();
  const id = useIdentites();
  const { me } = useMyPlayer();
  const { saison } = useSeason();
  const proches = useProches();
  const ensemble = useMemo(() => (me ? partenaires(saison, me) : new Map<string, number>()), [saison, me]);
  const listes = { abonnes: s.abonnes(nom), abonnements: s.abonnements(nom) };
  const noms = proches(listes[onglet]).ordre;

  return (
    <Sheet open={ouvert} onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className="data-[side=bottom]:h-[80dvh] rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
        <div className="flex flex-col gap-1 px-5 pt-5">
          <SheetTitle className="titre-lettrage text-[24px] leading-[0.95] font-black">{id.nom(nom)}</SheetTitle>
          <SheetDescription className="font-mono text-[12px] text-muted-foreground">{id.pseudo(nom)}</SheetDescription>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
            {(
              [
                ["abonnes", pluriel(listes.abonnes.length, "abonné", "abonnés")],
                ["abonnements", pluriel(listes.abonnements.length, "abonnement", "abonnements")],
              ] as const
            ).map(([o, libelle]) => (
              <button
                key={o}
                type="button"
                onClick={() => onOnglet(o)}
                className={cn("py-2 text-[13.5px] font-semibold", onglet === o ? "bouton-principal" : "bouton-discret text-muted-foreground")}
              >
                <span className="tabular-nums">{listes[o].length}</span> {libelle}
              </button>
            ))}
          </div>
          <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 pb-2">
            {noms.map((n) => (
              <div key={n} className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5">
                <CarteDe name={n} size={FORMAT_CARTE.petite} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-semibold">
                    <Nom n={n} />
                  </span>
                  <span className="truncate font-mono text-[12px] text-muted-foreground">
                    {me ? lien(n, me, s, ensemble, id.pseudo(n)) : id.pseudo(n)}
                  </span>
                </span>
                <BoutonSuivre nom={n} petit />
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
