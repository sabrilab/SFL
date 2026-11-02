// Les données de démo de l'XP (tools/xp-calcul-check.ts, xp-acquis-check.ts) :
// une saison de six dimanches joués, Ilyes au Niveau XP 6 et au palier 13 de
// la Saison 1, ses réponses aux missions. Des données de test, jamais en base.
import { seedSaison } from "../src/lib/sfl/saisie/store";
import { poserEquipes, updateJournee, ajouterTerrain, libelleCourt } from "../src/lib/sfl/saisie/mutations";
import { labelDateFr } from "../src/lib/sfl/convocation-temps";
import type { Saison } from "../src/lib/sfl/saisie/types";
import type { Reponse } from "../src/lib/sfl/missions";

export const N1 = ["Ilyes", "Kader", "Anis", "Yanis", "Omar"];
export const B1 = ["Badis", "Sofiane", "Marwan", "Mehdi", "Naim"];
export const N2 = ["Adil", "Ayman", "Azzedine", "Franz", "Ibrahim"];
export const B2 = ["Moussa", "Rezki", "Ryad", "Sidali", "Smail"];

const JOUR = 86400_000;
const jour = (t0: number, decalage: number) => libelleCourt(labelDateFr(new Date(t0 + decalage * JOUR)));

/** Les journées jouées : décalages en jours depuis maintenant (12 dimanches, du 9 août au 25 oct.). */
export const DECALAGES = [-84, -77, -70, -63, -56, -49, -42, -35, -28, -21, -14, -7];

export function saisonDemoXp(maintenant: number, sc: string): Saison {
  void sc; // le scénario ne change que les réponses (reponsesDemoXp)
  // Les dimanches à midi (UTC) : le passage à l'heure d'hiver ne décale pas leur date.
  const t0 = new Date(maintenant).setUTCHours(12, 0, 0, 0);
  let s: Saison = { ...seedSaison(), numero: 1, journees: [], entries: [], convocations: [] };
  s = ajouterTerrain(s, { nom: "Hippodrome", adresse: "Marcq-en-Barœul", lat: 50.66, lng: 3.08, commune: "MARCQ" });
  s = { ...s, terrains: (s.terrains ?? []).map((t) => ({ ...t, defaut: true })) };
  const teams = [
    { name: "Noirs 1", players: N1 },
    { name: "Blancs 1", players: B1 },
    { name: "Noirs 2", players: N2 },
    { name: "Blancs 2", players: B2 },
  ];
  const decalages = DECALAGES.slice(-6);
  decalages.forEach((d, k) => {
    const j = s.journees.length + 1;
    s = poserEquipes(s, j, teams, jour(t0, d));
    s = updateJournee(s, j, { heure: "12h30", terrainId: 1, mvpAuto: true } as never);
    // Les Noirs gagnent deux fois sur trois ; Ilyes marque et passe souvent.
    const noirsGagnent = k % 3 !== 1;
    s = {
      ...s,
      entries: s.entries.map((e) => {
        if (e.j !== j) return e;
        const noir = e.team?.startsWith("Noirs");
        const result = noir ? (noirsGagnent ? "Victoire" : "Défaite") : noirsGagnent ? "Défaite" : "Victoire";
        const buts = e.player === "Ilyes" ? 1 + (k % 2) : e.player === B1[k % 5] ? 1 : e.player === N2[k % 5] ? 2 : 0;
        const passes = e.player === "Ilyes" ? (k % 4 === 0 ? 2 : 1) : e.player === N1[(k + 2) % 5] ? 1 : 0;
        return { ...e, result, buts, passes };
      }),
    };
  });
  return s;
}

/** Ce qu'Ilyes a signé : le contrat et le défi de quelques dimanches (bien avant le coup d'envoi). */
export const SIGNES: Record<number, ("contrat" | "defi")[]> = { 3: ["defi"], 5: ["contrat"], 6: ["defi"], 8: ["contrat"] };

/** Les réponses d'Ilyes ; « sans-missions » : aucune (ce qu'un appareil sans ses réponses calcule). */
export function reponsesDemoXp(s: Saison, sc: string): Reponse[] {
  if (sc === "sans-missions") return [];
  const out: Reponse[] = [];
  for (const m of s.journees) {
    for (const mission of SIGNES[m.j] ?? []) {
      out.push({ saison: s.numero ?? 1, j: m.j, mission, joueur: "Ilyes", reponse: "acceptee", cible: null, le: "2026-01-01T00:00:00.000Z" });
    }
  }
  return out;
}
