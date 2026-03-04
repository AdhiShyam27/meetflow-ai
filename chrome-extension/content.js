/**
 * MeetFlow AI — Content Script
 * Injected into Google Meet, Zoom, and MS Teams pages.
 * Handles live speech recognition and the floating transcript panel.
 */

(function () {
  "use strict";

  // ── State ──────────────────────────────────────────────────────────────────
  let recognition = null;
  let isRecording = false;
  let transcript = [];
  let interimText = "";
  let panelEl = null;
  let recordingSeconds = 0;
  let timerInterval = null;
  let currentSpeaker = "You";
  const speakers = ["You", "Speaker 2", "Speaker 3"];
  const speakerColors = ["#4F46E5", "#14B8A6", "#F59E0B"];
  let speakerIdx = 0;
  let meetingTitle = "";

  // ── Platform detection ─────────────────────────────────────────────────────
  function detectPlatform() {
    const host = window.location.hostname;
    if (host.includes("meet.google")) return "Google Meet";
    if (host.includes("zoom.us")) return "Zoom";
    if (host.includes("teams.microsoft")) return "MS Teams";
    return "Meeting";
  }

  // ── Inject floating panel ──────────────────────────────────────────────────
  function createPanel() {
    if (panelEl) return;

    panelEl = document.createElement("div");
    panelEl.id = "meetflow-panel";
    panelEl.innerHTML = `
      <div id="mf-header">
        <div id="mf-logo">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
          </svg>
          <span>MeetFlow AI</span>
        </div>
        <div id="mf-controls">
          <span id="mf-timer">00:00</span>
          <span id="mf-status-dot"></span>
          <button id="mf-speaker-btn" title="Switch speaker">👤 ${currentSpeaker}</button>
          <button id="mf-minimize-btn" title="Minimize">−</button>
          <button id="mf-close-btn" title="Close">×</button>
        </div>
      </div>
      <div id="mf-body">
        <div id="mf-transcript"></div>
        <div id="mf-interim"></div>
        <div id="mf-empty">
          <div id="mf-mic-icon">🎙️</div>
          <p>Waiting for speech…</p>
          <p class="mf-sub">Speak clearly into your microphone</p>
        </div>
      </div>
      <div id="mf-footer">
        <button id="mf-start-btn" class="mf-btn-primary">
          🎙️ Start Transcription
        </button>
        <button id="mf-stop-btn" class="mf-btn-danger" style="display:none">
          ⬛ Stop & Summarize
        </button>
        <button id="mf-copy-btn" class="mf-btn-ghost" style="display:none">
          📋 Copy
        </button>
      </div>
    `;

    panelEl.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 320px;
      max-height: 420px;
      background: #0F172A;
      border: 1px solid rgba(79,70,229,0.35);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(79,70,229,0.15);
      z-index: 999999;
      font-family: 'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif;
      font-size: 13px;
      color: #E2E8F0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
      user-select: none;
    `;

    document.body.appendChild(panelEl);

    injectStyles();
    attachPanelListeners();

    // Make draggable
    makeDraggable(panelEl, document.getElementById("mf-header"));
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      #meetflow-panel #mf-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px;
        background: rgba(79,70,229,0.15);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        cursor: move;
      }
      #meetflow-panel #mf-logo {
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 700;
        font-size: 12px;
        color: #A5B4FC;
      }
      #meetflow-panel #mf-logo svg {
        background: linear-gradient(135deg, #4F46E5, #14B8A6);
        border-radius: 4px;
        padding: 2px;
      }
      #meetflow-panel #mf-controls {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #meetflow-panel #mf-timer {
        font-size: 11px;
        color: #94A3B8;
        font-variant-numeric: tabular-nums;
      }
      #meetflow-panel #mf-status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #64748B;
      }
      #meetflow-panel #mf-status-dot.recording {
        background: #EF4444;
        animation: mf-pulse 1.2s infinite;
      }
      @keyframes mf-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      #meetflow-panel #mf-speaker-btn {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: #CBD5E1;
        font-size: 10px;
        padding: 2px 7px;
        border-radius: 6px;
        cursor: pointer;
      }
      #meetflow-panel #mf-minimize-btn,
      #meetflow-panel #mf-close-btn {
        background: transparent;
        border: none;
        color: #64748B;
        cursor: pointer;
        font-size: 14px;
        line-height: 1;
        padding: 0 2px;
      }
      #meetflow-panel #mf-minimize-btn:hover,
      #meetflow-panel #mf-close-btn:hover {
        color: #CBD5E1;
      }
      #meetflow-panel #mf-body {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        min-height: 180px;
        max-height: 260px;
        scroll-behavior: smooth;
      }
      #meetflow-panel #mf-body::-webkit-scrollbar { width: 4px; }
      #meetflow-panel #mf-body::-webkit-scrollbar-thumb { background: #334155; border-radius: 2px; }
      #meetflow-panel #mf-transcript .mf-line {
        margin-bottom: 10px;
      }
      #meetflow-panel .mf-speaker-name {
        font-size: 10px;
        font-weight: 700;
        margin-bottom: 2px;
      }
      #meetflow-panel .mf-line-text {
        font-size: 12px;
        line-height: 1.5;
        color: #CBD5E1;
      }
      #meetflow-panel #mf-interim {
        font-size: 12px;
        color: #64748B;
        font-style: italic;
        min-height: 16px;
        padding: 2px 0;
      }
      #meetflow-panel #mf-empty {
        text-align: center;
        padding: 24px 12px;
        color: #475569;
      }
      #meetflow-panel #mf-mic-icon {
        font-size: 28px;
        margin-bottom: 8px;
      }
      #meetflow-panel #mf-empty p { margin: 0; font-size: 12px; }
      #meetflow-panel .mf-sub { color: #334155; font-size: 10px; margin-top: 4px !important; }
      #meetflow-panel #mf-footer {
        padding: 10px;
        border-top: 1px solid rgba(255,255,255,0.06);
        display: flex;
        gap: 6px;
      }
      #meetflow-panel .mf-btn-primary {
        flex: 1;
        background: #4F46E5;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #meetflow-panel .mf-btn-primary:hover { background: #4338CA; }
      #meetflow-panel .mf-btn-danger {
        flex: 1;
        background: #EF4444;
        color: white;
        border: none;
        border-radius: 8px;
        padding: 7px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
      }
      #meetflow-panel .mf-btn-danger:hover { background: #DC2626; }
      #meetflow-panel .mf-btn-ghost {
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.1);
        color: #94A3B8;
        border-radius: 8px;
        padding: 7px 10px;
        font-size: 12px;
        cursor: pointer;
      }
      #meetflow-panel .mf-btn-ghost:hover { background: rgba(255,255,255,0.1); }
      #meetflow-panel.minimized #mf-body,
      #meetflow-panel.minimized #mf-footer {
        display: none;
      }
    `;
    document.head.appendChild(style);
  }

  function attachPanelListeners() {
    document.getElementById("mf-start-btn").addEventListener("click", startRecording);
    document.getElementById("mf-stop-btn").addEventListener("click", stopRecording);
    document.getElementById("mf-copy-btn").addEventListener("click", copyTranscript);
    document.getElementById("mf-close-btn").addEventListener("click", destroyPanel);
    document.getElementById("mf-minimize-btn").addEventListener("click", toggleMinimize);
    document.getElementById("mf-speaker-btn").addEventListener("click", cycleSpeaker);
  }

  // ── Speech Recognition ─────────────────────────────────────────────────────
  function startRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showNotification("Speech recognition requires Chrome browser.", "error");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            transcript.push({
              speaker: speakers[speakerIdx],
              color: speakerColors[speakerIdx],
              text,
              ts: recordingSeconds,
            });
            appendLine(speakers[speakerIdx], speakerColors[speakerIdx], text);
            saveToStorage();
          }
          interim = "";
        } else {
          interim += result[0].transcript;
        }
      }
      interimText = interim;
      updateInterim(interim);
    };

    recognition.onend = () => {
      if (isRecording) {
        try { recognition.start(); } catch { /* stopping */ }
      }
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") {
        showNotification(`Mic error: ${e.error}`, "error");
      }
    };

    recognition.start();
    isRecording = true;

    // Update UI
    document.getElementById("mf-start-btn").style.display = "none";
    document.getElementById("mf-stop-btn").style.display = "flex";
    document.getElementById("mf-status-dot").classList.add("recording");
    document.getElementById("mf-empty").style.display = "none";

    // Start timer
    recordingSeconds = 0;
    timerInterval = setInterval(() => {
      recordingSeconds++;
      const m = String(Math.floor(recordingSeconds / 60)).padStart(2, "0");
      const s = String(recordingSeconds % 60).padStart(2, "0");
      document.getElementById("mf-timer").textContent = `${m}:${s}`;
    }, 1000);

    // Send to background
    chrome.runtime.sendMessage({ type: "RECORDING_STARTED", platform: detectPlatform() });
  }

  function stopRecording() {
    recognition?.stop();
    recognition?.abort();
    isRecording = false;
    clearInterval(timerInterval);

    document.getElementById("mf-stop-btn").style.display = "none";
    document.getElementById("mf-start-btn").style.display = "flex";
    document.getElementById("mf-copy-btn").style.display = "flex";
    document.getElementById("mf-status-dot").classList.remove("recording");
    document.getElementById("mf-interim").textContent = "";

    const fullTranscript = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");

    // Send to background worker to open MeetFlow and auto-summarize
    chrome.runtime.sendMessage({
      type: "RECORDING_STOPPED",
      transcript: fullTranscript,
      duration: recordingSeconds,
      title: meetingTitle || detectPlatform() + " Meeting",
    });

    showNotification("Transcript saved! Opening MeetFlow AI…", "success");

    // Open the MeetFlow dashboard
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: "OPEN_DASHBOARD" });
    }, 1500);
  }

  function cycleSpeaker() {
    speakerIdx = (speakerIdx + 1) % speakers.length;
    currentSpeaker = speakers[speakerIdx];
    document.getElementById("mf-speaker-btn").textContent = `👤 ${currentSpeaker}`;
  }

  function appendLine(speaker, color, text) {
    const transcriptEl = document.getElementById("mf-transcript");
    const line = document.createElement("div");
    line.className = "mf-line";
    line.innerHTML = `
      <div class="mf-speaker-name" style="color:${color}">${speaker}</div>
      <div class="mf-line-text">${escapeHtml(text)}</div>
    `;
    transcriptEl.appendChild(line);
    // Scroll to bottom
    document.getElementById("mf-body").scrollTop = 9999;
  }

  function updateInterim(text) {
    document.getElementById("mf-interim").textContent = text || "";
  }

  function copyTranscript() {
    const text = transcript.map((l) => `${l.speaker}: ${l.text}`).join("\n");
    navigator.clipboard.writeText(text).then(() => {
      showNotification("Transcript copied to clipboard!", "success");
    });
  }

  function saveToStorage() {
    chrome.storage.local.set({
      meetflow_current_transcript: transcript,
      meetflow_recording_seconds: recordingSeconds,
    });
  }

  // ── Utilities ──────────────────────────────────────────────────────────────
  function toggleMinimize() {
    panelEl.classList.toggle("minimized");
    document.getElementById("mf-minimize-btn").textContent =
      panelEl.classList.contains("minimized") ? "+" : "−";
  }

  function destroyPanel() {
    if (recognition) { recognition.stop(); recognition.abort(); }
    clearInterval(timerInterval);
    panelEl?.remove();
    panelEl = null;
    isRecording = false;
  }

  function showNotification(msg, type = "info") {
    const notif = document.createElement("div");
    notif.style.cssText = `
      position: fixed;
      top: 80px;
      right: 24px;
      background: ${type === "error" ? "#EF4444" : type === "success" ? "#14B8A6" : "#4F46E5"};
      color: white;
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-family: 'Inter', sans-serif;
      z-index: 9999999;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      animation: mf-slide-in 0.3s ease;
    `;
    notif.textContent = msg;
    document.body.appendChild(notif);
    setTimeout(() => notif.remove(), 3500);
  }

  function makeDraggable(element, handle) {
    let ox = 0, oy = 0, x = 0, y = 0;

    handle.addEventListener("mousedown", (e) => {
      e.preventDefault();
      ox = e.clientX - element.getBoundingClientRect().left;
      oy = e.clientY - element.getBoundingClientRect().top;

      const move = (e) => {
        x = e.clientX - ox;
        y = e.clientY - oy;
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.right = "auto";
        element.style.bottom = "auto";
      };
      const up = () => {
        document.removeEventListener("mousemove", move);
        document.removeEventListener("mouseup", up);
      };
      document.addEventListener("mousemove", move);
      document.addEventListener("mouseup", up);
    });
  }

  function escapeHtml(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // ── Auto-init when on a meeting page ──────────────────────────────────────
  function autoInit() {
    // Read pending meeting title set by "Join & Record" on the dashboard
    try {
      const pending = localStorage.getItem("meetflow_pending_meeting");
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed && parsed.title) meetingTitle = parsed.title;
        localStorage.removeItem("meetflow_pending_meeting");
      }
    } catch { /* ignore */ }

    createPanel();

    // Show the meeting title in the panel header if we have one
    if (meetingTitle) {
      const logoSpan = panelEl.querySelector("#mf-logo span");
      if (logoSpan) logoSpan.textContent = meetingTitle;
    }

    // Auto-start transcription after 2 seconds (let the page fully load)
    setTimeout(() => {
      if (!isRecording) startRecording();
    }, 2000);
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  function init() {
    // Listen for messages from popup / background
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "TOGGLE_PANEL") {
        if (panelEl) {
          destroyPanel();
        } else {
          createPanel();
        }
      }
      if (msg.type === "START_RECORDING" && panelEl) {
        startRecording();
      }
    });

    // Auto-inject and auto-start when on a supported meeting platform
    const platform = detectPlatform();
    if (platform !== "Meeting") {
      // Small delay so the meeting page's own scripts don't interfere
      setTimeout(autoInit, 1500);
    }
  }

  // Wait for page to be ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
