"use client";

// Bola Agent, côté admin (sous Activité & rétention) : de quoi les joueurs
// parlent avec leur coach, et ce qui leur sert le plus. Demande de Sabri
// (19/10) : la tendance et les besoins, sans jamais voir ce qu'ils se disent.
//
// La source est `agent_sujets` (lecture réservée à l'admin par RLS) : une
// ligne par réponse du coach, avec le sujet rangé par le coach lui-même, le
// raccourci touché, les types de cartes posées, le schéma et l'image. Aucun texte n'y
// est gardé. Le public suit le choix du haut de la page (Joueurs par défaut,
// Admins, Tout le monde). On compare les 30 derniers jours aux 30 d'avant.

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { isAdmin } from "@/lib/sfl/admin";
import {
  LIBELLE_CARTE,
  LIBELLE_RACCOURCI,
  LIBELLE_SUJET,
  SUJETS,
  TYPES_CARTE,
  type Sujet,
  type TypeCarte,
} from "@/lib/sfl/agent";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const JOUR = 86400_000;
const FENETRE = 30 * JOUR;
const PAGE = 1000;

interface Ligne {
  nom: string;
  sujet: Sujet;
  raccourci: string | null;
  cartes: string[];
  image: boolean;
  schema: string | null;
  at: number;
}

function compter<T extends string>(lignes: Ligne[], cle: (l: Ligne) => T[]): Map<T, number> {
  const m = new Map<T, number>();
  for (const l of lignes) for (const k of cle(l)) m.set(k, (m.get(k) ?? 0) + 1);
  return m;
}

