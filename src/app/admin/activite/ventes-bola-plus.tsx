"use client";

// Analytics → 4. Revenu → Ventes Bola Plus (Sabri, 16/11/2026 19:51 : « met
// moi un truc dans l'admin pour suivre en direct les gens qui ont acheté, et
// comprendre aussi via ça la décision d'achat »). Pour l'admin seul.
//
// En direct : la liste est relue toutes les 30 s (/api/bola-plus/ventes, qui
// lit les abonnements chez Stripe). Pour chaque vente : qui, quelle formule,
// quand, d'où il est arrivé sur la page Bola Plus, quelles fiches il a
// ouvertes. Puis « Ce qui décide » : la répartition des ventes par porte
// d'entrée et par fiche, les visites et le temps moyens avant d'acheter, et
// combien d'heures il restait au compte à rebours.
//
// D'où vient le parcours : noté sur le téléphone du joueur
// (bola-plus-parcours-store.ts, aucune table, aucune migration), il part avec
// « S'abonner » dans les métadonnées Stripe (bp_*). Tant que Stripe n'est pas
// branché, la section le dit, et montre le parcours de ce téléphone : ce que
// chaque vente portera.

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  NOM_FICHE,
  NOM_SOURCE,
  decision,
  mrr,
  table,
  type Parcours,
  type Vente,
} from "@/lib/sfl/bola-plus-parcours";
import { parcoursIci } from "@/lib/sfl/bola-plus-parcours-store";
import { Section } from "./cadre";

type Etat =
  | { branche: false }
  | { branche: true; ventes: Vente[] }
  | "erreur"
  | null;

const nomSource = (s: string | undefined) =>
  NOM_SOURCE[(s || "direct") as keyof typeof NOM_SOURCE] ?? s ?? "Direct";
const nomFiche = (f: string) => NOM_FICHE[f as keyof typeof NOM_FICHE] ?? f;
const euros = (c: number) =>
  `${(c / 100).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
const heure = (ms: number) => {
  const d = new Date(ms);
  const auj = new Date().toDateString() === d.toDateString();
  return auj
    ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
};
const minutes = (s: number) =>
  s < 60 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`;

function Tuile({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="glass-soft rounded-2xl px-3.5 py-3">
      <p className="mono-label text-micro text-encre-3">{label}</p>
      <p className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">
        {valeur}
      </p>
    </div>
  );
}

/** Une barre : un nom, sa part, son nombre. */
function Barre({ nom, n, total }: { nom: string; n: number; total: number }) {
  const p = total ? n / total : 0;
  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-3 text-corps">
        <span className="font-semibold">{nom}</span>
        <span className="text-encre-3 tabular-nums">
          {n} · {Math.round(p * 100)} %
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
        <div
          className="h-full rounded-full bg-foreground"
          style={{ width: `${p * 100}%` }}
        />
      </div>
    </li>
  );
}

function Pastilles({ fiches }: { fiches: string[] }) {
  if (!fiches.length) return <span className="text-encre-3">aucune fiche</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {fiches.map((f) => (
        <span
          key={f}
          className="rounded-full px-2 py-[3px] text-[11px] leading-none font-semibold ring-1 ring-foreground/20"
        >
          {nomFiche(f)}
        </span>
      ))}
    </span>
  );
}

/** Le parcours de ce téléphone : ce qu'une vente faite d'ici porterait. */
function CeTelephone({ p }: { p: Parcours }) {
  const fiches = Object.keys(p.fiches);
  return (
    <div className="glass-soft flex flex-col gap-2 rounded-2xl px-3.5 py-3 text-corps">
      <p className="mono-label text-micro text-encre-3">Ce téléphone</p>
      <p className="tabular-nums">
        {p.visites} visite{p.visites > 1 ? "s" : ""} · {minutes(p.secondes)} sur
        la page · dernière entrée :{" "}
        {p.derniere ? nomSource(p.derniere) : "aucune"}
      </p>
      <Pastilles fiches={fiches} />
    </div>
  );
}

