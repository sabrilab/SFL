// Les joueurs qu'une pièce partagée au Vestiaire met en avant : la carte de
// l'un, le podium d'un classement, les joueurs d'un élément de la Ligue.
// Ils sont prévenus comme s'ils étaient cités (Sabri, 19/10 : « quand des
// partages d'informations sont cités avec des joueurs, eux-mêmes reçoivent
// la notif »). Pur : lu par l'app et par /api/vestiaire/notifier.

export function joueursDePiece(piece: unknown): string[] {
  const p = piece as { type?: string; joueur?: unknown; top?: unknown; lignes?: unknown } | null;
  if (!p || typeof p !== "object") return [];
  const noms: unknown[] =
    p.type === "carte"
      ? [p.joueur]
      : p.type === "classement" && Array.isArray(p.top)
        ? p.top.map((l) => (l as { n?: unknown }).n)
        : p.type === "ligue" && Array.isArray(p.lignes)
          ? p.lignes.map((l) => (l as { n?: unknown }).n)
          : [];
  return [...new Set(noms.filter((n): n is string => typeof n === "string" && n.length > 0))];
}
