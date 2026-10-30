"use client";

// Inviter (parrainage, lib/sfl/parrainage.ts) : mon lien, mon code, et ceux
// que j'ai fait venir. On y entre depuis Ma carte.
//
// Le lien part par la feuille de partage du téléphone (WhatsApp, Snapchat,
// SMS…) ou se copie ; le code se dit de vive voix et se tape à
// l'inscription. Le lien d'un joueur SFL offre Bola Team (« Bola Team
// offert »). À l'ouverture, ma carte part avec mon code (poste et stats) :
// la page de mon lien la montre si j'ai accepté qu'elle sorte de l'app, et
// seulement mon nom sinon.
//
// Les paliers (Sabri, 27/10, skins-recrues.ts) : une recrue compte une fois
// qu'elle a vraiment joué son premier match (lib/sfl/recrues.ts). Le grand
// chiffre dit mes recrues actives ; puis les quatre paliers et leur
// progression (+100 XP chacune, Recruteur à 3, Filigrane à 5, Fondateur à
// 10, numérotée sur 500), et mes filleuls : ceux qui jouent, et ceux qui sont
// inscrits sans avoir encore joué. Aucune limite au nombre de liens ni de
// recrues. Démo hors production : /parrainage?paliers=0|1|3|5|10
// (recrues-store.ts).

import { useEffect, useState } from "react";
import { Check, Copy, Lock } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { QuiVient } from "@/components/sfl/qui-vient";
import { Mini } from "@/components/sfl/passe-bola";
import { FONDATEURS_MAX, numeroFondateur, PALIERS_RECRUES, type PalierRecrues } from "@/components/sfl/skins-recrues";
import type { HabillageCarte } from "@/components/sfl/finitions-carte";
import { useHabillage } from "@/hooks/use-habillage";
import { rechargerRecrues, useRecrues } from "@/hooks/use-recrues";
import { paliersDemandes, poserDemoRecrues } from "@/lib/sfl/recrues-store";
import { estActive } from "@/lib/sfl/recrues";
import type { Player } from "@/lib/sfl/engine";
import { useSession } from "@/hooks/use-session";
import { monId } from "@/lib/sfl/matchs";
import type { Stats } from "@/lib/sfl/engine";
import { ANTON } from "@/components/sfl/actus/ecran";
import {
  adresseDuLien,
  mesFilleuls,
  monCode,
  noterPartage,
  publierMaCarte,
  type Filleul,
} from "@/lib/sfl/parrainage";

