// Ce qu'une notification dit d'un message : sa phrase, ou, sans phrase, ce
// qu'il porte (un vocal, une photo, une carte…). Partagé par les routes qui
// préviennent : /api/vestiaire/notifier et /api/matchs/discussion. Module
// pur : ni navigateur, ni base.

export function resumeMessage(texte: string, piece: unknown): string {
  if (texte.trim()) return texte.trim();
  const type = (piece as { type?: string } | null)?.type;
  if (type === "vocal") return "🎤 Message vocal";
  if (type === "photo") return "📷 Photo";
  if (type === "video") return "🎬 Vidéo";
  if (type === "rejoint") return "a rejoint le match";
  if (type === "ligue") {
    const p = piece as { titre?: unknown; j?: unknown };
    return `a partagé « ${String(p.titre ?? "la Ligue")}${typeof p.j === "number" ? ` · J${p.j}` : ""} »`;
  }
  return type === "carte"
    ? "a partagé une carte"
    : type === "feuille"
      ? "a partagé une feuille de match"
      : "a partagé un classement";
}
