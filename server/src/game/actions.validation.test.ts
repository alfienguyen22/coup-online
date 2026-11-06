import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";

import {
  takeIncome,
  declareForeignAid,
  declareAssassination,
  declareSteal,
  declareExchange,
} from "./actions.js";

import type { GameState } from "./types.js";

function testGame(): GameState {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}

describe("Turn action validation audit", () => {
  it("allows the current living player to act", () => {
    const game = testGame();

    expect(() =>
      takeIncome(game, "1")
    ).not.toThrow();
  });

  it("prevents another player from acting out of turn", () => {
    const game = testGame();

    expect(() =>
      takeIncome(game, "2")
    ).toThrow();
  });

  it("prevents an eliminated current player from acting", () => {
    const game = testGame();

    game.players[0].hand = [];

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();
  });

  it("prevents actions while another action is pending", () => {
    let game = testGame();

    game = declareForeignAid(game, "1");

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();

    expect(() =>
      declareExchange(game, "1")
    ).toThrow();
  });

  it("forces Coup at 10 or more coins instead of Income", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();
  });

  it("forces Coup at 10 or more coins instead of Foreign Aid", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareForeignAid(game, "1")
    ).toThrow();
  });

  it("forces Coup at 10 or more coins instead of Assassination", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();
  });

  it("forces Coup at 10 or more coins instead of Steal", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();
  });

  it("forces Coup at 10 or more coins instead of Exchange", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareExchange(game, "1")
    ).toThrow();
  });

  it("does not mutate the original game when validation fails", () => {
    const game = testGame();

    game.players[0].coins = 10;

    const originalCoins =
      game.players[0].coins;

    const originalPhase =
      game.phase;

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();

    expect(game.players[0].coins).toBe(
      originalCoins
    );

    expect(game.phase).toBe(
      originalPhase
    );

    expect(game.pendingAction).toBeNull();
  });
});