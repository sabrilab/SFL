"use client";

// Le parrainage, côté admin (sous Activité & rétention) : la route vers 500
// joueurs (Sabri, 24/10/2026 ; lib/sfl/parrainage.ts).
//
//   · le compteur des comptes, sa jauge vers 500 et le rythme qui y mène ;
//   · la viralité (le coefficient viral) : les filleuls des 30 derniers
//     jours pour chaque compte d'il y a 30 jours. Au-dessus de 1, chaque
//     nouveau en amène un autre et la courbe s'emballe d'elle-même ;
//   · le tunnel des liens et des codes : partagés, ouverts, inscriptions
//     commencées, comptes créés, premier match, Bola Team ;
//   · les canaux (lien, code, lien d'équipe) et la boule de neige,
//     génération par génération (les filleuls de filleuls) ;
//   · ceux qui font venir le plus, avec leur code, que l'admin peut couper
//     (un lien qui circule là où il ne devrait pas) ou rallumer.
//
// Les sources, lues par l'admin seul (RLS) : parrainage_codes, parrainages,
// parrainage_visites (comptées sans être lues), et parrainage_suivi() pour
// le premier match et l'équipe : les matchs privés ne se lisent pas
// autrement. Le public du haut de la page ne s'applique pas ici : ce sont les
// comptes, admins compris, qui vont vers 500.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { erreurSansTable } from "@/lib/sfl/consentement";
import { OBJECTIF_JOUEURS } from "@/lib/sfl/parrainage";
import { supabase } from "@/lib/supabase";

const JOUR = 86400_000;
const PAGE = 1000;
/** Le parrainage n'est pas encore en base : la section le dit sans alarmer. */
const PAS_ENCORE = "Le parrainage arrive avec la prochaine mise en ligne.";

interface Profil {
  id: string;
  name: string;
  at: number | null;
}

interface Lien {
  filleul: string;
  parrain: string | null;
  canal: "lien" | "code" | "equipe";
  sfl: boolean;
  at: number;
}

interface Code {
  code: string;
  joueur: string;
  actif: boolean;
  partages: number;
}

interface Donnees {
  comptes: Profil[];
  liens: Lien[];
  codes: Code[];
  ouverts: number;
  commences: number;
  suivi: Map<string, { joue: boolean; equipe: boolean }>;
  now: number;
}

function Tuile({ label, valeur }: { label: string; valeur: number | string }) {
  return (
    <div className="glass rounded-2xl px-3.5 py-3">
      <p className="mono-label text-micro text-encre-3">{label}</p>
      <div className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">{valeur}</div>
    </div>
  );
}

/**
 * Le tunnel : une barre par étape, à l'échelle de la plus grande, et la part
 * gardée depuis l'étape d'avant. Un lien partagé s'ouvre parfois plusieurs
 * fois (un groupe WhatsApp) : l'étape qui grandit dit alors « × 1,3 ».
 */
