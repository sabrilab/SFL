"use client";

// Guide d'installation, sur téléphone seulement, tant que Bola n'est pas
// ouverte depuis l'écran d'accueil.
//
// Le lien circule surtout sur Snapchat. Ouvert là, il tombe dans le
// navigateur intégré de l'app : on ne peut pas y installer Bola, et une
// session ouverte là reste coincée dans Snapchat. Le guide a donc deux temps :
//   1. dans une app (Snapchat, Instagram…) : sortir vers Safari ou Chrome,
//      avec un bouton direct et, s'il ne fait rien, les gestes à faire ;
//   2. dans Safari ou Chrome : ajouter Bola à l'écran d'accueil, avec les
//      étapes de ce navigateur-là (ou le vrai bouton « Installer » quand
//      Chrome Android le propose).
// Une fois Bola ouverte depuis son icône (mode standalone), il ne s'affiche
// plus jamais. « C'est fait » le range pour de bon dans ce navigateur,
// « Plus tard » jusqu'à la prochaine ouverture du lien.
//
// Il passe devant tout, écran de chargement et connexion compris : mieux
// vaut sortir de Snapchat avant de créer son compte que de devoir se
// reconnecter après.

import Image from "next/image";
import { useEffect, useState } from "react";
import { Check, Copy, Ellipsis, EllipsisVertical, Share, SquarePlus } from "lucide-react";
import { useIsClient } from "@/hooks/use-is-client";
import { lienSortie, lireEnvironnement, type Environnement } from "@/lib/pwa/environnement";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const CLE_FAIT = "bola-guide-installation";
const CLE_PLUS_TARD = "bola-guide-plus-tard";

