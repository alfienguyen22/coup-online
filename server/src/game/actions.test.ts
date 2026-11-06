
import { describe, expect, it } from "vitest";
import { createGame } from "./setup.js";
import {
  takeIncome,
  declareForeignAid,
  respondToForeignAid,
  takeCoup,
  resolveCoupInfluenceLoss,
  declareAssassination,
  declareSteal,
  declareExchange,
} from "./actions.js";
import { finishTurn } from "./turns.js";



function testGame() {
  return createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);
}

describe("Turn management", () => {
  it("advances to the next player", () => {
    const game = testGame();

    const nextGame = finishTurn(game);

    expect(nextGame.currentPlayerIndex).toBe(1);
  });

  it("wraps around to the first player", () => {
    const game = testGame();

    game.currentPlayerIndex = 2;

    const nextGame = finishTurn(game);

    expect(nextGame.currentPlayerIndex).toBe(0);
  });

  it("skips eliminated players", () => {
    const game = testGame();

    game.players[1].hand = [];

    const nextGame = finishTurn(game);

    expect(nextGame.currentPlayerIndex).toBe(2);
  });

  it("detects the last remaining player", () => {
    const game = testGame();

    game.players[1].hand = [];
    game.players[2].hand = [];

    const nextGame = finishTurn(game);

    expect(nextGame.phase).toBe("game_over");
    expect(nextGame.winnerId).toBe("1");
  });
});

describe("Income action", () => {
  it("adds one coin and advances the turn", () => {
    const game = testGame();

    const updated = takeIncome(game, "1");

    expect(updated.players[0].coins).toBe(3);
    expect(updated.currentPlayerIndex).toBe(1);
    expect(updated.phase).toBe("turn_start");
  });

  it("does not mutate the original game", () => {
    const game = testGame();

    takeIncome(game, "1");

    expect(game.players[0].coins).toBe(2);
    expect(game.currentPlayerIndex).toBe(0);
  });

  it("rejects an action outside the player's turn", () => {
    const game = testGame();

    expect(() => takeIncome(game, "2")).toThrow();
  });

  it("requires a Coup at 10 or more coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() => takeIncome(game, "1")).toThrow();
    expect(() => declareForeignAid(game, "1")).toThrow();
  });
});

describe("Foreign Aid", () => {
  it("starts a response window without awarding coins", () => {
    const game = testGame();

    const updated = declareForeignAid(game, "1");

    expect(updated.phase).toBe("foreign_aid_response");
    expect(updated.players[0].coins).toBe(2);
    expect(updated.currentPlayerIndex).toBe(0);
  });

  it("awards two coins after everyone passes", () => {
    let game = testGame();

    game = declareForeignAid(game, "1");
    game = respondToForeignAid(game, "2", "pass");

    // One player still needs to respond.
    expect(game.players[0].coins).toBe(2);

    game = respondToForeignAid(game, "3", "pass");

    expect(game.players[0].coins).toBe(4);
    expect(game.currentPlayerIndex).toBe(1);
    expect(game.phase).toBe("turn_start");
    expect(game.pendingAction).toBeNull();
  });

  
it("records a Duke block without resolving it yet", () => {
  let game = testGame();

  game = declareForeignAid(game, "1");
  game = respondToForeignAid(game, "2", "block");

  expect(game.phase).toBe(
    "foreign_aid_block_challenge"
  );

  expect(game.pendingAction).toMatchObject({
    type: "foreign_aid",
    blockerId: "2",
  });

  expect(game.players[0].coins).toBe(2);
});


  it("prevents the acting player from responding", () => {
    const game = declareForeignAid(testGame(), "1");

    expect(() =>
      respondToForeignAid(game, "1", "pass")
    ).toThrow();
  });

  it("prevents players from passing twice", () => {
    let game = declareForeignAid(testGame(), "1");

    game = respondToForeignAid(game, "2", "pass");

    expect(() =>
      respondToForeignAid(game, "2", "pass")
    ).toThrow();
  });

  it("prevents a new action during a response window", () => {
    const game = declareForeignAid(testGame(), "1");

    expect(() => takeIncome(game, "1")).toThrow();
  });
});

