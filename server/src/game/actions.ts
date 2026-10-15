
import type {
  GameState,
  Role,
} from "./types.js";

import {
  finishTurn,
  getCurrentPlayer,
} from "./turns.js";

import { loseInfluence } from "./influence.js";

// Verify that a player can declare an action.
function validateTurnAction(
  game: GameState,
  playerId: string,
  action: "coup" | "other" = "other"
): void {
  if (game.phase !== "turn_start") {
    throw new Error(
      "The game is not accepting turn actions."
    );
  }

  const currentPlayer = getCurrentPlayer(game);

  if (currentPlayer.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  if (currentPlayer.hand.length === 0) {
    throw new Error(
      "Eliminated players cannot act."
    );
  }

  // At 10+ coins, Coup is mandatory.
  if (
    currentPlayer.coins >= 10 &&
    action !== "coup"
  ) {
    throw new Error(
      "You must Coup when you have 10 or more coins."
    );
  }
}

// ------------------------------------------
// INCOME
// ------------------------------------------

// Gain one coin. Cannot be blocked or challenged.
export function takeIncome(
  game: GameState,
  playerId: string
): GameState {
  validateTurnAction(game, playerId);

  const updatedPlayers = game.players.map(
    (player) =>
      player.id === playerId
        ? { ...player, coins: player.coins + 1 }
        : player
  );

  return finishTurn({
    ...game,
    players: updatedPlayers,
  });
}

// ------------------------------------------
// FOREIGN AID
// ------------------------------------------

// Declare Foreign Aid and open a blocking window.
export function declareForeignAid(
  game: GameState,
  playerId: string
): GameState {
  validateTurnAction(game, playerId);

  return {
    ...game,
    phase: "foreign_aid_response",
    pendingAction: {
      type: "foreign_aid",
      actorId: playerId,
      passedPlayerIds: [],
      blockerId: null,
    },
  };
}

// Respond to a Foreign Aid declaration.
export function respondToForeignAid(
  game: GameState,
  playerId: string,
  response: "pass" | "block"
): GameState {
  if (
    game.phase !== "foreign_aid_response" ||
    game.pendingAction?.type !== "foreign_aid"
  ) {
    throw new Error(
      "No Foreign Aid response is pending."
    );
  }

  const action = game.pendingAction;

  const responder = game.players.find(
    (player) => player.id === playerId
  );

  if (
    !responder ||
    responder.hand.length === 0
  ) {
    throw new Error("Player cannot respond.");
  }

  if (playerId === action.actorId) {
    throw new Error(
      "The acting player cannot respond to their own action."
    );
  }

  if (action.passedPlayerIds.includes(playerId)) {
    throw new Error("Player has already passed.");
  }

  // Claim Duke to block Foreign Aid.
  if (response === "block") {
    return {
      ...game,
      phase: "foreign_aid_block_challenge",
      pendingAction: {
        ...action,
        blockerId: playerId,
      },
    };
  }

  const passedPlayerIds = [
    ...action.passedPlayerIds,
    playerId,
  ];

  const eligibleResponders = game.players.filter(
    (player) =>
      player.id !== action.actorId &&
      player.hand.length > 0
  );

  // Wait until all eligible players have passed.
  if (
    passedPlayerIds.length <
    eligibleResponders.length
  ) {
    return {
      ...game,
      pendingAction: {
        ...action,
        passedPlayerIds,
      },
    };
  }

  // All eligible players passed.
  const updatedPlayers = game.players.map(
    (player) =>
      player.id === action.actorId
        ? { ...player, coins: player.coins + 2 }
        : player
  );

  return finishTurn({
    ...game,
    players: updatedPlayers,
  });
}

// ------------------------------------------
// COUP
// ------------------------------------------

// Pay 7 coins to force a target to lose influence.
export function takeCoup(
  game: GameState,
  actorId: string,
  targetId: string
): GameState {
  validateTurnAction(game, actorId, "coup");

  const actor = getCurrentPlayer(game);

  if (actor.coins < 7) {
    throw new Error(
      "You need at least 7 coins to Coup."
    );
  }

  if (actorId === targetId) {
    throw new Error(
      "You cannot Coup yourself."
    );
  }

  const target = game.players.find(
    (player) => player.id === targetId
  );

  if (!target) {
    throw new Error("Target player not found.");
  }

  if (target.hand.length === 0) {
    throw new Error(
      "You cannot Coup an eliminated player."
    );
  }

  // Deduct 7 coins immediately.
  const updatedPlayers = game.players.map(
    (player) =>
      player.id === actorId
        ? { ...player, coins: player.coins - 7 }
        : player
  );

  return {
    ...game,
    players: updatedPlayers,
    phase: "coup_influence_loss",
    pendingAction: {
      type: "coup",
      actorId,
      targetId,
    },
  };
}

// Target chooses which card to reveal.
export function resolveCoupInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !== "coup_influence_loss" ||
    game.pendingAction?.type !== "coup"
  ) {
    throw new Error(
      "No Coup influence loss is pending."
    );
  }

  if (game.pendingAction.targetId !== playerId) {
    throw new Error(
      "Only the targeted player can reveal influence."
    );
  }

  // Remove the chosen influence.
  const updatedGame = loseInfluence(
    game,
    playerId,
    card
  );

  // Finish the turn after influence is lost.
  return finishTurn(updatedGame);
}
