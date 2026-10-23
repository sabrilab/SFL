"use client";

// La discussion d'un match ouvert par un joueur, plein écran par-dessus la
// Map (Sabri, 22/10) : ceux du match s'y parlent — « Le match, il est où ? »,
// qui connaît quelqu'un de dispo — et chacun en est prévenu sur son
// téléphone (/api/matchs/discussion).
//
// Deux onglets en titre, Match et Équipe (Sabri, 22/10 : « discuter soit
// avec son match, soit son équipe »), comme Vestiaire et Agent : l'ouvert
// en blanc, l'autre en gris avec ses messages pas lus en rouge ; on passe de
// l'un à l'autre en le touchant. L'équipe, c'est celle du mode Team dont je
// suis membre (lib/sfl/discussion-equipe.ts) ; sans équipe, l'onglet mène à
// la page Team pour en créer une.
//
// C'est l'écran du Vestiaire (components/sfl/vestiaire.tsx, Discussion) :
// mêmes bulles, réponses, réactions, vocaux, photos. Sous les onglets, le
// match — où, quand, ce qu'il manque — ou le nom de l'équipe, et le retour à
// la Map. En tête du fil du match, les cartes de ceux qui jouent, celles des
// invités en retrait, et une place en braise pour chaque joueur qui manque ;
// en tête de celui de l'équipe, son écusson et les cartes de ses membres.
// Les arrivées (« Kader a rejoint le match ») sont des lignes du fil, gardées
// tant qu'elles disent vrai.
//
// S'ouvre depuis la bulle de messages du match sur la Map, depuis sa fiche,
// depuis la page Team, ou depuis une notification (/?match=12&discussion,
// /?discussion=equipe).
//
// L'écran est posé sur <body>, hors de la page (Sabri, 23/10 : « la barre de
// dialogue, elle est cachée ») : sur iPhone, la page défile dans un conteneur
// (#app-scroll, layout.tsx) dont WebKit fait une seule couche, sous la barre
// d'onglets ; l'écran restait dessous, et sa barre d'écriture juste derrière
// les onglets. Sur <body>, il passe au-dessus d'eux (z 45, onglets 40), sous
// les feuilles (z 50) : la carte d'un joueur touchée dans le fil s'ouvre
// par-dessus.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Discussion } from "@/components/sfl/vestiaire";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { Ecusson, EcussonVide } from "@/components/sfl/equipe/ecusson";
import { buttonVariants } from "@/components/ui/button";
import { useDiscussionsMatch } from "@/hooks/use-discussions-match";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { arriveesVisibles, salonDuMatch } from "@/lib/sfl/discussion-match";
import { DEMO_DISCUSSION, filDemo } from "@/lib/sfl/discussion-match-demo";
import { DEMO_DISCUSSION_EQUIPE, filDemoEquipe, salonDeLEquipe } from "@/lib/sfl/discussion-equipe";
import { signataires, type Equipe } from "@/lib/sfl/equipes";
import { aujourdhuiIso, placesLibres, type Partie } from "@/lib/sfl/matchs";
import { jourCourt } from "@/lib/sfl/jour-long";
import type { MessageV } from "@/lib/sfl/vestiaire";
import { cn } from "@/lib/utils";

const BRAISE = "#FF8A4C";
/** Au-delà, les places vides ne disent rien de plus que le nombre. */
const PLACES_MAX = 12;
/** La largeur d'une petite carte, arrondie au-dessus (les places vides l'ont pleine). */
const COTE = Math.ceil(254 * FORMAT_CARTE.petite);
/** L'écart entre deux cartes (gap-2). */
const ECART = 8;

/**
 * Les cartes en tête du fil, en rangées égales de six au plus : dix places
 * font cinq et cinq (avant : sept, puis trois seules dessous).
 */
function Rangees({ n, label, children }: { n: number; label: string; children: React.ReactNode }) {
  const par = n <= 0 ? 1 : Math.ceil(n / Math.ceil(n / 6));
  return (
    <div aria-label={label} className="mx-auto flex flex-wrap justify-center gap-2" style={{ maxWidth: par * COTE + (par - 1) * ECART }}>
      {children}
    </div>
  );
}

export type OngletDiscussion = "match" | "equipe";

