"use client";

// Tes missions du dimanche, dans les Actus, juste sous la convocation (Sabri,
// 22/10 : « Il faudrait que ça fonctionne une fois que les feuilles de match
// sont faites »). Dès que l'admin a fait les équipes de la journée, chaque
// joueur de la feuille a ses trois missions (lib/sfl/missions.ts) :
//   · le contrat contre son rival, en affiche : vos deux cartes face à face,
//     la note aux couleurs de vos équipes (Noirs, Blancs) comme sur la
//     feuille ; sans rival à sa hauteur, ceux qu'il faut passer au classement ;
//   · le défi du dimanche, le même pour tous ;
//   · la ligue : voter Impact et Défensive le soir du match.
// On accepte ou on passe jusqu'au coup d'envoi ; puis le verdict tombe à
// mesure que la feuille se remplit, et devient définitif à minuit. L'XP va au
// Niveau XP et au passe de la saison (Ma carte), jamais aux points Pépite.
//
// Le rival ne voit ton contrat que s'il a accepté le sien en face (la base ne
// le lui montre pas avant) : l'affiche le dit alors, « Abdel a accepté aussi ».

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { CarteDe, FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { Nom } from "@/components/sfl/nom";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { useMissions, type LigneMission, type MesMissions, type Phase } from "@/hooks/use-missions";
import { phrase, XP_PARFAIT, type Creneau, type Mission } from "@/lib/sfl/missions";
import type { Reponse } from "@/lib/sfl/missions";
import { cn } from "@/lib/utils";
import { ANTON } from "./ecran";

const TITRES: Record<Creneau, string> = { contrat: "Contrat", defi: "Défi du dimanche", ligue: "La ligue" };
/** Les onglets de la feuille de match (lib/sfl/feuille.ts). */
const NOIRS = { fond: "#0A0B0D", encre: "#F4F5F2" };
const BLANCS = { fond: "#F4F3EF", encre: "#0A0B0D" };

function Carte({ nom, size, onglet }: { nom: string; size: number; onglet?: { fond: string; encre: string } }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name === nom);
  return p ? <MiniCarte player={p} size={size} onglet={onglet} /> : <CarteDe name={nom} size={size} />;
}

function Joueur({ nom, onglet }: { nom: string; onglet?: { fond: string; encre: string } }) {
  const { allPlayers } = useSeason();
  const pts = allPlayers.find((x) => x.name === nom)?.pp ?? 0;
  return (
    <div className="flex w-[104px] flex-col items-center gap-2">
      <Carte nom={nom} size={FORMAT_CARTE.moyenne} onglet={onglet} />
      <span className="flex max-w-full flex-col items-center gap-1">
        <span className="max-w-full truncate text-[15px] font-bold">
          <Nom n={nom} />
        </span>
        <span className="mono-label text-white/45">{pts} pts</span>
      </span>
    </div>
  );
}

