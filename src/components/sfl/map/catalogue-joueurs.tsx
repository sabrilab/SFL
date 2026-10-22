"use client";

// Le catalogue des joueurs, ville par ville — la fiche qui monte de la Map
// (Sabri, 22/10 : « on pourra avoir le catalogue des joueurs en fonction
// d'où ils proviennent, et ça s'ouvrirait encore dans l'onglet Map »).
//
// En haut, les villes en pastilles (la plus peuplée d'abord) ; dessous, ta
// ville à toi et ton interrupteur de visibilité (le mode fantôme de la Snap
// Map). Une ville : son meilleur joueur en grande carte, les deux suivants
// en moyennes, le reste en petites — la hiérarchie des cartes, au nombre
// d'or (FORMAT_CARTE). Toutes les villes : une rangée de cartes par ville.
// Toucher une carte ouvre le profil du joueur ; « Sur la Map » y vole.

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, MapPin, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { PlayerCard } from "@/components/sfl/player-card";
import { FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { useSeason } from "@/components/sfl/season-provider";
import { cleVille, type VillePlan } from "@/components/sfl/map/joueurs";
import { maVille, poserMaVille, type VilleJoueur } from "@/lib/sfl/villes";
import type { Player } from "@/lib/sfl/engine";
import { cn } from "@/lib/utils";

interface Commune {
  lat: number;
  lng: number;
  libelle: string;
  commune?: string;
}

function Carte({ p, size, onJoueur }: { p: Player | undefined; size: number; onJoueur: (n: string) => void }) {
  if (!p) return null;
  return (
    <button type="button" onClick={() => onJoueur(p.name)} className="shrink-0 transition-transform active:scale-95">
      <PlayerCard player={p} size={size} />
    </button>
  );
}

/** Ta ville : la pastille qui la change, et l'œil qui te rend invisible. */
function TaVille({ me, chercher = false }: { me: string; chercher?: boolean }) {
  const [, rafraichir] = useState(0);
  const mienne = maVille(me);
  const [cherche, setCherche] = useState(chercher);
  const [q, setQ] = useState("");
  const [trouvees, setTrouvees] = useState<Commune[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cherche) return;
    champ.current?.focus();
  }, [cherche]);

  useEffect(() => {
    if (q.trim().length < 3) return;
    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/geocode?type=commune&q=${encodeURIComponent(q.trim())}`, { signal: ctl.signal });
        const d = (await res.json()) as { resultats?: Commune[] };
        setTrouvees(d.resultats ?? []);
      } catch {}
    }, 220);
    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  async function poser(v: VilleJoueur | null, cachee: boolean) {
    setEnvoi(true);
    const erreur = await poserMaVille(me, v, cachee);
    setEnvoi(false);
    if (erreur) {
      toast.error(erreur);
      return;
    }
    navigator.vibrate?.(8);
    setCherche(false);
    setQ("");
    setTrouvees([]);
    rafraichir((n) => n + 1);
  }

  if (cherche)
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input ref={champ} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ta ville" className="h-10 rounded-full pl-9 text-[15px]" />
          </div>
          <button type="button" onClick={() => setCherche(false)} aria-label="Fermer" className="grid size-10 place-items-center rounded-full bg-secondary">
            <X className="size-4" />
          </button>
        </div>
        {q.trim().length >= 3 &&
          trouvees.map((c) => (
            <button
              key={`${c.libelle}${c.lat}`}
              type="button"
              disabled={envoi}
              onClick={() => poser({ ville: c.commune ?? c.libelle, lat: c.lat, lng: c.lng }, mienne?.cachee ?? false)}
              className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-[15px] font-semibold active:bg-secondary disabled:opacity-50"
            >
              <MapPin className="size-4 text-muted-foreground" /> {c.libelle}
            </button>
          ))}
      </div>
    );

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setCherche(true)}
        className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-secondary px-4 text-left active:opacity-70"
      >
        <span className="mono-label shrink-0 text-muted-foreground">Ta ville</span>
        <span className="truncate text-[15px] font-semibold">{mienne?.ville ?? "—"}</span>
      </button>
      {mienne && (
        <button
          type="button"
          disabled={envoi}
          onClick={() => poser(mienne, !mienne.cachee)}
          aria-label={mienne.cachee ? "Apparaître sur la Map" : "Disparaître de la Map"}
          aria-pressed={!mienne.cachee}
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-full transition-colors disabled:opacity-50",
            mienne.cachee ? "bg-secondary text-muted-foreground" : "bg-foreground text-background"
          )}
        >
          {mienne.cachee ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
        </button>
      )}
    </div>
  );
}

export function CatalogueJoueurs({
  villes,
  focus,
  onFocus,
  onVoir,
  onJoueur,
  me,
  chercherVille = false,
}: {
  villes: VillePlan[];
  /** Les villes ouvertes (une pile peut en fondre plusieurs) ; null = toutes. */
  focus: string[] | null;
  onFocus: (ids: string[] | null) => void;
  onVoir: (v: VillePlan) => void;
  onJoueur: (name: string) => void;
  me: string | null;
  /** Ouvert par la notification « Mets ta ville » : la recherche de ta ville d'emblée. */
  chercherVille?: boolean;
}) {
  const { players } = useSeason();
  const parNom = useMemo(() => new Map(players.map((p) => [p.name, p])), [players]);
  const ordre = useMemo(() => [...villes].sort((a, b) => b.joueurs.length - a.joueurs.length || a.ville.localeCompare(b.ville)), [villes]);
  const total = villes.reduce((s, v) => s + v.joueurs.length, 0);
  const choisies = focus ? ordre.filter((v) => focus.includes(v.id)) : [];
  const une = choisies.length === 1 ? choisies[0] : null;
  const ma = me ? maVille(me) : null;
  const pastilles = useRef<HTMLDivElement>(null);

  // La pastille choisie vient au milieu de la rangée.
  useEffect(() => {
    const el = pastilles.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    el?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [focus]);

  return (
    <div className="flex flex-col gap-4">
      <div ref={pastilles} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        <button
          type="button"
          aria-pressed={!focus}
          onClick={() => onFocus(null)}
          className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold", !focus ? "bg-foreground text-background" : "bg-secondary")}
        >
          Toutes <span className="font-mono text-[11px] opacity-60">{total}</span>
        </button>
        {ordre.map((v) => {
          const actif = !!focus?.includes(v.id) && focus.length === 1;
          return (
            <button
              key={v.id}
              type="button"
              aria-pressed={actif}
              onClick={() => onFocus([v.id])}
              className={cn("flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold", actif ? "bg-foreground text-background" : "bg-secondary")}
            >
              {v.ville}
              {ma && cleVille(ma.ville) === v.id && <span className="size-1.5 rounded-full bg-current" />}
              <span className="font-mono text-[11px] opacity-60">{v.joueurs.length}</span>
            </button>
          );
        })}
      </div>

      {me && <TaVille me={me} chercher={chercherVille} />}

      {une ? (
        <section className="flex flex-col items-center gap-4">
          {/* La hiérarchie des cartes : la grande, deux moyennes, les petites. */}
          <Carte p={parNom.get(une.joueurs[0]?.name)} size={FORMAT_CARTE.grande} onJoueur={onJoueur} />
          {une.joueurs.length > 1 && (
            <div className="flex justify-center gap-3">
              {une.joueurs.slice(1, 3).map((j) => (
                <Carte key={j.name} p={parNom.get(j.name)} size={FORMAT_CARTE.moyenne} onJoueur={onJoueur} />
              ))}
            </div>
          )}
          {une.joueurs.length > 3 && (
            <div className="flex flex-wrap justify-center gap-2">
              {une.joueurs.slice(3).map((j) => (
                <Carte key={j.name} p={parNom.get(j.name)} size={FORMAT_CARTE.petite} onJoueur={onJoueur} />
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => onVoir(une)}
            className="flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-[15px] font-semibold text-background active:opacity-80"
          >
            <MapPin className="size-4" strokeWidth={2.4} /> Sur la Map
          </button>
        </section>
      ) : (
        (choisies.length ? choisies : ordre).map((v) => (
          <section key={v.id} className="flex flex-col gap-2">
            <button type="button" onClick={() => onFocus([v.id])} className="flex items-baseline gap-2 text-left active:opacity-60">
              <span className="text-[19px] font-extrabold tracking-tight">{v.ville}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{v.joueurs.length}</span>
            </button>
            <div className="-mx-4 flex items-end gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {v.joueurs.slice(0, 8).map((j) => (
                <Carte key={j.name} p={parNom.get(j.name)} size={FORMAT_CARTE.moyenne} onJoueur={onJoueur} />
              ))}
              {v.joueurs.length > 8 && (
                <button
                  type="button"
                  onClick={() => onFocus([v.id])}
                  className="grid shrink-0 place-items-center rounded-[5px] bg-secondary font-mono text-[12px] font-bold text-muted-foreground"
                  style={{ width: 254 * FORMAT_CARTE.moyenne, height: 254 * FORMAT_CARTE.moyenne * 1.617 }}
                >
                  +{v.joueurs.length - 8}
                </button>
              )}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
