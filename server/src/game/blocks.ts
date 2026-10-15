
import type {
  GameState,
  Role,
} from "./types.js";

import { shuffleDeck } from "./deck.js";
import { loseInfluence } from "./influence.js";
import { finishTurn } from "./turns.js";

// ------------------------------------------
// RESPOND TO A FOREIGN AID BLOCK
// ------------------------------------------

export function respondToForeignAidBlock(
  game: GameState,
  playerId: string,
  response: "pass" | "challenge"
): GameState {
  if (
    game.phase !== "foreign_aid_block_challenge" ||
    game.pendingAction?.type !== "foreign_aid"
  ) {
    throw new Error(
      "No Foreign Aid block is awaiting responses."
    );
  }

  const action = game.pendingAction;
  const blockerId = action.blockerId;

  if (!blockerId) {
    throw new Error("Blocker is missing.");
  }

  if (
    response !== "pass" &&
    response !== "challenge"
  ) {
    throw new Error("Invalid block response.");
  }

  const responder = game.players.find(
    (player) => player.id === playerId
  );

  if (!responder || responder.hand.length === 0) {
    throw new Error(
      "Only living players can respond."
    );
  }

  if (playerId === blockerId) {
    throw new Error(
      "You cannot challenge or pass on your own block."
    );
  }

  if (action.blockPassedPlayerIds.includes(playerId)) {
    throw new Error(
      "You have already passed on this block."
    );
  }

  // ----------------------------------------
  // PASS
  // ----------------------------------------

  if (response === "pass") {
    const blockPassedPlayerIds = [
      ...action.blockPassedPlayerIds,
      playerId,
    ];

    const eligibleResponders = game.players.filter(
      (player) =>
        player.hand.length > 0 &&
        player.id !== blockerId
    );

    // Everyone accepts the block.
    // Foreign Aid fails; no coins are awarded.
    if (
      blockPassedPlayerIds.length ===
      eligibleResponders.length
    ) {
      return finishTurn(game);
    }

    return {
      ...game,
      pendingAction: {
        ...action,
        blockPassedPlayerIds,
      },
    };
  }

  // ----------------------------------------
  // CHALLENGE THE DUKE BLOCK
  // ----------------------------------------

  const blocker = game.players.find(
    (player) => player.id === blockerId
  );

  if (!blocker || blocker.hand.length === 0) {
    throw new Error(
      "The blocker is no longer an active player."
    );
  }

  // Does the blocker really have Duke?
  const dukeIndex = blocker.hand.indexOf("Duke");

  const claimantWasTruthful = dukeIndex !== -1;

  let nextDeck = game.deck;
  let nextPlayers = game.players;

  // ----------------------------------------
  // TRUTHFUL DUKE CLAIM
  // ----------------------------------------

  if (claimantWasTruthful) {
    // Return the demonstrated Duke to the deck.
    nextDeck = shuffleDeck([
      ...game.deck,
      "Duke",
    ]);

    // Draw a replacement influence.
    const replacement = nextDeck.pop();

    if (!replacement) {
      throw new Error(
        "Cannot draw a replacement card."
      );
    }

    nextPlayers = game.players.map((player) => {
      if (player.id !== blockerId) {
        return player;
      }

      const hand = [...player.hand];

      // Replace exactly one Duke.
      hand.splice(dukeIndex, 1, replacement);

      return {
        ...player,
        hand,
      };
    });
  }

  // ----------------------------------------
  // RECORD THE CHALLENGE RESULT
  // ----------------------------------------

  return {
    ...game,
    deck: nextDeck,
    players: nextPlayers,
    phase: "foreign_aid_block_influence_loss",
    pendingAction: {
      ...action,
      blockChallenge: {
        challengerId: playerId,
        claimantWasTruthful,
      },
    },
  };
}

// ------------------------------------------
// RESOLVE BLOCK CHALLENGE INFLUENCE LOSS
// ------------------------------------------

export function resolveForeignAidBlockInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !== "foreign_aid_block_influence_loss" ||
    game.pendingAction?.type !== "foreign_aid"
  ) {
    throw new Error(
      "No block challenge influence loss is pending."
    );
  }

  const action = game.pendingAction;
  const challenge = action.blockChallenge;
  const blockerId = action.blockerId;

  if (!challenge || !blockerId) {
    throw new Error(
      "Block challenge information is missing."
    );
  }

  // Truthful block: challenger loses influence.
  // False block: blocker loses influence.
  const loserId = challenge.claimantWasTruthful
    ? challenge.challengerId
    : blockerId;

  if (playerId !== loserId) {
    throw new Error(
      "Only the losing player can reveal influence."
    );
  }

  const afterLoss = loseInfluence(
    game,
    playerId,
    card
  );

  // ----------------------------------------
  // TRUTHFUL BLOCK
  // ----------------------------------------

  if (challenge.claimantWasTruthful) {
    // The Duke block succeeds.
    // Foreign Aid is cancelled.
    return finishTurn(afterLoss);
  }

  // ----------------------------------------
  // FALSE BLOCK
  // ----------------------------------------

  // The Duke claim was a bluff.
  // Foreign Aid succeeds, granting 2 coins.
  const updatedPlayers = afterLoss.players.map(
    (player) =>
      player.id === action.actorId
        ? {
            ...player,
            coins: player.coins + 2,
          }
        : player
  );

  return finishTurn({
    ...afterLoss,
    players: updatedPlayers,
  });
}
