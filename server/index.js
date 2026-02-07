const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Tell Express where the frontend files are
app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Store username on the socket
  socket.on("join", (username) => {
    socket.username = username;

    io.emit("system-message", {
      message: `${username} joined the chat`
    });
  });

  socket.on("chat-message", (data) => {
    io.emit("chat-message", data);
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("system-message", {
        message: `${socket.username} left the chat`
      });
    }
  });
});


const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log("server running on port", PORT);
});
