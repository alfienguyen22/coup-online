import { randomInt } from "node:crypto";
import type { Server, Socket } from "socket.io";

import { createGame } from "./game/setup.js";
import { serializeGameForPlayer } from "./game/view.js";

import {
  takeIncome,
  takeCoup,
  resolveCoupInfluenceLoss,
} from "./game/actions.js";

import {
  ROLES,
  type GameState,
  type LobbyPlayer,
  type Role,
} from "./game/types.js";




interface Room {
  code: string;
  hostId: string;
  players: LobbyPlayer[];

  // Internal server-only state.
  // Never send this directly to clients.
  game: GameState | null;
}


interface ClientRoom {
  code: string;
  hostId: string;
  players: LobbyPlayer[];
  gameStarted: boolean;
}


// Store active rooms in server memory.
const rooms = new Map<string, Room>();

const CHARACTERS =
  "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";


// ------------------------------------------
// ROOM HELPERS
// ------------------------------------------
function isRole(
    value: unknown
  ): value is Role {
    return (
      typeof value === "string" &&
      ROLES.includes(value as Role)
    );
  }


function generateRoomCode(): string {
  let code: string;

  do {
    code = Array.from(
      { length: 6 },
      () =>
        CHARACTERS[
          randomInt(CHARACTERS.length)
        ]
    ).join("");
  } while (rooms.has(code));

  return code;
}


// Convert the internal Room into a safe lobby view.
function serializeRoom(
  room: Room
): ClientRoom {
  return {
    code: room.code,
    hostId: room.hostId,

    players: room.players.map(
      (player) => ({ ...player })
    ),

    gameStarted:
      room.game !== null,
  };
}


// Notify everyone when lobby information changes.
function broadcastRoom(
  io: Server,
  room: Room
): void {
  io.to(room.code).emit(
    "room:update",
    serializeRoom(room)
  );
}


// Send each player their own private game view.
function broadcastGameState(
  io: Server,
  room: Room
): void {
  if (!room.game) {
    return;
  }

  for (const player of room.players) {
    const playerSocket =
      io.sockets.sockets.get(
        player.id
      );

    if (!playerSocket) {
      continue;
    }

    playerSocket.emit(
      "game:state",
      serializeGameForPlayer(
        room.game,
        player.id
      )
    );
  }
}


// ------------------------------------------
// SOCKET HANDLERS
// ------------------------------------------

