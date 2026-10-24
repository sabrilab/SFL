"use client";

// L'accueil de l'app : à la première ouverture, tout ce que l'app demande au
// joueur, avant de lui montrer l'app, puis la visite de l'app.
//
// Sabri, 24/10/2026 : « que tu te rappelles toutes les choses qu'on demande
// à l'utilisateur : le fait qu'il change son mot de passe, le fait qu'il
// mette son nom, son mail, etc. Il faudrait que ça lui arrive au début, en
// onboarding […] comme sa localisation, ses mensurations, etc. Mais ça ne
// doit pas être barbant. Ça doit être très, très fluide et très, très
// satisfaisant à faire, y compris la carte […] Je veux un vrai onboarding
// avec même une explication de l'app dedans, qui peut être skip, mais il y a
// une partie qui ne peut pas être skip. »
//
// Le parcours, dans l'ordre (ORDRE), et seulement ce qui manque :
//   · la bienvenue : sa carte, de dos, qui se prépare ;
//   · la partie qu'on ne passe pas, des segments en haut comme les stories :
//     son mot de passe à lui (d'origine ou provisoire, voir AuthGate),
//     l'accord à la politique de confidentialité, « C'est bien toi ? » (nom,
//     pseudo, email), homme ou femme, sa date de naissance aux roues, son
//     gabarit aux règles, son pied fort, son poste sur le terrain, sa ville
//     sur la Map (ou le mode fantôme) et sa carte officielle au studio ;
//   · la révélation de sa carte, qu'il retourne d'un toucher ;
//   · ce qu'on remet à plus tard : les notifications, les partenaires ;
//   · la visite de l'app, qu'on passe (visite.tsx).
// Chaque écran écrit sa part en passant au suivant (etapes-*.tsx) ; une
// écriture qui échoue ne bloque personne, et l'ouverture suivante la
// redemande : c'est la relance, la partie obligatoire seule, sans bienvenue
// ni visite. La fin du premier parcours est notée sur le compte
// (lib/sfl/accueil, accueil_le) : la visite ne revient pas.
//
// Ce qu'on lit d'abord (la fiche, la ville, la photo, l'identité, l'accord,
// les notifications, les suivis) a ATTENTE_MS au plus : au-delà, ou sans
// réseau, on ne demande rien sur un doute. Le mot de passe, lui, ne se
// discute pas : dès que la session le demande, l'accueil s'ouvre dessus.
//
// L'app attend la fin : la Map garde son entrée (lib/sfl/accueil,
// quandAccueilLibre), les cérémonies et les invitations de l'ouverture
// attendent derrière ApresAccueil, et le voile de confidentialité ne se
// montre que hors de l'accueil (l'accord y a son écran).
//
// En aperçu (`?accueil`, ou `?accueil=ville` pour partir d'un écran), tout
// le parcours, sans rien lire ni écrire : jamais en production.

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Loader2 } from "lucide-react";
import { SPLASH_FINI } from "@/components/sfl/app-splash";
import { ConsentementObligatoire } from "@/components/sfl/confidentialite/consentement";
import { aSuivre, enPause } from "@/components/sfl/invitation-carte";
import { useMyPlayer } from "@/components/sfl/player-provider";
import { useSeason } from "@/components/sfl/season-provider";
import { useAccord } from "@/hooks/use-accord";
import { useEtatAccueil } from "@/hooks/use-accueil";
import { useIdentites } from "@/hooks/use-identites";
import { useSession } from "@/hooks/use-session";
import { useVueVisible } from "@/hooks/use-vue-visible";
import { accueilDejaFait, accueilFaitIci, noterAccueilFait, poserEtatAccueil } from "@/lib/sfl/accueil";
import { idDe } from "@/lib/sfl/comptes";
import { AGE_ACCORD_PARENT } from "@/lib/sfl/confidentialite";
import { accordDonne, rafraichirAccord } from "@/lib/sfl/consentement";
import type { Player } from "@/lib/sfl/engine";
import { lireMaFiche, type FicheJoueur } from "@/lib/sfl/fiche";
import { identiteConfirmee, rafraichirIdentites } from "@/lib/sfl/identites";
import { age, BORNES, POSTES, type Poste } from "@/lib/sfl/inscription";
import { etatNotifications } from "@/lib/sfl/notifications";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";
import type { Saison } from "@/lib/sfl/saisie/types";
import { enDemo as enDemoSuivis, liensDeLaBase, liensDemo, rafraichirSuivis, suivisLus } from "@/lib/sfl/suivis";
import { maVille, maVilleAProposer, type VilleJoueur } from "@/lib/sfl/villes";
import { ContexteAccueil, Entete } from "./cadre";
import { EtapeCarte, EtapeRevelation } from "./etape-carte";
import { EtapeVille } from "./etape-ville";
import { EtapeAccord, EtapeBonjour, EtapeIdentite, EtapeMotDePasse } from "./etapes-compte";
import { EtapeGabarit, EtapeNaissance, EtapePied, EtapePoste, EtapeSexe, type Brouillon } from "./etapes-fiche";
import { EtapeNotifs, EtapeSuivre } from "./etapes-suite";
import { Visite } from "./visite";
import "./accueil.css";

