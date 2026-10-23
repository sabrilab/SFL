// Le mode Team en aperçu (développement et aperçus Vercel seulement, jamais
// en production) : tant que la base n'a pas les tables des équipes, la page
// Team montre un petit monde tiré des vrais noms de la ligue — mon équipe
// en formation, trois autres, un défi reçu. Rien n'est écrit.

import type { Defi, Equipe } from "@/lib/sfl/equipes";
import { aujourdhuiIso } from "@/lib/sfl/matchs";

export const DEMO_EQUIPES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

export function demoEquipes(noms: string[], moi: string): { equipes: Equipe[]; defis: Defi[] } {
  const autres = noms.filter((n) => n !== moi);
  const pris = (i: number, n: number) => autres.slice(i, i + n);
  const m = (name: string, role: "capitaine" | "vice" | "membre" = "membre", statut: "membre" | "invite" = "membre") => ({ id: `demo-${name}`, name, role, statut });
  const equipe = (id: number, nom: string, initiales: string, fond: "noir" | "blanc", ville: string, joueurs: string[]): Equipe => ({
    id,
    nom,
    initiales,
    fond,
    ville,
    capitaine: `demo-${joueurs[0]}`,
    membres: joueurs.map((n, i) => m(n, i === 0 ? "capitaine" : i === 1 ? "vice" : "membre")),
  });

  const mienne = equipe(1, "Sunday Five", "SF", "noir", "Lille", [moi, ...pris(0, 4)]);
  // Un invité depuis cinq heures : il lui en reste 67 pour signer.
  mienne.membres.push({
    ...m(autres[4] ?? "Invité", "membre", "invite"),
    depuis: new Date(Date.now() - 5 * 3600_000).toISOString(),
    invitePar: `demo-${moi}`,
  });
  const [a, j, d] = aujourdhuiIso().split("-").map(Number);
  const dans = (n: number) => new Date(Date.UTC(a, j - 1, d + n)).toISOString().slice(0, 10);
  return {
    equipes: [
      mienne,
      equipe(2, "FC Belleville", "FCB", "blanc", "Lille", pris(5, 6)),
      equipe(3, "Racing Wazemmes", "RW", "noir", "Lille", pris(11, 7)),
      equipe(4, "AS Fives", "ASF", "blanc", "Lille", pris(18, 3)),
    ],
    defis: [{ id: 1, de: 2, a: 1, jour: dans(4), heure: "20:00", lieu: "Five Lille Sud", statut: "propose" }],
  };
}
