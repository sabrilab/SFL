"use client";

// Ce que la page Activité & rétention affiche, une fois le journal lu.
//
// L'ordre suit les questions qu'on se pose en arrivant :
//   1. Ce qu'il faut retenir — les conclusions, calculées sur les vraies
//      données (lib/sfl/retention.ts), chacune avec la chose à faire ;
//   2. les chiffres de la période et leur évolution ;
//   3. la croissance — une courbe qu'on parcourt du doigt, au choix de la
//      mesure, avec la période d'avant en pointillé ;
//   4. qui est là aujourd'hui (nouveaux, fidèles, à risque, décrochés…) ;
//   5. la rétention — combien reviennent, cohorte par cohorte ;
//   6. ce qui fait revenir — les gestes de la première semaine ;
//   7. quand la ligue ouvre l'app ;
//   8. ce qu'ils y font, les joueurs à relancer, le détail par joueur.
//
// Les données arrivent toutes faites (`page.tsx` lit le journal) : cette vue
// ne fait que les analyser et les montrer.

import { useMemo, useState } from "react";
import { ChevronDown, Lightbulb, Loader2, Mail, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import {
  analyser,
  DAY,
  duree,
  evolution,
  jjmm,
  METRIQUES,
  milliers,
  pct,
  type Chiffre,
  type Conclusion,
  type Evenement,
  type FamilleId,
  type MetriqueId,
  type Profil,
} from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";
import { CarteHoraire, Cohortes, Comparaison, Courbe, encre } from "./graphiques";

export interface DonneesActivite {
  evenements: Evenement[];
  profiles: Profil[];
  /** Instant de la lecture — figé pour garder le rendu pur. */
  now: number;
}

const PERIODES = [
  { id: "7", label: "7 j", days: 7 },
  { id: "30", label: "30 j", days: 30 },
  { id: "90", label: "90 j", days: 90 },
  { id: "all", label: "Tout", days: null },
] as const;
type PeriodeId = (typeof PERIODES)[number]["id"];

/**
 * Qui on regarde. Par défaut les joueurs seuls : les admins (Sabri, Ilyes)
 * ouvrent l'app bien plus que les autres pour la faire tourner, et leurs
 * connexions gonfleraient les courbes, la rétention et les conclusions.
 */
const PUBLICS = [
  { id: "joueurs", label: "Joueurs" },
  { id: "admins", label: "Admins" },
  { id: "tous", label: "Tout le monde" },
] as const;
type PublicId = (typeof PUBLICS)[number]["id"];

/** Teinte de chaque famille dans la barre (et sa pastille dans la légende). */
const TEINTE: Record<FamilleId, number> = {
  nouveaux: 1,
  fideles: 0.78,
  reguliers: 0.55,
  risque: 0.34,
  decroches: 0.18,
  jamais: 0.07,
};

/** « Sabri et Ilyes ». */
function listeNoms(noms: string[]): string {
  return noms.length <= 1 ? noms.join("") : `${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
}

function relative(ts: number, now: number): string {
  const d = now - ts;
  if (d < 3600 * 1000) return `il y a ${Math.max(1, Math.round(d / 60000))} min`;
  if (d < DAY) return `il y a ${Math.round(d / (3600 * 1000))} h`;
  return `il y a ${Math.round(d / DAY)} j`;
}

/* ------------------------------- briques UI ------------------------------ */

function Section({ titre, sous, children }: { titre: string; sous?: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-[17px] font-bold tracking-tight">{titre}</h2>
      {sous && <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">{sous}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Delta({ c, suffixe = "" }: { c: Chiffre; suffixe?: string }) {
  const e = evolution(c);
  if (e === null) {
    if (c.avant === 0 && c.valeur > 0) return <span className="text-[11px] text-foreground/50">nouveau{suffixe}</span>;
    return null;
  }
  const Icone = e >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums", e >= 0 ? "text-foreground/75" : "text-foreground/45")}>
      <Icone className="size-3" />
      {e >= 0 ? "+" : "−"}
      {Math.abs(Math.round(e * 100))} %{suffixe}
    </span>
  );
}

function Tuile({ label, valeur, c }: { label: string; valeur: string; c: Chiffre }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-[8.5px] text-foreground/45">{label}</p>
      <div className="mt-1.5 text-[24px] leading-none font-extrabold tabular-nums">{valeur}</div>
      <div className="mt-1.5 min-h-[15px]">
        <Delta c={c} />
      </div>
    </div>
  );
}

function Barres({ lignes }: { lignes: { label: string; value: number }[] }) {
  const max = Math.max(1, ...lignes.map((l) => l.value));
  if (lignes.length === 0) return <p className="text-[12.5px] text-foreground/40">Rien sur cette période.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {lignes.map((l) => (
        <div key={l.label} className="flex items-center gap-3">
          <span className="w-[46%] shrink-0 truncate text-[12.5px] font-medium">{l.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
            <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(l.value / max) * 100}%` }} />
          </span>
          <span className="w-[52px] shrink-0 text-right text-[12px] font-bold tabular-nums">{milliers(l.value)}</span>
        </div>
      ))}
    </div>
  );
}

