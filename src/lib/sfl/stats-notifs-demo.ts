// Des notifications d'exemple pour les aperçus (développement et aperçus
// Vercel, jamais en production) : tant que la base n'a pas les tables du
// suivi, la partie Notifications d'Admin → Activité montre une ligue inventée
// (vingt-deux prénoms, cinq semaines de Vestiaire, trois matchs entre
// joueurs, une équipe, deux dimanches de missions, des bravos, des abonnés,
// deux annonces), pour juger de la page remplie. Tirée d'une graine fixe :
// la même à chaque visite. Rien n'est écrit.

import type { MotifNotif } from "@/lib/sfl/motifs-notif";
import { DAY, debutJour } from "@/lib/sfl/retention";
import type { DonneesNotifs, EnvoiLu, GesteNotifs, MouvementLu } from "@/lib/sfl/stats-notifs";

export const DEMO_NOTIFS = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

const PRENOMS = [
  "Inès", "Léo", "Awa", "Nolan", "Yanis", "Lina", "Hugo", "Maël", "Jade", "Rayan", "Chloé",
  "Adam", "Nina", "Théo", "Sarah", "Ilan", "Zoé", "Noah", "Maya", "Samy", "Lou", "Enzo",
];

/** La chance qu'une notification de ce motif soit touchée, chez un joueur moyen. */
const TOUCHE: Partial<Record<MotifNotif, number>> = {
  "vestiaire-message": 0.17,
  "vestiaire-reponse": 0.62,
  "vestiaire-cite": 0.7,
  "vestiaire-en-avant": 0.55,
  "vestiaire-reaction": 0.33,
  "match-invitation": 0.72,
  "match-arrivee": 0.3,
  "match-message": 0.4,
  "match-veille": 0.58,
  "match-modifie": 0.5,
  "equipe-message": 0.36,
  "equipe-reponse": 0.6,
  missions: 0.6,
  felicitation: 0.66,
  suivi: 0.5,
  "suivi-retour": 0.4,
  annonce: 0.42,
};

/** Touchée, la chance qu'elle soit suivie du geste qu'elle attendait. */
const SUITE: Partial<Record<MotifNotif, number>> = {
  "vestiaire-message": 0.22,
  "vestiaire-reponse": 0.55,
  "vestiaire-cite": 0.5,
  "vestiaire-en-avant": 0.35,
  "vestiaire-reaction": 0.3,
  "match-arrivee": 0.25,
  "match-message": 0.35,
  "match-veille": 0.4,
  "match-modifie": 0.3,
  "equipe-message": 0.3,
  "equipe-reponse": 0.5,
  suivi: 0.45,
};

