// Le club de démonstration de Bola Club : le « FC Démo » (bola-app#14 : « un
// club fictif, 4 catégories, ~60 joueurs fictifs avec cartes et évolution,
// aucun vrai joueur, aucune vraie photo, 3 entraîneurs »). Un jeu de données
// local au code, tiré d'un tirage fixe (le même idiome que
// ligue-vierge-demo.ts) : deux appels donnent le même club. Rien ne vient de
// la base, rien n'y va. Les prénoms et les noms sont inventés, tirés de deux
// listes ; aucun n'est un nom de la saison (tools/club-check.ts le garde).
// Les adversaires ont un nom visiblement fictif.
//
//   · FC Démo, écusson vert forêt, blanc et argent (loin de l'or, du bleu et
//     du rouge des cartes à titre) ; palier Club 200 ;
//   · U13 (15), U17 (15), Seniors (18), Féminines (12) : 60 joueurs ; un
//     entraîneur pour U13 et U17, un pour les Seniors, une pour les
//     Féminines ; une présidente, admin du club ;
//   · le jour de la démo est figé au 12/11/2026. Par catégorie : 8 matchs
//     joués depuis septembre, 10 entraînements, un match convoqué le
//     week-end des 14 et 15/11, un entraînement le mercredi 18/11 ;
//   · licences : 62 actives (58 joueurs, 3 entraîneurs, 1 admin), 2 en
//     attente de l'accord parental (deux U13 : pas convoqués, pas de stats
//     tant que le parent n'a pas dit oui), 5 invitations, 131 libres ;
//   · un U13 surclassé en U17.

import type { Stats } from "@/lib/sfl/engine";
import type { Poste } from "@/lib/sfl/inscription";
import type { Annonce, Categorie, Club, EtatAppel, Licence, Membre, NotePrivee, ParentClub, Seance, Staff } from "./types";

/** Le jour de la démo. */
export const JOUR_DEMO = "2026-11-12";

// Un tirage fixe : le même club à chaque chargement.
function tirage(graine: number) {
  let x = graine;
  return () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
}

const PRENOMS = [
  "Aloïs", "Basile", "Côme", "Timéo", "Maël", "Léandre", "Noé", "Sacha", "Eliott", "Marius", "Gaspard", "Titouan",
  "Lubin", "Anselme", "Octave", "Ulysse", "Zadig", "Malo", "Ewen", "Soan", "Nino", "Tao", "Lenny", "Isaac",
  "Robin", "Achille", "Augustin", "Célestin", "Edgar", "Félix", "Gabin", "Honoré", "Joachim", "Lazare", "Milo", "Oscar",
  "Pablo", "Siméon", "Tobias", "Valentin", "Ilan", "Kenzo", "Loris", "Naël", "Owen", "Ruben", "Solal", "Elio",
  "Jules", "Léon", "Marceau", "Auguste",
];
const PRENOMS_F = ["Ambre", "Capucine", "Élise", "Garance", "Jade", "Louison", "Maëlys", "Noémie", "Ondine", "Romane", "Salomé", "Thaïs", "Zélie", "Apolline", "Clémence", "Margaux", "Agathe", "Brune", "Colombe"];
const NOMS = [
  "Aubrac", "Belcourt", "Castelnau", "Estève", "Hautefort", "Islet", "Jouvence", "Kerlan", "Lavergne", "Montclar", "Nérac", "Orsay",
  "Pradel", "Queyras", "Rochebrune", "Sauveterre", "Ussel", "Winterstein", "Yvelin", "Zeller", "Arbois", "Beaulieu", "Chantelou", "Duvernet",
  "Escande", "Florac", "Grandval", "Lamballe", "Mirabel", "Noirmont", "Ormesson", "Peyrac", "Rivesaltes", "Sainval", "Tréguier", "Vauclair",
  "Bellerive", "Clairval", "Dormoy", "Fabrègue", "Gensac", "Larzac", "Maubert", "Roquefeuil",
];

