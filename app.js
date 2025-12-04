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


// -------------------------------------------------------
// 🔐 FUNZIONI DI UTILITÀ
// -------------------------------------------------------

// Escape per sicurezza minima
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// 🔗 Trasforma URL e Markdown links in <a>, SENZA toccare l’HTML già generato da Marked
function linkify(text) {
  if (!text) return text;

  // 1. Gestione Markdown [label](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );

  // 2. URL nudi seguiti da testo tipo "URL Documento X"
  text = text.replace(
    /(https?:\/\/[^\s]+)\s+([A-Za-zÀ-ÖØ-öø-ÿ0-9]+)/g,
    (match, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );

  return text;
}

// Abilita newline per Marked (importantissimo!)
if (typeof marked !== "undefined") {
  marked.setOptions({
    breaks: true
  });
}


// -------------------------------------------------------
// 🚀 INVIO MESSAGGIO + STREAMING RISPOSTA
// -------------------------------------------------------

async function sendMessage() {
  const message = input.value.trim();
  if (!message) return;

  // Mostra messaggio utente
  chat.innerHTML += `<div class="message user">Tu: ${escapeHtml(message)}</div>`;
  chat.scrollTop = chat.scrollHeight;
  input.value = "";

  // 📡 Chiamata al webhook n8n
  const response = await fetch("https://gabbo.app.n8n.cloud/webhook/orchestratore-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, message })
  });

  // STREAMING
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let bufferNDJSON = "";
  let fullText = "";

  // Messaggio dell’assistente
  const assistantMsg = document.createElement("div");
  assistantMsg.className = "message assistant";
  assistantMsg.innerHTML = "<strong>Assistente:</strong><br>";
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

          // 🔥 EVITA DI DISTRUGGERE LA SINTASSI MARKDOWN
          fullText += json.content + " ";

          // 🔥 RENDER LIVE: markdown → HTML
          let html = marked.parse(fullText);

          // 🔥 Aggiungi link dopo il markdown (senza romperlo)
          html = linkify(html);

          assistantMsg.innerHTML = "<strong>Assistente:</strong><br>" + html;

          chat.scrollTop = chat.scrollHeight;
        }
      } catch {
        // linea non interpretabile → ignoro
      }
    }
  }

  // Ultimo chunk
  if (bufferNDJSON.trim()) {
    try {
      const json = JSON.parse(bufferNDJSON);
      if (json.type === "item" && json.content) {

        fullText += json.content + " ";

        let html = marked.parse(fullText);
        html = linkify(html);

        assistantMsg.innerHTML = "<strong>Assistente:</strong><br>" + html;
      }
    } catch {}
  }
}


// -------------------------------------------------------
// 🎮 EVENT LISTENERS
// -------------------------------------------------------

sendBtn.addEventListener("click", sendMessage);

input.addEventListener("keypress", e => {
  if (e.key === "Enter") {
    e.preventDefault();
    sendMessage();
  }
});
