"use client";

// Le trash talk dans les Actus (lib/sfl/trash-talk.ts ; Sabri, 12/11/2026) :
// chaque journée a son bloc, dans son fil (course.tsx : sous la convocation
// pour la journée qui vient, sous les vidéos pour un dimanche joué).
//   · l'en-tête : « Trash talk », le rang du visuel regardé (2/7), et
//     « Écrire » sur la journée du moment seulement ;
//   · les visuels, à faire glisser, le plus récent d'abord
//     (visuel-trash-talk.tsx) ; sous celui qu'on regarde, son auteur et son
//     âge, « Partager » si son image peut sortir de l'app, et « ⋯ » :
//     Signaler (tout membre), Masquer (un joueur cité, l'admin), Remettre
//     (l'admin), Retirer (l'auteur). Un post masqué ne reste visible que de
//     son auteur et de l'admin, éteint, sous l'étiquette « Masqué » ;
//   · écrire : une feuille, le vrai visuel qui se compose pendant la frappe,
//     Tweet ou La une, la phrase (180 caractères), « @ » pour citer un joueur
//     (un écran de la même fenêtre), Publier ;
//   · partager : deux images faites par le code, Story (1080 × 1920) et Post
//     (1080 × 1350), préparées à l'ouverture de la feuille pour que le geste
//     parte tout de suite (lib/sfl/image-a-partager.ts). Mon post, sans mon
//     accord hors-app : la ligne « Tu n'apparais pas dans les visuels. »
//     (video.tsx) à la place.
// Aucune notification, à personne. Sans les tables : en production, rien
// n'est monté ; ailleurs, mes posts restent sur ce téléphone.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AtSign, Ellipsis, PenLine, Share } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useJoueurBola } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useAccord } from "@/hooks/use-accord";
import { useIdentites } from "@/hooks/use-identites";
import { useSession } from "@/hooks/use-session";
import { accordValable } from "@/lib/sfl/confidentialite";
import { incrusterLesImages, partagerFichiers, prendreImage, prisesADoubler } from "@/lib/sfl/image-a-partager";
import { direErreur, listerProfils, type Profil } from "@/lib/sfl/matchs";
import { chercherTolerant } from "@/lib/sfl/recherche-tolerante";
import {
  citer,
  direRefus,
  gestesPossibles,
  ilYA,
  lireTrashTalks,
  LONGUEUR_PHRASE,
  longueurPhrase,
  masquerTrashTalk,
  nettoyerPhrase,
  nomDeFichier,
  phraseEnCours,
  postsDuFil,
  publierTrashTalk,
  remettreTrashTalk,
  retirerTrashTalk,
  signalerTrashTalk,
  type EtatTrashTalk,
  type FormatTrashTalk,
  type Geste,
  type TrashTalk,
} from "@/lib/sfl/trash-talk";
import { cn } from "@/lib/utils";
import { InvitationVisuels } from "./video";
import { CadreVisuel, HAUTEUR_VISUEL, LARGEUR_VISUEL, VisuelTrashTalk, type SujetVisuel } from "./visuel-trash-talk";

/* ------------------------------ Les données ------------------------------ */

export interface TrashTalks {
  etat: EtatTrashTalk;
  posts: TrashTalk[];
  moi: string | null;
  admin: boolean;
  /** Mon accord hors-app, tel que ce téléphone le connaît. */
  horsApp: boolean;
  saison: number;
  recharger: () => void;
}

/**
 * Les posts de la saison, lus à l'ouverture de l'onglet et après chaque
 * geste. null : rien à monter (pas connecté, compte en attente, joueur Bola
 * hors de la saison, ou tables absentes en production).
 */
