// Lead capture: a visitor who types an email address or phone number into the
// chat has asked to be contacted. Pure, so the host app decides what to do
// with a match (flag the session, create an inquiry, notify sales).

export interface ChatContact {
  email?: string;
  /** Digits with an optional leading "+", separators removed. */
  phone?: string;
}

const EMAIL = /[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}/i;
// A run of digits, optionally led by "+" or "00", allowing spaces, dots,
// dashes or a bracketed area code between groups (E.164 is at most 15).
const PHONE = /(?:\+|\b00)?\(?\d[\d\s().-]{6,22}\d\b/g;

/** The first email and phone number in a visitor message, if any. */
export function extractContact(text: string): ChatContact {
  const contact: ChatContact = {};
  const email = text.match(EMAIL)?.[0];
  if (email) contact.email = email.toLowerCase();
  for (const match of text.matchAll(PHONE)) {
    const raw = match[0].trim();
    // A date ("2026-10-22") is not a phone number.
    if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}$/.test(raw)) continue;
    const digits = raw.replace(/\D/g, "");
    const international = raw.startsWith("+") || raw.startsWith("00");
    const number = raw.startsWith("00") ? digits.slice(2) : digits;
    if (number.length < 8 || number.length > 15) continue;
    contact.phone = international ? `+${number}` : number;
    break;
  }
  return contact;
}
