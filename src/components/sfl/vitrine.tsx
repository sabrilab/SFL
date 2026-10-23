"use client";

// Les badges du joueur, dans Ma carte. Deux familles, qui n'ont pas la même
// valeur :
//
// 1. Les trophées de fin de saison (fin-de-saison.ts) : de vrais trophées,
//    pas des icônes (Sabri, 22/10), dessinés d'après sa planche « Tous les
//    trophées & médailles » (objets.ts). Les trois premiers du Pépite d'Or
//    et des classements buteur, passeur, défensive et MVP (or, argent,
//    bronze), la médaille des quinze premiers du Pépite d'Or et le trophée du
//    joueur engagé (plus d'un match dans la saison). Ils sont rangés saison
//    par saison, sur une étagère ; la saison en cours montre en verre ce qui
//    est en jeu, avec le rang du moment. « Comment les gagner » ouvre la
//    liste de tous les trophées.
// 2. Paliers (trophees.ts) : gagnés au fil des dimanches, sur deux lignes
//    (buts, passes, matchs, victoires ; MVP, Le Mur, Impact). Quatre paliers
//    pour tous : bronze, argent, or, puis rouge et or.
//
// Chaque badge est un objet de foot en 3D (badge-3d.tsx) : l'objet dit ce
// qu'il récompense, le métal dit le niveau, et le niveau est toujours écrit
// en toutes lettres : on n'a pas besoin de distinguer les couleurs pour lire
// un badge. Le rang du moment (rond creux) s'écrit en entier sous le Pépite
// d'Or, en abrégé sous les quatre autres. Pas encore gagné, l'objet est en
// verre dépoli. Toucher un badge ouvre sa feuille : l'objet y tourne en
// vraie 3D, avec ses paliers ou ses podiums.
//
// NouveauxBadges, monté une fois dans la mise en page, annonce chaque palier
// gagné depuis la dernière visite.

import { useEffect, useMemo, useState } from "react";
import { Check, Crown } from "lucide-react";
import { EMBLEMES, EMBLEMES_SAISON } from "@/components/sfl/emblemes";
import { Objet3D, Objet3DVivant, OBJET_PALIER, OBJET_SAISON, PastilleRang, TROPHEE_SAISON } from "@/components/sfl/badge-3d";
import type { Objet } from "@/lib/sfl/badges-3d/objets";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useSession } from "@/hooks/use-session";
import {
  finsDeSaison,
  ordinal,
  podiumsDe,
  TOP_MEDAILLE,
  tropheesParSaison,
  type ClassementId,
  type EtatClassement,
  type TropheesDeSaison,
} from "@/lib/sfl/fin-de-saison";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useCardViewer } from "@/components/sfl/card-viewer";
import { usePlayerPhoto } from "@/hooks/use-player-photo";
import {
  clesGagnees,
  detenteurs,
  metal,
  METAUX,
  NOM_METAL,
  prochain,
  quantite,
  TROPHEES,
  vitrine,
  type EtatTrophee,
  type Metal,
  type TropheeId,
} from "@/lib/sfl/trophees";
import { cn } from "@/lib/utils";
import { Nom } from "@/components/sfl/nom";

/** Les métaux : le dégradé, l'encre gravée dessus, le listel du bord. */
const METAL: Record<Metal, { stops: [string, string, string]; encre: string; listel: string; trait: string }> = {
  bronze: { stops: ["#f0b98a", "#b06a35", "#6b3815"], encre: "#2a1608", listel: "#f0b98a", trait: "#c27a43" },
  argent: { stops: ["#ffffff", "#c3c6ca", "#868a90"], encre: "#15171a", listel: "#ffffff", trait: "#9da1a7" },
  or: { stops: ["#fff2b8", "#e2b13c", "#94640f"], encre: "#2b1d02", listel: "#fff2b8", trait: "#d9a531" },
  legende: { stops: ["#d8473a", "#8a1212", "#420707"], encre: "#f6d77a", listel: "#e2b13c", trait: "#c4352b" },
};

const fond = (m: Metal) => {
  const [a, b, c] = METAL[m].stops;
  return `linear-gradient(150deg, ${a} 0%, ${b} 50%, ${c} 100%)`;
};

/** Le rang d'un podium en métal : 1er or, 2e argent, 3e bronze. */
const METAL_RANG: Record<number, Metal> = { 1: "or", 2: "argent", 3: "bronze" };

/* -------------------------------- Médaille -------------------------------- */

/**
 * Un badge de palier : son objet en 3D, dans le métal du palier atteint
 * (badge-3d.tsx). palier 0 = pas encore gagné : l'objet en verre dépoli, et
 * un arc autour montre le chemin vers le bronze.
 */
