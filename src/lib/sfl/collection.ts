"use client";

// Collection de cartes SFL — catalogue numéroté, packs booster et boutique.
// Possession stockée en localStorage par profil (v1 locale).
//
// Catalogue : chaque joueur existe en Standard et en Rare (numérotées
// 1..2N "sur 2N"). Les joueurs titrés ont en plus des cartes spéciales
// hors-série (Défensive, Impact, MVP) numérotées AU-DELÀ du total — des
// n° impossibles type "71/64" — aux taux d'obtention très faibles.

import { PLAYERS } from "./data";
import type { BoostType, Player } from "./engine";
import { debit } from "./ballons";

export const PACK_COST = 7;
export const PACK_SIZE = 4;

export type CardKind = "simple" | "rare" | BoostType;

export interface CollectionCard {
  id: string; // ex. "simple-Smail", "mvp-Ilies"
  kind: CardKind;
  player: Player;
  serial: number; // numéro de la carte
  total: number; // total affiché ("serial/total" — serial > total pour les spéciales)
  price: number; // prix boutique en Ballons
}

export const CARD_PRICES: Record<CardKind, number> = {
  simple: 15,
  rare: 40,
  def: 800,
  impact: 1500,
  mvp: 2500,
};

// Probabilités de tirage d'une carte de pack (somme = 1).
const DROP_RATES: [CardKind, number][] = [
  ["simple", 0.715],
  ["rare", 0.26],
  ["def", 0.015],
  ["impact", 0.008],
  ["mvp", 0.002],
];

function buildCatalog(): CollectionCard[] {
  const n = PLAYERS.length;
  const total = n * 2;
  const cards: CollectionCard[] = [];

  PLAYERS.forEach((p, i) => {
    cards.push({ id: `simple-${p.name}`, kind: "simple", player: p, serial: i + 1, total, price: CARD_PRICES.simple });
  });
  PLAYERS.forEach((p, i) => {
    cards.push({ id: `rare-${p.name}`, kind: "rare", player: p, serial: n + i + 1, total, price: CARD_PRICES.rare });
  });

  // Hors-série — numéros volontairement au-delà du total du catalogue.
  let serial = total + 5;
  for (const p of PLAYERS.filter((p) => p.def > 0)) {
    cards.push({ id: `def-${p.name}`, kind: "def", player: p, serial, total, price: CARD_PRICES.def });
    serial += 2;
  }
  serial += 6;
  for (const p of PLAYERS.filter((p) => p.impact > 0)) {
    cards.push({ id: `impact-${p.name}`, kind: "impact", player: p, serial, total, price: CARD_PRICES.impact });
    serial += 3;
  }
  serial += 9;
  for (const p of PLAYERS.filter((p) => p.mvp > 0)) {
    cards.push({ id: `mvp-${p.name}`, kind: "mvp", player: p, serial, total, price: CARD_PRICES.mvp });
    serial += 5;
  }
  return cards;
}

export const CATALOG: CollectionCard[] = buildCatalog();
export const CATALOG_BY_ID = new Map(CATALOG.map((c) => [c.id, c]));

export const KIND_LABELS: Record<CardKind, string> = {
  simple: "Standard",
  rare: "Rare",
  def: "Défensive",
  impact: "Impact",
  mvp: "MVP",
};

/* ---------------- Possession ---------------- */

export type Owned = Record<string, number>; // cardId -> exemplaires

function ownedKey(voter: string) {
  return `sfl-collection-${voter}`;
}

export function getOwned(voter: string): Owned {
  try {
    return JSON.parse(localStorage.getItem(ownedKey(voter)) ?? "{}");
  } catch {
    return {};
  }
}

function addCards(voter: string, ids: string[]) {
  const owned = getOwned(voter);
  for (const id of ids) owned[id] = (owned[id] ?? 0) + 1;
  localStorage.setItem(ownedKey(voter), JSON.stringify(owned));
  window.dispatchEvent(new Event("sfl-collection"));
}

/* ---------------- Packs & boutique ---------------- */

function drawKind(): CardKind {
  let r = Math.random();
  for (const [kind, p] of DROP_RATES) {
    if (r < p) return kind;
    r -= p;
  }
  return "simple";
}

function drawCard(): CollectionCard {
  const kind = drawKind();
  const pool = CATALOG.filter((c) => c.kind === kind);
  // Les spéciales n'existent que pour les titrés — pool jamais vide pour
  // simple/rare, et on retombe sur rare si un pool spécial était vide.
  const usable = pool.length > 0 ? pool : CATALOG.filter((c) => c.kind === "rare");
  return usable[Math.floor(Math.random() * usable.length)];
}

// Ouvre un pack : débite PACK_COST et renvoie les cartes tirées,
// ou null si le solde est insuffisant.
export function openPack(voter: string): CollectionCard[] | null {
  if (!debit(voter, PACK_COST, "Pack booster")) return null;
  const cards = Array.from({ length: PACK_SIZE }, () => drawCard());
  addCards(
    voter,
    cards.map((c) => c.id)
  );
  return cards;
}

// Achat direct d'une carte en boutique. false si solde insuffisant.
export function buyCard(voter: string, cardId: string): boolean {
  const card = CATALOG_BY_ID.get(cardId);
  if (!card) return false;
  if (!debit(voter, card.price, `Boutique — ${KIND_LABELS[card.kind]} ${card.player.name}`)) {
    return false;
  }
  addCards(voter, [cardId]);
  return true;
}
