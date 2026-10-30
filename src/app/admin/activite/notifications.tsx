"use client";

// Admin → Activité & rétention → Notifications. Sabri, 23/10 : « combien ont
// activé la notification et ce à quoi ils ont répondu suite à un motif […]
// Range bien pour qu'on arrive encore bien à s'y retrouver dans l'analyse
// pour améliorer ».
//
// Dans l'ordre :
//   1. trois chiffres : les joueurs qui les ont activées, la part des
//      notifications touchées, la part suivie du geste qu'elles attendaient ;
//   2. ce qu'il faut en retenir ;
//   3. la courbe des joueurs qui les ont activées, et pourquoi pas les
//      autres joueurs actifs ;
//   4. l'invitation de l'ouverture : proposée, et ce qu'ils en font ;
//   5. chaque motif, rangé par famille (lib/sfl/motifs-notif.ts) ;
//   6. le détail par joueur (un nom ouvre sa fiche).
//
// La partie lit ses tables, réservées à l'admin par RLS : push_envois (une
// ligne par notification et par joueur, sans son texte), push_historique
// (les téléphones qui arrivent et s'en vont), push_abonnements (ceux
// d'aujourd'hui) et le journal d'usage, kind 'notifs'. Elle suit le public et
// la période du haut de la page ; lib/sfl/stats-notifs.ts compte.
//
// Dans un aperçu (Vercel), tant que la base n'a pas les tables, elle montre
// des données d'exemple (lib/sfl/stats-notifs-demo.ts), et le dit.

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Lightbulb, Loader2, TrendingUp, TriangleAlert } from "lucide-react";
import { estMotif, REPONSES_NOTIF } from "@/lib/sfl/motifs-notif";
import { jjmm, milliers, pct } from "@/lib/sfl/retention";
import {
  analyserNotifs,
  delaiCourt,
  part,
  type DonneesNotifs,
  type EnvoiLu,
  type FamilleNotifs,
  type GesteNotifs,
  type LigneMotif,
  type MouvementLu,
  type Retenir,
  type Taux,
} from "@/lib/sfl/stats-notifs";
import { DEMO_NOTIFS, notifsDemo } from "@/lib/sfl/stats-notifs-demo";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Courbe, encre } from "./graphiques";

const PAGE = 1000;
/** Garde-fou : on ne lit pas plus que ça de lignes par table. */
const MAX = 200000;

type Lecture =
  | { etat: "lecture" }
  | { etat: "pret"; donnees: DonneesNotifs; actifsDemo: string[] | null }
  | { etat: "absent" }
  | { etat: "erreur"; message: string };

type Reponse = PromiseLike<{ data: unknown[] | null; error: { code?: string; message: string } | null }>;

/** Toute une table, page par page (le serveur ne rend jamais plus de PAGE lignes). */
async function toutLire<T>(page: (debut: number) => Reponse) {
  const lu: T[] = [];
  for (let debut = 0; debut < MAX; debut += PAGE) {
    const { data, error } = await page(debut);
    if (error) return { lu, error };
    lu.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) break;
  }
  return { lu, error: null };
}

const sansTable = (code?: string) => code === "42P01" || code === "PGRST205";
const ms = (t: string | null) => (t ? new Date(t).getTime() : null);