function lire(stockage: () => Storage, cle: string) {
  try {
    return stockage().getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(stockage: () => Storage, cle: string, valeur: string) {
  try {
    stockage().setItem(cle, valeur);
  } catch {
    // Navigation privée ou stockage bloqué : le guide se ferme quand même.
  }
}

type Etape = { icone?: React.ReactNode; texte: React.ReactNode };

export function GuideInstallation() {
  const isClient = useIsClient();
  const [invite, setInvite] = useState<BeforeInstallPromptEvent | null>(null);
  const [ferme, setFerme] = useState(false);
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    const garder = (e: Event) => {
      e.preventDefault();
      setInvite(e as BeforeInstallPromptEvent);
    };
    const installee = () => {
      ecrire(() => localStorage, CLE_FAIT, "1");
      setFerme(true);
    };
    window.addEventListener("beforeinstallprompt", garder);
    window.addEventListener("appinstalled", installee);
    return () => {
      window.removeEventListener("beforeinstallprompt", garder);
      window.removeEventListener("appinstalled", installee);
    };
  }, []);

  if (!isClient || ferme) return null;
  const env = lireEnvironnement();
  if (env.systeme === "autre" || env.installee) return null;
  if (lire(() => sessionStorage, CLE_PLUS_TARD)) return null;
  // « C'est fait » ne vaut que dans un vrai navigateur : depuis Snapchat,
  // on n'a rien pu installer.
  if (!env.appHote && lire(() => localStorage, CLE_FAIT)) return null;

  function plusTard() {
    ecrire(() => sessionStorage, CLE_PLUS_TARD, "1");
    setFerme(true);
  }

  function fait() {
    ecrire(() => localStorage, CLE_FAIT, "1");
    setFerme(true);
  }

  async function installer() {
    if (!invite) return;
    await invite.prompt();
    const { outcome } = await invite.userChoice;
    setInvite(null);
    if (outcome === "accepted") fait();
  }

  async function copier() {
    const lien = window.location.href;
    try {
      await navigator.clipboard.writeText(lien);
    } catch {
      // Certains navigateurs intégrés refusent l'API presse-papiers.
      const champ = document.createElement("textarea");
      champ.value = lien;
      champ.setAttribute("readonly", "");
      champ.style.position = "fixed";
      champ.style.opacity = "0";
      document.body.appendChild(champ);
      champ.select();
      document.execCommand("copy");
      champ.remove();
    }
    setCopie(true);
  }

  const ios = env.systeme === "ios";
  const navigateur = ios ? "Safari" : "Chrome";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guide-installation-titre"
      className="fixed inset-0 z-[250] overflow-y-auto bg-background text-foreground"
      style={{
        paddingTop: "max(env(safe-area-inset-top), 20px)",
        paddingBottom: "max(env(safe-area-inset-bottom), 20px)",
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-sm flex-col px-6 py-6">
        <Image src="/bola/logo-blanc.svg" alt="Bola" width={101} height={24} className="self-start" priority />

        {env.appHote ? (
          <SortieApp
            env={env}
            navigateur={navigateur}
            copie={copie}
            onCopier={copier}
          />
        ) : (
          <Installation env={env} peutInstaller={invite !== null} onInstaller={installer} />
        )}

        <div className="mt-auto flex flex-col items-center gap-1 pt-8">
          {!env.appHote && (
            <button
              type="button"
              onClick={fait}
              className="bouton-discret w-full py-3 text-[14px] font-semibold"
            >
              C&apos;est fait
            </button>
          )}
          <button
            type="button"
            onClick={plusTard}
            className="py-2 text-[12.5px] font-medium text-foreground/35 active:opacity-60"
          >
            {env.appHote ? `Rester dans ${env.appHote === "une app" ? "cette app" : env.appHote}` : "Plus tard"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SortieApp({
  env,
  navigateur,
  copie,
  onCopier,
}: {
  env: Environnement;
  navigateur: string;
  copie: boolean;
  onCopier: () => void;
}) {
  const ios = env.systeme === "ios";
  const lien = lienSortie(new URL(window.location.href), env.systeme);
  const dans = env.appHote === "une app" ? "cette app" : env.appHote;

  const etapes: Etape[] = ios
    ? [
        {
          icone: <Ellipsis className="size-4" />,
          texte: (
            <>
              Appuie sur <b>⋯</b> ou sur <Share className="inline size-3.5 align-[-2px]" /> dans {dans}
            </>
          ),
        },
        { texte: <>Choisis « Ouvrir dans Safari »</> },
      ]
    : [
        {
          icone: <EllipsisVertical className="size-4" />,
          texte: (
            <>
              Appuie sur <b>⋮</b> en haut à droite
            </>
          ),
        },
        { texte: <>Choisis « Ouvrir dans Chrome » ou « Ouvrir dans le navigateur »</> },
      ];

  return (
    <>
      <p className="mono-label mt-10 text-foreground/40">Ouvert dans {dans}</p>
      <h1 id="guide-installation-titre" className="mt-2 text-[32px] leading-[1.05] font-extrabold tracking-tight">
        Ouvre Bola
        <br />
        dans {navigateur}.
      </h1>

      {lien && (
        <a
          href={lien}
          className="bouton-principal mt-8 flex items-center justify-center py-4 text-[15px] font-bold"
        >
          Ouvrir dans {navigateur}
        </a>
      )}

      <p className="mono-label mt-8 text-foreground/30">Si rien ne s&apos;ouvre</p>
      <Etapes etapes={etapes} />

      <button
        type="button"
        onClick={onCopier}
        className="bouton-secondaire mt-4 flex items-center justify-center gap-2 py-3.5 text-[14px] font-semibold"
      >
        {copie ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copie ? `Lien copié, colle-le dans ${navigateur}` : "Copier le lien"}
      </button>
    </>
  );
}

function Installation({
  env,
  peutInstaller,
  onInstaller,
}: {
  env: Environnement;
  peutInstaller: boolean;
  onInstaller: () => void;
}) {
  const ajouter = (
    <>
      « <b>Sur l&apos;écran d&apos;accueil</b> »
    </>
  );

  let etapes: Etape[];
  if (env.systeme === "android") {
    etapes = [
      {
        icone: <EllipsisVertical className="size-4" />,
        texte: (
          <>
            Appuie sur <b>⋮</b> en haut à droite
          </>
        ),
      },
      {
        icone: <SquarePlus className="size-4" />,
        texte: (
          <>
            Choisis « <b>Installer l&apos;application</b> » ou « <b>Ajouter à l&apos;écran d&apos;accueil</b> »
          </>
        ),
      },
      { icone: <Check className="size-4" />, texte: <>Confirme avec « Installer »</> },
    ];
  } else if (env.navigateurIos === "safari") {
    etapes = [
      {
        icone: <Share className="size-4" />,
        texte: (
          <>
            Appuie sur <b>Partager</b>, en bas (ou sur <b>⋯</b> puis Partager)
          </>
        ),
      },
      { icone: <SquarePlus className="size-4" />, texte: <>Fais défiler, choisis {ajouter}</> },
      { icone: <Check className="size-4" />, texte: <>Appuie sur « Ajouter »</> },
    ];
  } else if (env.navigateurIos === "chrome" || env.navigateurIos === "edge") {
    etapes = [
      {
        icone: <Share className="size-4" />,
        texte: (
          <>
            Appuie sur <b>Partager</b>, dans la barre d&apos;adresse
          </>
        ),
      },
      {
        icone: <SquarePlus className="size-4" />,
        texte: (
          <>
            Choisis « <b>Ajouter à l&apos;écran d&apos;accueil</b> »
          </>
        ),
      },
      { icone: <Check className="size-4" />, texte: <>Appuie sur « Ajouter »</> },
    ];
  } else {
    // Firefox et les autres navigateurs de l'iPhone : passer par Safari.
    etapes = [
      { icone: <Copy className="size-4" />, texte: <>Copie le lien de cette page</> },
      { icone: <Share className="size-4" />, texte: <>Ouvre-le dans <b>Safari</b>, puis Partager</> },
      { icone: <SquarePlus className="size-4" />, texte: <>Choisis {ajouter}</> },
    ];
  }

  return (
    <>
      <p className="mono-label mt-10 text-foreground/40">Installer Bola</p>
      <h1 id="guide-installation-titre" className="mt-2 text-[32px] leading-[1.05] font-extrabold tracking-tight">
        Bola sur ton
        <br />
        écran d&apos;accueil.
      </h1>

      {peutInstaller && (
        <button
          type="button"
          onClick={onInstaller}
          className="bouton-principal mt-8 flex items-center justify-center py-4 text-[15px] font-bold"
        >
          Installer
        </button>
      )}

      {peutInstaller && <p className="mono-label mt-8 text-foreground/30">Ou à la main</p>}
      <Etapes etapes={etapes} large={!peutInstaller} />
    </>
  );
}

function Etapes({ etapes, large = false }: { etapes: Etape[]; large?: boolean }) {
  return (
    <ol className={large ? "mt-8 flex flex-col gap-2.5" : "mt-3 flex flex-col gap-2.5"}>
      {etapes.map((etape, i) => (
        <li key={i} className="glass-soft flex items-center gap-3.5 rounded-[18px] px-4 py-3.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-[12px] font-bold text-background">
            {i + 1}
          </span>
          <span className="flex-1 text-[14px] leading-snug text-foreground/85">{etape.texte}</span>
          {etape.icone && <span className="shrink-0 text-foreground/50">{etape.icone}</span>}
        </li>
      ))}
    </ol>
  );
}
