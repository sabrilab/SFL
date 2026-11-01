import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Les tailles et les arrondis nommés du design system (app/tokens.css) :
// sans eux, tailwind-merge prendrait text-corps pour une couleur et
// effacerait text-corps devant text-encre-3 (ou l'inverse).
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["micro", "etiquette", "legende", "petit", "corps", "ligne", "lecture", "titre", "titre-fort", "titre-m", "titre-g", "titre-l", "nom", "affiche"],
      radius: ["petit", "champ", "tuile", "feuille"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
