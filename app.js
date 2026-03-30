// ✅ Session ID persistente
function getSessionId() {
  let id = localStorage.getItem("session_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("session_id", id);
  }
  return id;
}

const sessionId = getSessionId();
const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");

// ✅ Compy 3.0 API endpoint — sostituisce il webhook n8n
const COMPY_API = "/ask";

// ✅ Escape per sicurezza (solo per visualizzazione)
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ✅ Trasforma solo i link in <a>, senza toccare il resto
function linkify(text) {
  if (!text) return text;

  // 1. Gestione Markdown [descrizione](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );

  // 2. Gestione URL seguiti da una descrizione
  text = text.replace(
    /(https?:\/\/[^\s]+)\s+([A-ZÀ-üni0-9][^.,;!?]+)/g,
    (match, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label.trim())}</a>`
  );

  return text;
}


// ✅ Invio messaggio a Compy 3.0 API
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  chat.innerHTML += `<div class="message user">Tu: ${escapeHtml(message)}</div>`;
  chat.scrollTop = chat.scrollHeight;
  input.value = "";

  // Mostra indicatore di caricamento
  const assistantMsg = document.createElement("div");
  assistantMsg.className = "message assistant";
  assistantMsg.innerHTML = "Assistente: <em>Sto cercando nella knowledge base...</em>";
  chat.appendChild(assistantMsg);
  chat.scrollTop = chat.scrollHeight;

  try {
    const response = await fetch(COMPY_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ query: message })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Errore ${response.status}`);
    }

    const data = await response.json();

    // Renderizza la risposta con markdown
    let html = marked.parse(data.answer);
    html = linkify(html);
    assistantMsg.innerHTML = "Assistente: " + html;

  } catch (error) {
    assistantMsg.innerHTML = "Assistente: <em>Errore: " + escapeHtml(error.message) + "</em>";
  }

  chat.scrollTop = chat.scrollHeight;
}

// ⚡ Event listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
