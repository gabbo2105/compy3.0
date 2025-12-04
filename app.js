const chat = document.getElementById("chat");
const input = document.getElementById("input");
const send = document.getElementById("send");

function autoScroll() {
  chat.scrollTop = chat.scrollHeight;
}

function addMessage(text, sender) {
  const msg = document.createElement("div");
  msg.className = `message ${sender}`;
  msg.textContent = text;
  chat.appendChild(msg);
  autoScroll();
  return msg;
}

async function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");
  input.value = "";

  const aiMsg = addMessage("", "assistant");

  const response = await fetch("/api/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: text })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let partial = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    partial += decoder.decode(value, { stream: true });
    aiMsg.textContent = partial;
    autoScroll();
  }
}

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