export default function ParrainagePage() {
  const session = useSession();
  const { player } = useMyPlayer();
  const bola = useJoueurBola();
  const [code, setCode] = useState<string | null | undefined>(undefined);
  const [filleuls, setFilleuls] = useState<Filleul[] | null>(null);
  const [copie, setCopie] = useState(false);
  const pseudo = session?.user ?? null;
  // Ma carte, en clé stable : la saison se recalcule sans que la carte change.
  const carte = JSON.stringify([player.poste, player.stats]);
  const recrues = useRecrues();
  const porte = useHabillage(player.name);

  // La démo des paliers (hors production), sinon la relecture : les
  // Fondateurs du jour sont numérotés avant (recrues-store.ts).
  useEffect(() => {
    const n = paliersDemandes();
    if (n !== null) poserDemoRecrues(n, player.name);
    else void rechargerRecrues(true);
  }, [player.name]);

  useEffect(() => {
    let fini = false;
    monCode(pseudo)
      .then((c) => !fini && setCode(c))
      .catch(() => !fini && setCode(null));
    monId()
      .then((id) => (id ? mesFilleuls(id) : []))
      .then((f) => !fini && setFilleuls(f))
      .catch(() => !fini && setFilleuls([]));
    return () => {
      fini = true;
    };
  }, [pseudo]);

  useEffect(() => {
    if (!code) return;
    const [poste, stats] = JSON.parse(carte) as [string, Stats];
    publierMaCarte(poste, stats);
  }, [code, carte]);

  const lien = code ? adresseDuLien(code) : null;

  async function copier() {
    if (!lien) return;
    try {
      await navigator.clipboard.writeText(lien);
      setCopie(true);
      noterPartage();
      setTimeout(() => setCopie(false), 2000);
    } catch {
      toast.error("Copie impossible");
    }
  }

  async function partager() {
    if (!lien) return;
    if (!navigator.share) return copier();
    try {
      await navigator.share({
        title: "Bola",
        text: bola ? "Rejoins-moi sur Bola." : "Rejoins-moi sur Bola. Un mois de Bola Team offert avec mon lien.",
        url: lien,
      });
      noterPartage();
    } catch {
      // Partage annulé : rien à dire.
    }
  }

  // Avant que la base réponde (ou sans ses fonctions), mes filleuls comme avant.
  const parBase = recrues.charge;
  // En attente : pas encore joué, ou ne compte pas (compte pas validé, code coupé).
  const actifs = parBase ? recrues.miennes.filter(estActive) : [];
  const enAttente = parBase ? recrues.miennes.filter((r) => !estActive(r)) : [];
  const n = actifs.length;
  const moi = recrues.ligue.find((r) => r.nom === player.name);
  const fondateur = moi?.fondateur ?? null;
  // Les 500 places prises (le plus haut numéro posé), et pas la mienne : fermé.
  const ferme = !fondateur && recrues.complet;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--fib-21)] px-5 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-titre-l font-bold tracking-tight">Inviter</h1>
      </div>

      {/* Ceux que j'ai fait venir : le nombre, en grand */}
      <div className="flex items-end gap-[var(--fib-13)] px-1">
        <span className="text-[89px] leading-[0.8] tabular-nums" style={{ fontFamily: ANTON }}>
          {n}
        </span>
        <span className="mono-label pb-1 text-encre-3">{n > 1 ? "recrues actives" : "recrue active"}</span>
      </div>

      {/* Mon lien */}
      <section className="glass flex flex-col gap-[var(--fib-13)] rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label text-encre-3">Ton lien</span>
          {!bola && <span className="mono-label text-encre-2">Bola Team offert un mois</span>}
        </div>
        <p className="min-h-[1.4em] font-mono text-ligne break-all text-encre-2">
          {lien ? lien.replace(/^https?:\/\//, "") : code === null ? "Lien indisponible pour l'instant." : "…"}
        </p>
        <button
          type="button"
          disabled={!lien}
          onClick={() => void partager()}
          className="bouton-principal bouton--mauve py-4 text-lecture font-bold disabled:opacity-40"
        >
          Partager mon lien
        </button>
        <button
          type="button"
          disabled={!lien}
          onClick={() => void copier()}
          className="bouton-secondaire bouton--mauve flex items-center justify-center gap-2 py-3 text-ligne font-semibold disabled:opacity-40"
        >
          {copie ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copie ? "Copié" : "Copier"}
        </button>
      </section>

      {/* Mon code, pour le dire de vive voix */}
      {code && (
        <div className="flex items-baseline justify-between px-1">
          <span className="mono-label text-encre-3">Ton code</span>
          <span className="font-mono text-titre font-bold tracking-wide">{code}</span>
        </div>
      )}

      {/* Les paliers */}
      <section className="flex flex-col gap-2">
        <h2 className="px-1 text-titre font-bold tracking-tight">Paliers</h2>
        {PALIERS_RECRUES.map((p) => (
          <LignePalier
            key={p.n}
            palier={p}
            actives={n}
            player={player}
            base={{ cran: porte.cran, rang: porte.rang }}
            fondateur={fondateur}
            ferme={p.finition === "fondateur" && ferme}
          />
        ))}
        <p className="px-1 pt-1 text-corps leading-[1.4] text-encre-2">
          Fondateur : la carte de ceux qui ont lancé la première grande vague de Bola. Numérotée sur {FONDATEURS_MAX}, jamais réémise.
        </p>
        {fondateur && <p className="mono-label px-1 text-encre-2">{numeroFondateur(fondateur)}</p>}
      </section>

      {/* Mes filleuls : ceux qui jouent, ceux qui n'ont pas encore joué */}
      {parBase ? (
        <>
          {actifs.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="px-1 text-titre font-bold tracking-tight">Ils jouent</h2>
              <QuiVient noms={actifs.map((f) => f.nom)} />
            </section>
          )}
          {enAttente.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-titre font-bold tracking-tight">En attente</h2>
                <span className="mono-label text-encre-3">{enAttente.length}</span>
              </div>
              <div className="opacity-55">
                <QuiVient noms={enAttente.map((f) => f.nom)} />
              </div>
            </section>
          )}
        </>
      ) : (
        (filleuls?.length ?? 0) > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="px-1 text-titre font-bold tracking-tight">Ils sont là</h2>
            <QuiVient noms={filleuls!.map((f) => f.nom)} />
          </section>
        )
      )}
    </div>
  );
}

/** Un palier : sa carte (ou ses XP), ce qu'il donne, où j'en suis. */
function LignePalier({
  palier,
  actives,
  player,
  base,
  fondateur,
  ferme,
}: {
  palier: PalierRecrues;
  actives: number;
  player: Player;
  base: HabillageCarte;
  fondateur: number | null;
  ferme: boolean;
}) {
  // Le Fondateur tient à son numéro ; les autres, au compte de recrues.
  const atteint = palier.finition === "fondateur" ? !!fondateur : actives >= palier.n;
  // Un Fondateur numéroté l'est pour de bon : le palier reste plein même si
  // ses recrues actives redescendent.
  const fait = palier.finition === "fondateur" && fondateur ? palier.n : Math.min(actives, palier.n);
  return (
    <div className={`flex items-center gap-3.5 rounded-[18px] bg-foreground/[0.05] px-3 py-2.5 ${atteint ? "" : "opacity-70"}`}>
      <span className="relative h-[71px] w-11 shrink-0 overflow-hidden rounded-[7px]">
        {palier.finition ? (
          <Mini
            player={player}
            habillage={{ ...base, finition: palier.finition, fondateur: palier.finition === "fondateur" ? (fondateur ?? undefined) : undefined }}
            l={44}
            h={71}
          />
        ) : (
          <span className="flex h-full items-center justify-center bg-foreground/[0.06] font-mono text-corps font-bold">+100</span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-lecture leading-tight font-bold">{palier.titre}</span>
          <span className="mono-label shrink-0 text-encre-2 tabular-nums">
            {ferme ? "fermé" : `${fait} / ${palier.n}`}
          </span>
        </span>
        <span className="mono-label text-encre-3">{palier.donne}</span>
        <span className="relative h-[3px] overflow-hidden rounded-full bg-foreground/15">
          <span className="absolute inset-y-0 left-0 rounded-full bg-foreground" style={{ width: `${(fait / palier.n) * 100}%` }} />
        </span>
      </span>
      {atteint ? (
        <Check className="size-5 shrink-0" aria-hidden />
      ) : (
        <Lock className="size-4 shrink-0 text-encre-3" aria-hidden />
      )}
    </div>
  );
}
