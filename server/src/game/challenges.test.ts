
import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";
import {
  declareTax,
  declareAssassination,
  takeIncome,
  declareForeignAid,
  declareExchange,
} from "./actions.js";

import type {
  GameState,
  Role,
} from "./types.js";

import {
  respondToClaim,
  resolveClaimInfluenceLoss,
  resolveExchangeSelection,
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

describe("Assassination claims", () => {
  it("opens a Contessa block window when everyone passes", () => {
    const game = testGame();

    game.players[0].coins = 5;

    let updated = declareAssassination(
      game,
      "1",
      "2"
    );

    expect(updated.phase).toBe("claim_response");

    updated = respondToClaim(
      updated,
      "2",
      "pass"
    );

    expect(updated.phase).toBe("claim_response");

    updated = respondToClaim(
      updated,
      "3",
      "pass"
    );

    expect(updated.phase).toBe(
      "assassination_block_response"
    );

    expect(updated.currentPlayerIndex).toBe(0);

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      action: "assassinate",
      actorId: "1",
      targetId: "2",
      claimedRole: "Assassin",
    });

    // The 3-coin assassination cost was already paid.
    expect(updated.players[0].coins).toBe(2);
  });

  it("opens a Contessa block window after a truthful Assassin survives a challenge", () => {
    const game = testGame();

    game.players[0].coins = 5;
    game.players[0].hand = [
      "Assassin",
      "Captain",
    ];

    game.players[1].hand = [
      "Duke",
      "Contessa",
    ];

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

    expect(updated.phase).toBe(
      "challenge_influence_loss"
    );

    updated = resolveClaimInfluenceLoss(
      updated,
      "2",
      "Duke"
    );

    expect(updated.players[1].hand).toEqual([
      "Contessa",
    ]);

    expect(updated.phase).toBe(
      "assassination_block_response"
    );

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      action: "assassinate",
      actorId: "1",
      targetId: "2",
    });
  });
});

