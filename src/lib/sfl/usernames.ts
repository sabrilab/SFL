// Pseudos des joueurs — inventés en attendant les vrais comptes.
//
// Style des écrans du design (« @sofdrb », « @yanisb », « @karimd ») :
// prénom en minuscules sans accent + initiale du second mot s'il existe.
// La fonction est PURE et déterministe : le même nom donne toujours le même
// pseudo, sur tous les appareils, sans stockage. Quand les comptes arriveront,
// le pseudo choisi par le joueur remplacera simplement cette valeur.

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export function username(name: string): string {
  const words = name.trim().split(/\s+/);
  const base = strip(words[0]);
  const suffix = words.length > 1 ? strip(words[1]).slice(0, 1) : "";
  return `@${base}${suffix}` === "@" ? "@joueur" : `@${base}${suffix}`;
}