type Etape =
  | "bonjour"
  | "motdepasse"
  | "accord"
  | "identite"
  | "sexe"
  | "naissance"
  | "gabarit"
  | "pied"
  | "poste"
  | "ville"
  | "carte"
  | "revelation"
  | "notifs"
  | "suivre"
  | "visite";

const ORDRE: Etape[] = [
  "bonjour",
  "motdepasse",
  "accord",
  "identite",
  "sexe",
  "naissance",
  "gabarit",
  "pied",
  "poste",
  "ville",
  "carte",
  "revelation",
  "notifs",
  "suivre",
  "visite",
];

/** La partie qu'on ne passe pas : les segments en haut. */
const OBLIGATOIRES: Etape[] = ["motdepasse", "accord", "identite", "sexe", "naissance", "gabarit", "pied", "poste", "ville", "carte"];

/** Les écrans où l'on peut revenir : rien n'y part pour de bon. */
const ON_Y_REVIENT: Etape[] = ["identite", "sexe", "naissance", "gabarit", "pied", "poste", "ville"];

/** Pas d'accueil sur les pages qui ont leur propre parcours, ou pas de compte (AuthGate, PUBLIC_ROUTES). */
const SANS_ACCUEIL = ["/confidentialite", "/inscription", "/bienvenue", "/equipe/", "/p/"];

/** Au plus, le temps d'une lecture ; au-delà, on fait sans. */
const ATTENTE_MS = 4500;

interface Plan {
  etapes: Etape[];
  /** Le premier accueil (bienvenue, révélation, visite), ou la relance de ce qui manque. */
  premiere: boolean;
  /** Moins de AGE_ACCORD_PARENT ans d'après sa fiche : l'accord demande un parent. */
  mineur: boolean;
  /** Les partenaires à suivre. */
  proposes: string[];
}

const memeNom = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Une lecture qui échoue ou traîne rend son repli. */
function aTemps<T>(p: Promise<T>, repli: T): Promise<T> {
  return Promise.race([p.catch(() => repli), new Promise<T>((ok) => window.setTimeout(() => ok(repli), ATTENTE_MS))]);
}

