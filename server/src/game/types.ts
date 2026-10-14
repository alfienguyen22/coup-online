
export const ROLES = [
  "Duke",
  "Assassin",
  "Captain",
  "Ambassador",
  "Contessa",
] as const;

export type Role = (typeof ROLES)[number];

// Player information supplied by the lobby.
export interface LobbyPlayer {
  id: string;
  name: string;
}

// Complete game state for an individual player.
// The hand must remain private.
export interface PlayerState {
  id: string;
  name: string;
  coins: number;
  hand: Role[];
  revealed: Role[];
}

// Game phases. More will be added later.
export type GamePhase =
  | "turn_start"
  | "game_over";

// Complete state of an active match.
export interface GameState {
  players: PlayerState[];
  deck: Role[];
  currentPlayerIndex: number;
  phase: GamePhase;
  winnerId: string | null;
}
