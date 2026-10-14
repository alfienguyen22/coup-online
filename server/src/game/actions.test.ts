
import { describe, expect, it } from "vitest";
import { createGame } from "./setup.js";
import {
  takeIncome,
  declareForeignAid,
  respondToForeignAid,
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

    expect(game.pendingAction?.blockerId).toBe("2");
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
