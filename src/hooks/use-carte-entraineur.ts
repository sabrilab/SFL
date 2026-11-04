"use client";

// La carte d'entraîneur de chacun, telle que le serveur l'a gardée (lot B2,
// 03/11/2026 ; entraineur_cartes, posée chaque nuit par /api/entraineurs/calcul
// à partir des faits : lib/sfl/entraineur-serveur.server.ts). Le téléphone ne
// la calcule jamais : il la lit.
//
// Deux lectures :
//   · toutes les cartes, légères (la note, les trois, ses rencontres, son
//     équipe), lues une fois pour tout l'écran, relues au retour dans l'app
//     (une fois par minute au plus) et après un geste de la page Team : le
//     banc, la page d'une équipe, le profil d'un joueur, Ma carte ;
//   · le détail de MA carte (ce qui attend la prochaine mise à jour, les
//     jauges, le journal en mots, les mises à jour passées) : la page
//     Entraîneur de Ma carte seulement, par ma_carte_entraineur (la ligue ne
//     lit que la face : le journal dit qui a été exclu).
// Une personne qui a entraîné garde sa carte : elle le suit d'une équipe à
// l'autre. Un entraîneur qui vient d'arriver n'a pas encore de ligne : sa
// carte part de 75 (DEPART_ENTRAINEUR), comme un nouveau joueur.
//
// Sans la migration (une préversion sur la base d'avant), aucune carte. En
// aperçu (jamais en production), le monde de démonstration de la page Team :
// Lucien, l'entraîneur de Sunday Five, et la carte de ses trois saisons
// (lib/sfl/entraineur-demo.ts).

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useEquipes } from "@/hooks/use-equipes";
import { EVT_EQUIPE } from "@/hooks/use-mon-equipe";
import { useSession } from "@/hooks/use-session";
import {
  CLES_ENTRAINEUR,
  DEPART_ENTRAINEUR,
  noteEntraineur,
  type CleEntraineur,
  type FaitEntraineur,
  type MiseAJourEntraineur,
  type StatsEntraineur,
} from "@/lib/sfl/entraineur";
import { carteEntraineurDemo } from "@/lib/sfl/entraineur-demo";
import { ENTRAINEUR_DEMO } from "@/lib/sfl/equipes-demo";
import { supabase } from "@/lib/supabase";

/** Une carte d'entraîneur gardée : ce que montre la carte. */
export interface CarteEntraineurLue {
  joueur: string;
  nom: string;
  /** Son équipe : celle qu'il entraîne, sinon la dernière (null : dissoute et effacée). */
  equipeId: number | null;
  stats: StatsEntraineur;
  note: number;
  /** Les rencontres dirigées (la fiche, pas la face). */
  rencontres: number;
}

/** Le détail d'une carte : la page Entraîneur. */
export interface DetailEntraineur extends CarteEntraineurLue {
  enAttente: Partial<StatsEntraineur>;
  jauges: Record<CleEntraineur, { crans: number; taille: number; dette: number }>;
  journal: FaitEntraineur[];
  majs: MiseAJourEntraineur[];
}

/** La carte de départ : 75 partout, sans rencontre. */
export const STATS_DEPART: StatsEntraineur = { RES: DEPART_ENTRAINEUR, PRES: DEPART_ENTRAINEUR, COH: DEPART_ENTRAINEUR };

interface Lues {
  cartes: CarteEntraineurLue[];
  charge: boolean;
}

const RIEN: Lues = { cartes: [], charge: false };
const UNE_MINUTE = 60_000;
const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

type Un<T> = T | T[] | null;
const un = <T,>(v: Un<T>): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);

interface LigneCarte {
  joueur: string;
  equipe_id: number | null;
  res: number;
  pres: number;
  coh: number;
  note: number;
  rencontres: number;
  p: Un<{ name: string }>;
}

const versCarte = (r: LigneCarte): CarteEntraineurLue => ({
  joueur: r.joueur,
  nom: un(r.p)?.name ?? "?",
  equipeId: r.equipe_id,
  stats: { RES: r.res, PRES: r.pres, COH: r.coh },
  note: r.note,
  rencontres: r.rencontres,
});

let lues = RIEN;
let lueLe = 0;
let enCours = false;
const abonnes = new Set<() => void>();
let arreter: (() => void) | null = null;

function publier(l: Lues) {
  lues = l;
  for (const f of abonnes) f();
}

async function lire(force = false) {
  if (enCours || document.visibilityState !== "visible") return;
  if (!force && lues.charge && Date.now() - lueLe < UNE_MINUTE) return;
  enCours = true;
  try {
    const { data, error } = await supabase()
      .from("entraineur_cartes")
      .select("joueur, equipe_id, res, pres, coh, note, rencontres, p:profiles!entraineur_cartes_joueur_fkey(name)");
    // Sans la table (une préversion sur la base d'avant) : aucune carte gardée.
    const cartes = error ? [] : ((data ?? []) as unknown as LigneCarte[]).map(versCarte);
    lueLe = Date.now();
    publier({ cartes, charge: true });
  } catch {
    if (!lues.charge) publier({ ...lues, charge: true });
  } finally {
    enCours = false;
  }
}

