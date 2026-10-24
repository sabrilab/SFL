// Le mode Team en aperçu (développement et aperçus Vercel seulement, jamais
// en production) : tant que la base n'a pas les tables des équipes, la page
// Team montre un petit monde tiré des vrais noms de la ligue — mon équipe
// (5 signataires, un invité), trois autres, un défi reçu. Rien n'est écrit.
//
// Depuis le 24/10, chaque équipe a son écusson dessiné, et le championnat a
// sa démonstration (demoChampionnat) : 30 équipes du Nord, donc une D1 de 18
// et une D2 de 12 (lib/sfl/championnat-team.ts), six journées jouées de la
// saison 1, l'horloge arrêtée au soir du 15 décembre 2026. Mon équipe y a
// une feuille à remplir (contre FC Belleville, la veille) et une à
// confirmer (le Racing Wazemmes a déjà saisi). Les résultats sont tirés
// d'une graine fixe : la même démonstration à chaque ouverture.
//
// Le monde de démonstration se demande une fois par appareil (?apercu=1 sur
// la page Team, ?apercu=0 pour revenir à la base) : la page Team, la page de
// chaque équipe (/bola-team/[id]), le profil des joueurs et Ma carte le
// montrent alors tous ensemble (demoToutesEquipes, hooks/use-equipes.ts).

import { blasonParDefaut, PALETTE, type Blason, type Embleme, type Forme, type Motif } from "@/lib/sfl/blason";
import type { ButeurTeam, MatchTeam } from "@/lib/sfl/championnat-team";
import { initialesDe, type Defi, type Equipe, type EquipeTeam } from "@/lib/sfl/equipes";
import { aujourdhuiIso } from "@/lib/sfl/matchs";

export const DEMO_EQUIPES = process.env.NEXT_PUBLIC_BOLA_ENV !== "production";

const CLE_APERCU = "bola-apercu-team";
const EVT_APERCU = "bola-apercu-team";

/** Le monde de démonstration est-il demandé sur cet appareil ? Jamais en production. */
export function apercuDemande(): boolean {
  if (!DEMO_EQUIPES || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(CLE_APERCU) === "1";
  } catch {
    return false;
  }
}

/** ?apercu=1 le demande, ?apercu=0 revient à la base. */
export function demanderApercu(oui: boolean): void {
  if (!DEMO_EQUIPES) return;
  try {
    if (oui) window.localStorage.setItem(CLE_APERCU, "1");
    else window.localStorage.removeItem(CLE_APERCU);
  } catch {}
  window.dispatchEvent(new Event(EVT_APERCU));
}

export function ecouterApercu(f: () => void): () => void {
  window.addEventListener(EVT_APERCU, f);
  window.addEventListener("storage", f);
  return () => {
    window.removeEventListener(EVT_APERCU, f);
    window.removeEventListener("storage", f);
  };
}

const couleur = (id: string) => PALETTE.find((c) => c.id === id)?.hex ?? PALETTE[0].hex;
const b = (forme: Forme, motif: Motif, c1: string, c2: string, c3: string, embleme: Embleme): Blason => ({
  forme,
  motif,
  couleurs: [couleur(c1), couleur(c2), couleur(c3)],
  embleme,
});

/** Les quatre équipes de la page Team, puis celles du championnat seulement. */
const ECUSSONS: Record<number, Blason> = {
  1: b("blason", "bande", "noir", "or", "blanc", "etoile"),
  2: b("ecu", "parti", "rouge", "blanc", "noir", "initiales"),
  3: b("rond", "rayures", "ciel", "blanc", "marine", "ballon"),
  4: b("pointe", "coupe", "vert", "blanc", "noir", "eclair"),
};

