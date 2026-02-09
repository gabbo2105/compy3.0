// Session ID persistente
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

let isSending = false;

// Escape per sicurezza
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Trasforma link in <a>
function linkify(text) {
  if (!text) return text;

  // 1. Markdown [descrizione](url)
  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (match, label, url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`
  );

  // 2. URL seguiti da una descrizione
  text = text.replace(
    /(https?:\/\/[^\s]+)\s+([A-ZÀ-üni0-9][^.,;!?]+)/g,
    (match, url, label) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${escapeHtml(label.trim())}</a>`
  );

  return text;
}

// Scroll fluido verso il basso
function scrollToBottom() {
  chat.scrollTo({
    top: chat.scrollHeight,
    behavior: "smooth"
  });
}

// Mostra welcome screen
function showWelcome() {
  const welcome = document.createElement("div");
  welcome.className = "welcome-screen";
  welcome.id = "welcome";
  welcome.innerHTML = `
    <img src="LOGO COMPY.png" alt="Compy" class="welcome-logo" />
    <h2 class="welcome-title">Ciao! Sono Compy</h2>
    <p class="welcome-subtitle">Il tuo assistente virtuale. Come posso aiutarti?</p>
    <div class="welcome-suggestions">
      <button class="suggestion-chip">Come funzioni?</button>
      <button class="suggestion-chip">Cosa puoi fare?</button>
      <button class="suggestion-chip">Aiutami con un problema</button>
    </div>
  `;
  chat.appendChild(welcome);

  // Click su suggestion chip
  welcome.querySelectorAll(".suggestion-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      input.value = chip.textContent;
      sendMessage();
    });
  });
}

// Rimuovi welcome screen
function removeWelcome() {
  const welcome = document.getElementById("welcome");
  if (welcome) welcome.remove();
}

// Mostra typing indicator
function showTypingIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.id = "typing-indicator";
  indicator.innerHTML = `
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
    <span class="typing-dot"></span>
  `;
  chat.appendChild(indicator);
  scrollToBottom();
  return indicator;
}

// Rimuovi typing indicator
function removeTypingIndicator() {
  const indicator = document.getElementById("typing-indicator");
  if (indicator) indicator.remove();
}

// Crea messaggio nel DOM (evita innerHTML +=)
function addMessage(className, content) {
  const msg = document.createElement("div");
  msg.className = `message ${className}`;
  if (className === "user") {
    msg.textContent = content;
  } else {
    msg.innerHTML = content;
  }
  chat.appendChild(msg);
  scrollToBottom();
  return msg;
}

// Auto-resize textarea
function autoResize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 130) + "px";
}

// Invio messaggio + streaming risposta
async function sendMessage() {
  const message = input.value.trim();
  if (!message || isSending) return;

  isSending = true;
  sendBtn.disabled = true;

  // Rimuovi welcome screen
  removeWelcome();

  // Aggiungi messaggio utente
  addMessage("user", message);

  // Reset input
  input.value = "";
  input.style.height = "auto";

  // Mostra typing indicator
  const typingEl = showTypingIndicator();

  try {
    const response = await fetch("https://innovasemplice.app.n8n.cloud/webhook/d025b111-f4ca-4265-9cf6-6831b48833d0", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message })
    });

    if (!response.ok) {
      throw new Error(`Errore ${response.status}`);
    }

    // Rimuovi typing, crea bolla assistente
    removeTypingIndicator();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let bufferNDJSON = "";
    let fullText = "";

    const assistantMsg = document.createElement("div");
    assistantMsg.className = "message assistant";
    chat.appendChild(assistantMsg);

    // Loop streaming
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
            assistantMsg.innerHTML = linkify(fullText);
            scrollToBottom();
          }
        } catch {
          // chunk non JSON
        }
      }
    }

    // Elabora ultimo chunk
    if (bufferNDJSON.trim()) {
      try {
        const json = JSON.parse(bufferNDJSON);
        if (json.type === "item" && json.content) {
          fullText += json.content;
        }
      } catch {}
    }

    // Render finale con markdown
    if (fullText) {
      let html = marked.parse(fullText);
      html = linkify(html);
      assistantMsg.innerHTML = html;
      scrollToBottom();
    }

  } catch (error) {
    removeTypingIndicator();
    addMessage("error", "Non sono riuscito a rispondere. Riprova tra poco.");
  } finally {
    isSending = false;
    sendBtn.disabled = false;
    input.focus();
  }
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);

// Shift+Enter = nuova riga, Enter = invia
input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

// Auto-resize textarea
input.addEventListener("input", autoResize);

// Reset session
document.getElementById("new-chat").addEventListener("click", () => {
  localStorage.removeItem("session_id");
  location.reload();
});

// Inizializzazione
showWelcome();
input.focus();
