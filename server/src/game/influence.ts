
import type {
  GameState,
  Role,
} from "./types.js";

// Reveal one influence from a player's hand.
// This function updates cards but does not advance turns.
export function loseInfluence(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  const player = game.players.find(
    (player) => player.id === playerId
  );

  if (!player) {
    throw new Error("Player not found.");
  }

  // Find one occurrence of the selected card.
  const cardIndex = player.hand.indexOf(card);

  if (cardIndex === -1) {
    throw new Error(
      "The selected card is not in the player's hand."
    );
  }

  const updatedPlayers = game.players.map(
    (currentPlayer) => {
      if (currentPlayer.id !== playerId) {
        return currentPlayer;
      }

      return {
        ...currentPlayer,

        // Remove exactly one selected card.
        hand: currentPlayer.hand.filter(
          (_, index) => index !== cardIndex
        ),

        // Add the lost card to the revealed pile.
        revealed: [
          ...currentPlayer.revealed,
          card,
        ],
      };
    }
  );

  return {
    ...game,
    players: updatedPlayers,
  };
}
