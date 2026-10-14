
import type { GameState } from "./types.js";
import { finishTurn, getCurrentPlayer } from "./turns.js";

// Verify that a player can declare an action.
function validateTurnAction(
  game: GameState,
  playerId: string
): void {
  if (game.phase !== "turn_start") {
    throw new Error("The game is not accepting turn actions.");
  }

  const currentPlayer = getCurrentPlayer(game);

  if (currentPlayer.id !== playerId) {
    throw new Error("It is not your turn.");
  }

  if (currentPlayer.hand.length === 0) {
    throw new Error("Eliminated players cannot act.");
  }

  // Standard Coup rule: at 10+ coins, Coup is mandatory.
  if (currentPlayer.coins >= 10) {
    throw new Error(
      "You must Coup when you start with 10 or more coins."
    );
  }
}

// INCOME: Gain one coin. Cannot be blocked or challenged.
export function takeIncome(
  game: GameState,
  playerId: string
): GameState {
  validateTurnAction(game, playerId);

  const updatedPlayers = game.players.map((player) =>
    player.id === playerId
      ? { ...player, coins: player.coins + 1 }
      : player
  );

  return finishTurn({
    ...game,
    players: updatedPlayers,
  });
}

// FOREIGN AID: Declare an attempt to gain two coins.
// Other players must have an opportunity to block first.
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

// Respond to an active Foreign Aid declaration.
export function respondToForeignAid(
  game: GameState,
  playerId: string,
  response: "pass" | "block"
): GameState {
  if (
    game.phase !== "foreign_aid_response" ||
    game.pendingAction?.type !== "foreign_aid"
  ) {
    throw new Error("No Foreign Aid response is pending.");
  }

  const action = game.pendingAction;

  const responder = game.players.find(
    (player) => player.id === playerId
  );

  if (!responder || responder.hand.length === 0) {
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

  // Record that this player passed.
  const passedPlayerIds = [
    ...action.passedPlayerIds,
    playerId,
  ];

  const eligibleResponders = game.players.filter(
    (player) =>
      player.id !== action.actorId &&
      player.hand.length > 0
  );

  // Still waiting for other players.
  if (passedPlayerIds.length < eligibleResponders.length) {
    return {
      ...game,
      pendingAction: {
        ...action,
        passedPlayerIds,
      },
    };
  }

  // Everyone passed. Foreign Aid succeeds.
  const updatedPlayers = game.players.map((player) =>
    player.id === action.actorId
      ? { ...player, coins: player.coins + 2 }
      : player
  );

  return finishTurn({
    ...game,
    players: updatedPlayers,
  });
}
