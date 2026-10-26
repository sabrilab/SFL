"use client";

// Les invitations de l'ouverture : l'équipe qui m'invite, l'annonce des
// divisions, la ville, les notifications, la carte officielle, puis les
// joueurs à suivre. Une seule par ouverture, jamais
// deux.
//
// · L'équipe, avant tout (Sabri, 24/10 : « contraints de répondre à cette
//   notif : oui ou non ? ») : une invitation de Bola Team encore valable
//   attend son Oui ou son Non, sans « Plus tard » ; à un membre qui avait
//   signé la version 1 du Règlement, la Charte de déontologie à signer
//   (equipe/reponse-equipe.tsx).
// · L'arbitre, ensuite (Sabri, 24/10) : une fois, sa carte d'arbitre et
//   « Tu es arbitre » (annonce-arbitre.tsx).
// 0. L'annonce des divisions, jusqu'au soir de la J3 (annonce-divisions.tsx) :
//    une fois dans la semaine, une fois le dimanche même. Pendant la fenêtre
//    de sa notification (la veille dès 18 h, le dimanche matin), l'ouverture
//    sonne aussi le serveur, qui l'envoie une fois à chaque joueur
//    (lib/sfl/divisions-annonce.ts). Dès la J4, le samedi soir et le
//    dimanche, elle sonne de même la notification de l'outsider
//    (lib/sfl/outsider-annonce.ts).
// 1. La ville, d'abord (Sabri, 22/10 : « propose à chaque joueur, à sa
//    prochaine connexion, de renseigner sa ville pour qu'on puisse le mettre
//    sur la map »). Tant que le joueur ne l'a ni choisie ni confirmée
//    lui-même (lib/sfl/villes, maVilleAProposer), « D'où tu viens ? » lui
//    montre celle que sa connexion a devinée, ou la lui fait chercher
//    (invitation-ville.tsx).
// 2. Les notifications (Sabri, 19/10 : « quand quelqu'un
//    télécharge l'application, fais-lui autoriser les notifs directement »).
//    Dès la première ouverture où ce téléphone peut en recevoir sans les
//    avoir ni activées ni refusées — l'app installée sur l'écran d'accueil,
//    pour un iPhone —, l'app se voile et propose de les activer
//    (lib/sfl/notifications). Le bouton est indispensable : iOS ne demande
//    la permission qu'après un toucher. Un iPhone dans Safari ne peut pas :
//    le guide d'installation s'en charge d'abord.
// 3. La carte officielle. Tant que le joueur connecté n'a pas de photo à lui
//    sur sa carte, sa carte actuelle arrive, et un bouton ouvre directement
//    le parcours (carte-officielle.tsx). On ne décide qu'après avoir relu la
//    liste des photos de la ligue : un cache vide sur un nouvel appareil ne
//    doit pas inviter quelqu'un qui a déjà sa photo.
// 4. Les joueurs à suivre (Sabri, 22/10 : « incite-le dans l'application
//    pour nos utilisateurs actuels »). Tant que le joueur ne suit personne,
//    ses six partenaires les plus fidèles arrivent en cartes (partenaires.ts,
//    complétés par le haut du Pépite d'Or), tous cochés ; un toucher en
//    décoche un, et le bouton les suit d'un coup (suivis.ts). Décidé sur la
//    liste relue de la base, jamais sur un cache.
//
// L'accueil de l'app passe avant tout (components/sfl/accueil, 24/10) : à
// la première ouverture, il demande déjà la ville, la carte officielle, les
// notifications et les partenaires. Ce qui a été laissé pour « Plus tard »
// y est mis en pause ici aussi (mettreEnPause) : rien ne revient le jour même.
// Le prénom, le nom, le pseudo et l'email passent avant tout (identite.tsx) :
// rien ne s'ouvre ici tant que le joueur ne les a pas confirmés.
//
// « Plus tard » fait taire chaque invitation deux jours, sur cet appareil.
// À chaque ouverture, un téléphone déjà abonné redonne son abonnement.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Check, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { AnnonceArbitre, annonceArbitreVue } from "@/components/sfl/annonce-arbitre";
import { AnnonceDivisions } from "@/components/sfl/annonce-divisions";
import { Card3D } from "@/components/sfl/card-3d";
import { FluxCarteOfficielle } from "@/components/sfl/carte-officielle";
import { InvitationVille } from "@/components/sfl/invitation-ville";
import { ReponseEquipe, equipeAOuvrir, type EquipeAOuvrir } from "@/components/sfl/equipe/reponse-equipe";
import { CarteDe, FORMAT_CARTE } from "@/components/sfl/mini-carte";
import { PlayerCard } from "@/components/sfl/player-card";
import { useJoueurBola, useMyPlayer } from "@/components/sfl/player-provider";
import { useHorsSfl } from "@/hooks/use-hors-sfl";
import { useSeason } from "@/components/sfl/season-provider";
import { useIdentites } from "@/hooks/use-identites";
import { useSession } from "@/hooks/use-session";
import { useSuivis } from "@/hooks/use-suivis";
import { etatArbitres, rafraichirArbitres } from "@/lib/sfl/arbitres";
import { idDe } from "@/lib/sfl/comptes";
import { editionAnnonce, fenetreNotification, type EditionAnnonce } from "@/lib/sfl/divisions";
import { annonceVue, annoncerDivisions, noterAnnonceVue } from "@/lib/sfl/divisions-annonce";
import { annoncerLigue } from "@/lib/sfl/ligue-annonce";
import { ajusterEquipes } from "@/lib/sfl/divisions-equipes";
import { rankPlayers, type Player } from "@/lib/sfl/engine";
import { isHidden } from "@/lib/sfl/hidden";
import { identiteConfirmee, rafraichirIdentites } from "@/lib/sfl/identites";
import { annoncerOutsider } from "@/lib/sfl/outsider-annonce";
import { dimancheAAnnoncer, peutEtreLaVeille } from "@/lib/sfl/outsiders";
import { partenaires } from "@/lib/sfl/partenaires";
import { photoPerso, rafraichirPhotos } from "@/lib/sfl/photos";
import {
  activerNotifications,
  etatNotifications,
  noterEtatNotifs,
  noterNotifs,
  rafraichirAbonnement,
} from "@/lib/sfl/notifications";
import type { Saison } from "@/lib/sfl/saisie/types";
import { enDemo as enDemoSuivis, liensDeLaBase, liensDemo, rafraichirSuivis, suivisLus, suivre } from "@/lib/sfl/suivis";
import { maVille, maVilleAProposer, type VilleJoueur } from "@/lib/sfl/villes";
import { demoInvitation } from "@/lib/sfl/equipes-demo";
import { cn } from "@/lib/utils";

