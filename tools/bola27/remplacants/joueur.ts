// Bola 27 (bola-app#33), le jeu seul : remplace « @/components/sfl/player-provider » à la construction
// (tools/bola27/construire.mjs). Pas de compte ni de joueur de la ligue : le nom est vide, la page du jeu n'a donc ni
// nom ni photo à montrer et joue son joueur par défaut (le footballeur de Sabri, sans visage photographié).
// La forme est celle de useMyPlayer dans l'app ({ me, setMe, player }), pour que la page reste la même.
export function useMyPlayer() {
  return { me: "", setMe: () => {}, player: undefined };
}