export function useTrashTalks(): TrashTalks | null {
  const session = useSession();
  const bola = useJoueurBola();
  const { saison } = useSeason();
  const numero = saison.numero ?? 0;
  const nom = session?.server && !session.enAttente && !bola ? session.name : null;
  const admin = !!session?.admin;
  const { accord } = useAccord(nom);
  const horsApp = !!accord?.horsApp && !accord.enAttente && accordValable(accord.version);
  const [lu, setLu] = useState<{ etat: EtatTrashTalk; posts: TrashTalk[]; moi: string | null } | null>(null);
  const charger = useCallback(() => {
    if (!nom || numero <= 0) return;
    lireTrashTalks(numero, { admin, horsApp })
      .then(setLu)
      .catch(() => {});
  }, [nom, numero, admin, horsApp]);
  useEffect(() => {
    let vivant = true;
    Promise.resolve().then(() => vivant && charger());
    return () => {
      vivant = false;
    };
  }, [charger]);
  return useMemo(
    () => (nom && lu && lu.etat !== "absent" ? { ...lu, admin, horsApp, saison: numero, recharger: charger } : null),
    [nom, lu, admin, horsApp, numero, charger]
  );
}

const sujetDe = (p: TrashTalk): SujetVisuel => ({ format: p.format, texte: p.texte, nom: p.nom, pseudo: p.pseudo, j: p.j, match: p.match, at: p.at, id: p.id });

/* ------------------------------ Dans le fil ------------------------------ */

const LIBELLES: Record<Geste, string> = { signaler: "Signaler", masquer: "Masquer", remettre: "Remettre", retirer: "Retirer" };
const RETOURS: Record<Geste, string> = { signaler: "Signalé.", masquer: "Masqué.", remettre: "Remis.", retirer: "Retiré." };

/**
 * Le bloc d'une journée. `ecrire` : la journée du moment, et le numéro de mon
 * match ce jour-là s'il est connu. Sans post et sans écrire, rien.
 */
