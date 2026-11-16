"use client";

// Analytics (Admin → Activité) : ce que la page affiche, une fois le journal lu.
//
// Rangée selon le funnel AARRR (Sabri, 03/11/2026 : « fais une refonte
// globale de l'onglet analytics, pour mieux s'y retrouver, c'est un peu le
// foutoir, et range selon le funnel AARRR, pour qu'on puisse check les
// métriques importantes » ; puis « surtout les gens qui arrivent sur
// getbola.app et qui s'inscrivent ») :
//
//   0. L'essentiel — une métrique clé par étape, sa variation, et la
//      courbe de croissance (avec, dessous, ce que l'app a fait chaque jour :
//      ./reperes.tsx, demandé le 24/10) ;
//   1. Acquisition — de getbola.app au compte créé, écran par écran, d'où
//      viennent les visiteurs, par où sont entrés les comptes
//      (./acquisition.tsx), les pays choisis pour la carte ;
//   2. Activation — du compte au joueur (ville, carte, notifications, un
//      match, revenu un autre jour : ./activation.tsx), les nouveaux à suivre
//      de près, les nouveaux arrivants (./nouveaux.tsx), les gestes de la
//      première semaine qui font revenir ;
//   3. Rétention — cohorte par cohorte, qui est là, qui relancer, les
//      notifications (./notifications.tsx), quand et ce qu'ils font, les
//      vidéos, Bola Agent ;
//   4. Revenu — rien encore en euros, les intéressés par Bola Plus
//      (./bola-plus.tsx, 12/11), les packs ouverts en XP (./revenu.tsx) ;
//   5. Recommandation — le parrainage (./parrainage.tsx) et qui ramène du
//      monde (./rassembleurs.tsx) ;
//   puis, en annexes, le détail par joueur, les emails, les accords.
//
// Les conseils calculés (lib/sfl/retention.ts) se rangent dans leur étape,
// en tête de celle-ci ; on peut tous les masquer d'un geste (Sabri, 22/10 :
// « les conseils […] ne peuvent pas être skipés »). Une rangée de raccourcis,
// collée en haut, mène à chaque étape.
//
// Chaque nom ouvre la fiche du joueur (./fiche.tsx, 22/10). Les données
// arrivent toutes faites (`page.tsx` lit le journal) : cette vue ne fait que
// les analyser et les montrer.

import { useMemo, useState, useSyncExternalStore } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Lightbulb, Loader2, Mail, RefreshCw, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
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
  type EtapeAarrr,
  type Evenement,
  type FamilleId,
  type MetriqueId,
  type Profil,
} from "@/lib/sfl/retention";
import { emojiDrapeau, unPays } from "@/lib/sfl/photo-studio";
import { analyserLiens } from "@/lib/sfl/rassembleurs";
import {
  ecartDuJour,
  marquesDuJour,
  pics,
  reperesJournees,
  reperesMatchs,
  reperesMisesEnLigne,
  reperesNotifs,
  reperesParJour,
} from "@/lib/sfl/reperes";
import { aSuivre } from "@/lib/sfl/suivi-joueur";
import { useSeason } from "@/components/sfl/season-provider";
import { FicheJoueur } from "./fiche";
import { NouveauxArrivants } from "./nouveaux";
import type { Parcours } from "./parcours";
import type { DonneesReperes } from "./lectures";
import { NotifsStats } from "./notifications";
import { QuiRamene } from "./rassembleurs";
import { CeJourLa, Pics } from "./reperes";
import { cn } from "@/lib/utils";
import { BoutonRetour } from "@/components/layout/bouton-retour";
import { Acquisition, chiffresAcquisition, type Canal, type SiteVisite } from "./acquisition";
import { ActivationEntonnoir, analyserActivation } from "./activation";
import { Chapitre, Section } from "./cadre";
import { Barres, CarteHoraire, Cohortes, Comparaison, Courbe, encre } from "./graphiques";

/** Une photo du studio (studio, drapeau, manga) ; `pays`, celui du drapeau, manque avant le 22/10. */
export interface PhotoStudio {
  name: string;
  filtre: string;
  pays: string | null;
  at: number;
}

