
import type {
  GameState,
  PlayerState,
} from "./types.js";

// Return the player whose turn it currently is.
export function getCurrentPlayer(
  game: GameState
): PlayerState {
  const player = game.players[game.currentPlayerIndex];

  if (!player) {
    throw new Error("Current player does not exist.");
  }

  return player;
}

// A player is alive if they have at least one hidden card.
export function isPlayerAlive(
  player: PlayerState
): boolean {
  return player.hand.length > 0;
}

// Finish the current turn and select the next living player.
export function finishTurn(
  game: GameState
): GameState {
  const alivePlayers = game.players.filter(isPlayerAlive);

  if (alivePlayers.length === 0) {
    throw new Error("No living players remain.");
  }

  // If only one player remains, the game is over.
  if (alivePlayers.length === 1) {
    return {
      ...game,
      phase: "game_over",
      winnerId: alivePlayers[0].id,
      pendingAction: null,
    };
  }

  const totalPlayers = game.players.length;

  // Search for the next living player.
  for (let offset = 1; offset <= totalPlayers; offset++) {
    const nextIndex =
      (game.currentPlayerIndex + offset) % totalPlayers;

    const nextPlayer = game.players[nextIndex];

    if (isPlayerAlive(nextPlayer)) {
      return {
        ...game,
        currentPlayerIndex: nextIndex,
        phase: "turn_start",
        pendingAction: null,
      };
    }
  }

  throw new Error("Unable to find the next player.");
}
