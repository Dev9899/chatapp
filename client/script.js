const socket = io();

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message");
const usernameInput = document.getElementById("username");
const sendButton = document.getElementById("send");

// Receive messages
socket.on("chat-message", (data) => {
  const div = document.createElement("div");
  div.classList.add("message");

  div.innerHTML = `<span class="username">${data.username}:</span> ${data.message}`;
  messagesDiv.appendChild(div);

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

// Send message
sendButton.onclick = () => {
  const message = messageInput.value;
  const username = usernameInput.value || "Anonymous";

  if (!message) return;

  socket.emit("chat-message", {
    username,
    message
  });

  messageInput.value = "";
};

// Send on Enter
messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendButton.click();
  }
});