export interface DonneesActivite {
  evenements: Evenement[];
  profiles: Profil[];
  /** Les photos du studio, ou null si la lecture a échoué. */
  studio: PhotoStudio[] | null;
  /** Les repères sous les courbes et « Qui ramène du monde » (./lectures.ts), ou null si la lecture a échoué. */
  reperes: DonneesReperes | null;
  /** Le parrain de chaque filleul, par nom (table parrainages), ou null si la lecture a échoué. */
  parrains: ReadonlyMap<string, string> | null;
  /** Par où chaque compte est entré, par nom (table parrainages), ou null si la lecture a échoué. */
  canaux: ReadonlyMap<string, Canal> | null;
  /** Les filleuls (venus par un parrain ou une équipe), datés, ou null. */
  filleuls: { name: string; at: number }[] | null;
  /** L'entonnoir de getbola.app (table site_visites), ou null si la lecture a échoué. */
  site: SiteVisite[] | null;
  /** Les identifiants des comptes admins (les tables rangées par id). */
  idsAdmins: ReadonlySet<string>;
  /** Le parcours de chaque nouvel arrivant, par nom (./parcours.ts), ou null si la lecture a échoué. */
  parcours: ReadonlyMap<string, Parcours> | null;
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
export type PublicId = (typeof PUBLICS)[number]["id"];

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

function Delta({ c, suffixe = "" }: { c: Chiffre; suffixe?: string }) {
  const e = evolution(c);
  if (e === null) {
    if (c.avant === 0 && c.valeur > 0) return <span className="text-legende text-encre-3">nouveau{suffixe}</span>;
    return null;
  }
  const Icone = e >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-legende font-semibold tabular-nums", e >= 0 ? "text-encre-2" : "text-encre-3")}>
      <Icone className="size-3" />
      {e >= 0 ? "+" : "−"}
      {Math.abs(Math.round(e * 100))} %{suffixe}
    </span>
  );
}

/** Une conclusion, dans la rangée : le titre et la chose à faire ; le détail en touchant. */
function CarteConclusion({ c }: { c: Conclusion }) {
  const [ouvert, setOuvert] = useState(false);
  const Icone = c.ton === "bon" ? TrendingUp : c.ton === "alerte" ? TriangleAlert : Lightbulb;
  return (
    <button
      onClick={() => setOuvert((o) => !o)}
      aria-expanded={ouvert}
      className="glass-soft flex w-[78%] max-w-[320px] shrink-0 snap-start flex-col rounded-2xl p-3.5 text-left"
    >
      <div className="flex items-start gap-2.5">
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full",
            c.ton === "alerte" ? "bg-foreground text-background" : "bg-foreground/10"
          )}
        >
          <Icone className="size-3" />
        </span>
        <p className="text-ligne leading-snug font-bold">{c.titre}</p>
      </div>
      {ouvert && <p className="mt-2 text-petit leading-snug text-encre-3">{c.detail}</p>}
      <p className={cn("mt-2 text-corps leading-snug", !ouvert && "line-clamp-3")}>
        <span className="mono-label mr-1.5 text-micro text-encre-3">À faire</span>
        {c.action}
      </p>
    </button>
  );
}

/** Les conseils masqués ou non : un choix de l'appareil, gardé d'une visite à l'autre. */
const CLE_CONSEILS = "sfl-activite-conseils";
const EVT_CONSEILS = "sfl-activite-conseils";
function lireMasques(): boolean {
  try {
    return localStorage.getItem(CLE_CONSEILS) === "masques";
  } catch {
    return false;
  }
}
function ecrireMasques(v: boolean) {
  try {
    if (v) localStorage.setItem(CLE_CONSEILS, "masques");
    else localStorage.removeItem(CLE_CONSEILS);
  } catch {
    // Stockage refusé : le choix ne vaut que pour cette visite.
  }
  window.dispatchEvent(new Event(EVT_CONSEILS));
}
function abonneConseils(f: () => void) {
  window.addEventListener(EVT_CONSEILS, f);
  return () => window.removeEventListener(EVT_CONSEILS, f);
}

/** Les raccourcis, dans l'ordre de la page : les cinq étapes du funnel. */
const PARTIES = [
  { id: "essentiel", label: "L'essentiel" },
  { id: "acquisition", label: "Acquisition" },
  { id: "activation", label: "Activation" },
  { id: "retention", label: "Rétention" },
  { id: "revenu", label: "Revenu" },
  { id: "recommandation", label: "Recommandation" },
  { id: "joueurs", label: "Par joueur" },
] as const;