export type Invitation = "equipe" | "arbitre" | "divisions" | "ville" | "carte" | "notifs" | "suivre";

const PLUS_TARD = (quoi: Invitation, nom: string) => `sfl-invitation-${quoi}-${nom}`;
/** Combien de joueurs l'invitation propose de suivre. */
const PROPOSES = 6;
/** Silence après « Plus tard ». */
const PAUSE_MS = 2 * 24 * 3600 * 1000;
/** Après le splash, et après la cérémonie des nouvelles cartes si elle passe. */
const DELAI_MS = 2600;

const TEXTES: Record<Exclude<Invitation, "ville" | "divisions" | "equipe" | "arbitre">, { titre: string; ligne: string; bouton: string }> = {
  carte: {
    titre: "Ta carte officielle",
    ligne: "Ton visage, le maillot Bola. Elle apparaît sur ta carte, chez tout le monde.",
    bouton: "Créer ma carte officielle",
  },
  notifs: {
    titre: "Les notifications",
    ligne: "Quand on te cite au Vestiaire, quand on réagit à ton message, quand la ligue bouge.",
    bouton: "Activer les notifications",
  },
  suivre: {
    titre: "Suis tes partenaires",
    ligne: "Ceux avec qui tu joues le plus. Ils passent en premier quand tu montes un match.",
    bouton: "Suivre",
  },
};

/** « Plus tard » : l'invitation se tait deux jours sur cet appareil (l'accueil s'en sert aussi). */
export function mettreEnPause(quoi: Invitation, nom: string) {
  try {
    localStorage.setItem(PLUS_TARD(quoi, nom), String(Date.now()));
  } catch {}
}