export function registerRoomHandlers(
  io: Server,
  socket: Socket
): void {

  // ----------------------------------------
  // CREATE ROOM
  // ----------------------------------------

  socket.on(
    "room:create",
    (
      name: unknown,
      callback
    ) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      if (socket.data.roomCode) {
        callback({
          success: false,
          error:
            "Already in a room.",
        });

        return;
      }

      if (
        typeof name !== "string" ||
        !name.trim()
      ) {
        callback({
          success: false,
          error:
            "Enter a valid name.",
        });

        return;
      }

      const playerName =
        name.trim().slice(0, 20);

      const code =
        generateRoomCode();

      const room: Room = {
        code,
        hostId: socket.id,

        players: [
          {
            id: socket.id,
            name: playerName,
          },
        ],

        game: null,
      };

      rooms.set(
        code,
        room
      );

      socket.join(code);

      socket.data.roomCode =
        code;

      callback({
        success: true,
        room: serializeRoom(room),
      });

      broadcastRoom(
        io,
        room
      );
    }
  );


  // ----------------------------------------
  // JOIN ROOM
  // ----------------------------------------

  socket.on(
    "room:join",
    (
      data,
      callback
    ) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      if (socket.data.roomCode) {
        callback({
          success: false,
          error:
            "Already in a room.",
        });

        return;
      }

      const code =
        typeof data?.code === "string"
          ? data.code
              .trim()
              .toUpperCase()
          : "";

      const name =
        typeof data?.name === "string"
          ? data.name
              .trim()
              .slice(0, 20)
          : "";

      if (!name) {
        callback({
          success: false,
          error:
            "Enter a valid name.",
        });

        return;
      }

      const room =
        rooms.get(code);

      if (!room) {
        callback({
          success: false,
          error:
            "Room not found.",
        });

        return;
      }

      // Don't allow new players to join
      // after the match begins.
      if (room.game) {
        callback({
          success: false,
          error:
            "This game has already started.",
        });

        return;
      }

      if (
        room.players.length >= 6
      ) {
        callback({
          success: false,
          error:
            "Room is full.",
        });

        return;
      }

      if (
        room.players.some(
          (player) =>
            player.name
              .toLowerCase() ===
            name.toLowerCase()
        )
      ) {
        callback({
          success: false,
          error:
            "Name already taken.",
        });

        return;
      }

      room.players.push({
        id: socket.id,
        name,
      });

      socket.join(code);

      socket.data.roomCode =
        code;

      callback({
        success: true,
        room: serializeRoom(room),
      });

      broadcastRoom(
        io,
        room
      );
    }
  );

  

  // ----------------------------------------
  // START GAME
  // ----------------------------------------

  socket.on(
    "game:start",
    (callback) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      const code =
        socket.data.roomCode;

      if (
        typeof code !== "string"
      ) {
        callback({
          success: false,
          error:
            "You are not in a room.",
        });

        return;
      }

      const room =
        rooms.get(code);

      if (!room) {
        callback({
          success: false,
          error:
            "Room not found.",
        });

        return;
      }

      if (
        room.hostId !== socket.id
      ) {
        callback({
          success: false,
          error:
            "Only the host can start the game.",
        });

        return;
      }

      if (room.game) {
        callback({
          success: false,
          error:
            "The game has already started.",
        });

        return;
      }

      if (
        room.players.length < 2
      ) {
        callback({
          success: false,
          error:
            "At least 2 players are required.",
        });

        return;
      }

      try {
        room.game =
          createGame(
            room.players
          );
      } catch {
        callback({
          success: false,
          error:
            "Unable to start the game.",
        });

        return;
      }

      callback({
        success: true,
      });

      // Tell lobby clients that the
      // room is now in-game.
      broadcastRoom(
        io,
        room
      );

      // Send each player their own
      // private game state.
      broadcastGameState(
        io,
        room
      );
    }
  );


  // ----------------------------------------
  // TAKE INCOME
  // ----------------------------------------

  socket.on(
    "game:income",
    (callback) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      const code =
        socket.data.roomCode;

      if (
        typeof code !== "string"
      ) {
        callback({
          success: false,
          error:
            "You are not in a room.",
        });

        return;
      }

      const room =
        rooms.get(code);

      if (!room) {
        callback({
          success: false,
          error:
            "Room not found.",
        });

        return;
      }

      if (!room.game) {
        callback({
          success: false,
          error:
            "The game has not started.",
        });

        return;
      }

      try {
        room.game = takeIncome(
          room.game,
          socket.id
        );
      } catch (error) {
        callback({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to take Income.",
        });

        return;
      }

      callback({
        success: true,
      });

      broadcastGameState(
        io,
        room
      );
    }
  );

  // ----------------------------------------
  // COUP
  // ----------------------------------------

  socket.on(
    "game:coup",
    (
      targetId: unknown,
      callback
    ) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      const code =
        socket.data.roomCode;

      if (
        typeof code !== "string"
      ) {
        callback({
          success: false,
          error:
            "You are not in a room.",
        });

        return;
      }

      const room =
        rooms.get(code);

      if (!room?.game) {
        callback({
          success: false,
          error:
            "No active game found.",
        });

        return;
      }

      if (
        typeof targetId !== "string"
      ) {
        callback({
          success: false,
          error:
            "Invalid Coup target.",
        });

        return;
      }

      try {
        room.game = takeCoup(
          room.game,
          socket.id,
          targetId
        );
      } catch (error) {
        callback({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to Coup.",
        });

        return;
      }

      callback({
        success: true,
      });

      broadcastGameState(
        io,
        room
      );
    }
  );


  // ----------------------------------------
  // RESOLVE COUP INFLUENCE LOSS
  // ----------------------------------------

  socket.on(
    "game:coup:lose-influence",
    (
      card: unknown,
      callback
    ) => {
      if (
        typeof callback !== "function"
      ) {
        return;
      }

      const code =
        socket.data.roomCode;

      if (
        typeof code !== "string"
      ) {
        callback({
          success: false,
          error:
            "You are not in a room.",
        });

        return;
      }

      const room =
        rooms.get(code);

      if (!room?.game) {
        callback({
          success: false,
          error:
            "No active game found.",
        });

        return;
      }

      if (!isRole(card)) {
        callback({
          success: false,
          error:
            "Invalid influence card.",
        });

        return;
      }

      try {
        room.game =
          resolveCoupInfluenceLoss(
            room.game,
            socket.id,
            card
          );
      } catch (error) {
        callback({
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to lose influence.",
        });

        return;
      }

      callback({
        success: true,
      });

      broadcastGameState(
        io,
        room
      );
    }
  );

  // ----------------------------------------
  // DISCONNECT
  // ----------------------------------------

  socket.on(
    "disconnect",
    () => {
      const code =
        socket.data.roomCode;

      if (
        typeof code !== "string"
      ) {
        return;
      }

      const room =
        rooms.get(code);

      if (!room) {
        return;
      }

      room.players =
        room.players.filter(
          (player) =>
            player.id !== socket.id
        );

      if (
        room.players.length === 0
      ) {
        rooms.delete(code);
        return;
      }

      // Transfer hosting if needed.
      if (
        room.hostId === socket.id
      ) {
        room.hostId =
          room.players[0].id;
      }

      broadcastRoom(
        io,
        room
      );
    }
  );
}