/** Les conseils d'une étape, en une rangée qu'on fait glisser ; rien s'il n'y en a pas. */
function Conseils({ liste, masques }: { liste: Conclusion[]; masques: boolean }) {
  if (liste.length === 0) return null;
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="mono-label text-micro text-encre-3">À retenir · {liste.length}</p>
        <button onClick={() => ecrireMasques(!masques)} className="mono-label flex items-center gap-1 text-micro text-encre-3">
          {masques ? "Afficher" : "Masquer"}
          {masques ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
        </button>
      </div>
      {!masques && (
        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 items-start gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {liste.map((c) => (
            <CarteConclusion key={c.titre} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

/** Les blocs qui lisent leurs propres tables (./page.tsx), rangés chacun dans son étape. */
export interface BlocsActivite {
  videos: (public_: PublicId, admins: ReadonlySet<string>) => React.ReactNode;
  agent: (public_: PublicId, admins: ReadonlySet<string>) => React.ReactNode;
  parrainage: () => React.ReactNode;
  revenu: (depuis: number, actifs: number, garde: (id: string) => boolean) => React.ReactNode;
  accords: (public_: PublicId, admins: ReadonlySet<string>) => React.ReactNode;
}

function allerA(id: string) {
  document.getElementById(`activite-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------------------- vue ---------------------------------- */

export function ActiviteVue({
  data,
  loading,
  onRefresh,
  error,
  blocs,
}: {
  data: DonneesActivite | null;
  loading: boolean;
  onRefresh: () => void;
  error: string | null;
  /** Les blocs qui lisent leurs propres tables, filtrés sur le même public. */
  blocs?: BlocsActivite;
}) {
  const [periode, setPeriode] = useState<PeriodeId>("30");
  const [public_, setPublic] = useState<PublicId>("joueurs");
  const [metrique, setMetrique] = useState<MetriqueId>("hebdo");
  const [tri, setTri] = useState<"recent" | "temps" | "actions">("recent");
  const [fiche, setFiche] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<FamilleId | null>(null);
  /** Le jour touché sur la courbe (minuit) ; null : aujourd'hui. */
  const [jourChoisi, setJourChoisi] = useState<number | null>(null);
  const masques = useSyncExternalStore(abonneConseils, lireMasques, () => false);
  const { saison } = useSeason();

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
    const studio = data.studio?.filter((d) => garde(d.name)) ?? null;
    const drapeaux = studio?.filter((d) => d.filtre === "drapeau") ?? null;
    return { evenements, profiles, studio, drapeaux, admins: [...admins].sort(), ensembleAdmins: admins, partAdmins, garde };
  }, [data, public_]);
  const a = useMemo(
    () => (data && vu ? analyser(vu.evenements, vu.profiles, data.now, jours) : null),
    [data, vu, jours]
  );

  /* ----------------------- les pays choisis pour la carte ---------------- */
  // Le dernier drapeau de chaque joueur : un joueur qui en essaie trois ne
  // compte qu'une fois, pour celui qu'il a gardé en dernier.
  const pays = useMemo(() => {
    if (!vu?.drapeaux) return null;
    const dernier = new Map<string, string>();
    let cartes = 0;
    let sansPays = 0;
    for (const d of [...vu.drapeaux].sort((x, y) => x.at - y.at)) {
      if (!d.pays) {
        sansPays++;
        continue;
      }
      cartes++;
      dernier.set(d.name, d.pays);
    }
    const compte = new Map<string, number>();
    for (const p of dernier.values()) compte.set(p, (compte.get(p) ?? 0) + 1);
    const lignes = [...compte.entries()]
      .map(([id, n]) => ({ id, n, nom: unPays(id)?.nom ?? id.toUpperCase(), drapeau: emojiDrapeau(id) }))
      .sort((x, y) => y.n - x.n || x.nom.localeCompare(y.nom, "fr"));
    return { lignes, joueurs: dernier.size, cartes, sansPays };
  }, [vu]);

  /* ---------------------------- les notifications ------------------------ */
  // Les joueurs venus sur la période : ceux qu'il faudrait pouvoir prévenir.
  const actifs = useMemo(() => a?.joueurs.map((j) => j.name) ?? [], [a]);

  /* ------------------------------ à suivre de près ----------------------- */
  const suivre = useMemo(() => (vu && data ? aSuivre(vu.evenements, data.now) : []), [vu, data]);
  const emailDe = (name: string) => vu?.profiles.find((p) => p.name === name)?.contact_email ?? null;

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

  /* ------------------------------ les repères ---------------------------- */
  // Ce que l'app a fait, jour par jour : les journées de la ligue (toutes les
  // saisons), les matchs ouverts, les notifications, les mises en ligne.
  const reperesDuJour = useMemo(() => {
    if (!data || !vu) return null;
    const r = data.reperes;
    return reperesParJour([
      ...reperesJournees(saison, data.now),
      ...(r
        ? [
            ...reperesMatchs(r.matchs),
            ...reperesNotifs(r.envois, vu.garde, vu.ensembleAdmins),
            ...reperesMisesEnLigne(r.misesEnLigne),
          ]
        : []),
    ]);
  }, [data, vu, saison]);
  const marques = useMemo(
    () => (courbe && reperesDuJour ? courbe.points.map((p) => marquesDuJour(reperesDuJour.get(p.t))) : null),
    [courbe, reperesDuJour]
  );
  // Le jour choisi sur la courbe, retrouvé par sa date : il survit au changement de mesure.
  const iChoisi = courbe && jourChoisi !== null ? courbe.points.findIndex((p) => p.t === jourChoisi) : -1;
  const iJour = iChoisi >= 0 ? iChoisi : (courbe?.points.length ?? 0) - 1;
  const lesPics = useMemo(
    () =>
      a
        ? pics(a.serie, a.debutPeriode, metrique).map((k) => ({
            i: k - a.debutPeriode,
            t: a.serie[k].t,
            ecart: ecartDuJour(a.serie, k, metrique),
          }))
        : [],
    [a, metrique]
  );

  /* ------------------------------ qui ramène ----------------------------- */
  // Les venues de chaque joueur, toute l'histoire, triées : revenu ou pas après une notification.
  const instants = useMemo(() => {
    const m = new Map<string, number[]>();
    for (const e of data?.evenements ?? []) {
      const liste = m.get(e.name);
      if (liste) liste.push(e.at);
      else m.set(e.name, [e.at]);
    }
    for (const liste of m.values()) liste.sort((x, y) => x - y);
    return m;
  }, [data]);
  const liens = useMemo(
    () =>
      a && vu && data?.reperes
        ? analyserLiens({ envois: data.reperes.envois, instants, autres: data.reperes.liens, depuis: a.depuis, garde: vu.garde })
        : null,
    [a, vu, data, instants]
  );

  const joueursTries = [...(a?.joueurs ?? [])].sort((x, y) =>
    tri === "temps" ? y.temps - x.temps : tri === "actions" ? y.actions - x.actions : y.last - x.last
  );
  const libellePeriode = jours === null ? "depuis le début" : `sur ${jours} jours`;
  const comparaison = jours === null ? "" : ` · évolution par rapport aux ${jours} jours d'avant`;
  const totalFamilles = a ? a.familles.reduce((s, f) => s + f.noms.length, 0) : 0;
  const emails = vu?.profiles.filter((p) => p.contact_email) ?? [];

  /* ------------------------------ les étapes ---------------------------- */
  const conseilsDe = (etape: EtapeAarrr) => a?.conclusions.filter((c) => c.etape === etape) ?? [];
  const gardeId = useMemo(() => {
    const ids = data?.idsAdmins ?? new Set<string>();
    return (id: string) => (public_ === "tous" ? true : public_ === "admins" ? ids.has(id) : !ids.has(id));
  }, [data, public_]);
  const activation = useMemo(
    () =>
      a && vu && data
        ? analyserActivation({
            profiles: vu.profiles,
            evenements: vu.evenements,
            studio: vu.studio,
            parcours: data.parcours,
            depuis: a.depuis,
            now: data.now,
          })
        : null,
    [a, vu, data]
  );

  /* ---------------------------- l'essentiel ------------------------------ */
  // Une métrique clé par étape du funnel, et sa variation sur la période d'avant.
  const essentiel = useMemo(() => {
    if (!a || !vu || !data || !activation) return [];
    const fin = data.now + DAY;
    const avantDe = jours === null ? null : a.depuis - jours * DAY;
    const comptes = (de: number, a_: number) =>
      vu.profiles.filter((p) => p.created_at != null && p.created_at >= de && p.created_at < a_).length;
    const nComptes = comptes(a.depuis, fin);
    const acq = chiffresAcquisition(data.site, a.depuis, fin);
    const ligneAcq =
      acq && acq.visiteurs > 0
        ? `${acq.visiteurs} visiteurs sur getbola.app · ${pct(acq.crees / acq.visiteurs)} créent leur compte`
        : acq
          ? "Les visites de getbola.app se comptent depuis le 03/11"
          : null;
    const act = activation.lignes;
    const nCohorte = activation.cohorte.length;
    const part = (id: string) => (act.find((l) => l.id === id)?.oui.length ?? 0) / Math.max(1, nCohorte);
    const r7 = a.retention.find((r) => r.jours === 7);
    const hebdo = a.serie.at(-1)?.hebdo ?? 0;
    const filleuls = (de: number, a_: number) => (data.filleuls ?? []).filter((f) => vu.garde(f.name) && f.at >= de && f.at < a_).length;
    const il30 = data.now - 30 * DAY;
    const base30 = vu.profiles.filter((p) => p.created_at == null || p.created_at < il30).length;
    const k = base30 ? filleuls(il30, fin) / base30 : 0;
    const nFilleuls = filleuls(a.depuis, fin);
    return [
      {
        id: "acquisition",
        etape: "Acquisition",
        valeur: String(nComptes),
        label: nComptes > 1 ? "comptes créés" : "compte créé",
        ligne: ligneAcq,
        c: { valeur: nComptes, avant: avantDe === null ? null : comptes(avantDe, a.depuis) } as Chiffre,
      },
      {
        id: "activation",
        etape: "Activation",
        valeur: nCohorte ? pct(part("match")) : "—",
        label: "des nouveaux dans un match",
        ligne: nCohorte
          ? `${pct(part("carte"))} font leur carte · ${pct(part("notifs"))} activent les notifications`
          : "Aucun nouveau compte sur la période",
        c: null,
      },
      {
        id: "retention",
        etape: "Rétention",
        valeur: String(a.chiffres.actifs.valeur),
        label: "joueurs actifs",
        ligne: `${hebdo} sur les 7 derniers jours${r7 && r7.eligibles > 0 ? ` · ${pct(r7.revenus / r7.eligibles)} reviennent après 7 jours` : ""}`,
        c: a.chiffres.actifs,
      },
      {
        id: "revenu",
        etape: "Revenu",
        valeur: "0 €",
        label: "encaissés",
        ligne: "Aucun paiement en place",
        c: null,
      },
      {
        id: "recommandation",
        etape: "Recommandation",
        valeur: String(nFilleuls),
        label: nFilleuls > 1 ? "filleuls" : "filleul",
        ligne: data.filleuls
          ? `Coefficient viral sur 30 jours : ${k.toFixed(2).replace(".", ",")}`
          : "Les parrainages n'ont pas pu être lus",
        c: { valeur: nFilleuls, avant: avantDe === null ? null : filleuls(avantDe, a.depuis) } as Chiffre,
      },
    ];
  }, [a, vu, data, activation, jours]);

  return (
    <div className="shell flex flex-col gap-4 py-4 sm:py-8">
      <div className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <BoutonRetour />
          <div>
            <h1 className="text-titre-l font-bold tracking-tight">Analytics</h1>
            <p className="mt-1 text-corps text-encre-3">Le funnel AARRR</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bouton-secondaire mono-label flex items-center gap-1.5 px-3 py-1.5"
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
              "flex-1 py-1.5 text-corps font-semibold",
              public_ === p.id ? "bouton-principal bouton--mauve" : "bouton-discret text-encre-3"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      {vu && vu.admins.length > 0 && (
        <p className="-mt-1.5 px-1 text-petit leading-snug text-encre-3">
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
              "flex-1 py-1.5 text-corps font-semibold",
              periode === p.id ? "bouton-principal" : "bouton-discret text-encre-3"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {a && (
        <nav
          aria-label="Parties de la page"
          className="sticky top-0 z-20 -mx-4 -my-1 flex gap-1.5 overflow-x-auto bg-background/80 px-4 py-2 backdrop-blur-xl [scrollbar-width:none]"
        >
          {PARTIES.map((p) => (
            <button
              key={p.id}
              onClick={() => allerA(p.id)}
              className="bouton-secondaire shrink-0 px-3 py-1.5 text-petit font-semibold"
            >
              {p.label}
            </button>
          ))}
        </nav>
      )}

      {error && (
        <p className="glass-soft rounded-2xl p-3.5 text-corps text-[#c8352b] dark:text-[#FF6B5E]">
          {error} — as-tu bien rejoué le script SQL (table activity) ?
        </p>
      )}

      {!a && loading && (
        <div className="flex justify-center py-16 text-encre-3">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {a && courbe && vu && data && (
        <>
          {/* L'essentiel : une métrique clé par étape du funnel, puis la courbe */}
          <section id="activite-essentiel" className="scroll-mt-16">
            <p className="mono-label mb-2 px-1 text-micro text-encre-3">
              {libellePeriode}
              {comparaison}
            </p>
            <div className="glass-soft overflow-hidden rounded-[24px]">
              {essentiel.map((e, i) => (
                <button
                  key={e.id}
                  onClick={() => allerA(e.id)}
                  className="flex w-full items-center gap-3.5 border-b border-foreground/6 px-4 py-3.5 text-left last:border-0"
                >
                  <span className="mono-label w-4 shrink-0 text-micro text-encre-4">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="mono-label block text-micro text-encre-3">{e.etape}</span>
                    <span className="mt-1 flex items-baseline gap-2">
                      <span className="text-titre-m leading-none font-extrabold tracking-tight tabular-nums">{e.valeur}</span>
                      <span className="min-w-0 truncate text-corps font-semibold">{e.label}</span>
                    </span>
                    {e.ligne && <span className="mt-1 block text-petit leading-snug text-encre-3">{e.ligne}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {e.c && <Delta c={e.c} />}
                    <ChevronRight className="size-4 text-encre-4" />
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* 2. La croissance */}
          <section id="activite-courbes" className="glass scroll-mt-16 rounded-3xl p-5">
            <h2 className="text-titre font-bold tracking-tight">Croissance</h2>
            <div className="-mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {METRIQUES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetrique(m.id)}
                  className={cn(
                    "shrink-0 px-3 py-1.5 text-petit font-semibold",
                    metrique === m.id ? "bouton-principal" : "bouton-secondaire text-encre-3"
                  )}
                >
                  {m.court}
                </button>
              ))}
            </div>
            <p className="mono-label mt-4 text-micro text-encre-3">
              {METRIQUES.find((m) => m.id === metrique)?.label}
            </p>
            <div className="mt-1 flex items-baseline gap-2.5">
              <span className="text-titre-m font-extrabold tracking-tight tabular-nums">{courbe.titre}</span>
              <Delta c={courbe.c} />
            </div>
            <div className="mt-3">
              <Courbe
                points={courbe.points}
                avant={courbe.avant}
                format={format}
                creux={a.creux}
                marques={marques}
                actif={iChoisi >= 0 ? iChoisi : null}
                onActif={(i) => setJourChoisi(i === null ? null : (courbe.points[i]?.t ?? null))}
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-legende text-encre-3">
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
              <span>Touche un jour : ce que l&apos;app y a fait s&apos;affiche dessous.</span>
            </div>
            {courbe.points[iJour] && (
              <div className="mt-4 border-t border-foreground/8 pt-3.5">
                <Pics pics={lesPics} actif={iJour} onChoisir={(i) => setJourChoisi(courbe.points[i]?.t ?? null)} />
                <CeJourLa
                  key={courbe.points[iJour].t}
                  t={courbe.points[iJour].t}
                  aujourdhui={iJour === courbe.points.length - 1}
                  reperes={reperesDuJour?.get(courbe.points[iJour].t) ?? []}
                  ecart={ecartDuJour(a.serie, a.debutPeriode + iJour, metrique)}
                  metrique={metrique}
                  format={format}
                />
              </div>
            )}
          </section>

          <Chapitre id="acquisition" rang={1} titre="Acquisition" question="Qui arrive, et par où ?" />
          <Conseils liste={conseilsDe("acquisition")} masques={masques} />
          <Acquisition
            site={data.site}
            profiles={vu.profiles}
            canaux={data.canaux}
            jours={courbe.points.map((p) => p.t)}
            depuis={a.depuis}
          />
          {/* 8 bis. Les pays choisis pour la carte */}
          <Section
            id="pays"
            titre="Pays choisis pour la carte"
            sous={
              pays && pays.joueurs > 0
                ? `Le dernier drapeau de chaque joueur au studio photo · ${pays.joueurs} ${pays.joueurs > 1 ? "joueurs" : "joueur"}, ${pays.cartes} ${pays.cartes > 1 ? "cartes" : "carte"}.`
                : "Le dernier drapeau de chaque joueur au studio photo."
            }
          >
            {pays && pays.lignes.length > 0 ? (
              <div className="flex flex-col gap-2.5">
                {pays.lignes.map((l) => (
                  <div key={l.id} className="flex items-center gap-3">
                    <span className="w-[44%] shrink-0 truncate text-corps font-medium">
                      <span className="mr-1.5">{l.drapeau}</span>
                      {l.nom}
                    </span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${(l.n / pays.joueurs) * 100}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-petit font-bold tabular-nums">{pct(l.n / pays.joueurs)}</span>
                    <span className="w-6 shrink-0 text-right text-legende text-encre-3 tabular-nums">{l.n}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-corps text-encre-3">
                Aucun pays enregistré pour l&apos;instant : ils s&apos;enregistrent depuis le 22/10, à chaque carte au drapeau.
              </p>
            )}
            {pays && pays.sansPays > 0 && (
              <p className="mt-3 text-legende leading-snug text-encre-3">
                {pays.sansPays} {pays.sansPays > 1 ? "cartes au drapeau faites" : "carte au drapeau faite"} avant le 22/10, sans pays enregistré.
              </p>
            )}
          </Section>

          <Chapitre id="activation" rang={2} titre="Activation" question="Un compte créé devient-il un joueur ?" />
          <Conseils liste={conseilsDe("activation")} masques={masques} />
          <ActivationEntonnoir a={activation!} onFiche={setFiche} />
          {/* 3 bis. À suivre de près : les nouveaux venus très engagés */}
          {suivre.length > 0 && (
            <Section
              id="suivre"
              titre="À suivre de près"
              sous="Arrivés depuis moins de 14 jours, bien plus présents que les autres dans leurs premières 24 h. Touche un nom pour sa fiche."
            >
              <div className="flex flex-col">
                {suivre.map((j) => (
                  <button
                    key={j.name}
                    onClick={() => setFiche(j.name)}
                    className="flex items-center gap-3 border-b border-foreground/6 py-2.5 text-left last:border-0"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-ligne font-semibold">{j.name}</span>
                      <span className="block text-petit text-encre-3">
                        {duree(j.ms)} dans ses premières 24 h · {Math.round(j.fois)} fois la médiane · arrivé le {jjmm(j.premier)}
                      </span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-encre-3" />
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* 3 ter. Les nouveaux arrivants : SFL et Bola à part, leur carte, ce qu'ils ont fait */}
          {vu && data && (
            <Section id="nouveaux" titre="Nouveaux arrivants">
              <NouveauxArrivants
                evenements={data.evenements}
                profiles={data.profiles}
                parrains={data.parrains}
                parcours={data.parcours}
                now={data.now}
                onFiche={setFiche}
              />
            </Section>
          )}

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

          <Chapitre id="retention" rang={3} titre="Rétention" question="Reviennent-ils ?" />
          <Conseils liste={conseilsDe("retention")} masques={masques} />
          {/* 5. La rétention */}
          <Section id="cohortes" titre="Combien reviennent" sous="Sur tout l'historique. Revenu après N jours : rouvert l'app N jours ou plus après sa première venue.">
            <div className="flex flex-col gap-2.5">
              {a.retention
                .filter((r) => r.eligibles > 0)
                .map((r) => (
                  <div key={r.jours} className="flex items-center gap-3">
                    <span className="w-[104px] shrink-0 text-corps font-medium whitespace-nowrap">
                      Après {r.jours} {r.jours === 1 ? "jour" : "jours"}
                    </span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/8">
                      <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(r.revenus / r.eligibles) * 100}%` }} />
                    </span>
                    <span className="w-10 shrink-0 text-right text-petit font-bold tabular-nums">{pct(r.revenus / r.eligibles)}</span>
                    <span className="w-11 shrink-0 text-right text-legende text-encre-3 tabular-nums">
                      {r.revenus}/{r.eligibles}
                    </span>
                  </div>
                ))}
            </div>
            <p className="mono-label mt-6 mb-2 text-micro text-encre-3">Par semaine d&apos;arrivée · % encore actifs</p>
            <Cohortes cohortes={a.cohortes} />
            <p className="mt-2 text-legende leading-snug text-encre-3">
              Chaque ligne : les joueurs arrivés la semaine du lundi indiqué (et combien). S0 = leur première semaine,
              +1 la suivante, etc. Plus la case est foncée, plus ils sont restés.
            </p>
          </Section>

          {/* 4. Qui est là */}
          <Section id="qui" titre="Qui est là aujourd'hui" sous={`${totalFamilles} comptes, rangés selon leur dernière venue.`}>
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
                      <span className="text-ligne font-semibold">{f.label}</span>
                      <span className="block text-petit text-encre-3">{f.note}</span>
                    </span>
                    <span className="text-lecture font-extrabold tabular-nums">{f.noms.length}</span>
                    <ChevronDown className={cn("size-3.5 text-encre-4 transition-transform", ouverte === f.id && "rotate-180")} />
                  </button>
                  {ouverte === f.id && (
                    <p className="pb-3 pl-5.5 text-petit leading-relaxed text-encre-3">
                      {f.noms.length ? [...f.noms].sort((x, y) => x.localeCompare(y, "fr")).join(", ") : "Personne."}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Section>

          {/* 9. À relancer */}
          {a.aRelancer.length > 0 && (
            <Section titre="À relancer" sous="Venus plusieurs jours, plus vus depuis une semaine ou plus.">
              <div className="flex flex-col">
                {a.aRelancer.map((j) => (
                  <button
                    key={j.name}
                    onClick={() => setFiche(j.name)}
                    className="flex items-center gap-3 border-b border-foreground/6 py-2.5 text-left last:border-0"
                  >
                    <span className="min-w-0 flex-1 truncate text-ligne font-semibold">{j.name}</span>
                    <span className="mono-label text-micro whitespace-nowrap text-encre-3">{j.jours} j venus</span>
                    <span className="mono-label text-right text-micro whitespace-nowrap text-encre-3">{relative(j.last, a.now)}</span>
                    <Mail className={cn("size-3.5", j.email ? "text-foreground" : "text-foreground/15")} />
                  </button>
                ))}
              </div>
            </Section>
          )}

          {/* 6 ter. Les notifications */}
          {vu && data && (
            <NotifsStats
              key={data.now}
              public={public_}
              admins={vu.ensembleAdmins}
              jours={jours}
              actifs={actifs}
              now={data.now}
              onJoueur={setFiche}
            />
          )}

          {/* 7. Quand */}
          <Section id="quand" titre="Quand la ligue ouvre l'app" sous={`Présences par jour et par heure, ${libellePeriode}.`}>
            <CarteHoraire carte={a.carte} />
          </Section>

          {/* 8. Ce qu'ils font */}
          <Section titre="Ce qu'ils font" sous={`${a.chiffres.sessions.valeur} sessions ${libellePeriode} · médiane ${duree(a.dureeMediane)} · ${String(a.actionsParSession).replace(".", ",")} actions par session`}>
            <Barres lignes={a.actions} />
          </Section>
          <Section titre="Pages les plus vues">
            <Barres lignes={a.pages} />
          </Section>

          {blocs?.videos(public_, vu.ensembleAdmins)}
          {blocs?.agent(public_, vu.ensembleAdmins)}

          <Chapitre id="revenu" rang={4} titre="Revenu" question="Qu'est-ce que Bola gagne ?" />
          {blocs?.revenu(a.depuis, a.chiffres.actifs.valeur, gardeId)}

          <Chapitre id="recommandation" rang={5} titre="Recommandation" question="Font-ils venir les autres ?" />
          {blocs?.parrainage()}
          {/* 6 bis. Qui ramène du monde */}
          {liens && data?.reperes && vu && (
            <QuiRamene
              analyse={liens}
              tousLiens={data.reperes.liens}
              deduites={data.reperes.deduites}
              libellePeriode={libellePeriode}
              admins={vu.ensembleAdmins}
              onFiche={setFiche}
            />
          )}

          <div className="px-1 pt-6">
            <h2 className="text-titre-l leading-none font-extrabold tracking-tight">Annexes</h2>
          </div>
          {/* 10. Par joueur */}
          <section id="activite-joueurs" className="scroll-mt-16">
            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-titre font-bold tracking-tight">Par joueur</h2>
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
                      "rounded-full px-2.5 py-1 text-legende font-bold transition-colors",
                      tri === id ? "bg-foreground text-background" : "text-encre-3"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-soft overflow-hidden rounded-[24px]">
              {joueursTries.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setFiche(p.name)}
                  className="flex w-full items-center gap-3 border-b border-foreground/5 px-3.5 py-3 text-left last:border-0"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-ligne font-semibold">{p.name}</span>
                      <span className="shrink-0 text-corps font-bold tabular-nums">{duree(p.temps)}</span>
                    </span>
                    <span className="mt-0.5 block text-petit leading-snug text-encre-3">
                      Vu {relative(p.last, a.now)} · {p.sessions} {p.sessions > 1 ? "sessions" : "session"}, {duree(p.moyenne)} en moyenne · {p.jours} j actifs · {milliers(p.actions)} actions · arrivé le {jjmm(p.premier)}
                    </span>
                  </span>
                  <Mail className={cn("size-3.5 shrink-0", p.email ? "text-foreground" : "text-foreground/15")} />
                </button>
              ))}
              {joueursTries.length === 0 && (
                <p className="px-4 py-8 text-center text-corps text-encre-3">
                  Personne sur cette période — le journal se remplit tout seul.
                </p>
              )}
            </div>
          </section>

          {/* 11. Les emails collectés */}
          <section className="glass rounded-3xl p-5">
            <p className="mono-label text-encre-2">
              Emails collectés · {emails.length}/{a.comptes}
            </p>
            {emails.length > 0 ? (
              <div className="mt-3 flex flex-col gap-1.5">
                {emails.map((p) => (
                  <div key={p.name} className="flex items-baseline justify-between gap-3">
                    <span className="text-corps font-semibold">{p.name}</span>
                    <span className="mono-label min-w-0 truncate text-encre-3">{p.contact_email}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-corps text-encre-3">
                Aucun pour l&apos;instant — chaque joueur est invité à laisser le sien en tête du fil et dans Réglages.
              </p>
            )}
          </section>

          {blocs?.accords(public_, vu.ensembleAdmins)}

          <p className="px-1 pb-2 text-legende leading-relaxed text-encre-4">
            {milliers(a.evenementsLus)} événements lus, depuis le {a.serie[0] ? jjmm(a.serie[0].t) : "—"}. Une session,
            c&apos;est un onglet ouvert ; sa durée, c&apos;est le temps passé au premier plan, mesuré par ses signes de vie
            (l&apos;app en émet un toutes les 90 secondes tant qu&apos;elle est au premier plan) ; un silence de plus de
            5 minutes n&apos;est pas compté. Les visites de moins de 30 secondes ne comptent pas dans les durées.
          </p>

        </>
      )}

      {fiche && vu && data && (
        <FicheJoueur
          name={fiche}
          evenements={vu.evenements}
          studio={vu.studio}
          email={emailDe(fiche)}
          now={data.now}
          onClose={() => setFiche(null)}
        />
      )}
    </div>
  );
}
