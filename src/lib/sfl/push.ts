// Notifications sur le téléphone (web push) : ce que l'app et le serveur
// partagent.
//
// La clé publique VAPID n'a rien de secret : le téléphone la demande à
// /api/push/cle au moment de s'abonner, et le service de push (Apple,
// Google, Mozilla) vérifie avec elle que les envois viennent bien de nous.
// La paire vit côté serveur (lib/server/web-push.ts, cleVapid).

/** Ce que porte une notification (lu par public/sw.js). */
export interface Notif {
  titre: string;
  texte: string;
  /** Page ouverte au toucher, dans l'app. */
  url: string;
}

export const TITRE_MAX = 60;
export const TEXTE_MAX = 180;

export function estNotif(v: unknown): v is Notif {
  if (!v || typeof v !== "object") return false;
  const n = v as Record<string, unknown>;
  return (
    typeof n.titre === "string" &&
    n.titre.trim().length > 0 &&
    n.titre.length <= TITRE_MAX &&
    typeof n.texte === "string" &&
    n.texte.trim().length > 0 &&
    n.texte.length <= TEXTE_MAX &&
    typeof n.url === "string" &&
    n.url.startsWith("/")
  );
}
