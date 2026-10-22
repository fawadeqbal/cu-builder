import { loadSettings } from "./lib/settings";

/** Opens the settings page right after install, so the person can paste their key. */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason !== "install") return;
  void loadSettings().then((s) => {
    if (!s.token) void chrome.runtime.openOptionsPage();
  });
});
