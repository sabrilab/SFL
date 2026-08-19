"use client";

// Activité & rétention — le gestionnaire de l'admin.
//
// Lecture du journal `activity` (réservé à l'admin par RLS) et de la table des
// profils (emails collectés). Tout est recalculé côté navigateur à partir des
// événements bruts : rien n'est agrégé en base, donc rien à maintenir quand on
// ajoute un type d'événement.
//
// Ce qu'on en tire :
//   · les chiffres du moment (actifs, sessions, temps passé) sur la période
//     choisie — 7 j, 30 j, 90 j ou tout ;
//   · la courbe des actifs par jour et l'histogramme des heures de connexion ;
//   · la répartition des actions et les pages les plus vues ;
//   · la rétention : qui revient, qui n'est venu qu'une fois, qui a décroché ;
//   · le détail par joueur : dernière venue, sessions, temps total et moyen ;
//   · les emails collectés.
//
// Une SESSION d'usage = un identifiant tiré à l'ouverture d'un onglet
// (cf. lib/sfl/activity.ts). Sa durée est l'écart entre son premier et son
// dernier événement ; les battements réguliers de l'app la rendent mesurable.
// Une session sans second événement compte 0 : c'est une visite éclair.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { isAdmin } from "@/lib/sfl/admin";
import { supabase } from "@/lib/supabase";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { cn } from "@/lib/utils";

/* ------------------------------- réglages -------------------------------- */

const DAY = 24 * 3600 * 1000;

/** Périodes proposées. `days: null` = depuis le tout début. */
const PERIODES = [
  { id: "7", label: "7 j", days: 7 },
  { id: "30", label: "30 j", days: 30 },
  { id: "90", label: "90 j", days: 90 },
  { id: "all", label: "Tout", days: null },
] as const;

type PeriodeId = (typeof PERIODES)[number]["id"];

/** Libellés lisibles des types d'événements. */
const KIND_FR: Record<string, string> = {
  login: "Connexions",
  open: "Ouvertures du jour",
  heartbeat: "Temps passé",
  close: "Mises en arrière-plan",
  view: "Pages vues",
  presence: "Réponses de présence",
  vote: "Votes",
  duel: "Duels",
  match: "Matchs d'Arène",
  pack: "Packs ouverts",
  achat: "Achats de cartes",
  recherche: "Recherches",
};

/** Libellés lisibles des pages. */
const PATH_FR: Record<string, string> = {
  "/": "Feed",
  "/profil": "Profil",
  "/duel": "Arène",
  "/collection": "Collection",
  "/discussions": "Discussions",
  "/boutique": "Boutique",
  "/carte": "Ma carte",
  "/stats": "Historique",
  "/recherche": "Recherche",
  "/reglages": "Réglages",
};

/* ------------------------------- outillage ------------------------------- */

interface Evenement {
  name: string;
  kind: string;
  path: string | null;
  session: string | null;
  at: number;
}

interface ProfileRow {
  name: string;
  contact_email: string | null;
}

interface Data {
  evenements: Evenement[];
  profiles: ProfileRow[];
  /** Instant de la lecture — figé pour garder le rendu pur. */
  now: number;
}

const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);

function relative(ts: number, now: number): string {
  const d = now - ts;
  if (d < 3600 * 1000) return `il y a ${Math.max(1, Math.round(d / 60000))} min`;
  if (d < DAY) return `il y a ${Math.round(d / (3600 * 1000))} h`;
  return `il y a ${Math.round(d / DAY)} j`;
}

/** 0 → « — », 95 s → « 1 min », 3 900 s → « 1 h 05 ». */
function duree(ms: number): string {
  if (!ms || ms < 30_000) return "—";
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return `${h} h ${String(min % 60).padStart(2, "0")}`;
}

/** Espace fine insécable tous les trois chiffres, sans dépendre de la locale. */
const milliers = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

/* ------------------------------- briques UI ------------------------------ */

function Chiffre({ valeur, label }: { valeur: string | number; label: string }) {
  return (
    <div className="glass rounded-2xl px-2 py-3.5 text-center">
      <div className="text-[21px] leading-none font-extrabold tabular-nums">{valeur}</div>
      <p className="mono-label mt-1.5 text-[8px] leading-tight text-foreground/40">{label}</p>
    </div>
  );
}