describe("Exchange claims", () => {
  it("draws 2 cards when everyone accepts the Ambassador claim", () => {
    const game = testGame();

    const originalDeckSize =
      game.deck.length;

    const originalHand = [
      ...game.players[0].hand,
    ];

    let updated = declareExchange(
      game,
      "1"
    );

    updated = respondToClaim(
      updated,
      "2",
      "pass"
    );

    updated = respondToClaim(
      updated,
      "3",
      "pass"
    );

    expect(updated.phase).toBe(
      "exchange_selection"
    );

    expect(
      updated.pendingAction
    ).toMatchObject({
      type: "claim",
      action: "exchange",
      actorId: "1",
      claimedRole: "Ambassador",
    });

    expect(
      updated.pendingAction?.type === "claim"
        ? updated.pendingAction.exchangeDrawnCards
        : undefined
    ).toHaveLength(2);

    // Two cards have been drawn.
    expect(updated.deck).toHaveLength(
      originalDeckSize - 2
    );

    // The player's existing hand has not
    // changed yet.
    expect(updated.players[0].hand).toEqual(
      originalHand
    );
  });
  it("allows the player to choose cards to keep after Exchange", () => {
    const game = testGame();

    const originalDeckSize = game.deck.length;
    const originalHand = [...game.players[0].hand];

    let updated = declareExchange(game, "1");

    updated = respondToClaim(
      updated,
      "2",
      "pass"
    );

    updated = respondToClaim(
      updated,
      "3",
      "pass"
    );

    expect(updated.phase).toBe(
      "exchange_selection"
    );

    if (
      updated.pendingAction?.type !== "claim" ||
      !updated.pendingAction.exchangeDrawnCards
    ) {
      throw new Error(
        "Expected drawn Exchange cards."
      );
    }

    const drawnCards =
      updated.pendingAction.exchangeDrawnCards;

    // Keep one original card and one newly drawn card.
    const cardsToKeep = [
      originalHand[0],
      drawnCards[0],
    ];

    updated = resolveExchangeSelection(
      updated,
      "1",
      cardsToKeep
    );

    expect(updated.players[0].hand).toEqual(
      cardsToKeep
    );

    // Two cards were returned, so the deck
    // returns to its original size.
    expect(updated.deck).toHaveLength(
      originalDeckSize
    );

    expect(updated.phase).toBe("turn_start");
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.pendingAction).toBeNull();
  });


  it("only keeps one card when the player has one influence remaining", () => {
    const initial = testGame();

    initial.players[0].hand = ["Duke"];

    let game = declareExchange(
      initial,
      "1"
    );

    game = respondToClaim(
      game,
      "2",
      "pass"
    );

    game = respondToClaim(
      game,
      "3",
      "pass"
    );

    if (
      game.pendingAction?.type !== "claim" ||
      !game.pendingAction.exchangeDrawnCards
    ) {
      throw new Error(
        "Expected drawn Exchange cards."
      );
    }

    const drawnCards =
      game.pendingAction.exchangeDrawnCards;

    const deckSizeBeforeSelection =
      game.deck.length;

    game = resolveExchangeSelection(
      game,
      "1",
      [drawnCards[0]]
    );

    expect(game.players[0].hand).toEqual([
      drawnCards[0],
    ]);

    // With one influence:
    // 1 old card + 2 drawn - 1 kept = 2 returned.
    expect(game.deck).toHaveLength(
      deckSizeBeforeSelection + 2
    );

    expect(game.phase).toBe("turn_start");
  });


  it("rejects keeping the wrong number of cards", () => {
    let game = declareExchange(
      testGame(),
      "1"
    );

    game = respondToClaim(
      game,
      "2",
      "pass"
    );

    game = respondToClaim(
      game,
      "3",
      "pass"
    );

    expect(() =>
      resolveExchangeSelection(
        game,
        "1",
        []
      )
    ).toThrow();
  });


  it("rejects cards that are not available in the Exchange", () => {
    let game = declareExchange(
      testGame(),
      "1"
    );

    game = respondToClaim(
      game,
      "2",
      "pass"
    );

    game = respondToClaim(
      game,
      "3",
      "pass"
    );

    const actor = game.players[0];

    // Find a role with more requested copies than
    // actually exist in the available Exchange cards.
    const impossibleSelection: Role[] = [
      "Contessa",
      "Contessa",
    ];

    const availableCards = [
      ...actor.hand,
      ...(
        game.pendingAction?.type === "claim"
          ? game.pendingAction.exchangeDrawnCards ?? []
          : []
      ),
    ];

    const contessaCount = availableCards.filter(
      (card) => card === "Contessa"
    ).length;

    // Only test this particular impossible selection
    // if fewer than 2 Contessas are available.
    if (contessaCount < 2) {
      expect(() =>
        resolveExchangeSelection(
          game,
          "1",
          impossibleSelection
        )
      ).toThrow();
    }
  });


  it("only allows the acting player to choose Exchange cards", () => {
    let game = declareExchange(
      testGame(),
      "1"
    );

    game = respondToClaim(
      game,
      "2",
      "pass"
    );

    game = respondToClaim(
      game,
      "3",
      "pass"
    );

    const playerTwoHand = [
      ...game.players[1].hand,
    ];

    expect(() =>
      resolveExchangeSelection(
        game,
        "2",
        playerTwoHand
      )
    ).toThrow();
  });


  it("does not mutate the Exchange state", () => {
    let game = declareExchange(
      testGame(),
      "1"
    );

    game = respondToClaim(
      game,
      "2",
      "pass"
    );

    game = respondToClaim(
      game,
      "3",
      "pass"
    );

    if (
      game.pendingAction?.type !== "claim" ||
      !game.pendingAction.exchangeDrawnCards
    ) {
      throw new Error(
        "Expected drawn Exchange cards."
      );
    }

    const originalHand = [
      ...game.players[0].hand,
    ];

    const originalDeck = [
      ...game.deck,
    ];

    const cardsToKeep = [
      originalHand[0],
      game.pendingAction.exchangeDrawnCards[0],
    ];

    const updated = resolveExchangeSelection(
      game,
      "1",
      cardsToKeep
    );

    expect(game.players[0].hand).toEqual(
      originalHand
    );

    expect(game.deck).toEqual(originalDeck);

    expect(game.phase).toBe(
      "exchange_selection"
    );

    expect(updated.phase).toBe("turn_start");
  });
});