
import { describe, expect, it } from "vitest";

import { createDeck } from "./deck.js";
import { createGame } from "./setup.js";
import { ROLES } from "./types.js";

describe("Coup deck", () => {
  it("contains exactly 15 cards", () => {
    const deck = createDeck();

    expect(deck).toHaveLength(15);
  });

  it("contains three copies of each character", () => {
    const deck = createDeck();

    for (const role of ROLES) {
      const count = deck.filter(
        (card) => card === role
      ).length;

      expect(count).toBe(3);
    }
  });
});

describe("Game initialization", () => {
  it("gives every player two cards and two coins", () => {
    const game = createGame([
      { id: "1", name: "Alfie" },
      { id: "2", name: "Diana" },
      { id: "3", name: "Alex" },
    ]);

    expect(game.players).toHaveLength(3);

    for (const player of game.players) {
      expect(player.hand).toHaveLength(2);
      expect(player.coins).toBe(2);
      expect(player.revealed).toHaveLength(0);
    }

    expect(game.deck).toHaveLength(9);
    expect(game.currentPlayerIndex).toBe(0);
    expect(game.phase).toBe("turn_start");
  });

  it("rejects games with fewer than 2 players", () => {
    expect(() =>
      createGame([{ id: "1", name: "Alfie" }])
    ).toThrow();
  });

  it("rejects games with more than 6 players", () => {
    const players = Array.from(
      { length: 7 },
      (_, index) => ({
        id: String(index),
        name: `Player ${index}`,
      })
    );

    expect(() => createGame(players)).toThrow();
  });

  it("rejects duplicate player IDs", () => {
    expect(() =>
      createGame([
        { id: "1", name: "Alfie" },
        { id: "1", name: "Diana" },
      ])
    ).toThrow();
  });
});
