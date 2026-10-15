
import type {
  GameState,
  PendingClaim,
  Role,
} from "./types.js";

import { shuffleDeck } from "./deck.js";
import { loseInfluence } from "./influence.js";
import { finishTurn } from "./turns.js";

// Resolve an action after its character claim succeeds.
// We will add other actions here in future sections.
function resolveClaimEffect(
  game: GameState,
  claim: PendingClaim
): GameState {
  switch (claim.action) {
    case "tax":
      return finishTurn({
        ...game,
        players: game.players.map((player) =>
          player.id === claim.actorId
            ? { ...player, coins: player.coins + 3 }
            : player
        ),
      });
  }
}

// ------------------------------------------
// RESPOND TO A CHARACTER CLAIM
// ------------------------------------------

export function respondToClaim(
  game: GameState,
  playerId: string,
  response: "pass" | "challenge"
): GameState {
  // Validate the current game phase.
  if (
    game.phase !== "claim_response" ||
    game.pendingAction?.type !== "claim"
  ) {
    throw new Error(
      "There is no character claim to respond to."
    );
  }

  const claim = game.pendingAction;

  const responder = game.players.find(
    (player) => player.id === playerId
  );

  if (!responder || responder.hand.length === 0) {
    throw new Error(
      "Only living players can respond."
    );
  }

  if (playerId === claim.actorId) {
    throw new Error(
      "You cannot respond to your own claim."
    );
  }

  if (claim.passedPlayerIds.includes(playerId)) {
    throw new Error(
      "You already passed on this claim."
    );
  }

  if (response !== "pass" && response !== "challenge") {
    throw new Error("Invalid response.");
  }

  // ----------------------------------------
  // PLAYER PASSES
  // ----------------------------------------

  if (response === "pass") {
    const passedPlayerIds = [
      ...claim.passedPlayerIds,
      playerId,
    ];

    const eligibleResponders = game.players.filter(
      (player) =>
        player.id !== claim.actorId &&
        player.hand.length > 0
    );

    // Everyone passed: the claim succeeds.
    if (
      passedPlayerIds.length ===
      eligibleResponders.length
    ) {
      return resolveClaimEffect(game, claim);
    }

    // Otherwise, wait for the remaining players.
    return {
      ...game,
      pendingAction: {
        ...claim,
        passedPlayerIds,
      },
    };
  }

  // ----------------------------------------
  // PLAYER CHALLENGES
  // ----------------------------------------

  const claimant = game.players.find(
    (player) => player.id === claim.actorId
  );

  if (!claimant || claimant.hand.length === 0) {
    throw new Error(
      "The claimant is not an active player."
    );
  }

  // Check the claimed character on the server.
  const roleIndex = claimant.hand.indexOf(
    claim.claimedRole
  );

  const claimantWasTruthful = roleIndex !== -1;

  let nextDeck = game.deck;
  let nextPlayers = game.players;

  // ----------------------------------------
  // TRUTHFUL CLAIM
  // ----------------------------------------

  if (claimantWasTruthful) {
    // The claimed card is publicly demonstrated.
    // Return one copy to the deck and shuffle.
    nextDeck = shuffleDeck([
      ...game.deck,
      claim.claimedRole,
    ]);

    // Draw one replacement character.
    const replacement = nextDeck.pop();

    if (!replacement) {
      throw new Error(
        "Cannot draw a replacement card."
      );
    }

    nextPlayers = game.players.map((player) => {
      if (player.id !== claim.actorId) {
        return player;
      }

      // Remove exactly one copy of the claimed role.
      const hand = [...player.hand];
      hand.splice(roleIndex, 1);

      // Add the replacement card.
      hand.push(replacement);

      return {
        ...player,
        hand,
      };
    });
  }

  // ----------------------------------------
  // RECORD CHALLENGE RESULT
  // ----------------------------------------

  return {
    ...game,
    deck: nextDeck,
    players: nextPlayers,
    phase: "challenge_influence_loss",
    pendingAction: {
      ...claim,
      challenge: {
        challengerId: playerId,
        claimantWasTruthful,
      },
    },
  };
}

// ------------------------------------------
// RESOLVE CHALLENGE INFLUENCE LOSS
// ------------------------------------------

export function resolveClaimInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !== "challenge_influence_loss" ||
    game.pendingAction?.type !== "claim"
  ) {
    throw new Error(
      "No challenge influence loss is pending."
    );
  }

  const claim = game.pendingAction;
  const challenge = claim.challenge;

  if (!challenge) {
    throw new Error(
      "Challenge result is missing."
    );
  }

  // Determine who lost the challenge.
  const loserId = challenge.claimantWasTruthful
    ? challenge.challengerId
    : claim.actorId;

  if (playerId !== loserId) {
    throw new Error(
      "Only the losing player can reveal influence."
    );
  }

  // The losing player chooses which influence to lose.
  const afterLoss = loseInfluence(
    game,
    playerId,
    card
  );

  // Truthful claim:
  // The challenger loses influence,
  // and the original action succeeds.
  if (challenge.claimantWasTruthful) {
    return resolveClaimEffect(
      afterLoss,
      claim
    );
  }

  // False claim:
  // The claimant loses influence,
  // and the original action is cancelled.
  return finishTurn(afterLoss);
}
