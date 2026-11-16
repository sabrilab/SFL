// La ligue devient payante après le prix premiers joueurs.
//
// Sabri, 16/11/2026 : « les joueurs vont jouer dimanche […] la journée où ils
// vont jouer le soir est encore gratuite. Mais […] pour la journée suivante,
// payer : ce sera payant. » Dimanche 22/11 se joue gratuitement ; dès la fin
// du compte à rebours (dimanche 23:59, compte-a-rebours.ts), la convocation
// suivante (elle rouvre le lundi) demande un abonnement Bola Plus actif pour
// dire « Je viens ». À la place du glissé : la carte « Bola Plus · J8 », qui
// mène à /profil/bola-plus.
//
// Trois verrous, pour que personne ne soit bloqué sans pouvoir payer :
//   - le paiement est ouvert (NEXT_PUBLIC_BOLA_PLUS_PAIEMENT=1, Stripe posé) ;
//   - le joueur voit Bola Plus (bola-plus.ts, voitBolaPlus : les admins
//     aujourd'hui, tout le monde le jour de l'annonce) ;
//   - les admins, qui organisent, ne sont jamais bloqués (sauf en aperçu).
// Un Stripe injoignable ne bloque personne : dans le doute, on joue.

import { isAdmin } from "./admin";
import { voitBolaPlus } from "./bola-plus";
import { FIN_PREMIERS_JOUEURS } from "./compte-a-rebours";

export interface EtatPayant {
  nom: string | null | undefined;
  /** L'heure du téléphone, en ms. */
  maintenant: number;
  /** NEXT_PUBLIC_BOLA_PLUS_PAIEMENT=1. */
  paiementActif: boolean;
  /** Abonné Bola Plus (lu chez Stripe) ; null tant qu'on ne sait pas, ou si Stripe ne répond pas. */
  abonne: boolean | null;
  /** Aperçu admin : faire comme si la journée gratuite était passée. */
  apercu?: boolean;
}

/** La journée gratuite est passée (dimanche 22/11, 23:59, heure de Paris). */
export const apresJourneeGratuite = (maintenant: number, fin: number = FIN_PREMIERS_JOUEURS) => maintenant > fin;

/** Le joueur doit-il s'abonner pour répondre à la convocation ? */
export function abonnementRequis(e: EtatPayant): boolean {
  if (e.abonne !== false) return false;
  if (e.apercu && isAdmin(e.nom)) return true;
  if (!e.paiementActif || !voitBolaPlus(e.nom) || isAdmin(e.nom)) return false;
  return apresJourneeGratuite(e.maintenant);
}

/** La clé de l'aperçu admin, dans le stockage du téléphone. */
export const CLE_APERCU_PAYANT = "sfl-payant-apercu";
