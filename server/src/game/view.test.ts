import {
  describe,
  expect,
  it,
} from "vitest";

import { createGame } from "./setup.js";

import {
  serializeGameForPlayer,
} from "./view.js";

import type {
  GameState,
} from "./types.js";


function testGame(): GameState {
  const game = createGame([
    { id: "1", name: "Alfie" },
    { id: "2", name: "Diana" },
    { id: "3", name: "Alex" },
  ]);

  // Make the test deterministic.
  game.players[0].hand = [
    "Duke",
    "Captain",
  ];

  game.players[1].hand = [
    "Assassin",
    "Contessa",
  ];

  game.players[2].hand = [
    "Ambassador",
    "Duke",
  ];

  return game;
}


describe("Client game view", () => {
  it("shows a player their own hand", () => {
    const game = testGame();

    const view =
      serializeGameForPlayer(
        game,
        "1"
      );

    expect(
      view.players[0].hand
    ).toEqual([
      "Duke",
      "Captain",
    ]);
  });


  it("hides other players' hands", () => {
    const game = testGame();

    const view =
      serializeGameForPlayer(
        game,
        "1"
      );

    expect(
      view.players[1].hand
    ).toBeUndefined();

    expect(
      view.players[2].hand
    ).toBeUndefined();

    expect(
      view.players[1].influenceCount
    ).toBe(2);

    expect(
      view.players[2].influenceCount
    ).toBe(2);
  });


  it("shows revealed cards publicly", () => {
    const game = testGame();

    game.players[1].hand = [
      "Contessa",
    ];

    game.players[1].revealed = [
      "Assassin",
    ];

    const view =
      serializeGameForPlayer(
        game,
        "1"
      );

    expect(
      view.players[1].revealed
    ).toEqual([
      "Assassin",
    ]);

    expect(
      view.players[1].influenceCount
    ).toBe(1);
  });


  it("only shows Exchange cards to the player performing the Exchange", () => {
    const game = testGame();

    game.phase =
      "exchange_selection";

    game.pendingAction = {
      type: "claim",
      action: "exchange",
      actorId: "1",
      claimedRole: "Ambassador",
      passedPlayerIds: [],
      challenge: null,

      exchangeDrawnCards: [
        "Assassin",
        "Contessa",
      ],
    };

    const alfieView =
      serializeGameForPlayer(
        game,
        "1"
      );

    const dianaView =
      serializeGameForPlayer(
        game,
        "2"
      );

    if (
      alfieView.pendingAction?.type !==
      "claim"
    ) {
      throw new Error(
        "Expected a claim."
      );
    }

    if (
      dianaView.pendingAction?.type !==
      "claim"
    ) {
      throw new Error(
        "Expected a claim."
      );
    }

    expect(
      alfieView.pendingAction
        .exchangeDrawnCards
    ).toEqual([
      "Assassin",
      "Contessa",
    ]);

    expect(
      dianaView.pendingAction
        .exchangeDrawnCards
    ).toBeUndefined();
  });


  it("does not expose the actual Court deck", () => {
    const game = testGame();

    const view =
      serializeGameForPlayer(
        game,
        "1"
      );

    expect(view.deckSize).toBe(
      game.deck.length
    );

    expect(
      "deck" in view
    ).toBe(false);
  });


  it("does not mutate the real game state", () => {
    const game = testGame();

    const originalHand = [
      ...game.players[0].hand,
    ];

    const view =
      serializeGameForPlayer(
        game,
        "1"
      );

    view.players[0].hand?.pop();

    expect(
      game.players[0].hand
    ).toEqual(originalHand);
  });


  it("rejects an unknown viewer", () => {
    const game = testGame();

    expect(() =>
      serializeGameForPlayer(
        game,
        "999"
      )
    ).toThrow();
  });
});