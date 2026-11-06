import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";
import { loseInfluence } from "./influence.js";

import type {
  GameState,
  Role,
} from "./types.js";


function testGame(): GameState {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}


describe("Influence management audit", () => {
  it("removes exactly one chosen influence", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Captain",
    ];

    const updated = loseInfluence(
      game,
      "1",
      "Duke"
    );

    expect(updated.players[0].hand).toEqual([
      "Captain",
    ]);

    expect(updated.players[0].revealed).toEqual([
      "Duke",
    ]);
  });


  it("can remove the second card in a hand", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Captain",
    ];

    const updated = loseInfluence(
      game,
      "1",
      "Captain"
    );

    expect(updated.players[0].hand).toEqual([
      "Duke",
    ]);

    expect(updated.players[0].revealed).toEqual([
      "Captain",
    ]);
  });


  it("handles duplicate roles correctly", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Duke",
    ];

    const updated = loseInfluence(
      game,
      "1",
      "Duke"
    );

    // Only one Duke should be removed.
    expect(updated.players[0].hand).toEqual([
      "Duke",
    ]);

    expect(updated.players[0].revealed).toEqual([
      "Duke",
    ]);
  });


  it("preserves previously revealed influence", () => {
    const game = testGame();

    game.players[0].hand = [
      "Captain",
    ];

    game.players[0].revealed = [
      "Duke",
    ];

    const updated = loseInfluence(
      game,
      "1",
      "Captain"
    );

    expect(updated.players[0].hand).toHaveLength(0);

    expect(updated.players[0].revealed).toEqual([
      "Duke",
      "Captain",
    ]);
  });


  it("rejects revealing a card not in the player's hand", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Captain",
    ];

    expect(() =>
      loseInfluence(
        game,
        "1",
        "Contessa"
      )
    ).toThrow();
  });


  it("rejects an unknown player", () => {
    const game = testGame();

    expect(() =>
      loseInfluence(
        game,
        "999",
        "Duke"
      )
    ).toThrow();
  });


  it("rejects influence loss for an already eliminated player", () => {
    const game = testGame();

    game.players[0].hand = [];

    expect(() =>
      loseInfluence(
        game,
        "1",
        "Duke"
      )
    ).toThrow();
  });


  it("does not change other players", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Captain",
    ];

    const playerTwoBefore = {
      ...game.players[1],
      hand: [...game.players[1].hand],
      revealed: [...game.players[1].revealed],
    };

    const updated = loseInfluence(
      game,
      "1",
      "Duke"
    );

    expect(updated.players[1]).toEqual(
      playerTwoBefore
    );
  });


  it("does not mutate the original game", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Captain",
    ];

    const originalHand = [
      ...game.players[0].hand,
    ];

    const originalRevealed = [
      ...game.players[0].revealed,
    ];

    const updated = loseInfluence(
      game,
      "1",
      "Duke"
    );

    expect(game.players[0].hand).toEqual(
      originalHand
    );

    expect(game.players[0].revealed).toEqual(
      originalRevealed
    );

    expect(updated.players[0].hand).toEqual([
      "Captain",
    ]);
  });


  it("does not advance the turn by itself", () => {
    const game = testGame();

    const originalIndex =
      game.currentPlayerIndex;

    const updated = loseInfluence(
      game,
      "1",
      game.players[0].hand[0] as Role
    );

    expect(updated.currentPlayerIndex).toBe(
      originalIndex
    );

    expect(updated.phase).toBe(game.phase);
  });
});