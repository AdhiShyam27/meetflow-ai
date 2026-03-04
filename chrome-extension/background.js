/**
 * MeetFlow AI — Background Service Worker (Manifest V3)
 * Handles messaging between content scripts, popup, and the web app.
 */

const APP_URL = "https://meetflow.ai"; // Change to localhost:3000 for dev

// ── Extension install / update ─────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: `${APP_URL}/signup?source=extension` });
  }
  if (reason === "update") {
    console.log("[MeetFlow AI] Extension updated to", chrome.runtime.getManifest().version);
  }
});

// ── Keyboard shortcut (Ctrl+Shift+T) ──────────────────────────────────────
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-transcription") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" });
    }
  }
});

// ── Action button click ────────────────────────────────────────────────────
chrome.action.onClicked.addListener(async (tab) => {
  // This fires when popup is NOT defined (fallback)
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_PANEL" }).catch(() => {
      // Tab doesn't have content script — open the dashboard
      chrome.tabs.create({ url: `${APP_URL}/dashboard` });
    });
  }
});

// ── Allowed sender validation ─────────────────────────────────────────────
// Only accept messages from our own content scripts (meeting platforms) or extension pages
function isAllowedSender(sender) {
  // Our own extension pages (service worker, popup) — always allowed
  if (sender.id === chrome.runtime.id && !sender.tab) return true;
  // Content script tab: must be a recognised meeting-platform URL
  if (sender.tab?.url) {
    const u = sender.tab.url;
    return (
      u.startsWith("https://meet.google.com") ||
      u.startsWith("https://zoom.us/wc") ||
      u.startsWith("https://teams.microsoft.com")
    );
  }
  return false;
}

// ── Message routing from content scripts ──────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Reject messages from unexpected origins to prevent content-script spoofing
  if (!isAllowedSender(sender)) {
    console.warn("[MeetFlow AI] Rejected message from unknown sender:", sender.tab?.url ?? sender.url);
    sendResponse({ error: "Unauthorized" });
    return false;
  }

  switch (msg.type) {

    case "RECORDING_STARTED":
      console.log("[MeetFlow AI] Recording started on", msg.platform);
      // Set badge to show recording indicator
      if (sender.tab?.id) {
        chrome.action.setBadgeText({ text: "REC", tabId: sender.tab.id });
        chrome.action.setBadgeBackgroundColor({ color: "#EF4444", tabId: sender.tab.id });
      }
      break;

    case "RECORDING_STOPPED":
      console.log("[MeetFlow AI] Recording stopped. Duration:", msg.duration, "s");
      // Clear badge
      if (sender.tab?.id) {
        chrome.action.setBadgeText({ text: "", tabId: sender.tab.id });
      }
      // Use session storage — cleared when the browser session ends
      chrome.storage.session.set({
        meetflow_pending_transcript: msg.transcript,
        meetflow_pending_duration: msg.duration,
        meetflow_pending_timestamp: Date.now(),
      });
      sendResponse({ ok: true });
      break;

    case "OPEN_DASHBOARD":
      chrome.tabs.create({ url: `${APP_URL}/dashboard/new?from=extension` });
      break;

    case "GET_AUTH_TOKEN":
      // Session storage for tokens — not persisted across browser restarts
      chrome.storage.session.get(["meetflow_token"], (result) => {
        sendResponse({ token: result.meetflow_token || null });
      });
      return true; // Keep message channel open for async response

    case "SET_AUTH_TOKEN":
      chrome.storage.session.set({ meetflow_token: msg.token });
      sendResponse({ ok: true });
      break;

    case "PING":
      sendResponse({ pong: true, version: chrome.runtime.getManifest().version });
      break;
  }
});

// ── Tab URL monitoring (show relevant badge state) ─────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return;

  const url = tab.url || "";
  const isMeetingPage =
    url.includes("meet.google.com") ||
    url.includes("zoom.us/wc") ||
    url.includes("teams.microsoft.com");

  if (isMeetingPage) {
    // Show "ON" badge when on a supported platform
    chrome.action.setBadgeText({ text: "ON", tabId });
    chrome.action.setBadgeBackgroundColor({ color: "#14B8A6", tabId });
  } else {
    chrome.action.setBadgeText({ text: "", tabId });
  }
});
