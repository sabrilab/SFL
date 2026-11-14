// L'apparence de l'app (Sabri, 14/11/2026 : la Pelouse partout, « une version
// claire et une version sombre qui s'active le matin ou la nuit »). Trois
// choix, gardés sur le téléphone (bola-apparence) :
// · auto (par défaut) : clair de 7 h à 20 h, sombre la nuit, heure du téléphone ;
// · clair, sombre : imposés par le joueur (Réglages, ou le rond de Ma carte).
// next-themes reste celui qui pose la classe .dark (clé bola-theme-2) : on lui
// donne le mode résolu. SCRIPT_APPARENCE le pose avant le premier rendu, avec
// le style Pelouse (data-famille, data-style), pour qu'aucun écran ne clignote.
// ?mode=jour ou ?mode=nuit force le mode (captures).

export type Apparence = "auto" | "clair" | "sombre";
export type Mode = "light" | "dark";

export const CLE_APPARENCE = "bola-apparence";
export const CLE_THEME = "bola-theme-2";
const EVENEMENT = "bola-apparence";

/** Le jour va de 7 h à 20 h. */
export const DEBUT_JOUR = 7;
export const FIN_JOUR = 20;

export function lireApparence(): Apparence {
  try {
    const a = localStorage.getItem(CLE_APPARENCE);
    if (a === "clair" || a === "sombre") return a;
  } catch {}
  return "auto";
}

export function ecrireApparence(a: Apparence) {
  try {
    if (a === "auto") localStorage.removeItem(CLE_APPARENCE);
    else localStorage.setItem(CLE_APPARENCE, a);
  } catch {}
  window.dispatchEvent(new Event(EVENEMENT));
}

export function ecouterApparence(rappel: () => void) {
  window.addEventListener(EVENEMENT, rappel);
  window.addEventListener("storage", rappel);
  return () => {
    window.removeEventListener(EVENEMENT, rappel);
    window.removeEventListener("storage", rappel);
  };
}

function modeDeLAdresse(): Mode | null {
  try {
    const m = new URLSearchParams(window.location.search).get("mode");
    if (m === "jour") return "light";
    if (m === "nuit") return "dark";
  } catch {}
  return null;
}

/** Le mode à afficher maintenant. */
export function modeResolu(a: Apparence = lireApparence(), maintenant = new Date()): Mode {
  const force = modeDeLAdresse();
  if (force) return force;
  if (a === "clair") return "light";
  if (a === "sombre") return "dark";
  const h = maintenant.getHours();
  return h >= DEBUT_JOUR && h < FIN_JOUR ? "light" : "dark";
}

/** Le style Pelouse du mode : le 16 arrondi la nuit, Craie (24) le jour. */
export const styleDuMode = (m: Mode) => (m === "light" ? "24" : "16");

/** Posé dans <head>, avant tout rendu : le mode et le style Pelouse. */
export const SCRIPT_APPARENCE = `(function(){try{
var a=localStorage.getItem("${CLE_APPARENCE}");
var q=new URLSearchParams(location.search).get("mode");
var h=new Date().getHours();
var m=q==="jour"?"light":q==="nuit"?"dark":a==="clair"?"light":a==="sombre"?"dark":(h>=${DEBUT_JOUR}&&h<${FIN_JOUR}?"light":"dark");
localStorage.setItem("${CLE_THEME}",m);
var d=document.documentElement;
d.classList.remove("light","dark");d.classList.add(m);d.style.colorScheme=m;
d.dataset.famille="pelouse";d.dataset.style=m==="light"?"24":"16";
}catch(e){}})();`;
