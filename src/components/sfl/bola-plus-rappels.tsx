"use client";

// Bola Plus, pour que personne ne passe à côté (Sabri, 16/11/2026 : « propose
// comment rendre ça bien visible sur l'app pour que chaque user ne passe pas à
// côté »). Trois rappels, tous avec le compte à rebours du prix premiers
// joueurs (lib/sfl/compte-a-rebours.ts), tous réservés pour l'instant aux
// comptes qui voient Bola Plus (voitBolaPlus : Ilyes et Sabri) :
//
//   1. CompteARebours : sur la page (l'ouverture et « Ton prix »), en grand,
//      et en une ligne dans la tuile de Ma carte ;
//   2. BandeauBolaPlus : une pilule violette posée au-dessus de la barre
//      d'onglets, sur toutes les pages (sauf Bola Plus, l'admin et les pages
//      sans barre). La croix la range jusqu'au lendemain ;
//   3. OuvertureBolaPlus : à la première ouverture de l'app du jour, un écran
//      Bola Plus (le compte à rebours, le prix, « Voir l'offre », « Plus
//      tard »), une fois par jour et par compte. Il passe après l'accueil et
//      les annonces (layout.tsx, ApresAccueil).
//
// Le temps écoulé, plus rien ne s'affiche. Aucune notification, aucun appel
// réseau, aucun paiement : ce qui est rangé (la croix, « Plus tard ») reste
// sur le téléphone.

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { useCompteARebours } from "@/hooks/use-compte-a-rebours";
import { casesDe, resteCourt, type Reste } from "@/lib/sfl/compte-a-rebours";
import { PALETTE, PRIX_FORMULE, VARIABLES_PLUS, voitBolaPlus } from "@/lib/sfl/bola-plus";
import { tic } from "@/lib/sfl/haptique";
import { ANTON } from "@/components/sfl/actus/ecran";
import "./bola-plus-rappels.css";

const COULEURS = { ...VARIABLES_PLUS, "--bp-prix": PALETTE.prix, "--bp-nuit": PALETTE.nuit } as CSSProperties;

