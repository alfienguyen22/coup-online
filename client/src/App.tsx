
import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import "./App.css";

// Types matching our backend room structure
interface Player {
  id: string;
  name: string;
}

interface Room {
  code: string;
  hostId: string;
  players: Player[];
}

type RoomResponse =
  | { success: true; room: Room }
  | { success: false; error: string };

function App() {
  const [connected, setConnected] = useState(false);

  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [room, setRoom] = useState<Room | null>(null);
  const [error, setError] = useState("");

  const [pending, setPending] = useState<"create" | "join" | null>(null);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  // Connect to the backend when the page loads
  useEffect(() => {
    const socket = io("http://localhost:3001", {
      autoConnect: false,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setError("");
      console.log("Connected:", socket.id);
    });

    socket.on("disconnect", () => {
      setConnected(false);
      setRoom(null);
      setPending(null);
      setError("Connection lost. Please create or join a room again.");
    });

    socket.on("connect_error", () => {
      setError("Cannot connect to the server. Is the backend running?");
    });

    // Receive updates whenever players join or leave
    socket.on("room:update", (updatedRoom: Room) => {
      setRoom(updatedRoom);
    });

    socket.connect();

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // Handle responses from the server
  function handleRoomResponse(
    err: Error | null,
    response?: RoomResponse
  ) {
    setPending(null);

    if (err || !response) {
      setError("The server did not respond. Please try again.");
      return;
    }

    if (!response.success) {
      setError(response.error);
      return;
    }

    setRoom(response.room);
    setError("");
  }

  // Create a new private room
  function createRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const playerName = name.trim();
    const socket = socketRef.current;

    if (!playerName) {
      setError("Please enter your name.");
      return;
    }

    if (!socket?.connected) {
      setError("Not connected to the server.");
      return;
    }

    if (pending) return;

    setPending("create");
    setError("");

    socket.timeout(5000).emit(
      "room:create",
      playerName,
      handleRoomResponse
    );
  }

  // Join a friend's existing room
  function joinRoom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const playerName = name.trim();
    const code = joinCode.trim().toUpperCase();
    const socket = socketRef.current;

    if (!playerName) {
      setError("Please enter your name.");
      return;
    }

    if (code.length !== 6) {
      setError("Room codes must contain six characters.");
      return;
    }

    if (!socket?.connected) {
      setError("Not connected to the server.");
      return;
    }

    if (pending) return;

    setPending("join");
    setError("");

    socket.timeout(5000).emit(
      "room:join",
      { name: playerName, code },
      handleRoomResponse
    );
  }

  // Copy the room code to the clipboard
  async function copyCode() {
    if (!room) return;

    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
    } catch {
      setError("Unable to copy automatically. Please copy the code manually.");
    }
  }

  return (
    <div className="coup-app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-symbol">♠</span>
          <span>COUP ONLINE</span>
        </div>

        <div className={`server-status ${connected ? "online" : "offline"}`}>
          <span className="status-dot" />
          {connected ? "Server Connected" : "Disconnected"}
        </div>
      </header>

      <main className="page-content">
        {!room ? (
          <>
            <section className="welcome">
              <p className="eyebrow">MULTIPLAYER CARD GAME</p>
              <h1>Welcome to Coup Online</h1>
              <p>
                Bluff, challenge, and outsmart your friends.
                Create a private game or join an existing room.
              </p>
            </section>

            <section className="name-section panel">
              <label htmlFor="player-name">YOUR PLAYER NAME</label>
              <input
                id="player-name"
                type="text"
                placeholder="Enter your name..."
                maxLength={20}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </section>

            <div className="lobby-options">
              <section className="option-card panel">
                <div className="option-icon">+</div>
                <h2>Create a Game</h2>
                <p>
                  Start a private room and invite your friends
                  using a unique room code.
                </p>

                <form onSubmit={createRoom}>
                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!connected || pending !== null}
                  >
                    {pending === "create"
                      ? "Creating..."
                      : "Create Private Room"}
                  </button>
                </form>
              </section>

              <section className="option-card panel">
                <div className="option-icon">→</div>
                <h2>Join a Game</h2>
                <p>
                  Already have a room code?
                  Enter it below to join your friends.
                </p>

                <form onSubmit={joinRoom}>
                  <label htmlFor="room-code">ROOM CODE</label>

                  <input
                    id="room-code"
                    type="text"
                    placeholder="e.g. ABCD12"
                    maxLength={6}
                    value={joinCode}
                    onChange={(event) =>
                      setJoinCode(
                        event.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9]/g, "")
                      )
                    }
                  />

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={!connected || pending !== null}
                  >
                    {pending === "join"
                      ? "Joining..."
                      : "Join Room"}
                  </button>
                </form>
              </section>
            </div>
          </>
        ) : (
          <section className="game-lobby panel">
            <p className="eyebrow">PRIVATE GAME LOBBY</p>
            <h1>Waiting for Players</h1>

            <div className="room-code-section">
              <span>YOUR ROOM CODE</span>

              <div className="room-code-display">
                <strong>{room.code}</strong>

                <button
                  type="button"
                  className="copy-button"
                  onClick={() => void copyCode()}
                >
                  {copied ? "Copied!" : "Copy Code"}
                </button>
              </div>

              <p>Share this code with your friends to invite them.</p>
            </div>

            <div className="players-header">
              <h2>Players</h2>
              <span>{room.players.length} / 6</span>
            </div>

            <div className="player-list">
              {room.players.map((player) => (
                <div className="player-item" key={player.id}>
                  <div className="player-avatar">
                    {player.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="player-details">
                    <strong>
                      {player.name}
                      {player.id === socketRef.current?.id && " (You)"}
                    </strong>

                    <span>
                      {player.id === room.hostId ? "Host" : "Player"}
                    </span>
                  </div>

                  <span className="player-connected">●</span>
                </div>
              ))}
            </div>

            <div className="lobby-footer">
              <p>
                {room.players.length < 2
                  ? "Waiting for at least one more player..."
                  : "Players connected! Game start functionality is coming next."}
              </p>
              <span>
                A game will support 2–6 players.
              </span>
            </div>
          </section>
        )}

        {error && (
          <div className="error-message" role="alert">
            {error}
          </div>
        )}
      </main>

      <footer className="site-footer">
        Coup Online — Multiplayer Development
      </footer>
    </div>
  );
}

export default App;
