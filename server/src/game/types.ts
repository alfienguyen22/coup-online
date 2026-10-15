
export const ROLES = [
  "Duke",
  "Assassin",
  "Captain",
  "Ambassador",
  "Contessa",
] as const;

export type Role = (typeof ROLES)[number];

export interface LobbyPlayer {
  id: string;
  name: string;
}

export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  hand: Role[];
  revealed: Role[];
}


export type GamePhase =
  | "turn_start"
  | "foreign_aid_response"
  | "foreign_aid_block_challenge"
  | "foreign_aid_block_influence_loss"
  | "coup_influence_loss"
  | "claim_response"
  | "challenge_influence_loss"
  | "game_over";



export interface PendingForeignAid {
  type: "foreign_aid";
  actorId: string;

  // Players who passed on the original Foreign Aid action.
  passedPlayerIds: string[];

  // Player claiming Duke to block the action.
  blockerId: string | null;

  // Players who passed on challenging the Duke block.
  blockPassedPlayerIds: string[];

  // Result of a challenge against the block, if any.
  blockChallenge: ChallengeResult | null;
}


export interface PendingCoup {
  type: "coup";
  actorId: string;
  targetId: string;
}

// Records the result of challenging a character claim.
export interface ChallengeResult {
  challengerId: string;
  claimantWasTruthful: boolean;
}

// A character claim waiting for player responses.
export interface PendingClaim {
  type: "claim";

  // Only Tax is implemented for now.
  action: "tax";

  actorId: string;
  claimedRole: Role;

  passedPlayerIds: string[];
  challenge: ChallengeResult | null;
}

export type PendingAction =
  | PendingForeignAid
  | PendingCoup
  | PendingClaim;

export interface GameState {
  players: PlayerState[];
  deck: Role[];
  currentPlayerIndex: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  winnerId: string | null;
}