async function lireNotifs(now: number): Promise<Lecture> {
  const sb = supabase();
  const fin = (debut: number) => debut + PAGE - 1;
  const [profils, envois, historique, abonnements, journal] = await Promise.all([
    sb.from("profiles").select("id, name"),
    toutLire<{
      user_id: string;
      motif: string;
      acceptes: number | null;
      envoyee_le: string;
      recue_le: string | null;
      ouverte_le: string | null;
      effet: string | null;
    }>((debut) =>
      sb
        .from("push_envois")
        .select("user_id, motif, acceptes, envoyee_le, recue_le, ouverte_le, effet")
        .order("envoyee_le")
        .order("id")
        .range(debut, fin(debut))
    ),
    toutLire<{ user_id: string; appareil: string; service: string; evenement: "ajout" | "retrait"; le: string }>((debut) =>
      sb.from("push_historique").select("user_id, appareil, service, evenement, le").order("id").range(debut, fin(debut))
    ),
    toutLire<{ user_id: string; created_at: string }>((debut) =>
      sb.from("push_abonnements").select("user_id, created_at").order("endpoint").range(debut, fin(debut))
    ),
    toutLire<{ created_at: string; meta: Record<string, unknown> | null; profiles: { name: string } | { name: string }[] | null }>(
      (debut) =>
        sb
          .from("activity")
          .select("created_at, meta, profiles ( name )")
          .eq("kind", "notifs")
          .order("id")
          .range(debut, fin(debut))
    ),
  ]);

  if (sansTable(envois.error?.code)) {
    if (!DEMO_NOTIFS) return { etat: "absent" };
    const { donnees, actifs } = notifsDemo(now);
    return { etat: "pret", donnees, actifsDemo: actifs };
  }
  const erreur = profils.error ?? envois.error ?? abonnements.error;
  if (erreur) return { etat: "erreur", message: erreur.message };

  const noms = new Map(((profils.data ?? []) as { id: string; name: string }[]).map((p) => [p.id, p.name]));
  const nom = (id: string) => noms.get(id) ?? "?";
  const lus: EnvoiLu[] = envois.lu.map((e) => ({
    nom: nom(e.user_id),
    motif: e.motif,
    acceptes: e.acceptes,
    envoyee: new Date(e.envoyee_le).getTime(),
    recue: ms(e.recue_le),
    ouverte: ms(e.ouverte_le),
    effet: e.effet,
  }));
  // Sans historique lisible, l'analyse part des abonnements présents.
  const mouvements: MouvementLu[] | null = historique.error
    ? null
    : historique.lu.map((m) => ({
        nom: nom(m.user_id),
        appareil: m.appareil,
        service: m.service,
        evenement: m.evenement,
        le: new Date(m.le).getTime(),
      }));
  const gestes: GesteNotifs[] = [];
  for (const r of journal.lu) {
    const meta = r.meta ?? {};
    if (typeof meta.geste !== "string") continue;
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    gestes.push({
      nom: p?.name ?? "?",
      geste: meta.geste,
      ou: typeof meta.ou === "string" ? meta.ou : null,
      etat: typeof meta.etat === "string" ? meta.etat : null,
      at: new Date(r.created_at).getTime(),
    });
  }
  return {
    etat: "pret",
    donnees: {
      envois: lus,
      mouvements,
      abonnements: abonnements.lu.map((a) => ({ nom: nom(a.user_id), depuis: new Date(a.created_at).getTime() })),
      gestes,
    },
    actifsDemo: null,
  };
}

/* ------------------------------- briques UI ------------------------------ */

function Tuile({ label, valeur, sous }: { label: string; valeur: string; sous: string }) {
  return (
    <div className="glass rounded-2xl px-3 py-3">
      <p className="mono-label text-micro whitespace-nowrap text-encre-3">{label}</p>
      <div className="mt-1.5 text-titre-g leading-none font-extrabold tabular-nums">{valeur}</div>
      <p className="mt-1.5 text-legende leading-tight text-encre-3 tabular-nums">{sous}</p>
    </div>
  );
}

function Titre({ children, droite }: { children: React.ReactNode; droite?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-baseline justify-between gap-3">
      <p className="mono-label text-micro text-encre-3">{children}</p>
      {droite}
    </div>
  );
}

function LigneRetenir({ r }: { r: Retenir }) {
  const Icone = r.ton === "bon" ? TrendingUp : r.ton === "alerte" ? TriangleAlert : Lightbulb;
  return (
    <div className="glass-soft flex items-start gap-2.5 rounded-2xl p-3">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          r.ton === "alerte" ? "bg-foreground text-background" : "bg-foreground/10"
        )}
      >
        <Icone className="size-3" />
      </span>
      <p className="pt-0.5 text-corps leading-snug">{r.texte}</p>
    </div>
  );
}

