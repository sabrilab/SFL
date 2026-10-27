// Tous les contrats en jeu du dimanche vivent maintenant dans Ma carte →
// Niveau XP → Les autres (Sabri, 27/10 : « On veut pas voir les missions de
// tout le monde. Il faut que ça soit accessible dans l'onglet Ma carte, dans
// les niveaux XP ») : l'ancienne adresse y renvoie.

import { redirect } from "next/navigation";

export default function ContratsPage() {
  redirect("/profil/xp?vue=autres");
}
