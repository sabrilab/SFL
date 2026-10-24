// La politique de confidentialité de Bola : sa version, qui en répond, et
// l'âge sous lequel un parent doit donner son accord avec le joueur.
//
// Demandée par Sabri le 22/10/2026 : même en bêta fermée, les joueurs
// acceptent qu'on utilise leur image pour les fonctions de l'app, d'une case
// à cocher à l'ouverture, avec le texte entier à lire s'ils le veulent. Le
// texte vit dans components/sfl/confidentialite/politique.tsx, l'accord de
// chaque joueur dans la table consentements (supabase/schema.sql) et, côté
// téléphone, dans lib/sfl/consentement.ts.
//
// Module partagé : l'écran s'en sert, et les routes serveur qui envoient un
// visage ou des questions à un prestataire (/api/photo-studio, /api/agent)
// vérifient l'accord à CETTE version avant de le faire.

/**
 * La version en vigueur : la date du texte. La changer quand un changement
 * touche à ce que les joueurs ont accepté (un nouveau prestataire, un nouvel
 * usage de leur image) ; une retouche de forme ne la change pas. Le 24/10 : le
 * parrainage (les joueurs invités voient les cartes, la page d'un lien peut
 * montrer celle du parrain). C'est la version qu'enregistre un nouvel accord ;
 * la case ne revient que si VERSION_ACCEPTEE monte aussi.
 */
export const VERSION_POLITIQUE = "2026-10-24";

/**
 * La plus ancienne version qui vaut encore accord : qui a accepté celle-ci ou
 * une plus récente ne revoit pas la case à l'ouverture, et les routes serveur
 * le laissent passer. Sabri, 24/10/2026 : ne pas redemander l'accord à chaque
 * changement (« sinon ils vont recevoir que des trucs en mode accepter ») ; on
 * regroupera les changements. Le jour où la case doit revenir, monter
 * VERSION_ACCEPTEE à VERSION_POLITIQUE.
 */
export const VERSION_ACCEPTEE = "2026-10-22";

/** Cet accord vaut-il encore ? Les versions sont des dates AAAA-MM-JJ, comparées comme textes. */
export function accordValable(version: string | null | undefined): boolean {
  return !!version && version >= VERSION_ACCEPTEE;
}

/** La même, telle qu'on l'écrit en tête du texte. */
export const DATE_POLITIQUE = "24 octobre 2026";

/**
 * Avant cet âge, l'accord d'un parent s'ajoute à celui du joueur (loi
 * Informatique et Libertés, article 45). L'inscription est ouverte dès 12 ans
 * (BORNES.ageMin, lib/sfl/inscription.ts).
 */
export const AGE_ACCORD_PARENT = 15;

/**
 * Qui répond de la politique : le responsable du traitement au sens du RGPD.
 * Bola, et pas une personne (Sabri, 22/10/2026 : « Dis pas par Sabri mais
 * Bola »). Quand Bola aura une adresse de contact, la mettre dans email ; le
 * jour où Bola devient une société, son nom légal va dans nom. Tant que
 * l'email manque, le texte renvoie au message privé à un administrateur.
 */
export const RESPONSABLE: { nom: string; email: string | null } = {
  nom: "Bola",
  email: null,
};

/** La date d'un accord, en clair : « 22 octobre 2026 ». */
export function dateAccord(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

/** L'âge, en années révolues, d'une date de naissance AAAA-MM-JJ ; null si illisible. */
export function ageDe(naissance: string | null | undefined, maintenant = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(naissance ?? "");
  if (!m) return null;
  const [a, mo, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let age = maintenant.getFullYear() - a;
  if (maintenant.getMonth() + 1 < mo || (maintenant.getMonth() + 1 === mo && maintenant.getDate() < j)) age--;
  return age >= 0 && age < 130 ? age : null;
}
