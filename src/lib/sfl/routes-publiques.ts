// Les adresses de l'app ouvertes à qui n'a pas de compte : ce que laisse
// passer la porte (components/sfl/auth/auth-gate.tsx). Sorties du composant le
// 12/11/2026, avec la page getbola.app/sfl, pour qu'un banc les relise
// (tools/page-sfl-check.ts) : une adresse ajoutée ici par erreur ouvrirait
// l'app à tous.
//
// Deux sortes d'adresses :
//   · des débuts d'adresse (PUBLIC_ROUTES) : le lien d'accueil personnel
//     envoyé par l'admin, la création de compte, le lien d'invitation d'une
//     équipe (mode Team), le lien d'un parrain (/p/code), le lien d'une vidéo
//     (/v/id, sans la vidéo) et la politique de confidentialité ;
//   · une adresse entière : la présentation de la ligue, /sfl, le lien de sa
//     bio Instagram. Comparée en entier partout (la porte, la barre d'onglets,
//     l'accueil, le guide d'installation, l'intro) : /sflx ou /sfl/abc ne sont
//     pas elle, et n'héritent de rien.
//
// Pur : ni React, ni navigateur.

/** Les débuts d'adresse ouverts à tous. */
export const PUBLIC_ROUTES = ["/bienvenue", "/inscription", "/equipe/", "/p/", "/v/", "/confidentialite"] as const;

/** L'adresse de la présentation de la ligue. */
export const CHEMIN_SFL = "/sfl";

/** Est-ce la présentation de la ligue ? L'adresse entière, à la lettre. */
export function estPageSfl(chemin: string | null | undefined): boolean {
  return chemin === CHEMIN_SFL;
}

/**
 * getbola.app/SFL, écrit en capitales comme le sigle : la même page, à la
 * casse près. Le serveur ne la connaît pas (les adresses de Next distinguent
 * les capitales) : la porte y renvoie (AuthGate).
 */
export function estPageSflMalEcrite(chemin: string | null | undefined): boolean {
  return !!chemin && chemin !== CHEMIN_SFL && chemin.replace(/\/$/, "").toLowerCase() === CHEMIN_SFL;
}

/** La porte laisse-t-elle passer cette adresse sans compte ? */
export function estPublique(chemin: string | null | undefined): boolean {
  return estPageSfl(chemin) || PUBLIC_ROUTES.some((r) => !!chemin?.startsWith(r));
}