function Barres({
  titre,
  lignes,
  suffixe,
}: {
  titre: string;
  lignes: { label: string; value: number; hint?: string }[];
  suffixe?: string;
}) {
  const max = Math.max(1, ...lignes.map((l) => l.value));
  return (
    <section className="glass rounded-3xl p-5">
      <p className="mono-label text-primary">{titre}</p>
      {lignes.length === 0 ? (
        <p className="mt-3 text-[12.5px] text-foreground/40">Rien sur cette période.</p>
      ) : (
        <div className="mt-3.5 flex flex-col gap-2.5">
          {lignes.map((l) => (
            <div key={l.label} className="flex items-center gap-3">
              <span className="w-[38%] shrink-0 truncate text-[12.5px] font-medium">
                {l.label}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
                <span
                  className="block h-full rounded-full bg-primary/70"
                  style={{ width: `${(l.value / max) * 100}%` }}
                />
              </span>
              <span className="w-[58px] shrink-0 text-right text-[12px] font-bold tabular-nums">
                {milliers(l.value)}
                {suffixe}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function ActivitePage() {
  const session = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [periode, setPeriode] = useState<PeriodeId>("30");
  const [tri, setTri] = useState<"recent" | "temps" | "actions">("recent");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = supabase();
      // On lit tout l'historique disponible et on découpe côté navigateur :
      // le filtre de période devient instantané, sans nouvelle requête.
      const [act, prof] = await Promise.all([
        sb
          .from("activity")
          .select("kind, created_at, path, session_id, profiles ( name )")
          .order("created_at", { ascending: false })
          .limit(20000),
        sb.from("profiles").select("name, contact_email"),
      ]);
      if (act.error) throw new Error(act.error.message);
      if (prof.error) throw new Error(prof.error.message);

      type Brut = {
        kind: string;
        created_at: string;
        path: string | null;
        session_id: string | null;
        profiles: { name: string } | { name: string }[] | null;
      };
      const evenements = ((act.data ?? []) as unknown as Brut[]).map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return {
          name: p?.name ?? "?",
          kind: r.kind,
          path: r.path,
          session: r.session_id,
          at: new Date(r.created_at).getTime(),
        };
      });
      setData({ evenements, profiles: (prof.data ?? []) as ProfileRow[], now: Date.now() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture impossible.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session?.server || !session.admin) return;
    // Micro-tâche : aucun setState synchrone dans le corps de l'effet.
    Promise.resolve().then(load);
  }, [session?.server, session?.admin, load]);

  const stats = useMemo(() => {
    if (!data) return null;
    const now = data.now;
    const jours = PERIODES.find((p) => p.id === periode)?.days ?? null;
    const depuis = jours === null ? 0 : now - jours * DAY;
    const events = data.evenements.filter((e) => e.at >= depuis);

    /* ---------------------------- les sessions --------------------------- */
    // Une session = un session_id. Les vieux événements n'en ont pas : on les
    // regroupe par joueur et par jour, ce qui reste une approximation honnête.
    const sessions = new Map<
      string,
      { name: string; debut: number; fin: number; actions: number }
    >();
    for (const e of events) {
      const key = e.session ?? `legacy:${e.name}:${dayKey(e.at)}`;
      const cur = sessions.get(key);
      if (cur) {
        cur.debut = Math.min(cur.debut, e.at);
        cur.fin = Math.max(cur.fin, e.at);
        cur.actions += 1;
      } else {
        sessions.set(key, { name: e.name, debut: e.at, fin: e.at, actions: 1 });
      }
    }
    const listeSessions = [...sessions.values()];
    const dureeTotale = listeSessions.reduce((a, s) => a + (s.fin - s.debut), 0);
    const avecDuree = listeSessions.filter((s) => s.fin - s.debut >= 30_000);
    const durees = avecDuree.map((s) => s.fin - s.debut).sort((a, b) => a - b);
    const mediane = durees.length ? durees[Math.floor(durees.length / 2)] : 0;

    /* ------------------------------ les actifs --------------------------- */
    const actifsDepuis = (ms: number) =>
      new Set(events.filter((e) => now - e.at < ms).map((e) => e.name)).size;

    /* -------------------------- la courbe des jours ---------------------- */
    // Au-delà d'un mois, on regroupe par semaine pour garder la lisibilité.
    const parJour = new Map<string, Set<string>>();
    for (const e of events) {
      const k = dayKey(e.at);
      if (!parJour.has(k)) parJour.set(k, new Set());
      parJour.get(k)!.add(e.name);
    }
    const span = jours ?? Math.max(1, Math.ceil((now - (events.at(-1)?.at ?? now)) / DAY) + 1);
    const pas = span > 45 ? 7 : 1;
    const nbBarres = Math.min(30, Math.ceil(span / pas));
    const courbe: { label: string; count: number }[] = [];
    for (let i = nbBarres - 1; i >= 0; i--) {
      const noms = new Set<string>();
      for (let d = 0; d < pas; d++) {
        const k = dayKey(now - (i * pas + d) * DAY);
        parJour.get(k)?.forEach((n) => noms.add(n));
      }
      courbe.push({ label: dayKey(now - i * pas * DAY).slice(5), count: noms.size });
    }

    /* --------------------------- les heures creuses ---------------------- */
    const heures = Array.from({ length: 24 }, () => 0);
    for (const e of events) heures[new Date(e.at).getHours()] += 1;

    /* ---------------------------- les actions ---------------------------- */
    const parKind = new Map<string, number>();
    for (const e of events) parKind.set(e.kind, (parKind.get(e.kind) ?? 0) + 1);
    const actions = [...parKind.entries()]
      // « heartbeat » n'est pas une action : c'est la mesure du temps.
      .filter(([k]) => k !== "heartbeat" && k !== "close")
      .map(([k, v]) => ({ label: KIND_FR[k] ?? k, value: v }))
      .sort((a, b) => b.value - a.value);

    /* ------------------------------ les pages ---------------------------- */
    const parPage = new Map<string, number>();
    for (const e of events) {
      if (e.kind !== "view" || !e.path) continue;
      parPage.set(e.path, (parPage.get(e.path) ?? 0) + 1);
    }
    const pages = [...parPage.entries()]
      .map(([p, v]) => ({ label: PATH_FR[p] ?? p, value: v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    /* ----------------------------- par joueur ---------------------------- */
    const byPlayer = new Map<
      string,
      {
        premier: number;
        last: number;
        jours: Set<string>;
        jours7: Set<string>;
        actions: number;
        sessions: number;
        temps: number;
      }
    >();
    for (const e of events) {
      const cur = byPlayer.get(e.name) ?? {
        premier: e.at,
        last: 0,
        jours: new Set<string>(),
        jours7: new Set<string>(),
        actions: 0,
        sessions: 0,
        temps: 0,
      };
      cur.premier = Math.min(cur.premier, e.at);
      cur.last = Math.max(cur.last, e.at);
      cur.jours.add(dayKey(e.at));
      if (now - e.at < 7 * DAY) cur.jours7.add(dayKey(e.at));
      if (e.kind !== "heartbeat" && e.kind !== "close") cur.actions += 1;
      byPlayer.set(e.name, cur);
    }
    for (const s of listeSessions) {
      const cur = byPlayer.get(s.name);
      if (!cur) continue;
      cur.sessions += 1;
      cur.temps += s.fin - s.debut;
    }

    const joueurs = [...byPlayer.entries()].map(([name, s]) => ({
      name,
      last: s.last,
      jours: s.jours.size,
      jours7: s.jours7.size,
      actions: s.actions,
      sessions: s.sessions,
      temps: s.temps,
      moyenne: s.sessions ? s.temps / s.sessions : 0,
      email: data.profiles.find((p) => p.name === name)?.contact_email ?? null,
    }));

    /* ----------------------------- rétention ----------------------------- */
    // Trois familles simples et actionnables, sur la période regardée.
    const fideles = joueurs.filter((p) => p.jours >= 5).length;
    const uneFois = joueurs.filter((p) => p.jours === 1).length;
    const decroches = joueurs.filter((p) => now - p.last > 14 * DAY).length;
    const revenus7 = joueurs.filter((p) => p.jours7 >= 2).length;

    const emails = data.profiles.filter((p) => p.contact_email);

    return {
      // chiffres du moment
      today: actifsDepuis(DAY),
      week: actifsDepuis(7 * DAY),
      periodeActifs: joueurs.length,
      totalAccounts: ACCOUNTS.length,
      sessions: listeSessions.length,
      dureeMoyenne: avecDuree.length ? dureeTotale / avecDuree.length : 0,
      dureeMediane: mediane,
      dureeTotale,
      actionsTotal: events.filter((e) => e.kind !== "heartbeat" && e.kind !== "close").length,
      actionsParSession: listeSessions.length
        ? Math.round(
            (events.filter((e) => e.kind !== "heartbeat" && e.kind !== "close").length /
              listeSessions.length) *
              10
          ) / 10
        : 0,
      // séries
      courbe,
      pas,
      heures,
      actions,
      pages,
      // rétention
      fideles,
      uneFois,
      decroches,
      revenus7,
      // détail
      joueurs,
      emails,
      evenementsLus: data.evenements.length,
    };
  }, [data, periode]);

  if (!session?.admin) {
    // Le rôle qui compte ici est celui de la BASE : c'est lui que les règles
    // de lecture appliquent. Un compte admin dans l'app mais pas encore
    // reconnu en base lit un écran vide sans comprendre pourquoi — on le lui
    // dit, avec le geste qui répare.
    const adminConnu = isAdmin(session?.name);
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        {adminConnu ? (
          <>
            Ton compte est administrateur dans l&apos;app, mais la base ne le sait pas encore.
            Déconnecte-toi puis reconnecte-toi — si ça ne suffit pas, passe une fois par
            Réglages → Installation Supabase.
          </>
        ) : (
          <>Cette page est réservée à l&apos;admin de la ligue.</>
        )}
      </div>
    );
  }
  if (!session.server) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Reconnecte-toi (session serveur) pour lire le journal d&apos;activité.
      </div>
    );
  }

  const maxJour = Math.max(1, ...(stats?.courbe.map((d) => d.count) ?? [1]));
  const maxHeure = Math.max(1, ...(stats?.heures ?? [1]));

  const joueursTries = [...(stats?.joueurs ?? [])].sort((a, b) =>
    tri === "temps" ? b.temps - a.temps : tri === "actions" ? b.actions - a.actions : b.last - a.last
  );

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Activité</h1>
          <p className="mt-1 text-[13px] text-foreground/42">
            Qui vient, quand, combien de temps, pour y faire quoi
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="glass-soft mono-label flex items-center gap-1.5 rounded-full px-3 py-1.5 text-foreground/60"
        >
          {loading ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Actualiser
        </button>
      </div>

      {/* La période */}
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

      {stats && (
        <>
          {/* Les chiffres du moment */}
          <div className="grid grid-cols-4 gap-2">
            <Chiffre valeur={stats.today} label="Actifs aujourd'hui" />
            <Chiffre valeur={stats.week} label="Actifs 7 jours" />
            <Chiffre
              valeur={`${stats.periodeActifs}/${stats.totalAccounts}`}
              label="Venus sur la période"
            />
            <Chiffre valeur={milliers(stats.sessions)} label="Sessions" />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <Chiffre valeur={duree(stats.dureeMoyenne)} label="Session moyenne" />
            <Chiffre valeur={duree(stats.dureeMediane)} label="Session médiane" />
            <Chiffre valeur={duree(stats.dureeTotale)} label="Temps cumulé" />
            <Chiffre valeur={stats.actionsParSession} label="Actions / session" />
          </div>

          {/* Actifs par jour (ou par semaine sur les longues périodes) */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-primary">
              Joueurs actifs {stats.pas === 7 ? "par semaine" : "par jour"}
            </p>
            <div className="mt-4 flex items-end gap-1" style={{ height: 80 }}>
              {stats.courbe.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] font-bold text-foreground/50 tabular-nums">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t",
                      i === stats.courbe.length - 1 ? "bg-primary" : "bg-foreground/15"
                    )}
                    style={{ height: `${Math.max(3, (d.count / maxJour) * 56)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between">
              <span className="mono-label text-foreground/30">{stats.courbe[0]?.label}</span>
              <span className="mono-label text-primary">aujourd&apos;hui</span>
            </div>
          </section>

          {/* À quelle heure la ligue ouvre l'app */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-primary">Heures de connexion</p>
            <div className="mt-4 flex items-end gap-[2px]" style={{ height: 56 }}>
              {stats.heures.map((n, h) => (
                <div key={h} className="flex h-full flex-1 flex-col justify-end">
                  <div
                    className={cn("w-full rounded-t", n > 0 ? "bg-primary/60" : "bg-foreground/10")}
                    style={{ height: `${Math.max(2, (n / maxHeure) * 52)}px` }}
                    title={`${h} h — ${n} événements`}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between">
              {["0 h", "6 h", "12 h", "18 h", "23 h"].map((l) => (
                <span key={l} className="mono-label text-foreground/30">
                  {l}
                </span>
              ))}
            </div>
          </section>

          {/* Ce qu'ils font, et où */}
          <Barres titre="Ce qu'ils font" lignes={stats.actions} />
          <Barres titre="Pages les plus vues" lignes={stats.pages} />

          {/* Rétention */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-primary">Rétention</p>
            <div className="mt-3.5 grid grid-cols-2 gap-2.5">
              {(
                [
                  [stats.fideles, "Fidèles", "5 jours actifs ou plus"],
                  [stats.revenus7, "Revenus cette semaine", "au moins 2 jours sur 7"],
                  [stats.uneFois, "Une seule visite", "venus puis disparus"],
                  [stats.decroches, "Décrochés", "plus rien depuis 14 jours"],
                ] as const
              ).map(([v, titre, note]) => (
                <div key={titre} className="glass-soft rounded-2xl px-3.5 py-3">
                  <div className="text-[24px] leading-none font-extrabold tabular-nums">{v}</div>
                  <p className="mt-1.5 text-[12.5px] font-semibold">{titre}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-foreground/40">{note}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Détail par joueur */}
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
              <span className="mono-label w-[30px] text-center text-[9px] text-foreground/30">
                Ses.
              </span>
              <span className="mono-label w-[52px] text-right text-[9px] text-foreground/30">
                Moy.
              </span>
              <span className="mono-label w-[52px] text-right text-[9px] text-foreground/30">
                Total
              </span>
              <span className="mono-label w-[22px] text-right text-[9px] text-foreground/30">@</span>
            </div>

            <div className="glass-soft overflow-hidden rounded-[24px]">
              {joueursTries.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-2 border-b border-white/5 px-3.5 py-3 last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                    <span className="mono-label text-[8px] text-foreground/30">
                      {p.jours} j actifs · {milliers(p.actions)} actions
                    </span>
                  </span>
                  <span className="mono-label w-[62px] text-foreground/45">
                    {relative(p.last, data?.now ?? p.last)}
                  </span>
                  <span className="mono-label w-[30px] text-center text-foreground/45">
                    {p.sessions}
                  </span>
                  <span className="mono-label w-[52px] text-right text-foreground/45">
                    {duree(p.moyenne)}
                  </span>
                  <span className="w-[52px] text-right text-[11px] font-bold tabular-nums">
                    {duree(p.temps)}
                  </span>
                  <span className="w-[22px] text-right">
                    <Mail
                      className={cn(
                        "ml-auto size-3.5",
                        p.email ? "text-primary" : "text-foreground/15"
                      )}
                    />
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

          {/* Les emails collectés */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-primary">
              Emails collectés · {stats.emails.length}/{stats.totalAccounts}
            </p>
            {stats.emails.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {stats.emails.map((p) => (
                  <div key={p.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-semibold">{p.name}</span>
                    <span className="mono-label min-w-0 truncate text-foreground/50">
                      {p.contact_email}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-[12.5px] text-foreground/40">
                Aucun pour l&apos;instant — chaque joueur est invité à laisser le sien en tête du
                fil et dans Réglages.
              </p>
            )}
          </section>

          <p className="px-1 pb-2 text-[11px] leading-relaxed text-foreground/30">
            {milliers(stats.evenementsLus)} événements lus. Une session, c&apos;est un onglet
            ouvert ; sa durée est l&apos;écart entre son premier et son dernier signe de vie
            (l&apos;app en émet un toutes les 90 secondes tant qu&apos;elle est au premier plan).
            Les visites de moins de 30 secondes ne comptent pas dans les moyennes.
          </p>
        </>
      )}
    </div>
  );
}
