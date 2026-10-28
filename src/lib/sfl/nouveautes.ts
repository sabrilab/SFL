"use client";

// Les nouveautés annoncées aux joueurs (Sabri, 26/10 : « quand on fait de
// nouvelles fonctionnalités, une espèce de slideshow en intro assez élégante
// qui montre la fonctionnalité […] des fois je fais des fonctionnalités qui
// ne devront pas être signifiées aux utilisateurs »).
//
// Une nouveauté n'est annoncée que si Sabri l'a dit : elle a alors son entrée
// ici (son id, sa date de mise en ligne, jusqu'à quand l'annoncer) et ses
// diapos dans components/sfl/nouveautes. À l'ouverture de l'app, chaque
// joueur voit une fois chaque nouveauté pas encore vue, une par ouverture,
// la plus ancienne d'abord (invitation-carte.tsx).
//
// « Vue » se note dans la base (profiles.nouveautes_vues, la liste des ids) et
// sur cet appareil : elle ne revient pas sur un autre téléphone. Un joueur
// arrivé après la mise en ligne (son accueil fini après) ne la voit pas : son
// accueil lui a déjà montré l'app telle qu'elle est. Base pas encore migrée
// (aperçus Vercel) : ce que sait cet appareil.

import { supabase } from "@/lib/supabase";

export interface Nouveaute {
  /** Stable, jamais réutilisé : c'est ce que la base retient. */
  id: string;
  /** Mise en ligne (jour, heure de Paris). */
  le: string;
  /** Plus annoncée après ce jour : une nouveauté d'il y a un mois n'en est plus une. */
  jusquAu: string;
  /** Pour les joueurs de la ligue seulement (ni joueurs Bola hors saison, ni arbitres). */
  ligueSeulement?: boolean;
  /** Pour les joueurs Bola seulement (hors de la SFL) : le symétrique de ligueSeulement. */
  bolaSeulement?: boolean;
}

/** Les nouveautés annoncées, de la plus ancienne à la plus récente. */
export const NOUVEAUTES: readonly Nouveaute[] = [
  { id: "journees-et-blessures", le: "2026-10-27T00:45:00+01:00", jusquAu: "2026-11-24T00:00:00+01:00", ligueSeulement: true },
  // Parrainage paliers, réponse scellée, missions dans Ma carte : pour tous (le
  // drapeau vaut pour la nouveauté entière, pas pour une diapo).
  { id: "nouveautes-27-10", le: "2026-10-27T19:40:00+01:00", jusquAu: "2026-11-24T19:40:00+01:00" },
  // Confirmer ou infirmer le résultat d'un match Bola (28/10) : pour tous. À
  // recaler sur l'heure de mise en ligne.
  { id: "confirmer-resultats", le: "2026-10-28T20:00:00+01:00", jusquAu: "2026-11-25T20:00:00+01:00" },
  // La carte des joueurs Bola qui bouge à chaque match, la carte MVP, les
  // missions perso (28/10) : pour les joueurs Bola. À recaler sur l'heure de
  // mise en ligne.
  { id: "carte-bola", le: "2026-10-28T21:00:00+01:00", jusquAu: "2026-11-25T21:00:00+01:00", bolaSeulement: true },
];

const cleIci = (id: string, nom: string) => `bola-nouveaute-${id}-${nom}`;

function vueIci(id: string, nom: string): boolean {
  try {
    return window.localStorage.getItem(cleIci(id, nom)) !== null;
  } catch {
    return false;
  }
}

/** Ce que la base sait du joueur connecté : ses nouveautés vues, la fin de son accueil. */
async function lireProfil(): Promise<{ uid: string; vues: string[]; accueil: string | null } | null> {
  try {
    const { data: auth } = await supabase().auth.getSession();
    const uid = auth.session?.user.id;
    if (!uid) return null;
    const { data, error } = await supabase().from("profiles").select("accueil_le, nouveautes_vues").eq("id", uid).maybeSingle();
    if (error || !data) return null;
    const d = data as { accueil_le?: string | null; nouveautes_vues?: string[] | null };
    return { uid, vues: d.nouveautes_vues ?? [], accueil: d.accueil_le ?? null };
  } catch {
    return null;
  }
}

/**
 * La nouveauté à montrer à ce joueur à cette ouverture, ou null.
 * `ligue` : c'est un joueur de la ligue (ni Bola hors saison, ni arbitre).
 * `bola` : c'est un joueur Bola, hors de la SFL (un arbitre est hors ligue
 * sans être joueur Bola).
 */
export async function nouveauteAMontrer(nom: string, ligue: boolean, bola = false, maintenant = new Date()): Promise<Nouveaute | null> {
  const t = maintenant.getTime();
  const enCours = NOUVEAUTES.filter(
    (n) =>
      t >= Date.parse(n.le) &&
      t < Date.parse(n.jusquAu) &&
      (ligue || !n.ligueSeulement) &&
      (bola || !n.bolaSeulement) &&
      !vueIci(n.id, nom)
  );
  if (!enCours.length) return null;
  const profil = await lireProfil();
  for (const n of enCours) {
    if (profil?.vues.includes(n.id)) {
      // Vue sur un autre téléphone : celui-ci s'en souvient aussi.
      try {
        window.localStorage.setItem(cleIci(n.id, nom), "base");
      } catch {}
      continue;
    }
    // Arrivé après : son accueil lui a montré l'app telle qu'elle est.
    if (profil?.accueil && Date.parse(profil.accueil) > Date.parse(n.le)) continue;
    return n;
  }
  return null;
}

/** La nouveauté est vue : sur cet appareil, et dans la base. */
export async function noterNouveauteVue(id: string, nom: string): Promise<void> {
  try {
    window.localStorage.setItem(cleIci(id, nom), new Date().toISOString());
  } catch {}
  const profil = await lireProfil();
  if (!profil || profil.vues.includes(id)) return;
  try {
    await supabase()
      .from("profiles")
      .update({ nouveautes_vues: [...profil.vues, id] })
      .eq("id", profil.uid);
  } catch {
    // Hors ligne : l'appareil s'en souvient.
  }
}
