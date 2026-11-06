
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

// ------------------------------------------
// RESPOND TO AN ASSASSINATION BLOCK
// ------------------------------------------

export function respondToAssassinationBlock(
  game: GameState,
  playerId: string,
  response: "pass" | "block"
): GameState {
  if (
    game.phase !== "assassination_block_response" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "assassinate"
  ) {
    throw new Error(
      "No Assassination block response is pending."
    );
  }

  const action = game.pendingAction;
  const targetId = action.targetId;

  if (!targetId) {
    throw new Error(
      "Assassination target is missing."
    );
  }

  // Only the player being assassinated can
  // choose whether to block.
  if (playerId !== targetId) {
    throw new Error(
      "Only the assassination target can respond."
    );
  }

  const target = game.players.find(
    (player) => player.id === targetId
  );

  if (!target || target.hand.length === 0) {
    throw new Error(
      "The assassination target is not an active player."
    );
  }

  // ----------------------------------------
  // PASS
  // ----------------------------------------

  // The target accepts the assassination.
  // They must now choose which influence to lose.
  if (response === "pass") {
    return {
      ...game,
      phase: "assassination_influence_loss",
    };
  }

  // ----------------------------------------
  // BLOCK WITH CONTESSA
  // ----------------------------------------

  // The target claims Contessa.
  // Other players will get a chance to challenge.
  return {
    ...game,
    phase: "assassination_block_challenge",

    pendingAction: {
      ...action,

      // Reset the response information because
      // we are starting a new challenge window.
      blockerId: targetId,
      blockPassedPlayerIds: [],
      blockChallenge: null,
    },
  };
}


// ------------------------------------------
// RESOLVE ASSASSINATION INFLUENCE LOSS
// ------------------------------------------

export function resolveAssassinationInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !== "assassination_influence_loss" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "assassinate"
  ) {
    throw new Error(
      "No Assassination influence loss is pending."
    );
  }

  const targetId = game.pendingAction.targetId;

  if (!targetId) {
    throw new Error(
      "Assassination target is missing."
    );
  }

  // Only the assassination target can lose
  // influence from this assassination.
  if (playerId !== targetId) {
    throw new Error(
      "Only the assassination target can reveal influence."
    );
  }

  const afterLoss = loseInfluence(
    game,
    playerId,
    card
  );

  // The assassination is now complete.
  return finishTurn(afterLoss);
}

// ------------------------------------------
// RESPOND TO A CONTESSA BLOCK
// ------------------------------------------

