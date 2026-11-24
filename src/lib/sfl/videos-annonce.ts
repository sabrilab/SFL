// Le texte de la notification d'une nouvelle vidéo (lib/sfl/videos.ts) : le
// même pour la route qui l'envoie (/api/videos/annoncer) et pour l'admin, qui
// le lit avant d'envoyer. Le titre de la vidéo, puis sa légende (ou, sans
// légende, « Nouvelle vidéo dans les Actus. »). Module pur.

const couper = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function texteAnnonceVideo(v: { titre: string; legende: string | null; photos?: string[] | null }): { titre: string; texte: string } {
  const defaut = v.photos?.length ? "Nouvelles photos dans les Actus." : "Nouvelle vidéo dans les Actus.";
  return { titre: couper(v.titre, 60), texte: couper(v.legende?.trim() || defaut, 180) };
}
