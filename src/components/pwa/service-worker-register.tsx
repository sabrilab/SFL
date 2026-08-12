"use client";

// Enregistrement du service worker, et surtout : la reprise après un
// déploiement.
//
// Sans ça, un onglet ouvert reste sur l'ancienne version de l'app pendant que
// le serveur en sert une nouvelle. Les fragments JavaScript demandés par la
// page en mémoire n'existent plus, et l'écran d'erreur tombe. On recharge donc
// une fois — et une seule — quand un nouveau service worker prend la main.

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Vrai seulement si la page était DÉJÀ pilotée par un service worker :
    // à la toute première visite, la prise de contrôle est normale et ne
    // doit surtout pas déclencher un rechargement.
    const deja = !!navigator.serviceWorker.controller;
    let recharge = false;

    const onChange = () => {
      if (!deja || recharge) return;
      recharge = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);

    // `updateViaCache: "none"` : le script du service worker est TOUJOURS
    // relu sur le réseau, jamais servi depuis le cache HTTP. C'est lui qui
    // porte le correctif quand un appareil est bloqué — il ne doit pas
    // pouvoir être lui-même périmé.
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Sans lui, l'app fonctionne — elle perd juste le hors-ligne.
    });

    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  return null;
}
