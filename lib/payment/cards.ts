/** Helpers for client + server card validation/formatting. */

export type CardBrand =
  | "visa"
  | "mastercard"
  | "amex"
  | "discover"
  | "diners"
  | "jcb"
  | "unionpay"
  | "maestro"
  | "unknown";

export type SavedPaymentMethod = {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  holderName: string;
  isDefault: boolean;
  createdAt: string;
};

/** Quick brand detection from a (possibly partial) PAN. */
export function detectBrand(rawDigits: string): CardBrand {
  const d = rawDigits.replace(/\D/g, "");
  if (!d) return "unknown";
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^(6011|65|64[4-9])/.test(d)) return "discover";
  if (/^(36|30[0-5]|3095|38|39)/.test(d)) return "diners";
  if (/^35/.test(d)) return "jcb";
  if (/^(62|81)/.test(d)) return "unionpay";
  if (/^(50|56|57|58|6|67)/.test(d)) return "maestro";
  return "unknown";
}

export function brandLabel(b: CardBrand): string {
  switch (b) {
    case "visa": return "Visa";
    case "mastercard": return "Mastercard";
    case "amex": return "American Express";
    case "discover": return "Discover";
    case "diners": return "Diners Club";
    case "jcb": return "JCB";
    case "unionpay": return "UnionPay";
    case "maestro": return "Maestro";
    default: return "Kaart";
  }
}

/** Luhn check used to validate card numbers. */
export function luhnValid(rawDigits: string): boolean {
  const d = rawDigits.replace(/\D/g, "");
  if (d.length < 12 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Format a card number string with spaces (Amex 4-6-5, others 4-4-4-4). */
export function formatCardNumber(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 19);
  const brand = detectBrand(d);
  if (brand === "amex") {
    const parts = [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean);
    return parts.join(" ");
  }
  return d.match(/.{1,4}/g)?.join(" ") ?? "";
}

/** Format MM/YY input (auto-inserts the slash). */
export function formatExpiry(input: string): string {
  const d = input.replace(/\D/g, "").slice(0, 4);
  if (d.length < 3) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export type ParsedExpiry = { month: number; year: number };

/** Parse "MM/YY" or "MMYY" to month + 4-digit year. Returns null when invalid. */
export function parseExpiry(input: string): ParsedExpiry | null {
  const d = input.replace(/\D/g, "");
  if (d.length !== 4) return null;
  const month = parseInt(d.slice(0, 2), 10);
  const yy = parseInt(d.slice(2), 10);
  if (!Number.isFinite(month) || month < 1 || month > 12) return null;
  if (!Number.isFinite(yy)) return null;
  const year = 2000 + yy;
  return { month, year };
}

/** True when the given expiry is at or after the current month. */
export function expiryNotPast(month: number, year: number, now = new Date()): boolean {
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  if (year > currentYear) return true;
  if (year < currentYear) return false;
  return month >= currentMonth;
}

export function cvcValid(cvc: string, brand: CardBrand): boolean {
  const d = cvc.replace(/\D/g, "");
  if (brand === "amex") return d.length === 4;
  return d.length === 3;
}
