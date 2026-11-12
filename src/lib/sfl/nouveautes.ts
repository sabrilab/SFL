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
//
// Une nouveauté peut dire où elle se trouve (`ici`) : si l'app s'ouvre déjà
// sur cette page (le toucher d'une notification qui y mène), rien ne vient la
// couvrir à cette ouverture, ni elle (elle est notée vue), ni une plus
// ancienne pas encore vue (elle viendra à l'ouverture suivante).
//
// Tout le choix est pur : le filtre des dates et du public
// (nouveautesEnCours), « déjà sur place » (estSurPlace), ce qu'il faut
// montrer et noter à cette ouverture (choisirNouveaute), et les deux boutons
// de la dernière diapo (gestesDeFin, que lit diaporama.tsx).
// tools/nouveautes-check.ts les vérifie, avec le registre. Ce fichier ne lit
// la base et l'appareil que dans nouveauteAMontrer et noterNouveauteVue.

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
  /** La page où elle se trouve : ouverte dessus, l'app ne l'annonce pas (elle est vue). */
  ici?: string;
}

/** Les nouveautés annoncées, de la plus ancienne à la plus récente. */
export const NOUVEAUTES: readonly Nouveaute[] = [
  { id: "journees-et-blessures", le: "2026-10-27T00:45:00+01:00", jusquAu: "2026-11-24T00:00:00+01:00", ligueSeulement: true },
  // Réponse scellée, missions dans Ma carte : pour tous (le drapeau vaut pour
  // la nouveauté entière, pas pour une diapo). Sa première diapo, « Invite.
  // Monte. », est partie le 12/11 : le parrainage a son annonce à lui, plus bas.
  { id: "nouveautes-27-10", le: "2026-10-27T19:40:00+01:00", jusquAu: "2026-11-24T19:40:00+01:00" },
  // Confirmer ou infirmer le résultat d'un match Bola (28/10) : pour tous. À
  // recaler sur l'heure de mise en ligne.
  { id: "confirmer-resultats", le: "2026-10-28T20:00:00+01:00", jusquAu: "2026-11-25T20:00:00+01:00" },
  // La carte des joueurs Bola qui bouge à chaque match, la carte MVP, les
  // missions perso (28/10) : pour les joueurs Bola. À recaler sur l'heure de
  // mise en ligne.
  { id: "carte-bola", le: "2026-10-28T21:00:00+01:00", jusquAu: "2026-11-25T21:00:00+01:00", bolaSeulement: true },
  // Le parrainage, annoncé pour de bon (12/11) : ton lien ouvre ta carte, une
  // recrue = +100 XP, la carte Fondateur à 10. Pour tous ; le bouton mène à
  // Inviter. À recaler sur l'heure de mise en ligne.
  { id: "parrainage", le: "2026-11-12T21:15:00+01:00", jusquAu: "2026-12-10T21:15:00+01:00", ici: "/parrainage" },
];

/**
 * Les nouveautés à annoncer à cet instant à ce public, de la plus ancienne à
 * la plus récente : mises en ligne, pas encore périmées, et pour lui.
 * `ligue` : un joueur de la ligue ; `bola` : un joueur Bola, hors de la SFL
 * (un arbitre n'est ni l'un ni l'autre).
 */
export function nouveautesEnCours(
  liste: readonly Nouveaute[],
  instant: Date,
  qui: { ligue: boolean; bola: boolean }
): Nouveaute[] {
  const t = instant.getTime();
  return liste.filter(
    (n) =>
      t >= Date.parse(n.le) &&
      t < Date.parse(n.jusquAu) &&
      (qui.ligue || !n.ligueSeulement) &&
      (qui.bola || !n.bolaSeulement)
  );
}

/** L'app est-elle ouverte sur la page `ici` (ou une page en dessous) ? */
export function estSurPlace(chemin: string, ici: string): boolean {
  return chemin === ici || chemin.startsWith(`${ici}/`);
}

/** Ce qu'une ouverture de l'app fait des nouveautés. */
export interface ChoixNouveaute {
  /** Celle à montrer à cette ouverture, ou null. */
  aMontrer: Nouveaute | null;
  /** Celles à noter vues sans les montrer (sur l'appareil et dans la base) : l'app est ouverte sur leur page. */
  aNoterVues: string[];
  /** Celles que la base dit vues (sur un autre téléphone) : cet appareil s'en souvient aussi. */
  aRetenir: string[];
}

