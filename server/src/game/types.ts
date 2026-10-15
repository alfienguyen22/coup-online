
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
  | "coup_influence_loss"
  | "game_over";

export interface PendingForeignAid {
  type: "foreign_aid";
  actorId: string;
  passedPlayerIds: string[];
  blockerId: string | null;
}

export interface PendingCoup {
  type: "coup";
  actorId: string;
  targetId: string;
}

export type PendingAction =
  | PendingForeignAid
  | PendingCoup;

export interface GameState {
  players: PlayerState[];
  deck: Role[];
  currentPlayerIndex: number;
  phase: GamePhase;
  pendingAction: PendingAction | null;
  winnerId: string | null;
}
