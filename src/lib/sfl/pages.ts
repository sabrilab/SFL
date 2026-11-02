// Lire une table entière, page par page : la base n'en rend que 1 000 lignes
// d'un coup (le plafond de l'API Supabase). Les achats en XP de toute la
// ligue (achats_xp) et les paliers gardés (passe_acquis) se lisaient d'une
// seule requête (relecture du 02/11/2026) : passé 1 000 lignes, les skins de
// nation et les paliers de certains joueurs auraient disparu de toutes les
// cartes, la sienne comprise. Le même geste que toutLire des pages d'admin.
//
// Pur : ni React ni réseau (le lecteur est donné).

/** La taille d'une page : le plafond de l'API. */
export const PAGE = 1000;

/**
 * Toutes les lignes, page par page, jusqu'à une page incomplète. `lire(debut)`
 * rend les lignes de `debut` à `debut + PAGE - 1`, dans un ordre stable (la clé
 * primaire). À la première erreur, rend ce qui est lu et l'erreur : l'appelant
 * garde alors son cache plutôt qu'une liste coupée.
 */
export async function toutesLesPages<T>(
  lire: (debut: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>
): Promise<{ lu: T[]; error: unknown }> {
  const lu: T[] = [];
  for (let debut = 0; ; debut += PAGE) {
    const { data, error } = await lire(debut);
    if (error) return { lu, error };
    lu.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return { lu, error: null };
  }
}