/**
 * Le choix d'une ouverture, sans rien lire ni écrire.
 * `chemin` : la page où l'app s'ouvre. `vueIci` : cet appareil l'a-t-il déjà
 * vue ? `profil` : ce que la base sait du joueur (ses nouveautés vues, la fin
 * de son accueil), ou null si elle n'a pas répondu.
 *   · ouverte sur la page d'une nouveauté en cours : rien à montrer, et
 *     celle-là est notée vue si elle ne l'était pas ;
 *   · sinon la plus ancienne pas encore vue, ni ici ni dans la base, et mise
 *     en ligne après la fin de l'accueil du joueur.
 */
export function choisirNouveaute(
  liste: readonly Nouveaute[],
  instant: Date,
  qui: { ligue: boolean; bola: boolean },
  chemin: string,
  vueIci: (id: string) => boolean,
  profil: { vues: readonly string[]; accueil: string | null } | null
): ChoixNouveaute {
  const enCours = nouveautesEnCours(liste, instant, qui);
  const surPlace = enCours.filter((n) => n.ici !== undefined && estSurPlace(chemin, n.ici));
  if (surPlace.length) {
    return { aMontrer: null, aNoterVues: surPlace.filter((n) => !vueIci(n.id)).map((n) => n.id), aRetenir: [] };
  }
  const aRetenir: string[] = [];
  for (const n of enCours) {
    if (vueIci(n.id)) continue;
    if (profil?.vues.includes(n.id)) {
      aRetenir.push(n.id);
      continue;
    }
    // Arrivé après : son accueil lui a montré l'app telle qu'elle est.
    if (profil?.accueil && Date.parse(profil.accueil) > Date.parse(n.le)) continue;
    return { aMontrer: n, aNoterVues: [], aRetenir };
  }
  return { aMontrer: null, aNoterVues: [], aRetenir };
}

/** Le second geste de la dernière diapo : là où la nouveauté se trouve. */
export interface Aller {
  label: string;
  href: string;
  /** C'est lui le geste principal, « C'est compris » passe dessous (le parrainage : « Inviter »). */
  principal?: boolean;
}

/** Ce que fait un bouton du diaporama : la diapo suivante, fermer, ou fermer et aller à la page. */
export type GesteNouveaute = "suivant" | "fermer" | "aller";

/**
 * Les deux boutons du bas d'une diapo. Avant la dernière : « Suivant », seul.
 * Sur la dernière : « C'est compris » ferme, et le geste de la nouveauté mène
 * à sa page, dessous ; une nouveauté dont le but est d'y aller
 * (`aller.principal`) les inverse, son geste en principal au ton mauve.
 */
export function gestesDeFin(
  derniere: boolean,
  aller?: Aller
): {
  principal: { label: string; geste: GesteNouveaute; ton: "vert" | "mauve" };
  discret: { label: string; geste: GesteNouveaute } | null;
} {
  if (!derniere) return { principal: { label: "Suivant", geste: "suivant", ton: "vert" }, discret: null };
  const compris = { label: "C'est compris", geste: "fermer" } as const;
  if (!aller) return { principal: { ...compris, ton: "vert" }, discret: null };
  const yAller = { label: aller.label, geste: "aller" } as const;
  return aller.principal ? { principal: { ...yAller, ton: "mauve" }, discret: compris } : { principal: { ...compris, ton: "vert" }, discret: yAller };
}

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
  const choisir = (profil: { vues: readonly string[]; accueil: string | null } | null) =>
    choisirNouveaute(NOUVEAUTES, maintenant, { ligue, bola }, window.location.pathname, (id) => vueIci(id, nom), profil);
  // Sans la base d'abord : sur place, ou plus rien à voir ici, elle n'est pas lue.
  const ici = choisir(null);
  for (const id of ici.aNoterVues) void noterNouveauteVue(id, nom);
  if (!ici.aMontrer) return null;
  const choix = choisir(await lireProfil());
  // Vue sur un autre téléphone : celui-ci s'en souvient aussi.
  for (const id of choix.aRetenir) {
    try {
      window.localStorage.setItem(cleIci(id, nom), "base");
    } catch {}
  }
  return choix.aMontrer;
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
