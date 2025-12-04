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

  // 2. Gestione URL seguiti da una descrizione (es: URL Descrizione Documento) ciao
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

  // 📡 Chiamata al tuo webhook n8n
  const response = await fetch("https://innovasemplice.app.n8n.cloud/webhook-test/compy", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sessionId, message })
  });

  // 🧠 Streaming reader
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let bufferNDJSON = "";       // buffer delle righe NDJSON
  let fullText = "";           // testo completo generato dall'assistente

  const assistantMsg = document.createElement("div");
  assistantMsg.className = "message assistant";
  assistantMsg.innerHTML = "Assistente: ";
  chat.appendChild(assistantMsg);

  // 🔁 Loop streaming
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    bufferNDJSON += decoder.decode(value, { stream: true });

    // separa righe
    const lines = bufferNDJSON.split("\n");
    bufferNDJSON = lines.pop(); // salva l'ultima incompleta

    for (let line of lines) {
      if (!line.trim()) continue;
      try {
        const json = JSON.parse(line);

        if (json.type === "item" && json.content) {
          fullText += json.content;
          assistantMsg.innerHTML = "Assistente: " + linkify(fullText);
          chat.scrollTop = chat.scrollHeight;
        }
      } catch {
        // chunk non JSON — ignoro
      }
    }
  }

  // Elabora l'ultimo chunk se contiene testo
  if (bufferNDJSON.trim()) {
    try {
      const json = JSON.parse(bufferNDJSON);
      if (json.type === "item" && json.content) {
        fullText += json.content;
        let html = marked.parse(fullText);   // markdown → HTML
        html = linkify(html);                // aggiunge link a URL nudi
        assistantMsg.innerHTML = "Assistente: " + html;

      }
    } catch {}
  }
}

// ⚡ Event listeners
sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keypress", e => e.key === "Enter" && sendMessage());