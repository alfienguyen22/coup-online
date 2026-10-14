
import { randomInt } from "node:crypto";
import { ROLES, type Role } from "./types.js";

// Create a standard Coup deck.
// There are three copies of each character.
export function createDeck(): Role[] {
  const deck: Role[] = [];

  for (const role of ROLES) {
    for (let i = 0; i < 3; i++) {
      deck.push(role);
    }
  }

  return deck;
}

// Shuffle using the Fisher-Yates algorithm.
export function shuffleDeck(deck: Role[]): Role[] {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);

    [shuffled[i], shuffled[j]] = [
      shuffled[j],
      shuffled[i],
    ];
  }

  return shuffled;
}