function abonner(f: () => void): () => void {
  abonnes.add(f);
  if (!arreter) {
    const relire = () => void lire();
    const apresGeste = () => void lire(true);
    void lire();
    document.addEventListener("visibilitychange", relire);
    window.addEventListener(EVT_EQUIPE, apresGeste);
    arreter = () => {
      document.removeEventListener("visibilitychange", relire);
      window.removeEventListener(EVT_EQUIPE, apresGeste);
    };
  }
  return () => {
    abonnes.delete(f);
    if (abonnes.size === 0 && arreter) {
      arreter();
      arreter = null;
    }
  };
}

const rienAEcouter = () => () => {};

/** La carte de Lucien dans l'aperçu : ses trois saisons, et Sunday Five (l'équipe 1 de la démonstration). */
function detailDemo(): DetailEntraineur {
  const ev = carteEntraineurDemo();
  return {
    joueur: `demo-${ENTRAINEUR_DEMO}`,
    nom: ENTRAINEUR_DEMO,
    equipeId: 1,
    stats: ev.officielles,
    note: noteEntraineur(ev.officielles),
    rencontres: ev.rencontres,
    enAttente: ev.enAttente,
    jauges: ev.jauges,
    journal: ev.journal,
    majs: ev.majs,
  };
}

/** Toutes les cartes d'entraîneur gardées. */
export function useCartesEntraineur(): Lues & { demo: boolean } {
  const session = useSession();
  const connecte = !!session?.server && !session.enAttente;
  const { demo } = useEquipes();
  const reel = useSyncExternalStore(connecte && !demo ? abonner : rienAEcouter, () => lues, () => RIEN);
  return useMemo(() => {
    if (demo) return { cartes: [detailDemo()], charge: true, demo: true };
    return { ...(connecte ? reel : RIEN), demo: false };
  }, [demo, connecte, reel]);
}

/** La carte d'une personne (son identifiant, sinon son nom de saison) ; null : elle n'a jamais été posée. */
export function useCarteEntraineur(qui: { id?: string | null; nom?: string | null }): CarteEntraineurLue | null {
  const { cartes } = useCartesEntraineur();
  const { id, nom } = qui;
  return useMemo(() => cartes.find((c) => (id && c.joueur === id) || (!!nom && memeNom(c.nom, nom))) ?? null, [cartes, id, nom]);
}

/** Les trois d'une carte, ou celles de départ (un entraîneur qui vient d'arriver). */
export const statsDe = (c: CarteEntraineurLue | null | undefined): StatsEntraineur => c?.stats ?? STATS_DEPART;

interface LigneDetail {
  joueur: string;
  en_attente: Partial<StatsEntraineur> | null;
  jauges: Partial<DetailEntraineur["jauges"]> | null;
  journal: FaitEntraineur[] | null;
  majs: MiseAJourEntraineur[] | null;
}

const JAUGE_VIDE = { crans: 0, taille: 2, dette: 0 };

/**
 * Le détail de MA carte (la page Entraîneur de Ma carte) ; null tant qu'il
 * n'est pas lu, sans carte, ou pour la carte de quelqu'un d'autre : le
 * journal (« Sami a été exclu »), les jauges et ce qui attend ne se lisent que
 * par leur entraîneur (ma_carte_entraineur, supabase/schema.sql).
 */
export function useDetailEntraineur(nom: string): DetailEntraineur | null {
  const { demo } = useCartesEntraineur();
  const carte = useCarteEntraineur({ nom });
  const [lu, setLu] = useState<{ joueur: string; detail: Omit<DetailEntraineur, keyof CarteEntraineurLue> } | null>(null);
  const joueur = demo ? null : (carte?.joueur ?? null);
  useEffect(() => {
    if (!joueur) return;
    let fini = false;
    void supabase()
      .rpc("ma_carte_entraineur")
      .maybeSingle()
      .then(({ data, error }) => {
        if (fini || error || !data) return;
        const d = data as LigneDetail;
        // Ma carte seulement : la ligne rendue est la mienne, pas forcément celle qu'on regarde.
        if (d.joueur !== joueur) return;
        setLu({
          joueur,
          detail: {
            enAttente: d.en_attente ?? {},
            jauges: Object.fromEntries(CLES_ENTRAINEUR.map((k) => [k, d.jauges?.[k] ?? JAUGE_VIDE])) as DetailEntraineur["jauges"],
            journal: Array.isArray(d.journal) ? d.journal : [],
            majs: Array.isArray(d.majs) ? d.majs : [],
          },
        });
      });
    return () => {
      fini = true;
    };
  }, [joueur, carte?.note, carte?.rencontres]);
  return useMemo(() => {
    if (demo) return memeNom(nom, ENTRAINEUR_DEMO) ? detailDemo() : null;
    if (!carte || !lu || lu.joueur !== carte.joueur) return null;
    return { ...carte, ...lu.detail };
  }, [demo, nom, carte, lu]);
}
