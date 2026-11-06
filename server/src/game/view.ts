import type {
  GameState,
  PendingAction,
  PendingClaim,
  Role,
} from "./types.js";

export interface ClientPlayerState {
  id: string;
  name: string;
  coins: number;

  // Revealed cards are public information.
  revealed: Role[];

  // Everyone may know how many hidden influences remain.
  influenceCount: number;

  // Only the owner receives their actual hidden cards.
  hand?: Role[];
}

export interface ClientGameState {
  players: ClientPlayerState[];

  currentPlayerId: string | null;

  phase: GameState["phase"];

  pendingAction: PendingAction | null;

  winnerId: string | null;

  // Clients may know how many cards remain,
  // but never the actual Court deck order.
  deckSize: number;
}


// ------------------------------------------
// SANITIZE A PENDING ACTION
// ------------------------------------------

function sanitizePendingAction(
  action: PendingAction | null,
  viewerId: string
): PendingAction | null {
  if (!action) {
    return null;
  }

  if (action.type === "coup") {
    return {
      ...action,
    };
  }

  if (action.type === "foreign_aid") {
    return {
      ...action,

      passedPlayerIds: [
        ...action.passedPlayerIds,
      ],

      blockPassedPlayerIds: [
        ...action.blockPassedPlayerIds,
      ],

      blockChallenge:
        action.blockChallenge
          ? { ...action.blockChallenge }
          : null,
    };
  }

  // ----------------------------------------
  // CHARACTER CLAIM
  // ----------------------------------------

  const claim: PendingClaim = action;

  return {
    ...claim,

    passedPlayerIds: [
      ...claim.passedPlayerIds,
    ],

    challenge:
      claim.challenge
        ? { ...claim.challenge }
        : null,

    blockPassedPlayerIds:
      claim.blockPassedPlayerIds
        ? [...claim.blockPassedPlayerIds]
        : undefined,

    blockChallenge:
      claim.blockChallenge
        ? { ...claim.blockChallenge }
        : claim.blockChallenge,

    // Exchange cards are private.
    // Only the player performing the Exchange
    // is allowed to see them.
    exchangeDrawnCards:
      claim.action === "exchange" &&
      claim.actorId === viewerId &&
      claim.exchangeDrawnCards
        ? [...claim.exchangeDrawnCards]
        : undefined,
  };
}


// ------------------------------------------
// CREATE A PLAYER-SAFE GAME VIEW
// ------------------------------------------

export function serializeGameForPlayer(
  game: GameState,
  viewerId: string
): ClientGameState {
  const viewerExists = game.players.some(
    (player) => player.id === viewerId
  );

  if (!viewerExists) {
    throw new Error(
      "Cannot serialize game for an unknown player."
    );
  }

  const currentPlayer =
    game.players[game.currentPlayerIndex];

  return {
    players: game.players.map((player) => ({
      id: player.id,
      name: player.name,
      coins: player.coins,

      revealed: [
        ...player.revealed,
      ],

      influenceCount:
        player.hand.length,

      ...(player.id === viewerId
        ? {
            hand: [...player.hand],
          }
        : {}),
    })),

    currentPlayerId:
      currentPlayer?.id ?? null,

    phase: game.phase,

    pendingAction:
      sanitizePendingAction(
        game.pendingAction,
        viewerId
      ),

    winnerId: game.winnerId,

    deckSize: game.deck.length,
  };
}