export function Medaille({ e, diametre = 60, vivant = false }: { e: EtatTrophee; diametre?: number; vivant?: boolean }) {
  const d = diametre;
  const m = metal(e.palier);
  const props = { objet: OBJET_PALIER[e.def.id], matiere: m ?? ("fantome" as const), taille: d, embleme: EMBLEMES[e.def.id] };
  const r = d / 2 - 1.5;
  const tour = 2 * Math.PI * r;
  return (
    <span className="relative block shrink-0" style={{ width: d, height: d }}>
      {!m && e.progression > 0 && (
        <svg className="absolute inset-0 -rotate-90" width={d} height={d} aria-hidden>
          <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={2} />
          <circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke={METAL.bronze.trait}
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray={`${tour * e.progression} ${tour}`}
          />
        </svg>
      )}
      <span className={cn("absolute inset-0", !m && "opacity-80")} style={!m ? { transform: "scale(0.78)" } : undefined}>
        {vivant ? <Objet3DVivant {...props} /> : <Objet3D {...props} aura={!!m} />}
      </span>
    </span>
  );
}

/* -------------------------------- Écusson -------------------------------- */

/**
 * Un badge de fin de saison : son objet en 3D, dans le métal du meilleur rang
 * (1er or, 2e argent, 3e bronze), et ce rang gravé sur une pastille.
 * rang null = jamais sur le podium : l'objet en verre dépoli.
 */
export function Ecusson({ id, rang, largeur = 58, vivant = false }: { id: ClassementId; rang: number | null; largeur?: number; vivant?: boolean }) {
  const w = largeur;
  const m = rang ? METAL_RANG[rang] : null;
  const props = { objet: OBJET_SAISON[id], matiere: m ?? ("fantome" as const), taille: w, embleme: EMBLEMES_SAISON[id] };
  return (
    <span className="relative block shrink-0" style={{ width: w, height: w }}>
      <span className={cn("absolute inset-0", !m && "opacity-80")} style={!m ? { transform: "scale(0.78)" } : undefined}>
        {vivant ? <Objet3DVivant {...props} /> : <Objet3D {...props} aura={!!m} />}
      </span>
      {rang && (
        <span className="pointer-events-none absolute" style={{ right: -w * 0.04, bottom: -w * 0.02 }}>
          <PastilleRang rang={rang} taille={w * 0.38} />
        </span>
      )}
    </span>
  );
}

const sousTitre = (e: EtatClassement) => (e.meilleur ? `${ordinal(e.meilleur.rang)} · ${e.meilleur.saison}` : "Pas encore");

/* -------------------------------- Trophées -------------------------------- */

/** Le nom d'un trophée de fin de saison, comme sur sa plaque. */
export const NOM_TROPHEE: Record<ClassementId, string> = {
  pepite: "Pépite d'Or",
  buteur: "Meilleur buteur",
  passeur: "Meilleur passeur",
  mvp: "MVP",
  defenseur: "Défensive",
};

/**
 * Un trophée de fin de saison : la vraie pièce en 3D (objets.ts), dans le
 * métal du rang (1er or, 2e argent, 3e bronze). rang null = pas encore
 * gagné : en verre.
 */
export function Trophee({ id, rang, taille = 96, vivant = false }: { id: ClassementId; rang: number | null; taille?: number; vivant?: boolean }) {
  const m = rang ? METAL_RANG[rang] : null;
  const props = { objet: TROPHEE_SAISON[id], matiere: m ?? ("fantome" as const), taille, embleme: EMBLEMES_SAISON[id] };
  if (vivant || !m) {
    return (
      <span className="relative block shrink-0" style={{ width: taille, height: taille }}>
        {vivant ? <Objet3DVivant {...props} /> : <Objet3D {...props} />}
      </span>
    );
  }
  return (
    <Scintille taille={taille} decalage={ORDRE_TROPHEE.indexOf(id) * 0.9}>
      <Objet3D {...props} aura />
    </Scintille>
  );
}

const ORDRE_TROPHEE: ClassementId[] = ["pepite", "buteur", "passeur", "mvp", "defenseur"];

/** Les éclats d'une vitrine : trois petites étoiles à quatre branches qui scintillent tour à tour autour d'un trophée gagné. */
const ECLATS: { x: number; y: number; t: number; d: number }[] = [
  { x: 0.2, y: 0.18, t: 0.13, d: 0 },
  { x: 0.78, y: 0.32, t: 0.1, d: 1.5 },
  { x: 0.3, y: 0.58, t: 0.08, d: 3.1 },
];