/** Une part : le libellé, le pourcentage et le compte, puis la barre dessous. */
function Part({ label, n, sur, onClick, ouvert }: { label: string; n: number; sur: number; onClick?: () => void; ouvert?: boolean }) {
  const contenu = (
    <>
      <span className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-left text-corps font-medium">{label}</span>
        <span className="w-10 shrink-0 text-right text-petit font-bold tabular-nums">{pct(part(n, sur))}</span>
        <span className="w-6 shrink-0 text-right text-legende text-encre-3 tabular-nums">{n}</span>
        {onClick && (
          <ChevronDown
            className={cn("size-3 shrink-0 self-center text-encre-4 transition-transform", ouvert && "rotate-180")}
          />
        )}
      </span>
      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-foreground/8">
        <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${part(n, sur) * 100}%` }} />
      </span>
    </>
  );
  return onClick ? (
    <button onClick={onClick} aria-expanded={ouvert} className="block w-full">
      {contenu}
    </button>
  ) : (
    <div>{contenu}</div>
  );
}

/** Les trois colonnes d'un motif ou d'une famille : envoyées, touchées, suivies d'effet. */
function Colonnes({ t, fort }: { t: Taux; fort?: boolean }) {
  return (
    <>
      <span className={cn("w-12 shrink-0 text-right tabular-nums", fort ? "text-corps font-bold" : "text-petit text-encre-3")}>
        {milliers(t.envoyees)}
      </span>
      <span className={cn("w-11 shrink-0 text-right tabular-nums", fort ? "text-corps font-extrabold" : "text-petit font-bold")}>
        {pct(part(t.touchees, t.envoyees))}
      </span>
      <span className={cn("w-10 shrink-0 text-right tabular-nums", fort ? "text-corps font-bold" : "text-petit text-encre-2")}>
        {t.attendues ? pct(part(t.suivies, t.attendues)) : "—"}
      </span>
    </>
  );
}

/** La barre d'un motif : claire jusqu'aux touchées, foncée jusqu'aux suivies d'effet. */
function Barre({ t, epaisse }: { t: Taux; epaisse?: boolean }) {
  return (
    <span className={cn("relative mt-1.5 block overflow-hidden rounded-full bg-foreground/8", epaisse ? "h-2" : "h-1")}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${part(t.touchees, t.envoyees) * 100}%`, background: encre(0.32) }}
      />
      {t.attendues > 0 && (
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${part(t.suivies, t.attendues) * 100}%`, background: encre(0.9) }}
        />
      )}
    </span>
  );
}

/** « 12 acceptées · 3 refusées », pour les motifs qui attendent un oui ou un non. */
const reponsesDe = (m: LigneMotif) => (estMotif(m.motif) ? (REPONSES_NOTIF[m.motif]?.(m.oui, m.non) ?? null) : null);

function Motif({ m }: { m: LigneMotif }) {
  const reponses = reponsesDe(m);
  return (
    <div className="py-2 pl-3">
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 flex-1 truncate text-petit font-medium">{m.label}</span>
        <Colonnes t={m} />
      </div>
      <Barre t={m} />
      {reponses && <p className="mt-1 text-legende text-encre-3 tabular-nums">{reponses}</p>}
    </div>
  );
}

/** Une famille d'un seul motif : la ligne de la famille suffit, le motif se dit dessous. */
function seulMotif(f: FamilleNotifs): string | null {
  const [m] = f.motifs;
  return [m.label !== f.label ? m.label : null, reponsesDe(m)].filter(Boolean).join(" · ") || null;
}

/** Ce que veulent dire les mots de la partie, et ce qu'elle ne compte pas. */
function note(t: Taux): string {
  return [
    "Touchée : ouverte depuis la notification.",
    "Suivie d'effet : le joueur a fait ce qu'elle attendait (écrire ou réagir dans la discussion dans les 2 h, répondre à une invitation dans les 14 jours, 72 h pour une équipe, à ses missions ou suivre en retour dans les 7 jours) ; un geste ne compte qu'une fois, pour la notification touchée juste avant, sinon la plus récente.",
    "Au Vestiaire, une notification remplace la précédente encore affichée : d'une rafale, une seule reste à toucher.",
    t.envoyees > 0 ? `Arrivées sur le téléphone : ${pct(part(t.arrivees, t.envoyees))}.` : null,
    t.echouees > 0 ? `${milliers(t.echouees)} prises par aucun téléphone, hors des taux.` : null,
    "Le texte d'une notification n'est jamais gardé.",
  ]
    .filter(Boolean)
    .join(" ");
}

/* --------------------------------- la partie ------------------------------ */

export function NotifsStats({
  public: public_,
  admins,
  jours,
  actifs,
  now,
  onJoueur,
}: {
  /** Qui on regarde : le choix du haut de la page. */
  public: "joueurs" | "admins" | "tous";
  admins: ReadonlySet<string>;
  /** La période du haut de la page ; null : depuis le début. */
  jours: number | null;
  /** Les joueurs venus sur la période, dans ce public. */
  actifs: string[];
  /** L'instant de la lecture de la page : on relit quand il change. */
  now: number;
  /** Ouvre la fiche d'un joueur. */
  onJoueur?: (nom: string) => void;
}) {
  const [lecture, setLecture] = useState<Lecture>({ etat: "lecture" });
  const [raison, setRaison] = useState<string | null>(null);
  const [parJoueur, setParJoueur] = useState(false);

  useEffect(() => {
    let annule = false;
    lireNotifs(now).then(
      (l) => !annule && setLecture(l),
      (e: unknown) => !annule && setLecture({ etat: "erreur", message: e instanceof Error ? e.message : "Lecture impossible." })
    );
    return () => {
      annule = true;
    };
  }, [now]);

  const demo = lecture.etat === "pret" && lecture.actifsDemo !== null;
  const a = useMemo(() => {
    if (lecture.etat !== "pret") return null;
    const garde = (nom: string) => (public_ === "tous" ? true : public_ === "admins" ? admins.has(nom) : !admins.has(nom));
    return analyserNotifs(lecture.donnees, { now, jours, actifs: lecture.actifsDemo ?? actifs, garde });
  }, [lecture, public_, admins, jours, actifs, now]);

  const periode = jours === null ? "depuis le début" : `sur ${jours} jours`;
  const surPeriode = jours === null ? "depuis le début" : `sur ${jours} j`;
  // Avant la première notification suivie, rien n'était compté : on le dit.
  const comptees = a?.suiviesDepuis != null && a.suiviesDepuis > a.depuis ? ` Comptées depuis le ${jjmm(a.suiviesDepuis)}.` : "";
  const variation = a ? a.activees.gagnes - a.activees.perdus : 0;
  const sansNotifs = a ? a.activees.actifs - a.activees.parmiActifs : 0;

  return (
    <section id="activite-notifs" className="glass scroll-mt-16 rounded-3xl p-5">
      <h2 className="text-titre font-bold tracking-tight">Notifications</h2>
      <p className="mt-0.5 text-petit leading-snug text-encre-3">
        Qui les a activées, et ce que chaque motif leur fait faire, {periode}.{comptees}
      </p>
      {demo && (
        <p className="glass-soft mt-3 rounded-2xl px-3 py-2 text-petit leading-snug text-encre-2">
          Aperçu : des données d&apos;exemple, prénoms inventés. Les vraies se remplissent dès la mise en ligne.
        </p>
      )}

      {lecture.etat === "lecture" && (
        <div className="flex justify-center py-10 text-encre-3">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {lecture.etat === "absent" && (
        <p className="mt-3 text-corps text-encre-3">Le suivi des notifications arrive avec la prochaine mise en ligne.</p>
      )}
      {lecture.etat === "erreur" && <p className="mt-3 text-corps text-[#c8352b] dark:text-[#FF6B5E]">{lecture.message}</p>}

      {a && (
        <div className="mt-4 flex flex-col gap-6">
          {/* 1. Les trois chiffres */}
          <div className="grid grid-cols-3 gap-2">
            <Tuile
              label="Activées"
              valeur={String(a.activees.joueurs)}
              sous={`${variation >= 0 ? "+" : "−"}${Math.abs(variation)} ${surPeriode}`}
            />
            <Tuile
              label="Touchées"
              valeur={a.total.envoyees ? pct(part(a.total.touchees, a.total.envoyees)) : "—"}
              sous={a.total.envoyees ? `sur ${milliers(a.total.envoyees)}` : "aucune envoyée"}
            />
            <Tuile
              label="Suivies"
              valeur={a.total.attendues ? pct(part(a.total.suivies, a.total.attendues)) : "—"}
              sous="d'effet"
            />
          </div>

          {/* 2. À retenir */}
          {a.retenir.length > 0 && (
            <div>
              <Titre>À retenir</Titre>
              <div className="flex flex-col gap-2">
                {a.retenir.map((r) => (
                  <LigneRetenir key={r.texte} r={r} />
                ))}
              </div>
            </div>
          )}

          {/* 3. Qui les a activées */}
          <div>
            <Titre>Joueurs qui les ont activées</Titre>
            <div className="flex items-baseline gap-2.5">
              <span className="text-titre-m font-extrabold tracking-tight tabular-nums">{`${a.activees.joueurs} aujourd'hui`}</span>
              <span className="text-petit text-encre-3 tabular-nums">
                +{a.activees.gagnes}
                {a.activees.perdus > 0 && ` · −${a.activees.perdus}`} {surPeriode}
              </span>
            </div>
            <div className="mt-2">
              <Courbe points={a.courbe} format={(v) => milliers(Math.round(v))} hauteur={150} />
            </div>
            <p className="mt-2 text-petit leading-snug text-encre-3">
              {a.activees.telephones} {a.activees.telephones > 1 ? "téléphones" : "téléphone"}
              {a.services.length > 0 && <> : {a.services.map((s) => `${s.n} ${s.label}`).join(", ")}</>}.
            </p>
          </div>

          {/* 3 bis. Et pourquoi pas les autres */}
          {a.activees.actifs > 0 && (
            <div>
              <Titre>
                Sans notifications · {sansNotifs} des {a.activees.actifs} actifs
              </Titre>
              {sansNotifs === 0 ? (
                <p className="text-corps text-encre-3">Tous les joueurs actifs les ont activées.</p>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {a.raisons.map((r) => (
                    <div key={r.id}>
                      <Part
                        label={r.label}
                        n={r.noms.length}
                        sur={sansNotifs}
                        ouvert={raison === r.id}
                        onClick={() => setRaison((o) => (o === r.id ? null : r.id))}
                      />
                      {raison === r.id && (
                        <p className="mt-1.5 text-petit leading-relaxed text-encre-3">{r.noms.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4. L'invitation de l'ouverture */}
          <div>
            <Titre>
              L&apos;invitation de l&apos;ouverture
              {a.invitation.proposes > 0 && ` · proposée à ${a.invitation.proposes}`}
            </Titre>
            {a.invitation.proposes === 0 ? (
              <p className="text-corps text-encre-3">Pas encore proposée sur la période.</p>
            ) : (
              <div className="flex flex-col gap-2.5">
                {a.invitation.issues.map((i) => (
                  <Part key={i.id} label={i.label} n={i.n} sur={a.invitation.proposes} />
                ))}
              </div>
            )}
            {a.invitation.ailleurs.length > 0 && (
              <p className="mt-2.5 text-petit text-encre-3">
                Activées ailleurs : {a.invitation.ailleurs.map((x) => `${x.label} ${x.n}`).join(", ")}.
              </p>
            )}
          </div>

          {/* 5. Motif par motif */}
          <div>
            <div className="mb-1 flex items-baseline gap-2">
              <p className="mono-label min-w-0 flex-1 text-micro text-encre-3">Par motif</p>
              {/* Pas de .mono-label ici : son interlettrage, hors des couches de
                  Tailwind, ferait se chevaucher les trois en-têtes. */}
              <span className="w-12 shrink-0 text-right font-mono text-micro font-bold text-encre-3 uppercase">Envoyées</span>
              <span className="w-11 shrink-0 text-right font-mono text-micro font-bold text-encre-3 uppercase">Touchées</span>
              <span className="w-10 shrink-0 text-right font-mono text-micro font-bold text-encre-3 uppercase">Suivies</span>
            </div>
            {a.familles.length === 0 ? (
              <p className="py-2 text-corps text-encre-3">Aucune notification envoyée sur la période.</p>
            ) : (
              <div className="flex flex-col">
                {a.familles.map((f) => (
                  <div key={f.id} className="border-b border-foreground/6 py-2.5 last:border-0">
                    <div className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 truncate text-ligne font-bold">{f.label}</span>
                      <Colonnes t={f} fort />
                    </div>
                    <Barre t={f} epaisse />
                    {f.motifs.length > 1 && f.motifs.map((m) => <Motif key={m.motif} m={m} />)}
                    {f.motifs.length === 1 && seulMotif(f) && (
                      <p className="mt-1 text-legende text-encre-3 tabular-nums">{seulMotif(f)}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-legende text-encre-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: encre(0.32) }} />
                touchées
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-4 rounded-full" style={{ background: encre(0.9) }} />
                suivies d&apos;effet
              </span>
              {a.total.delai !== null && <span>touchées en {delaiCourt(a.total.delai)} (médiane)</span>}
            </div>
          </div>

          {/* 6. Par joueur */}
          {a.joueurs.length > 0 && (
            <div>
              <button
                onClick={() => setParJoueur((o) => !o)}
                aria-expanded={parJoueur}
                className="flex w-full items-center justify-between gap-3"
              >
                <span className="mono-label text-micro text-encre-3">Par joueur · {a.joueurs.length}</span>
                <ChevronDown className={cn("size-3.5 text-encre-3 transition-transform", parJoueur && "rotate-180")} />
              </button>
              {parJoueur && (
                <div className="mt-1.5 flex flex-col">
                  {a.joueurs.map((j) => (
                    <button
                      key={j.nom}
                      onClick={onJoueur ? () => onJoueur(j.nom) : undefined}
                      disabled={!onJoueur}
                      className="flex items-center gap-3 border-b border-foreground/6 py-2.5 text-left last:border-0"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-ligne font-semibold">{j.nom}</span>
                          <span className="mono-label shrink-0 text-micro text-encre-3">
                            {j.telephones === 0 ? "plus abonné" : j.telephones > 1 ? `${j.telephones} téléphones` : "activées"}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-petit leading-snug text-encre-3 tabular-nums">
                          {j.recues} {j.recues > 1 ? "reçues" : "reçue"} · {j.touchees} {j.touchees > 1 ? "touchées" : "touchée"}
                          {j.attendues > 0 && ` · ${j.suivies} suivies d'effet`}
                          {j.derniere !== null && ` · dernière touchée le ${jjmm(j.derniere)}`}
                        </span>
                      </span>
                      {onJoueur && <ChevronRight className="size-4 shrink-0 text-encre-3" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-legende leading-relaxed text-encre-4">{note(a.total)}</p>
        </div>
      )}
    </section>
  );
}