describe("Assassination", () => {
  it("deducts 3 coins and starts an Assassin claim", () => {
    const game = testGame();

    game.players[0].coins = 5;

    const updated = declareAssassination(
      game,
      "1",
      "2"
    );

    expect(updated.players[0].coins).toBe(2);
    expect(updated.phase).toBe("claim_response");
    expect(updated.currentPlayerIndex).toBe(0);

    expect(updated.pendingAction).toEqual({
      type: "claim",
      action: "assassinate",
      actorId: "1",
      targetId: "2",
      claimedRole: "Assassin",
      passedPlayerIds: [],
      challenge: null,
    });
  });

  it("requires at least 3 coins", () => {
    const game = testGame();

    game.players[0].coins = 2;

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();
  });

  it("prevents a player from targeting themselves", () => {
    const game = testGame();

    game.players[0].coins = 3;

    expect(() =>
      declareAssassination(game, "1", "1")
    ).toThrow();
  });

  it("prevents targeting an eliminated player", () => {
    const game = testGame();

    game.players[0].coins = 3;
    game.players[1].hand = [];

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();
  });

  it("prevents assassination outside the player's turn", () => {
    const game = testGame();

    game.players[1].coins = 3;

    expect(() =>
      declareAssassination(game, "2", "1")
    ).toThrow();
  });

  it("requires Coup instead when the player has 10 or more coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();
  });

  it("prevents assassination while another action is pending", () => {
    let game = testGame();

    game.players[0].coins = 3;

    game = declareForeignAid(game, "1");

    expect(() =>
      declareAssassination(game, "1", "2")
    ).toThrow();
  });

  it("does not mutate the original game", () => {
    const game = testGame();

    game.players[0].coins = 5;

    declareAssassination(game, "1", "2");

    expect(game.players[0].coins).toBe(5);
    expect(game.phase).toBe("turn_start");
    expect(game.pendingAction).toBeNull();
  });
});

describe("Coup action", () => {
  it("requires at least 7 coins", () => {
    const game = testGame();

    game.players[0].coins = 6;

    expect(() =>
      takeCoup(game, "1", "2")
    ).toThrow();
  });

  it("deducts 7 coins and waits for influence loss", () => {
    const game = testGame();

    game.players[0].coins = 9;

    const updated = takeCoup(game, "1", "2");

    expect(updated.players[0].coins).toBe(2);
    expect(updated.phase).toBe(
      "coup_influence_loss"
    );
    expect(updated.currentPlayerIndex).toBe(0);
    expect(updated.pendingAction).toEqual({
      type: "coup",
      actorId: "1",
      targetId: "2",
    });
  });

  it("allows mandatory Coup at 10 coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      takeIncome(game, "1")
    ).toThrow();

    const updated = takeCoup(game, "1", "2");

    expect(updated.players[0].coins).toBe(3);
  });

  it("prevents a player from targeting themselves", () => {
    const game = testGame();

    game.players[0].coins = 7;

    expect(() =>
      takeCoup(game, "1", "1")
    ).toThrow();
  });

  it("prevents targeting eliminated players", () => {
    const game = testGame();

    game.players[0].coins = 7;
    game.players[1].hand = [];

    expect(() =>
      takeCoup(game, "1", "2")
    ).toThrow();
  });

  it("prevents Coup outside the player's turn", () => {
    const game = testGame();

    game.players[1].coins = 7;

    expect(() =>
      takeCoup(game, "2", "1")
    ).toThrow();
  });

  it("prevents another action while influence loss is pending", () => {
    const game = testGame();

    game.players[0].coins = 9;

    const pending = takeCoup(game, "1", "2");

    expect(() =>
      takeIncome(pending, "1")
    ).toThrow();

    expect(() =>
      takeCoup(pending, "1", "3")
    ).toThrow();
  });

  it("allows the target to reveal a card", () => {
    const game = testGame();

    game.players[0].coins = 7;

    const originalHand = [...game.players[1].hand];
    const pending = takeCoup(game, "1", "2");

    const updated = resolveCoupInfluenceLoss(
      pending,
      "2",
      originalHand[0]
    );

    expect(updated.players[1].hand).toHaveLength(1);
    expect(updated.players[1].revealed).toContain(
      originalHand[0]
    );

    expect(updated.phase).toBe("turn_start");
    expect(updated.pendingAction).toBeNull();
    expect(updated.currentPlayerIndex).toBe(1);
  });

  it("removes only one copy of a duplicate card", () => {
    const game = testGame();

    game.players[0].coins = 7;
    game.players[1].hand = ["Duke", "Duke"];

    const pending = takeCoup(game, "1", "2");

    const updated = resolveCoupInfluenceLoss(
      pending,
      "2",
      "Duke"
    );

    expect(updated.players[1].hand).toEqual([
      "Duke",
    ]);
    expect(updated.players[1].revealed).toEqual([
      "Duke",
    ]);
  });

  it("eliminates a player who loses their last influence", () => {
    const game = testGame();

    game.players[0].coins = 7;
    game.players[1].hand = ["Contessa"];

    const pending = takeCoup(game, "1", "2");

    const updated = resolveCoupInfluenceLoss(
      pending,
      "2",
      "Contessa"
    );

    expect(updated.players[1].hand).toHaveLength(0);

    // Player 2 is eliminated, so Player 3 goes next.
    expect(updated.currentPlayerIndex).toBe(2);
  });

  it("declares a winner when only one player remains", () => {
    const game = testGame();

    game.players[0].coins = 7;
    game.players[1].hand = ["Duke"];
    game.players[2].hand = [];

    const pending = takeCoup(game, "1", "2");

    const updated = resolveCoupInfluenceLoss(
      pending,
      "2",
      "Duke"
    );

    expect(updated.phase).toBe("game_over");
    expect(updated.winnerId).toBe("1");
  });

  it("prevents the wrong player from revealing", () => {
    const game = testGame();

    game.players[0].coins = 7;

    const pending = takeCoup(game, "1", "2");

    expect(() =>
      resolveCoupInfluenceLoss(
        pending,
        "3",
        pending.players[2].hand[0]
      )
    ).toThrow();
  });

  it("rejects revealing a card not in the hand", () => {
    const game = testGame();

    game.players[0].coins = 7;
    game.players[1].hand = [
      "Duke",
      "Assassin",
    ];

    const pending = takeCoup(game, "1", "2");

    expect(() =>
      resolveCoupInfluenceLoss(
        pending,
        "2",
        "Contessa"
      )
    ).toThrow();
  });

  it("does not mutate the original game", () => {
    const game = testGame();

    game.players[0].coins = 9;

    const pending = takeCoup(game, "1", "2");

    expect(game.players[0].coins).toBe(9);
    expect(game.phase).toBe("turn_start");

    const originalHand = [...game.players[1].hand];

    resolveCoupInfluenceLoss(
      pending,
      "2",
      originalHand[0]
    );

    expect(game.players[1].hand).toEqual(
      originalHand
    );
    expect(game.players[1].revealed).toEqual([]);
  });
});