/** Remise à plus tard il y a moins de deux jours, sur cet appareil (l'accueil s'en sert aussi). */
export function enPause(quoi: Invitation, nom: string): boolean {
  try {
    const t = Number(localStorage.getItem(PLUS_TARD(quoi, nom)) ?? 0);
    return Date.now() - t < PAUSE_MS;
  } catch {
    return false;
  }
}

/**
 * Les joueurs à suivre : ses partenaires les plus fidèles, puis le haut du
 * Pépite d'Or ; un compte accepté (`suivable`), ni lui, ni un joueur masqué.
 */
export function aSuivre(saison: Saison, players: Player[], nom: string, suivable: (n: string) => boolean): string[] {
  const ok = (n: string) => n !== nom && !isHidden(n) && suivable(n);
  const fideles = [...partenaires(saison, nom).keys()].filter(ok);
  const hauts = rankPlayers(players.filter((p) => p.matchs > 0))
    .map((p) => p.name)
    .filter((n) => ok(n) && !fideles.includes(n));
  return [...fideles, ...hauts].slice(0, PROPOSES);
}

/** En dev, `?invitation`, `?invitation=notifs`, `?invitation=ville`, `?invitation=suivre`, `?invitation=divisions`, `?invitation=equipe` ou `?invitation=arbitre` la montre sans compte vérifié (captures). */
function apercu(): Invitation | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  const v = new URLSearchParams(window.location.search).get("invitation");
  return v === null ? null : v === "notifs" || v === "ville" || v === "suivre" || v === "divisions" || v === "equipe" || v === "arbitre" ? v : "carte";
}

