/**
 * Magpie — service worker (design §8.5, §10)
 *
 * Badge, the keyboard command, and first-run. Deliberately small: an MV3
 * worker dies after ~30s idle, so it holds no state that matters.
 */

const BADGE_BG = "#E8B44A";
const BADGE_FG = "#17161A";

/** Per tab, always. Without tabId the badge is global and five open chat tabs
 *  overwrite each other's counts (§8.5). */
function setBadge(tabId, text, colour) {
  if (tabId == null) return;
  chrome.action.setBadgeText({ tabId, text: text || "" });
  if (text) {
    chrome.action.setBadgeBackgroundColor({ tabId, color: colour || BADGE_BG });
    if (chrome.action.setBadgeTextColor) chrome.action.setBadgeTextColor({ tabId, color: BADGE_FG });
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const tabId = sender && sender.tab && sender.tab.id;
  switch (msg && msg.type) {
    case "items:present":
      // v1 has no document class, so the badge stays empty by design: a count
      // of code blocks would be noise rather than a signal (§8.5).
      setBadge(tabId, msg.docs ? String(msg.docs) : "");
      break;
    case "items:none":
      setBadge(tabId, "");
      break;
    case "downloaded":
      setBadge(tabId, "✓", "#3F8F5E");
      setTimeout(() => setBadge(tabId, ""), 2000);
      break;
    case "error":
      setBadge(tabId, "!", "#C0392B");
      break;
  }
  if (reply) reply({ ok: true });
  return false;
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== "download-current") return;
  // tabId comes from the active tab; reading url/title would need the "tabs"
  // permission and we do not need those fields (§8.7).
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const id = tabs && tabs[0] && tabs[0].id;
    if (id == null) return;
    chrome.tabs.sendMessage(id, { type: "cmd:download" }, () => void chrome.runtime.lastError);
  });
});

chrome.runtime.onInstalled.addListener((details) => {
  // Only on install. Nobody wants a tab per update (§8.8).
  if (details.reason === "install") chrome.runtime.openOptionsPage();
});
