// Où tourne la page : système, navigateur, app installée ou non.
//
// Sert au guide d'installation (components/pwa/guide-installation.tsx). Le
// lien de l'app circule surtout sur Snapchat : il s'ouvre alors dans le
// navigateur intégré de Snapchat, d'où on ne peut ni installer l'app ni
// garder sa session une fois sorti. Il faut d'abord passer dans Safari
// (iPhone) ou Chrome (Android), puis ajouter l'app à l'écran d'accueil.
//
// Tout se lit dans l'user-agent, sans rien envoyer nulle part. Fonctions
// pures : l'user-agent est passé en argument pour pouvoir les essayer.

export type Systeme = "ios" | "android" | "autre";

/** Apps dont le navigateur intégré bloque l'installation. */
export type AppHote =
  | "Snapchat"
  | "Instagram"
  | "Facebook"
  | "Messenger"
  | "TikTok"
  | "LinkedIn"
  | "X"
  | "Google"
  | "une app";

export type Environnement = {
  systeme: Systeme;
  /** L'app dans laquelle la page est ouverte, ou null dans un vrai navigateur. */
  appHote: AppHote | null;
  /** Sur iPhone : Safari, ou Chrome/Edge/Firefox (qui savent aussi installer depuis iOS 16.4). */
  navigateurIos: "safari" | "chrome" | "edge" | "firefox" | "autre" | null;
  /** Ouverte depuis l'icône de l'écran d'accueil. */
  installee: boolean;
};

export function lireSysteme(ua: string, pointsTactiles = 0): Systeme {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  // iPadOS se présente comme un Mac : seul l'écran tactile le trahit.
  if (/Macintosh/i.test(ua) && pointsTactiles > 1) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "autre";
}

export function lireAppHote(ua: string, systeme: Systeme): AppHote | null {
  if (/Snapchat/i.test(ua)) return "Snapchat";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/FBAN\/Messenger|MessengerForiOS|Orca-Android/i.test(ua)) return "Messenger";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return "Facebook";
  if (/musical_ly|BytedanceWebview|TikTok|trill_/i.test(ua)) return "TikTok";
  if (/LinkedInApp/i.test(ua)) return "LinkedIn";
  if (/Twitter|TwitterAndroid/i.test(ua)) return "X";
  if (/\bGSA\//.test(ua)) return "Google";
  // Les autres navigateurs intégrés : la WebView d'Android porte « wv »,
  // celle d'iOS n'a pas le jeton « Safari/ » que portent tous les vrais
  // navigateurs de l'iPhone (Chrome et Firefox compris).
  if (systeme === "android" && /;\s?wv\)/.test(ua)) return "une app";
  if (systeme === "ios" && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua)) return "une app";
  return null;
}

export function lireNavigateurIos(ua: string): Environnement["navigateurIos"] {
  if (/CriOS/i.test(ua)) return "chrome";
  if (/EdgiOS/i.test(ua)) return "edge";
  if (/FxiOS/i.test(ua)) return "firefox";
  if (/Safari\//i.test(ua)) return "safari";
  return "autre";
}

export function lireEnvironnement(): Environnement {
  const ua = navigator.userAgent;
  const systeme = lireSysteme(ua, navigator.maxTouchPoints ?? 0);
  const appHote = systeme === "autre" ? null : lireAppHote(ua, systeme);
  const installee =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return {
    systeme,
    appHote,
    navigateurIos: systeme === "ios" && !appHote ? lireNavigateurIos(ua) : null,
    installee,
  };
}

/**
 * Lien qui rouvre la page courante hors de l'app hôte.
 * - iPhone : le schéma `x-safari-https://` ouvre Safari (iOS 17 et plus) ;
 *   les apps qui l'ignorent laissent le bouton sans effet, d'où les étapes
 *   écrites à côté.
 * - Android : un lien `intent://` qui demande Chrome, et retombe sur la même
 *   adresse dans le navigateur par défaut si Chrome n'est pas là.
 */
export function lienSortie(url: URL, systeme: Systeme): string | null {
  if (systeme === "ios") return `x-safari-${url.href}`;
  if (systeme === "android") {
    const chemin = `${url.host}${url.pathname}${url.search}`;
    return (
      `intent://${chemin}#Intent;scheme=${url.protocol.replace(":", "")};` +
      `package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`
    );
  }
  return null;
}
