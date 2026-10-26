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

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { QuiVient } from "@/components/sfl/qui-vient";
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

  const n = filleuls?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-[var(--fib-21)] px-5 py-4 sm:py-8">
      <div className="flex items-center gap-3">
        <BoutonRetour />
        <h1 className="text-[30px] font-bold tracking-tight">Inviter</h1>
      </div>

      {/* Ceux que j'ai fait venir : le nombre, en grand */}
      <div className="flex items-end gap-[var(--fib-13)] px-1">
        <span className="text-[89px] leading-[0.8] tabular-nums" style={{ fontFamily: ANTON }}>
          {n}
        </span>
        <span className="mono-label pb-1 text-foreground/45">{n > 1 ? "venus par toi" : "venu par toi"}</span>
      </div>

      {/* Mon lien */}
      <section className="glass flex flex-col gap-[var(--fib-13)] rounded-[28px] p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="mono-label text-foreground/40">Ton lien</span>
          {!bola && <span className="mono-label text-foreground/70">Bola Team offert un mois</span>}
        </div>
        <p className="min-h-[1.4em] font-mono text-[14px] break-all text-foreground/85">
          {lien ? lien.replace(/^https?:\/\//, "") : code === null ? "Lien indisponible pour l'instant." : "…"}
        </p>
        <button
          type="button"
          disabled={!lien}
          onClick={() => void partager()}
          className="bouton-principal bouton--mauve py-4 text-[15px] font-bold disabled:opacity-40"
        >
          Partager mon lien
        </button>
        <button
          type="button"
          disabled={!lien}
          onClick={() => void copier()}
          className="bouton-secondaire bouton--mauve flex items-center justify-center gap-2 py-3 text-[14px] font-semibold disabled:opacity-40"
        >
          {copie ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copie ? "Copié" : "Copier"}
        </button>
      </section>

      {/* Mon code, pour le dire de vive voix */}
      {code && (
        <div className="flex items-baseline justify-between px-1">
          <span className="mono-label text-foreground/40">Ton code</span>
          <span className="font-mono text-[17px] font-bold tracking-wide">{code}</span>
        </div>
      )}

      {/* Mes filleuls */}
      {n > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="px-1 text-[17px] font-bold tracking-tight">Ils sont là</h2>
          <QuiVient noms={filleuls!.map((f) => f.nom)} />
        </section>
      )}
    </div>
  );
}
