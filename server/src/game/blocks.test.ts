
import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";

import {
  declareForeignAid,
  respondToForeignAid,
  takeIncome,
} from "./actions.js";

import {
  respondToForeignAidBlock,
  resolveForeignAidBlockInfluenceLoss,
} from "./blocks.js";

import type { GameState } from "./types.js";

function testGame(): GameState {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}

// Helper: start a Foreign Aid action,
// then have Diana claim Duke to block it.
function blockedGame(
  initialGame: GameState = testGame()
): GameState {
  let game = declareForeignAid(initialGame, "1");
  game = respondToForeignAid(game, "2", "block");

  return game;
}

describe("Foreign Aid blocking", () => {
  it("opens a challenge window after a Duke block", () => {
    const game = blockedGame();

    expect(game.phase).toBe(
      "foreign_aid_block_challenge"
    );

    expect(game.pendingAction).toMatchObject({
      type: "foreign_aid",
      actorId: "1",
      blockerId: "2",
      blockPassedPlayerIds: [],
      blockChallenge: null,
    });

    // No coins have been awarded yet.
    expect(game.players[0].coins).toBe(2);
  });

  it("waits while other players can still challenge", () => {
    let game = blockedGame();

    game = respondToForeignAidBlock(
      game,
      "1",
      "pass"
    );

    expect(game.phase).toBe(
      "foreign_aid_block_challenge"
    );

    expect(game.pendingAction).toMatchObject({
      blockPassedPlayerIds: ["1"],
    });

    expect(game.players[0].coins).toBe(2);
  });

  it("accepts the block when everyone passes", () => {
    let game = blockedGame();

    game = respondToForeignAidBlock(
      game,
      "1",
      "pass"
    );

    game = respondToForeignAidBlock(
      game,
      "3",
      "pass"
    );

    // The block succeeds.
    expect(game.players[0].coins).toBe(2);

    // The turn advances.
    expect(game.phase).toBe("turn_start");
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.pendingAction).toBeNull();
  });

  it("allows the acting player to challenge a block", () => {
    const game = blockedGame();

    const updated = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    expect(updated.phase).toBe(
      "foreign_aid_block_influence_loss"
    );

    expect(updated.pendingAction).toMatchObject({
      type: "foreign_aid",
      blockChallenge: {
        challengerId: "1",
      },
    });
  });

  it("allows a player who passed on Foreign Aid to challenge the block", () => {
    let game = declareForeignAid(
      testGame(),
      "1"
    );

    // Alex initially passes on Foreign Aid.
    game = respondToForeignAid(
      game,
      "3",
      "pass"
    );

    // Diana claims Duke.
    game = respondToForeignAid(
      game,
      "2",
      "block"
    );

    // Alex can still challenge Diana's block.
    game = respondToForeignAidBlock(
      game,
      "3",
      "challenge"
    );

    expect(game.pendingAction).toMatchObject({
      blockChallenge: {
        challengerId: "3",
      },
    });
  });

  it("resolves a truthful Duke block", () => {
    const initial = testGame();

    // Diana really has Duke.
    initial.players[1].hand = [
      "Duke",
      "Assassin",
    ];

    let game = blockedGame(initial);

    const originalDeckSize = game.deck.length;

    // Alfie challenges Diana.
    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    expect(game.pendingAction).toMatchObject({
      blockChallenge: {
        challengerId: "1",
        claimantWasTruthful: true,
      },
    });

    // Diana demonstrated Duke and drew a replacement.
    expect(game.players[1].hand).toHaveLength(2);
    expect(game.players[1].hand).toContain("Assassin");
    expect(game.players[1].revealed).toHaveLength(0);
    expect(game.deck).toHaveLength(originalDeckSize);

    // Alfie loses the challenge and reveals a card.
    const cardToLose = game.players[0].hand[0];

    game = resolveForeignAidBlockInfluenceLoss(
      game,
      "1",
      cardToLose
    );

    expect(game.players[0].hand).toHaveLength(1);
    expect(game.players[0].revealed).toContain(
      cardToLose
    );

    // Foreign Aid fails.
    expect(game.players[0].coins).toBe(2);
    expect(game.phase).toBe("turn_start");
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.pendingAction).toBeNull();
  });

  it("resolves a false Duke block", () => {
    const initial = testGame();

    // Diana is bluffing.
    initial.players[1].hand = [
      "Assassin",
      "Contessa",
    ];

    let game = blockedGame(initial);

    // Alfie challenges Diana's block.
    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    expect(game.pendingAction).toMatchObject({
      blockChallenge: {
        challengerId: "1",
        claimantWasTruthful: false,
      },
    });

    // Diana must lose influence.
    game = resolveForeignAidBlockInfluenceLoss(
      game,
      "2",
      "Assassin"
    );

    expect(game.players[1].hand).toEqual([
      "Contessa",
    ]);

    expect(game.players[1].revealed).toEqual([
      "Assassin",
    ]);

    // The block failed, so Alfie gains 2 coins.
    expect(game.players[0].coins).toBe(4);
    expect(game.phase).toBe("turn_start");
    expect(game.currentPlayerIndex).toBe(1);
  });

  it("prevents the blocker from responding to their own block", () => {
    const game = blockedGame();

    expect(() =>
      respondToForeignAidBlock(
        game,
        "2",
        "pass"
      )
    ).toThrow();

    expect(() =>
      respondToForeignAidBlock(
        game,
        "2",
        "challenge"
      )
    ).toThrow();
  });

  it("prevents responding twice", () => {
    let game = blockedGame();

    game = respondToForeignAidBlock(
      game,
      "1",
      "pass"
    );

    expect(() =>
      respondToForeignAidBlock(
        game,
        "1",
        "pass"
      )
    ).toThrow();

    expect(() =>
      respondToForeignAidBlock(
        game,
        "1",
        "challenge"
      )
    ).toThrow();
  });

  it("prevents eliminated players from responding", () => {
    const initial = testGame();

    initial.players[2].hand = [];

    const game = blockedGame(initial);

    expect(() =>
      respondToForeignAidBlock(
        game,
        "3",
        "challenge"
      )
    ).toThrow();
  });

  it("rejects responses when no block exists", () => {
    const game = declareForeignAid(
      testGame(),
      "1"
    );

    expect(() =>
      respondToForeignAidBlock(
        game,
        "2",
        "challenge"
      )
    ).toThrow();
  });

  it("only allows the losing player to reveal influence", () => {
    const initial = testGame();

    initial.players[1].hand = [
      "Duke",
      "Assassin",
    ];

    let game = blockedGame(initial);

    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    // Alfie lost the challenge, not Alex.
    expect(() =>
      resolveForeignAidBlockInfluenceLoss(
        game,
        "3",
        game.players[2].hand[0]
      )
    ).toThrow();
  });

  it("rejects revealing a card not in the player's hand", () => {
    const initial = testGame();

    initial.players[1].hand = [
      "Captain",
      "Contessa",
    ];

    let game = blockedGame(initial);

    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    // Diana cannot reveal a Duke she doesn't have.
    expect(() =>
      resolveForeignAidBlockInfluenceLoss(
        game,
        "2",
        "Duke"
      )
    ).toThrow();
  });

  it("prevents taking another turn action while a block is pending", () => {
    const game = blockedGame();

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();
  });

  it("declares a winner when a truthful block eliminates the challenger", () => {
    let game = createGame([
      { id: "1", name: "Alfie" },
      { id: "2", name: "Diana" },
    ]);

    // Alfie has one influence remaining.
    game.players[0].hand = ["Captain"];
    game.players[1].hand = ["Duke", "Assassin"];

    game = declareForeignAid(game, "1");
    game = respondToForeignAid(game, "2", "block");
    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    game = resolveForeignAidBlockInfluenceLoss(
      game,
      "1",
      "Captain"
    );

    expect(game.phase).toBe("game_over");
    expect(game.winnerId).toBe("2");
  });

  it("declares a winner when a false block eliminates the blocker", () => {
    let game = createGame([
      { id: "1", name: "Alfie" },
      { id: "2", name: "Diana" },
    ]);

    // Diana has one influence and no Duke.
    game.players[1].hand = ["Contessa"];

    game = declareForeignAid(game, "1");
    game = respondToForeignAid(game, "2", "block");
    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    game = resolveForeignAidBlockInfluenceLoss(
      game,
      "2",
      "Contessa"
    );

    expect(game.players[1].hand).toHaveLength(0);
    expect(game.players[0].coins).toBe(4);
    expect(game.phase).toBe("game_over");
    expect(game.winnerId).toBe("1");
  });

  it("does not mutate the original game state", () => {
    const initial = testGame();

    initial.players[1].hand = [
      "Duke",
      "Assassin",
    ];

    const blocked = blockedGame(initial);

    const originalHand = [
      ...blocked.players[1].hand,
    ];

    const originalDeck = [
      ...blocked.deck,
    ];

    const challenged = respondToForeignAidBlock(
      blocked,
      "1",
      "challenge"
    );

    expect(blocked.players[1].hand).toEqual(
      originalHand
    );

    expect(blocked.deck).toEqual(originalDeck);

    expect(blocked.phase).toBe(
      "foreign_aid_block_challenge"
    );

    expect(challenged.phase).toBe(
      "foreign_aid_block_influence_loss"
    );
  });

  it("rejects further responses after a challenge starts", () => {
    let game = blockedGame();

    game = respondToForeignAidBlock(
      game,
      "1",
      "challenge"
    );

    expect(() =>
      respondToForeignAidBlock(
        game,
        "3",
        "challenge"
      )
    ).toThrow();

    expect(() =>
      respondToForeignAidBlock(
        game,
        "3",
        "pass"
      )
    ).toThrow();
  });
});
