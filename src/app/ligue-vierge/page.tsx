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
//
// Sur tablette et ordinateur (dès 768 px), la largeur des Actus
// (.gabarit-ligue) et deux colonnes au nombre d'or : le classement dans la
// grande, qui reste à l'écran s'il y tient (useCollant), les derniers matchs
// dans la petite ; dès 1024 px, les cartes prennent un cran de plus
// (useFormatCarte) ; dès 1280 px, la suite du classement sur deux colonnes.
// Sous 768 px, rien ne bouge.
//
// Passe du 24/10 (Sabri : « le classement des buteurs, des passeurs, et un
// semi-classement Pépite d'Or qui intègre les victoires, les nuls, les
// défaites et la carte MVP sélectionnée automatiquement ») : trois
// classements au-dessus du podium, Points (le barème de Bola, MVP compris),
// Buteurs et Passeurs (classementBola) ; le podium porte l'or, l'argent et
// le bronze. « Des divisions une fois qu'on a assez d'utilisateurs […] au
// nombre de points » : dès que le classement des points remplit deux
// divisions de 30, il se découpe en D1, D2… (divisionsBola), recoupées à
// chaque match, sans règle de montée ni de descente ; chaque division compte
// ses places à partir de 1. En aperçu, des divisions de 12 pour les voir
// (sur une préversion, ?apercu=1 force la démonstration). Et pour qui n'a pas d'équipe, la vitrine
// de Bola Team en une ligne (equipe/vitrine-team.tsx).

import { useCallback, useEffect, useMemo, useState } from "react";
import { MiniCarte } from "@/components/sfl/mini-carte";
import { RangMetal } from "@/components/sfl/rang-metal";
import { VitrineBola } from "@/components/sfl/equipe/vitrine-team";
import { useMonEquipe } from "@/hooks/use-mon-equipe";
import { carteNeutre } from "@/components/sfl/qui-vient";
import { useSeason } from "@/components/sfl/season-provider";
import { FeuilleBola } from "@/components/sfl/matchs/feuille-bola";
import { Nom } from "@/components/sfl/nom";
import { EnteteLigue } from "@/components/sfl/choix-ligue";
import { useSession } from "@/hooks/use-session";
import { useCollant } from "@/hooks/use-collant";
import { useFormatCarte } from "@/hooks/use-format-carte";
import {
  DIVISIONS_BOLA,
  classementAVie,
  classementBola,
  compterMatchs,
  coupDEnvoiPasse,
  divisionsBola,
  feuilleOuverte,
  type ClassementBola,
  type LigneBolaClassee,
  type MatchCompte,
} from "@/lib/sfl/ligue-vierge";
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

const CLASSEMENTS: { id: ClassementBola; label: string; unite: string }[] = [
  { id: "points", label: "Points", unite: "pts" },
  { id: "buts", label: "Buteurs", unite: "buts" },
  { id: "passes", label: "Passeurs", unite: "pd" },
];

function Podium({ top, moi, unite }: { top: LigneBolaClassee[]; moi: string | null; unite: string }) {
  const format = useFormatCarte();
  const marches = [
    { p: top[1] ?? null, size: format.moyenne },
    { p: top[0] ?? null, size: format.grande },
    { p: top[2] ?? null, size: format.moyenne },
  ];
  return (
    <div className="flex items-end justify-center gap-3 sm:gap-5 lg:gap-[var(--fib-34)]">
      {marches.map(({ p, size }, i) =>
        p ? (
          <div key={p.id} className="flex min-w-0 flex-col items-center gap-1.5">
            <Carte name={p.name} size={size} detail={`Bola · ${p.valeur} ${unite}`} />
            <span
              className={cn(
                "flex max-w-[132px] items-center gap-1.5 font-semibold",
                i === 1 ? "text-[15px]" : "text-[12.5px] text-foreground/70",
                p.id === moi && "text-primary"
              )}
            >
              <RangMetal rang={p.place} taille={i === 1 ? 22 : 19} className={i === 1 ? "text-[12px]" : "text-[10.5px]"} />
              <span className="truncate">
                <Nom n={p.name} />
              </span>
            </span>
            <span className={cn("font-bold tabular-nums", i === 1 ? "text-[20px]" : "text-[15px]")}>
              {p.valeur}
              <span className="mono-label ml-1 text-foreground/40">{unite}</span>
            </span>
          </div>
        ) : (
          <span key={i} style={{ width: 254 * size }} />
        )
      )}
    </div>
  );
}

