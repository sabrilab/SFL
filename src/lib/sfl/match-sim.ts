"use client";

// Simulation de match — chaque joueur compose un deck de 5 cartes issues
// de sa collection (packs ouverts) et lance des matchs en asynchrone
// contre les decks préparés par les autres profils. V1 locale : les decks
// adverses sont ceux enregistrés sur cet appareil, sinon un deck généré.

import { PLAYERS } from "./data";
import { ovr } from "./engine";
import { CATALOG, CATALOG_BY_ID, type CollectionCard } from "./collection";

export const DECK_SIZE = 5;

// Bonus de puissance par type de carte — les hors-série pèsent lourd,
// c'est tout l'intérêt de les chasser en pack.
const KIND_BONUS: Record<string, number> = {
  simple: 0,
  rare: 2,
  def: 5,
  impact: 7,
  mvp: 10,
};

function deckKey(voter: string) {
  return `sfl-deck-${voter}`;
}

export function getDeck(voter: string): string[] {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(deckKey(voter)) ?? "[]");
    return ids.filter((id) => CATALOG_BY_ID.has(id));
  } catch {
    return [];
  }
}

export function saveDeck(voter: string, ids: string[]) {
  localStorage.setItem(deckKey(voter), JSON.stringify(ids.slice(0, DECK_SIZE)));
}

export function cardPower(card: CollectionCard): number {
  return ovr(card.player.stats) + (KIND_BONUS[card.kind] ?? 0);
}

export function deckPower(cards: CollectionCard[]): number {
  if (cards.length === 0) return 0;
  return Math.round(cards.reduce((a, c) => a + cardPower(c), 0) / cards.length);
}

export interface OpponentDeck {
  owner: string;
  cards: CollectionCard[];
  generated: boolean; // true = deck par défaut (l'adversaire n'a rien préparé)
}

// Cherche un deck préparé par un autre profil sur cet appareil ; à défaut,
// génère un deck plausible pour un adversaire au hasard.
export function pickOpponentDeck(me: string): OpponentDeck {
  const withDecks = PLAYERS.map((p) => p.name)
    .filter((name) => name !== me)
    .map((name) => ({ name, ids: getDeck(name) }))
    .filter((d) => d.ids.length === DECK_SIZE);

  if (withDecks.length > 0) {
    const pick = withDecks[Math.floor(Math.random() * withDecks.length)];
    return {
      owner: pick.name,
      cards: pick.ids.map((id) => CATALOG_BY_ID.get(id)!),
      generated: false,
    };
  }

  const others = PLAYERS.filter((p) => p.name !== me);
  const owner = others[Math.floor(Math.random() * others.length)].name;
  // Deck par défaut : 5 cartes du catalogue, à dominante Standard/Rare.
  const pool = CATALOG.filter((c) => c.kind === "simple" || c.kind === "rare");
  const cards: CollectionCard[] = [];
  const used = new Set<string>();
  while (cards.length < DECK_SIZE) {
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (!used.has(c.id)) {
      used.add(c.id);
      cards.push(c);
    }
  }
  return { owner, cards, generated: true };
}

export interface MatchEvent {
  minute: number;
  team: "me" | "opp";
  scorer: string;
}

export interface MatchResult {
  scoreMe: number;
  scoreOpp: number;
  events: MatchEvent[];
  powerMe: number;
  powerOpp: number;
}

// Tire un buteur dans un deck, pondéré par la stat de TIR de la carte.
function drawScorer(cards: CollectionCard[]): string {
  const weights = cards.map((c) => c.player.stats.TIR);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < cards.length; i++) {
    if (r < weights[i]) return cards[i].player.name;
    r -= weights[i];
  }
  return cards[cards.length - 1].player.name;
}

/**
 * `formeBonus` : l'écart de forme réelle entre les deux propriétaires de deck
 * (points Pépite de la saison), déjà ramené à quelques points. Les cartes
 * décident d'abord, le classement de la vraie ligue fait pencher la balance.
 */
export function simulateMatch(
  mine: CollectionCard[],
  opp: CollectionCard[],
  formeBonus = 0
): MatchResult {
  const powerMe = deckPower(mine);
  const powerOpp = deckPower(opp);
  // Espérance de buts : base 2.3, modulée par l'écart de puissance des decks
  // puis par la forme réelle des deux joueurs.
  const diff = powerMe - powerOpp + formeBonus;
  const expMe = Math.max(0.4, 2.3 + diff / 14);
  const expOpp = Math.max(0.4, 2.3 - diff / 14);

  const events: MatchEvent[] = [];
  // 10 occasions par équipe sur 50 minutes de five.
  for (let i = 0; i < 10; i++) {
    if (Math.random() < expMe / 10) {
      events.push({ minute: 3 + Math.floor(Math.random() * 47), team: "me", scorer: drawScorer(mine) });
    }
    if (Math.random() < expOpp / 10) {
      events.push({ minute: 3 + Math.floor(Math.random() * 47), team: "opp", scorer: drawScorer(opp) });
    }
  }
  events.sort((a, b) => a.minute - b.minute);

  return {
    scoreMe: events.filter((e) => e.team === "me").length,
    scoreOpp: events.filter((e) => e.team === "opp").length,
    events,
    powerMe,
    powerOpp,
  };
}
