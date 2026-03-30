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

// ✅ Compy 3.0 API endpoint con streaming
const COMPY_API = "/ask/stream";

// ✅ Escape per sicurezza
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// ✅ Trasforma link in <a>
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

// ✅ Invio messaggio con streaming SSE
async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  // Disabilita input durante la risposta
  sendBtn.disabled = true;
  input.disabled = true;

  chat.innerHTML += `<div class="message user">Tu: ${escapeHtml(message)}</div>`;
  chat.scrollTop = chat.scrollHeight;
  input.value = "";

  const assistantMsg = document.createElement("div");
  assistantMsg.className = "message assistant";
  assistantMsg.innerHTML = "Assistente: <em>Ricerca nella knowledge base...</em>";
  chat.appendChild(assistantMsg);
  chat.scrollTop = chat.scrollHeight;

  let fullText = "";

  try {
    const response = await fetch(COMPY_API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: message })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || `Errore ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        if (!jsonStr.trim()) continue;

        try {
          const event = JSON.parse(jsonStr);

          if (event.type === "status") {
            assistantMsg.innerHTML = "Assistente: <em>" + escapeHtml(event.message) + "</em>";
          } else if (event.type === "token") {
            if (!fullText) {
              // Primo token — cancella il messaggio di status
              assistantMsg.innerHTML = "Assistente: ";
            }
            fullText += event.content;
            // Rendering progressivo con markdown
            let html = marked.parse(fullText);
            html = linkify(html);
            assistantMsg.innerHTML = "Assistente: " + html;
          } else if (event.type === "done") {
            if (event.answer) {
              let html = marked.parse(event.answer);
              html = linkify(html);
              assistantMsg.innerHTML = "Assistente: " + html;
            }
          } else if (event.type === "error") {
            assistantMsg.innerHTML = "Assistente: <em>Errore: " + escapeHtml(event.error) + "</em>";
          }

          chat.scrollTop = chat.scrollHeight;
        } catch {}
      }
    }

  } catch (error) {
    assistantMsg.innerHTML = "Assistente: <em>Errore: " + escapeHtml(error.message) + "</em>";
  }

  // Riabilita input
  sendBtn.disabled = false;
  input.disabled = false;
  input.focus();
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
