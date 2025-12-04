const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

/* auto resize */
input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = input.scrollHeight + "px";
});

/* send on Enter */
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn.addEventListener("click", sendMessage);

function addMessage(text, sender="assistant") {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);

  if (sender === "assistant") msg.innerHTML = marked.parse(text);
  else msg.textContent = text;

  chat.appendChild(msg);
  chat.scrollTop = chat.scrollHeight;
}

function sendMessage() {
  const text = input.value.trim();
  if (!text) return;

  addMessage(text, "user");

  input.value = "";
  input.placeholder = "Scrivi un messaggio...";
  input.style.height = "auto";

  setTimeout(() => {
    addMessage("Risposta di esempio elaborata in markdown.

**Formattazione OK**

- Punto 1
- Punto 2");
  }, 500);
}
