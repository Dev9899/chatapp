let socket;
let username = localStorage.getItem("username");
let roomId = localStorage.getItem("room");
let mySocketId = null;
let senderId = null;
let isTyping = false;
let typingUsers = new Set();

const messagesDiv = document.getElementById("messages");
const messageInput = document.getElementById("message");
const roomIdInput2 = document.getElementById('roomidinput');
const joinRoomBtn = document.getElementById('joinroombtn');
const copyRoomIdBtn = document.getElementById('copyroomidbtn');
const leaveRoomBtn = document.getElementById('leaveroombtn');
const sendButton = document.getElementById("send");
const sideMenuBtn = document.getElementById('sidemenuBtn');
const sideMenu = document.getElementById('sidemenu');
const typingIndicator = document.querySelector('.indicator');
const gifBtn = document.getElementById("gifbtn");
const gifModal = document.getElementById("gifModal");
const closeGifModal = document.getElementById("closeGifModal");
const gifSearch = document.getElementById("gifSearch");
const resultsContainer = document.getElementById("gifResults");

let typingTimeout;

async function init() {
  const res = await fetch("/session", { credentials: "same-origin" });
  const data = await res.json();

  if (data.username) username = data.username;
  const urlParams = new URLSearchParams(window.location.search);
  if (!roomId) roomId = urlParams.get("room");

  if (!roomId || !username) {
    window.location.href = "/";
    return;
  }

  socket = io();
  connectSocket();
}

init();

sideMenuBtn.addEventListener('click', () => {
  if (sideMenu.style.display == 'block') {
    sideMenu.style.display = 'none';
  } else sideMenu.style.display = 'block';
});

function addChatMessage(data) {
  const div = document.createElement("div");
  div.classList.add("message");
  const time = new Date(data.time);
  const hours = time.getHours().toString().padStart(2, '0');
  const minutes = time.getMinutes().toString().padStart(2, '0');
  const formattedTime = `${hours}:${minutes}`;

  if (data.senderId === mySocketId) {
    if (data.type === "gif") {
      div.classList.add("sentmsg");
      div.innerHTML = `
      <img class="gif" src="${data.message}" alt="GIF"><br>
      <span id="timestamp">${formattedTime}</span>
      `;
    } else {
    div.classList.add("sentmsg");
    div.innerHTML = `
      <span id="msg">${data.message}</span><br>
      <span id="timestamp">${formattedTime}</span>
    `;
    }
  } else {
    if (data.type === "gif") {
      div.classList.add("receivedmsg");
      div.innerHTML = `
      <span id="usrname">${data.username}</span><br>
      <img class="gif" src="${data.message}" alt="GIF"><br>
      <span id="timestamp">${formattedTime}</span>
      `;
    } else {
    div.classList.add("receivedmsg");
    div.innerHTML = `
      <span id="usrname">${data.username}</span>
      <span id="msg">${data.message}</span><br>
      <span id="timestamp">${formattedTime}</span>
    `;
    }
  }
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

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
  connectSocket();
};

async function searchGifs(query) {
  try {
    const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
    return await res.json();
  } catch (err) {
    console.error("Error searching GIFs:", err);
    return { error: "Failed to search GIFs" };
  }
}

async function loadTrendingGifs() {
  try {
    const res = await fetch(`/api/gifs/search?q=trending`);
    return await res.json();
  } catch (err) {
    console.error("Error loading trending GIFs:", err);
    return { error: "Failed to load trending GIFs" };
  }
}

const sendGifMessage = (gifUrl) => {
  if (!socket) return;
  socket.emit("chat-message", {
    message: gifUrl, 
    type: "gif" 
  });
};

gifBtn.addEventListener("click", async () => {
  gifModal.classList.remove("hidden");

  const gifs = await loadTrendingGifs();
  displayGifs(gifs);
});

closeGifModal.addEventListener("click", () => {
  gifModal.classList.add("hidden");
});

window.addEventListener("click", (e) => {
  if (e.target === gifModal) {
    gifModal.classList.add("hidden");
  }
});

function displayGifs(gifs) {
  resultsContainer.innerHTML = "";

  gifs.forEach(gif => {
    const img = document.createElement("img");
    img.src = gif.preview;
    img.classList.add("gif-item");

    img.addEventListener("click", () => {
      sendGifMessage(gif.original);
    });

    resultsContainer.appendChild(img);
  });
}

let timeout;

gifSearch.addEventListener("input", () => {
  clearTimeout(timeout);

  timeout = setTimeout(async () => {
    const query = gifSearch.value.trim();

    if (!query) {
      const gifs = await loadTrendingGifs();
      displayGifs(gifs);
      return;
    }

    const gifs = await searchGifs(query);
    displayGifs(gifs);

  }, 400);
});


function connectSocket() {
  
  socket.on("connect", () => {
    mySocketId = socket.id;
    socket.emit("set-username", username);
    socket.emit("join-room", roomId);
  });
  
  socket.on("typing", ({ username }) => {
    typingUsers.add(username);
    updateTypingIndicator();
  });
  
  socket.on("stop-typing", ({ username }) => {
    typingUsers.delete(username);
    updateTypingIndicator();
  });

  socket.on("error-message", ({ message }) => {
    alert(message);
    window.location.href = "../";
  });

  socket.on("system-message", addSystemMessage);
  socket.on("chat-message", addChatMessage);
}

document.getElementById('fhj').textContent = `
  Share the room ID ${roomId} with your friends to start chatting.
`;

sendButton.onclick = () => {
  if (!socket) return;
  
  const message = messageInput.value.trim();
  if (!message) {
    return
  };

  socket.emit("chat-message", { message });
  socket.emit("stop-typing");

  messageInput.value = "";
};

messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") sendButton.click();
});

function addSystemMessage(data) {
  const div = document.createElement("div");
  div.classList.add("system-message");
  div.textContent = data.message;
  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

joinRoomBtn.addEventListener('click', async () => {
  const newRoomId = roomIdInput2.value.trim();
  if (!newRoomId) return;
  const currentRoom = localStorage.getItem("room");
  
  if (currentRoom == newRoomId) {
    alert("You are already in this room.");
    return;
  }
  
  try {
    const res = await fetch(`/room/${newRoomId}`);

    if (!res.ok) {
      alert("Room not found. Please check the Room ID and try again.");
      return;
    }
    localStorage.setItem("username", username);
    localStorage.setItem("room", newRoomId);

    window.location.href = `/main?room=${newRoomId}`;
  } catch (err) {
    console.error("Error joining room:", err);
    alert("An error occurred while trying to join the room. Please try again.");
  }

  window.location.href = `/main?room=${newRoomId}`;
})

leaveRoomBtn.addEventListener('click', () => {
  if (!socket) return;
  socket.emit("leave-room");
  window.location.href = "/";
  window.location.reload();
  if(localStorage.getItem("username") || localStorage.getItem("room")) {
    localStorage.removeItem("username");
    localStorage.removeItem("room");
  }a
})