function Scintille({ taille, decalage, children }: { taille: number; decalage: number; children: React.ReactNode }) {
  return (
    <span className="relative block" style={{ width: taille, height: taille, ["--decalage" as string]: `${-decalage}s` }}>
      <span className="trophee-flotte absolute inset-0">{children}</span>
      {ECLATS.map((e, i) => (
        <svg
          key={i}
          aria-hidden
          viewBox="0 0 20 20"
          className="trophee-eclat pointer-events-none absolute"
          style={{
            left: taille * e.x,
            top: taille * e.y,
            width: taille * e.t,
            height: taille * e.t,
            animationDelay: `${e.d - decalage}s`,
            filter: "drop-shadow(0 0 3px rgba(255,255,255,0.9))",
          }}
        >
          <path d="M10 0 C10.8 7 13 9.2 20 10 C13 10.8 10.8 13 10 20 C9.2 13 7 10.8 0 10 C7 9.2 9.2 7 10 0 Z" fill="#fff" />
        </svg>
      ))}
    </span>
  );
}

/** Un trophée hors classement (joueur engagé, but d'exception), en or. */
function TropheeObjet({ objet, taille, gagne = true }: { objet: Objet; taille: number; gagne?: boolean }) {
  return (
    <span className={cn("relative block shrink-0", !gagne && "opacity-70")} style={{ width: taille, height: taille }}>
      {gagne ? (
        <Scintille taille={taille} decalage={2.3}>
          <Objet3D objet={objet} matiere="or" taille={taille} embleme={Crown} aura />
        </Scintille>
      ) : (
        <Objet3D objet={objet} matiere="fantome" taille={taille} embleme={Crown} />
      )}
    </span>
  );
}

/**
 * La médaille du Top 15, comme sur la planche : un disque noir mat cerclé
 * d'or, « TOP » et le rang gravés en or, le ruban noir au-dessus.
 */
