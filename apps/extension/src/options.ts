import { createApi, explain } from "./lib/api";
import { loadSettings, looksLikeToken, normaliseAppUrl, originPattern, saveSettings } from "./lib/settings";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const appUrl = $<HTMLInputElement>("appUrl");
const token = $<HTMLInputElement>("token");
const status = $<HTMLParagraphElement>("status");
const keysLink = $<HTMLAnchorElement>("keysLink");

function show(text: string, ok = false) {
  status.textContent = text;
  status.className = ok ? "ok" : text ? "err" : "";
}

function updateLink() {
  try {
    keysLink.href = `${normaliseAppUrl(appUrl.value)}/account#extension`;
  } catch {
    keysLink.removeAttribute("href");
  }
}

async function init() {
  const s = await loadSettings();
  appUrl.value = s.appUrl;
  token.value = s.token;
  updateLink();
}

appUrl.addEventListener("input", updateLink);

$<HTMLFormElement>("form").addEventListener("submit", (e) => {
  e.preventDefault();
  void (async () => {
    let url: string;
    try {
      url = normaliseAppUrl(appUrl.value);
    } catch {
      return show("Enter the address of your CV Builder, like https://cv.example.com");
    }
    if (!looksLikeToken(token.value)) return show("Paste the key from Account → Browser extension (it starts with cvb_).");
    // Host access to the app lets the extension call its API (asked once, on this click).
    const granted = await chrome.permissions.request({ origins: [originPattern(url)] });
    if (!granted) return show(`Allow access to ${new URL(url).host} so the extension can save jobs there.`);
    await saveSettings({ appUrl: url, token: token.value });
    appUrl.value = url;
    show("Checking…", true);
    try {
      const me = await createApi({ appUrl: url, token: token.value.trim() }).me();
      if (!me) return show("Saved, but the key wasn't accepted. Create a new key and paste it again.");
      show(`Connected as ${me.email}.`, true);
    } catch (err) {
      show(explain(err).text);
    }
  })();
});

void init();