function Ligne({ c, rang, moi, cle, unite }: { c: LigneBolaClassee; rang?: number; moi: string | null; cle: ClassementBola; unite: string }) {
  const format = useFormatCarte();
  // Ce que la valeur ne dit pas : les matchs, et les MVP, les passes ou les buts.
  const detail = [
    `${c.matchs} match${c.matchs > 1 ? "s" : ""}`,
    cle === "points" && c.mvp > 0 && `${c.mvp} MVP`,
    cle === "buts" && c.passes > 0 && `${c.passes} pd`,
    cle === "passes" && c.buts > 0 && `${c.buts} but${c.buts > 1 ? "s" : ""}`,
  ].filter(Boolean);
  return (
    <div className={cn("glass-soft flex items-center gap-3 rounded-[18px] px-3.5 py-2.5 xl:mb-1.5 xl:break-inside-avoid", c.id === moi && "bg-primary/10")}>
      <span className="w-7 text-[15px] font-bold text-foreground/40 tabular-nums">{rang ?? c.place}</span>
      <Carte name={c.name} size={format.petite} detail={`Bola · ${c.valeur} ${unite}`} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] font-semibold"><Nom n={c.name} /></span>
        <span className="mono-label text-foreground/40">{detail.join(" · ")}</span>
      </span>
      <span className="w-16 text-right text-lg font-bold tracking-tight tabular-nums">
        {c.valeur}
        <span className="mono-label ml-1 text-foreground/40">{unite}</span>
      </span>
    </div>
  );
}

