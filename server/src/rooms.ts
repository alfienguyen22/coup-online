
import { randomInt } from "node:crypto";
import type { Server, Socket } from "socket.io";

interface Player {
  id: string;
  name: string;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
}

// Store active rooms in server memory.
const rooms = new Map<string, Room>();

const CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Generate a unique six-character room code.
function generateRoomCode(): string {
  let code: string;

  do {
    code = Array.from(
      { length: 6 },
      () => CHARACTERS[randomInt(CHARACTERS.length)]
    ).join("");
  } while (rooms.has(code));

  return code;
}

// Notify everyone in a room when something changes.
function broadcastRoom(io: Server, room: Room): void {
  io.to(room.code).emit("room:update", room);
}

export function registerRoomHandlers(
  io: Server,
  socket: Socket
): void {
  // Create a new room.
  socket.on("room:create", (name: unknown, callback) => {
    if (typeof callback !== "function") return;

    if (socket.data.roomCode) {
      callback({ success: false, error: "Already in a room." });
      return;
    }

    if (typeof name !== "string" || !name.trim()) {
      callback({ success: false, error: "Enter a valid name." });
      return;
    }

    const playerName = name.trim().slice(0, 20);
    const code = generateRoomCode();

    const room: Room = {
      code,
      hostId: socket.id,
      players: [
        {
          id: socket.id,
          name: playerName,
        },
      ],
    };

    rooms.set(code, room);

    socket.join(code);
    socket.data.roomCode = code;

    callback({ success: true, room });
    broadcastRoom(io, room);
  });

  // Join an existing room.
  socket.on("room:join", (data, callback) => {
    if (typeof callback !== "function") return;

    if (socket.data.roomCode) {
      callback({ success: false, error: "Already in a room." });
      return;
    }

    const code =
      typeof data?.code === "string"
        ? data.code.trim().toUpperCase()
        : "";

    const name =
      typeof data?.name === "string"
        ? data.name.trim().slice(0, 20)
        : "";

    if (!name) {
      callback({ success: false, error: "Enter a valid name." });
      return;
    }

    const room = rooms.get(code);

    if (!room) {
      callback({ success: false, error: "Room not found." });
      return;
    }

    if (room.players.length >= 6) {
      callback({ success: false, error: "Room is full." });
      return;
    }

    if (
      room.players.some(
        (player) => player.name.toLowerCase() === name.toLowerCase()
      )
    ) {
      callback({ success: false, error: "Name already taken." });
      return;
    }

    room.players.push({
      id: socket.id,
      name,
    });

    socket.join(code);
    socket.data.roomCode = code;

    callback({ success: true, room });
    broadcastRoom(io, room);
  });

  // Remove disconnected players.
  socket.on("disconnect", () => {
    const code = socket.data.roomCode;

    if (typeof code !== "string") return;

    const room = rooms.get(code);
    if (!room) return;

    room.players = room.players.filter(
      (player) => player.id !== socket.id
    );

    if (room.players.length === 0) {
      rooms.delete(code);
      return;
    }

    // Transfer hosting if the host disconnects.
    if (room.hostId === socket.id) {
      room.hostId = room.players[0].id;
    }

    broadcastRoom(io, room);
  });
}