/** mulberry32 : un tirage reproductible. */
function tirage(graine: number) {
  let n = graine;
  return () => {
    n = (n + 0x6d2b79f5) | 0;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function notifsDemo(now: number): { donnees: DonneesNotifs; actifs: string[] } {
  const r = tirage(2310);
  const jour0 = debutJour(now) - 34 * DAY;
  const a = (jour: number, heure: number) => jour0 + jour * DAY + heure * 3600_000 + Math.floor(r() * 3600_000);
  const choisir = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];

  // Chaque joueur : son appétit pour les notifications, et ses abonnements
  // (jour d'arrivée, de départ). Les autres disent pourquoi ils n'en ont pas.
  const joueurs = PRENOMS.map((nom, i) => ({ nom, appetit: 0.35 + r() * 1.15, i }));
  joueurs[6].appetit = 0; // Hugo reçoit tout, ne touche rien.
  const arrivees: [string, number, number | null, string][] = [
    ["Inès", -20, null, "apple"],
    ["Léo", -12, null, "apple"],
    ["Awa", -3, null, "google"],
    ["Nolan", 2, null, "apple"],
    ["Yanis", 6, null, "apple"],
    ["Lina", 9, null, "apple"],
    ["Hugo", 11, null, "apple"],
    ["Maël", 15, null, "google"],
    ["Jade", 19, null, "apple"],
    ["Rayan", 22, null, "apple"],
    ["Chloé", 26, null, "apple"],
    ["Adam", 29, null, "apple"],
    ["Nina", 31, null, "apple"],
    ["Théo", 4, 24, "apple"],
  ];
  const sansNotifs: Record<string, string> = {
    Sarah: "a-installer",
    Ilan: "a-installer",
    Zoé: "a-installer",
    Noah: "a-installer",
    Maya: "refusees",
    Samy: "inactives",
    Théo: "inactives",
  };
  const actifs = PRENOMS.filter((n) => n !== "Lou" && n !== "Enzo");

  const mouvements: MouvementLu[] = [];
  const intervalles = new Map<string, [number, number][]>();
  for (const [nom, de, jusqua, service] of arrivees) {
    const debut = a(de, 19);
    const fin = jusqua === null ? Infinity : a(jusqua, 12);
    intervalles.set(nom, [...(intervalles.get(nom) ?? []), [debut, fin]]);
    mouvements.push({ nom, appareil: `demo-${nom}`, service, evenement: "ajout", le: debut });
    if (fin !== Infinity) mouvements.push({ nom, appareil: `demo-${nom}`, service, evenement: "retrait", le: fin });
  }
  // Léo a aussi son iPad.
  mouvements.push({ nom: "Léo", appareil: "demo-Léo-2", service: "apple", evenement: "ajout", le: a(14, 21) });
  const joignable = (nom: string, t: number) => (intervalles.get(nom) ?? []).some(([de, fin]) => t >= de && t < fin);

  /* ------------------------------- les envois ----------------------------- */
  const envois: EnvoiLu[] = [];
  const appetit = new Map(joueurs.map((j) => [j.nom, j.appetit]));
  const prevenir = (nom: string, motif: MotifNotif, t: number) => {
    if (t > now || !joignable(nom, t)) return;
    const prise = r() > 0.02;
    const touchee = prise && r() < Math.min(0.95, (TOUCHE[motif] ?? 0.3) * (appetit.get(nom) ?? 1));
    // Un délai médian de sept minutes, parfois des heures.
    const ouverte = touchee ? Math.min(now, t + Math.round(-Math.log(1 - r()) * 10 * 60_000)) : null;
    let effet: string | null = null;
    if (prise && (motif === "match-invitation" || motif === "missions")) {
      const x = r();
      effet = x < (touchee ? 0.6 : 0.08) ? "accepte" : x < (touchee ? 0.75 : 0.1) ? "refuse" : null;
    } else if (prise && SUITE[motif] !== undefined && r() < (touchee ? SUITE[motif]! : 0.04)) {
      effet = motif === "suivi" ? "suivi" : r() < 0.7 ? "message" : "reaction";
    }
    envois.push({
      nom,
      motif,
      acceptes: prise ? 1 : 0,
      envoyee: t,
      recue: prise && (touchee || r() < 0.95) ? t + 2000 : null,
      ouverte,
      effet,
    });
  };

  for (let j = 0; j <= 34; j++) {
    // Le Vestiaire : des messages, des réponses, des citations, des réactions.
    const messages = 1 + Math.floor(r() * (j % 7 === 6 ? 9 : 5));
    for (let m = 0; m < messages; m++) {
      const t = a(j, 9 + Math.floor(r() * 14));
      const auteur = choisir(actifs);
      const repondA = r() < 0.3 ? choisir(actifs) : null;
      const cite = r() < 0.12 ? choisir(actifs) : null;
      for (const p of PRENOMS) {
        if (p === auteur) continue;
        prevenir(p, p === repondA ? "vestiaire-reponse" : p === cite ? "vestiaire-cite" : "vestiaire-message", t);
      }
    }
    for (let k = Math.floor(r() * 4); k > 0; k--) prevenir(choisir(actifs), "vestiaire-reaction", a(j, 10 + Math.floor(r() * 12)));
    if (j % 4 === 1) for (let k = 1 + Math.floor(r() * 2); k > 0; k--) prevenir(choisir(actifs), "vestiaire-en-avant", a(j, 20));
    // Une équipe de six : sa discussion, un soir sur deux.
    if (j % 2 === 0)
      for (const p of ["Inès", "Léo", "Nolan", "Lina", "Rayan", "Adam"])
        prevenir(p, j % 6 === 0 ? "equipe-reponse" : "equipe-message", a(j, 21));
  }
  // Trois matchs entre joueurs : l'invitation, les arrivées, la discussion, la veille.
  for (const [jour, orga, invites] of [
    [8, "Inès", ["Léo", "Awa", "Nolan", "Yanis", "Lina", "Théo", "Hugo"]],
    [19, "Léo", ["Inès", "Maël", "Jade", "Rayan", "Hugo", "Yanis"]],
    [30, "Nolan", ["Inès", "Léo", "Chloé", "Adam", "Nina", "Rayan", "Jade", "Lina"]],
  ] as [number, string, string[]][]) {
    for (const p of invites) prevenir(p, "match-invitation", a(jour - 4, 18));
    for (let k = 0; k < 4; k++) prevenir(orga, "match-arrivee", a(jour - 3 + (k % 2), 12));
    for (let k = 0; k < 6; k++) for (const p of [orga, ...invites.slice(0, 5)]) prevenir(p, "match-message", a(jour - 2 + (k % 2), 19));
    for (const p of [orga, ...invites.slice(0, 6)]) prevenir(p, "match-veille", a(jour - 1, 19));
    if (jour === 19) for (const p of [orga, ...invites.slice(0, 6)]) prevenir(p, "match-modifie", a(jour - 2, 11));
  }
  // Deux annonces à toute la ligue.
  for (const jour of [5, 27]) for (const p of PRENOMS) prevenir(p, "annonce", a(jour, 18));
  // La ligue : les missions le vendredi d'avant chaque dimanche, les bravos
  // le lendemain, et des abonnés de temps en temps.
  for (const dimanche of [22, 29]) {
    for (const p of actifs.slice(0, 16)) prevenir(p, "missions", a(dimanche - 2, 18));
    for (let k = 0; k < 9; k++) prevenir(choisir(actifs), "felicitation", a(dimanche + 1, 12 + Math.floor(r() * 9)));
  }
  for (let j = 16; j <= 34; j++)
    if (r() < 0.7) prevenir(choisir(actifs), r() < 0.3 ? "suivi-retour" : "suivi", a(j, 11 + Math.floor(r() * 11)));

  /* ------------------- l'invitation de l'ouverture, les états -------------- */
  const gestes: GesteNotifs[] = [];
  const noter = (nom: string, geste: string, ou: string | null, t: number, etat: string | null = null) => {
    if (t <= now) gestes.push({ nom, geste, ou, etat, at: t });
  };
  for (const [nom, de] of arrivees) {
    if (de < 0) continue;
    const t = (mouvements.find((m) => m.nom === nom)?.le ?? now) - 60_000;
    noter(nom, "proposee", "ouverture", t);
    noter(nom, "actives", nom === "Rayan" ? "reglages" : nom === "Nina" ? "vestiaire" : "ouverture", t + 50_000);
  }
  for (const [nom, geste] of [
    ["Samy", "plus-tard"],
    ["Maya", "refusees"],
    ["Théo", "plus-tard"],
    ["Lou", "plus-tard"],
    ["Enzo", null],
    ["Samy", null],
  ] as [string, string | null][]) {
    const t = a(10 + Math.floor(r() * 20), 18);
    noter(nom, "proposee", "ouverture", t);
    if (geste) noter(nom, geste, "ouverture", t + 30_000);
  }
  for (const nom of actifs) {
    const t = a(33, 12);
    noter(nom, "etat", null, t, joignable(nom, t) ? "actives" : (sansNotifs[nom] ?? "inactives"));
  }

  // Les téléphones encore abonnés aujourd'hui : le dernier mouvement de chacun est une arrivée.
  const dernier = new Map<string, MouvementLu>();
  for (const m of [...mouvements].sort((x, y) => x.le - y.le)) dernier.set(m.appareil, m);
  const abonnements = [...dernier.values()]
    .filter((m) => m.evenement === "ajout")
    .map((m) => ({ nom: m.nom, depuis: m.le }));

  return { donnees: { envois, mouvements, abonnements, gestes }, actifs };
}
