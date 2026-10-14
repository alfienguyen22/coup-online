
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";

// Create the Express application
const app = express();

// Create an HTTP server using Express
const httpServer = createServer(app);

// Create the Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const PORT = 3001;

// Test endpoint to verify the server is working
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    message: "Coup Online server is running!",
  });
});

// Handle players connecting to the server
io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  // Temporary test: broadcast messages to everyone
  socket.on("chat:send", (message: unknown) => {
    if (typeof message !== "string") return;

    const text = message.trim();

    if (!text || text.length > 200) return;

    io.emit("chat:message", {
      sender: socket.id.slice(0, 5),
      text,
    });
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
  });
});

// Start the server
httpServer.listen(PORT, () => {
  console.log(
    `Coup Online server running at http://localhost:${PORT}`
  );
});
