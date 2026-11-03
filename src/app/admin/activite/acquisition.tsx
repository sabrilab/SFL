"use client";

// Analytics → 1. Acquisition : qui arrive, et par où (Sabri, 03/11/2026 :
// « surtout les gens qui arrivent sur getbola.app et qui s'inscrivent »).
//
//   · l'entonnoir de getbola.app : le site vu, « Crée ta carte » ouvert,
//     chaque écran de l'inscription, le compte créé (table site_visites,
//     lib/sfl/site-visites.ts) ; la plus grosse perte marquée ;
//   · jour par jour, les visiteurs, les inscriptions ouvertes, les comptes ;
//   · d'où ils viennent : le site qui les envoie (instagram.com…) ;
//   · par où sont entrés les comptes de la période : seuls par le site, le
//     lien ou le code d'un parrain, le lien d'une équipe, ou ajoutés par la
//     ligue (sans ligne dans parrainages : l'effectif de la SFL).
//
// Les visites se comptent depuis la mise en ligne du 03/11/2026 : avant,
// seuls les comptes existent.

import { useMemo, useState } from "react";
import { jjmm, pct, type Profil } from "@/lib/sfl/retention";
import { cn } from "@/lib/utils";
import { Section, Entonnoir } from "./cadre";
import { Barres, Courbe } from "./graphiques";

export interface SiteVisite {
  visiteur: string;
  etape: string;
  source: string | null;
  /** Minuit local du jour de la visite. */
  t: number;
}

export type Canal = "site" | "lien" | "code" | "equipe";

const MARCHES: { etape: string; label: string }[] = [
  { etape: "site", label: "Ont vu getbola.app" },
  { etape: "inscription", label: "Ont ouvert « Crée ta carte »" },
  { etape: "identite", label: "Qui es-tu ?" },
  { etape: "jeu", label: "Ton jeu" },
  { etape: "gabarit", label: "Ton gabarit" },
  { etape: "compte", label: "Ton compte" },
  { etape: "cree", label: "Compte créé" },
];

const CANAUX: { id: Canal | "ligue"; label: string }[] = [
  { id: "site", label: "Seuls, par getbola.app" },
  { id: "lien", label: "Lien d'un parrain" },
  { id: "code", label: "Code d'un parrain" },
  { id: "equipe", label: "Lien d'une équipe" },
  { id: "ligue", label: "Ajoutés par la ligue" },
];

const SERIES = [
  { id: "site", label: "Visiteurs" },
  { id: "inscription", label: "Inscriptions ouvertes" },
  { id: "comptes", label: "Comptes créés" },
] as const;
type SerieId = (typeof SERIES)[number]["id"];

/** Les chiffres d'acquisition de la période, pour L'essentiel (./vue.tsx). */
export function chiffresAcquisition(site: SiteVisite[] | null, depuis: number, jusqua: number) {
  if (!site) return null;
  const dans = (v: SiteVisite) => v.t >= depuis && v.t < jusqua;
  const qui = (etape: string) => new Set(site.filter((v) => v.etape === etape && dans(v)).map((v) => v.visiteur)).size;
  return { visiteurs: qui("site"), ouvertes: qui("inscription"), crees: qui("cree") };
}