export function VentesBolaPlus() {
  const [etat, setEtat] = useState<Etat>(null);
  // Le parcours de ce téléphone, lu une fois (localStorage : jamais au rendu serveur, la page admin est client).
  const [ici] = useState<Parcours | null>(() =>
    typeof window === "undefined" ? null : parcoursIci(),
  );

  useEffect(() => {
    let annule = false;
    const lire = async () => {
      try {
        const { data } = await supabase().auth.getSession();
        const r = await fetch("/api/bola-plus/ventes", {
          headers: {
            Authorization: `Bearer ${data.session?.access_token ?? ""}`,
          },
          cache: "no-store",
        });
        // 503 : le serveur n'a pas encore ses clés (un aperçu) ; comme Stripe pas branché.
        if (r.status === 503) {
          if (!annule) setEtat({ branche: false });
          return;
        }
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { branche: boolean; ventes: Vente[] };
        if (!annule)
          setEtat(
            j.branche
              ? { branche: true, ventes: j.ventes }
              : { branche: false },
          );
      } catch {
        if (!annule) setEtat("erreur");
      }
    };
    void lire();
    const t = window.setInterval(() => void lire(), 30_000);
    return () => {
      annule = true;
      window.clearInterval(t);
    };
  }, []);

  const vivantes = useMemo(
    () =>
      etat && etat !== "erreur" && etat.branche
        ? etat.ventes.filter(
            (v) => v.statut === "active" || v.statut === "trialing",
          )
        : [],
    [etat],
  );
  const toutes = etat && etat !== "erreur" && etat.branche ? etat.ventes : [];
  const d = useMemo(() => decision(vivantes), [vivantes]);
  const aujourdhui = toutes.filter(
    (v) => new Date(v.le).toDateString() === new Date().toDateString(),
  ).length;

  return (
    <Section
      id="ventes-bola-plus"
      titre="Ventes Bola Plus"
      sous="En direct, et ce qui a décidé chaque achat."
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 text-legende text-encre-3">
          <span className="relative flex size-2">
            {etat && etat !== "erreur" && etat.branche && (
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-foreground/60 motion-reduce:animate-none" />
            )}
            <span className="relative inline-flex size-2 rounded-full bg-foreground" />
          </span>
          En direct · relu toutes les 30 s
        </div>

        {etat === null && <p className="text-corps text-encre-3">Lecture…</p>}
        {etat === "erreur" && (
          <p className="text-corps text-encre-3">
            Les ventes n&apos;ont pas pu être lues.
          </p>
        )}
        {etat && etat !== "erreur" && !etat.branche && (
          <p className="text-corps text-encre-3">
            Stripe n&apos;est pas encore branché : les ventes s&apos;afficheront
            ici dès la première.
          </p>
        )}

        {etat && etat !== "erreur" && etat.branche && (
          <>
            <div className="grid grid-cols-3 gap-2">
              <Tuile label="Abonnés" valeur={String(vivantes.length)} />
              <Tuile label="Par mois" valeur={euros(mrr(toutes))} />
              <Tuile label="Aujourd'hui" valeur={String(aujourdhui)} />
            </div>

            {toutes.length === 0 ? (
              <p className="text-corps text-encre-3">
                Aucune vente pour l&apos;instant.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-foreground/10">
                {toutes.slice(0, 50).map((v) => (
                  <li key={v.id} className="flex flex-col gap-1.5 py-2.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate font-bold">{v.nom || "?"}</span>
                      <span className="shrink-0 text-legende text-encre-3 tabular-nums">
                        {v.formule === "annuel" ? "Annuel" : "Mensuel"} ·{" "}
                        {euros(v.centimes)} · {heure(v.le)}
                        {v.statut !== "active" && v.statut !== "trialing"
                          ? " · arrêté"
                          : ""}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-legende text-encre-2">
                      <span>Entré par {nomSource(v.meta.bp_source)}</span>
                      {v.meta.bp_visites && (
                        <span className="tabular-nums">
                          · {v.meta.bp_visites} visites
                        </span>
                      )}
                      {v.meta.bp_secondes && (
                        <span className="tabular-nums">
                          · {minutes(Number(v.meta.bp_secondes))}
                        </span>
                      )}
                    </div>
                    <Pastilles fiches={Object.keys(table(v.meta.bp_fiches))} />
                  </li>
                ))}
              </ul>
            )}

            {d.n > 0 && (
              <div className="flex flex-col gap-4">
                <h3 className="mono-label text-encre-3">Ce qui décide</h3>
                <div className="flex flex-col gap-2">
                  <p className="text-legende text-encre-3">
                    Par où ils sont arrivés
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {Object.entries(d.sources)
                      .sort((a, b) => b[1] - a[1])
                      .map(([s, n]) => (
                        <Barre key={s} nom={nomSource(s)} n={n} total={d.n} />
                      ))}
                  </ul>
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-legende text-encre-3">
                    Les fiches ouvertes avant d&apos;acheter
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {Object.keys(NOM_FICHE).map((f) => (
                      <Barre
                        key={f}
                        nom={nomFiche(f)}
                        n={d.fiches[f] ?? 0}
                        total={d.n}
                      />
                    ))}
                  </ul>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Tuile
                    label="Visites"
                    valeur={d.visitesMoy.toLocaleString("fr-FR", {
                      maximumFractionDigits: 1,
                    })}
                  />
                  <Tuile
                    label="Sur la page"
                    valeur={minutes(d.minutesMoy * 60)}
                  />
                  <Tuile
                    label="Rebours"
                    valeur={
                      d.reboursMoyH === null
                        ? "–"
                        : `${Math.round(d.reboursMoyH)} h`
                    }
                  />
                </div>
              </div>
            )}
          </>
        )}

        {ici && ici.visites > 0 && <CeTelephone p={ici} />}
      </div>
    </Section>
  );
}
