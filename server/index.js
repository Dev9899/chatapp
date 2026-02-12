const express = require("express");
const session = require("express-session");
const socketAddress = require("net");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { captureRejectionSymbol } = require("events");
const authorizedRooms = new Set();
const roomUserCounts = new Map(); // Track users per room
const { type } = require("os");
require("dotenv").config();
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

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
  if (authorizedRooms.has(roomId)) {
    return res.status(400).json({ error: "Room already exists" });
  } 
  authorizedRooms.add(roomId);
  roomUserCounts.set(roomId, 0); // Initialize user count for new room

  rooms.add(roomId);
  res.json({ ok: true, roomId });
});

app.get("/room/:roomId", (req, res) => {
  const { roomId } = req.params;

  if (!authorizedRooms.has(roomId)) {
    return res.status(404).json({ ok: false, error: "Room does not exist" });
  }

  res.json({ ok: true });
});

const GIPHY_API_KEY = process.env.GIPHY_API_KEY;

app.get("/api/gifs/search", async (req, res) => {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Search query required" });
  }

  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=21&rating=g`
    );
    const data = await response.json();

    const gifs = data.data.map(gif => ({
      preview: gif.images.fixed_height.url,
      original: gif.images.original.url,
    }));

    res.json(gifs);
  } catch (err) {
    console.error("Giphy API error:", err);
    res.status(500).json({ error: "Failed to fetch GIFs" });
  }
});

app.get("/api/gifs/trending", async (req, res) => {
  try {
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
    );
    
    const data = await response.json();

    const gifs = data.data.map(gif => ({
      preview: gif.images.fixed_height.url,
      original: gif.images.original.url,
    }));

    res.json(gifs);
  } catch (err) {
    console.error("Giphy API error:", err);
    res.status(500).json({ error: "Failed to fetch trending GIFs" });
  }
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
    });
  });

  socket.on("join-room", (roomId) => {
    if (!socket.username) return;
    if (!roomId) return;
    if (!rooms.has(roomId)) return;
    if (!authorizedRooms.has(roomId)) {
      socket.emit("error-message", {
        message: "Room does not exist or you are not authorized to join",
      });
      return;
    } else {
      const currentCount = roomUserCounts.get(roomId) || 0;
      socket.to(roomId).emit("system-message", {
        message: `${socket.username} is trying to join the room...`,
        totalUsers: currentCount,
      });
      roomUserCounts.set(roomId, currentCount + 1);
    };

    if((roomUserCounts.get(roomId) || 0) <= 1) {
      socket.emit("system-message", {
        message: "You are the only user in this room. Share the room ID to invite others!",
      });
    }
    console.log(roomUserCounts);

    socket.join(roomId);
    socket.roomId = roomId;

    socket.to(roomId).emit("system-message", {
      message: `${socket.username} joined the room`,
    });

    socket.emit("joined-room", roomId);
  });

  socket.on("chat-message", ({ message, type }) => {
    if (!socket.username || !socket.roomId) return;

    io.to(socket.roomId).emit("chat-message", {
      username: socket.username,
      message,
      type: type || "text",
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
    const currentCount = roomUserCounts.get(socket.roomId) || 0;
    const newCount = currentCount - 1;
    roomUserCounts.set(socket.roomId, newCount);
    console.log(`Total Users before disconnect: ${currentCount}, after disconnect: ${newCount}`);
    console.log(`total rooms before deletion: ${[...rooms].join(", ")}`);
    if(newCount <= 1) {
      socket.to(socket.roomId).emit("system-message", {
        message: "You are the only user left in this room. Share the room ID to invite others.\nRoom will be deleted when the last user leaves.",
      });
    } 
    if (newCount <= 0) {
      roomUserCounts.delete(socket.roomId);
      authorizedRooms.delete(socket.roomId);
      rooms.delete(socket.roomId);
      console.log(`Room ${socket.roomId} deleted due to inactivity`);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("server running on port", PORT);
})