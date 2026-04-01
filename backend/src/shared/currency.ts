/**
 * Currency formatting and parsing utilities
 */

export type CurrencyCode = "ILS" | "USD" | "EUR" | "GBP";

const CURRENCY_SYMBOLS: Record<string, CurrencyCode> = {
  "₪": "ILS",
  "ש\"ח": "ILS",
  "שח": "ILS",
  "NIS": "ILS",
  "$": "USD",
  "US$": "USD",
  "USD": "USD",
  "€": "EUR",
  "EUR": "EUR",
  "£": "GBP",
  "GBP": "GBP",
};

/**
 * Detect currency from text
 */
export function detectCurrency(text: string): CurrencyCode {
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) {
      return code;
    }
  }
  // Default to ILS for Israeli invoices
  return "ILS";
}

/**
 * Parse a monetary amount from text
 * Handles: 1,234.56 | 1.234,56 | 1234.56 | ₪1,234
 */
export function parseAmount(text: string): number | null {
  if (!text) return null;

  // Remove currency symbols and whitespace
  let cleaned = text.replace(/[₪$€£]/g, "").trim();
  cleaned = cleaned.replace(/ש"ח|שח|NIS|ILS|USD|EUR|GBP/g, "").trim();
  cleaned = cleaned.replace(/[^\d.,\-]/g, "");

  if (!cleaned) return null;

  // Determine format: 1,234.56 (US/IL) vs 1.234,56 (EU)
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > lastDot) {
    // European format: 1.234,56 → comma is decimal separator
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else {
    // US/Israeli format: 1,234.56 → dot is decimal separator
    cleaned = cleaned.replace(/,/g, "");
  }

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : Math.round(amount * 100) / 100;
}

/**
 * Format amount with currency
 */
export function formatAmount(amount: number, currency: CurrencyCode = "ILS"): string {
  const formatter = new Intl.NumberFormat(currency === "ILS" ? "he-IL" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(amount);
}

/**
 * Validate VAT calculation
 * Returns true if total ≈ subtotal + vatAmount (within 1% tolerance)
 */
export function validateVAT(
  subtotal: number | null,
  vatAmount: number | null,
  total: number | null
): boolean {
  if (subtotal === null || vatAmount === null || total === null) return false;
  const calculated = subtotal + vatAmount;
  const tolerance = total * 0.01; // 1% tolerance for rounding
  return Math.abs(calculated - total) <= tolerance;
}
