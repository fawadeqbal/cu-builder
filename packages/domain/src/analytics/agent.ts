/** Coarse, non-identifying facts about the browser, worked out on the server from the User-Agent. */

export type DeviceClass = "mobile" | "tablet" | "desktop";
export const DEVICE_CLASSES: readonly DeviceClass[] = ["mobile", "tablet", "desktop"];

const BOT =
  /bot\b|bot\/|crawl|spider|slurp|preview|headless|lighthouse|pagespeed|pingdom|uptime|monitor|curl\/|wget\/|python-|httpx|axios\/|node-fetch|undici|go-http|java\/|okhttp|libwww|scrapy|phantomjs|puppeteer|playwright|selenium|facebookexternalhit|embedly|whatsapp|telegrambot|discordbot|slackbot|linkedinbot|bingpreview|google-inspectiontool|chrome-lighthouse|gtmetrix|ahrefs|semrush|mj12|dotbot|petalbot|bytespider|gptbot|claudebot|ccbot|perplexity/i;

/** Crawlers, link previews, monitors, scripts and headless browsers. No User-Agent at all counts as a bot. */
export function isBot(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 20) return true;
  return BOT.test(ua);
}

export function deviceClass(ua: string | null | undefined): DeviceClass {
  if (!ua) return "desktop";
  if (/ipad|tablet|playbook|silk|kindle|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile|windows phone/i.test(ua)) return "mobile";
  return "desktop";
}

export const BROWSER_FAMILIES = ["Edge", "Opera", "Samsung Internet", "UC Browser", "Firefox", "Chrome", "Safari", "Other"] as const;
export type BrowserFamily = (typeof BROWSER_FAMILIES)[number];

/** Browser family only (never the version or the operating system build). */
export function browserFamily(ua: string | null | undefined): BrowserFamily {
  if (!ua) return "Other";
  if (/edg(e|a|ios)?\//i.test(ua)) return "Edge";
  if (/opr\/|opera|opt\//i.test(ua)) return "Opera";
  if (/samsungbrowser/i.test(ua)) return "Samsung Internet";
  if (/ucbrowser/i.test(ua)) return "UC Browser";
  if (/firefox|fxios/i.test(ua)) return "Firefox";
  if (/chrome|crios|chromium/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  return "Other";
}

/** A two-letter country code, or undefined for unknown, Tor ("T1") and "XX". */
export function countryCode(value: string | null | undefined): string | undefined {
  const v = (value ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(v) && v !== "XX" && v !== "T1" ? v : undefined;
}

/**
 * The country for a time zone, as a fallback when no proxy header says where the visitor is.
 * Covers the zones our visitors mostly use; anything else is unknown rather than guessed.
 */
const TZ_COUNTRY: Record<string, string> = {
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Calcutta": "IN",
  "Asia/Dhaka": "BD",
  "Asia/Kathmandu": "NP",
  "Asia/Colombo": "LK",
  "Asia/Kabul": "AF",
  "Asia/Dubai": "AE",
  "Asia/Muscat": "OM",
  "Asia/Qatar": "QA",
  "Asia/Bahrain": "BH",
  "Asia/Kuwait": "KW",
  "Asia/Riyadh": "SA",
  "Asia/Baghdad": "IQ",
  "Asia/Tehran": "IR",
  "Asia/Amman": "JO",
  "Asia/Beirut": "LB",
  "Asia/Jerusalem": "IL",
  "Asia/Istanbul": "TR",
  "Europe/Istanbul": "TR",
  "Africa/Cairo": "EG",
  "Africa/Casablanca": "MA",
  "Africa/Algiers": "DZ",
  "Africa/Tunis": "TN",
  "Africa/Lagos": "NG",
  "Africa/Nairobi": "KE",
  "Africa/Johannesburg": "ZA",
  "Africa/Accra": "GH",
  "Europe/London": "GB",
  "Europe/Dublin": "IE",
  "Europe/Paris": "FR",
  "Europe/Berlin": "DE",
  "Europe/Madrid": "ES",
  "Europe/Rome": "IT",
  "Europe/Amsterdam": "NL",
  "Europe/Brussels": "BE",
  "Europe/Zurich": "CH",
  "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE",
  "Europe/Oslo": "NO",
  "Europe/Copenhagen": "DK",
  "Europe/Helsinki": "FI",
  "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ",
  "Europe/Lisbon": "PT",
  "Europe/Athens": "GR",
  "Europe/Bucharest": "RO",
  "Europe/Kiev": "UA",
  "Europe/Kyiv": "UA",
  "Europe/Moscow": "RU",
  "Asia/Singapore": "SG",
  "Asia/Kuala_Lumpur": "MY",
  "Asia/Jakarta": "ID",
  "Asia/Manila": "PH",
  "Asia/Bangkok": "TH",
  "Asia/Ho_Chi_Minh": "VN",
  "Asia/Hong_Kong": "HK",
  "Asia/Shanghai": "CN",
  "Asia/Taipei": "TW",
  "Asia/Tokyo": "JP",
  "Asia/Seoul": "KR",
  "Australia/Sydney": "AU",
  "Australia/Melbourne": "AU",
  "Australia/Brisbane": "AU",
  "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ",
  "America/New_York": "US",
  "America/Chicago": "US",
  "America/Denver": "US",
  "America/Phoenix": "US",
  "America/Los_Angeles": "US",
  "America/Anchorage": "US",
  "Pacific/Honolulu": "US",
  "America/Detroit": "US",
  "America/Toronto": "CA",
  "America/Vancouver": "CA",
  "America/Edmonton": "CA",
  "America/Winnipeg": "CA",
  "America/Halifax": "CA",
  "America/Mexico_City": "MX",
  "America/Sao_Paulo": "BR",
  "America/Argentina/Buenos_Aires": "AR",
  "America/Bogota": "CO",
  "America/Lima": "PE",
  "America/Santiago": "CL",
};

export function countryFromTimeZone(timeZone: string | null | undefined): string | undefined {
  return timeZone ? TZ_COUNTRY[timeZone] : undefined;
}

/** Proxy headers we trust for the visitor's country (Cloudflare, Vercel), in order. */
export const COUNTRY_HEADERS = ["cf-ipcountry", "x-vercel-ip-country"] as const;

/** Country from a trusted proxy header, else the browser's time-zone guess. */
export function resolveCountry(headers: Record<string, string | string[] | undefined>, tzCountry?: string | null): string | undefined {
  for (const name of COUNTRY_HEADERS) {
    const raw = headers[name];
    const code = countryCode(Array.isArray(raw) ? raw[0] : raw);
    if (code) return code;
  }
  return countryCode(tzCountry);
}