function CarteConclusion({ c }: { c: Conclusion }) {
  const Icone = c.ton === "bon" ? TrendingUp : c.ton === "alerte" ? TriangleAlert : Lightbulb;
  return (
    <div className="glass-soft rounded-2xl p-3.5">
      <div className="flex gap-3">
        <span
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
            c.ton === "alerte" ? "bg-foreground text-background" : "bg-foreground/10"
          )}
        >
          <Icone className="size-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] leading-snug font-bold">{c.titre}</p>
          <p className="mt-1 text-[12.5px] leading-snug text-foreground/55">{c.detail}</p>
          <p className="mt-2 text-[12.5px] leading-snug">
            <span className="mono-label mr-1.5 text-[8.5px] text-foreground/45">À faire</span>
            {c.action}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- vue ---------------------------------- */

export function ActiviteVue({
  data,
  loading,
  onRefresh,
  error,
}: {
  data: DonneesActivite | null;
  loading: boolean;
  onRefresh: () => void;
  error: string | null;
}) {
  const [periode, setPeriode] = useState<PeriodeId>("30");
  const [public_, setPublic] = useState<PublicId>("joueurs");
  const [metrique, setMetrique] = useState<MetriqueId>("hebdo");
  const [tri, setTri] = useState<"recent" | "temps" | "actions">("recent");
  const [ouverte, setOuverte] = useState<FamilleId | null>(null);
  const [toutes, setToutes] = useState(false);

  const jours = PERIODES.find((p) => p.id === periode)?.days ?? null;
  // Le journal et les comptes du public choisi, et la part des admins dans
  // tout le journal (pour dire de combien ils faussaient les chiffres).
  const vu = useMemo(() => {
    if (!data) return null;
    const admins = new Set(data.profiles.filter((p) => p.admin).map((p) => p.name));
    const garde = (name: string) =>
      public_ === "tous" ? true : public_ === "admins" ? admins.has(name) : !admins.has(name);
    const evenements = data.evenements.filter((e) => garde(e.name));
    const profiles = data.profiles.filter((p) => garde(p.name));
    const partAdmins = data.evenements.length
      ? data.evenements.filter((e) => admins.has(e.name)).length / data.evenements.length
      : 0;
    return { evenements, profiles, admins: [...admins].sort(), partAdmins };
  }, [data, public_]);
  const a = useMemo(
    () => (data && vu ? analyser(vu.evenements, vu.profiles, data.now, jours) : null),
    [data, vu, jours]
  );

  /* ------------------------------- la courbe ----------------------------- */
  const courbe = useMemo(() => {
    if (!a) return null;
    const fenetre = a.serie.slice(a.debutPeriode);
    const points = fenetre.map((p) => ({ t: p.t, v: p[metrique] }));
    const n = fenetre.length;
    const debutAvant = a.debutPeriode - n;
    // La période d'avant, rang pour rang ; pas pour le cumul, qui ne fait que monter.
    const avant =
      jours !== null && metrique !== "cumul" && debutAvant >= 0
        ? fenetre.map((_, k) => a.serie[debutAvant + k]?.[metrique] ?? null)
        : null;
    const flux = metrique === "nouveaux" || metrique === "sessions" || metrique === "minutes";
    const somme = (xs: (number | null)[]) => xs.reduce<number>((s, v) => s + (v ?? 0), 0);
    let titre: string;
    let c: Chiffre;
    if (flux) {
      const total = somme(points.map((p) => p.v));
      c = { valeur: total, avant: avant ? somme(avant) : null };
      titre = `${milliers(metrique === "minutes" ? Math.round(total / 60) : total)}${metrique === "minutes" ? " h" : ""} sur la période`;
    } else if (metrique === "cumul") {
      const gagne = (points.at(-1)?.v ?? 0) - (a.serie[a.debutPeriode - 1]?.cumul ?? 0);
      c = { valeur: 0, avant: null };
      titre = `${points.at(-1)?.v ?? 0} joueurs · +${gagne} sur la période`;
    } else {
      const v = points.at(-1)?.v ?? 0;
      c = { valeur: v, avant: avant?.at(-1) ?? null };
      titre = `${v} aujourd'hui`;
    }
    return { points, avant, titre, c };
  }, [a, metrique, jours]);

  const format = (v: number) =>
    metrique === "minutes" ? (v >= 120 ? `${Math.round(v / 60)} h` : `${Math.round(v)} min`) : milliers(Math.round(v));

  const joueursTries = [...(a?.joueurs ?? [])].sort((x, y) =>
    tri === "temps" ? y.temps - x.temps : tri === "actions" ? y.actions - x.actions : y.last - x.last
  );
  const libellePeriode = jours === null ? "depuis le début" : `sur ${jours} jours`;
  const comparaison = jours === null ? "" : ` · évolution par rapport aux ${jours} jours d'avant`;
  const totalFamilles = a ? a.familles.reduce((s, f) => s + f.noms.length, 0) : 0;
  const emails = vu?.profiles.filter((p) => p.contact_email) ?? [];

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Activité</h1>
          <p className="mt-1 text-[13px] text-foreground/42">Croissance, rétention, et ce qu&apos;on en tire</p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="glass-soft mono-label flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/60"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Actualiser
        </button>
      </div>

      <div className="glass flex w-full rounded-full p-1">
        {PUBLICS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPublic(p.id)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors",
              public_ === p.id ? "bg-foreground text-background" : "text-foreground/45"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {vu && vu.admins.length > 0 && (
        <p className="-mt-1.5 px-1 text-[11.5px] leading-snug text-foreground/45">
          {public_ === "joueurs"
            ? `Sans ${listeNoms(vu.admins)}, qui font ${pct(vu.partAdmins)} de l'activité enregistrée.`
            : public_ === "admins"
              ? `${listeNoms(vu.admins)} seulement.`
              : `Admins compris : ${listeNoms(vu.admins)} font ${pct(vu.partAdmins)} de l'activité enregistrée.`}
        </p>
      )}

      <div className="glass flex w-full rounded-full p-1">
        {PERIODES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriode(p.id)}
            className={cn(
              "flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors",
              periode === p.id ? "bg-foreground text-background" : "text-foreground/45"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="glass-soft rounded-2xl p-3.5 text-[12.5px] text-[#FF6B5E]">
          {error} — as-tu bien rejoué le script SQL (table activity) ?
        </p>
      )}

      {!a && loading && (
        <div className="flex justify-center py-16 text-foreground/40">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {a && courbe && (
        <>
          {/* 1. Ce qu'il faut retenir */}
          <Section titre="Ce qu'il faut retenir" sous="Calculé sur les vraies données, à chaque ouverture de la page.">
            <div className="flex flex-col gap-2.5">
              {(toutes ? a.conclusions : a.conclusions.slice(0, 4)).map((c) => (
                <CarteConclusion key={c.titre} c={c} />
              ))}
              {a.conclusions.length === 0 && (
                <p className="text-[12.5px] text-foreground/45">Pas encore assez de données pour conclure.</p>
              )}
            </div>
            {a.conclusions.length > 4 && (
              <button
                onClick={() => setToutes((t) => !t)}
                className="mono-label mt-3 flex items-center gap-1 text-foreground/55"
              >
                {toutes ? "Moins" : `Les ${a.conclusions.length - 4} autres`}
                <ChevronDown className={cn("size-3 transition-transform", toutes && "rotate-180")} />
              </button>
            )}
          </Section>

          {/* 2. Les chiffres de la période */}
          <div>
            <p className="mono-label mb-2 px-1 text-[9px] text-foreground/40">
              {libellePeriode}
              {comparaison}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Tuile label="Joueurs actifs" valeur={String(a.chiffres.actifs.valeur)} c={a.chiffres.actifs} />
              <Tuile label="Nouveaux joueurs" valeur={String(a.chiffres.nouveaux.valeur)} c={a.chiffres.nouveaux} />
              <Tuile label="Jours actifs / joueur" valeur={String(a.chiffres.joursParJoueur.valeur).replace(".", ",")} c={a.chiffres.joursParJoueur} />
              <Tuile label="Temps passé" valeur={duree(a.chiffres.temps.valeur)} c={a.chiffres.temps} />
            </div>
          </div>

          {/* 3. La croissance */}
          <section className="glass rounded-3xl p-5">
            <h2 className="text-[17px] font-bold tracking-tight">Croissance</h2>
            <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {METRIQUES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetrique(m.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors",
                    metrique === m.id ? "bg-foreground text-background" : "glass-soft text-foreground/55"
                  )}
                >
                  {m.court}
                </button>
              ))}
            </div>
            <p className="mono-label mt-4 text-[9px] text-foreground/45">
              {METRIQUES.find((m) => m.id === metrique)?.label}
            </p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-[22px] font-extrabold tracking-tight tabular-nums">{courbe.titre}</span>
              <Delta c={courbe.c} />
            </div>
            <div className="mt-3">
              <Courbe points={courbe.points} avant={courbe.avant} format={format} creux={a.creux} />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-foreground/45">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded bg-foreground" />
                {libellePeriode}
              </span>
              {courbe.avant && (
                <span className="flex items-center gap-1.5">
                  <span className="h-0 w-4 border-t-[1.5px] border-dashed border-foreground/40" />
                  {`les ${jours} jours d'avant`}
                </span>
              )}
              <span>Glisse le doigt sur la courbe pour lire un jour.</span>
            </div>
          </section>

          {/* 4. Qui est là */}
          <Section titre="Qui est là aujourd'hui" sous={`${totalFamilles} comptes, rangés selon leur dernière venue.`}>
            <div className="flex h-3 overflow-hidden rounded-full">
              {a.familles.map((f) =>
                f.noms.length ? (
                  <span
                    key={f.id}
                    className="h-full border-r-2 border-background last:border-0"
                    style={{ width: `${(f.noms.length / Math.max(1, totalFamilles)) * 100}%`, background: encre(TEINTE[f.id]) }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-3 flex flex-col">
              {a.familles.map((f) => (
                <div key={f.id} className="border-b border-foreground/6 last:border-0">
                  <button
                    onClick={() => setOuverte((o) => (o === f.id ? null : f.id))}
                    className="flex w-full items-center gap-3 py-2.5 text-left"
                  >
                    <span className="size-2.5 shrink-0 rounded-full ring-1 ring-foreground/15" style={{ background: encre(TEINTE[f.id]) }} />
                    <span className="min-w-0 flex-1">
                      <span className="text-[13.5px] font-semibold">{f.label}</span>
                      <span className="block text-[11.5px] text-foreground/40">{f.note}</span>
                    </span>
                    <span className="text-[15px] font-extrabold tabular-nums">{f.noms.length}</span>
                    <ChevronDown className={cn("size-3.5 text-foreground/30 transition-transform", ouverte === f.id && "rotate-180")} />
                  </button>
                  {ouverte === f.id && (
                    <p className="pb-3 pl-5.5 text-[12px] leading-relaxed text-foreground/55">
                      {f.noms.length ? [...f.noms].sort((x, y) => x.localeCompare(y, "fr")).join(", ") : "Personne."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 5. La rétention */}
          <Section titre="Rétention" sous="Sur tout l'historique. Revenu après N jours : rouvert l'app N jours ou plus après sa première venue.">
            <div className="flex flex-col gap-2.5">
              {a.retention
                .filter((r) => r.eligibles > 0)
                .map((r) => (
                  <div key={r.jours} className="flex items-center gap-3">
                    <span className="w-[104px] shrink-0 text-[12.5px] font-medium whitespace-nowrap">
                      Après {r.jours} {r.jours === 1 ? "jour" : "jours"}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(r.revenus / r.eligibles) * 100}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[12px] font-bold tabular-nums">{pct(r.revenus / r.eligibles)}</span>
                    <span className="w-11 shrink-0 text-right text-[10.5px] text-foreground/40 tabular-nums">
                      {r.revenus}/{r.eligibles}
                    </span>
                  </div>
                ))}
            </div>
            <p className="mono-label mt-6 mb-2 text-[9px] text-foreground/45">Par semaine d&apos;arrivée · % encore actifs</p>
            <Cohortes cohortes={a.cohortes} />
            <p className="mt-2 text-[11px] leading-snug text-foreground/40">
              Chaque ligne : les joueurs arrivés la semaine du lundi indiqué (et combien). S0 = leur première semaine,
              +1 la suivante, etc. Plus la case est foncée, plus ils sont restés.
            </p>
          </Section>

          {/* 6. Ce qui fait revenir */}
          {a.leviers.length > 0 && (
            <Section
              titre="Ce qui fait revenir"
              sous="Pendant leur première semaine, l'ont-ils fait ? Puis : sont-ils revenus après 7 jours ? Joueurs arrivés il y a 14 jours ou plus."
            >
              <div className="flex flex-col gap-4">
                {a.leviers.map((l) => (
                  <Comparaison
                    key={l.id}
                    label={l.label}
                    avec={l.avecRevenus / l.avec}
                    sans={l.sansRevenus / l.sans}
                    nAvec={l.avec}
                    nSans={l.sans}
                  />
                ))}
              </div>
            </Section>
          )}

          {/* 7. Quand */}
          <Section titre="Quand la ligue ouvre l'app" sous={`Présences par jour et par heure, ${libellePeriode}.`}>
            <CarteHoraire carte={a.carte} />
          </Section>

          {/* 8. Ce qu'ils font */}
          <Section titre="Ce qu'ils font" sous={`${a.chiffres.sessions.valeur} sessions ${libellePeriode} · médiane ${duree(a.dureeMediane)} · ${String(a.actionsParSession).replace(".", ",")} actions par session`}>
            <Barres lignes={a.actions} />
          </Section>
          <Section titre="Pages les plus vues">
            <Barres lignes={a.pages} />
          </Section>

          {/* 9. À relancer */}
          {a.aRelancer.length > 0 && (
            <Section titre="À relancer" sous="Venus plusieurs jours, plus vus depuis une semaine ou plus.">
              <div className="flex flex-col">
                {a.aRelancer.map((j) => (
                  <div key={j.name} className="flex items-center gap-3 border-b border-foreground/6 py-2.5 last:border-0">
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{j.name}</span>
                    <span className="mono-label text-[9px] text-foreground/40">{j.jours} j venus</span>
                    <span className="mono-label w-[66px] text-right text-[9px] text-foreground/55">{relative(j.last, a.now)}</span>
                    <Mail className={cn("size-3.5", j.email ? "text-foreground" : "text-foreground/15")} />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* 10. Par joueur */}
          <section>
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-[16px] font-bold tracking-tight">Par joueur</h2>
              <div className="glass-soft flex rounded-full p-0.5">
                {(
                  [
                    ["recent", "Récents"],
                    ["temps", "Temps"],
                    ["actions", "Actions"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setTri(id)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors",
                      tri === id ? "bg-foreground text-background" : "text-foreground/45"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 px-3.5 pb-2">
              <span className="mono-label flex-1 text-[9px] text-foreground/30">Joueur</span>
              <span className="mono-label w-[62px] text-[9px] text-foreground/30">Vu</span>
              <span className="mono-label w-[30px] text-center text-[9px] text-foreground/30">Ses.</span>
              <span className="mono-label w-[52px] text-right text-[9px] text-foreground/30">Moy.</span>
              <span className="mono-label w-[52px] text-right text-[9px] text-foreground/30">Total</span>
              <span className="mono-label w-[22px] text-right text-[9px] text-foreground/30">@</span>
            </div>
            <div className="glass-soft overflow-hidden rounded-[24px]">
              {joueursTries.map((p) => (
                <div key={p.name} className="flex items-center gap-2 border-b border-foreground/5 px-3.5 py-3 last:border-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="mono-label text-[8px] text-foreground/30">
                      {p.jours} j actifs · {milliers(p.actions)} actions · arrivé le {jjmm(p.premier)}
                    </span>
                  </span>
                  <span className="mono-label w-[62px] text-foreground/45">{relative(p.last, a.now)}</span>
                  <span className="mono-label w-[30px] text-center text-foreground/45">{p.sessions}</span>
                  <span className="mono-label w-[52px] text-right text-foreground/45">{duree(p.moyenne)}</span>
                  <span className="w-[52px] text-right text-[11px] font-bold tabular-nums">{duree(p.temps)}</span>
                  <span className="w-[22px] text-right">
                    <Mail className={cn("ml-auto size-3.5", p.email ? "text-foreground" : "text-foreground/15")} />
                  </span>
                </div>
              ))}
              {joueursTries.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-foreground/40">
                  Personne sur cette période — le journal se remplit tout seul.
                </p>
              )}
            </div>
          </section>

          {/* 11. Les emails collectés */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-foreground/60">
              Emails collectés · {emails.length}/{a.comptes}
            </p>
            {emails.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {emails.map((p) => (
                  <div key={p.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    <span className="mono-label min-w-0 truncate text-foreground/50">{p.contact_email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-foreground/40">
                Aucun pour l&apos;instant — chaque joueur est invité à laisser le sien en tête du fil et dans Réglages.
              </p>
            )}
          </section>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-foreground/30">
            {milliers(a.evenementsLus)} événements lus, depuis le {a.serie[0] ? jjmm(a.serie[0].t) : "—"}. Une session,
            c&apos;est un onglet ouvert ; sa durée, c&apos;est le temps passé au premier plan, mesuré par ses signes de vie
            (l&apos;app en émet un toutes les 90 secondes tant qu&apos;elle est au premier plan) ; un silence de plus de
            5 minutes n&apos;est pas compté. Les visites de moins de 30 secondes ne comptent pas dans les durées.
          </p>
        </>
      )}
    </div>
  );
}
