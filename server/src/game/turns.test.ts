import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";

import {
  finishTurn,
  getCurrentPlayer,
  isPlayerAlive,
} from "./turns.js";

import type { GameState } from "./types.js";


function testGame(): GameState {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}


describe("Turn management audit", () => {
  it("returns the current player", () => {
    const game = testGame();

    const player = getCurrentPlayer(game);

    expect(player.id).toBe("1");
    expect(player.name).toBe("Alfie");
  });


  it("recognizes living and eliminated players", () => {
    const game = testGame();

    expect(
      isPlayerAlive(game.players[0])
    ).toBe(true);

    game.players[1].hand = [];

    expect(
      isPlayerAlive(game.players[1])
    ).toBe(false);
  });


  it("advances to the next living player", () => {
    const game = testGame();

    const updated = finishTurn(game);

    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.phase).toBe("turn_start");
    expect(updated.pendingAction).toBeNull();
  });


  it("skips eliminated players", () => {
    const game = testGame();

    // Diana has been eliminated.
    game.players[1].hand = [];

    const updated = finishTurn(game);

    // Alfie → skip Diana → Alex
    expect(updated.currentPlayerIndex).toBe(2);
    expect(updated.players[2].id).toBe("3");
  });


  it("wraps around to the beginning of the player list", () => {
    const game = testGame();

    // Alex is currently playing.
    game.currentPlayerIndex = 2;

    const updated = finishTurn(game);

    // Alex → Alfie
    expect(updated.currentPlayerIndex).toBe(0);
    expect(updated.players[0].id).toBe("1");
  });


  it("wraps around while skipping eliminated players", () => {
    const game = testGame();

    game.currentPlayerIndex = 2;

    // Alfie is eliminated.
    game.players[0].hand = [];

    const updated = finishTurn(game);

    // Alex → skip Alfie → Diana
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.players[1].id).toBe("2");
  });


  it("clears a pending action when the turn finishes", () => {
    const game = testGame();

    game.phase = "claim_response";

    game.pendingAction = {
      type: "claim",
      action: "tax",
      actorId: "1",
      claimedRole: "Duke",
      passedPlayerIds: [],
      challenge: null,
    };

    const updated = finishTurn(game);

    expect(updated.phase).toBe("turn_start");
    expect(updated.pendingAction).toBeNull();
  });


  it("declares a winner when only one player remains", () => {
    const game = testGame();

    // Diana and Alex are eliminated.
    game.players[1].hand = [];
    game.players[2].hand = [];

    const updated = finishTurn(game);

    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
    expect(updated.pendingAction).toBeNull();
  });


  it("throws when no living players remain", () => {
    const game = testGame();

    game.players[0].hand = [];
    game.players[1].hand = [];
    game.players[2].hand = [];

    expect(() =>
      finishTurn(game)
    ).toThrow(
      "No living players remain."
    );
  });


  it("does not mutate the original game state", () => {
    const game = testGame();

    const originalIndex =
      game.currentPlayerIndex;

    const originalPhase =
      game.phase;

    const updated = finishTurn(game);

    expect(game.currentPlayerIndex).toBe(
      originalIndex
    );

    expect(game.phase).toBe(
      originalPhase
    );

    expect(updated.currentPlayerIndex).toBe(1);
  });
});