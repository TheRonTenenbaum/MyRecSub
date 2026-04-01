/**
 * Invoice/Receipt email detection
 * Scores emails based on subject, sender, and attachment patterns
 */

// Hebrew and English keywords that suggest an invoice/receipt
const SUBJECT_KEYWORDS_HIGH = [
  // Hebrew
  "חשבונית", "קבלה", "חשבונית מס", "אישור תשלום", "חיוב",
  "חשבון עסקה", "חשבונית זיכוי",
  // English
  "invoice", "receipt", "billing statement", "payment confirmation",
  "payment receipt", "tax invoice", "credit note",
];

const SUBJECT_KEYWORDS_MEDIUM = [
  // Hebrew
  "תשלום", "חיוב חודשי", "דוח חיוב", "סיכום חיוב",
  "אישור הזמנה", "אישור רכישה",
  // English
  "payment", "order confirmation", "purchase confirmation",
  "monthly statement", "subscription", "charge",
  "your order", "order receipt",
];

const SENDER_PATTERNS_HIGH = [
  /billing@/i, /invoice[s]?@/i, /receipt[s]?@/i,
  /payment[s]?@/i, /noreply.*billing/i,
  /accounts?@/i, /finance@/i,
];

const SENDER_PATTERNS_MEDIUM = [
  /noreply@/i, /no-reply@/i, /donotreply@/i,
  /support@/i, /info@/i, /orders?@/i,
];

// Known Israeli billing senders
const KNOWN_BILLING_DOMAINS = [
  "partner.co.il", "cellcom.co.il", "bezeq.co.il", "hot.net.il",
  "012.net.il", "pelephone.co.il", "isracard.co.il", "cal-online.co.il",
  "leumi.co.il", "poalim.co.il", "mizrahi-tefahot.co.il",
  "electric.co.il", "mekorot.co.il", "bezek.co.il",
  "wix.com", "monday.com", "fiverr.com",
  "paypal.com", "stripe.com", "apple.com", "google.com",
  "amazon.com", "microsoft.com", "netflix.com", "spotify.com",
];

export interface DetectionResult {
  isInvoice: boolean;
  score: number;
  reasons: string[];
}

export function detectInvoiceEmail(
  subject: string | null,
  fromAddress: string | null,
  hasAttachments: boolean,
  attachmentNames: string[]
): DetectionResult {
  let score = 0;
  const reasons: string[] = [];

  const subjectLower = (subject || "").toLowerCase();
  const fromLower = (fromAddress || "").toLowerCase();

  // Check subject - high confidence keywords
  for (const keyword of SUBJECT_KEYWORDS_HIGH) {
    if (subjectLower.includes(keyword.toLowerCase())) {
      score += 0.4;
      reasons.push(`Subject contains "${keyword}"`);
      break; // Count only once
    }
  }

  // Check subject - medium confidence keywords
  if (score === 0) {
    for (const keyword of SUBJECT_KEYWORDS_MEDIUM) {
      if (subjectLower.includes(keyword.toLowerCase())) {
        score += 0.2;
        reasons.push(`Subject contains "${keyword}"`);
        break;
      }
    }
  }

  // Check sender - high confidence patterns
  for (const pattern of SENDER_PATTERNS_HIGH) {
    if (pattern.test(fromLower)) {
      score += 0.3;
      reasons.push(`Sender matches billing pattern`);
      break;
    }
  }

  // Check sender - medium confidence patterns
  if (reasons.length < 2) {
    for (const pattern of SENDER_PATTERNS_MEDIUM) {
      if (pattern.test(fromLower)) {
        score += 0.1;
        reasons.push(`Sender matches notification pattern`);
        break;
      }
    }
  }

  // Check known billing domains
  for (const domain of KNOWN_BILLING_DOMAINS) {
    if (fromLower.includes(domain)) {
      score += 0.2;
      reasons.push(`Known billing domain: ${domain}`);
      break;
    }
  }

  // Check attachments
  if (hasAttachments) {
    score += 0.1;
    reasons.push("Has attachments");

    // PDF attachments are strong indicators
    const hasPdf = attachmentNames.some(
      (name) => name.toLowerCase().endsWith(".pdf")
    );
    if (hasPdf) {
      score += 0.15;
      reasons.push("Has PDF attachment");
    }

    // Check attachment names for invoice keywords
    for (const name of attachmentNames) {
      const nameLower = name.toLowerCase();
      if (
        nameLower.includes("invoice") ||
        nameLower.includes("receipt") ||
        nameLower.includes("חשבונית") ||
        nameLower.includes("קבלה")
      ) {
        score += 0.3;
        reasons.push(`Attachment name suggests invoice: ${name}`);
        break;
      }
    }
  }

  // Cap at 1.0
  score = Math.min(score, 1.0);

  return {
    isInvoice: score >= 0.3,
    score: Math.round(score * 100) / 100,
    reasons,
  };
}
