import { ExtractedInvoiceData } from "./ai-extractor";
import { validateVAT } from "../../shared/currency";
import { logger } from "../../config/logger";

/**
 * Normalize and validate extracted invoice data
 */
export function normalizeExtractedData(data: ExtractedInvoiceData): ExtractedInvoiceData {
  const normalized = { ...data };

  // Normalize document type
  if (normalized.documentType) {
    const typeMap: Record<string, string> = {
      "חשבונית": "invoice",
      "חשבונית מס": "tax_invoice",
      "קבלה": "receipt",
      "זיכוי": "credit_note",
    };
    normalized.documentType = typeMap[normalized.documentType] || normalized.documentType;
  }

  // Normalize dates to YYYY-MM-DD
  if (normalized.issueDate) {
    normalized.issueDate = normalizeDate(normalized.issueDate);
  }
  if (normalized.dueDate) {
    normalized.dueDate = normalizeDate(normalized.dueDate);
  }

  // Normalize currency
  if (normalized.currency) {
    const currencyMap: Record<string, string> = {
      "₪": "ILS", "שח": "ILS", 'ש"ח': "ILS", "NIS": "ILS",
      "$": "USD", "€": "EUR", "£": "GBP",
    };
    normalized.currency = currencyMap[normalized.currency] || normalized.currency;
  }

  // Round amounts to 2 decimal places
  if (normalized.subtotal !== null) {
    normalized.subtotal = Math.round(normalized.subtotal * 100) / 100;
  }
  if (normalized.vatAmount !== null) {
    normalized.vatAmount = Math.round(normalized.vatAmount * 100) / 100;
  }
  if (normalized.totalAmount !== null) {
    normalized.totalAmount = Math.round(normalized.totalAmount * 100) / 100;
  }

  // Validate VAT calculation
  if (normalized.subtotal && normalized.vatAmount && normalized.totalAmount) {
    const isValid = validateVAT(normalized.subtotal, normalized.vatAmount, normalized.totalAmount);
    if (!isValid) {
      logger.warn(
        {
          subtotal: normalized.subtotal,
          vat: normalized.vatAmount,
          total: normalized.totalAmount,
          calculated: normalized.subtotal + normalized.vatAmount,
        },
        "VAT calculation mismatch - total may be incorrect"
      );
    }
  }

  // If we have VAT rate but no VAT amount, and we have subtotal, calculate
  if (normalized.vatRate && normalized.subtotal && !normalized.vatAmount) {
    normalized.vatAmount = Math.round(normalized.subtotal * (normalized.vatRate / 100) * 100) / 100;
  }

  // Trim supplier name
  if (normalized.supplierName) {
    normalized.supplierName = normalized.supplierName.trim().replace(/\s+/g, " ");
  }

  return normalized;
}

function normalizeDate(dateStr: string): string | null {
  // Already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  // DD/MM/YYYY or DD.MM.YYYY or DD-MM-YYYY
  const match = dateStr.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/);
  if (match) {
    let [, day, month, year] = match;
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  // Try parsing as date
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    // ignore
  }

  return dateStr;
}
