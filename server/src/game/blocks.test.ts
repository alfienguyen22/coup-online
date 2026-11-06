import { describe, expect, it } from "vitest";

import { createGame } from "./setup.js";

import {
  declareForeignAid,
  respondToForeignAid,
  takeIncome,
  declareAssassination,
  declareSteal
} from "./actions.js";

import { respondToClaim } from "./challenges.js";

import {
  respondToForeignAidBlock,
  resolveForeignAidBlockInfluenceLoss,
  respondToAssassinationBlock,
  resolveAssassinationInfluenceLoss,
  respondToAssassinationBlockChallenge,
  resolveAssassinationBlockInfluenceLoss,
  respondToStealBlock,
  respondToStealBlockChallenge,
  resolveStealBlockInfluenceLoss,
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

// Helper: start an Assassination,
// then have everyone accept the Assassin claim.
// The target must now decide whether to block with Contessa.
function assassinationBlockGame(
  initialGame: GameState = testGame()
): GameState {
  initialGame.players[0].coins = 5;

  let game = declareAssassination(
    initialGame,
    "1",
    "2"
  );

  // Diana and Alex both accept the Assassin claim.
  game = respondToClaim(game, "2", "pass");
  game = respondToClaim(game, "3", "pass");

  return game;
}

function stealBlockGame(
  initialGame: GameState = testGame()
): GameState {
  initialGame.players[0].coins = 2;
  initialGame.players[1].coins = 4;

  let game = declareSteal(
    initialGame,
    "1",
    "2"
  );

  // Diana and Alex both accept Alfie's Captain claim.
  game = respondToClaim(game, "2", "pass");
  game = respondToClaim(game, "3", "pass");

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
    expect(game.players[1].hand).toContain(
      "Assassin"
    );
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
    game.players[1].hand = [
      "Duke",
      "Assassin",
    ];

    game = declareForeignAid(game, "1");
    game = respondToForeignAid(
      game,
      "2",
      "block"
    );
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
    game = respondToForeignAid(
      game,
      "2",
      "block"
    );
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

describe("Assassination blocking", () => {
  it("opens influence loss when the target passes", () => {
    const game = assassinationBlockGame();

    const originalHandLength =
      game.players[1].hand.length;

    const updated = respondToAssassinationBlock(
      game,
      "2",
      "pass"
    );

    expect(updated.phase).toBe(
      "assassination_influence_loss"
    );

    // No card is removed yet.
    // The target still gets to choose which influence to lose.
    expect(updated.players[1].hand).toHaveLength(
      originalHandLength
    );

    // Assassin already paid 3 coins.
    expect(updated.players[0].coins).toBe(2);
  });

  it("opens a challenge window when the target claims Contessa", () => {
    const game = assassinationBlockGame();

    const updated = respondToAssassinationBlock(
      game,
      "2",
      "block"
    );

    expect(updated.phase).toBe(
      "assassination_block_challenge"
    );

    expect(updated.pendingAction).toMatchObject({
      type: "claim",
      action: "assassinate",
      actorId: "1",
      targetId: "2",
    });

    // Nobody has lost influence yet.
    expect(updated.players[1].hand).toHaveLength(2);
  });

  it("only allows the assassination target to pass or block", () => {
    const game = assassinationBlockGame();

    expect(() =>
      respondToAssassinationBlock(
        game,
        "1",
        "block"
      )
    ).toThrow();

    expect(() =>
      respondToAssassinationBlock(
        game,
        "3",
        "pass"
      )
    ).toThrow();
  });

  it("resolves influence loss after the target passes", () => {
    let game = assassinationBlockGame();

    game = respondToAssassinationBlock(
      game,
      "2",
      "pass"
    );

    const cardToLose =
      game.players[1].hand[0];

    game = resolveAssassinationInfluenceLoss(
      game,
      "2",
      cardToLose
    );

    expect(game.players[1].hand).toHaveLength(1);

    expect(game.players[1].revealed).toContain(
      cardToLose
    );

    // Assassination is complete.
    expect(game.phase).toBe("turn_start");
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.pendingAction).toBeNull();
  });

  it("only allows the assassination target to reveal influence", () => {
    let game = assassinationBlockGame();

    game = respondToAssassinationBlock(
      game,
      "2",
      "pass"
    );

    expect(() =>
      resolveAssassinationInfluenceLoss(
        game,
        "3",
        game.players[2].hand[0]
      )
    ).toThrow();
  });

  it("rejects revealing a card the target does not have", () => {
    const initial = testGame();

    initial.players[1].hand = [
      "Captain",
      "Contessa",
    ];

    let game = assassinationBlockGame(initial);

    game = respondToAssassinationBlock(
      game,
      "2",
      "pass"
    );

    expect(() =>
      resolveAssassinationInfluenceLoss(
        game,
        "2",
        "Duke"
      )
    ).toThrow();
  });

  it("prevents another action while the assassination is waiting for a block", () => {
    const game = assassinationBlockGame();

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();
  });

  it("does not mutate the game when the target chooses to block", () => {
    const game = assassinationBlockGame();

    const originalHand = [
      ...game.players[1].hand,
    ];

    const originalCoins =
      game.players[0].coins;

    const updated = respondToAssassinationBlock(
      game,
      "2",
      "block"
    );

    expect(game.phase).toBe(
      "assassination_block_response"
    );

    expect(game.players[1].hand).toEqual(
      originalHand
    );

    expect(game.players[0].coins).toBe(
      originalCoins
    );

    expect(updated.phase).toBe(
      "assassination_block_challenge"
    );
  });
  it("accepts the Contessa block when everyone passes", () => {
  let game = assassinationBlockGame();

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  game = respondToAssassinationBlockChallenge(
    game,
    "1",
    "pass"
  );

  expect(game.phase).toBe(
    "assassination_block_challenge"
  );

  game = respondToAssassinationBlockChallenge(
    game,
    "3",
    "pass"
  );

  // Everyone accepted the Contessa claim.
  // The assassination is cancelled.
  expect(game.phase).toBe("turn_start");
  expect(game.currentPlayerIndex).toBe(1);
  expect(game.pendingAction).toBeNull();

  // Assassin still paid the 3-coin cost.
  expect(game.players[0].coins).toBe(2);

  // Diana loses no influence.
  expect(game.players[1].hand).toHaveLength(2);
});


it("resolves a truthful Contessa challenge", () => {
  const initial = testGame();

  initial.players[1].hand = [
    "Contessa",
    "Captain",
  ];

  let game = assassinationBlockGame(initial);

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  const originalDeckSize = game.deck.length;

  // Alex challenges Diana's Contessa.
  game = respondToAssassinationBlockChallenge(
    game,
    "3",
    "challenge"
  );

  expect(game.phase).toBe(
    "assassination_block_influence_loss"
  );

  expect(game.pendingAction).toMatchObject({
    blockerId: "2",

    blockChallenge: {
      challengerId: "3",
      claimantWasTruthful: true,
    },
  });

  // Diana demonstrated Contessa and received
  // a replacement card.
  expect(game.players[1].hand).toHaveLength(2);
  expect(game.players[1].hand).toContain(
    "Captain"
  );

  expect(game.deck).toHaveLength(
    originalDeckSize
  );

  // Alex lost the challenge.
  const cardToLose =
    game.players[2].hand[0];

  game = resolveAssassinationBlockInfluenceLoss(
    game,
    "3",
    cardToLose
  );

  expect(game.players[2].hand).toHaveLength(1);

  expect(game.players[2].revealed).toContain(
    cardToLose
  );

  // Contessa succeeds, so the assassination
  // is cancelled.
  expect(game.phase).toBe("turn_start");
  expect(game.currentPlayerIndex).toBe(1);
  expect(game.pendingAction).toBeNull();

  // Diana did not lose influence.
  expect(game.players[1].hand).toHaveLength(2);
});


it("continues the assassination after a false Contessa claim", () => {
  const initial = testGame();

  // Diana does NOT have Contessa.
  initial.players[1].hand = [
    "Duke",
    "Captain",
  ];

  let game = assassinationBlockGame(initial);

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  game = respondToAssassinationBlockChallenge(
    game,
    "3",
    "challenge"
  );

  expect(game.pendingAction).toMatchObject({
    blockerId: "2",

    blockChallenge: {
      challengerId: "3",
      claimantWasTruthful: false,
    },
  });

  // Diana loses one influence for bluffing.
  game = resolveAssassinationBlockInfluenceLoss(
    game,
    "2",
    "Duke"
  );

  expect(game.players[1].hand).toEqual([
    "Captain",
  ]);

  expect(game.players[1].revealed).toContain(
    "Duke"
  );

  // But the assassination still continues.
  expect(game.phase).toBe(
    "assassination_influence_loss"
  );

  // Diana now loses another influence
  // because the assassination succeeded.
  game = resolveAssassinationInfluenceLoss(
    game,
    "2",
    "Captain"
  );

  expect(game.players[1].hand).toHaveLength(0);

  expect(game.players[1].revealed).toContain(
    "Captain"
  );

  expect(game.phase).toBe("turn_start");

  // Diana is eliminated, so Alex is next.
  expect(game.currentPlayerIndex).toBe(2);
});


it("prevents the Contessa claimant from challenging their own block", () => {
  let game = assassinationBlockGame();

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  expect(() =>
    respondToAssassinationBlockChallenge(
      game,
      "2",
      "challenge"
    )
  ).toThrow();

  expect(() =>
    respondToAssassinationBlockChallenge(
      game,
      "2",
      "pass"
    )
  ).toThrow();
});


it("prevents responding twice to a Contessa block", () => {
  let game = assassinationBlockGame();

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  game = respondToAssassinationBlockChallenge(
    game,
    "1",
    "pass"
  );

  expect(() =>
    respondToAssassinationBlockChallenge(
      game,
      "1",
      "pass"
    )
  ).toThrow();

  expect(() =>
    respondToAssassinationBlockChallenge(
      game,
      "1",
      "challenge"
    )
  ).toThrow();
});
it("does not apply assassination again when a false Contessa challenge eliminates the target", () => {
  const initial = testGame();

  // Diana has one influence and no Contessa.
  initial.players[1].hand = ["Duke"];

  let game = assassinationBlockGame(initial);

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  // Alex challenges Diana's fake Contessa.
  game = respondToAssassinationBlockChallenge(
    game,
    "3",
    "challenge"
  );

  game = resolveAssassinationBlockInfluenceLoss(
    game,
    "2",
    "Duke"
  );

  // Diana was eliminated by losing the challenge.
  expect(game.players[1].hand).toHaveLength(0);
  expect(game.players[1].revealed).toContain("Duke");

  // The assassination does NOT try to remove
  // another influence from an eliminated player.
  expect(game.phase).toBe("turn_start");

  // Diana is eliminated, so Alex becomes next.
  expect(game.currentPlayerIndex).toBe(2);
});

it("handles a truthful Contessa challenge that eliminates the challenger", () => {
  const initial = testGame();

  // Diana really has Contessa.
  initial.players[1].hand = [
    "Contessa",
    "Captain",
  ];

  // Alex only has one influence remaining.
  initial.players[2].hand = ["Duke"];

  let game = assassinationBlockGame(initial);

  game = respondToAssassinationBlock(
    game,
    "2",
    "block"
  );

  // Alex challenges Diana.
  game = respondToAssassinationBlockChallenge(
    game,
    "3",
    "challenge"
  );

  game = resolveAssassinationBlockInfluenceLoss(
    game,
    "3",
    "Duke"
  );

  expect(game.players[2].hand).toHaveLength(0);
  expect(game.players[2].revealed).toContain("Duke");

  // Diana's Contessa successfully blocked
  // the assassination.
  expect(game.players[1].hand).toHaveLength(2);

  expect(game.phase).toBe("turn_start");

  // Diana is still the next living player.
  expect(game.currentPlayerIndex).toBe(1);
});

describe("Steal blocking", () => {
  it("transfers 2 coins when the target passes", () => {
    const game = stealBlockGame();

    const updated = respondToStealBlock(
      game,
      "2",
      "pass"
    );

    expect(updated.players[0].coins).toBe(4);
    expect(updated.players[1].coins).toBe(2);

    expect(updated.phase).toBe("turn_start");
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.pendingAction).toBeNull();
  });

  it("only steals 1 coin when the target has 1 coin", () => {
    const initial = testGame();

    initial.players[0].coins = 2;
    initial.players[1].coins = 1;

    let game = declareSteal(
      initial,
      "1",
      "2"
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

    game = respondToStealBlock(
      game,
      "2",
      "pass"
    );

    expect(game.players[0].coins).toBe(3);
    expect(game.players[1].coins).toBe(0);
  });

  it("steals nothing when the target has 0 coins", () => {
    const initial = testGame();

    initial.players[0].coins = 2;
    initial.players[1].coins = 0;

    let game = declareSteal(
      initial,
      "1",
      "2"
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

    game = respondToStealBlock(
      game,
      "2",
      "pass"
    );

    expect(game.players[0].coins).toBe(2);
    expect(game.players[1].coins).toBe(0);
  });

  it("opens a challenge window when the target blocks with Captain", () => {
    const game = stealBlockGame();

    const updated = respondToStealBlock(
      game,
      "2",
      "captain"
    );

    expect(updated.phase).toBe(
      "steal_block_challenge"
    );

    expect(updated.pendingAction).toMatchObject({
      action: "steal",
      actorId: "1",
      targetId: "2",
      blockerId: "2",
      blockClaimedRole: "Captain",
      blockPassedPlayerIds: [],
      blockChallenge: null,
    });

    // No coins move yet.
    expect(updated.players[0].coins).toBe(2);
    expect(updated.players[1].coins).toBe(4);
  });

  it("opens a challenge window when the target blocks with Ambassador", () => {
    const game = stealBlockGame();

    const updated = respondToStealBlock(
      game,
      "2",
      "ambassador"
    );

    expect(updated.phase).toBe(
      "steal_block_challenge"
    );

    expect(updated.pendingAction).toMatchObject({
      blockerId: "2",
      blockClaimedRole: "Ambassador",
    });

    expect(updated.players[0].coins).toBe(2);
    expect(updated.players[1].coins).toBe(4);
  });

  it("only allows the steal target to respond", () => {
    const game = stealBlockGame();

    expect(() =>
      respondToStealBlock(
        game,
        "1",
        "pass"
      )
    ).toThrow();

    expect(() =>
      respondToStealBlock(
        game,
        "3",
        "captain"
      )
    ).toThrow();
  });

  it("does not mutate the original game", () => {
    const game = stealBlockGame();

    const updated = respondToStealBlock(
      game,
      "2",
      "pass"
    );

    expect(game.phase).toBe(
      "steal_block_response"
    );

    expect(game.players[0].coins).toBe(2);
    expect(game.players[1].coins).toBe(4);

    expect(updated.players[0].coins).toBe(4);
    expect(updated.players[1].coins).toBe(2);
  });
it("accepts the Steal block when everyone passes", () => {
  let game = stealBlockGame();

  game = respondToStealBlock(
    game,
    "2",
    "captain"
  );

  game = respondToStealBlockChallenge(
    game,
    "1",
    "pass"
  );

  expect(game.phase).toBe(
    "steal_block_challenge"
  );

  game = respondToStealBlockChallenge(
    game,
    "3",
    "pass"
  );

  // Everyone accepts Diana's Captain block.
  expect(game.phase).toBe("turn_start");
  expect(game.currentPlayerIndex).toBe(1);
  expect(game.pendingAction).toBeNull();

  // No coins move.
  expect(game.players[0].coins).toBe(2);
  expect(game.players[1].coins).toBe(4);
});


it("resolves a truthful Captain block", () => {
  const initial = testGame();

  initial.players[1].hand = [
    "Captain",
    "Duke",
  ];

  let game = stealBlockGame(initial);

  game = respondToStealBlock(
    game,
    "2",
    "captain"
  );

  const originalDeckSize = game.deck.length;

  // Alex challenges Diana's Captain.
  game = respondToStealBlockChallenge(
    game,
    "3",
    "challenge"
  );

  expect(game.phase).toBe(
    "steal_block_influence_loss"
  );

  expect(game.pendingAction).toMatchObject({
    blockerId: "2",
    blockClaimedRole: "Captain",

    blockChallenge: {
      challengerId: "3",
      claimantWasTruthful: true,
    },
  });

  // Diana proves Captain and receives
  // a replacement card.
  expect(game.players[1].hand).toHaveLength(2);
  expect(game.players[1].hand).toContain("Duke");

  expect(game.deck).toHaveLength(
    originalDeckSize
  );

  // Alex loses the challenge.
  const cardToLose =
    game.players[2].hand[0];

  game = resolveStealBlockInfluenceLoss(
    game,
    "3",
    cardToLose
  );

  expect(game.players[2].hand).toHaveLength(1);

  expect(game.players[2].revealed).toContain(
    cardToLose
  );

  // Steal was successfully blocked.
  expect(game.players[0].coins).toBe(2);
  expect(game.players[1].coins).toBe(4);

  expect(game.phase).toBe("turn_start");
  expect(game.currentPlayerIndex).toBe(1);
  expect(game.pendingAction).toBeNull();
});


it("resolves a truthful Ambassador block", () => {
  const initial = testGame();

  initial.players[1].hand = [
    "Ambassador",
    "Duke",
  ];

  let game = stealBlockGame(initial);

  game = respondToStealBlock(
    game,
    "2",
    "ambassador"
  );

  game = respondToStealBlockChallenge(
    game,
    "1",
    "challenge"
  );

  expect(game.pendingAction).toMatchObject({
    blockerId: "2",
    blockClaimedRole: "Ambassador",

    blockChallenge: {
      challengerId: "1",
      claimantWasTruthful: true,
    },
  });

  const cardToLose =
    game.players[0].hand[0];

  game = resolveStealBlockInfluenceLoss(
    game,
    "1",
    cardToLose
  );

  // Ambassador successfully blocks.
  expect(game.players[0].coins).toBe(2);
  expect(game.players[1].coins).toBe(4);

  expect(game.phase).toBe("turn_start");
});


it("allows the Steal after a false block", () => {
  const initial = testGame();

  // Diana has neither Captain nor Ambassador.
  initial.players[1].hand = [
    "Duke",
    "Contessa",
  ];

  let game = stealBlockGame(initial);

  game = respondToStealBlock(
    game,
    "2",
    "captain"
  );

  // Alex challenges the fake Captain.
  game = respondToStealBlockChallenge(
    game,
    "3",
    "challenge"
  );

  expect(game.pendingAction).toMatchObject({
    blockerId: "2",
    blockClaimedRole: "Captain",

    blockChallenge: {
      challengerId: "3",
      claimantWasTruthful: false,
    },
  });

  // Diana loses influence for bluffing.
  game = resolveStealBlockInfluenceLoss(
    game,
    "2",
    "Duke"
  );

  expect(game.players[1].hand).toEqual([
    "Contessa",
  ]);

  expect(game.players[1].revealed).toContain(
    "Duke"
  );

  // Her block failed, so Alfie's Steal succeeds.
  expect(game.players[0].coins).toBe(4);
  expect(game.players[1].coins).toBe(2);

  expect(game.phase).toBe("turn_start");
  expect(game.currentPlayerIndex).toBe(1);
});


it("prevents the blocker from responding to their own block", () => {
  let game = stealBlockGame();

  game = respondToStealBlock(
    game,
    "2",
    "captain"
  );

  expect(() =>
    respondToStealBlockChallenge(
      game,
      "2",
      "pass"
    )
  ).toThrow();

  expect(() =>
    respondToStealBlockChallenge(
      game,
      "2",
      "challenge"
    )
  ).toThrow();
});


it("prevents responding twice to a Steal block", () => {
  let game = stealBlockGame();

  game = respondToStealBlock(
    game,
    "2",
    "ambassador"
  );

  game = respondToStealBlockChallenge(
    game,
    "1",
    "pass"
  );

  expect(() =>
    respondToStealBlockChallenge(
      game,
      "1",
      "pass"
    )
  ).toThrow();

  expect(() =>
    respondToStealBlockChallenge(
      game,
      "1",
      "challenge"
    )
  ).toThrow();
});
});

});