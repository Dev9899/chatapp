const express = require("express");
const session = require("express-session");
const http = require("http");
const { SocketAddress } = require("net");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
app.set("trust proxy", 1);

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

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "../client")));

const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

app.get("/session", (req, res) => {
  res.json({
    username: req.session.username || null,
  });
});

app.post("/session", (req, res) => {
  const { username } = req.body;
  if (username) {
    req.session.username = username;
  }
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  const session = socket.request.session;

  if (session?.username) {
    socket.username = session.username;
  }

  socket.on("set-username", (username) => {
    socket.username = username;
    session.username = username;
    session.save();

    io.emit("system-message", {
      message: `${username} joined the chat`,
    });
  });

  socket.on("chat-message", ({ message }) => {
    if (!socket.username) return;

    io.emit("chat-message", {
      username: socket.username,
      message,
      senderId: socket.id,
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("system-message", {
        message: `${socket.username} left the chat`,
      });
    }
  });

  socket.on("typing", () => {
  if (!socket.username) return;

    socket.broadcast.emit("typing", {
      username: socket.username,
    });
  });

  socket.on("stop-typing", () => {
    if (!socket.username) return;

    socket.broadcast.emit("stop-typing", {
    username: socket.username,
  });
});

});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("server running on port", PORT);
});
