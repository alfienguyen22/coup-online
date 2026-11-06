import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";

import {
  takeCoup,
  resolveCoupInfluenceLoss,
  declareAssassination,
  declareSteal,
  declareExchange,
} from "./actions.js";

import {
  respondToClaim,
  resolveClaimInfluenceLoss,
} from "./challenges.js";

import type { GameState } from "./types.js";


function twoPlayerGame(): GameState {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
  ]);
}


describe("Full game engine audit", () => {
  it("declares a winner when Coup eliminates the final opponent", () => {
    const game = twoPlayerGame();

    game.players[0].coins = 7;
    game.players[1].hand = ["Duke"];

    let updated = takeCoup(
      game,
      "1",
      "2"
    );

    updated = resolveCoupInfluenceLoss(
      updated,
      "2",
      "Duke"
    );

    expect(updated.players[1].hand).toHaveLength(0);

    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
  });


  it("declares a winner when a false character claim eliminates the claimant", () => {
    const game = twoPlayerGame();

    // Alfie has only one influence and is bluffing Assassin.
    game.players[0].hand = ["Duke"];
    game.players[0].coins = 3;

    let updated = declareAssassination(
      game,
      "1",
      "2"
    );

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    updated = resolveClaimInfluenceLoss(
      updated,
      "1",
      "Duke"
    );

    expect(updated.players[0].hand).toHaveLength(0);
    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("2");
  });


  it("ends the game immediately when a truthful Assassin challenge eliminates the final opponent", () => {
    const game = twoPlayerGame();

    game.players[0].hand = [
      "Assassin",
      "Captain",
    ];

    game.players[0].coins = 3;

    // Diana has only one influence.
    game.players[1].hand = ["Duke"];

    let updated = declareAssassination(
      game,
      "1",
      "2"
    );

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    updated = resolveClaimInfluenceLoss(
      updated,
      "2",
      "Duke"
    );

    expect(updated.players[1].hand).toHaveLength(0);

    // The challenge itself ended the game.
    // We should NOT continue into a Contessa block window.
    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
    expect(updated.pendingAction).toBeNull();
  });


  it("ends the game immediately when a truthful Captain challenge eliminates the final opponent", () => {
    const game = twoPlayerGame();

    game.players[0].hand = [
      "Captain",
      "Duke",
    ];

    game.players[1].hand = ["Contessa"];

    let updated = declareSteal(
      game,
      "1",
      "2"
    );

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    updated = resolveClaimInfluenceLoss(
      updated,
      "2",
      "Contessa"
    );

    expect(updated.players[1].hand).toHaveLength(0);

    // Do not continue into the Steal blocking phase.
    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
    expect(updated.pendingAction).toBeNull();
  });


  it("ends the game immediately when a truthful Ambassador challenge eliminates the final opponent", () => {
    const game = twoPlayerGame();

    game.players[0].hand = [
      "Ambassador",
      "Duke",
    ];

    game.players[1].hand = ["Captain"];

    let updated = declareExchange(
      game,
      "1"
    );

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    updated = resolveClaimInfluenceLoss(
      updated,
      "2",
      "Captain"
    );

    expect(updated.players[1].hand).toHaveLength(0);

    // We should not enter exchange_selection
    // after the opponent has already been eliminated.
    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
    expect(updated.pendingAction).toBeNull();
  });
});