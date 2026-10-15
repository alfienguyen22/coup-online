
import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";
import {
  declareTax,
  takeIncome,
  declareForeignAid,
} from "./actions.js";

import {
  respondToClaim,
  resolveClaimInfluenceLoss,
} from "./challenges.js";

function testGame() {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}

describe("Tax and character claims", () => {

  it("opens a challenge window without awarding coins", () => {
    const game = testGame();

    const updated = declareTax(game, "1");

    expect(updated.phase).toBe("claim_response");
    expect(updated.players[0].coins).toBe(2);

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      action: "tax",
      actorId: "1",
      claimedRole: "Duke",
    });
  });

  it("awards three coins when everyone passes", () => {
    let game = declareTax(testGame(), "1");

    game = respondToClaim(game, "2", "pass");

    expect(game.players[0].coins).toBe(2);
    expect(game.phase).toBe("claim_response");

    game = respondToClaim(game, "3", "pass");

    expect(game.players[0].coins).toBe(5);
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.phase).toBe("turn_start");
    expect(game.pendingAction).toBeNull();
  });

  it("rejects declaring Tax outside your turn", () => {
    const game = testGame();

    expect(() =>
      declareTax(game, "2")
    ).toThrow();
  });

  it("requires Coup instead of Tax at 10 coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareTax(game, "1")
    ).toThrow();
  });

  it("rejects new actions while another action is pending", () => {
    const game = declareForeignAid(testGame(), "1");

    expect(() =>
      declareTax(game, "1")
    ).toThrow();
  });

  it("prevents the claimant from challenging themselves", () => {
    const game = declareTax(testGame(), "1");

    expect(() =>
      respondToClaim(game, "1", "challenge")
    ).toThrow();
  });

  it("prevents eliminated players from responding", () => {
    const game = testGame();

    game.players[1].hand = [];

    const declared = declareTax(game, "1");

    expect(() =>
      respondToClaim(declared, "2", "pass")
    ).toThrow();
  });

  it("prevents a player from passing twice", () => {
    let game = declareTax(testGame(), "1");

    game = respondToClaim(game, "2", "pass");

    expect(() =>
      respondToClaim(game, "2", "pass")
    ).toThrow();

    expect(() =>
      respondToClaim(game, "2", "challenge")
    ).toThrow();
  });

  it("allows another player to challenge after someone passes", () => {
    let game = declareTax(testGame(), "1");

    game = respondToClaim(game, "2", "pass");
    game = respondToClaim(game, "3", "challenge");

    expect(game.phase).toBe(
      "challenge_influence_loss"
    );

    expect(game.pendingAction).toMatchObject({
      type: "claim",
      challenge: {
        challengerId: "3",
      },
    });
  });

  it("resolves a challenge against a truthful Duke", () => {
    const game = testGame();

    // Force a known hand for this test.
    game.players[0].hand = ["Duke", "Assassin"];

    const originalDeckSize = game.deck.length;

    let updated = declareTax(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    expect(updated.phase).toBe(
      "challenge_influence_loss"
    );

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      challenge: {
        challengerId: "2",
        claimantWasTruthful: true,
      },
    });

    // Duke was replaced, but no influence was lost.
    expect(updated.players[0].hand).toHaveLength(2);
    expect(updated.players[0].hand).toContain("Assassin");
    expect(updated.players[0].revealed).toHaveLength(0);
    expect(updated.deck).toHaveLength(originalDeckSize);

    // The challenger must lose influence.
    const cardToLose = updated.players[1].hand[0];

    updated = resolveClaimInfluenceLoss(
      updated,
      "2",
      cardToLose
    );

    expect(updated.players[1].hand).toHaveLength(1);
    expect(updated.players[1].revealed).toContain(
      cardToLose
    );

    // Tax succeeds.
    expect(updated.players[0].coins).toBe(5);
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.phase).toBe("turn_start");
  });

  it("cancels Tax when the claimant is bluffing", () => {
    const game = testGame();

    // Alfie does not have Duke.
    game.players[0].hand = [
      "Assassin",
      "Contessa",
    ];

    let updated = declareTax(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      challenge: {
        challengerId: "2",
        claimantWasTruthful: false,
      },
    });

    // Alfie loses influence.
    updated = resolveClaimInfluenceLoss(
      updated,
      "1",
      "Assassin"
    );

    expect(updated.players[0].hand).toEqual([
      "Contessa",
    ]);

    expect(updated.players[0].revealed).toEqual([
      "Assassin",
    ]);

    // The failed Tax grants no coins.
    expect(updated.players[0].coins).toBe(2);

    // The turn ends.
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.phase).toBe("turn_start");
  });

  it("only allows the losing player to reveal influence", () => {
    const game = testGame();

    game.players[0].hand = [
      "Assassin",
      "Captain",
    ];

    let updated = declareTax(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    // Alfie lost the challenge, not Diana.
    expect(() =>
      resolveClaimInfluenceLoss(
        updated,
        "2",
        updated.players[1].hand[0]
      )
    ).toThrow();
  });

  it("rejects revealing a card not in the hand", () => {
    const game = testGame();

    game.players[0].hand = [
      "Assassin",
      "Captain",
    ];

    let updated = declareTax(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    expect(() =>
      resolveClaimInfluenceLoss(
        updated,
        "1",
        "Duke"
      )
    ).toThrow();
  });

  it("rejects further responses after a challenge", () => {
    const game = testGame();

    game.players[0].hand = [
      "Assassin",
      "Captain",
    ];

    let updated = declareTax(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "challenge"
    );

    expect(() =>
      respondToClaim(
        updated,
        "3",
        "challenge"
      )
    ).toThrow();

    expect(() =>
      takeIncome(updated, "1")
    ).toThrow();
  });

  it("does not mutate the original state", () => {
    const game = testGame();

    game.players[0].hand = [
      "Duke",
      "Assassin",
    ];

    const declared = declareTax(game, "1");

    const originalHand = [
      ...declared.players[0].hand,
    ];

    const originalDeck = [
      ...declared.deck,
    ];

    const challenged = respondToClaim(
      declared,
      "2",
      "challenge"
    );

    expect(declared.players[0].hand).toEqual(
      originalHand
    );

    expect(declared.deck).toEqual(originalDeck);
    expect(declared.phase).toBe("claim_response");

    expect(challenged.phase).toBe(
      "challenge_influence_loss"
    );
  });
});