export function BlocTrashTalk({ tt, j, ecrire, className }: { tt: TrashTalks | null; j: number; ecrire?: { match: number | null } | null; className?: string }) {
  const identite = useIdentites();
  const piste = useRef<HTMLDivElement>(null);
  const [rang, setRang] = useState(0);
  const [saisie, setSaisie] = useState(false);
  const [menu, setMenu] = useState<TrashTalk | null>(null);
  const [partageId, setPartage] = useState<number | null>(null);
  const [maintenant] = useState(() => Date.now());
  const posts = useMemo(() => (tt ? postsDuFil(tt.posts, j, tt.moi, tt.admin) : []), [tt, j]);
  if (!tt || (!ecrire && posts.length === 0)) return null;
  const partage = partageId === null ? null : (posts.find((p) => p.id === partageId) ?? null);

  const vu = posts[Math.min(rang, posts.length - 1)] as TrashTalk | undefined;
  const suivre = () => {
    const el = piste.current;
    if (!el || !el.clientWidth) return;
    setRang(Math.min(posts.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const gestes = vu ? gestesPossibles(vu, tt.moi, tt.admin) : [];
  const mien = !!vu && vu.joueur === tt.moi;

  const faire = async (geste: Geste, p: TrashTalk) => {
    setMenu(null);
    try {
      if (geste === "retirer") await retirerTrashTalk(p.id, tt.etat === "demo");
      else if (geste === "signaler") await signalerTrashTalk(p.id);
      else if (geste === "masquer") await masquerTrashTalk(p.id);
      else await remettreTrashTalk(p.id);
      toast.success(RETOURS[geste]);
    } catch (e) {
      toast.error(direErreur(e));
    }
    tt.recharger();
  };

  return (
    <section aria-label={`Trash talk de la J${j}`} className={cn("flex flex-col", className)}>
      <div className="flex min-h-9 items-center gap-2 px-5 pb-2 md:px-0">
        <h3 className="mono-label text-encre-3">Trash talk</h3>
        {posts.length > 1 && (
          <span className="mono-label text-encre-4">
            {Math.min(rang, posts.length - 1) + 1}/{posts.length}
          </span>
        )}
        {ecrire && (
          <button type="button" onClick={() => setSaisie(true)} className="bouton-secondaire ml-auto flex h-9 items-center gap-1.5 px-3.5 text-corps font-semibold">
            <PenLine className="size-[15px]" strokeWidth={1.9} />
            Écrire
          </button>
        )}
      </div>

      {posts.length > 0 && (
        <>
          {/* Chaque visuel est un objet posé sur la page, comme une carte : ses marges, ses coins, un liseré. */}
          <div
            ref={piste}
            onScroll={suivre}
            aria-roledescription="carrousel"
            className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {posts.map((p) => (
              <div key={p.id} className="relative w-full shrink-0 snap-center px-5 md:px-0">
                <CadreVisuel sujet={sujetDe(p)} className={cn("rounded-[22px] ring-1 ring-foreground/10", p.masque && "opacity-30 grayscale")} />
                {p.masque && (
                  <span className="mono-label absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground px-3 py-1.5 text-background">Masqué</span>
                )}
              </div>
            ))}
          </div>
          {vu && (
            <div className="flex min-h-11 items-center gap-1 pt-1.5 pr-1.5 pl-5 md:pl-1">
              <p className="min-w-0 flex-1 truncate text-ligne">
                <span className="font-semibold">{identite.nom(vu.nom)}</span>
                <span className="text-encre-3"> · {ilYA(vu.at, maintenant)}</span>
              </p>
              {(vu.partageable || (mien && !tt.horsApp)) && !vu.masque && (
                <button type="button" aria-label="Partager" onClick={() => setPartage(vu.id)} className="bouton-discret bouton--mauve grid size-9 shrink-0 place-items-center">
                  <Share className="size-[18px]" strokeWidth={1.8} />
                </button>
              )}
              {gestes.length > 0 && (
                <button type="button" aria-label="Plus" onClick={() => setMenu(vu)} className="bouton-discret grid size-9 shrink-0 place-items-center">
                  <Ellipsis className="size-[20px]" strokeWidth={1.8} />
                </button>
              )}
            </div>
          )}
        </>
      )}

      <Sheet open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
        <SheetContent side="bottom" className="mx-auto w-full rounded-t-[28px] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:max-w-md">
          <SheetTitle className="sr-only">Trash talk</SheetTitle>
          <div className="flex flex-col gap-1.5 pt-14">
            {menu &&
              gestesPossibles(menu, tt.moi, tt.admin).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => void faire(g, menu)}
                  className={cn("flex h-[52px] items-center rounded-[18px] bg-card px-4 text-left text-lecture font-semibold transition-transform active:scale-[0.98]", g === "retirer" && "text-destructive")}
                >
                  {LIBELLES[g]}
                </button>
              ))}
          </div>
        </SheetContent>
      </Sheet>

      {ecrire && (
        <SaisieTrashTalk
          open={saisie}
          onOpenChange={setSaisie}
          tt={tt}
          j={j}
          match={ecrire.match}
          onPublie={() => {
            tt.recharger();
            piste.current?.scrollTo({ left: 0 });
            setRang(0);
          }}
        />
      )}
      {partage && <PartagerTrashTalk post={partage} tt={tt} onFermer={() => setPartage(null)} />}
    </section>
  );
}

/* ------------------------------ Écrire ------------------------------ */

const FORMATS: [FormatTrashTalk, string][] = [
  ["tweet", "Tweet"],
  ["une", "La une"],
];