export function Acquisition({
  site,
  profiles,
  canaux,
  jours,
  depuis,
}: {
  site: SiteVisite[] | null;
  profiles: Profil[];
  canaux: ReadonlyMap<string, Canal> | null;
  /** Les minuits des jours de la période, dans l'ordre (la courbe). */
  jours: number[];
  depuis: number;
}) {
  const [serie, setSerie] = useState<SerieId>("site");
  const [ouvert, setOuvert] = useState(false);

  const a = useMemo(() => {
    const visites = (site ?? []).filter((v) => v.t >= depuis);
    const parEtape = new Map<string, Set<string>>();
    for (const v of visites) {
      let s = parEtape.get(v.etape);
      if (!s) parEtape.set(v.etape, (s = new Set()));
      s.add(v.visiteur);
    }
    const de = (e: string) => parEtape.get(e) ?? new Set<string>();
    const duSite = [...de("inscription")].filter((v) => de("site").has(v)).length;
    const marches = MARCHES.map((m, i) => ({
      label: m.label,
      n: de(m.etape).size,
      note:
        i === 1 && de("inscription").size > 0
          ? `${duSite} passés par la page d'accueil, ${de("inscription").size - duSite} venus droit sur l'inscription`
          : undefined,
    }));

    // D'où ils viennent : la première source connue de chaque visiteur.
    const source = new Map<string, string>();
    for (const v of [...visites].sort((x, y) => x.t - y.t)) {
      if (!source.has(v.visiteur)) source.set(v.visiteur, v.source ?? "");
      else if (!source.get(v.visiteur) && v.source) source.set(v.visiteur, v.source);
    }
    const parSource = new Map<string, number>();
    for (const s of source.values()) parSource.set(s || "Direct ou inconnu", (parSource.get(s || "Direct ou inconnu") ?? 0) + 1);
    const sources = [...parSource.entries()].map(([label, value]) => ({ label, value })).sort((x, y) => y.value - x.value);

    // Jour par jour.
    const parJour = (e: string) => {
      const m = new Map<number, Set<string>>();
      for (const v of visites) {
        if (v.etape !== e) continue;
        let s = m.get(v.t);
        if (!s) m.set(v.t, (s = new Set()));
        s.add(v.visiteur);
      }
      return (t: number) => m.get(t)?.size ?? 0;
    };
    const comptesDuJour = new Map<number, number>();
    const recents = profiles.filter((p) => p.created_at != null && p.created_at >= depuis);
    for (const p of recents) {
      const d = new Date(p.created_at!);
      d.setHours(0, 0, 0, 0);
      comptesDuJour.set(d.getTime(), (comptesDuJour.get(d.getTime()) ?? 0) + 1);
    }
    const siteJ = parJour("site");
    const inscJ = parJour("inscription");
    const courbes: Record<SerieId, { t: number; v: number }[]> = {
      site: jours.map((t) => ({ t, v: siteJ(t) })),
      inscription: jours.map((t) => ({ t, v: inscJ(t) })),
      comptes: jours.map((t) => ({ t, v: comptesDuJour.get(t) ?? 0 })),
    };

    // Par où sont entrés les comptes de la période.
    const parCanal = new Map<string, string[]>();
    for (const p of recents) {
      const c = canaux?.get(p.name) ?? "ligue";
      const l = parCanal.get(c);
      if (l) l.push(p.name);
      else parCanal.set(c, [p.name]);
    }
    const entres = CANAUX.map((c) => ({ ...c, noms: parCanal.get(c.id) ?? [] })).filter((c) => c.noms.length > 0);

    const premier = site && site.length > 0 ? Math.min(...site.map((v) => v.t)) : null;
    return { marches, sources, courbes, entres, comptes: recents.length, premier, rien: visites.length === 0 };
  }, [site, profiles, canaux, jours, depuis]);

  const total = a.marches[0].n;
  const crees = a.marches.at(-1)!.n;

  return (
    <>
      <Section
        id="entonnoir"
        titre="De getbola.app au compte"
        sous={
          site === null
            ? undefined
            : a.premier
              ? `Chaque visiteur compté une fois par étape, depuis le ${jjmm(a.premier)}.`
              : undefined
        }
      >
        {site === null ? (
          <p className="text-corps text-encre-3">Les visites de la page d&apos;accueil arrivent avec la prochaine mise en ligne.</p>
        ) : a.rien ? (
          <p className="text-corps text-encre-3">Aucune visite sur cette période : elles se comptent depuis le 03/11.</p>
        ) : (
          <>
            <div className="mb-4 flex items-baseline gap-2.5">
              <span className="shrink-0 text-titre-m font-extrabold tracking-tight whitespace-nowrap tabular-nums">{total ? pct(crees / total) : "—"}</span>
              <span className="text-corps text-encre-3">
                des visiteurs créent leur compte ({crees} sur {total})
              </span>
            </div>
            <Entonnoir marches={a.marches} />
          </>
        )}
      </Section>

      <Section id="jour-par-jour" titre="Jour par jour">
        <div className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
          {SERIES.map((s) => (
            <button
              key={s.id}
              onClick={() => setSerie(s.id)}
              className={cn(
                "shrink-0 px-3 py-1.5 text-petit font-semibold",
                serie === s.id ? "bouton-principal" : "bouton-secondaire text-encre-3"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-titre-m font-extrabold tracking-tight tabular-nums">
          {a.courbes[serie].reduce((s, p) => s + p.v, 0)}
          <span className="ml-2 text-corps font-semibold text-encre-3">sur la période</span>
        </p>
        <div className="mt-2">
          <Courbe points={a.courbes[serie]} format={(v) => String(Math.round(v))} hauteur={170} />
        </div>
      </Section>

      <Section id="sources" titre="D'où ils viennent" sous="Le site qui a envoyé chaque visiteur, ou la source de son lien.">
        {a.sources.length > 0 ? (
          <Barres lignes={a.sources} />
        ) : (
          <p className="text-corps text-encre-3">Rien sur cette période.</p>
        )}
      </Section>

      <Section id="canaux" titre="Par où sont entrés les comptes" sous={`${a.comptes} comptes créés sur la période.`}>
        {a.entres.length > 0 ? (
          <div className="flex flex-col">
            {a.entres.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-b border-foreground/6 py-2.5 last:border-0">
                <span className="min-w-0 flex-1">
                  <span className="text-ligne font-semibold">{c.label}</span>
                  {ouvert && (
                    <span className="mt-0.5 block text-petit leading-snug text-encre-3">
                      {[...c.noms].sort((x, y) => x.localeCompare(y, "fr")).join(", ")}
                    </span>
                  )}
                </span>
                <span className="text-legende text-encre-3 tabular-nums">{pct(c.noms.length / Math.max(1, a.comptes))}</span>
                <span className="w-8 text-right text-lecture font-extrabold tabular-nums">{c.noms.length}</span>
              </div>
            ))}
            <button onClick={() => setOuvert((o) => !o)} className="mono-label mt-2 self-start text-encre-3">
              {ouvert ? "Masquer les noms" : "Voir les noms"}
            </button>
          </div>
        ) : (
          <p className="text-corps text-encre-3">Aucun compte créé sur cette période.</p>
        )}
        {canaux === null && <p className="mt-2 text-legende text-encre-3">Les parrainages n&apos;ont pas pu être lus.</p>}
      </Section>
    </>
  );
}
