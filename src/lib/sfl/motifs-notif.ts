// Les motifs des notifications : pourquoi un joueur est prévenu sur son
// téléphone. Chaque route qui prévient donne le sien à l'envoi
// (lib/server/push-envoi.ts, prevenir), et Admin → Activité & rétention →
// Notifications les range par famille, avec pour chacun le geste qu'on en
// attendait. Sabri, 23/10 : « combien ont activé la notification et ce à
// quoi ils ont répondu suite à un motif […] Range bien pour qu'on arrive
// encore bien à s'y retrouver dans l'analyse pour améliorer ».
//
// Le geste attendu, c'est la base qui le reconnaît, sans rien demander à
// l'app : les triggers push_effet_* de supabase/schema.sql le donnent à la
// notification qui l'attendait. Ajouter un motif : l'écrire ici, le donner à
// l'envoi et, s'il attend un geste, l'ajouter à la liste de son trigger.
//
// Module pur, partagé par le serveur et la page admin.

export type FamilleNotif = "vestiaire" | "match" | "equipe" | "ligue" | "annonce";

/** Dans l'ordre de la page. */
export const FAMILLES_NOTIF: { id: FamilleNotif; label: string }[] = [
  { id: "vestiaire", label: "Vestiaire" },
  { id: "match", label: "Matchs entre joueurs" },
  { id: "equipe", label: "Discussion d'équipe" },
  { id: "ligue", label: "Ligue" },
  { id: "annonce", label: "Annonces de l'admin" },
];

interface DefMotif {
  famille: FamilleNotif;
  label: string;
  /** Le geste attendu, en clair ; null quand la toucher suffit. */
  effet: string | null;
}

const AU_VESTIAIRE = "a écrit ou réagi au Vestiaire";
const AU_MATCH = "a écrit ou réagi dans la discussion du match";
const A_L_EQUIPE = "a écrit ou réagi dans la discussion de l'équipe";

/** Dans l'ordre de la page, famille par famille. */
export const MOTIFS_NOTIF = {
  "vestiaire-message": { famille: "vestiaire", label: "Un nouveau message", effet: AU_VESTIAIRE },
  "vestiaire-reponse": { famille: "vestiaire", label: "On lui répond", effet: AU_VESTIAIRE },
  "vestiaire-cite": { famille: "vestiaire", label: "On le cite (@pseudo)", effet: AU_VESTIAIRE },
  "vestiaire-en-avant": { famille: "vestiaire", label: "On le met en avant", effet: AU_VESTIAIRE },
  "vestiaire-reaction": { famille: "vestiaire", label: "Une réaction reçue", effet: AU_VESTIAIRE },

  "match-invitation": { famille: "match", label: "Invitation à un match", effet: "a répondu à l'invitation" },
  "match-arrivee": { famille: "match", label: "Un joueur le rejoint", effet: AU_MATCH },
  "match-message": { famille: "match", label: "Un nouveau message", effet: AU_MATCH },
  "match-reponse": { famille: "match", label: "On lui répond", effet: AU_MATCH },
  "match-cite": { famille: "match", label: "On le cite (@pseudo)", effet: AU_MATCH },
  "match-reaction": { famille: "match", label: "Une réaction reçue", effet: AU_MATCH },
  "match-veille": { famille: "match", label: "Le rappel de la veille", effet: AU_MATCH },
  "match-modifie": { famille: "match", label: "Nouveau rendez-vous", effet: AU_MATCH },
  "match-annule": { famille: "match", label: "Match annulé", effet: null },

  "equipe-message": { famille: "equipe", label: "Un nouveau message", effet: A_L_EQUIPE },
  "equipe-reponse": { famille: "equipe", label: "On lui répond", effet: A_L_EQUIPE },
  "equipe-cite": { famille: "equipe", label: "On le cite (@pseudo)", effet: A_L_EQUIPE },
  "equipe-reaction": { famille: "equipe", label: "Une réaction reçue", effet: A_L_EQUIPE },

  // Prêts pour les missions du dimanche, les félicitations et les abonnés :
  // leurs routes n'ont qu'à les donner.
  missions: { famille: "ligue", label: "Tes missions du dimanche", effet: null },
  felicitation: { famille: "ligue", label: "On le félicite", effet: null },
  suivi: { famille: "ligue", label: "Un joueur le suit", effet: null },

  annonce: { famille: "annonce", label: "Annonce à toute la ligue", effet: null },
} as const satisfies Record<string, DefMotif>;

export type MotifNotif = keyof typeof MOTIFS_NOTIF;

export const estMotif = (m: string): m is MotifNotif => Object.hasOwn(MOTIFS_NOTIF, m);

/** Le motif d'une ligne lue en base ; un motif inconnu de cette version reste lisible. */
export function defMotif(m: string): DefMotif {
  return estMotif(m) ? MOTIFS_NOTIF[m] : { famille: "annonce", label: m, effet: null };
}

/** Les gestes posés sur une notification (push_envois.effet), en clair. */
export const GESTES_EFFET: Record<string, string> = {
  message: "a écrit",
  reaction: "a réagi",
  accepte: "a accepté",
  refuse: "a refusé",
};