function MatchJoue({ m }: { m: MatchCompte }) {
  const format = useFormatCarte();
  const mvps = m.joueurs.filter((j) => j.mvp);
  return (
    <article className="glass flex flex-col gap-4 rounded-[26px] p-[18px]">
      <div className="flex items-baseline justify-between">
        <span className="mono-label text-foreground/40">
          {libelleJour(m.jour)} · {m.heure}
        </span>
        {!m.valide && <span className="mono-label text-foreground/40">Amical</span>}
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
                <Carte name={j.name} size={format.moyenne} detail={`MVP · ${j.buts} but${j.buts > 1 ? "s" : ""}, ${j.passes} passe${j.passes > 1 ? "s" : ""}`} />
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
    <section className="flex flex-col gap-2 md:grid md:grid-cols-2 md:gap-[var(--fib-13)] xl:grid-cols-3">
      {parties.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => setOuverte(p)}
          className="bouton-principal bouton--vert flex items-center gap-3 rounded-[22px] px-4 py-3.5 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold">{p.lieu}</span>
            <span className="mono-label bouton-sous">
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
  const [cle, setCle] = useState<ClassementBola>("points");
  const [forceApercu, setForceApercu] = useState(false);
  const recharger = useCallback(() => setTick((n) => n + 1), []);

  // Sur une préversion, ?apercu=1 montre la démonstration même s'il y a déjà de vrais matchs.
  useEffect(() => {
    if (!DEMO_LIGUE_VIERGE || !new URLSearchParams(window.location.search).has("apercu")) return;
    const t = window.setTimeout(() => setForceApercu(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  const { equipe, charge: equipeLue } = useMonEquipe();

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
  const apercu = DEMO_LIGUE_VIERGE && (forceApercu || (matchs?.length ?? 0) === 0) && noms.length >= 10;
  const vus = useMemo(
    () => (apercu ? compterMatchs(demoMatchs(noms, aujourdhuiIso())) : matchs),
    [apercu, noms, matchs]
  );
  const classement = useMemo(() => (vus ? classementAVie(vus) : []), [vus]);
  const def = CLASSEMENTS.find((c) => c.id === cle) ?? CLASSEMENTS[0];
  const lignes = useMemo(() => classementBola(classement, cle), [classement, cle]);
  // Les divisions ne coupent que le classement des points ; en aperçu, des divisions de 12 pour les voir.
  const divisions = useMemo(
    () => (cle === "points" ? divisionsBola(lignes, apercu ? 12 : DIVISIONS_BOLA.taille) : []),
    [cle, lignes, apercu]
  );
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
  const [colonne, colonneCollante] = useCollant();

  return (
    <div className="gabarit-ligue mx-auto flex w-full max-w-[470px] flex-col gap-6 px-5 pt-2 pb-8 sm:pt-6 md:gap-[var(--fib-34)] md:pt-4 lg:pt-[var(--fib-34)]">
      <div className="flex flex-col gap-2.5">
        <h1 className="sr-only">Bola</h1>
        <EnteteLigue actif="/ligue-vierge" />
        {vus && vus.length > 0 && (
          <span className="mono-label text-foreground/40">
            {vus.length} match{vus.length > 1 ? "s" : ""} · {classement.length} joueur{classement.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <MesFeuilles parties={feuilles} onSaisie={recharger} apercu={apercu} />

      {vus === null ? (
        actif ? null : (
          <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">Connecte-toi pour voir le classement Bola.</div>
        )
      ) : classement.length === 0 ? (
        <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">
          Aucun match Bola joué pour l&apos;instant.
        </div>
      ) : (
        <div className="flex flex-col gap-8 md:grid md:grid-cols-[minmax(0,1.618fr)_minmax(0,1fr)] md:items-start md:gap-[var(--fib-34)] min-[1440px]:gap-[var(--fib-55)]">
          <section
            ref={colonne}
            className={cn("flex flex-col gap-5 md:min-w-0 md:gap-[var(--fib-21)]", colonneCollante && "md:sticky md:top-[var(--fib-21)]")}
          >
            <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Classement">
              {CLASSEMENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={cle === c.id}
                  onClick={() => setCle(c.id)}
                  className={cn(
                    "shrink-0 px-4 py-2 text-[13px] font-semibold whitespace-nowrap",
                    cle === c.id ? "bouton-principal" : "bouton-secondaire text-foreground/60"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {lignes.length === 0 ? (
              <div className="glass-soft rounded-3xl px-6 py-10 text-center text-sm text-foreground/45">Personne pour l&apos;instant.</div>
            ) : (
              <>
                {divisions.length > 0 && <span className="mono-label -mb-2 px-1 text-foreground/45">{divisions[0].nom}</span>}
                <Podium top={lignes.slice(0, 3)} moi={moi} unite={def.unite} />
                {(divisions.length > 0
                  ? divisions.map((d) => ({ nom: d.nom, n: d.n, lignes: d.n === 1 ? d.lignes.slice(3) : d.lignes }))
                  : [{ nom: "", n: 1, lignes: lignes.slice(3) }]
                ).map((d) => {
                  // Sans « Tout le classement » : le haut seulement, jusqu'à la 10e place.
                  const debut = d.n === 1 ? 3 : lignes.indexOf(d.lignes[0]);
                  const visibles = tout ? d.lignes : d.lignes.slice(0, Math.max(0, 10 - debut));
                  if (visibles.length === 0) return null;
                  // La place dans sa division : la D2 repart de 1.
                  const decalage = d.n > 1 ? d.lignes[0].place - 1 : 0;
                  return (
                    <div key={d.n} className="flex flex-col gap-1.5">
                      {d.nom && d.n > 1 && <span className="mono-label px-1 pt-2 text-foreground/45">{d.nom}</span>}
                      <div className="flex flex-col gap-1.5 xl:block xl:columns-2 xl:gap-[var(--fib-13)]">
                        {visibles.map((c) => (
                          <Ligne key={c.id} c={c} rang={c.place - decalage} moi={moi} cle={cle} unite={def.unite} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {!tout && lignes.length > 10 && (
                  <button
                    type="button"
                    onClick={() => setTout(true)}
                    className="bouton-secondaire self-center px-5 py-2.5 text-[13px] font-semibold"
                  >
                    Tout le classement · {lignes.length}
                  </button>
                )}
              </>
            )}
          </section>
          <section className="flex flex-col gap-3 md:min-w-0">
            {!equipe && (equipeLue || apercu) && <VitrineBola />}
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
