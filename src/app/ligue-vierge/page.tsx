"use client";

// La Ligue vierge — les matchs Bola, ceux que les joueurs ouvrent eux-mêmes
// hors de la SFL, comptés à vie (Sabri, 22/10) : pas de saison, pas de
// trophée de fin de saison, ni Impact ni Défensive ; seulement le MVP que
// l'app désigne à chaque match (ex æquo compris). Le barème et les règles
// sont dans lib/sfl/ligue-vierge.ts.
//
// De haut en bas : mes feuilles à tenir (les matchs que j'organise, coup
// d'envoi passé, encore corrigeables), le podium en cartes (le n°1 φ fois
// plus grand que ses dauphins), la suite du classement en pastilles, puis
// les derniers matchs avec leur score et leurs MVP.

import { useCallback, useEffect, useMemo, useState } from "react";
import { FORMAT_CARTE, MiniCarte } from "@/components/sfl/mini-carte";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { FeuilleBola } from "@/components/sfl/matchs/feuille-bola";
import { Nom } from "@/components/sfl/nom";
import { ChoixLigue } from "@/components/sfl/choix-ligue";
import { useSession } from "@/hooks/use-session";
import { classementAVie, compterMatchs, coupDEnvoiPasse, feuilleOuverte, type Classe, type MatchCompte } from "@/lib/sfl/ligue-vierge";
import { DEMO_LIGUE_VIERGE, demoFeuille, demoMatchs } from "@/lib/sfl/ligue-vierge-demo";
import { aujourdhuiIso, libelleJour, listerMesDerniers, lireLigueVierge, monId, type Partie } from "@/lib/sfl/matchs";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

/** La carte d'un joueur de Bola : sa carte de la SFL s'il en a une, sinon une carte neutre. */
function Carte({ name, size, detail }: { name: string; size: number; detail?: string }) {
  const { allPlayers } = useSeason();
  const p = allPlayers.find((x) => x.name.toLowerCase() === name.trim().toLowerCase()) ?? carteNeutre(name);
  return <MiniCarte player={p} size={size} detail={detail} cle={`lv-${name}`} />;
}

function Podium({ top, moi }: { top: Classe[]; moi: string | null }) {
  const marches = [
    { p: top[1] ?? null, size: FORMAT_CARTE.moyenne },
    { p: top[0] ?? null, size: FORMAT_CARTE.grande },
    { p: top[2] ?? null, size: FORMAT_CARTE.moyenne },
  ];
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5">
      {marches.map(({ p, size }, i) =>
        p ? (
          <div key={p.id} className="flex min-w-0 flex-col items-center gap-1.5">
            <Carte name={p.name} size={size} detail={`Ligue vierge · ${p.points} pts`} />
            <span
              className={cn(
                "max-w-[120px] truncate font-semibold",
                i === 1 ? "text-[15px]" : "text-[12.5px] text-foreground/70",
                p.id === moi && "text-primary"
              )}
            >
              <span className="text-foreground/40 tabular-nums">{p.rank}</span> <Nom n={p.name} />
            </span>
            <span className={cn("font-bold tabular-nums", i === 1 ? "text-[20px]" : "text-[15px]")}>
              {p.points}
              <span className="mono-label ml-1 text-foreground/40">pts</span>
            </span>
          </div>
        ) : (
          <span key={i} style={{ width: 254 * size }} />
        )
      )}
    </div>
  );
}

