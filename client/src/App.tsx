
import { useEffect, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import "./App.css";

interface ChatMessage {
  sender: string;
  text: string;
}

function App() {
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Connect to our Node.js backend
    const socket = io("http://localhost:3001", {
      autoConnect: false,
    });

    socketRef.current = socket;

    // Connection established
    socket.on("connect", () => {
      console.log("Connected:", socket.id);
      setConnected(true);
    });

    // Connection lost
    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setConnected(false);
    });

    // Receive messages from the server
    socket.on("chat:message", (message: ChatMessage) => {
      setMessages((previous) => [...previous, message]);
    });

    socket.connect();

    // Clean up when the component unmounts
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const message = input.trim();

    if (!message || !socketRef.current?.connected) {
      return;
    }

    // Send message to the server
    socketRef.current.emit("chat:send", message);

    setInput("");
  }

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Coup Online</h1>
        <p>Real-Time Multiplayer Test</p>

        <div className={`connection-status ${connected ? "online" : "offline"}`}>
          <span className="status-dot" />
          {connected ? "Connected to Server" : "Disconnected"}
        </div>
      </header>

      <main className="chat-container">
        <h2>Multiplayer Chat</h2>

        <div className="messages">
          {messages.length === 0 ? (
            <p className="empty-message">
              No messages yet. Send one to test multiplayer!
            </p>
          ) : (
            messages.map((message, index) => (
              <div key={index} className="message">
                <strong>Player {message.sender}:</strong>
                <span>{message.text}</span>
              </div>
            ))
          )}
        </div>

        <form onSubmit={sendMessage} className="message-form">
          <input
            type="text"
            placeholder="Type a message..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={200}
          />

          <button type="submit" disabled={!connected || !input.trim()}>
            Send
          </button>
        </form>
      </main>

      <footer>
        Coup Online — Multiplayer Development
      </footer>
    </div>
  );
}

export default App;
