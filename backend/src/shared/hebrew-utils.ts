/**
 * Hebrew text utilities for invoice processing
 */

/**
 * Common Hebrew invoice terms and their meanings
 */
export const HEBREW_INVOICE_TERMS = {
  // Document types
  invoice: ["חשבונית", "חשבונית מס", "חשבונית מס/קבלה"],
  receipt: ["קבלה", "אישור תשלום", "אישור קבלה"],
  creditNote: ["זיכוי", "חשבונית זיכוי"],
  proforma: ["חשבון עסקה", "הצעת מחיר"],

  // Financial terms
  total: ["סה\"כ", "סך הכל", "סה\"כ לתשלום", "סכום כולל", "סכום לתשלום"],
  subtotal: ["סה\"כ לפני מע\"מ", "סכום לפני מע\"מ", "מחיר לפני מע\"מ"],
  vat: ["מע\"מ", "מס ערך מוסף", 'מע"מ 17%', "מע\"מ 18%"],
  discount: ["הנחה", "הנחת"],

  // Invoice fields
  invoiceNumber: ["מספר חשבונית", "חשבונית מס מספר", "חשבונית מספר", "מס'"],
  date: ["תאריך", "תאריך הפקה", "תאריך חשבונית"],
  dueDate: ["תאריך פירעון", "לתשלום עד", "מועד תשלום"],
  businessId: ["ח.פ", "ח\"פ", "מספר עוסק", "עוסק מורשה", "ע.מ"],

  // Payment methods
  cash: ["מזומן"],
  creditCard: ["כרטיס אשראי", "אשראי"],
  bankTransfer: ["העברה בנקאית", "העברת בנק"],
  check: ["צ'ק", "שיק", "המחאה"],
  bit: ["ביט", "bit"],
};

/**
 * Remove Hebrew diacritical marks (nikud)
 */
export function removeNikud(text: string): string {
  return text.replace(/[\u0591-\u05C7]/g, "");
}

/**
 * Normalize Hebrew text for comparison
 */
export function normalizeHebrew(text: string): string {
  let normalized = removeNikud(text);
  // Normalize final letters (sofit)
  normalized = normalized
    .replace(/\u05DA/g, "\u05DB") // final kaf → kaf
    .replace(/\u05DD/g, "\u05DE") // final mem → mem
    .replace(/\u05DF/g, "\u05E0") // final nun → nun
    .replace(/\u05E3/g, "\u05E4") // final pe → pe
    .replace(/\u05E5/g, "\u05E6"); // final tsadi → tsadi

  return normalized.trim();
}

/**
 * Check if text contains Hebrew characters
 */
export function containsHebrew(text: string): boolean {
  return /[\u0590-\u05FF]/.test(text);
}

/**
 * Detect if text is primarily RTL (Hebrew/Arabic)
 */
export function isRTL(text: string): boolean {
  const rtlChars = (text.match(/[\u0590-\u05FF\u0600-\u06FF]/g) || []).length;
  const ltrChars = (text.match(/[a-zA-Z]/g) || []).length;
  return rtlChars > ltrChars;
}