const AUTRES: [string, Blason][] = [
  ["Olympique Roubaix", b("blason", "echarpe", "marine", "rouge", "blanc", "couronne")],
  ["Tourcoing United", b("ecu", "chevron", "bordeaux", "or", "blanc", "initiales")],
  ["Lomme Sporting", b("pointe", "rayures", "vert", "blanc", "noir", "initiales")],
  ["Vauban FC", b("ecu", "uni", "roi", "blanc", "blanc", "etoile")],
  ["Hellemmes City", b("rond", "cercle", "ciel", "marine", "blanc", "initiales")],
  ["Lambersart Athletic", b("blason", "coupe", "rouge", "noir", "blanc", "eclair")],
  ["Union Marcq", b("ovale", "parti", "jaune", "marine", "marine", "ballon")],
  ["Croix Rovers", b("ecu", "tranche", "orange", "noir", "blanc", "initiales")],
  ["Villeneuve Five", b("pointe", "bande", "blanc", "roi", "roi", "etoile")],
  ["Wattrelos Stars", b("blason", "uni", "violet", "or", "or", "etoile")],
  ["Saint-Maurice FC", b("rond", "rayures", "vert", "jaune", "noir", "initiales")],
  ["Euralille FC", b("ecu", "echarpe", "noir", "rouge", "blanc", "couronne")],
  ["Bois-Blancs FC", b("ovale", "coupe", "blanc", "foret", "foret", "initiales")],
  ["Mons Academy", b("blason", "chevron", "marine", "ciel", "blanc", "ballon")],
  ["Faches Futsal", b("rond", "uni", "orange", "blanc", "blanc", "ballon")],
  ["Loos Calcio", b("ecu", "rayures", "noir", "blanc", "argent", "initiales")],
  ["Ronchin Rangers", b("blason", "bande", "foret", "blanc", "or", "couronne")],
  ["Haubourdin 59", b("pointe", "parti", "rouge", "jaune", "noir", "initiales")],
  ["Wambrechies FC", b("ovale", "uni", "ciel", "blanc", "marine", "etoile")],
  ["Seclin Sport", b("ecu", "chevron", "vert", "blanc", "noir", "eclair")],
  ["Halluin Boys", b("rond", "tranche", "jaune", "noir", "noir", "initiales")],
  ["Armentières Five", b("blason", "coupe", "roi", "rouge", "blanc", "etoile")],
  ["Comines United", b("pointe", "echarpe", "bordeaux", "ciel", "blanc", "initiales")],
  ["Douai Social Club", b("ecu", "cercle", "rose", "noir", "blanc", "initiales")],
  ["Lens Five", b("blason", "rayures", "jaune", "rouge", "noir", "ballon")],
  ["Béthune Kings", b("rond", "uni", "violet", "blanc", "blanc", "couronne")],
  ["Wasquehal FC", b("ovale", "parti", "argent", "marine", "marine", "initiales")],
];

export function demoEquipes(noms: string[], moi: string): { equipes: Equipe[]; defis: Defi[] } {
  const autres = noms.filter((n) => n !== moi);
  const pris = (i: number, n: number) => autres.slice(i, i + n);
  const m = (name: string, role: "capitaine" | "vice" | "membre" = "membre", statut: "membre" | "invite" = "membre") => ({
    id: `demo-${name}`,
    name,
    role,
    statut,
    reglement: statut === "membre" ? "v2" : null,
  });
  const equipe = (id: number, nom: string, initiales: string, fond: "noir" | "blanc", ville: string, joueurs: string[]): Equipe => ({
    id,
    nom,
    initiales,
    fond,
    ville,
    capitaine: `demo-${joueurs[0]}`,
    membres: joueurs.map((n, i) => m(n, i === 0 ? "capitaine" : i === 1 ? "vice" : "membre")),
    blason: ECUSSONS[id] ?? blasonParDefaut(fond),
    couvertureLe: null,
  });

  const mienne = equipe(1, "Sunday Five", "SF", "noir", "Lille", [moi, ...pris(0, 4)]);
  // J'avais signé la version 1 : la Charte de déontologie m'attend.
  mienne.membres[0].reglement = "v1";
  // Un invité depuis cinq heures : il lui en reste 67 pour signer.
  mienne.membres.push({
    ...m(autres[4] ?? "Invité", "membre", "invite"),
    depuis: new Date(Date.now() - 5 * 3600_000).toISOString(),
    invitePar: `demo-${moi}`,
  });
  const [a, j, d] = aujourdhuiIso().split("-").map(Number);
  const dans = (n: number) => new Date(Date.UTC(a, j - 1, d + n)).toISOString().slice(0, 10);
  return {
    equipes: [
      mienne,
      equipe(2, "FC Belleville", "FCB", "blanc", "Lille", pris(5, 6)),
      equipe(3, "Racing Wazemmes", "RW", "noir", "Lille", pris(11, 7)),
      equipe(4, "AS Fives", "ASF", "blanc", "Lille", pris(18, 3)),
    ],
    defis: [{ id: 1, de: 2, a: 1, jour: dans(4), heure: "20:00", lieu: "Five Lille Sud", statut: "propose" }],
  };
}