export const ADVERSAIRES = ["AS Exemple", "US Modèle", "Olympique Témoin", "Étoile Factice", "Racing Essai", "Stade Fictif", "SC Gabarit", "Union Maquette"];

const STAFF: Staff[] = [
  { id: "s-admin", prenom: "Hortense", nom: "Valmont", role: "admin" },
  { id: "s-e1", prenom: "Corentin", nom: "Delorme", role: "entraineur" },
  { id: "s-e2", prenom: "Mathis", nom: "Tavernier", role: "entraineur" },
  { id: "s-e3", prenom: "Solène", nom: "Garrigue", role: "entraineur" },
];

const CATEGORIES: Categorie[] = [
  { id: "u13", nom: "U13", ordre: 1, entraineurs: ["s-e1"], ageMax: 13 },
  { id: "u17", nom: "U17", ordre: 2, entraineurs: ["s-e1"], ageMax: 17 },
  { id: "seniors", nom: "Seniors", ordre: 3, entraineurs: ["s-e2"], ageMax: null },
  { id: "feminines", nom: "Féminines", ordre: 4, entraineurs: ["s-e3"], ageMax: null, feminine: true },
];

const P15: Poste[] = ["G", "G", "DG", "DC", "DC", "DC", "DD", "MDC", "MDC", "MC", "MC", "MC", "AG", "AT", "AD"];
const EFFECTIFS: { cat: string; postes: Poste[]; nes: [number, number]; lieu: string; jourMatch: "samedi" | "dimanche"; heure: string; niveau: number }[] = [
  { cat: "u13", postes: P15, nes: [2014, 2015], lieu: "Stade municipal, terrain 2", jourMatch: "samedi", heure: "14h00", niveau: 70 },
  { cat: "u17", postes: P15, nes: [2010, 2011], lieu: "Stade municipal, terrain 1", jourMatch: "samedi", heure: "16h30", niveau: 74 },
  { cat: "seniors", postes: [...P15, "DC", "MC", "AT"], nes: [1991, 2006], lieu: "Stade municipal, terrain d'honneur", jourMatch: "dimanche", heure: "15h00", niveau: 77 },
  { cat: "feminines", postes: ["G", "DG", "DC", "DC", "DD", "MDC", "MC", "MC", "AG", "AT", "AT", "AD"], nes: [1996, 2008], lieu: "Stade municipal, terrain 1", jourMatch: "dimanche", heure: "11h00", niveau: 75 },
];

// Ce que le poste pèse sur la carte de départ (VIT, TIR, PAS, DRI, DEF, PHY).
const PROFIL: Record<Poste, number[]> = {
  G: [-2, 2, 0, -4, 4, 2],
  DG: [3, -5, 0, 0, 3, 0],
  DC: [-2, -6, -1, -4, 6, 5],
  DD: [3, -5, 0, 0, 3, 0],
  MDC: [-1, -3, 3, -1, 4, 3],
  MC: [0, 0, 4, 2, -1, 0],
  AG: [5, 2, 0, 4, -6, -2],
  AT: [2, 6, -1, 2, -7, 1],
  AD: [5, 2, 0, 4, -6, -2],
};

// Les buts vont d'abord aux attaquants ; les passes, aux milieux et aux ailiers.
const POIDS_BUT: Record<Poste, number> = { G: 0, DG: 1, DC: 1, DD: 1, MDC: 2, MC: 4, AG: 6, AT: 10, AD: 6 };
const POIDS_PASSE: Record<Poste, number> = { G: 0.3, DG: 3, DC: 1, DD: 3, MDC: 4, MC: 8, AG: 6, AT: 3, AD: 6 };

const SAMEDIS = ["2026-09-19", "2026-09-26", "2026-10-03", "2026-10-10", "2026-10-17", "2026-10-31", "2026-11-07", "2026-11-11"];
const DIMANCHES = ["2026-09-20", "2026-09-27", "2026-10-04", "2026-10-11", "2026-10-18", "2026-11-01", "2026-11-08", "2026-11-11"];
const MERCREDIS = ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28", "2026-11-04"];

