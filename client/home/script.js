const joinBtn = document.getElementById("joinroombtn");
const createBtn = document.getElementById("createroombtn");
const usernameInput = document.getElementById("username");
const roomInput = document.getElementById("room");
const ownRoomInput = document.getElementById("ownRoom");
const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
}
ownRoomInput.value = generateRoomId();

joinBtn.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    const room = roomInput.value.trim();


    if (!username || !room) {
        alert("Please enter both username and room ID.");
        return;
    }

    const res = await fetch("/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin", 
        body: JSON.stringify({ roomId: room }),
    });

    const data = await res.json();
    if (!data.ok) {
        alert("Failed to create room");
        return;
    }

    localStorage.setItem("username", username);
    localStorage.setItem("room", room);

    roomInput.value = "";
    usernameInput.value = "";

    window.location.href = "/main?room=" + room;
});

createBtn.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    const room = ownRoomInput.value.trim();

    if (!username) {
        alert("Please enter your username.");
        return;
    }

    window.navigator.clipboard.writeText(room).then(() => {
        return;
    }).catch(() => {
        alert("Failed to copy Room ID. Please copy it manually: " + room);
    });

    const res = await fetch("/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin", 
        body: JSON.stringify({ roomId: room }),
    });

    const data = await res.json();
    if (!data.ok) {
        alert("Failed to create room");
        return;
    }

    localStorage.setItem("username", username);
    localStorage.setItem("room", room);

    usernameInput.value = "";
    roomInput.value = "";

    window.location.href = "/main?room=" + room;
});