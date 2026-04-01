import { logger } from "../../config/logger";
import { containsHebrew, HEBREW_INVOICE_TERMS } from "../../shared/hebrew-utils";
import { parseAmount, detectCurrency, CurrencyCode } from "../../shared/currency";
import { ExtractedInvoiceData } from "./ai-extractor";

interface FieldExtraction {
  value: string | number | null;
  confidence: number;
}

/**
 * Rule-based extraction using regex patterns
 * Optimized for Israeli invoices (Hebrew) and English invoices
 */
export function extractWithRules(rawText: string): {
  data: ExtractedInvoiceData;
  confidence: number;
} {
  const isHebrew = containsHebrew(rawText);
  logger.debug({ isHebrew, textLength: rawText.length }, "Starting rule-based extraction");

  const documentType = extractDocumentType(rawText, isHebrew);
  const supplierName = extractSupplierName(rawText, isHebrew);
  const supplierBusinessId = extractBusinessId(rawText);
  const invoiceNumber = extractInvoiceNumber(rawText, isHebrew);
  const issueDate = extractDate(rawText, isHebrew, "issue");
  const dueDate = extractDate(rawText, isHebrew, "due");
  const currency = detectCurrency(rawText);
  const amounts = extractAmounts(rawText, isHebrew);

  // Calculate overall confidence
  const fields = [
    documentType, supplierName, invoiceNumber, issueDate,
    amounts.total, amounts.subtotal,
  ];
  const validFields = fields.filter((f) => f.value !== null);
  const avgConfidence = validFields.length > 0
    ? validFields.reduce((sum, f) => sum + f.confidence, 0) / fields.length
    : 0;

  const data: ExtractedInvoiceData = {
    documentType: documentType.value as string | null,
    supplierName: supplierName.value as string | null,
    supplierBusinessId: supplierBusinessId.value as string | null,
    invoiceNumber: invoiceNumber.value as string | null,
    issueDate: issueDate.value as string | null,
    dueDate: dueDate.value as string | null,
    currency,
    subtotal: amounts.subtotal.value as number | null,
    vatRate: amounts.vatRate.value as number | null,
    vatAmount: amounts.vat.value as number | null,
    totalAmount: amounts.total.value as number | null,
    paymentMethod: extractPaymentMethod(rawText, isHebrew),
    description: null,
  };

  logger.info(
    { confidence: Math.round(avgConfidence * 100), supplier: data.supplierName, total: data.totalAmount },
    "Rule-based extraction completed"
  );

  return { data, confidence: avgConfidence };
}

function extractDocumentType(text: string, isHebrew: boolean): FieldExtraction {
  if (isHebrew) {
    if (/חשבונית מס[/ ]קבלה/i.test(text)) return { value: "tax_invoice", confidence: 0.95 };
    if (/חשבונית מס(?!\s*[/])/i.test(text)) return { value: "tax_invoice", confidence: 0.9 };
    if (/חשבונית זיכוי/.test(text)) return { value: "credit_note", confidence: 0.9 };
    if (/קבלה/.test(text)) return { value: "receipt", confidence: 0.8 };
    if (/חשבון עסקה/.test(text)) return { value: "proforma", confidence: 0.8 };
    if (/חשבונית/.test(text)) return { value: "invoice", confidence: 0.7 };
  }

  const textLower = text.toLowerCase();
  if (/tax invoice/i.test(textLower)) return { value: "tax_invoice", confidence: 0.9 };
  if (/credit note/i.test(textLower)) return { value: "credit_note", confidence: 0.9 };
  if (/receipt/i.test(textLower)) return { value: "receipt", confidence: 0.8 };
  if (/proforma/i.test(textLower)) return { value: "proforma", confidence: 0.8 };
  if (/invoice/i.test(textLower)) return { value: "invoice", confidence: 0.7 };

  return { value: null, confidence: 0 };
}