const deux = (n: number) => String(n).padStart(2, "0");

export function clubDemo(): Club {
  const r = tirage(2026);
  const choisi = <T,>(liste: readonly T[], poids: (x: T) => number): T => {
    const total = liste.reduce((s, x) => s + poids(x), 0);
    let t = r() * total;
    for (const x of liste) {
      t -= poids(x);
      if (t <= 0) return x;
    }
    return liste[liste.length - 1];
  };

  // Les noms : chaque prénom et chaque nom ne sert qu'une fois par liste, puis on repart du début, décalé.
  const pris = new Set<string>(STAFF.map((s) => `${s.prenom} ${s.nom}`));
  let kp = 0;
  let kf = 0;
  let kn = 0;
  const nommer = (feminin: boolean) => {
    for (;;) {
      const prenom = feminin ? PRENOMS_F[kf++ % PRENOMS_F.length] : PRENOMS[kp++ % PRENOMS.length];
      const nom = NOMS[(kn++ * 7 + (kn > NOMS.length ? 3 : 0)) % NOMS.length];
      if (!pris.has(`${prenom} ${nom}`)) {
        pris.add(`${prenom} ${nom}`);
        return { prenom, nom };
      }
    }
  };

  const membres: Membre[] = [];
  for (const e of EFFECTIFS) {
    e.postes.forEach((poste, i) => {
      const { prenom, nom } = nommer(e.cat === "feminines");
      const an = e.nes[0] + Math.floor(r() * (e.nes[1] - e.nes[0] + 1));
      // Les U17 ont tous 15 ans passés au jour de la démo (nés avant novembre).
      const naissance = `${an}-${deux(1 + Math.floor(r() * 10))}-${deux(1 + Math.floor(r() * 28))}`;
      const niveau = e.niveau + Math.floor(r() * 9) - 3;
      const p = PROFIL[poste];
      const v = (k: number) => Math.max(58, Math.min(90, niveau + p[k] + Math.floor(r() * 5) - 2));
      const base: Stats = { VIT: v(0), TIR: v(1), PAS: v(2), DRI: v(3), DEF: v(4), PHY: v(5) };
      membres.push({
        id: `${e.cat}-${deux(i + 1)}`,
        prenom,
        nom,
        naissance,
        poste,
        categorie: e.cat,
        surclasseEn: null,
        base,
        accordParentalLe: e.cat === "u13" ? "2026-09-01" : null,
      });
    });
  }
  // Deux U13 dont le parent n'a pas encore donné son accord : un compte neuf (75 partout), jamais convoqué.
  const NEUVE: Stats = { VIT: 75, TIR: 75, PAS: 75, DRI: 75, DEF: 75, PHY: 75 };
  const enAttente = ["u13-06", "u13-11"];
  for (const m of membres) {
    if (!enAttente.includes(m.id)) continue;
    m.accordParentalLe = null;
    m.base = { ...NEUVE };
  }
  // Un U13 surclassé en U17 : un ailier né en 2014.
  const surclasse = membres.find((m) => m.id === "u13-13")!;
  surclasse.surclasseEn = "u17";

  const parents: ParentClub[] = membres
    .filter((m) => m.categorie === "u13")
    .map((m, i) => ({ id: `p-${m.id}`, prenom: (i % 2 ? PRENOMS : PRENOMS_F)[(i * 5 + 11) % 19], nom: m.nom, enfant: m.id }));

  const licences: Licence[] = [
    ...STAFF.map((s): Licence => ({ id: `l-${s.id}`, statut: "active", compte: s.id })),
    ...membres.map((m): Licence => ({ id: `l-${m.id}`, statut: enAttente.includes(m.id) ? "attente_accord" : "active", compte: m.id })),
    ...(
      [
        ["Marceau Sainval", "u13"],
        ["Auguste Peyrac", "u17"],
        ["Elio Grandval", "seniors"],
        ["Colombe Mirabel", "feminines"],
        ["Brune Lamballe", "feminines"],
      ] as const
    ).map(([nom, categorie], i): Licence => ({ id: `l-inv-${i + 1}`, statut: "invitee", compte: null, invite: { nom, categorie } })),
  ];

  const seances: Seance[] = [];
  for (const e of EFFECTIFS) {
    const actifs = membres.filter((m) => m.categorie === e.cat && !enAttente.includes(m.id));
    const jours = e.jourMatch === "samedi" ? SAMEDIS : DIMANCHES;
    const decalage = EFFECTIFS.indexOf(e) * 3;
    jours.forEach((jour, k) => {
      // Deux joueurs de champ au repos, à tour de rôle, et un seul gardien sur la feuille (le premier, trois fois sur
      // quatre) ; tout le monde le 11 novembre, sauf le second gardien.
      const champ = actifs.filter((m) => m.poste !== "G");
      const gardiens = actifs.filter((m) => m.poste === "G");
      const auBanc = gardiens.length > 1 ? [gardiens[k % 4 === 2 ? 0 : 1].id] : [];
      const repos =
        k === jours.length - 1 ? auBanc : [...auBanc, champ[(k * 2 + decalage) % champ.length].id, champ[(k * 2 + decalage + 5) % champ.length].id];
      const convoques = actifs.filter((m) => !repos.includes(m.id));
      const appel: Record<string, EtatAppel> = {};
      for (const m of convoques) appel[m.id] = r() < 0.06 ? "absent" : r() < 0.07 ? "retard" : "present";
      const presents = convoques.filter((m) => appel[m.id] !== "absent");
      const nous = Math.floor(r() * 3.6 + r() * 2.2);
      const eux = Math.floor(r() * 2.4 + r() * 1.4);
      const stats: Seance["stats"] = {};
      for (let b = 0; b < nous; b++) {
        const buteur = choisi(presents, (m) => POIDS_BUT[m.poste]);
        (stats[buteur.id] ??= { buts: 0, passes: 0 }).buts += 1;
        if (r() < 0.65) {
          const passeur = choisi(presents.filter((m) => m !== buteur), (m) => POIDS_PASSE[m.poste]);
          (stats[passeur.id] ??= { buts: 0, passes: 0 }).passes += 1;
        }
      }
      const domicile = k % 2 === 0;
      seances.push({
        id: `${e.cat}-m${k + 1}`,
        genre: "match",
        categorie: e.cat,
        jour,
        heure: jour === "2026-11-11" ? "10h30" : e.heure,
        lieu: domicile ? e.lieu : "À l'extérieur",
        adversaire: ADVERSAIRES[(k + decalage) % ADVERSAIRES.length],
        score: { nous, eux },
        convoques: convoques.map((m) => m.id),
        reponses: Object.fromEntries(convoques.map((m) => [m.id, "present" as const])),
        appel,
        stats,
      });
    });
    MERCREDIS.forEach((jour, k) => {
      const appel: Record<string, EtatAppel> = {};
      for (const m of actifs) appel[m.id] = r() < 0.11 ? "absent" : r() < 0.05 ? "retard" : "present";
      seances.push({
        id: `${e.cat}-e${k + 1}`,
        genre: "entrainement",
        categorie: e.cat,
        jour,
        heure: e.cat === "u13" ? "17h30" : e.cat === "u17" ? "18h30" : "19h30",
        lieu: "Stade municipal, terrain synthétique",
        score: null,
        convoques: actifs.map((m) => m.id),
        reponses: {},
        appel,
        stats: {},
      });
    });
    // Le week-end qui vient : la convocation est partie, les réponses arrivent.
    const samedi = e.jourMatch === "samedi";
    const convoques = [...actifs.map((m) => m.id), ...(e.cat === "u17" ? [surclasse.id] : [])];
    const reponses: Seance["reponses"] = {};
    convoques.forEach((id, i) => {
      const t = r();
      if (i % 7 === 3) reponses[id] = "absent";
      else if (t < 0.84) reponses[id] = "present";
    });
    seances.push({
      id: `${e.cat}-m9`,
      genre: "match",
      categorie: e.cat,
      jour: samedi ? "2026-11-14" : "2026-11-15",
      heure: e.heure,
      lieu: e.lieu,
      adversaire: ADVERSAIRES[(8 + decalage) % ADVERSAIRES.length],
      score: null,
      convoques,
      reponses,
      appel: {},
      stats: {},
    });
    seances.push({
      id: `${e.cat}-e11`,
      genre: "entrainement",
      categorie: e.cat,
      jour: "2026-11-18",
      heure: e.cat === "u13" ? "17h30" : e.cat === "u17" ? "18h30" : "19h30",
      lieu: "Stade municipal, terrain synthétique",
      score: null,
      convoques: actifs.map((m) => m.id),
      reponses: {},
      appel: {},
      stats: {},
    });
  }

  const notes: NotePrivee[] = [
    { id: "n-1", membre: "u13-13", auteur: "s-e1", jour: "2026-10-18", texte: "Voit le jeu avant les autres. Essai avec les U17 dès novembre." },
    { id: "n-2", membre: "u13-13", auteur: "s-e1", jour: "2026-11-08", texte: "Premier entraînement avec les U17 : à l'aise, parle peu. Le laisser prendre ses marques." },
    { id: "n-3", membre: "u13-14", auteur: "s-e1", jour: "2026-10-04", texte: "Pied gauche à travailler. Dix minutes de mur après chaque séance." },
    { id: "n-4", membre: "u13-01", auteur: "s-e1", jour: "2026-09-27", texte: "Sorties aériennes en progrès. Relances au pied encore courtes." },
    { id: "n-5", membre: "u17-14", auteur: "s-e1", jour: "2026-11-02", texte: "Revient de blessure : 45 minutes au plus samedi." },
    { id: "n-6", membre: "u17-08", auteur: "s-e1", jour: "2026-10-21", texte: "Capitaine possible. Prend la parole dans le vestiaire." },
    { id: "n-7", membre: "seniors-16", auteur: "s-e2", jour: "2026-10-12", texte: "Travaille de nuit une semaine sur deux : prévenir tôt pour les convocations." },
    { id: "n-8", membre: "feminines-10", auteur: "s-e3", jour: "2026-11-09", texte: "Peut jouer seule en pointe. À essayer dimanche." },
  ];

  const annonces: Annonce[] = [
    { id: "a-1", categorie: "u13", auteur: "s-e1", jour: "2026-11-12", texte: "Photo d'équipe samedi à 13h30, avant le match. Maillot vert." },
    { id: "a-2", categorie: null, auteur: "s-admin", jour: "2026-11-10", texte: "Le club-house ouvre à 10h dimanche, pour le match des Féminines puis celui des Seniors." },
    { id: "a-3", categorie: "feminines", auteur: "s-e3", jour: "2026-11-09", texte: "L'entraînement de mercredi passe au terrain synthétique." },
    { id: "a-4", categorie: "seniors", auteur: "s-e2", jour: "2026-11-06", texte: "Covoiturage pour dimanche : départ du stade à 13h15." },
  ];

  return {
    nom: "FC Démo",
    initiales: "FCD",
    blason: { forme: "ecu", motif: "parti", couleurs: ["#0E4D32", "#F4F3EF", "#A7ADB4"], embleme: "initiales" },
    palier: "club200",
    licencesTotal: 200,
    jour: JOUR_DEMO,
    categories: CATEGORIES.map((c) => ({ ...c, entraineurs: [...c.entraineurs] })),
    membres,
    staff: STAFF.map((s) => ({ ...s })),
    parents,
    licences,
    seances,
    notes,
    annonces,
    demo: { admin: "s-admin", entraineur: "s-e1", joueur: "u17-15", parent: "p-u13-13" },
  };
}
