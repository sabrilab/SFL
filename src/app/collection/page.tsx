import { redirect } from "next/navigation";

// La Collection a rejoint l'Arène : tout le gameplay numérique (duels, matchs,
// cartes) tient dans un seul écran à trois onglets. L'ancienne adresse reste
// valable — elle mène simplement au bon onglet.
export default function CollectionRedirect() {
  redirect("/duel?mode=collection");
}
