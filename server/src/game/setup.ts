
import {
  type GameState,
  type LobbyPlayer,
  type PlayerState,
} from "./types.js";

import { createDeck, shuffleDeck } from "./deck.js";

// Initialize a new Coup match.
export function createGame(
  lobbyPlayers: LobbyPlayer[]
): GameState {
  // Validate the number of players.
  if (
    lobbyPlayers.length < 2 ||
    lobbyPlayers.length > 6
  ) {
    throw new Error(
      "Coup requires between 2 and 6 players."
    );
  }

  // Ensure that player IDs are unique.
  const ids = lobbyPlayers.map(
    (player) => player.id
  );

  if (
    ids.some((id) => !id.trim()) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error(
      "Players must have unique, non-empty IDs."
    );
  }

  // Ensure every player has a name.
  if (
    lobbyPlayers.some(
      (player) => !player.name.trim()
    )
  ) {
    throw new Error(
      "Every player must have a name."
    );
  }

  // Create and shuffle the deck.
  const deck = shuffleDeck(createDeck());

  // Initialize all players.
  const players: PlayerState[] = lobbyPlayers.map(
    (lobbyPlayer) => {
      // Deal two cards to each player.
      const firstCard = deck.pop()!;
      const secondCard = deck.pop()!;

      return {
        id: lobbyPlayer.id,
        name: lobbyPlayer.name,
        coins: 2,
        hand: [firstCard, secondCard],
        revealed: [],
      };
    }
  );

  // Return the initial game state.
  return {
  players,
  deck,
  currentPlayerIndex: 0,
  phase: "turn_start",
  pendingAction: null,
  winnerId: null,
};
}
