const express = require("express");
const session = require("express-session");
const socketAddress = require("net");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { captureRejectionSymbol } = require("events");

const app = express();
app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionMiddleware = session({
  secret: "super-secret-key",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
  },
});

app.use(sessionMiddleware);

app.get("/session", (req, res) => {
  try {

    if (!req.session) {
      return res.status(500).json({ error: "Session missing" });
    }

    res.json({
      username: req.session.username || null,
    });
  } catch (err) {
    console.error("SESSION ERROR:", err);
    res.status(500).json({ error: "Session crashed" });
  }
});

const rooms = new Set();
app.post("/room", (req, res) => {
  const { roomId } = req.body;

  if (!roomId) {
    return res.status(400).json({ error: "Room ID is required" });
  }

  rooms.add(roomId);
  res.json({ ok: true, roomId });
});

app.use(express.static(path.join(__dirname, "../client")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/home/home.html"));
});

const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on("connection", (socket) => {
  const session = socket.request.session;

  if (session?.username) {
    socket.username = session.username;
  }

  socket.on("set-username", (username) => {
    const session = socket.request.session;

    if (!session) return;

    session.username = username;
    socket.username = username;
    
    session.save((err) => {
      if (err) {
        console.error("Error saving session:", err);
        return
      }

      console.log("Session saved with username:", session.username);
    });
  });

  socket.on("join-room", (roomId) => {
    if (!socket.username) return;
    if (!roomId) return;
    if (!rooms.has(roomId)) return;

    socket.join(roomId);
    socket.roomId = roomId;

    socket.to(roomId).emit("system-message", {
      message: `${socket.username} joined the room`,
    });

    socket.emit("joined-room", roomId);
  });

  socket.on("chat-message", ({ message }) => {
    if (!socket.username || !socket.roomId) return;

    io.to(socket.roomId).emit("chat-message", {
      username: socket.username,
      message,
      senderId: socket.id,
    });
  });

  socket.on("typing", () => {
    if (!socket.roomId || !socket.username) return;

    socket.to(socket.roomId).emit("typing", {
      username: socket.username,
    });
  });

  socket.on("stop-typing", () => {
    if (!socket.roomId || !socket.username) return;

    socket.to(socket.roomId).emit("stop-typing", {
      username: socket.username,
    });
  });

  socket.on("disconnect", () => {
    if (!socket.roomId || !socket.username) return;

    socket.to(socket.roomId).emit("system-message", {
      message: `${socket.username} left the room`,
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("server running on port", PORT);
})