/** Un tirage qui ne change jamais (mulberry32). */
function graine(s: number): () => number {
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** L'heure de la démonstration : le mardi 15 décembre 2026, 19 h à Paris. */
export const MAINTENANT_DEMO = new Date("2026-12-15T18:00:00Z");

const JOURNEES = ["2026-11-04", "2026-11-11", "2026-11-18", "2026-11-25", "2026-12-02", "2026-12-09"];
const LIEUX = ["Five Lille Sud", "Soccer Roubaix", "Five Villeneuve", "Urban Lomme"];

/**
 * Le championnat en aperçu : les trois équipes actives de demoEquipes (mêmes
 * numéros, mêmes écussons) et 27 autres, leurs matchs de la saison 1 et
 * leurs buteurs. AS Fives, en formation, n'y joue pas.
 */
export function demoChampionnat(
  noms: string[],
  moi: string
): { equipes: EquipeTeam[]; matchs: MatchTeam[]; maintenant: Date; effectifs: Map<number, string[]> } {
  const page = demoEquipes(noms, moi).equipes;
  const autres = noms.filter((n) => n !== moi);
  const hasard = graine(2410);

  // L'ordre de naissance fait les divisions : les 18 premières en D1.
  const equipes: EquipeTeam[] = [];
  const effectifs = new Map<number, string[]>();
  const force = new Map<number, number>();
  const ajouter = (e: Omit<EquipeTeam, "creeLe" | "active" | "dissoute" | "ville"> & { ville?: string }, joueurs: string[], f: number) => {
    const n = equipes.length;
    equipes.push({ ...e, ville: e.ville ?? "Nord", creeLe: new Date(Date.UTC(2026, 8, 1 + n * 2)).toISOString(), active: true, dissoute: false });
    effectifs.set(e.id, joueurs);
    force.set(e.id, f);
  };
  const dePage = (id: number) => page.find((e) => e.id === id)!;
  const reste = autres.slice(21);
  // Deux joueurs connus par équipe, tant que la ligue en a assez ; un ensuite.
  const deux = Math.max(0, Math.min(AUTRES.length, reste.length - AUTRES.length));
  let servis = 0;
  AUTRES.forEach(([nom, blason], i) => {
    const id = 5 + i;
    // Mon équipe, FC Belleville et le Racing se glissent parmi les premières nées.
    if (i === 2) {
      const e = dePage(1);
      ajouter({ id: 1, nom: e.nom, initiales: e.initiales, fond: e.fond, blason: e.blason, ville: "Lille" }, e.membres.filter((x) => x.statut === "membre").map((x) => x.name), 1.3);
    }
    if (i === 4) {
      const e = dePage(2);
      ajouter({ id: 2, nom: e.nom, initiales: e.initiales, fond: e.fond, blason: e.blason, ville: "Lille" }, e.membres.map((x) => x.name), 1.2);
    }
    if (i === 7) {
      const e = dePage(3);
      ajouter({ id: 3, nom: e.nom, initiales: e.initiales, fond: e.fond, blason: e.blason, ville: "Lille" }, e.membres.map((x) => x.name), 1.05);
    }
    const joueurs = reste.slice(servis, servis + (i < deux ? 2 : 1));
    servis += joueurs.length;
    ajouter(
      { id, nom, initiales: nom === "Haubourdin 59" ? "H59" : initialesDe(nom), fond: "noir", blason },
      joueurs,
      0.7 + hasard() * 0.6
    );
  });

  // Six journées : chaque division joue la sienne (la méthode du cercle, aucune affiche deux fois).
  const d1 = equipes.slice(0, 18).map((e) => e.id);
  const d2 = equipes.slice(18).map((e) => e.id);
  const affiches: [number, number, string][] = [];
  for (const groupe of [d1, d2]) {
    const tour = [...groupe];
    JOURNEES.forEach((jour) => {
      for (let k = 0; k < tour.length / 2; k++) affiches.push([tour[k], tour[tour.length - 1 - k], jour]);
      tour.splice(1, 0, tour.pop()!);
    });
  }

  const poisson = (l: number) => {
    let k = 0;
    let p = 1;
    const seuil = Math.exp(-l);
    do {
      k++;
      p *= hasard();
    } while (p > seuil);
    return Math.min(12, k - 1);
  };
  const matchs: MatchTeam[] = [];
  let id = 100;
  for (const [de, a, jour] of affiches) {
    const tirage = hasard();
    if (tirage < 0.07) continue; // pas joué : le créneau est tombé
    id++;
    const heure = hasard() < 0.5 ? "20:00" : "21:00";
    const lieu = LIEUX[Math.floor(hasard() * LIEUX.length)];
    if (tirage < 0.1) {
      matchs.push({ id, de, a, jour, heure, lieu, statut: "forfait", forfaitDe: hasard() < 0.5 ? de : a, saisies: [], buteurs: [] });
      continue;
    }
    const fDe = force.get(de) ?? 1;
    const fA = force.get(a) ?? 1;
    const bDe = poisson(4 * fDe / fA);
    const bA = poisson(4 * fA / fDe);
    const le = (h: number) => new Date(new Date(`${jour}T${heure}:00+01:00`).getTime() + h * 3600_000).toISOString();
    matchs.push({
      id,
      de,
      a,
      jour,
      heure,
      lieu,
      statut: "accepte",
      forfaitDe: null,
      saisies: [
        { equipe: de, pour: bDe, contre: bA, le: le(1) },
        { equipe: a, pour: bA, contre: bDe, le: le(3) },
      ],
      buteurs: [...marqueurs(de, bDe), ...marqueurs(a, bA)],
    });
  }

  // Les buts d'une équipe : ses premiers joueurs marquent plus ; une passe sur deux ou trois buts.
  function marqueurs(equipe: number, buts: number): ButeurTeam[] {
    const effectif = effectifs.get(equipe) ?? [];
    if (effectif.length === 0) return [];
    const lignes = new Map<string, ButeurTeam>();
    const ligne = (name: string) => {
      const l = lignes.get(name) ?? { equipe, joueur: `demo-${name}`, name, buts: 0, passes: 0 };
      lignes.set(name, l);
      return l;
    };
    const poids = effectif.map((_, i) => (i === 0 ? 3 : i === 1 ? 2 : 1));
    const total = poids.reduce((s, p) => s + p, 0);
    const tirer = (sauf?: string) => {
      for (let essai = 0; essai < 4; essai++) {
        let r = hasard() * total;
        const i = poids.findIndex((p) => (r -= p) < 0);
        const n = effectif[Math.max(0, i)];
        if (n !== sauf) return n;
      }
      return effectif.find((n) => n !== sauf) ?? null;
    };
    // Les équipes du seul championnat n'ont qu'un ou deux joueurs connus : une partie de leurs buts reste sans nom.
    const connu = effectif.length >= 5 ? 1 : 0.55;
    for (let k = 0; k < buts; k++) {
      if (hasard() > connu) continue;
      const n = tirer();
      if (!n) continue;
      ligne(n).buts++;
      if (hasard() < 0.65) {
        const p = tirer(n);
        if (p) ligne(p).passes++;
      }
    }
    return [...lignes.values()];
  }

  // Mes deux feuilles en cours : celle d'hier soir, à remplir, et celle de samedi, que le Racing a déjà remplie.
  matchs.push({
    id: 98,
    de: 2,
    a: 1,
    jour: "2026-12-14",
    heure: "20:00",
    lieu: "Five Lille Sud",
    statut: "accepte",
    forfaitDe: null,
    saisies: [],
    buteurs: [],
  });
  matchs.push({
    id: 99,
    de: 1,
    a: 3,
    jour: "2026-12-12",
    heure: "19:00",
    lieu: "Urban Lomme",
    statut: "accepte",
    forfaitDe: null,
    saisies: [{ equipe: 3, pour: 3, contre: 5, le: "2026-12-15T09:00:00Z" }],
    buteurs: [{ equipe: 3, joueur: `demo-${effectifs.get(3)?.[0] ?? "?"}`, name: effectifs.get(3)?.[0] ?? "?", buts: 2, passes: 0 }],
  });
  return { equipes, matchs, maintenant: MAINTENANT_DEMO, effectifs };
}

/**
 * Toutes les équipes de la démonstration, avec leurs joueurs : celles de la
 * page Team, puis celles du seul championnat (leurs un ou deux joueurs
 * connus, le premier capitaine). La page d'une équipe et le profil des
 * joueurs s'en servent.
 */
export function demoToutesEquipes(noms: string[], moi: string): Equipe[] {
  const page = demoEquipes(noms, moi).equipes;
  const c = demoChampionnat(noms, moi);
  const autres = c.equipes
    .filter((e) => !page.some((p) => p.id === e.id))
    .map((e): Equipe => {
      const joueurs = c.effectifs.get(e.id) ?? [];
      return {
        id: e.id,
        nom: e.nom,
        initiales: e.initiales,
        fond: e.fond,
        ville: e.ville,
        capitaine: joueurs[0] ? `demo-${joueurs[0]}` : null,
        membres: joueurs.map((name, i) => ({
          id: `demo-${name}`,
          name,
          statut: "membre",
          role: i === 0 ? "capitaine" : i === 1 ? "vice" : "membre",
          reglement: "v2",
        })),
        blason: e.blason,
        couvertureLe: null,
      };
    });
  return [...page, ...autres];
}

/** Une invitation à l'ouverture, pour la voir en développement (invitation-carte.tsx, ?invitation=equipe) : FC Belleville m'invite. */
export function demoInvitation(noms: string[], moi: string): { equipes: Equipe[]; moi: string } {
  const e = demoEquipes(noms, moi).equipes[1];
  e.membres.push({
    id: `demo-${moi}`,
    name: moi,
    role: "membre",
    statut: "invite",
    depuis: new Date(Date.now() - 5 * 3600_000).toISOString(),
    invitePar: e.membres[1]?.id ?? e.capitaine,
    reglement: null,
  });
  return { equipes: [e], moi: `demo-${moi}` };
}