export function DiscussionMatch({
  partie,
  moi,
  ongletInitial = "match",
  onFermer,
}: {
  /** Le match ; sans lui (une notification de l'équipe, rien à venir), l'équipe seule. */
  partie: Partie | null;
  moi: string | null;
  ongletInitial?: OngletDiscussion;
  onFermer: () => void;
}) {
  const { equipe, nonLus: nonLusEquipe, charge } = useMonEquipe();
  const { apercus } = useDiscussionsMatch();
  const [onglet, setOnglet] = useState<OngletDiscussion>(partie ? ongletInitial : "equipe");
  // L'écran glisse depuis la droite à l'ouverture ; passer d'un onglet à l'autre ne le refait pas.
  const [bascule, setBascule] = useState(false);
  const changer = useCallback((o: OngletDiscussion) => {
    navigator.vibrate?.(6);
    setOnglet(o);
    setBascule(true);
  }, []);

  // Échap ferme, sur ordinateur.
  useEffect(() => {
    const touche = (e: KeyboardEvent) => e.key === "Escape" && onFermer();
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [onFermer]);

  const surMatch = onglet === "match" && !!partie;
  const onglets = (
    <Onglets
      ouvert={surMatch ? "match" : "equipe"}
      avecMatch={!!partie}
      nonLus={{ match: partie ? (apercus.get(partie.id)?.nonLus ?? 0) : 0, equipe: nonLusEquipe }}
      onOnglet={changer}
    />
  );
  const className = bascule ? undefined : "discussion-entre";

  const ecran = surMatch ? (
    <FilDuMatch key={`m${partie.id}`} partie={partie} moi={moi} onglets={onglets} onFermer={onFermer} className={className} />
  ) : equipe ? (
    <FilDeLEquipe key={`e${equipe.id}`} equipe={equipe} moi={moi} onglets={onglets} onFermer={onFermer} className={className} />
  ) : (
    <SansEquipe charge={charge} onglets={onglets} onFermer={onFermer} className={className} />
  );
  // Ouverte d'un geste, jamais au premier rendu du serveur.
  return typeof document === "undefined" ? null : createPortal(ecran, document.body);
}

/* ------------------------------- En-tête -------------------------------- */

/** Match et Équipe, en grands titres : l'ouvert en blanc, l'autre en gris, ses non lus en rouge. */
function Onglets({
  ouvert,
  avecMatch,
  nonLus,
  onOnglet,
}: {
  ouvert: OngletDiscussion;
  avecMatch: boolean;
  nonLus: Record<OngletDiscussion, number>;
  onOnglet: (o: OngletDiscussion) => void;
}) {
  const liste: { id: OngletDiscussion; label: string }[] = [
    ...(avecMatch ? [{ id: "match" as const, label: "Match" }] : []),
    { id: "equipe", label: "Équipe" },
  ];
  const taille = "text-[clamp(24px,7vw,28px)] leading-tight font-bold tracking-tight";
  return (
    <nav aria-label="Discussion" className="flex min-w-0 items-baseline gap-3.5">
      {liste.map(({ id, label }) =>
        id === ouvert ? (
          <h1 key={id} className={taille}>
            {label}
          </h1>
        ) : (
          <button
            key={id}
            type="button"
            onClick={() => onOnglet(id)}
            aria-label={nonLus[id] > 0 ? `${label}, ${nonLus[id]} message${nonLus[id] > 1 ? "s" : ""} pas lu${nonLus[id] > 1 ? "s" : ""}` : label}
            className={cn("relative text-foreground/25 transition-colors active:text-foreground/45", taille)}
          >
            {label}
            {nonLus[id] > 0 && (
              <span
                aria-hidden
                className="absolute -top-1 -right-3.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] text-[11px] leading-none font-bold tracking-normal text-white tabular-nums"
                style={{ background: "#FF3B30", boxShadow: "0 0 0 2px var(--background)" }}
              >
                {nonLus[id] > 9 ? "9+" : nonLus[id]}
              </span>
            )}
          </button>
        )
      )}
    </nav>
  );
}

/** Le retour à la Map, puis les onglets. */
function EnTete({ onglets, onFermer }: { onglets: React.ReactNode; onFermer: () => void }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <button
        type="button"
        onClick={onFermer}
        aria-label="Revenir à la Map"
        className="bouton-secondaire flex size-11 shrink-0 items-center justify-center"
      >
        <ChevronLeft className="size-5" strokeWidth={2.4} />
      </button>
      <div className="min-w-0">{onglets}</div>
    </div>
  );
}

/**
 * Sous les onglets, ce qui est ouvert : de toute la largeur de l'en-tête,
 * cloche comprise, pour que « Il manque 7 » ne soit jamais coupé ; aligné
 * sur les onglets, après le retour (44 px) et son écart (12 px).
 */
