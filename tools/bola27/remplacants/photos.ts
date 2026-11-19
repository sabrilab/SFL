// Bola 27 (bola-app#33), le jeu seul : remplace « @/lib/sfl/photos ». Aucune photo de joueur : rien n'est lu, rien
// n'est téléchargé (dans l'app, ces fonctions lisent le seau « photos » de Supabase).
export function photoPerso(): string | null {
  return null;
}

export async function rafraichirPhotos(): Promise<void> {}
