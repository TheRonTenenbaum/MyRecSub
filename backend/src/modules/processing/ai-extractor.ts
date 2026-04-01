import OpenAI from "openai";
import fs from "fs";
import { logger } from "../../config/logger";
import { getRawSettings } from "../settings/service";

export interface AiExtractionResult {
  success: boolean;
  data: ExtractedInvoiceData | null;
  method: "ai";
}

export interface ExtractedInvoiceData {
  documentType: string | null;
  supplierName: string | null;
  supplierBusinessId: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: string | null;
  subtotal: number | null;
  vatRate: number | null;
  vatAmount: number | null;
  totalAmount: number | null;
  paymentMethod: string | null;
  description: string | null;
}

const EXTRACTION_PROMPT = `You are an expert Israeli invoice data extractor. Extract ALL financial data from this document.

CRITICAL RULES:
1. totalAmount MUST be the FINAL price the customer pays (after VAT, after discounts)
2. If there are multiple amounts, the LARGEST amount near "סה"כ" or "Total" is usually the totalAmount
3. subtotal is BEFORE VAT
4. vatAmount is the VAT component only
5. Verify: subtotal + vatAmount should approximately equal totalAmount
6. Israeli VAT is typically 17% or 18%
7. Support both Hebrew and English documents

Return ONLY valid JSON with this exact structure:
{
  "documentType": "invoice" | "receipt" | "tax_invoice" | "credit_note" | "proforma" | null,
  "supplierName": "string or null",
  "supplierBusinessId": "string or null (Israeli business ID / ח.פ)",
  "invoiceNumber": "string or null",
  "issueDate": "YYYY-MM-DD or null",
  "dueDate": "YYYY-MM-DD or null",
  "currency": "ILS" | "USD" | "EUR" | "GBP",
  "subtotal": number or null,
  "vatRate": number or null (e.g., 17 for 17%),
  "vatAmount": number or null,
  "totalAmount": number or null (FINAL PRICE),
  "paymentMethod": "string or null",
  "description": "brief description of what this invoice is for"
}`;

/**
 * Tier 3a: Extract structured data from raw text using OpenAI
 */
export async function extractWithAiFromText(rawText: string): Promise<AiExtractionResult> {
  const settings = await getRawSettings();
  const apiKey = settings?.openaiApiKey;

  if (!apiKey) {
    logger.debug("No OpenAI API key configured, skipping AI extraction");
    return { success: false, data: null, method: "ai" };
  }

  try {
    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        { role: "user", content: `Extract invoice data from this text:\n\n${rawText.slice(0, 8000)}` },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, data: null, method: "ai" };
    }

    const data = JSON.parse(content) as ExtractedInvoiceData;
    logger.info({ supplier: data.supplierName, total: data.totalAmount }, "AI extraction successful");

    return { success: true, data, method: "ai" };
  } catch (error) {
    logger.error({ error }, "AI text extraction failed");
    return { success: false, data: null, method: "ai" };
  }
}

/**
 * Tier 3b: Extract data from image using OpenAI Vision
 */
export async function extractWithAiFromImage(filePath: string): Promise<AiExtractionResult> {
  const settings = await getRawSettings();
  const apiKey = settings?.openaiApiKey;

  if (!apiKey) {
    logger.debug("No OpenAI API key configured, skipping AI vision extraction");
    return { success: false, data: null, method: "ai" };
  }

  try {
    const openai = new OpenAI({ apiKey });
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = filePath.endsWith(".png") ? "image/png" : "image/jpeg";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: EXTRACTION_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract all invoice data from this image:" },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { success: false, data: null, method: "ai" };
    }

    const data = JSON.parse(content) as ExtractedInvoiceData;
    logger.info({ supplier: data.supplierName, total: data.totalAmount }, "AI vision extraction successful");

    return { success: true, data, method: "ai" };
  } catch (error) {
    logger.error({ error }, "AI vision extraction failed");
    return { success: false, data: null, method: "ai" };
  }
}