function Tunnel({ etapes }: { etapes: { label: string; n: number }[] }) {
  const max = Math.max(1, ...etapes.map((e) => e.n));
  return (
    <div className="flex flex-col gap-2.5">
      {etapes.map((e, i) => {
        const avant = i > 0 ? etapes[i - 1].n : null;
        return (
          <div key={e.label} className="flex items-center gap-3">
            <span className="w-[42%] shrink-0 truncate text-corps font-medium">{e.label}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
              <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(e.n / max) * 100}%` }} />
            </span>
            <span className="w-[34px] shrink-0 text-right text-petit font-bold tabular-nums">{e.n}</span>
            <span className="w-[38px] shrink-0 text-right text-legende text-encre-3 tabular-nums">
              {!avant
                ? ""
                : e.n > avant
                  ? `× ${(e.n / avant).toLocaleString("fr-FR", { maximumFractionDigits: 1 })}`
                  : `${Math.round((e.n / avant) * 100)} %`}
            </span>
          </div>
        );
      })}
    </div>
  );
}

async function toutLire<T>(lire: (debut: number) => PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>) {
  const lu: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await lire(debut);
    if (error) return { lu, error };
    lu.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { lu, error: null };
  }
}

const date = (t: number) => new Date(t).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function ParrainageStats() {
  const [d, setD] = useState<Donnees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  const lire = useCallback(async () => {
    const sb = supabase();
    const [profils, liens, codes, ouverts, commences, suivi] = await Promise.all([
      toutLire<{ id: string; name: string; created_at: string | null }>((debut) =>
        sb
          .from("profiles")
          .select("id, name, created_at")
          .eq("valide", true)
          .eq("pseudo_a_choisir", false)
          .order("id")
          .range(debut, debut + PAGE - 1)
      ),
      toutLire<{ filleul: string; parrain: string | null; canal: Lien["canal"]; parrain_sfl: boolean; created_at: string }>(
        (debut) =>
          sb
            .from("parrainages")
            .select("filleul, parrain, canal, parrain_sfl, created_at")
            .order("filleul")
            .range(debut, debut + PAGE - 1)
      ),
      toutLire<Code>((debut) =>
        sb.from("parrainage_codes").select("code, joueur, actif, partages").order("code").range(debut, debut + PAGE - 1)
      ),
      sb.from("parrainage_visites").select("id", { count: "exact", head: true }).eq("etape", "ouvert"),
      sb.from("parrainage_visites").select("id", { count: "exact", head: true }).eq("etape", "commence"),
      sb.rpc("parrainage_suivi"),
    ]);
    const echec = profils.error ?? liens.error ?? codes.error ?? ouverts.error ?? commences.error ?? suivi.error;
    if (echec) {
      setErreur(erreurSansTable(echec.code) || echec.code === "PGRST202" ? PAS_ENCORE : echec.message);
      setD(null);
      return;
    }
    setErreur(null);
    setD({
      comptes: profils.lu.map((p) => ({ id: p.id, name: p.name, at: p.created_at ? new Date(p.created_at).getTime() : null })),
      liens: liens.lu.map((l) => ({
        filleul: l.filleul,
        parrain: l.parrain,
        canal: l.canal,
        sfl: l.parrain_sfl,
        at: new Date(l.created_at).getTime(),
      })),
      codes: codes.lu,
      ouverts: ouverts.count ?? 0,
      commences: commences.count ?? 0,
      suivi: new Map(
        ((suivi.data ?? []) as { filleul: string; a_joue: boolean; en_equipe: boolean }[]).map((s) => [
          s.filleul,
          { joue: s.a_joue, equipe: s.en_equipe },
        ])
      ),
      now: Date.now(),
    });
  }, []);

  useEffect(() => {
    Promise.resolve().then(lire);
  }, [lire]);

  const a = useMemo(() => {
    if (!d) return null;
    const noms = new Map(d.comptes.map((p) => [p.id, p.name]));
    const n = d.comptes.length;
    const il30 = d.now - 30 * JOUR;

    // Le rythme : les comptes des quatre dernières semaines, prolongés jusqu'à 500.
    const recents = d.comptes.filter((p) => p.at != null && p.at >= d.now - 28 * JOUR).length;
    const semaine = d.comptes.filter((p) => p.at != null && p.at >= d.now - 7 * JOUR).length;
    const parJour = recents / 28;
    const reste = Math.max(0, OBJECTIF_JOUEURS - n);
    const arrivee = reste === 0 ? null : parJour > 0 ? d.now + (reste / parJour) * JOUR : null;

    // Le coefficient viral : filleuls des 30 derniers jours ÷ comptes d'il y a 30 jours.
    const avant = d.comptes.filter((p) => p.at == null || p.at < il30).length;
    const filleuls30 = d.liens.filter((l) => l.at >= il30).length;
    const k = avant ? filleuls30 / avant : 0;

    // Le tunnel des liens personnels et des codes (le lien d'une équipe a le sien).
    const perso = d.liens.filter((l) => l.canal !== "equipe");
    const partages = d.codes.reduce((s, c) => s + c.partages, 0);
    const etapes = [
      { label: "Liens partagés", n: partages },
      { label: "Liens ouverts", n: d.ouverts },
      { label: "Début d'inscription", n: d.commences },
      { label: "Comptes créés", n: perso.length },
      { label: "Premier match", n: perso.filter((l) => d.suivi.get(l.filleul)?.joue).length },
      { label: "Bola Team", n: perso.filter((l) => d.suivi.get(l.filleul)?.equipe).length },
    ];

    // La boule de neige : 1re génération, venue d'un compte qui n'a pas de
    // parrain ; 2e, venue d'un filleul ; et ainsi de suite.
    const parrainDe = new Map(d.liens.map((l) => [l.filleul, l.parrain]));
    const gen = new Map<string, number>();
    const generation = (f: string): number => {
      const connue = gen.get(f);
      if (connue) return connue;
      let g = 1;
      let p = parrainDe.get(f) ?? null;
      const vus = new Set([f]);
      while (p && parrainDe.has(p) && !vus.has(p)) {
        vus.add(p);
        g++;
        p = parrainDe.get(p) ?? null;
      }
      gen.set(f, g);
      return g;
    };
    const generations: number[] = [];
    for (const l of d.liens) {
      const g = generation(l.filleul);
      generations[g - 1] = (generations[g - 1] ?? 0) + 1;
    }

    // Ceux qui font venir : leurs filleuls, leurs partages, leur code.
    const parrains = new Map<string, { filleuls: number; sfl: boolean }>();
    for (const l of d.liens) {
      if (!l.parrain) continue;
      const p = parrains.get(l.parrain) ?? { filleuls: 0, sfl: false };
      parrains.set(l.parrain, { filleuls: p.filleuls + 1, sfl: p.sfl || l.sfl });
    }
    const codeDe = new Map(d.codes.map((c) => [c.joueur, c]));
    const ids = new Set([...parrains.keys(), ...d.codes.filter((c) => c.partages > 0 || !c.actif).map((c) => c.joueur)]);
    const classement = [...ids]
      .map((id) => ({
        id,
        nom: noms.get(id) ?? "?",
        filleuls: parrains.get(id)?.filleuls ?? 0,
        sfl: parrains.get(id)?.sfl ?? false,
        code: codeDe.get(id) ?? null,
      }))
      .sort((x, y) => y.filleuls - x.filleuls || (y.code?.partages ?? 0) - (x.code?.partages ?? 0) || x.nom.localeCompare(y.nom, "fr"));

    return {
      n,
      semaine,
      arrivee,
      filleuls: d.liens.length,
      parrains: parrains.size,
      k,
      etapes,
      canaux: {
        lien: d.liens.filter((l) => l.canal === "lien").length,
        code: d.liens.filter((l) => l.canal === "code").length,
        equipe: d.liens.filter((l) => l.canal === "equipe").length,
      },
      generations,
      classement,
    };
  }, [d]);

  async function basculer(code: Code, nom: string) {
    if (code.actif && !window.confirm(`Couper le lien de ${nom} (${code.code}) ? Il affichera « Lien expiré ».`)) return;
    setOccupe(code.code);
    try {
      const { error } = await supabase().rpc("parrainage_code_actif", { c: code.code, actif: !code.actif });
      if (error) {
        toast.error("Refusé par le serveur.");
        return;
      }
      toast.success(code.actif ? `Lien de ${nom} coupé.` : `Lien de ${nom} rallumé.`);
      await lire();
    } finally {
      setOccupe(null);
    }
  }

  const fr2 = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="glass rounded-3xl p-5">
      <h2 className="text-titre font-bold tracking-tight">Parrainage</h2>
      <p className="mt-0.5 text-petit leading-snug text-encre-3">
        {`Vers ${OBJECTIF_JOUEURS} joueurs : d'où viennent les comptes, et où le tunnel perd du monde.`}
      </p>
      {erreur && <p className="mt-3 text-corps text-encre-3">{erreur}</p>}
      {a && !erreur && (
        <div className="mt-4 flex flex-col gap-5">
          <div>
            <div className="flex items-end gap-2">
              <span className="text-affiche leading-[0.85] font-extrabold tabular-nums">{a.n}</span>
              <span className="mono-label pb-0.5 text-micro text-encre-3">/ {OBJECTIF_JOUEURS} comptes</span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/8"
              role="meter"
              aria-valuemin={0}
              aria-valuemax={OBJECTIF_JOUEURS}
              aria-valuenow={a.n}
              aria-label={`${a.n} comptes sur ${OBJECTIF_JOUEURS}`}
            >
              <span
                className="block h-full rounded-full bg-foreground/70"
                style={{ width: `${Math.min(100, (a.n / OBJECTIF_JOUEURS) * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-corps text-encre-3">
              +{a.semaine} cette semaine
              {a.n >= OBJECTIF_JOUEURS
                ? " · objectif atteint"
                : a.arrivee
                  ? ` · à ce rythme, ${OBJECTIF_JOUEURS} le ${date(a.arrivee)}`
                  : ""}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Tuile label="Filleuls" valeur={a.filleuls} />
            <Tuile label="Parrains" valeur={a.parrains} />
            <Tuile label="Viralité" valeur={fr2(a.k)} />
          </div>
          <p className="-mt-2 text-corps leading-snug text-encre-3">
            {a.k >= 1
              ? "Chaque compte en amène plus d'un en 30 jours : la croissance s'entretient d'elle-même."
              : `Pour 100 comptes, ${Math.round(a.k * 100)} filleuls en 30 jours. À partir de 100, la courbe s'emballe.`}
          </p>

          <div>
            <p className="mono-label mb-2.5 text-micro text-encre-3">Tunnel des liens et des codes</p>
            <Tunnel etapes={a.etapes} />
          </div>

          <div className="flex flex-col gap-1.5 text-corps text-encre-2">
            <p>
              <span className="mono-label mr-2 text-micro text-encre-3">Canaux</span>
              {`lien ${a.canaux.lien} · code ${a.canaux.code} · lien d'équipe ${a.canaux.equipe}`}
            </p>
            {a.generations.length > 0 && (
              <p>
                <span className="mono-label mr-2 text-micro text-encre-3">Générations</span>
                {a.generations.map((g, i) => `${i + 1}${i ? "e" : "re"} ${g ?? 0}`).join(" · ")}
              </p>
            )}
          </div>

          {a.classement.length > 0 && (
            <div>
              <p className="mono-label mb-1 text-micro text-encre-3">Ceux qui font venir</p>
              <div className="flex flex-col">
                {a.classement.slice(0, 15).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 border-t border-foreground/8 py-2 first:border-t-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ligne font-semibold">
                        {p.nom}
                        {p.sfl && <span className="mono-label ml-2 text-micro text-encre-3">SFL</span>}
                      </span>
                      <span className="block truncate font-mono text-legende text-encre-3">
                        {p.code ? `${p.code.code} · ${p.code.partages} partage${p.code.partages > 1 ? "s" : ""}` : "lien d'équipe"}
                        {p.code && !p.code.actif && " · coupé"}
                      </span>
                    </span>
                    <span className="text-titre font-extrabold tabular-nums">{p.filleuls}</span>
                    {p.code && (
                      <button
                        type="button"
                        disabled={occupe === p.code.code}
                        onClick={() => void basculer(p.code!, p.nom)}
                        className={`${p.code.actif ? "bouton-discret bouton--rouge" : "bouton-secondaire"} px-3 py-1.5 text-petit font-semibold disabled:opacity-50`}
                      >
                        {p.code.actif ? "Couper" : "Rallumer"}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
