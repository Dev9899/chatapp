let socket;
let username = null;
let mySocketId = null;
let isTyping = false;
let typingUsers = new Set();

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message");
const usernameInput = document.getElementById("username");
const sendButton = document.getElementById("send");
const saveUsernameBtn = document.getElementById("saveusernamebtn");
const sideMenuBtn = document.getElementById('sidemenuBtn');
const sideMenu = document.getElementById('sidemenu');
const typingIndicator = document.querySelector('.indicator');
let typingTimeout;

// sideMenuBtn.addEventListener('click', () => {
//   if (sideMenu.style.display == 'block') {
//     sideMenu.style.display = 'none';
//   } else sideMenu.style.display = 'block';
// })

function updateTypingIndicator() {
  if (typingUsers.size === 0) {
    typingIndicator.style.display = 'none';
    typingIndicator.textContent = "";
  } else if (typingUsers.size === 1) {
    const name = [...typingUsers][0];
    typingIndicator.style.display = 'block';
    typingIndicator.textContent = `${name} is typing...`;
  } else {
    typingIndicator.style.display = 'block';
    typingIndicator.textContent = `Multiple people are typing...`;
  }
}

messageInput.addEventListener("input", () => {
  if (!socket) return;

  if (!isTyping) {
    isTyping = true;
    socket.emit("typing");
  }

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    isTyping = false;
    socket.emit("stop-typing");
  }, 1000);
});


async function init() {
  const res = await fetch("/session", { credentials: "same-origin" });
  const data = await res.json();

  if (data.username) {
    username = data.username;
    hideModal();
    connectSocket();
  } else {
    showModal();
  }
}

init();

const saveUsernameLogic = async () => {
  const value = usernameInput.value.trim();
  if (!value) return;

  username = value;

  await fetch("/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username }),
  });
  
  hideModal();
  connectSocket();
};

saveUsernameBtn.addEventListener("click", saveUsernameLogic);

usernameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    saveUsernameLogic();
  }
});

function connectSocket() {
  socket = io();
  
  socket.on("connect", () => {
    mySocketId = socket.id;
    socket.emit("set-username", username);
  });

  socket.on("typing", ({ username }) => {
    typingUsers.add(username);
    updateTypingIndicator();
  });
  
  socket.on("stop-typing", ({ username }) => {
    typingUsers.delete(username);
    updateTypingIndicator();
  });

  socket.on("system-message", addSystemMessage);
  socket.on("chat-message", addChatMessage);
}

sendButton.onclick = () => {
  if (!socket) return;

  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("chat-message", { message });
  socket.emit("stop-typing");

  messageInput.value = "";
};

messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendButton.click();
});

function addChatMessage(data) {
  const div = document.createElement("div");
  div.classList.add("message");

  if (data.senderId === mySocketId) {
    div.classList.add("sentmsg");
    div.innerHTML = `
      <span id="msg">${data.message}</span>
    `;

  } else {
    div.classList.add("receivedmsg");
    div.innerHTML = `
      <span id="usrname">${data.username}</span>
      <span id="msg">${data.message}</span>
    `;
  }


  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function addSystemMessage(data) {
  const div = document.createElement("div");
  div.classList.add("system-message");
  div.textContent = data.message;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function hideModal() {
  document.querySelector(".modal").style.display = "none";
  document.querySelector(".modalback").style.display = "none";
}

function showModal() {
  document.querySelector(".modal").style.display = "block";
  document.querySelector(".modalback").style.display = "block";
}