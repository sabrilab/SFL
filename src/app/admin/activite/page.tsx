"use client";

// Activité & rétention — le gestionnaire de l'admin.
//
// Qui s'est connecté, quand, à quel rythme : lu depuis le journal `activity`
// (réservé à l'admin par RLS) et la table des profils (emails collectés).
// Trois blocs : les chiffres du moment (aujourd'hui / 7 j / 30 j), la courbe
// des actifs des 14 derniers jours, puis le détail par joueur et les emails.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/lib/supabase";
import { ACCOUNTS } from "@/lib/sfl/auth/accounts";
import { cn } from "@/lib/utils";

interface ActivityRow {
  player_id: string;
  kind: string;
  created_at: string;
  profiles: { name: string } | { name: string }[] | null;
}

interface ProfileRow {
  name: string;
  contact_email: string | null;
}

interface Data {
  activity: { name: string; kind: string; at: number }[];
  profiles: ProfileRow[];
  /** Instant de la lecture — figé pour garder le rendu pur. */
  now: number;
}

const DAY = 24 * 3600 * 1000;

function relative(ts: number, now: number): string {
  const d = now - ts;
  if (d < 3600 * 1000) return `il y a ${Math.max(1, Math.round(d / 60000))} min`;
  if (d < DAY) return `il y a ${Math.round(d / (3600 * 1000))} h`;
  const days = Math.round(d / DAY);
  return `il y a ${days} j`;
}

export default function ActivitePage() {
  const session = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sb = supabase();
      const since = new Date(Date.now() - 30 * DAY).toISOString();
      const [act, prof] = await Promise.all([
        sb
          .from("activity")
          .select("player_id, kind, created_at, profiles ( name )")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(5000),
        sb.from("profiles").select("name, contact_email"),
      ]);
      if (act.error) throw new Error(act.error.message);
      if (prof.error) throw new Error(prof.error.message);
      const activity = ((act.data ?? []) as unknown as ActivityRow[]).map((r) => {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        return { name: p?.name ?? "?", kind: r.kind, at: new Date(r.created_at).getTime() };
      });
      setData({ activity, profiles: (prof.data ?? []) as ProfileRow[], now: Date.now() });
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
    const dayKey = (ts: number) => new Date(ts).toISOString().slice(0, 10);
    const activeSince = (ms: number) =>
      new Set(data.activity.filter((a) => now - a.at < ms).map((a) => a.name)).size;

    // Par joueur : dernière venue + jours actifs sur 7/30.
    const byPlayer = new Map<string, { last: number; days30: Set<string>; days7: Set<string> }>();
    for (const a of data.activity) {
      const cur = byPlayer.get(a.name) ?? { last: 0, days30: new Set(), days7: new Set() };
      cur.last = Math.max(cur.last, a.at);
      cur.days30.add(dayKey(a.at));
      if (now - a.at < 7 * DAY) cur.days7.add(dayKey(a.at));
      byPlayer.set(a.name, cur);
    }

    // Courbe : actifs distincts par jour, 14 derniers jours.
    const days: { label: string; count: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const key = dayKey(now - i * DAY);
      const count = new Set(
        data.activity.filter((a) => dayKey(a.at) === key).map((a) => a.name)
      ).size;
      days.push({ label: key.slice(8), count });
    }

    const emails = data.profiles.filter((p) => p.contact_email);
    const connectedEver = byPlayer.size;

    return {
      today: activeSince(DAY),
      week: activeSince(7 * DAY),
      month: activeSince(30 * DAY),
      connectedEver,
      totalAccounts: ACCOUNTS.length,
      days,
      players: [...byPlayer.entries()]
        .map(([name, s]) => ({
          name,
          last: s.last,
          days7: s.days7.size,
          days30: s.days30.size,
          email: data.profiles.find((p) => p.name === name)?.contact_email ?? null,
        }))
        .sort((a, b) => b.last - a.last),
      emails,
    };
  }, [data]);

  if (!session?.admin) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-16 text-center text-sm text-foreground/45">
        Cette page est réservée à l&apos;admin de la ligue.
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

  const maxDay = Math.max(1, ...(stats?.days.map((d) => d.count) ?? [1]));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-4 sm:py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight">Activité</h1>
          <p className="mt-1 text-[13px] text-foreground/42">
            Qui se connecte, à quel rythme — 30 derniers jours
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

      {error && (
        <p className="glass-soft rounded-2xl p-3.5 text-[12.5px] text-[#FF6B5E]">
          {error} — as-tu bien rejoué le script SQL (table activity) ?
        </p>
      )}

      {stats && (
        <>
          {/* Les chiffres du moment */}
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                [stats.today, "Aujourd'hui"],
                [stats.week, "7 jours"],
                [stats.month, "30 jours"],
                [`${stats.connectedEver}/${stats.totalAccounts}`, "Déjà venus"],
              ] as const
            ).map(([v, l]) => (
              <div key={l} className="glass rounded-2xl px-2 py-3.5 text-center">
                <div className="text-[22px] leading-none font-extrabold tabular-nums">{v}</div>
                <p className="mono-label mt-1.5 text-[8px] text-foreground/40">{l}</p>
              </div>
            ))}
          </div>

          {/* Actifs par jour, 14 jours */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-primary">Joueurs actifs par jour</p>
            <div className="mt-4 flex items-end gap-1" style={{ height: 80 }}>
              {stats.days.map((d, i) => (
                <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                  <span className="text-[9px] font-bold text-foreground/50 tabular-nums">
                    {d.count > 0 ? d.count : ""}
                  </span>
                  <div
                    className={cn(
                      "w-full rounded-t",
                      i === stats.days.length - 1 ? "bg-primary" : "bg-foreground/15"
                    )}
                    style={{ height: `${Math.max(3, (d.count / maxDay) * 56)}px` }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-1 flex justify-between">
              <span className="mono-label text-foreground/30">il y a 14 j</span>
              <span className="mono-label text-primary">aujourd&apos;hui</span>
            </div>
          </section>

          {/* Détail par joueur */}
          <section>
            <div className="flex items-center gap-3 px-2 pb-2.5">
              <span className="mono-label flex-1 text-[9px] text-foreground/30">Joueur</span>
              <span className="mono-label w-[70px] text-[9px] text-foreground/30">Dernière venue</span>
              <span className="mono-label w-[34px] text-center text-[9px] text-foreground/30">J/7</span>
              <span className="mono-label w-[34px] text-center text-[9px] text-foreground/30">J/30</span>
              <span className="mono-label w-[26px] text-right text-[9px] text-foreground/30">@</span>
            </div>
            <div className="glass-soft overflow-hidden rounded-[24px]">
              {stats.players.map((p) => (
                <div
                  key={p.name}
                  className="flex items-center gap-3 border-b border-white/5 px-3.5 py-3 last:border-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="mono-label w-[70px] text-foreground/45">{relative(p.last, data?.now ?? p.last)}</span>
                  <span className="mono-label w-[34px] text-center text-foreground/45">{p.days7}</span>
                  <span className="mono-label w-[34px] text-center text-foreground/45">{p.days30}</span>
                  <span className="w-[26px] text-right">
                    <Mail
                      className={cn("ml-auto size-3.5", p.email ? "text-primary" : "text-foreground/15")}
                    />
                  </span>
                </div>
              ))}
              {stats.players.length === 0 && (
                <p className="px-4 py-8 text-center text-[13px] text-foreground/40">
                  Personne ne s&apos;est encore connecté — le journal se remplit tout seul.
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
                Aucun pour l&apos;instant — chaque joueur est invité à laisser le sien en tête
                du fil et dans Réglages.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
