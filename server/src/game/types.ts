
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

// We will add more phases as we implement other actions.
export type GamePhase =
  | "turn_start"
  | "foreign_aid_response"
  | "foreign_aid_block_challenge"
  | "game_over";

// Tracks a Foreign Aid action that has not resolved yet.
export interface PendingForeignAid {
  type: "foreign_aid";
  actorId: string;
  passedPlayerIds: string[];
  blockerId: string | null;
}

export type PendingAction = PendingForeignAid;

export interface GameState {
  players: PlayerState[];
  deck: Role[];
  currentPlayerIndex: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  winnerId: string | null;
}