function SaisieTrashTalk({
  open,
  onOpenChange,
  tt,
  j,
  match,
  onPublie,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tt: TrashTalks;
  j: number;
  match: number | null;
  onPublie: () => void;
}) {
  const session = useSession();
  const identite = useIdentites();
  const nom = session?.name ?? "";
  const pseudo = identite.pseudo(nom).replace(/^@/, "");
  const [format, setFormat] = useState<FormatTrashTalk>("tweet");
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [citation, setCitation] = useState(false);
  const champ = useRef<HTMLTextAreaElement>(null);
  const [maintenant, setMaintenant] = useState(() => Date.now());
  const propre = nettoyerPhrase(texte);
  const sujet: SujetVisuel = { format, texte: propre || "Ta phrase", eteint: !propre, nom, pseudo, j, match, at: maintenant, id: 0 };

  const ouvrir = (o: boolean) => {
    if (o) setMaintenant(Date.now());
    onOpenChange(o);
  };
  const publier = async () => {
    if (!propre || envoi) return;
    setEnvoi(true);
    try {
      await publierTrashTalk({ saison: tt.saison, j, match, format, texte: propre }, tt.etat === "demo", { nom, pseudo });
      toast.success("C'est publié.");
      setTexte("");
      onOpenChange(false);
      onPublie();
    } catch (e) {
      toast.error(direRefus(e) ?? direErreur(e));
    }
    setEnvoi(false);
  };

  return (
    <Sheet open={open} onOpenChange={ouvrir} titre="Trash talk">
      <SheetContent side="bottom" className="mx-auto max-h-[94dvh] w-full gap-3 overflow-y-auto rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:max-w-md">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">Trash talk</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-3 px-4">
          <CadreVisuel sujet={sujet} className="mx-auto w-[min(62vw,34dvh,248px)] rounded-[14px] shadow-[0_8px_30px_rgba(0,0,0,0.22)] ring-1 ring-foreground/10" />
          <div role="tablist" aria-label="Le visuel" className="flex gap-1 rounded-full bg-secondary p-1">
            {FORMATS.map(([id, libelle]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={format === id}
                onClick={() => setFormat(id)}
                className={cn("h-9 flex-1 rounded-full text-corps font-semibold transition-colors", format === id ? "bg-foreground text-background" : "text-encre-2")}
              >
                {libelle}
              </button>
            ))}
          </div>
          <div className="rounded-[18px] bg-card px-3.5 pt-3 pb-2 ring-1 ring-foreground/[0.08]">
            <textarea
              ref={champ}
              value={texte}
              onChange={(e) => setTexte(phraseEnCours(e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
              placeholder="Ta phrase"
              aria-label="Ta phrase"
              rows={3}
              enterKeyHint="done"
              className="block w-full resize-none bg-transparent text-[16px] leading-snug outline-none placeholder:text-encre-4"
            />
            <div className="flex items-center justify-between">
              <button type="button" aria-label="Citer un joueur" onClick={() => setCitation(true)} className="bouton-discret -ml-2 grid size-9 place-items-center">
                <AtSign className="size-[18px]" strokeWidth={1.9} />
              </button>
              <span className="mono-label text-encre-3">
                {longueurPhrase(texte.trimEnd())}/{LONGUEUR_PHRASE}
              </span>
            </div>
          </div>
          <button type="button" disabled={!propre || envoi} onClick={() => void publier()} className="bouton-principal h-12 w-full text-lecture font-semibold disabled:opacity-40">
            Publier
          </button>
        </div>
        <CiterUnJoueur
          open={citation}
          onOpenChange={setCitation}
          sauf={nom}
          onChoisir={(p) => {
            setTexte((t) => phraseEnCours(citer(t, p.username)));
            setCitation(false);
            setTimeout(() => champ.current?.focus(), 350);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

/** « Citer un joueur » : un écran de la fenêtre de saisie ; la recherche tolérante, une ligne par joueur en petite carte. */
function CiterUnJoueur({ open, onOpenChange, sauf, onChoisir }: { open: boolean; onOpenChange: (o: boolean) => void; sauf: string; onChoisir: (p: Profil) => void }) {
  const identite = useIdentites();
  const [profils, setProfils] = useState<Profil[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (!open || profils.length) return;
    let vivant = true;
    listerProfils()
      .then((l) => vivant && setProfils(l))
      .catch(() => {});
    return () => {
      vivant = false;
    };
  }, [open, profils.length]);
  const lignes = useMemo(
    () =>
      chercherTolerant(
        profils.filter((p) => p.name !== sauf),
        (p) => [p.name, identite.nom(p.name), p.username.replace(/^@/, "")],
        q.replace(/^@/, "")
      ).slice(0, 40),
    [profils, sauf, q, identite]
  );
  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) setQ("");
        onOpenChange(o);
      }}
    >
      <SheetContent side="bottom" className="mx-auto w-full rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] data-[side=bottom]:h-[80dvh] sm:max-w-md">
        <SheetHeader className="px-5 pt-1 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">Citer un joueur</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom ou identifiant" autoCapitalize="none" autoCorrect="off" className="h-10" />
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pb-2">
            {lignes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onChoisir(p)}
                className="flex items-center gap-3 rounded-[18px] bg-card px-3 py-2.5 text-left transition-transform active:scale-[0.98]"
              >
                <CarteDe name={p.name} size={FORMAT_CARTE.petite} inerte />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-lecture font-semibold">{identite.nom(p.name)}</span>
                  <span className="truncate text-petit text-encre-3">@{p.username.replace(/^@/, "")}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ------------------------------ Partager ------------------------------ */

const IMAGES = [
  { gabarit: "story", libelle: "Story" },
  { gabarit: "post", libelle: "Post" },
] as const;

/**
 * La feuille « Partager » : les deux images, préparées dès qu'elle s'ouvre ;
 * en toucher une ouvre la feuille de partage du téléphone avec le fichier
 * seul. Mon post, sans mon accord hors-app : la ligne qui le fait signer.
 */
function PartagerTrashTalk({ post, tt, onFermer }: { post: TrashTalk; tt: TrashTalks; onFermer: () => void }) {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [fichiers, setFichiers] = useState<File[] | null>(null);
  const sujet = useMemo(() => sujetDe(post), [post]);
  const pret = post.partageable;
  const { recharger } = tt;

  // Mon accord signé ici même : on relit, le post devient partageable.
  const signe = tt.horsApp;
  useEffect(() => {
    if (!pret && signe) recharger();
  }, [pret, signe, recharger]);

  useEffect(() => {
    if (!pret) return;
    let annule = false;
    const minuteur = setTimeout(async () => {
      const noeuds = refs.current.slice(0, IMAGES.length);
      if (noeuds.some((n) => !n)) return;
      try {
        await document.fonts?.ready;
        const prendreTout = async () => {
          const pris: File[] = [];
          for (const [i, noeud] of noeuds.entries()) {
            await incrusterLesImages(noeud!);
            const { gabarit } = IMAGES[i];
            // 360 points de large, trois pixels chacun : 1080 × 1920 et 1080 × 1350.
            const blob = await prendreImage(noeud!, { largeur: LARGEUR_VISUEL, hauteur: HAUTEUR_VISUEL[gabarit], ratio: 3, annule: () => annule });
            if (annule || !blob) return;
            pris.push(new File([blob], nomDeFichier(post.j, gabarit), { type: "image/png" }));
          }
          if (!annule) setFichiers(pris);
        };
        await prendreTout();
        if (!annule && prisesADoubler()) await prendreTout();
      } catch {
        // Pas d'image : les tuiles restent éteintes.
      }
    }, 500);
    return () => {
      annule = true;
      clearTimeout(minuteur);
    };
  }, [pret, post.j, sujet]);

  const partager = async (i: number) => {
    const f = fichiers?.[i];
    if (!f) return;
    if ((await partagerFichiers([f])) === "impossible") toast.error("Le partage n'a pas pu s'ouvrir.");
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onFermer()}>
      <SheetContent side="bottom" className="mx-auto w-full gap-3 rounded-t-[28px] pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:max-w-md">
        <SheetHeader className="px-5 pt-5 pb-0">
          <SheetTitle className="text-titre-g font-bold tracking-tight">Partager</SheetTitle>
        </SheetHeader>
        {pret ? (
          <div className="flex items-end justify-center gap-4 px-5">
            {IMAGES.map(({ gabarit, libelle }, i) => (
              <button
                key={gabarit}
                type="button"
                aria-label={libelle}
                disabled={!fichiers}
                onClick={() => void partager(i)}
                className="flex min-w-0 flex-1 flex-col items-center gap-2 transition-transform active:scale-[0.98] disabled:opacity-50"
              >
                <CadreVisuel sujet={sujet} gabarit={gabarit} className="w-full rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.22)] ring-1 ring-foreground/10" />
                <span className="text-corps font-semibold">{libelle}</span>
              </button>
            ))}
          </div>
        ) : (
          <InvitationVisuels />
        )}
        {/* Les images, dessinées hors écran à leur taille de dessin, puis photographiées. */}
        {pret && (
          <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -10000 }}>
            {IMAGES.map(({ gabarit }, i) => (
              <div
                key={gabarit}
                ref={(n) => {
                  refs.current[i] = n;
                }}
              >
                <VisuelTrashTalk sujet={sujet} gabarit={gabarit} />
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
