const socket = io();
let hasJoined = false;

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message");
const usernameInput = document.getElementById("username");
const sendButton = document.getElementById("send");
const saveUsernameBtn = document.getElementById('saveusernamebtn');
const savedUsername =localStorage.getItem('chatappUsername')
let username;

if (saveUsernameBtn) {
    username = saveUsernameBtn;
    usernameInput.disabled = true;
    document.querySelector('.modal').style.display = 'none';
    document.querySelector('.modalback').style.display = 'none';

    socket.emit('join', savedUsername);
    hasJoined = true;
} else {
    saveUsernameBtn.addEventListener('click', () => {
        username = usernameInput.value.trim();
        if (!username || hasJoined) return;

        localStorage.setItem('chatappUsername', username);
        socket.emit('join', username)
        hasJoined = true;
        usernameInput.disabled = true;
        document.querySelector('.modal').style.display = 'none';
        document.querySelector('.modalback').style.display = 'none';
        messageInput.focus();
    })
}

// Receive messages
socket.on("chat-message", (data) => {
  const div = document.createElement("div");
  div.classList.add("message");

  div.innerHTML = `<span class="username">${data.username}:</span> ${data.message}`;
  messagesDiv.appendChild(div);

  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on("system-message", (data) => {
  const div = document.createElement("div");
  div.classList.add("system-message");
  div.textContent = data.message;

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
});


// Send message
sendButton.onclick = () => {
  const message = messageInput.value;

  if (!hasJoined) {
    socket.emit("join", username);
    hasJoined = true;
  }

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
