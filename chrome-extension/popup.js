/**
 * MeetFlow AI — Popup Script
 */

const APP_URL = "https://meetflow.ai"; // or http://localhost:3000

let isRecording = false;
let timerInterval = null;
let seconds = 0;

const SUPPORTED_HOSTS = ["meet.google.com", "zoom.us", "teams.microsoft.com"];

function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function getPlatformLabel(url) {
  if (!url) return null;
  if (url.includes("meet.google")) return "Google Meet detected";
  if (url.includes("zoom.us")) return "Zoom detected";
  if (url.includes("teams.microsoft")) return "MS Teams detected";
  return null;
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  // Set version
  const manifest = chrome.runtime.getManifest();
  document.getElementById("ext-version").textContent = `v${manifest.version}`;

  // Check current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || "";
  const platformLabel = getPlatformLabel(tabUrl);
  const isOnMeeting = SUPPORTED_HOSTS.some((h) => tabUrl.includes(h));

  const platformBar = document.getElementById("platform-bar");
  const platformText = document.getElementById("platform-text");
  const btnStart = document.getElementById("btn-start");

  if (isOnMeeting && platformLabel) {
    platformBar.classList.remove("inactive");
    platformText.textContent = platformLabel;
    btnStart.disabled = false;
  } else {
    platformBar.classList.add("inactive");
    platformText.textContent = "Open Google Meet, Zoom, or Teams to start";
    btnStart.style.opacity = "0.6";
  }

  // Check if currently recording (from storage)
  chrome.storage.local.get(["meetflow_is_recording", "meetflow_seconds"], (result) => {
    if (result.meetflow_is_recording) {
      setRecordingState(true, result.meetflow_seconds || 0);
    }
  });

  // Button handlers
  document.getElementById("btn-start").addEventListener("click", async () => {
    if (!isOnMeeting) {
      chrome.tabs.create({ url: "https://meet.google.com" });
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    chrome.tabs.sendMessage(tab.id, { type: "START_RECORDING" });
    setRecordingState(true, 0);
    chrome.storage.local.set({ meetflow_is_recording: true });
    window.close();
  });

  document.getElementById("btn-stop").addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: "STOP_RECORDING" }).catch(() => {});
    setRecordingState(false, 0);
    chrome.storage.local.set({ meetflow_is_recording: false, meetflow_seconds: 0 });
    window.close();
  });

  // Quick links
  document.getElementById("open-dashboard").addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard` });
  });
  document.getElementById("open-new").addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/dashboard/new` });
  });
  document.getElementById("open-settings").addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/settings` });
  });
  document.getElementById("open-help").addEventListener("click", () => {
    chrome.tabs.create({ url: `${APP_URL}/help` });
  });
}

function setRecordingState(recording, startSeconds = 0) {
  isRecording = recording;
  const ring = document.getElementById("status-ring");
  const label = document.getElementById("status-label");
  const timer = document.getElementById("timer");
  const btnStart = document.getElementById("btn-start");
  const btnStop = document.getElementById("btn-stop");

  if (recording) {
    ring.classList.add("recording");
    ring.textContent = "🔴";
    label.textContent = "Recording in progress";
    timer.classList.add("visible");
    btnStart.style.display = "none";
    btnStop.classList.add("visible");

    seconds = startSeconds;
    timer.textContent = formatTime(seconds);
    timerInterval = setInterval(() => {
      seconds++;
      timer.textContent = formatTime(seconds);
      chrome.storage.local.set({ meetflow_seconds: seconds });
    }, 1000);
  } else {
    ring.classList.remove("recording");
    ring.textContent = "🎙️";
    label.textContent = "Ready to transcribe";
    timer.classList.remove("visible");
    btnStart.style.display = "flex";
    btnStop.classList.remove("visible");
    clearInterval(timerInterval);
  }
}

// ── Run ────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", init);
