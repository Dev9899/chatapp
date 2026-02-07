const { ok } = require("assert");
const express = require("express");
const session = require("express-session")
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
app.set("trust proxy", 1)

const sessionMiddleware = session({
    secret: "super-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: "lax",
    }
});

app.use(express.json());
app.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "../client")));

const server = http.createServer(app);
const io = new Server(server);

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
})

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
})


io.on("connection", (socket) => {
  const session = socket.request.session;

  console.log("SESSION ID:", session.id);
  console.log("SESSION USER:", session.username);

  // If username already exists, attach it to socket
  if (session.username) {
    socket.username = session.username;
  }

  socket.on("set-username", (username) => {
    socket.username = username;

    io.emit("system-message", {
      message: `${username} joined the chat`,
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("system-message", {
        message: `${socket.username} left the chat`,
      });
    }
  });
});

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log("server running on port", PORT);
});