function Ligne({ c, moi }: { c: Classe; moi: string | null }) {
  return (
    <div className={cn("glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2.5", c.id === moi && "bg-primary/10")}>
      <span className="w-7 text-[15px] font-bold text-foreground/40 tabular-nums">{c.rank}</span>
      <Carte name={c.name} size={FORMAT_CARTE.petite} detail={`Ligue vierge · ${c.points} pts`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold"><Nom n={c.name} /></span>
        <span className="mono-label text-foreground/40">
          {c.matchs} match{c.matchs > 1 ? "s" : ""}
          {c.mvp > 0 && ` · ${c.mvp} MVP`}
        </span>
      </span>
      <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
        {c.points}
        <span className="mono-label ml-1 text-foreground/40">pts</span>
      </span>
    </div>
  );
}

function MatchJoue({ m }: { m: MatchCompte }) {
  const mvps = m.joueurs.filter((j) => j.mvp);
  return (
    <article className="glass flex flex-col gap-4 rounded-[26px] p-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="mono-label text-foreground/40">
          {libelleJour(m.jour)} · {m.heure}
        </span>
        {!m.valide && <span className="mono-label text-foreground/40">{m.genre === "exhibition" ? "Exhibition" : "Amical"}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
        <span className="mono-label text-muted-foreground">Clairs</span>
        <span className="text-[36px] leading-none font-extrabold tracking-tight tabular-nums">
          {m.scoreClairs} <span className="text-foreground/25">–</span> {m.scoreFonces}
        </span>
        <span className="mono-label text-muted-foreground">Foncés</span>
      </div>
      {mvps.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          <span className="mono-label text-foreground/40">{mvps.length > 1 ? "MVP ex æquo" : "MVP"}</span>
          <div className="flex flex-wrap justify-center gap-3">
            {mvps.map((j) => (
              <div key={j.id} className="flex flex-col items-center gap-1">
                <Carte name={j.name} size={FORMAT_CARTE.moyenne} detail={`MVP · ${j.buts} but${j.buts > 1 ? "s" : ""}, ${j.passes} passe${j.passes > 1 ? "s" : ""}`} />
                <span className="text-[12.5px] font-semibold"><Nom n={j.name} /></span>
                <span className="mono-label text-foreground/40">
                  {j.buts} B · {j.passes} P
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

function MesFeuilles({ parties, onSaisie, apercu }: { parties: Partie[]; onSaisie: () => void; apercu: boolean }) {
  const [ouverte, setOuverte] = useState<Partie | null>(null);
  if (parties.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      {parties.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setOuverte(p)}
          className="flex items-center gap-3 rounded-[22px] bg-foreground px-4 py-3.5 text-left text-background"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{p.lieu}</span>
            <span className="mono-label text-background/60">
              {libelleJour(p.jour)} · {p.heure}
            </span>
          </span>
          <span className="shrink-0 text-[14px] font-semibold">
            {p.saisiLe ? `${p.scoreClairs} – ${p.scoreFonces}` : "Feuille de match"}
          </span>
        </button>
      ))}
      {ouverte && (
        <FeuilleBola
          key={ouverte.id}
          partie={ouverte}
          open
          onOpenChange={(o) => !o && setOuverte(null)}
          onSaisie={onSaisie}
          apercu={apercu}
        />
      )}
    </section>
  );
}

export default function LigueViergePage() {
  const session = useSession();
  const actif = !!session?.server;
  const [matchs, setMatchs] = useState<MatchCompte[] | null>(null);
  const [mesParties, setMesParties] = useState<Partie[]>([]);
  const [moi, setMoi] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [tout, setTout] = useState(false);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!actif) return;
    let fini = false;
    const charger = () => {
      lireLigueVierge()
        .then((m) => !fini && setMatchs(compterMatchs(m)))
        .catch(() => !fini && setMatchs((x) => x ?? []));
      listerMesDerniers()
        .then((p) => !fini && setMesParties(p))
        .catch(() => {});
    };
    void monId().then((id) => !fini && setMoi(id));
    charger();
    const sb = supabase();
    let canal: ReturnType<typeof sb.channel> | null = null;
    try {
      canal = sb
        .channel(`ligue-vierge-${tick}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "matchs" }, charger)
        .subscribe();
    } catch {}
    return () => {
      fini = true;
      if (canal) sb.removeChannel(canal);
    };
  }, [actif, tick]);

  // En aperçu, tant que rien n'est saisi : des matchs de démonstration.
  const { allPlayers } = useSeason();
  const noms = useMemo(() => allPlayers.filter((p) => p.matchs > 0).map((p) => p.name), [allPlayers]);
  const apercu = DEMO_LIGUE_VIERGE && (matchs?.length ?? 0) === 0 && noms.length >= 10;
  const vus = useMemo(
    () => (apercu ? compterMatchs(demoMatchs(noms, aujourdhuiIso())) : matchs),
    [apercu, noms, matchs]
  );
  const classement = useMemo(() => (vus ? classementAVie(vus) : []), [vus]);
  // Mes feuilles : j'organise, le coup d'envoi est passé, et la feuille reste ouverte (24 h après la saisie).
  const aTenir = mesParties.filter(
    (p) =>
      p.organisateurId === moi &&
      coupDEnvoiPasse(p.jour, p.heure) &&
      feuilleOuverte(p.saisiLe)
  );
  const demo = apercu ? demoFeuille(noms, aujourdhuiIso(), moi ?? "moi") : null;
  const feuilles = demo && aTenir.length === 0 ? [demo] : aTenir;
  const derniers = vus ? [...vus].reverse().slice(0, 12) : [];

  return (
    <div className="shell flex flex-col gap-6 py-2 sm:py-6 lg:gap-[var(--fib-34)] lg:pt-[var(--fib-55)]">
      <div className="flex items-baseline gap-2">
        <h1 className="sr-only">Ligue vierge</h1>
        <ChoixLigue actif="/ligue-vierge" className="lg:[&_a]:text-[34px]" />
        {vus && vus.length > 0 && (
          <span className="mono-label ml-auto text-foreground/40">
            {vus.length} match{vus.length > 1 ? "s" : ""} · {classement.length} joueur{classement.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <MesFeuilles parties={feuilles} onSaisie={recharger} apercu={apercu} />

      {vus === null ? (
        actif ? null : (
          <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">Connecte-toi pour voir la Ligue vierge.</div>
        )
      ) : classement.length === 0 ? (
        <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">
          Aucun match Bola joué pour l&apos;instant.
        </div>
      ) : (
        <div className="grille-or grid grid-cols-1 gap-6">
          <section className="flex flex-col gap-5">
            <Podium top={classement.slice(0, 3)} moi={moi} />
            <div className="flex flex-col gap-1.5">
              {classement.slice(3, tout ? undefined : 10).map((c) => (
                <Ligne key={c.id} c={c} moi={moi} />
              ))}
            </div>
            {!tout && classement.length > 10 && (
              <button
                type="button"
                onClick={() => setTout(true)}
                className="glass-soft self-center rounded-full px-5 py-2.5 text-[13px] font-semibold text-foreground/70"
              >
                Tout le classement · {classement.length}
              </button>
            )}
          </section>
          <section className="flex flex-col gap-3">
            <h2 className="px-1 text-[17px] font-bold tracking-tight">Derniers matchs</h2>
            {derniers.map((m) => (
              <MatchJoue key={m.id} m={m} />
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