/** Le jour du téléphone, « 2026-11-16 » : ce qui est rangé l'est jusqu'au lendemain. */
function aujourdhui(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lu(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}
const EVENEMENT = "bola-plus-rappels";
function ecrit(cle: string, valeur: string) {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    /* stockage interdit : le rappel revient à la prochaine ouverture */
  }
  window.dispatchEvent(new Event(EVENEMENT));
}
function abonner(onChange: () => void) {
  window.addEventListener(EVENEMENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENEMENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}
/** Rangé aujourd'hui sur ce téléphone ? Avant l'hydratation : oui (rien ne s'affiche avant de savoir). */
function useRangeAujourdhui(cle: string): boolean {
  return useSyncExternalStore(
    abonner,
    () => lu(cle) === aujourdhui(),
    () => true
  );
}

/** Le compte à rebours : en grand (quatre cases) ou en une ligne. */
export function CompteARebours({ reste, variante, className }: { reste: Reste; variante: "grand" | "ligne"; className?: string }) {
  if (reste.fini) return null;
  if (variante === "ligne") {
    return (
      <span className={`bpr-ligne tabular-nums ${className ?? ""}`} aria-label={`Prix premiers joueurs : encore ${resteCourt(reste)}`}>
        <span aria-hidden className="bpr-point" />
        {resteCourt(reste)}
      </span>
    );
  }
  return (
    <div className={`bpr-grand ${className ?? ""}`} role="timer" aria-label={`Prix premiers joueurs : encore ${resteCourt(reste)}`}>
      {casesDe(reste).map((c) => (
        <span key={c.unite} className="bpr-case">
          <span className="bpr-chiffre tabular-nums" style={{ fontFamily: ANTON }}>
            {c.valeur}
          </span>
          <span className="bpr-unite">{c.unite}</span>
        </span>
      ))}
    </div>
  );
}

/** Le compte à rebours de la page Bola Plus, branché sur l'horloge. */
export function CompteAReboursBolaPlus({ variante, className }: { variante: "grand" | "ligne"; className?: string }) {
  const reste = useCompteARebours();
  if (!reste) return null;
  return <CompteARebours reste={reste} variante={variante} className={className} />;
}

/** Les pages où ni le bandeau ni l'écran d'ouverture ne viennent. */
function horsRappel(pathname: string): boolean {
  return pathname.startsWith("/profil/bola-plus") || pathname.startsWith("/admin") || pathname.startsWith("/connexion") || pathname.startsWith("/inscription");
}

/** 2 · Le bandeau au-dessus de la barre d'onglets. */
export function BandeauBolaPlus() {
  const session = useSession();
  const nom = session?.name ?? null;
  const pathname = usePathname();
  const reste = useCompteARebours();
  const cle = `bola-plus-bandeau-${nom}`;
  const range = useRangeAujourdhui(cle);
  if (!nom || !voitBolaPlus(nom) || !reste || reste.fini || horsRappel(pathname) || range) return null;
  return (
    <div className="bpr-bandeau" style={COULEURS}>
      <Link href="/profil/bola-plus" className="bpr-bandeau__lien" onClick={() => tic()}>
        <span className="bpr-bandeau__nom">Bola Plus</span>
        <span className="bpr-bandeau__offre">Prix premiers joueurs</span>
        <CompteARebours reste={reste} variante="ligne" className="bpr-bandeau__temps" />
      </Link>
      <button
        type="button"
        aria-label="Ranger jusqu'à demain"
        className="bpr-bandeau__fermer"
        onClick={() => ecrit(cle, aujourdhui())}
      >
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** 3 · L'écran Bola Plus, à la première ouverture du jour. */
export function OuvertureBolaPlus() {
  const session = useSession();
  const nom = session?.name ?? null;
  const pathname = usePathname();
  const router = useRouter();
  const reste = useCompteARebours();
  const cle = `bola-plus-ouverture-${nom}`;
  const vu = useRangeAujourdhui(cle);
  const ouvert = !!nom && voitBolaPlus(nom) && !!reste && !reste.fini && !horsRappel(pathname) && !vu;

  useEffect(() => {
    if (!ouvert) return;
    const touche = (e: KeyboardEvent) => {
      if (e.key === "Escape") fermer();
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  });

  function fermer() {
    ecrit(cle, aujourdhui());
  }

  if (!ouvert || !reste || reste.fini) return null;
  const p = PRIX_FORMULE.mensuel;
  return (
    <div className="bpr-ouverture dark" style={COULEURS} role="dialog" aria-modal="true" aria-labelledby="bpr-ouverture-titre">
      <div className="bpr-ouverture__fond" aria-hidden onClick={fermer} />
      <div className="bpr-ouverture__fiche">
        <span className="bpr-ouverture__etiquette">Bola Plus + SFL</span>
        <h2 id="bpr-ouverture-titre" className="bpr-ouverture__titre">
          Prix premiers joueurs
        </h2>
        <p className="bpr-ouverture__prix">
          <span className="tabular-nums" style={{ fontFamily: ANTON }}>
            {p.euros}&nbsp;€
          </span>
          <span className="bpr-ouverture__par">/ {p.par}</span>
          {p.barre && <s className="bpr-ouverture__barre tabular-nums">{p.barre}&nbsp;€</s>}
        </p>
        <CompteARebours reste={reste} variante="grand" className="bpr-ouverture__temps" />
        <button
          type="button"
          className="bpr-ouverture__voir"
          onClick={() => {
            tic();
            fermer();
            router.push("/profil/bola-plus");
          }}
        >
          Voir l&apos;offre
        </button>
        <button type="button" className="bpr-ouverture__tard" onClick={fermer}>
          Plus tard
        </button>
      </div>
    </div>
  );
}