/** En aperçu, `?accueil` (tout) ou `?accueil=ville` (à partir d'un écran). Jamais en production. */
function demoDemandee(): Etape | "tout" | null {
  if (process.env.NEXT_PUBLIC_BOLA_ENV === "production" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("accueil");
  if (v === null) return null;
  return (ORDRE as string[]).includes(v) ? (v as Etape) : "tout";
}

function brouillonDe(fiche: FicheJoueur | null, ville: VilleJoueur | null, poste: string): Brouillon {
  const [a, m, j] = (fiche?.naissance ?? "").split("-").map(Number);
  return {
    jour: j || 1,
    mois: m || 1,
    annee: a || new Date().getFullYear() - 25,
    naissanceVue: !!fiche?.naissance,
    sexe: fiche?.sexe ?? null,
    taille: fiche?.taille_cm ?? BORNES.taille.defaut,
    poids: Math.round(fiche?.poids_kg ?? BORNES.poids.defaut),
    pointure: fiche?.pointure ?? BORNES.pointure.defaut,
    maillot: fiche?.maillot ?? null,
    pied: fiche?.pied ?? null,
    // Le poste de l'effectif, s'il en est un : il n'a qu'à confirmer.
    poste: fiche?.poste ?? (POSTES.some((p) => p.id === poste) ? (poste as Poste) : null),
    ville,
  };
}

/** Les partenaires à proposer : seulement à qui ne suit encore personne, sur la liste relue. */
function partenairesAProposer(nom: string, saison: Saison, players: Player[]): string[] {
  const demo = enDemoSuivis();
  if (!demo && !suivisLus()) return [];
  const suitDeja = (demo ? liensDemo([], nom) : liensDeLaBase()).some(([a]) => a === nom);
  if (suitDeja) return [];
  const noms = new Set(players.map((p) => p.name));
  return aSuivre(saison, players, nom, (n) => (demo ? noms.has(n) : !!idDe(n)));
}

/**
 * Ce qui manque au joueur connecté, lu dans la base. `ici` : cet appareil
 * sait déjà le premier accueil fini (la relance seule).
 */
async function lirePlan(
  nom: string,
  nomSession: string,
  poste: string,
  motDePasse: boolean,
  ici: boolean,
  ligue: () => { saison: Saison; players: Player[] }
): Promise<{ plan: Plan; brouillon: Brouillon }> {
  const [fait, fiche, ville, notifs] = await Promise.all([
    ici ? Promise.resolve(true) : aTemps(accueilDejaFait(nom), null),
    aTemps(lireMaFiche(), null),
    aTemps(maVilleAProposer(nom), null),
    ici ? Promise.resolve("indisponible" as const) : aTemps(etatNotifications(), "indisponible" as const),
    aTemps(rafraichirPhotos(), undefined),
    aTemps(rafraichirIdentites(), undefined),
    aTemps(rafraichirAccord(nomSession, true), undefined),
    ici ? Promise.resolve() : aTemps(rafraichirSuivis(), undefined),
  ]);
  // On ne sait pas (pas de réseau) : pas de visite sur un doute.
  const premiere = fait === false;
  const etapes: Etape[] = [];
  if (motDePasse) etapes.push("motdepasse");
  // À la relance, l'accord d'une nouvelle version est au voile de l'ouverture (ConsentementObligatoire).
  if (premiere && accordDonne(nomSession) === false) etapes.push("accord");
  if (identiteConfirmee(nom) === false) etapes.push("identite");
  if (fiche) {
    // undefined : la base ne le garde pas encore, on ne le demande pas pour rien.
    if (fiche.sexe === null) etapes.push("sexe");
    if (!fiche.naissance) etapes.push("naissance");
    if (fiche.taille_cm == null || fiche.poids_kg == null || fiche.pointure == null || !fiche.maillot) etapes.push("gabarit");
    if (!fiche.pied) etapes.push("pied");
    if (!fiche.poste) etapes.push("poste");
  }
  if (ville?.proposer) etapes.push("ville");
  let proposes: string[] = [];
  if (premiere) {
    // La carte : au premier accueil ; ensuite, l'invitation de l'ouverture la repropose.
    if (photoPerso(nom) === null && !enPause("carte", nom)) etapes.push("carte");
    if (etapes.length > 0) etapes.unshift("bonjour");
    if (etapes.length > 0) etapes.push("revelation");
    if (notifs === "inactives" && !enPause("notifs", nom)) etapes.push("notifs");
    const { saison, players } = ligue();
    proposes = enPause("suivre", nom) ? [] : partenairesAProposer(nom, saison, players);
    if (proposes.length > 0) etapes.push("suivre");
    etapes.push("visite");
  }
  const ans = fiche?.naissance ? age(fiche.naissance) : null;
  return {
    plan: { etapes, premiere, mineur: ans !== null && ans < AGE_ACCORD_PARENT, proposes },
    brouillon: brouillonDe(fiche, ville?.ville ?? null, poste),
  };
}

function abonnerSplash(f: () => void) {
  window.addEventListener(SPLASH_FINI, f);
  return () => window.removeEventListener(SPLASH_FINI, f);
}
const splashFini = () => document.documentElement.dataset.splash === "fini";

const glisse = {
  entre: (d: number) => ({ x: d * 56, opacity: 0 }),
  la: { x: 0, opacity: 1 },
  sort: (d: number) => ({ x: -d * 56, opacity: 0 }),
};
const fondu = { entre: { opacity: 0 }, la: { opacity: 1 }, sort: { opacity: 0 } };

export function Accueil() {
  const session = useSession();
  const pathname = usePathname();
  const { me, player } = useMyPlayer();
  const { saison, players } = useSeason();
  const identites = useIdentites();
  const etat = useEtatAccueil();
  const reduit = useReducedMotion();
  const vue = useVueVisible();
  const splash = useSyncExternalStore(abonnerSplash, splashFini, () => false);
  const [demo] = useState(demoDemandee);

  const nomSession = session?.name ?? null;
  const serveur = !!session?.server;
  const libre = SANS_ACCUEIL.some((r) => pathname?.startsWith(r));
  // Le joueur connecté, s'il est bien celui qu'on voit (pas un profil que l'admin emprunte).
  const nom = libre ? null : demo ? player.name : serveur && nomSession && memeNom(nomSession, me) ? player.name : null;
  const motDePasseDu = !libre && serveur && !!session?.motDePasseAChanger;
  const { donne } = useAccord(nomSession);

  const [lu, setLu] = useState<{ nom: string; plan: Plan } | null>(null);
  const [i, setI] = useState(0);
  const [dir, setDir] = useState(1);
  // L'aperçu part de la ville de démonstration et du poste de l'effectif.
  const [b, setB] = useState<Brouillon>(() => {
    const v = demo ? maVille(player.name) : null;
    return brouillonDe(null, v ? { ville: v.ville, lat: v.lat, lng: v.lng } : null, demo ? player.poste : "");
  });
  const ligue = useRef({ saison, players });
  useEffect(() => {
    ligue.current = { saison, players };
  });

  // L'aperçu : tout le parcours, sur la saison du moment, sans rien lire.
  const planDemo = useMemo<Plan | null>(() => {
    if (!demo) return null;
    const depuis = demo === "tout" ? 0 : ORDRE.indexOf(demo);
    return { etapes: ORDRE.slice(depuis), premiere: true, mineur: false, proposes: aSuivre(saison, players, player.name, () => true) };
  }, [demo, saison, players, player.name]);
  const plan = planDemo ?? (lu && lu.nom === nom ? lu.plan : null);

  // L'état se pose avant les effets de la page : la Map ne part pas pour rien.
  useLayoutEffect(() => {
    if (demo) {
      poserEtatAccueil("ouvert");
      return;
    }
    if (!nom || !nomSession) {
      poserEtatAccueil("fini");
      return;
    }
    const ici = accueilFaitIci(nom);
    // Cet appareil le sait fini : l'app part tout de suite, la relance se lit derrière.
    poserEtatAccueil(ici ? "fini" : "verif");
    let annule = false;
    void lirePlan(nom, nomSession, player.poste, motDePasseDu, ici, () => ligue.current).then(({ plan: p, brouillon }) => {
      if (annule) return;
      setB(brouillon);
      setLu({ nom, plan: p });
      setI(0);
      poserEtatAccueil(p.etapes.length > 0 ? "ouvert" : "fini");
    });
    return () => {
      annule = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- une seule décision par joueur
  }, [nom, demo]);

  /** L'écran sert-il encore ? Le mot de passe choisi, l'accord donné ailleurs : on passe. */
  function utile(e: Etape): boolean {
    if (demo) return true;
    if (e === "motdepasse") return motDePasseDu;
    if (e === "accord") return donne !== true;
    return true;
  }

  function terminer() {
    if (!demo && nom && plan?.premiere) void noterAccueilFait(nom);
    navigator.vibrate?.([10, 40, 18]);
    poserEtatAccueil("fini");
  }

  function avancer() {
    if (!plan) return;
    let n = i + 1;
    while (n < plan.etapes.length && !utile(plan.etapes[n])) n++;
    if (n >= plan.etapes.length) {
      terminer();
      return;
    }
    setDir(1);
    setI(n);
  }

  function reculer() {
    if (i === 0) return;
    setDir(-1);
    setI(i - 1);
  }

  const maj = (p: Partial<Brouillon>) => setB((x) => ({ ...x, ...p }));

  const ouvert = etat === "ouvert" && !!plan;
  const etapePlan = ouvert ? (plan.etapes[i] ?? null) : null;
  // Le mot de passe passe avant tout, même hors du parcours (une session qui
  // le demande en route, la relance, un profil emprunté) ; pendant la
  // lecture du premier accueil, on attend le parcours, qui l'a à sa place.
  const force = motDePasseDu && etat !== "verif" && !(plan && plan.etapes.slice(i).includes("motdepasse"));
  const etape: Etape | null = force ? "motdepasse" : etapePlan;
  const visible = motDePasseDu || etat === "verif" || ouvert;

  // Sous l'accueil, la page ne se touche pas (ni au doigt, ni au clavier).
  useEffect(() => {
    const page = document.getElementById("app-scroll");
    if (!page) return;
    page.toggleAttribute("inert", visible);
    return () => page.removeAttribute("inert");
  }, [visible]);

  const hauteurPleine = typeof window === "undefined" ? 0 : window.innerHeight;
  const clavier = vue.tactile && vue.hauteur > 0 && vue.hauteur < hauteurPleine * 0.8;
  // Un écran bas (iPhone SE, mini) : la hauteur de la fenêtre, que le clavier ne change pas.
  const court = hauteurPleine > 0 && hauteurPleine < 740;
  const contexte = useMemo(() => ({ demo: !!demo, clavier, court }), [demo, clavier, court]);
  const prenom = identites.nom(player.name).split(" ")[0] ?? "";

  // Le mot de passe choisi : le parcours reprend là où il était.
  function finMotDePasse() {
    if (plan?.etapes[i] === "motdepasse") avancer();
  }

  function ecran(e: Etape): ReactNode {
    switch (e) {
      case "bonjour":
        return <EtapeBonjour player={player} prenom={prenom} onSuite={avancer} />;
      case "motdepasse":
        return <EtapeMotDePasse session={session} onFini={finMotDePasse} />;
      case "accord":
        return <EtapeAccord nom={nomSession ?? player.name} mineur={!!plan?.mineur} onFini={avancer} />;
      case "identite":
        return <EtapeIdentite onFini={avancer} />;
      case "sexe":
        return <EtapeSexe b={b} maj={maj} onFini={avancer} />;
      case "naissance":
        return <EtapeNaissance nom={nomSession ?? player.name} b={b} maj={maj} onFini={avancer} />;
      case "gabarit":
        return <EtapeGabarit b={b} maj={maj} onFini={avancer} />;
      case "pied":
        return <EtapePied b={b} maj={maj} onFini={avancer} />;
      case "poste":
        return <EtapePoste b={b} maj={maj} onFini={avancer} />;
      case "ville":
        return <EtapeVille nom={player.name} player={player} b={b} maj={maj} onFini={avancer} />;
      case "carte":
        return <EtapeCarte player={player} onFini={avancer} />;
      case "revelation":
        return <EtapeRevelation player={player} prenom={prenom} onFini={avancer} />;
      case "notifs":
        return <EtapeNotifs nom={player.name} onFini={avancer} />;
      case "suivre":
        return <EtapeSuivre nom={player.name} proposes={plan?.proposes ?? []} onFini={avancer} />;
      case "visite":
        return <Visite player={player} onFini={avancer} />;
    }
  }

  // La barre du haut : les segments de la partie obligatoire, le retour.
  const obligatoires = plan && !force ? plan.etapes.filter((e) => OBLIGATOIRES.includes(e)) : [];
  const segments =
    etape && obligatoires.length > 1 && (etape === "bonjour" || OBLIGATOIRES.includes(etape))
      ? { i: obligatoires.indexOf(etape), n: obligatoires.length }
      : null;
  const precedente = plan && i > 0 ? plan.etapes[i - 1] : null;
  const retour =
    !force && etape && OBLIGATOIRES.includes(etape) && precedente && ON_Y_REVIENT.includes(precedente) ? reculer : undefined;

  return (
    <>
      {/* Hors de l'accueil, le voile de confidentialité garde la porte (l'accord a son écran dedans). */}
      {!visible && <ConsentementObligatoire />}
      <AnimatePresence>
        {visible && (
          <motion.div
            key="accueil"
            role="dialog"
            aria-modal="true"
            aria-label="Bienvenue dans Bola"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.3 } }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
            className="dark fixed inset-0 z-[45] flex flex-col overflow-hidden bg-background text-foreground"
            style={{
              paddingTop: "env(safe-area-inset-top)",
              // Clavier ouvert : seulement ce qu'il laisse voir.
              ...(clavier ? { top: vue.haut, bottom: "auto", height: vue.hauteur } : {}),
            }}
          >
            <div className="orbs" aria-hidden>
              <i />
              <i />
              <i />
            </div>
            <ContexteAccueil.Provider value={contexte}>
              {etape && splash && etape !== "visite" && <Entete onRetour={retour} segments={segments} />}
              <div className="relative min-h-0 flex-1">
                {/* Le temps de lire ce qui manque, après l'écran de chargement. */}
                {!etape && splash && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.9 }}
                    className="absolute inset-0 grid place-items-center"
                  >
                    <Loader2 className="size-5 animate-spin text-white/30" />
                  </motion.div>
                )}
                <AnimatePresence initial={false} custom={dir}>
                  {etape && splash && (
                    <motion.div
                      key={etape}
                      custom={dir}
                      variants={reduit ? fondu : glisse}
                      initial="entre"
                      animate="la"
                      exit="sort"
                      transition={{ type: "spring", stiffness: 320, damping: 34 }}
                      className="absolute inset-0"
                    >
                      {ecran(etape)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </ContexteAccueil.Provider>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Ce qui s'ouvre de soi-même à l'ouverture (cérémonies, badges,
 * invitations) : seulement l'accueil fini et l'accord donné, pour que rien ne
 * joue dessous.
 */
export function ApresAccueil({ children }: { children: ReactNode }) {
  const session = useSession();
  const etat = useEtatAccueil();
  const { donne } = useAccord(session?.name);
  if (etat !== "fini") return null;
  if (session && donne !== true) return null;
  return <>{children}</>;
}
