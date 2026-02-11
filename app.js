const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

// ✅ ChatId dalla piattaforma esterna (persistente per sessione)
let chatId = localStorage.getItem("chat_id");

async function ensureChatId() {
  if (chatId) return chatId;

  const response = await fetch("https://innovasemplice.app.n8n.cloud/webhook/ab1fa3f9-7c06-4fa2-9a03-1c2c4bf96e67", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({})
  });

  const data = await response.json();
  chatId = data.chatId;
  localStorage.setItem("chat_id", chatId);
  return chatId;
}

// ✅ Escape per sicurezza
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ✅ Trasforma solo i link in <a>
function linkify(text) {
  if (!text) return text;
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );
  text = text.replace(
    /(https?:\/\/[^\s]+)\s+([A-ZÀ-üni0-9][^.,;!?]+)/g,
    (match, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label.trim())}</a>`
  );
  return text;
}

// ✅ Invio messaggio + streaming risposta
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  chat.innerHTML += `<div class="message user">Tu: ${escapeHtml(message)}</div>`;
  chat.scrollTop = chat.scrollHeight;
  input.value = "";

  // 1️⃣ Ottieni chatId (solo la prima volta)
  try {
    await ensureChatId();
  } catch (err) {
    chat.innerHTML += `<div class="message assistant">Errore nella creazione della chat. Riprova.</div>`;
    return;
  }

  // 2️⃣ Invia messaggio con chatId
  const response = await fetch("https://innovasemplice.app.n8n.cloud/webhook/d025b111-f4ca-4265-9cf6-6831b48833d0", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chatId,
      threadId: chatId,
      message
    })
  });

  // 🧠 Streaming reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let bufferNDJSON = "";
  let fullText = "";

  const assistantMsg = document.createElement("div");
  assistantMsg.className = "message assistant";
  assistantMsg.innerHTML = "Assistente: ";
  chat.appendChild(assistantMsg);

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    bufferNDJSON += decoder.decode(value, { stream: true });
    const lines = bufferNDJSON.split("\n");
    bufferNDJSON = lines.pop();

    for (let line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);
        if (json.type === "item" && json.content) {
          fullText += json.content;
          assistantMsg.innerHTML = "Assistente: " + linkify(fullText);
          chat.scrollTop = chat.scrollHeight;
        }
      } catch {}
    }
  }

  if (bufferNDJSON.trim()) {
    try {
      const json = JSON.parse(bufferNDJSON);
      if (json.type === "item" && json.content) {
        fullText += json.content;
        let html = marked.parse(fullText);
        html = linkify(html);
        assistantMsg.innerHTML = "Assistente: " + html;
      }
    } catch {}
  }
}

// ⚡ Event listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", e => e.key === "Enter" && sendMessage());
