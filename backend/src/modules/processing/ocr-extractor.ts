import Tesseract from "tesseract.js";
import { logger } from "../../config/logger";

export interface OcrExtractionResult {
  success: boolean;
  text: string;
  confidence: number;
  method: "ocr";
}

/**
 * Tier 2: OCR extraction using Tesseract.js
 * Supports Hebrew (heb) and English (eng) simultaneously
 */
export async function extractTextWithOcr(filePath: string): Promise<OcrExtractionResult> {
  try {
    logger.info({ filePath }, "Starting OCR extraction");

    const result = await Tesseract.recognize(filePath, "heb+eng", {
      logger: (m) => {
        if (m.status === "recognizing text") {
          logger.debug({ progress: Math.round(m.progress * 100) }, "OCR progress");
        }
      },
    });

    const text = result.data.text.trim();
    const confidence = result.data.confidence / 100; // Normalize to 0-1

    if (text.length < 30) {
      logger.warn({ filePath, textLength: text.length }, "OCR produced very little text");
      return { success: false, text, confidence, method: "ocr" };
    }

    logger.info(
      { filePath, textLength: text.length, confidence: Math.round(confidence * 100) },
      "OCR extraction completed"
    );

    return {
      success: true,
      text,
      confidence,
      method: "ocr",
    };
  } catch (error) {
    logger.error({ filePath, error }, "OCR extraction failed");
    return { success: false, text: "", confidence: 0, method: "ocr" };
  }
}