function Barres({ lignes, total }: { lignes: { label: string; n: number; avant?: number }[]; total: number }) {
  const max = Math.max(1, ...lignes.map((l) => l.n));
  if (!lignes.length) return <p className="text-[12.5px] text-foreground/40">Rien sur les 30 derniers jours.</p>;
  return (
    <div className="flex flex-col gap-2.5">
      {lignes.map((l) => {
        const monte = l.avant != null && l.n > l.avant;
        const baisse = l.avant != null && l.n < l.avant;
        return (
          <div key={l.label} className="flex items-center gap-3">
            <span className="w-[42%] shrink-0 truncate text-[12.5px] font-medium">{l.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
              <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(l.n / max) * 100}%` }} />
            </span>
            <span className="w-[38px] shrink-0 text-right text-[12px] font-bold tabular-nums">
              {total ? Math.round((l.n / total) * 100) : 0} %
            </span>
            <span className="flex w-[14px] shrink-0 justify-end">
              {monte && <TrendingUp className="size-3 text-foreground/75" />}
              {baisse && <TrendingDown className="size-3 text-foreground/40" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Tuile({ label, valeur }: { label: string; valeur: number }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-[8.5px] text-foreground/45">{label}</p>
      <div className="mt-1.5 text-[24px] leading-none font-extrabold tabular-nums">{valeur}</div>
    </div>
  );
}

export function AgentStats({
  public: public_ = "joueurs",
  admins,
}: {
  /** Qui on regarde : le choix du haut de la page Activité. */
  public?: "joueurs" | "admins" | "tous";
  /** Les comptes admins connus de la base ; à défaut, la liste en dur. */
  admins?: ReadonlySet<string>;
} = {}) {
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [maintenant, setMaintenant] = useState(0);

  const lire = useCallback(async () => {
    const sb = supabase();
    const depuis = new Date(Date.now() - 2 * FENETRE).toISOString();
    const lu: Ligne[] = [];
    for (let debut = 0; ; debut += PAGE) {
      const { data, error } = await sb
        .from("agent_sujets")
        .select("sujet, raccourci, cartes, image, schema, created_at, profiles ( name )")
        .gte("created_at", depuis)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(debut, debut + PAGE - 1);
      if (error) {
        // Pas encore de table (base pas migrée) : la section reste vide.
        setErreur(error.code === "42P01" || error.code === "PGRST205" ? null : error.message);
        setLignes([]);
        return;
      }
      type Brut = { sujet: Sujet; raccourci: string | null; cartes: string[] | null; image: boolean; schema?: string | null; created_at: string; profiles: { name: string } | { name: string }[] | null };
      for (const r of (data ?? []) as Brut[]) {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        lu.push({ nom: p?.name ?? "?", sujet: r.sujet, raccourci: r.raccourci, cartes: r.cartes ?? [], image: r.image, schema: r.schema ?? null, at: new Date(r.created_at).getTime() });
      }
      if (!data || data.length < PAGE) break;
    }
    setMaintenant(Date.now());
    setLignes(lu);
  }, []);

  useEffect(() => {
    Promise.resolve().then(lire);
  }, [lire]);

  const a = useMemo(() => {
    if (!lignes) return null;
    const estAdmin = (nom: string) => (admins ? admins.has(nom) : isAdmin(nom));
    const vues = lignes.filter((l) =>
      public_ === "tous" ? true : public_ === "admins" ? estAdmin(l.nom) : !estAdmin(l.nom)
    );
    const recents = vues.filter((l) => l.at >= maintenant - FENETRE);
    const avant = vues.filter((l) => l.at < maintenant - FENETRE);
    const sujets = compter(recents, (l) => [l.sujet]);
    const sujetsAvant = compter(avant, (l) => [l.sujet]);
    const raccourcis = compter(recents, (l) => (l.raccourci ? [l.raccourci] : ["libre"]));
    const cartes = compter(recents, (l) => l.cartes as TypeCarte[]);
    const joueurs = new Set(recents.map((l) => l.nom)).size;
    const visuels = {
      corps: recents.filter((l) => l.schema === "corps").length,
      terrain: recents.filter((l) => l.schema === "terrain").length,
      image: recents.filter((l) => l.image).length,
    };

    // La tendance : le sujet qui gagne le plus de place d'une période à l'autre.
    const part = (m: Map<Sujet, number>, n: number, s: Sujet) => (n ? (m.get(s) ?? 0) / n : 0);
    const monte = avant.length >= 10
      ? SUJETS.map((s) => ({ s, d: part(sujets, recents.length, s) - part(sujetsAvant, avant.length, s) }))
          .filter((x) => x.d >= 0.05)
          .sort((x, y) => y.d - x.d)[0]
      : undefined;

    return {
      echanges: recents.length,
      joueurs,
      visuels: visuels.corps + visuels.terrain + visuels.image,
      montres: [
        { label: "Schéma du corps", n: visuels.corps },
        { label: "Schéma du terrain", n: visuels.terrain },
        { label: "Image générée", n: visuels.image },
      ].filter((v) => v.n),
      sujets: SUJETS.filter((s) => sujets.get(s))
        .map((s) => ({ label: LIBELLE_SUJET[s], n: sujets.get(s)!, avant: avant.length >= 10 ? Math.round(part(sujetsAvant, avant.length, s) * recents.length) : undefined }))
        .sort((x, y) => y.n - x.n),
      raccourcis: [...raccourcis]
        .map(([k, n]) => ({ label: k === "libre" ? "Question écrite" : (LIBELLE_RACCOURCI[k as keyof typeof LIBELLE_RACCOURCI] ?? k), n }))
        .sort((x, y) => y.n - x.n),
      cartes: TYPES_CARTE.filter((t) => cartes.get(t)).map((t) => ({ label: LIBELLE_CARTE[t], n: cartes.get(t)! })).sort((x, y) => y.n - x.n),
      totalCartes: [...cartes.values()].reduce((x, y) => x + y, 0),
      monte: monte ? LIBELLE_SUJET[monte.s] : null,
      premier: [...sujets].sort((x, y) => y[1] - x[1])[0]?.[0] as Sujet | undefined,
    };
  }, [lignes, maintenant, public_, admins]);

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-[17px] font-bold tracking-tight">Bola Agent</h2>
      <p className="mt-0.5 text-[12px] leading-snug text-foreground/45">
        30 derniers jours, admins exclus. Seul le sujet de chaque échange est compté, jamais ce qui s&apos;y dit.
      </p>
      {erreur && <p className="mt-3 text-[12.5px] text-[#FF6B5E]">{erreur}</p>}
      {a && (
        <div className="mt-4 flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2">
            <Tuile label="Échanges" valeur={a.echanges} />
            <Tuile label="Joueurs" valeur={a.joueurs} />
            <Tuile label="Visuels" valeur={a.visuels} />
          </div>
          {a.premier && (
            <p className="text-[13.5px] leading-snug font-semibold">
              Ce qu&apos;ils viennent chercher d&apos;abord : {LIBELLE_SUJET[a.premier].toLowerCase()}.
              {a.monte && a.monte !== LIBELLE_SUJET[a.premier] && <> En hausse : {a.monte.toLowerCase()}.</>}
            </p>
          )}
          <div>
            <p className="mono-label mb-2.5 text-[8.5px] text-foreground/45">Sujets</p>
            <Barres lignes={a.sujets} total={a.echanges} />
          </div>
          <div>
            <p className="mono-label mb-2.5 text-[8.5px] text-foreground/45">Comment ils demandent</p>
            <Barres lignes={a.raccourcis} total={a.echanges} />
          </div>
          <div className={cn(!a.montres.length && "hidden")}>
            <p className="mono-label mb-2.5 text-[8.5px] text-foreground/45">Ce qu&apos;il montre</p>
            <Barres lignes={a.montres} total={a.visuels} />
          </div>
          <div className={cn(!a.cartes.length && "hidden")}>
            <p className="mono-label mb-2.5 text-[8.5px] text-foreground/45">Cartes posées</p>
            <Barres lignes={a.cartes} total={a.totalCartes} />
          </div>
        </div>
      )}
    </section>
  );
}