export function respondToAssassinationBlockChallenge(
  game: GameState,
  playerId: string,
  response: "pass" | "challenge"
): GameState {
  if (
    game.phase !== "assassination_block_challenge" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "assassinate"
  ) {
    throw new Error(
      "No Contessa block is awaiting responses."
    );
  }

  const action = game.pendingAction;
  const blockerId = action.blockerId;

  if (!blockerId) {
    throw new Error(
      "Contessa blocker is missing."
    );
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
      "You cannot respond to your own Contessa block."
    );
  }

  const passedPlayerIds =
    action.blockPassedPlayerIds ?? [];

  if (passedPlayerIds.includes(playerId)) {
    throw new Error(
      "You have already passed on this block."
    );
  }

  // ----------------------------------------
  // PASS
  // ----------------------------------------

  if (response === "pass") {
    const blockPassedPlayerIds = [
      ...passedPlayerIds,
      playerId,
    ];

    const eligibleResponders =
      game.players.filter(
        (player) =>
          player.hand.length > 0 &&
          player.id !== blockerId
      );

    // Everyone accepts the Contessa claim.
    // The assassination is cancelled.
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
  // CHALLENGE CONTESSA
  // ----------------------------------------

  const blocker = game.players.find(
    (player) => player.id === blockerId
  );

  if (!blocker || blocker.hand.length === 0) {
    throw new Error(
      "The Contessa claimant is not an active player."
    );
  }

  const contessaIndex =
    blocker.hand.indexOf("Contessa");

  const claimantWasTruthful =
    contessaIndex !== -1;

  let nextDeck = game.deck;
  let nextPlayers = game.players;

  // ----------------------------------------
  // TRUTHFUL CONTESSA
  // ----------------------------------------

  if (claimantWasTruthful) {
    // Return the demonstrated Contessa
    // to the deck.
    nextDeck = shuffleDeck([
      ...game.deck,
      "Contessa",
    ]);

    const replacement = nextDeck.pop();

    if (!replacement) {
      throw new Error(
        "Cannot draw a replacement card."
      );
    }

    nextPlayers = game.players.map(
      (player) => {
        if (player.id !== blockerId) {
          return player;
        }

        const hand = [...player.hand];

        hand.splice(
          contessaIndex,
          1,
          replacement
        );

        return {
          ...player,
          hand,
        };
      }
    );
  }

  return {
    ...game,

    deck: nextDeck,
    players: nextPlayers,

    phase:
      "assassination_block_influence_loss",

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
// RESOLVE CONTESSA CHALLENGE INFLUENCE LOSS
// ------------------------------------------

export function resolveAssassinationBlockInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !==
      "assassination_block_influence_loss" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "assassinate"
  ) {
    throw new Error(
      "No Contessa challenge influence loss is pending."
    );
  }

  const action = game.pendingAction;

  const blockerId = action.blockerId;
  const challenge = action.blockChallenge;

  if (!blockerId || !challenge) {
    throw new Error(
      "Contessa challenge information is missing."
    );
  }

  // Truthful Contessa:
  // challenger loses influence.
  //
  // False Contessa:
  // blocker loses influence.
  const loserId =
    challenge.claimantWasTruthful
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

  // If the influence loss ended the entire game,
  // don't perform any further action.
  if (afterLoss.phase === "game_over") {
    return afterLoss;
  }

  // ----------------------------------------
  // TRUTHFUL CONTESSA
  // ----------------------------------------

  if (challenge.claimantWasTruthful) {
    // Contessa successfully blocked.
    // Assassination is cancelled.
    return finishTurn(afterLoss);
  }

  // ----------------------------------------
  // FALSE CONTESSA
  // ----------------------------------------

  const target = afterLoss.players.find(
    (player) => player.id === blockerId
  );

  if (!target) {
    throw new Error(
      "Assassination target is missing."
    );
  }

  // If the failed challenge already eliminated
  // the target, the assassination cannot remove
  // another influence.
  if (target.hand.length === 0) {
    return finishTurn(afterLoss);
  }

  // The Contessa claim was false.
  // The assassination still succeeds, so the
  // target must lose another influence.
  return {
    ...afterLoss,

    phase: "assassination_influence_loss",

    pendingAction: action,
  };
}

// ------------------------------------------
// COMPLETE A SUCCESSFUL STEAL
// ------------------------------------------

function completeSteal(
  game: GameState,
  actorId: string,
  targetId: string
): GameState {
  const target = game.players.find(
    (player) => player.id === targetId
  );

  if (!target) {
    throw new Error(
      "Steal target is missing."
    );
  }

  const amountToSteal = Math.min(
    2,
    target.coins
  );

  const updatedPlayers = game.players.map(
    (player) => {
      if (player.id === actorId) {
        return {
          ...player,
          coins:
            player.coins + amountToSteal,
        };
      }

      if (player.id === targetId) {
        return {
          ...player,
          coins:
            player.coins - amountToSteal,
        };
      }

      return player;
    }
  );

  return finishTurn({
    ...game,
    players: updatedPlayers,
  });
}

// ------------------------------------------
// RESPOND TO A STEAL BLOCK
// ------------------------------------------

export function respondToStealBlock(
  game: GameState,
  playerId: string,
  response: "pass" | "captain" | "ambassador"
): GameState {
  if (
    game.phase !== "steal_block_response" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "steal"
  ) {
    throw new Error(
      "No Steal block response is pending."
    );
  }

  const action = game.pendingAction;
  const targetId = action.targetId;

  if (!targetId) {
    throw new Error(
      "Steal target is missing."
    );
  }

  if (playerId !== targetId) {
    throw new Error(
      "Only the steal target can respond."
    );
  }

  const target = game.players.find(
    (player) => player.id === targetId
  );

  if (!target || target.hand.length === 0) {
    throw new Error(
      "The steal target is not an active player."
    );
  }

  // ----------------------------------------
  // PASS
  // ----------------------------------------

  if (response === "pass") {
    return completeSteal(
      game,
      action.actorId,
      targetId
    );
  }

  // ----------------------------------------
  // BLOCK
  // ----------------------------------------

  const blockClaimedRole: Role =
    response === "captain"
      ? "Captain"
      : "Ambassador";

  return {
    ...game,

    phase: "steal_block_challenge",

    pendingAction: {
      ...action,

      blockerId: targetId,
      blockClaimedRole,
      blockPassedPlayerIds: [],
      blockChallenge: null,
    },
  };
}