function SousTitre({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 truncate pl-14 text-[12.5px] font-semibold text-foreground/50">{children}</p>;
}

/* --------------------------------- Match -------------------------------- */

function FilDuMatch({
  partie,
  moi,
  onglets,
  onFermer,
  className,
}: {
  partie: Partie;
  moi: string | null;
  onglets: React.ReactNode;
  onFermer: () => void;
  className?: string;
}) {
  const salon = useMemo(() => salonDuMatch(partie.id), [partie.id]);
  const manque = placesLibres(partie);

  // Les arrivées encore vraies : de qui est toujours du match.
  const dansLeMatch = useMemo(() => new Set([partie.organisateurId, ...partie.joueurs.map((j) => j.id)]), [partie]);
  const filtre = useCallback((ms: MessageV[]) => arriveesVisibles(ms, dansLeMatch), [dansLeMatch]);

  // Aperçus et développement : la base n'a pas encore la discussion des
  // matchs, un fil d'essai tiré des joueurs du match la remplace.
  const partieCourante = useRef(partie);
  useEffect(() => {
    partieCourante.current = partie;
  }, [partie]);
  const filEssai = useCallback(() => filDemo(partieCourante.current, moi), [moi]);

  // Qui joue : l'organisateur d'abord, puis les inscrits ; les invités après, en retrait.
  const orga = partie.joueurs.find((j) => j.id === partie.organisateurId);
  const jouent = [...(orga ? [orga] : []), ...partie.joueurs.filter((j) => j.statut === "inscrit" && j !== orga)];
  const invites = partie.joueurs.filter((j) => j.statut === "invite" && j !== orga);
  const places = Math.min(manque, PLACES_MAX);

  return (
    <Discussion
      salon={salon}
      className={className}
      libelleNotifs="Notifications de la discussion du match"
      vide="Personne n'a encore écrit."
      secours={DEMO_DISCUSSION ? filEssai : undefined}
      filtre={filtre}
      titre={<EnTete onglets={onglets} onFermer={onFermer} />}
      sousTitre={
        <SousTitre>
          {partie.lieu} · {jourCourt(partie.jour, aujourdhuiIso())} · {partie.heure} ·{" "}
          {manque > 0 ? <span style={{ color: BRAISE }}>Il manque {manque}</span> : "Complet"}
        </SousTitre>
      }
      tete={
        <div className="pt-5 pb-1">
          <Rangees n={jouent.length + invites.length + places} label="Les joueurs du match">
            {jouent.map((j) => (
              <CarteDe key={j.id} name={j.name} size={FORMAT_CARTE.petite} />
            ))}
            {invites.map((j) => (
              <span key={j.id} className="opacity-40">
                <CarteDe name={j.name} size={FORMAT_CARTE.petite} />
              </span>
            ))}
            {Array.from({ length: places }, (_, i) => (
              <span
                key={`vide-${i}`}
                aria-hidden
                className="shrink-0 border-[1.5px] border-dashed"
                style={{ width: COTE, height: COTE, borderRadius: COTE * 0.24, borderColor: `${BRAISE}99`, background: `${BRAISE}14` }}
              />
            ))}
          </Rangees>
        </div>
      }
    />
  );
}

/* -------------------------------- Équipe -------------------------------- */

function FilDeLEquipe({
  equipe,
  moi,
  onglets,
  onFermer,
  className,
}: {
  equipe: Equipe;
  moi: string | null;
  onglets: React.ReactNode;
  onFermer: () => void;
  className?: string;
}) {
  const salon = useMemo(() => salonDeLEquipe(equipe.id), [equipe.id]);

  // Aperçus et développement : la base n'a pas encore la discussion des
  // équipes, un fil d'essai tiré de ses membres la remplace.
  const equipeCourante = useRef(equipe);
  useEffect(() => {
    equipeCourante.current = equipe;
  }, [equipe]);
  const filEssai = useCallback(() => filDemoEquipe(equipeCourante.current, moi), [moi]);

  return (
    <Discussion
      salon={salon}
      className={className}
      libelleNotifs="Notifications de la discussion de l'équipe"
      vide="Personne n'a encore écrit."
      secours={DEMO_DISCUSSION_EQUIPE ? filEssai : undefined}
      titre={<EnTete onglets={onglets} onFermer={onFermer} />}
      sousTitre={<SousTitre>{[equipe.nom, equipe.ville].filter(Boolean).join(" · ")}</SousTitre>}
      tete={
        <div className="flex flex-col items-center gap-3 pt-5 pb-1">
          <Ecusson initiales={equipe.initiales} fond={equipe.fond} taille={44} />
          <Rangees n={signataires(equipe).length} label="Les joueurs de l'équipe">
            {signataires(equipe).map((m) => (
              <CarteDe key={m.id} name={m.name} size={FORMAT_CARTE.petite} />
            ))}
          </Rangees>
        </div>
      }
    />
  );
}

/** Pas encore d'équipe : sa place en pointillé, et de quoi en créer une. */
function SansEquipe({
  charge,
  onglets,
  onFermer,
  className,
}: {
  charge: boolean;
  onglets: React.ReactNode;
  onFermer: () => void;
  className?: string;
}) {
  return (
    <section
      data-ecran-fixe=""
      className={cn("fixed inset-x-0 top-0 z-[45] flex h-dvh flex-col bg-background", className)}
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <header className="mx-auto flex w-full max-w-[640px] shrink-0 items-center gap-3 px-5 pt-3 pb-2">
        <EnTete onglets={onglets} onFermer={onFermer} />
      </header>
      {charge && (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-8 pb-[14vh]">
          <EcussonVide taille={84} className="text-foreground/25" />
          <Link href="/bola-team" className={cn(buttonVariants({ variant: "vert" }), "h-12 rounded-full px-6 text-[15px] font-semibold")}>
            Créer mon équipe
          </Link>
        </div>
      )}
    </section>
  );
}
