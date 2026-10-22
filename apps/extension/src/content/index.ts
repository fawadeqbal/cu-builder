import { extractJob } from "../lib/extract";
import { reviewFill } from "./panel";

/**
 * Injected on demand (activeTab + scripting) when the popup opens or the person asks to fill a
 * form. It only exposes functions; the popup calls them with chrome.scripting.executeScript.
 */
(globalThis as unknown as { __cvb: unknown }).__cvb = {
  extract: () => extractJob(document, location.href),
  reviewFill,
};