// ------------------------------------------
// RESPOND TO A STEAL BLOCK CHALLENGE
// ------------------------------------------

export function respondToStealBlockChallenge(
  game: GameState,
  playerId: string,
  response: "pass" | "challenge"
): GameState {
  if (
    game.phase !== "steal_block_challenge" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "steal"
  ) {
    throw new Error(
      "No Steal block is awaiting responses."
    );
  }

  const action = game.pendingAction;

  const blockerId = action.blockerId;
  const blockClaimedRole =
    action.blockClaimedRole;

  if (!blockerId || !blockClaimedRole) {
    throw new Error(
      "Steal block information is missing."
    );
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
      "You cannot respond to your own block."
    );
  }

  const passedPlayerIds =
    action.blockPassedPlayerIds ?? [];

  if (passedPlayerIds.includes(playerId)) {
    throw new Error(
      "You have already passed on this block."
    );
  }

  // ----------------------------------------
  // PASS
  // ----------------------------------------

  if (response === "pass") {
    const blockPassedPlayerIds = [
      ...passedPlayerIds,
      playerId,
    ];

    const eligibleResponders =
      game.players.filter(
        (player) =>
          player.hand.length > 0 &&
          player.id !== blockerId
      );

    // Everyone accepts the block.
    // The Steal is cancelled.
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
  // CHALLENGE THE BLOCK
  // ----------------------------------------

  const blocker = game.players.find(
    (player) => player.id === blockerId
  );

  if (!blocker || blocker.hand.length === 0) {
    throw new Error(
      "The blocker is not an active player."
    );
  }

  const roleIndex = blocker.hand.indexOf(
    blockClaimedRole
  );

  const claimantWasTruthful =
    roleIndex !== -1;

  let nextDeck = game.deck;
  let nextPlayers = game.players;

  // ----------------------------------------
  // TRUTHFUL BLOCK
  // ----------------------------------------

  if (claimantWasTruthful) {
    nextDeck = shuffleDeck([
      ...game.deck,
      blockClaimedRole,
    ]);

    const replacement = nextDeck.pop();

    if (!replacement) {
      throw new Error(
        "Cannot draw a replacement card."
      );
    }

    nextPlayers = game.players.map(
      (player) => {
        if (player.id !== blockerId) {
          return player;
        }

        const hand = [...player.hand];

        hand.splice(
          roleIndex,
          1,
          replacement
        );

        return {
          ...player,
          hand,
        };
      }
    );
  }

  return {
    ...game,

    deck: nextDeck,
    players: nextPlayers,

    phase: "steal_block_influence_loss",

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
// RESOLVE STEAL BLOCK CHALLENGE
// ------------------------------------------

export function resolveStealBlockInfluenceLoss(
  game: GameState,
  playerId: string,
  card: Role
): GameState {
  if (
    game.phase !==
      "steal_block_influence_loss" ||
    game.pendingAction?.type !== "claim" ||
    game.pendingAction.action !== "steal"
  ) {
    throw new Error(
      "No Steal block challenge influence loss is pending."
    );
  }

  const action = game.pendingAction;

  const blockerId = action.blockerId;
  const challenge = action.blockChallenge;

  if (!blockerId || !challenge) {
    throw new Error(
      "Steal block challenge information is missing."
    );
  }

  const loserId =
    challenge.claimantWasTruthful
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

  // If this influence loss ended the game,
  // nothing else needs to resolve.
  if (afterLoss.phase === "game_over") {
    return afterLoss;
  }

  // ----------------------------------------
  // TRUTHFUL BLOCK
  // ----------------------------------------

  if (challenge.claimantWasTruthful) {
    // Captain/Ambassador successfully blocks.
    return finishTurn(afterLoss);
  }

  // ----------------------------------------
  // FALSE BLOCK
  // ----------------------------------------

  // The block was a bluff.
  // Therefore the original Steal succeeds.
  if (!action.targetId) {
    throw new Error(
      "Steal target is missing."
    );
  }

  return completeSteal(
    afterLoss,
    action.actorId,
    action.targetId
  );
}