/** L'affiche du contrat : le duel, ceux à passer, ou la tête à garder. */
function Affiche({ m, mm }: { m: Mission; mm: MesMissions }) {
  const { d, joueur } = mm;
  const onglet = (n: string) => (d.camps.get(n)?.equipe === "noirs" ? NOIRS : BLANCS);
  if (m.genre === "tiens-le" || m.genre === "finis-devant") {
    const rival = m.cibles[0];
    return (
      <div className="flex items-start justify-center gap-3">
        <Joueur nom={joueur} onglet={onglet(joueur)} />
        <span className="mt-[46px] text-[30px] leading-none text-white/30" style={{ fontFamily: ANTON }}>
          VS
        </span>
        <Joueur nom={rival} onglet={onglet(rival)} />
      </div>
    );
  }
  if (m.genre === "passe-devant") {
    const montres = m.cibles.slice(0, 3);
    return (
      <div className="flex items-start justify-center gap-3">
        <Joueur nom={joueur} onglet={onglet(joueur)} />
        <span className="mt-[46px] text-[30px] leading-none text-white/30" style={{ fontFamily: ANTON }}>
          ▲
        </span>
        <div className="flex w-[104px] flex-col items-center gap-2">
          <div className="flex h-[126px] items-center -space-x-5">
            {montres.map((c, i) => (
              <span key={c} className="rounded-[12px] ring-2 ring-black" style={{ zIndex: montres.length - i }}>
                <Carte nom={c} size={FORMAT_CARTE.petite} />
              </span>
            ))}
          </div>
          <span className="mono-label text-white/45">
            {m.cibles.length > 3 ? `${m.cibles.length} joueurs` : m.cibles.length > 1 ? `${m.cibles.length} à passer` : "à passer"}
          </span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-center">
      <Joueur nom={joueur} onglet={onglet(joueur)} />
    </div>
  );
}

/**
 * Accepter ou passer, avant le coup d'envoi. Comme Je viens / Je passe : le
 * choix fait s'allume ; tant qu'on peut, on change d'avis.
 */
function Choix({
  r,
  attente,
  onRepondre,
}: {
  r: Reponse["reponse"] | null;
  attente: boolean;
  onRepondre: (r: Reponse["reponse"]) => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={attente}
        aria-pressed={r === "acceptee"}
        onClick={() => r !== "acceptee" && onRepondre("acceptee")}
        className={cn(
          "flex h-11 flex-1 items-center justify-center gap-1.5 text-[14px] font-bold",
          r === "acceptee" ? "bouton-principal bouton--vert" : "bouton-secondaire bouton--vert"
        )}
      >
        {r === "acceptee" ? (
          <>
            <Check className="size-4" strokeWidth={3} /> Acceptée
          </>
        ) : (
          "Accepter"
        )}
      </button>
      <button
        type="button"
        disabled={attente}
        aria-pressed={r === "passee"}
        onClick={() => r !== "passee" && onRepondre("passee")}
        className={cn("h-11 px-5 text-[14px] font-semibold", r === "passee" ? "bouton-secondaire" : "bouton-discret")}
      >
        {r === "passee" ? "Passée" : "Passer"}
      </button>
    </div>
  );
}

/** Après le coup d'envoi : ce qui est en jeu, puis le verdict. */
function Verdict({ l, phase }: { l: LigneMission; phase: Phase }) {
  const r = l.reponse?.reponse ?? null;
  if (r !== "acceptee")
    return <span className="mono-label text-white/35">{r === "passee" ? "Passée" : "Pas acceptée"}</span>;
  const v = l.verdict;
  const detail = v.detail && <span className="font-mono text-[12px] text-white/55">{v.detail}</span>;
  if (v.etat === "en-jeu")
    return (
      <span className="flex items-center gap-2">
        <span className="relative flex size-2">
          {phase === "en-jeu" && (
            <span className="absolute inset-0 animate-ping rounded-full bg-white opacity-60 motion-reduce:animate-none" />
          )}
          <span className="relative size-2 rounded-full bg-white" />
        </span>
        <span className="mono-label text-white/80">En jeu</span>
        {detail}
      </span>
    );
  if (v.etat === "reussie")
    return (
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-black">
          <Check className="size-3.5" strokeWidth={3} />
          <span className="mono-label">Réussie · +{l.m.xp} XP</span>
        </span>
        {detail}
      </span>
    );
  return (
    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
      <span className="flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1 text-white/60">
        <X className="size-3.5" strokeWidth={3} />
        <span className="mono-label">{v.etat === "ratee" ? "Ratée" : "Annulée"}</span>
      </span>
      {detail}
    </span>
  );
}

function Ligne({
  l,
  mm,
  attente,
  repondre,
}: {
  l: LigneMission;
  mm: MesMissions;
  attente: boolean;
  repondre: (c: Creneau, r: Reponse["reponse"]) => void;
}) {
  const identite = useIdentites();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="mono-label text-white/50">{TITRES[l.m.creneau]}</span>
        <span className="mono-label text-white/70">+{l.m.xp} XP</span>
      </div>
      <p className="text-[19px] leading-[1.2] font-bold tracking-[-0.3px]">{phrase(l.m, identite.nom)}</p>
      {mm.phase === "ouvert" ? (
        <Choix r={l.reponse?.reponse ?? null} attente={attente} onRepondre={(r) => repondre(l.m.creneau, r)} />
      ) : (
        <Verdict l={l} phase={mm.phase} />
      )}
    </div>
  );
}

