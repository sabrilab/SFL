// La discussion d'un match en aperçu (développement et aperçus Vercel,
// jamais en production) : tant que la base n'a pas la discussion des
// matchs, la Map et l'écran de discussion montrent un fil d'essai tiré des
// vrais joueurs du match — qui arrive, « Le match, il est où ? », qui
// connaît quelqu'un de dispo. Rien n'est écrit.

import type { Partie } from "@/lib/sfl/matchs";
import type { Emoji, MessageV, Piece } from "@/lib/sfl/vestiaire";

export const DEMO_DISCUSSION = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

export function filDemo(p: Partie, moi: string | null): MessageV[] {
  const orga = p.organisateurId;
  const [a, b] = p.joueurs.filter((j) => j.statut === "inscrit" && j.id !== orga && j.id !== moi).map((j) => j.id);
  const nom = new Map([[orga, p.organisateur], ...p.joueurs.map((j) => [j.id, j.name] as const)]);
  const manque = Math.max(0, p.places - p.joueurs.length);

  const lignes: [string, string, Piece | null, Partial<Record<Emoji, string[]>>][] = [];
  if (a) lignes.push([a, "", { type: "rejoint" }, {}], [a, "Le match, il est où ?", null, {}]);
  lignes.push([orga, `${p.lieu}, le terrain du fond. Venez dix minutes avant, on fait les équipes`, null, a ? { "🔥": [a] } : {}]);
  if (b) lignes.push([b, "", { type: "rejoint" }, {}]);
  lignes.push([orga, manque > 0 ? `Vous connaissez quelqu'un de dispo ? Il en manque encore ${manque}` : "Complet, on est bons", null, {}]);
  const repond = b ?? a;
  if (repond) lignes.push([repond, manque > 0 ? "Je demande à mon cousin, il est chaud" : "Je ramène le ballon", null, { "🐐": [orga] }]);

  // Le dernier message il y a quatre minutes, les autres toutes les neuf.
  const t0 = Date.now() - ((lignes.length - 1) * 9 + 4) * 60_000;
  return lignes.map(([auteur, texte, piece, reactions], i) => ({
    // Des identifiants négatifs : jamais ceux d'un vrai message.
    id: -(i + 1),
    auteurId: auteur,
    auteur: nom.get(auteur) ?? "",
    texte,
    piece,
    at: t0 + i * 9 * 60_000,
    mien: auteur === moi,
    reponseA: null,
    reactions,
  }));
}