export function MedailleTop({ rang, taille = 64, gagnee = true }: { rang: number; taille?: number; gagnee?: boolean }) {
  const id = `top${rang}-${taille}`;
  return (
    <svg viewBox="0 0 100 130" width={taille} height={taille * 1.3} aria-hidden className={cn("shrink-0", !gagnee && "opacity-45")}>
      <defs>
        <linearGradient id={`${id}-or`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={gagnee ? "#f7e3a6" : "#e6e8ec"} />
          <stop offset="45%" stopColor={gagnee ? "#b8862b" : "#7d838c"} />
          <stop offset="70%" stopColor={gagnee ? "#f3d48a" : "#d6d9de"} />
          <stop offset="100%" stopColor={gagnee ? "#8a6416" : "#5d636b"} />
        </linearGradient>
        <radialGradient id={`${id}-fond`} cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#26262a" />
          <stop offset="100%" stopColor="#09090a" />
        </radialGradient>
      </defs>
      {/* Le ruban */}
      <path d="M36 0 H64 L60 38 H40 Z" fill="#111113" />
      <path d="M36 0 H64 L60 38 H40 Z" fill="none" stroke="rgba(255,255,255,0.08)" />
      <rect x="44" y="34" width="12" height="8" rx="2" fill={`url(#${id}-or)`} />
      {/* Le disque */}
      <circle cx="50" cy="84" r="44" fill={`url(#${id}-or)`} />
      <circle cx="50" cy="84" r="38.5" fill={`url(#${id}-fond)`} />
      <circle cx="50" cy="84" r="35" fill="none" stroke={`url(#${id}-or)`} strokeWidth="0.8" opacity="0.7" />
      <text x="50" y="66" textAnchor="middle" fill={`url(#${id}-or)`} style={{ fontFamily: "var(--font-anton), Anton, sans-serif", fontSize: 11, letterSpacing: 1.5 }}>
        TOP
      </text>
      <text x="50" y="104" textAnchor="middle" fill={`url(#${id}-or)`} style={{ fontFamily: "var(--font-anton), Anton, sans-serif", fontSize: rang > 9 ? 36 : 40 }}>
        {rang}
      </text>
    </svg>
  );
}

/** Un trophée sur l'étagère : la pièce, puis son nom et son rang. */
function SurEtagere({ children, nom, detail, onOpen, label }: { children: React.ReactNode; nom: string; detail?: string; onOpen?: () => void; label: string }) {
  const corps = (
    <>
      <span className="relative flex h-[100px] w-full items-end justify-center pb-1.5">
        {children}
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-white/20" />
      </span>
      <span className="mt-1.5 w-full text-[12px] leading-tight font-bold">{nom}</span>
      {detail && <span className="text-[11px] leading-tight text-white/60">{detail}</span>}
    </>
  );
  return onOpen ? (
    <button type="button" onClick={onOpen} aria-label={label} className="flex min-w-0 flex-col items-center self-start text-center transition-transform active:scale-95 motion-reduce:transition-none">
      {corps}
    </button>
  ) : (
    <div role="img" aria-label={label} className="flex min-w-0 flex-col items-center self-start text-center">
      {corps}
    </div>
  );
}

/** L'étagère : quatre trophées par rang, chaque rang posé sur une ligne de lumière, comme une vitrine. */
function Etagere({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-4 items-end gap-y-4">{children}</div>;
}

/** Une saison close, sur son étagère : ses trophées, sa médaille, son trophée d'engagé. */
function SaisonEnVitrine({ s, onOpen }: { s: TropheesDeSaison; onOpen: (id: ClassementId) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono-label text-[11px] text-white/55">{s.saison}</span>
      <Etagere>
        {s.podiums.map((p) => (
          <SurEtagere
            key={p.id}
            nom={NOM_TROPHEE[p.id]}
            detail={ordinal(p.rang)}
            onOpen={() => onOpen(p.id)}
            label={`${NOM_TROPHEE[p.id]}, ${ordinal(p.rang)}, ${s.saison}`}
          >
            <Trophee id={p.id} rang={p.rang} taille={p.id === "pepite" ? 94 : 86} />
          </SurEtagere>
        ))}
        {s.top && (
          <SurEtagere nom="Top 15" detail={ordinal(s.top)} label={`Médaille du Top 15, ${ordinal(s.top)} du Pépite d'Or, ${s.saison}`}>
            <MedailleTop rang={s.top} taille={58} />
          </SurEtagere>
        )}
        {s.engage && (
          <SurEtagere nom="Joueur engagé" label={`Trophée du joueur engagé, ${s.saison}`}>
            <TropheeObjet objet="coupe-engage" taille={84} />
          </SurEtagere>
        )}
      </Etagere>
    </div>
  );
}

/** « Comment les gagner » : tous les trophées d'une saison, et ce qui les donne. */
function FeuilleTrophees() {
  const lignes: { piece: React.ReactNode; nom: string; regle: string; bientot?: boolean }[] = [
    { piece: <Trophee id="pepite" rang={1} taille={64} />, nom: "Pépite d'Or", regle: "Les trois premiers du classement Pépite d'Or à la fin de la saison : or, argent, bronze." },
    { piece: <Trophee id="buteur" rang={1} taille={64} />, nom: "Meilleur buteur", regle: "Les trois joueurs qui ont marqué le plus de buts dans la saison." },
    { piece: <Trophee id="passeur" rang={1} taille={64} />, nom: "Meilleur passeur", regle: "Les trois joueurs qui ont fait le plus de passes décisives." },
    { piece: <Trophee id="mvp" rang={1} taille={64} />, nom: "MVP", regle: "Les trois joueurs élus le plus souvent meilleur joueur du match." },
    { piece: <Trophee id="defenseur" rang={1} taille={64} />, nom: "Défensive", regle: "Les trois joueurs élus le plus souvent meilleur défenseur du match." },
    { piece: <TropheeObjet objet="coupe-but" taille={64} />, nom: "But d'exception", regle: "Le plus beau but de la saison.", bientot: true },
    { piece: <MedailleTop rang={1} taille={44} />, nom: `Médaille Top ${TOP_MEDAILLE}`, regle: `Les ${TOP_MEDAILLE} premiers du Pépite d'Or, leur rang gravé dessus.` },
    { piece: <TropheeObjet objet="coupe-engage" taille={64} />, nom: "Joueur engagé", regle: "Pour tous les joueurs qui ont disputé plus d'un match dans la saison." },
  ];
  return (
    <div className="flex flex-col gap-4">
      <div>
        <SheetTitle className="text-[22px] font-extrabold tracking-tight">Les trophées</SheetTitle>
        <SheetDescription className="mt-1 text-[15px] text-foreground/75">Remis à la fin de chaque saison, gardés pour toujours.</SheetDescription>
      </div>
      <ul className="flex flex-col gap-2">
        {lignes.map((l) => (
          <li key={l.nom} className="flex items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] px-3 py-2.5">
            <span className="flex w-16 shrink-0 justify-center">{l.piece}</span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold">{l.nom}</span>
                {l.bientot && <span className="mono-label text-[10px] text-foreground/55">Bientôt</span>}
              </span>
              <span className="mt-0.5 block text-[13px] leading-snug text-foreground/70">{l.regle}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * La vitrine des trophées, sur un panneau noir mat comme la planche : saison
 * close par saison close, puis ce qui est en jeu dans la saison en cours.
 */
export function VitrineTrophees({ nom, enJeu = true }: { nom: string; enJeu?: boolean }) {
  const { saison, allPlayers } = useSeason();
  const saisons = useMemo(() => tropheesParSaison(saison, nom), [saison, nom]);
  const fins = useMemo(() => finsDeSaison(saison, nom, allPlayers), [saison, nom, allPlayers]);
  const [ouvert, setOuvert] = useState<ClassementId | "regles" | null>(null);
  const courants = fins.filter((e) => e.enCours);
  const total = saisons.reduce((n, s) => n + s.podiums.length + (s.top ? 1 : 0) + (s.engage ? 1 : 0), 0);
  const detail = ouvert && ouvert !== "regles" ? fins.find((e) => e.def.id === ouvert) ?? null : null;

  if (!enJeu && !saisons.length) return null;

  return (
    <section aria-labelledby="trophees-saison" className="flex flex-col gap-[18px] rounded-[26px] border border-white/[0.08] bg-[#0a0a0b] px-4 pt-[18px] pb-4 text-white">
      <div className="flex items-baseline justify-between">
        <h2 id="trophees-saison" className="text-[19px] font-extrabold tracking-tight">
          Trophées
          {total > 0 && <span className="ml-2 font-mono text-[12px] font-bold text-white/45 tabular-nums">{total}</span>}
        </h2>
        <button type="button" onClick={() => setOuvert("regles")} className="bouton-discret bouton--or -mr-2 px-2 py-1 text-[13px] font-semibold">
          Comment les gagner
        </button>
      </div>

      {saisons.map((s) => (
        <SaisonEnVitrine key={s.saison} s={s} onOpen={setOuvert} />
      ))}

      {enJeu && courants.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="mono-label text-[11px] text-white/55">En jeu · ton rang du moment</span>
          <Etagere>
            {courants.map((e) => (
              <SurEtagere
                key={e.def.id}
                nom={NOM_TROPHEE[e.def.id]}
                detail={ordinal(e.enCours!.rang)}
                onOpen={() => setOuvert(e.def.id)}
                label={`${NOM_TROPHEE[e.def.id]}, ${ordinal(e.enCours!.rang)} en ce moment`}
              >
                <Trophee id={e.def.id} rang={null} taille={e.def.id === "pepite" ? 84 : 76} />
              </SurEtagere>
            ))}
          </Etagere>
        </div>
      )}

      <Sheet open={!!ouvert} onOpenChange={(o) => !o && setOuvert(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          {ouvert === "regles" && <FeuilleTrophees />}
          {detail && <FeuilleSaison e={detail} moi={nom} />}
        </SheetContent>
      </Sheet>
    </section>
  );
}

/* --------------------------------- Vitrine -------------------------------- */

type Choix = { famille: "palier"; id: TropheeId } | null;

/** Les badges du joueur connecté, pour Ma carte. */
export function VitrineBadges({ nom }: { nom: string }) {
  const { saison } = useSeason();
  const paliers = useMemo(() => vitrine(saison, nom, new Date()), [saison, nom]);
  const [choix, setChoix] = useState<Choix>(null);
  const suivant = prochain(paliers);
  const gagnes = paliers.filter((e) => e.palier > 0).length;

  const detailPalier = choix?.famille === "palier" ? paliers.find((e) => e.def.id === choix.id) ?? null : null;

  return (
    <div className="flex flex-col gap-[18px]">
      {suivant && <ProchainBadge e={suivant} onOpen={() => setChoix({ famille: "palier", id: suivant.def.id })} />}

      {/* 1. Les trophées de fin de saison */}
      <VitrineTrophees nom={nom} />

      {/* 2. Paliers : la médaille ronde */}
      <section aria-labelledby="paliers" className="glass rounded-[26px] px-2.5 pt-[18px] pb-5">
        <div className="mb-4 flex items-baseline justify-between px-2">
          <h2 id="paliers" className="text-[19px] font-extrabold tracking-tight">
            Paliers
          </h2>
          <span className="font-mono text-[12px] font-bold text-foreground/65 tabular-nums">
            {gagnes} / {TROPHEES.length}
          </span>
        </div>
        {/* Deux lignes : ce qu'on compte (buts, passes, matchs, victoires), puis ce qu'on vote (MVP, Le Mur, Impact). */}
        {[paliers.slice(0, 4), paliers.slice(4)].map((ligne, i) => (
          <div key={i} className={cn("grid gap-x-1", ligne.length === 4 ? "grid-cols-4" : "grid-cols-3", i > 0 && "mt-5 border-t border-foreground/[0.08] pt-5")}>
            {ligne.map((e) => {
              const m = metal(e.palier);
              return (
                <button
                  key={e.def.id}
                  type="button"
                  onClick={() => setChoix({ famille: "palier", id: e.def.id })}
                  aria-label={`${e.def.nom}, ${m ? `palier ${NOM_METAL[m].toLowerCase()}` : "pas encore gagné"}, ${quantite(e.def, e.valeur)}${e.cible != null ? `, prochain à ${e.cible}` : ""}`}
                  className="flex flex-col items-center gap-1.5 text-center transition-transform active:scale-95 motion-reduce:transition-none"
                >
                  <Medaille e={e} diametre={56} />
                  <span className="w-full text-[12px] leading-tight font-bold">{e.def.nom}</span>
                  <span className="font-mono text-[12px] font-bold tabular-nums">
                    {e.cible != null ? `${e.valeur}/${e.cible}` : e.valeur}
                  </span>
                  <span className="text-[11px] font-semibold text-foreground/70">{m ? NOM_METAL[m] : "À gagner"}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      <Sheet open={!!choix} onOpenChange={(o) => !o && setChoix(null)}>
        <SheetContent side="bottom" className="mx-auto max-h-[90vh] w-full overflow-y-auto rounded-t-[28px] px-5 pt-6 pb-8 sm:max-w-md">
          {detailPalier && <FeuillePalier e={detailPalier} moi={nom} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Le badge le plus proche : la seule chose à viser dimanche. */
function ProchainBadge({ e, onOpen }: { e: EtatTrophee; onOpen: () => void }) {
  const cible = metal(e.palier + 1)!;
  const base = e.palier ? e.def.paliers[e.palier - 1] : 0;
  const reste = e.cible! - e.valeur;
  const Embleme = EMBLEMES[e.def.id];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Prochain badge : ${e.def.nom} ${NOM_METAL[cible].toLowerCase()}, ${e.valeur} sur ${e.cible}, plus que ${reste}`}
      className="glass flex w-full items-center gap-3.5 rounded-[24px] px-[18px] py-4 text-left"
    >
      <span
        className="relative flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-dashed"
        style={{ borderColor: METAL[cible].trait }}
        aria-hidden
      >
        <Objet3D objet={OBJET_PALIER[e.def.id]} matiere="fantome" taille={40} embleme={Embleme} ombre={false} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mono-label block text-[11px] text-foreground/65">Prochain badge</span>
        <span className="mt-0.5 block text-[17px] font-extrabold">
          {e.def.nom} · {NOM_METAL[cible]}
        </span>
        <span className="mt-2.5 block h-2 overflow-hidden rounded-full bg-foreground/12">
          <span
            className="block h-full rounded-full"
            style={{ width: `${Math.max(4, ((e.valeur - base) / (e.cible! - base)) * 100)}%`, background: METAL[cible].trait }}
          />
        </span>
        <span className="mt-1.5 flex justify-between text-[13px]">
          <span className="font-bold tabular-nums">
            {e.valeur} / {quantite(e.def, e.cible!)}
          </span>
          <span className="text-foreground/65">plus que {reste}</span>
        </span>
      </span>
    </button>
  );
}

/** La feuille d'un badge de palier : ses quatre marches. */
function FeuillePalier({ e, moi }: { e: EtatTrophee; moi: string }) {
  const m = metal(e.palier);
  return (
    <div className="flex flex-col items-center gap-4">
      <Medaille e={e} diametre={180} vivant />
      <div className="text-center">
        <SheetTitle className="text-[22px] font-extrabold tracking-tight">
          {e.def.nom}
          {m ? ` · ${NOM_METAL[m]}` : ""}
        </SheetTitle>
        <SheetDescription className="mt-1 text-[15px] text-foreground/75">{quantite(e.def, e.valeur)}</SheetDescription>
      </div>
      <ol className="flex w-full flex-col gap-2">
        {e.def.paliers.map((seuil, i) => {
          const mm = METAUX[Math.min(i, METAUX.length - 1)];
          const gagne = e.palier > i;
          const courant = e.palier === i;
          const base = i ? e.def.paliers[i - 1] : 0;
          return (
            <li key={seuil} className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] px-3.5 py-2.5">
              {gagne ? (
                <span className="size-9 shrink-0 rounded-full" style={{ background: fond(mm), boxShadow: `inset 0 0 0 2px ${METAL[mm].listel}` }} aria-hidden />
              ) : (
                <span className="size-9 shrink-0 rounded-full border-[2.5px] border-dashed" style={{ borderColor: METAL[mm].trait }} aria-hidden />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-bold">{NOM_METAL[mm]}</span>
                  <span className="font-mono text-[13px] font-bold tabular-nums">{quantite(e.def, seuil)}</span>
                </span>
                {courant && (
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-foreground/12">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${Math.max(4, ((e.valeur - base) / (seuil - base)) * 100)}%`, background: METAL[mm].trait }}
                    />
                  </span>
                )}
                <span className="mt-1 flex items-center gap-1 text-[13px] text-foreground/70">
                  {gagne ? (
                    <>
                      <Check className="size-3.5" strokeWidth={3} aria-hidden /> Gagné
                    </>
                  ) : courant ? (
                    `Plus que ${quantite(e.def, seuil - e.valeur)}`
                  ) : (
                    "À gagner"
                  )}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <AussiPalier e={e} moi={moi} />
    </div>
  );
}

/** La feuille d'un classement de fin de saison : ses podiums, et le rang du moment. */
function FeuilleSaison({ e, moi }: { e: EtatClassement; moi: string }) {
  const unite = (n: number) => `${n} ${n > 1 ? e.def.unite[1] : e.def.unite[0]}`;
  return (
    <div className="flex flex-col items-center gap-4">
      <Trophee id={e.def.id} rang={e.meilleur?.rang ?? null} taille={200} vivant />
      <div className="text-center">
        <SheetTitle className="text-[22px] font-extrabold tracking-tight">{NOM_TROPHEE[e.def.id]}</SheetTitle>
        <SheetDescription className="mt-1 text-[15px] text-foreground/75">{sousTitre(e)}</SheetDescription>
      </div>
      <ol className="flex w-full flex-col gap-2">
        {e.enCours && (
          <li className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] border border-foreground/15 px-3.5 py-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center" aria-hidden>
              <span className="size-3 rounded-full border-2 border-foreground/80" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[16px] font-bold">{ordinal(e.enCours.rang)} en ce moment</span>
                <span className="font-mono text-[13px] font-bold tabular-nums">{unite(e.enCours.valeur)}</span>
              </span>
              <span className="mt-1 block text-[13px] text-foreground/70">Saison en cours</span>
            </span>
          </li>
        )}
        {e.podiums.map((p) => {
          const mm = METAL_RANG[p.rang];
          return (
            <li key={p.saison} className="flex min-h-[60px] items-center gap-3.5 rounded-[18px] bg-foreground/[0.06] px-3.5 py-2.5">
              <span className="size-9 shrink-0 rounded-full" style={{ background: fond(mm), boxShadow: `inset 0 0 0 2px ${METAL[mm].listel}` }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[16px] font-bold">
                    {ordinal(p.rang)} · {NOM_METAL[mm]}
                  </span>
                  <span className="font-mono text-[13px] font-bold tabular-nums">{unite(p.valeur)}</span>
                </span>
                <span className="mt-1 block text-[13px] text-foreground/70">{p.saison}</span>
              </span>
            </li>
          );
        })}
        {!e.podiums.length && !e.enCours && (
          <li className="rounded-[18px] bg-foreground/[0.06] px-3.5 py-4 text-center text-[14px] text-foreground/70">
            Les trois premiers à la fin de la saison gagnent le trophée
          </li>
        )}
      </ol>
      <AussiSaison id={e.def.id} moi={moi} />
    </div>
  );
}

/* ---------------------------- Qui d'autre l'a ---------------------------- */

/** Un joueur qui a le badge : sa petite carte, son nom, son métal. Le toucher ouvre sa carte. */
function Detenteur({ nom, m, detail }: { nom: string; m: Metal; detail: string }) {
  const { players } = useSeason();
  const { open } = useCardViewer();
  const src = usePlayerPhoto(nom);
  const [cassee, setCassee] = useState(false);
  const p = players.find((x) => x.name === nom);
  return (
    <li>
      <button
        type="button"
        disabled={!p}
        onClick={() =>
          p &&
          open({
            cacheKey: `badge-${nom}`,
            mode: "simple",
            title: nom,
            subtitle: detail,
            joueur: nom,
            render: (s) => <PlayerCard player={p} size={s} />,
          })
        }
        aria-label={`${nom}, ${detail}. Voir sa carte`}
        className="flex w-full min-h-11 items-center gap-3 rounded-[14px] px-1 py-1.5 text-left active:bg-foreground/[0.06]"
      >
        <span className="relative shrink-0">
          {p ? (
            <PlayerCard player={p} size={FORMAT_CARTE.petite} />
          ) : (
            <span className="flex size-12 items-center justify-center overflow-hidden rounded-[10px] bg-foreground/10 text-[13px] font-bold">
              {cassee ? (
                nom[0]
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="size-full object-cover" onError={() => setCassee(true)} />
              )}
            </span>
          )}
          <span
            className="absolute -right-1 -bottom-1 size-3.5 rounded-full border-2 border-popover"
            style={{ background: fond(m) }}
            aria-hidden
          />
        </span>
        <span className="min-w-0 flex-1 truncate text-[15px] font-semibold"><Nom n={nom} /></span>
        <span className="shrink-0 text-[13px] text-foreground/70">{detail}</span>
      </button>
    </li>
  );
}

function ListeDetenteurs({ titre, gens }: { titre: string; gens: { nom: string; m: Metal; detail: string }[] }) {
  return (
    <section className="w-full" aria-label={titre}>
      <h3 className="mb-1.5 flex items-baseline justify-between px-1 text-[15px] font-bold">
        {titre}
        <span className="font-mono text-[12px] text-foreground/65 tabular-nums">{gens.length}</span>
      </h3>
      {gens.length ? (
        <ul className="flex flex-col">
          {gens.map((g) => (
            <Detenteur key={g.nom + g.detail} {...g} />
          ))}
        </ul>
      ) : (
        <p className="px-1 text-[14px] text-foreground/70">Personne pour l&apos;instant</p>
      )}
    </section>
  );
}

/** Qui d'autre a ce badge de palier, à n'importe quel palier. */
function AussiPalier({ e, moi }: { e: EtatTrophee; moi: string }) {
  const { saison, players } = useSeason();
  const gens = useMemo(
    () =>
      detenteurs(
        saison,
        e.def.id,
        players.map((p) => p.name).filter((n) => n !== moi),
        1,
        new Date()
      ).map((d) => ({ nom: d.nom, m: metal(d.palier)!, detail: `${NOM_METAL[metal(d.palier)!]} · ${quantite(e.def, d.valeur)}` })),
    [saison, players, e.def, moi]
  );
  return <ListeDetenteurs titre={e.palier ? "Ils l'ont aussi" : "Ils l'ont déjà"} gens={gens} />;
}

/** Qui d'autre est monté sur ce podium de fin de saison. */
function AussiSaison({ id, moi }: { id: ClassementId; moi: string }) {
  const { saison, players } = useSeason();
  const gens = useMemo(() => {
    const noms = new Set(players.map((p) => p.name).filter((n) => n !== moi));
    return podiumsDe(saison, id, noms).map((p) => ({ nom: p.nom, m: METAL_RANG[p.rang], detail: `${ordinal(p.rang)} · ${p.saison}` }));
  }, [saison, players, id, moi]);
  return <ListeDetenteurs titre="Sur ce podium" gens={gens} />;
}

/* ----------------------------- Nouveaux badges ---------------------------- */

const vuKey = (nom: string) => `sfl-badges-vus-${nom}`;

/** Annonce les paliers gagnés depuis la dernière visite. */
export function NouveauxBadges() {
  const { me } = useMyPlayer();
  const { saison } = useSeason();
  const session = useSession();
  const actif = !!session && session.name === me;

  useEffect(() => {
    if (!actif) return;
    const etats = vitrine(saison, me, new Date());
    const cles = clesGagnees(etats);
    let vus: string[] | null = null;
    try {
      const brut = localStorage.getItem(vuKey(me));
      if (brut) vus = JSON.parse(brut) as string[];
    } catch {}
    try {
      localStorage.setItem(vuKey(me), JSON.stringify(cles));
    } catch {}

    const nouveaux = vus ? cles.filter((c) => !vus!.includes(c)) : cles;
    if (!nouveaux.length) return;
    const timer = setTimeout(() => {
      if (!vus) {
        toast(`Tu as ${nouveaux.length} badge${nouveaux.length > 1 ? "s" : ""}`, {
          description: "Ils t'attendent dans Ma carte.",
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
        return;
      }
      for (const c of nouveaux.slice(0, 3)) {
        const [id, palier] = c.split(":");
        const def = TROPHEES.find((t) => t.id === id);
        const m = metal(Number(palier));
        if (!def || !m) continue;
        toast.success(`Nouveau badge · ${def.nom} ${NOM_METAL[m]}`, {
          description: def.inscription,
          action: { label: "Voir", onClick: () => (window.location.href = "/profil#badges") },
        });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [actif, saison, me]);

  return null;
}

/**
 * La feuille d'un badge pour n'importe quel joueur (fiche joueur, par
 * exemple) : ses paliers ou ses podiums, et qui d'autre l'a. À poser dans un
 * SheetContent.
 */
export function FeuilleBadge({
  nom,
  badge,
}: {
  nom: string;
  badge: { famille: "palier"; id: TropheeId } | { famille: "saison"; id: ClassementId };
}) {
  const { saison, allPlayers } = useSeason();
  const e = useMemo(
    () =>
      badge.famille === "palier"
        ? { famille: "palier" as const, e: vitrine(saison, nom, new Date()).find((x) => x.def.id === badge.id)! }
        : { famille: "saison" as const, e: finsDeSaison(saison, nom, allPlayers).find((x) => x.def.id === badge.id)! },
    [saison, allPlayers, nom, badge.famille, badge.id]
  );
  return e.famille === "palier" ? <FeuillePalier e={e.e} moi={nom} /> : <FeuilleSaison e={e.e} moi={nom} />;
}