export function TesMissions() {
  const mm = useMissions();
  const identite = useIdentites();
  const [attente, setAttente] = useState(false);
  // La notification « Tes missions » ouvre /ligue#missions : on y descend une fois le bloc là.
  const ref = useRef<HTMLElement>(null);
  const present = !!mm;
  useEffect(() => {
    if (present && window.location.hash === "#missions") ref.current?.scrollIntoView({ block: "start" });
  }, [present]);
  if (!mm) return null;
  const { d, joueur, apercu, lignes, phase, enFace, xp } = mm;
  const contrat = lignes.find((l) => l.m.creneau === "contrat");
  const autres = lignes.filter((l) => l.m.creneau !== "contrat");
  const camp = d.camps.get(joueur);

  const repondre = async (c: Creneau, r: Reponse["reponse"]) => {
    setAttente(true);
    try {
      await mm.repondre(c, r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Réponse refusée.");
    } finally {
      setAttente(false);
    }
  };

  const quand =
    phase === "ouvert" ? `Avant ${d.heure}` : phase === "en-jeu" ? (d.joue ? "Verdict à minuit" : "En jeu") : "Verdict";
  const prenom = identite.nom(joueur).split(" ")[0];

  return (
    <section ref={ref} id="missions" aria-labelledby="titre-missions" className="flex scroll-mt-4 flex-col gap-3">
      <div className="flex items-end justify-between gap-3 px-5">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="mono-label text-foreground/45">
            J{d.j} · {d.date} · {quand}
          </span>
          <h2 id="titre-missions" className="titre-lettrage text-[30px] leading-[0.95]">
            {apercu ? `Les missions de ${prenom}` : "Tes missions"}
          </h2>
        </div>
        {apercu && <span className="mono-label shrink-0 pb-1 text-foreground/45">Aperçu</span>}
      </div>

      {contrat && (
        <div className="mx-4 flex flex-col gap-4 rounded-[28px] bg-black p-5 text-white">
          <div className="flex items-baseline justify-between gap-3">
            <span className="mono-label text-white/50">
              {TITRES.contrat}
              {camp && d.duels.length > 0 ? ` · ${camp.label}` : ""}
            </span>
            <span className="mono-label text-white/70">+{contrat.m.xp} XP</span>
          </div>
          <Affiche m={contrat.m} mm={mm} />
          {enFace && (
            <span className="mono-label self-center rounded-full border border-white/20 px-3 py-1.5 text-white/80">
              {identite.nom(contrat.m.cibles[0]).split(" ")[0]} a accepté aussi
            </span>
          )}
          <p className="text-[21px] leading-[1.15] font-bold tracking-[-0.4px]">{phrase(contrat.m, identite.nom)}</p>
          {phase === "ouvert" ? (
            <Choix
              r={contrat.reponse?.reponse ?? null}
              attente={attente}
              onRepondre={(r) => void repondre("contrat", r)}
            />
          ) : (
            <Verdict l={contrat} phase={phase} />
          )}
        </div>
      )}

      {autres.length > 0 && (
        <div className="mx-4 flex flex-col gap-5 rounded-[28px] bg-black p-5 text-white">
          {autres.map((l, i) => (
            <div key={l.m.creneau} className={cn(i > 0 && "border-t border-white/10 pt-5")}>
              <Ligne l={l} mm={mm} attente={attente} repondre={(c, r) => void repondre(c, r)} />
            </div>
          ))}
        </div>
      )}

      <div className="flex items-baseline justify-between px-5">
        <span className="mono-label text-foreground/45">
          {phase === "ouvert" ? "Les trois réussies" : phase === "en-jeu" ? "À minuit" : "Ton dimanche"}
        </span>
        <span className="mono-label text-foreground/70">
          +{phase === "ouvert" ? XP_PARFAIT : xp} XP{phase === "ouvert" ? " de plus" : ""}
        </span>
      </div>
    </section>
  );
}