function extractSupplierName(text: string, isHebrew: boolean): FieldExtraction {
  // The supplier name is typically in the first few lines, often the first non-empty line
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  // Skip common header patterns and look for a company name
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i];

    // Skip lines that are document type headers
    if (/^(חשבונית|קבלה|invoice|receipt|tax)/i.test(line)) continue;
    // Skip lines that are mostly numbers
    if (/^\d[\d\s\-/]*$/.test(line)) continue;
    // Skip very short lines
    if (line.length < 3) continue;

    // Look for company identifiers
    if (/בע"מ|בע''מ|Ltd\.?|Inc\.?|LLC|Corp/i.test(line)) {
      return { value: line.replace(/\s+/g, " ").substring(0, 100), confidence: 0.85 };
    }

    // Look for lines near business ID
    if (i < 5 && !line.match(/\d{5,}/) && line.length > 3 && line.length < 80) {
      return { value: line.replace(/\s+/g, " "), confidence: 0.5 };
    }
  }

  return { value: null, confidence: 0 };
}

function extractBusinessId(text: string): FieldExtraction {
  // Israeli business ID patterns: ח.פ / ח"פ / עוסק מורשה followed by 9 digits
  const patterns = [
    /(?:ח\.?פ\.?|ח"פ|מספר עוסק|עוסק מורשה|ע\.מ\.?)\s*:?\s*(\d{8,9})/,
    /(?:Company\s*(?:No|ID|#)|Business\s*ID|VAT\s*(?:No|ID))\s*:?\s*(\d{8,9})/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { value: match[1], confidence: 0.9 };
    }
  }

  return { value: null, confidence: 0 };
}

function extractInvoiceNumber(text: string, isHebrew: boolean): FieldExtraction {
  const patterns = isHebrew
    ? [
        /(?:חשבונית(?:\s+מס)?\s*(?:מספר|מס['']?)\s*:?\s*)(\d[\d\-/]*)/,
        /(?:מספר\s*:?\s*)(\d{3,})/,
        /(?:אסמכתא\s*:?\s*)(\d[\d\-/]*)/,
      ]
    : [
        /(?:Invoice\s*(?:No\.?|Number|#)\s*:?\s*)([A-Z\d][\w\-/]*)/i,
        /(?:Receipt\s*(?:No\.?|Number|#)\s*:?\s*)([A-Z\d][\w\-/]*)/i,
        /(?:Ref(?:erence)?\s*(?:No\.?|#)\s*:?\s*)([A-Z\d][\w\-/]*)/i,
      ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return { value: match[1].trim(), confidence: 0.85 };
    }
  }

  return { value: null, confidence: 0 };
}

function extractDate(text: string, isHebrew: boolean, type: "issue" | "due"): FieldExtraction {
  // Date patterns
  const dateRegex = /(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/g;

  const labelPatterns = type === "issue"
    ? isHebrew
      ? [/תאריך(?:\s+הפקה)?\s*:?\s*/, /תאריך חשבונית\s*:?\s*/]
      : [/(?:Invoice\s+)?Date\s*:?\s*/i, /Issued?\s*:?\s*/i]
    : isHebrew
      ? [/תאריך\s*פירעון\s*:?\s*/, /לתשלום\s*עד\s*:?\s*/, /מועד\s*תשלום\s*:?\s*/]
      : [/Due\s*Date\s*:?\s*/i, /Payment\s*Due\s*:?\s*/i];

  // Try to find date near a label
  for (const labelPattern of labelPatterns) {
    const labelMatch = text.match(new RegExp(labelPattern.source + "(\\d{1,2}[./\\-]\\d{1,2}[./\\-]\\d{2,4})"));
    if (labelMatch) {
      const parsed = parseDate(labelMatch[1]);
      if (parsed) return { value: parsed, confidence: 0.9 };
    }
  }

  // For issue date, take the first date found in the document
  if (type === "issue") {
    const match = dateRegex.exec(text);
    if (match) {
      const parsed = parseDate(match[0]);
      if (parsed) return { value: parsed, confidence: 0.5 };
    }
  }

  return { value: null, confidence: 0 };
}

function parseDate(dateStr: string): string | null {
  const match = dateStr.match(/(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})/);
  if (!match) return null;

  let [, day, month, year] = match;

  // Handle 2-digit year
  if (year.length === 2) {
    year = `20${year}`;
  }

  const d = parseInt(day);
  const m = parseInt(month);
  const y = parseInt(year);

  // Validate
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return null;

  // Israeli format is DD/MM/YYYY
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function extractAmounts(
  text: string,
  isHebrew: boolean
): {
  total: FieldExtraction;
  subtotal: FieldExtraction;
  vat: FieldExtraction;
  vatRate: FieldExtraction;
} {
  const result = {
    total: { value: null, confidence: 0 } as FieldExtraction,
    subtotal: { value: null, confidence: 0 } as FieldExtraction,
    vat: { value: null, confidence: 0 } as FieldExtraction,
    vatRate: { value: null, confidence: 0 } as FieldExtraction,
  };

  // Total amount patterns
  const totalPatterns = isHebrew
    ? [
        /סה"כ\s*(?:לתשלום|כולל)?\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
        /סך\s*הכל\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
        /סכום\s*(?:כולל|לתשלום)\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
        /לתשלום\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
      ]
    : [
        /Total\s*(?:Amount|Due)?\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
        /Amount\s*Due\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
        /Grand\s*Total\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
        /Balance\s*Due\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
      ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        result.total = { value: amount, confidence: 0.85 };
        break;
      }
    }
  }

  // Subtotal patterns
  const subtotalPatterns = isHebrew
    ? [
        /(?:סה"כ\s*)?לפני\s*מע"מ\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
        /מחיר\s*לפני\s*מע"מ\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
      ]
    : [
        /Sub\s*-?\s*total\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
        /Before\s*(?:VAT|Tax)\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
      ];

  for (const pattern of subtotalPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        result.subtotal = { value: amount, confidence: 0.8 };
        break;
      }
    }
  }

  // VAT patterns
  const vatPatterns = isHebrew
    ? [
        /מע"מ\s*(?:\d+%?)?\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
        /מס\s*ערך\s*מוסף\s*:?\s*[₪]?\s*([\d,]+\.?\d*)/,
      ]
    : [
        /VAT\s*(?:\(\d+%?\))?\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
        /Tax\s*(?:\(\d+%?\))?\s*:?\s*[$€£₪]?\s*([\d,]+\.?\d*)/i,
      ];

  for (const pattern of vatPatterns) {
    const match = text.match(pattern);
    if (match) {
      const amount = parseAmount(match[1]);
      if (amount !== null && amount > 0) {
        result.vat = { value: amount, confidence: 0.8 };
        break;
      }
    }
  }

  // VAT Rate
  const vatRateMatch = text.match(/מע"מ\s*(\d+(?:\.\d+)?)\s*%/) || text.match(/VAT\s*(?:@\s*)?(\d+(?:\.\d+)?)\s*%/i);
  if (vatRateMatch) {
    result.vatRate = { value: parseFloat(vatRateMatch[1]), confidence: 0.9 };
  }

  // If we have subtotal and VAT but no total, calculate it
  if (result.total.value === null && result.subtotal.value !== null && result.vat.value !== null) {
    result.total = {
      value: Math.round(((result.subtotal.value as number) + (result.vat.value as number)) * 100) / 100,
      confidence: 0.7,
    };
  }

  // If we have total and VAT but no subtotal, calculate it
  if (result.subtotal.value === null && result.total.value !== null && result.vat.value !== null) {
    result.subtotal = {
      value: Math.round(((result.total.value as number) - (result.vat.value as number)) * 100) / 100,
      confidence: 0.7,
    };
  }

  return result;
}

function extractPaymentMethod(text: string, isHebrew: boolean): string | null {
  if (isHebrew) {
    if (/כרטיס אשראי|אשראי|visa|mastercard|ויזה/i.test(text)) return "credit_card";
    if (/מזומן|cash/i.test(text)) return "cash";
    if (/העברה בנקאית/i.test(text)) return "bank_transfer";
    if (/צ'ק|שיק|המחאה/i.test(text)) return "check";
    if (/ביט|bit|paybox|פייבוקס/i.test(text)) return "digital";
  } else {
    if (/credit card|visa|mastercard|amex/i.test(text)) return "credit_card";
    if (/cash/i.test(text)) return "cash";
    if (/bank transfer|wire/i.test(text)) return "bank_transfer";
    if (/check|cheque/i.test(text)) return "check";
    if (/paypal|stripe/i.test(text)) return "digital";
  }
  return null;
}