describe("Steal", () => {
  it("starts a Captain claim against another player", () => {
    const game = testGame();

    game.players[0].coins = 2;
    game.players[1].coins = 4;

    const updated = declareSteal(
      game,
      "1",
      "2"
    );

    expect(updated.phase).toBe("claim_response");

    expect(updated.pendingAction).toEqual({
      type: "claim",
      action: "steal",
      actorId: "1",
      targetId: "2",
      claimedRole: "Captain",
      passedPlayerIds: [],
      challenge: null,
    });

    // No coins move until the Captain claim
    // and any block have been resolved.
    expect(updated.players[0].coins).toBe(2);
    expect(updated.players[1].coins).toBe(4);
  });

  it("prevents stealing from yourself", () => {
    const game = testGame();

    expect(() =>
      declareSteal(game, "1", "1")
    ).toThrow();
  });

  it("prevents stealing from an eliminated player", () => {
    const game = testGame();

    game.players[1].hand = [];

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();
  });

  it("allows targeting a player with only one coin", () => {
    const game = testGame();

    game.players[1].coins = 1;

    const updated = declareSteal(
      game,
      "1",
      "2"
    );

    expect(updated.phase).toBe("claim_response");
    expect(updated.players[1].coins).toBe(1);
  });

  it("allows targeting a player with zero coins", () => {
    const game = testGame();

    game.players[1].coins = 0;

    const updated = declareSteal(
      game,
      "1",
      "2"
    );

    expect(updated.phase).toBe("claim_response");
    expect(updated.players[1].coins).toBe(0);
  });

  it("prevents stealing outside the player's turn", () => {
    const game = testGame();

    expect(() =>
      declareSteal(game, "2", "1")
    ).toThrow();
  });

  it("requires Coup instead at 10 or more coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();
  });

  it("prevents stealing while another action is pending", () => {
    let game = testGame();

    game = declareForeignAid(game, "1");

    expect(() =>
      declareSteal(game, "1", "2")
    ).toThrow();
  });

  it("does not mutate the original game", () => {
    const game = testGame();

    game.players[0].coins = 2;
    game.players[1].coins = 4;

    declareSteal(game, "1", "2");

    expect(game.phase).toBe("turn_start");
    expect(game.pendingAction).toBeNull();

    expect(game.players[0].coins).toBe(2);
    expect(game.players[1].coins).toBe(4);
  });
});

describe("Exchange", () => {
  it("starts an Ambassador claim", () => {
    const game = testGame();

    const originalDeck = [...game.deck];
    const originalHand = [...game.players[0].hand];

    const updated = declareExchange(
      game,
      "1"
    );

    expect(updated.phase).toBe(
      "claim_response"
    );

    expect(updated.pendingAction).toEqual({
      type: "claim",
      action: "exchange",
      actorId: "1",
      claimedRole: "Ambassador",
      passedPlayerIds: [],
      challenge: null,
    });

    // Cards are NOT drawn until the
    // Ambassador claim succeeds.
    expect(updated.deck).toEqual(
      originalDeck
    );

    expect(updated.players[0].hand).toEqual(
      originalHand
    );
  });

  it("prevents exchanging outside the player's turn", () => {
    const game = testGame();

    expect(() =>
      declareExchange(game, "2")
    ).toThrow();
  });

  it("requires Coup instead at 10 or more coins", () => {
    const game = testGame();

    game.players[0].coins = 10;

    expect(() =>
      declareExchange(game, "1")
    ).toThrow();
  });

  it("prevents Exchange while another action is pending", () => {
    let game = testGame();

    game = declareForeignAid(
      game,
      "1"
    );

    expect(() =>
      declareExchange(game, "1")
    ).toThrow();
  });

  it("does not mutate the original game", () => {
    const game = testGame();

    declareExchange(game, "1");

    expect(game.phase).toBe("turn_start");
    expect(game.pendingAction).toBeNull();
  });
});