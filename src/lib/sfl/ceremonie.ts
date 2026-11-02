// Une cérémonie à la fois (02/11/2026). À 19 h, la révélation ouvre la
// cérémonie (ta division, puis tes cartes : nouvelle-carte.tsx) au moment où
// les badges gagnés s'annoncent (vitrine.tsx, NouveauxBadges) : le toast
// « Tu as 1 badge · Voir » se posait sur « Les divisions · J5 ». Désormais,
// la cérémonie se déclare dès qu'elle se décide, et les annonces attendent
// qu'elle soit finie.
//
// Un compteur en mémoire, rien de stocké : une app rouverte repart de zéro.

const EVENT = "sfl-ceremonie";
let ouvertes = 0;

/** Une cérémonie va s'ouvrir (ou s'ouvre) : les annonces attendront. Rend la fonction qui la ferme (une seule fois). */
export function ouvrirCeremonie(): () => void {
  ouvertes++;
  let fermee = false;
  return () => {
    if (fermee) return;
    fermee = true;
    ouvertes = Math.max(0, ouvertes - 1);
    try {
      window.dispatchEvent(new Event(EVENT));
    } catch {
      /* hors navigateur */
    }
  };
}

export function enCeremonie(): boolean {
  return ouvertes > 0;
}

/** Fait `f` tout de suite s'il n'y a pas de cérémonie, sinon à sa fin. Rend de quoi l'annuler. */
export function apresLaCeremonie(f: () => void): () => void {
  if (!enCeremonie()) {
    f();
    return () => {};
  }
  let fait = false;
  const quand = () => {
    if (fait || enCeremonie()) return;
    fait = true;
    window.removeEventListener(EVENT, quand);
    // Un temps de respiration après la cérémonie.
    window.setTimeout(f, 600);
  };
  window.addEventListener(EVENT, quand);
  return () => {
    fait = true;
    window.removeEventListener(EVENT, quand);
  };
}
