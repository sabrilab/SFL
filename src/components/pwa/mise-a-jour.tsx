"use client";

// Les mises à jour qui arrivent toutes seules sur les téléphones.
//
// Une PWA installée sur iPhone n'est presque jamais relancée : iOS la garde
// en mémoire et la ressort telle quelle, des jours durant. La page n'est donc
// pas rechargée, le service worker ne change pas d'un déploiement à l'autre,
// et le joueur reste sur l'ancienne version tant qu'il ne tue pas l'app.
//
// Ici, l'app compare sa version (gravée au build, `NEXT_PUBLIC_BOLA_VERSION`)
// à celle que sert le serveur (`/api/version`) :
//   · au lancement, au retour au premier plan, au retour du réseau, et toutes
//     les cinq minutes tant qu'elle est à l'écran ;
//   · si elles diffèrent, elle se recharge d'elle-même, sauf si le joueur est
//     occupé (un champ en cours de frappe, l'appareil photo, une fenêtre
//     ouverte). Dans ce cas, une pastille « Mettre à jour » attend son
//     toucher, et le rechargement se fait de lui-même au prochain changement
//     d'écran.
// La saisie d'un match est gardée dans le téléphone (`saisie/store.ts`) : un
// rechargement ne la perd pas.

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { RefreshCw } from "lucide-react";

const VERSION = process.env.NEXT_PUBLIC_BOLA_VERSION ?? "";
const INTERVALLE = 5 * 60 * 1000;
/** La version vers laquelle on vient de recharger : garde-fou anti-boucle. */
const CLE_TENTEE = "bola-maj-tentee";

/** Le joueur est-il en train de faire quelque chose qu'un rechargement casserait ? */
function occupe(): boolean {
  const actif = document.activeElement as HTMLElement | null;
  if (actif) {
    const tag = actif.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || actif.isContentEditable) return true;
  }
  if (document.querySelector('[role="dialog"], [role="alertdialog"], [data-sans-rechargement]')) return true;
  // L'appareil photo allumé (Ma carte, inscription).
  for (const v of Array.from(document.querySelectorAll("video"))) {
    if (v.srcObject) return true;
  }
  return false;
}

async function versionServeur(): Promise<string | null> {
  try {
    const r = await fetch(`/api/version?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    const { version } = (await r.json()) as { version?: string };
    return version || null;
  } catch {
    return null; // Hors ligne : on réessaiera au retour du réseau.
  }
}

async function recharger(cible: string) {
  try {
    sessionStorage.setItem(CLE_TENTEE, cible);
  } catch {}
  // Le service worker vide ses fichiers gardés (photos, vidéos du dossier
  // public) pour que la nouvelle version ne reparte pas avec les anciens.
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const sw = reg?.active;
    if (sw) {
      await new Promise<void>((fini) => {
        const canal = new MessageChannel();
        canal.port1.onmessage = () => fini();
        sw.postMessage({ type: "sfl-nouvelle-version" }, [canal.port2]);
        setTimeout(fini, 1500); // Un ancien service worker ne répond pas.
      });
    }
    void reg?.update();
  } catch {}
  window.location.reload();
}

export function MiseAJour() {
  const [enAttente, setEnAttente] = useState<string | null>(null);
  const attente = useRef<string | null>(null);
  const pathname = usePathname();
  const premierChemin = useRef(pathname);

  const verifier = useCallback(async () => {
    if (!VERSION || document.visibilityState !== "visible") return;
    const serveur = await versionServeur();
    if (!serveur || serveur === VERSION) {
      attente.current = null;
      setEnAttente(null);
      return;
    }
    // On a déjà rechargé vers cette version et on est toujours sur
    // l'ancienne (un cache tenace) : pas de boucle, la pastille suffit.
    let dejaTentee = false;
    try {
      dejaTentee = sessionStorage.getItem(CLE_TENTEE) === serveur;
    } catch {}
    if (!dejaTentee && !occupe()) {
      void recharger(serveur);
      return;
    }
    attente.current = serveur;
    setEnAttente(serveur);
  }, []);

  useEffect(() => {
    const auLancement = window.setTimeout(verifier, 0);
    const auPremierPlan = () => {
      if (document.visibilityState === "visible") void verifier();
    };
    // `pageshow` : iOS ressort la page de son cache de navigation.
    const auRetour = (e: PageTransitionEvent) => {
      if (e.persisted) void verifier();
    };
    document.addEventListener("visibilitychange", auPremierPlan);
    window.addEventListener("pageshow", auRetour);
    window.addEventListener("online", verifier);
    const minuterie = window.setInterval(verifier, INTERVALLE);
    return () => {
      document.removeEventListener("visibilitychange", auPremierPlan);
      window.removeEventListener("pageshow", auRetour);
      window.removeEventListener("online", verifier);
      window.clearTimeout(auLancement);
      window.clearInterval(minuterie);
    };
  }, [verifier]);

  // Un changement d'écran est le meilleur moment : rien n'est en cours.
  useEffect(() => {
    if (pathname === premierChemin.current) return;
    premierChemin.current = pathname;
    if (attente.current && !occupe()) void recharger(attente.current);
  }, [pathname]);

  if (!enAttente) return null;

  return (
    <button
      type="button"
      onClick={() => void recharger(enAttente)}
      className="liquid-tabbar fixed left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 px-4 text-sm font-semibold text-foreground animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none"
      style={{ top: "calc(env(safe-area-inset-top) + 10px)", height: 40 }}
    >
      <RefreshCw className="size-4" aria-hidden />
      Mettre à jour
    </button>
  );
}