export function InvitationCarte() {
  const session = useSession();
  const { player } = useMyPlayer();
  const { saison, players } = useSeason();
  const suivis = useSuivis();
  const id = useIdentites();
  const [forcee] = useState(apercu);
  const nom = forcee || (session?.server && session.name === player.name) ? player.name : null;

  const [visible, setVisible] = useState<Invitation | null>(null);
  /** La ville que « D'où tu viens ? » propose d'emblée. */
  const [proposee, setProposee] = useState<VilleJoueur | null>(null);
  /** L'équipe qui m'invite, ou la Charte à signer. */
  const [equipe, setEquipe] = useState<EquipeAOuvrir | null>(null);
  const [edition, setEdition] = useState<EditionAnnonce>("avant");
  const [flux, setFlux] = useState(false);
  const [etatNotifs, setEtatNotifs] = useState<Awaited<ReturnType<typeof etatNotifications>>>("indisponible");
  const [busy, setBusy] = useState(false);
  /** Ceux qu'on a décochés dans l'invitation à suivre. */
  const [decoches, setDecoches] = useState<Set<string>>(() => new Set());

  const proposes = useMemo(
    () => (nom ? aSuivre(saison, players, nom, (n) => suivis.suivable(n) && !suivis.suit(nom, n)) : []),
    [nom, saison, players, suivis]
  );
  // La décision se prend hors du rendu, sur la saison du moment.
  const ligue = useRef({ saison, players });
  // Un joueur Bola, hors de la SFL : ni l'annonce des divisions, ni les
  // joueurs de la SFL à suivre (porte-sfl.tsx).
  const horsSfl = useHorsSfl();
  const bola = useJoueurBola();
  const horsSflRef = useRef(false);
  useEffect(() => {
    ligue.current = { saison, players };
    horsSflRef.current = horsSfl || bola;
  });

  useEffect(() => {
    if (!nom) return;
    void rafraichirAbonnement().catch(() => {});
    let annule = false;
    const timer = setTimeout(async () => {
      const maintenant = new Date();
      if (forcee) {
        if (forcee === "ville") setProposee(maVille(nom));
        if (forcee === "divisions") setEdition(editionAnnonce(ligue.current.saison, maintenant) ?? "avant");
        if (forcee === "equipe")
          setEquipe({ quoi: "invitation", ...demoInvitation(ligue.current.players.filter((p) => p.matchs > 0).map((p) => p.name), nom) });
        setVisible(forcee);
        return;
      }
      if (fenetreNotification(ligue.current.saison, maintenant)) void annoncerDivisions();
      if (dimancheAAnnoncer(ligue.current.saison) !== null && peutEtreLaVeille(maintenant)) void annoncerOutsider();
      // La convocation du lundi, les résultats du dimanche : le serveur juge.
      void annoncerLigue();
      // Le week-end des équipes par division : elles se tiennent à jour.
      void ajusterEquipes("ouverture");
      const [etat, ville] = await Promise.all([
        etatNotifications().catch(() => "indisponible" as const),
        enPause("ville", nom) ? null : maVilleAProposer(nom),
        rafraichirPhotos(),
        rafraichirIdentites(),
        rafraichirSuivis(),
        rafraichirArbitres().catch(() => {}),
      ]);
      if (annule) return;
      noterEtatNotifs(etat, nom);
      setEtatNotifs(etat);
      if (identiteConfirmee(nom) === false) return;
      // L'équipe d'abord : son invitation attend un Oui ou un Non.
      const team = await equipeAOuvrir(enPause("equipe", nom)).catch(() => null);
      if (annule) return;
      if (team) {
        setEquipe(team);
        setVisible("equipe");
        return;
      }
      const annonce = editionAnnonce(ligue.current.saison, maintenant);
      // Un arbitre apprend qu'il l'est (annonce-arbitre.tsx), une fois.
      if (etatArbitres().arbitres.includes(nom) && !annonceArbitreVue(nom)) setVisible("arbitre");
      else if (annonce && !annonceVue(annonce, nom) && !horsSflRef.current) {
        setEdition(annonce);
        setVisible("divisions");
      } else if (ville?.proposer) {
        setProposee(ville.ville);
        setVisible("ville");
      } else if (etat === "inactives" && !enPause("notifs", nom)) setVisible("notifs");
      else if (photoPerso(nom) === null && !enPause("carte", nom)) setVisible("carte");
      else if (!enPause("suivre", nom) && !horsSflRef.current) {
        // La liste de la base (ou, en aperçu, la démonstration), jamais un cache.
        const demo = enDemoSuivis();
        const suitDeja = (demo ? liensDemo([], nom) : liensDeLaBase()).some(([a]) => a === nom);
        const { saison: s, players: ps } = ligue.current;
        const noms = new Set(ps.map((p) => p.name));
        const suivable = (n: string) => (demo ? noms.has(n) : !!idDe(n));
        if ((demo || suivisLus()) && !suitDeja && aSuivre(s, ps, nom, suivable).length > 0) setVisible("suivre");
      }
    }, DELAI_MS);
    return () => {
      annule = true;
      clearTimeout(timer);
    };
  }, [nom, forcee]);

  // L'invitation aux notifications, montrée : le journal d'usage le note,
  // puis la réponse (lib/sfl/notifications.ts, page Activité de l'admin).
  useEffect(() => {
    if (visible === "notifs" && !forcee) noterNotifs("proposee", "ouverture");
  }, [visible, forcee]);

  if (!nom) return null;

  function plusTard() {
    if (!visible) return;
    mettreEnPause(visible, nom!);
    if (visible === "notifs") noterNotifs("plus-tard", "ouverture");
    setVisible(null);
  }

  async function oui() {
    if (visible === "carte") {
      setVisible(null);
      setFlux(true);
      return;
    }
    if (visible === "suivre") {
      const choisis = proposes.filter((n) => !decoches.has(n));
      setVisible(null);
      navigator.vibrate?.([8, 40, 8]);
      const erreur = await suivre(nom!, choisis);
      if (erreur) toast.error(erreur);
      return;
    }
    setBusy(true);
    try {
      const etat = await activerNotifications("ouverture");
      if (etat === "actives") toast.success("Notifications activées");
      else if (etat === "refusees") toast.error("Refusées : change-le dans les réglages du téléphone.");
    } catch {
      toast.error("Impossible d'activer les notifications.");
    } finally {
      setBusy(false);
      setVisible(null);
    }
  }

  function annonceFermee() {
    noterAnnonceVue(edition, nom!);
    setVisible(null);
  }

  const texte = visible && visible !== "ville" && visible !== "divisions" && visible !== "equipe" && visible !== "arbitre" ? TEXTES[visible] : null;
  const Icone = visible === "notifs" ? Bell : visible === "suivre" ? UserPlus : Sparkles;
  const choisis = proposes.filter((n) => !decoches.has(n)).length;

  return (
    <>
      <AnimatePresence>
        {visible === "equipe" && equipe && <ReponseEquipe key="equipe" a={equipe} onFini={() => setVisible(null)} onPlusTard={plusTard} />}
        {visible === "arbitre" && <AnnonceArbitre key="arbitre" nom={nom} etat={etatNotifs} onFermer={() => setVisible(null)} />}
        {visible === "divisions" && <AnnonceDivisions key="divisions" player={player} edition={edition} onFermer={annonceFermee} />}
        {visible === "ville" && (
          <InvitationVille key="ville" player={player} proposee={proposee} onFini={() => setVisible(null)} onPlusTard={plusTard} />
        )}
        {texte && (
          <motion.div
            key="invitation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="dark fixed inset-0 z-[55] flex flex-col items-center justify-center gap-6 bg-black/92 px-6 text-foreground backdrop-blur-sm"
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            {visible === "suivre" ? (
              <div className="grid grid-cols-3 gap-x-[var(--fib-13)] gap-y-[var(--fib-21)]">
                {proposes.map((n, i) => {
                  const pris = !decoches.has(n);
                  return (
                    <motion.button
                      key={n}
                      type="button"
                      aria-pressed={pris}
                      initial={{ scale: 0.7, y: 40, opacity: 0 }}
                      animate={{ scale: 1, y: 0, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 240, damping: 22, delay: 0.06 * i }}
                      onClick={() =>
                        setDecoches((d) => {
                          const s = new Set(d);
                          if (s.has(n)) s.delete(n);
                          else s.add(n);
                          return s;
                        })
                      }
                      className="flex flex-col items-center gap-1.5"
                    >
                      <span className={cn("relative transition-opacity", !pris && "opacity-35")}>
                        <CarteDe name={n} size={FORMAT_CARTE.moyenne} inerte />
                        <span
                          aria-hidden
                          className={cn(
                            "absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full border-2 border-black transition-colors",
                            pris ? "bg-white text-black" : "bg-white/15 text-transparent"
                          )}
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </span>
                      </span>
                      <span className={cn("max-w-[86px] truncate text-[12px] font-semibold text-white", !pris && "text-white/40")}>
                        {id.nom(n).split(" ")[0]}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            ) : (
              <motion.div
                initial={{ scale: 0.7, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ type: "spring", stiffness: 240, damping: 22 }}
              >
                <Card3D
                  cacheKey={`invitation-${nom}`}
                  mode="simple"
                  size={0.82}
                  interactive={false}
                  render={(s) => <PlayerCard player={player} size={s} />}
                />
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col items-center gap-1.5 text-center"
            >
              <h2 className="text-[24px] leading-tight font-extrabold tracking-tight text-white">{texte.titre}</h2>
              <p className="max-w-[290px] text-[14px] leading-snug text-white/60">{texte.ligne}</p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45 }}
              className="flex w-full max-w-[340px] flex-col items-center gap-1"
            >
              <button
                type="button"
                onClick={oui}
                disabled={busy || (visible === "suivre" && choisis === 0)}
                className={cn(
                  "bouton-principal flex w-full items-center justify-center gap-2 py-[15px] text-[15px] font-bold disabled:opacity-50",
                  visible === "suivre" ? "bouton--mauve" : "bouton--or"
                )}
              >
                <Icone className="size-4" />
                {visible === "suivre" ? (choisis > 1 ? `Suivre les ${choisis}` : "Suivre") : texte.bouton}
              </button>
              <button type="button" onClick={plusTard} className="bouton-discret px-6 py-3 text-[14px] font-semibold">
                Plus tard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <FluxCarteOfficielle player={player} ouvert={flux} onFermer={() => setFlux(false)} />
    </>
  );
}
