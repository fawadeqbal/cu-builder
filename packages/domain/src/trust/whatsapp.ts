/**
 * WhatsApp help link. Numbers are stored in international format as digits only
 * ("+92 300 1234567" → "923001234567"), which is what wa.me expects.
 */

/** Digits of an international number, or null when it can't be one (8 to 15 digits, no leading 0). */
export function normalizeWhatsappNumber(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/[^\d\s()+.-]/.test(trimmed)) return null;
  const digits = trimmed.replace(/^\+/, "").replace(/^00/, "").replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

export const WHATSAPP_MESSAGE_MAX = 300;

/** The wa.me link that opens a chat with `number`, with `message` typed in; null without a valid number. */
export function whatsappLink(number: string, message = ""): string | null {
  const digits = normalizeWhatsappNumber(number);
  if (!digits) return null;
  const text = message.trim().slice(0, WHATSAPP_MESSAGE_MAX);
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
