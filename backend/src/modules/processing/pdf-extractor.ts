import pdfParse from "pdf-parse";
import fs from "fs";
import { logger } from "../../config/logger";

export interface PdfExtractionResult {
  success: boolean;
  text: string;
  pages: number;
  method: "text";
}

/**
 * Tier 1: Extract text directly from PDF using pdf-parse
 * Works for text-based PDFs (not scanned images)
 */
export async function extractTextFromPdf(filePath: string): Promise<PdfExtractionResult> {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);

    const text = data.text.trim();

    // Validate that we got meaningful text
    if (text.length < 50) {
      logger.debug({ filePath, textLength: text.length }, "PDF text too short, likely scanned");
      return { success: false, text, pages: data.numpages, method: "text" };
    }

    // Check if text contains financial keywords (basic sanity check)
    const hasNumbers = /\d+[.,]\d{2}/.test(text);
    if (!hasNumbers) {
      logger.debug({ filePath }, "PDF text has no monetary amounts");
      return { success: false, text, pages: data.numpages, method: "text" };
    }

    logger.info({ filePath, textLength: text.length, pages: data.numpages }, "PDF text extracted successfully");
    return { success: true, text, pages: data.numpages, method: "text" };
  } catch (error) {
    logger.warn({ filePath, error }, "PDF text extraction failed");
    return { success: false, text: "", pages: 0, method: "text" };
  }
}
