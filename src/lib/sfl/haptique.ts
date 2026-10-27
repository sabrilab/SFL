// Le petit choc sous le doigt, là où le téléphone sait le donner.
//
// Android et Chrome : navigator.vibrate. Safari sur iPhone (iOS 18 et
// plus) n'a pas vibrate, mais basculer un interrupteur natif
// (<input type="checkbox" switch>) y donne le même tic : on en pose un,
// invisible, le temps d'un clic. Ailleurs, rien, sans erreur.

export function tic(motif: number | number[] = 12): void {
  if (typeof navigator === "undefined" || typeof document === "undefined") return;
  try {
    if (navigator.vibrate?.(motif)) return;
  } catch {
    // Certains navigateurs lèvent hors d'un geste : on tente l'autre voie.
  }
  try {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.setAttribute("switch", "");
    label.setAttribute("aria-hidden", "true");
    label.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none";
    label.appendChild(input);
    document.body.appendChild(label);
    label.click();
    label.remove();
  } catch {
    // Pas de retour haptique possible ici.
  }
}
