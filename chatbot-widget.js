(function () {
    "use strict";
  
    if (window.__AIChatbotLoaded) return;
    window.__AIChatbotLoaded = true;
  
    function getScriptQueryConfig() {
      try {
        /** @type {HTMLScriptElement | null} */
        const script =
          document.currentScript ||
          Array.from(document.getElementsByTagName("script"))
            .reverse()
            .find((s) => (s && s.src ? s.src.includes("chatbot-widget.js") : false)) ||
          null;

        if (!script || !script.src) return {};

        const u = new URL(script.src, window.location.href);
        const qp = u.searchParams;
        const out = {};

        const stringKeys = [
          "apiUrl",
          "projectId",
          "botName",
          "greeting",
          "placeholder",
          "primaryColor",
          "accentColor",
          "position",
        ];

        for (const k of stringKeys) {
          const v = qp.get(k);
          if (v != null && v !== "") out[k] = v;
        }

        if (out.position && out.position !== "left" && out.position !== "right") {
          delete out.position;
        }

        return out;
      } catch {
        return {};
      }
    }

    // ─── CONFIG — can be overridden via window or query params ────────────────
    const C = Object.assign({
      apiUrl:       "http://localhost:5500/api/v1/chat",   // your backend
      projectId:    "56068e8b-5642-4085-9a9e-798ccd7c436f",                                 // injected per customer
      botName:      "Assistant",
      greeting:     "Hi there 👋 Ask me anything!",
      placeholder:  "Type your message…",
      primaryColor: "#111827",
      accentColor:  "#6EE7B7",
      position:     "right",
    }, window.AIChatbotConfig || {}, getScriptQueryConfig());
  
    // ─── SHADOW HOST ──────────────────────────────────────────────────────────
    const host = document.createElement("div");
    host.id = "__ai-chatbot";
    host.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;";
    document.body.appendChild(host);
    const shadow = host.attachShadow({ mode: "closed" });
  
    // ─── STYLES ───────────────────────────────────────────────────────────────
    const style = document.createElement("style");
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      :host { font-family: 'Inter', system-ui, sans-serif; }

      /* ── Launcher ── */
      #launcher {
        position: fixed;
        bottom: 24px;
        ${C.position === "left" ? "left:24px" : "right:24px"};
        width: 52px; height: 52px;
        border-radius: 50%;
        background: ${C.primaryColor};
        border: none;
        cursor: pointer;
        pointer-events: all;
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 12px rgba(0,0,0,.4);
        transition: opacity .15s;
        outline: none;
      }
      #launcher:hover { opacity: .88; }

      .icon {
        position: absolute;
        width: 18px; height: 18px;
        transition: opacity .15s;
      }
      .icon-chat  { opacity: 1; }
      .icon-close { opacity: 0; }
      #launcher.open .icon-chat  { opacity: 0; }
      #launcher.open .icon-close { opacity: 1; }

      /* ── Window ── */
      #window {
        position: fixed;
        bottom: 88px;
        ${C.position === "left" ? "left:24px" : "right:24px"};
        width: 360px;
        height: 560px;
        background: #111318;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 16px;
        display: flex; flex-direction: column;
        overflow: hidden;
        pointer-events: none;
        box-shadow: 0 8px 40px rgba(0,0,0,.6);
        opacity: 0;
        transform: translateY(10px);
        transition: opacity .2s ease, transform .2s ease;
      }
      #window.open { opacity: 1; pointer-events: all; transform: translateY(0); }

      /* ── Header ── */
      #header {
        padding: 0 16px;
        height: 58px;
        background: #111318;
        border-bottom: 1px solid rgba(255,255,255,.06);
        display: flex; align-items: center; gap: 10px;
        flex-shrink: 0;
      }
      #avatar {
        width: 34px; height: 34px; border-radius: 50%;
        background: ${C.primaryColor};
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      #avatar svg { width: 16px; height: 16px; }
      #hinfo { flex: 1; min-width: 0; }
      #hname {
        color: #f1f5f9; font-size: 13.5px; font-weight: 600;
        letter-spacing: -.01em;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      #hstatus {
        color: #4b5563; font-size: 11px;
        display: flex; align-items: center; gap: 5px; margin-top: 1px;
      }
      #hstatus::before {
        content: ''; display: inline-block;
        width: 5px; height: 5px; border-radius: 50%;
        background: ${C.accentColor};
      }
      #hclose {
        width: 28px; height: 28px; border-radius: 50%;
        background: transparent;
        border: none;
        cursor: pointer; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: background .15s;
        outline: none;
      }
      #hclose:hover { background: rgba(255,255,255,.07); }
      #hclose svg { width: 14px; height: 14px; }

      /* ── Messages ── */
      #messages {
        flex: 1; overflow-y: auto;
        padding: 16px 14px;
        display: flex; flex-direction: column; gap: 12px;
        scroll-behavior: smooth;
      }
      #messages::-webkit-scrollbar { width: 3px; }
      #messages::-webkit-scrollbar-track { background: transparent; }
      #messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,.06); border-radius: 3px; }

      .msg { display: flex; flex-direction: column; max-width: 84%; }
      .msg.user { align-self: flex-end; align-items: flex-end; }
      .msg.bot  { align-self: flex-start; align-items: flex-start; }

      .msg-row { display: flex; align-items: flex-end; gap: 7px; }
      .msg.user .msg-row { flex-direction: row-reverse; }

      .bot-icon {
        width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0;
        background: ${C.primaryColor};
        display: flex; align-items: center; justify-content: center;
      }
      .bot-icon svg { width: 12px; height: 12px; }
      .msg.user .bot-icon { display: none; }

      .bubble {
        padding: 9px 13px;
        border-radius: 14px;
        font-size: 13.5px; line-height: 1.6;
        word-break: break-word;
        white-space: pre-wrap;
      }
      .msg.bot .bubble {
        background: #1c2030;
        color: #c8d3e0;
        border-bottom-left-radius: 4px;
        border: 1px solid rgba(255,255,255,.06);
      }
      .msg.user .bubble {
        background: ${C.accentColor};
        color: #0d1117;
        font-weight: 500;
        border-bottom-right-radius: 4px;
      }

      .ts { font-size: 10px; color: #2d3748; margin-top: 4px; padding: 0 4px; }

      /* ── Date divider ── */
      .divider {
        display: flex; align-items: center; gap: 10px;
        font-size: 10px; color: #2d3748; letter-spacing: .04em;
        text-transform: uppercase; margin: 2px 0;
      }
      .divider::before, .divider::after {
        content: ''; flex: 1; height: 1px;
        background: rgba(255,255,255,.05);
      }

      /* ── Typing dots ── */
      .typing .bubble {
        display: flex; align-items: center; gap: 4px;
        padding: 12px 14px;
      }
      .dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: #4b5563;
        animation: blink 1.2s ease-in-out infinite;
      }
      .dot:nth-child(2) { animation-delay: .2s; }
      .dot:nth-child(3) { animation-delay: .4s; }
      @keyframes blink {
        0%,100% { opacity: .3; } 50% { opacity: 1; }
      }

      /* ── Footer / Input ── */
      #footer {
        padding: 10px 12px 12px;
        border-top: 1px solid rgba(255,255,255,.06);
        display: flex; align-items: flex-end; gap: 8px;
        flex-shrink: 0;
        background: #111318;
      }
      #input-wrap {
        flex: 1;
        background: #1c2030;
        border: 1px solid rgba(255,255,255,.07);
        border-radius: 12px;
        display: flex; align-items: flex-end;
        padding: 2px 4px 2px 12px;
        transition: border-color .15s;
      }
      #input-wrap:focus-within { border-color: ${C.accentColor}55; }
      #input {
        flex: 1;
        background: transparent;
        border: none;
        padding: 8px 0;
        font-size: 13.5px; color: #e2e8f0;
        font-family: 'Inter', system-ui, sans-serif;
        outline: none; resize: none;
        max-height: 96px; overflow-y: auto;
        line-height: 1.5;
      }
      #input::placeholder { color: #374151; }
      #input::-webkit-scrollbar { width: 0; }

      #send {
        width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
        background: ${C.accentColor};
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: opacity .15s;
        outline: none; margin-bottom: 1px;
      }
      #send:hover:not(:disabled) { opacity: .85; }
      #send:disabled { opacity: .2; cursor: default; }
      #send svg { width: 14px; height: 14px; }

      /* ── Powered by ── */
      #poweredby {
        text-align: center; padding: 4px 0 8px;
        font-size: 10px; color: #1f2937;
        flex-shrink: 0; background: #111318;
      }
      #poweredby a { color: #374151; text-decoration: none; }
      #poweredby a:hover { color: ${C.accentColor}; }

      /* ── Mobile ── */
      @media (max-width: 430px) {
        #window {
          width: calc(100vw - 20px);
          ${C.position === "left" ? "left:10px" : "right:10px"};
          bottom: 84px; height: 70vh; border-radius: 14px;
        }
      }
    `;
    shadow.appendChild(style);
  
    // ─── HTML ─────────────────────────────────────────────────────────────────
    const root = document.createElement("div");
    root.innerHTML = `
      <button id="launcher" aria-label="Open chat">
        <svg class="icon icon-chat" viewBox="0 0 24 24" fill="none" stroke="${C.accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <svg class="icon icon-close" viewBox="0 0 24 24" fill="none" stroke="${C.accentColor}" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>

      <div id="window" role="dialog" aria-label="Chat window">
        <div id="header">
          <div id="avatar">
            <svg viewBox="0 0 24 24" fill="none" stroke="${C.accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
            </svg>
          </div>
          <div id="hinfo">
            <div id="hname">${C.botName}</div>
            <div id="hstatus">Online · Powered by AI</div>
          </div>
          <button id="hclose" aria-label="Close chat">
            <svg viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.5" stroke-linecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div id="messages">
          <div class="divider">Today</div>
        </div>

        <div id="footer">
          <div id="input-wrap">
            <textarea id="input" rows="1" placeholder="${C.placeholder}" aria-label="Your message"></textarea>
          </div>
          <button id="send" aria-label="Send message" disabled>
            <svg viewBox="0 0 24 24" fill="none" stroke="#0d1117" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
        <div id="poweredby">Powered by <a href="#" target="_blank">YourPlatform</a></div>
      </div>
    `;
    shadow.appendChild(root);
  
    // ─── REFS ─────────────────────────────────────────────────────────────────
    const launcher  = shadow.getElementById("launcher");
    const win       = shadow.getElementById("window");
    const messages  = shadow.getElementById("messages");
    const input     = shadow.getElementById("input");
    const sendBtn   = shadow.getElementById("send");
    const hclose    = shadow.getElementById("hclose");
  
    let isOpen    = false;
    let isLoading = false;
    let greeted   = false;
  
    // ─── HELPERS ──────────────────────────────────────────────────────────────
    function timestamp() {
      return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  
    function appendMessage(role, text) {
      const wrap = document.createElement("div");
      wrap.className = `msg ${role}`;

      const row = document.createElement("div");
      row.className = "msg-row";

      if (role === "bot") {
        const icon = document.createElement("div");
        icon.className = "bot-icon";
        icon.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="${C.accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>`;
        row.appendChild(icon);
      }

      const bubble = document.createElement("div");
      bubble.className = "bubble";
      bubble.textContent = text;
      row.appendChild(bubble);

      const ts = document.createElement("div");
      ts.className = "ts";
      ts.textContent = timestamp();

      wrap.appendChild(row);
      wrap.appendChild(ts);
      messages.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
      return wrap;
    }

    function showTyping() {
      const wrap = document.createElement("div");
      wrap.className = "msg bot typing";
      const row = document.createElement("div");
      row.className = "msg-row";
      row.innerHTML = `
        <div class="bot-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="${C.accentColor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
        </div>
        <div class="bubble"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>`;
      wrap.appendChild(row);
      messages.appendChild(wrap);
      messages.scrollTop = messages.scrollHeight;
      return wrap;
    }
  
    function setLoading(val) {
      isLoading = val;
      sendBtn.disabled = val || input.value.trim() === "";
      input.disabled   = val;
    }
  
    // ─── OPEN / CLOSE ─────────────────────────────────────────────────────────
    function openChat() {
      isOpen = true;
      launcher.classList.add("open");
      win.classList.add("open");
      input.focus();
      if (!greeted) {
        greeted = true;
        setTimeout(() => appendMessage("bot", C.greeting), 300);
      }
    }
  
    function closeChat() {
      isOpen = false;
      launcher.classList.remove("open");
      win.classList.remove("open");
    }
  
    launcher.addEventListener("click", () => isOpen ? closeChat() : openChat());
    hclose.addEventListener("click", closeChat);
  
    // ─── SEND MESSAGE ─────────────────────────────────────────────────────────
    async function sendMessage() {
      const text = input.value.trim();
      if (!text || isLoading) return;
  
      input.value = "";
      input.style.height = "auto";
      sendBtn.disabled = true;
  
      appendMessage("user", text);
      setLoading(true);
  
      const typingEl = showTyping();
  
      try {
        const res = await fetch(C.apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, projectId: C.projectId }),
        });
  
        const data = await res.json();
        typingEl.remove();
  
        if (!res.ok) throw new Error(data.error || "Server error");
  
        appendMessage("bot", data.answer);
      } catch (err) {
        typingEl.remove();
        appendMessage("bot", "Sorry, something went wrong. Please try again.");
        console.error("[AIChatbot]", err);
      } finally {
        setLoading(false);
      }
    }
  
    sendBtn.addEventListener("click", sendMessage);
  
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  
    // Enable send button when there's text
    input.addEventListener("input", () => {
      sendBtn.disabled = input.value.trim() === "" || isLoading;
      // Auto-grow textarea
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 96) + "px";
    });
  
    // ─── CLOSE ON OUTSIDE CLICK ───────────────────────────────────────────────
    document.addEventListener("click", (e) => {
      if (isOpen && !host.contains(e.target)) closeChat();
    });
  
  })();