import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { extractTextFromPdf } from "./pdf-extractor";
import { extractTextWithOcr } from "./ocr-extractor";
import { extractWithAiFromText, extractWithAiFromImage, ExtractedInvoiceData } from "./ai-extractor";
import { extractWithRules } from "./rule-extractor";
import { normalizeExtractedData } from "./normalizer";
import { downloadAttachments } from "../gmail/service";
import { findOrCreateSupplier } from "../suppliers/service";

const MIN_RULE_CONFIDENCE = 0.7;

/**
 * Main processing pipeline for a single email
 * 1. Download attachments
 * 2. Extract text (pdf-parse → OCR → AI Vision)
 * 3. Extract structured data (rules → AI)
 * 4. Normalize and save
 */
export async function processEmail(emailId: string): Promise<string[]> {
  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
    include: { account: true },
  });

  logger.info({ emailId, subject: email.subject }, "Processing email");

  // Download attachments
  const attachments = await downloadAttachments(email.accountId, emailId);

  const documentIds: string[] = [];

  // Process each attachment
  for (const attachment of attachments) {
    const isPdf = attachment.fileName.toLowerCase().endsWith(".pdf");
    const isImage = /\.(jpg|jpeg|png|gif|bmp|tiff?)$/i.test(attachment.fileName);

    if (!isPdf && !isImage) {
      logger.debug({ fileName: attachment.fileName }, "Skipping non-invoice attachment");
      continue;
    }

    try {
      const docId = await processFile(
        attachment.filePath,
        attachment.fileName,
        attachment.mimeType,
        emailId,
        isPdf
      );
      if (docId) documentIds.push(docId);
    } catch (error) {
      logger.error({ error, fileName: attachment.fileName }, "Failed to process attachment");
    }
  }

  // If no attachments were invoices, try to extract from email body
  if (documentIds.length === 0 && email.snippet) {
    logger.debug({ emailId }, "No invoice attachments found, checking email body");
    // Could add email body processing here in the future
  }

  // Mark email as processed
  await prisma.email.update({
    where: { id: emailId },
    data: { processed: true },
  });

  return documentIds;
}

/**
 * Process a single file through the extraction pipeline
 */
async function processFile(
  filePath: string,
  fileName: string,
  mimeType: string,
  emailId: string,
  isPdf: boolean
): Promise<string | null> {
  // Create document record
  const doc = await prisma.document.create({
    data: {
      emailId,
      fileName,
      filePath,
      fileType: isPdf ? "pdf" : "image",
      status: "processing",
    },
  });

  try {
    let rawText = "";
    let extractionMethod = "text";
    let extractedData: ExtractedInvoiceData | null = null;
    let confidence = 0;

    // ── Tier 1: PDF text extraction ──
    if (isPdf) {
      const pdfResult = await extractTextFromPdf(filePath);
      if (pdfResult.success) {
        rawText = pdfResult.text;
        extractionMethod = "text";
      }
    }

    // ── Tier 2: OCR (if Tier 1 failed) ──
    if (!rawText || rawText.length < 50) {
      const ocrResult = await extractTextWithOcr(filePath);
      if (ocrResult.success) {
        rawText = ocrResult.text;
        extractionMethod = "ocr";
        confidence = ocrResult.confidence;
      }
    }

    // ── Tier 3: AI Vision (if both failed) ──
    if (!rawText || rawText.length < 30) {
      const aiResult = await extractWithAiFromImage(filePath);
      if (aiResult.success && aiResult.data) {
        extractedData = aiResult.data;
        extractionMethod = "ai";
        confidence = 0.8;
      }
    }

    // ── Data extraction from text ──
    if (!extractedData && rawText) {
      // Try rule-based extraction first
      const ruleResult = extractWithRules(rawText);
      confidence = ruleResult.confidence;

      if (ruleResult.confidence >= MIN_RULE_CONFIDENCE) {
        extractedData = ruleResult.data;
        logger.info({ docId: doc.id, confidence: ruleResult.confidence }, "Rule-based extraction sufficient");
      } else {
        // Fall back to AI extraction
        const aiResult = await extractWithAiFromText(rawText);
        if (aiResult.success && aiResult.data) {
          // Merge: prefer AI for low-confidence rule fields
          extractedData = mergeExtractions(ruleResult.data, aiResult.data, ruleResult.confidence);
          extractionMethod = confidence >= 0.5 ? extractionMethod : "ai";
          confidence = Math.max(confidence, 0.75);
        } else {
          // Use whatever rules gave us
          extractedData = ruleResult.data;
        }
      }
    }

    if (!extractedData) {
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: "error",
          errorMessage: "Could not extract data from file",
          rawText: rawText || null,
        },
      });
      return doc.id;
    }

    // Normalize
    extractedData = normalizeExtractedData(extractedData);

    // Find or create supplier
    let supplierId: string | null = null;
    if (extractedData.supplierName) {
      const supplier = await findOrCreateSupplier(
        extractedData.supplierName,
        extractedData.supplierBusinessId
      );
      supplierId = supplier.id;
    }

    // Update document with extracted data
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        documentType: extractedData.documentType,
        invoiceNumber: extractedData.invoiceNumber,
        issueDate: extractedData.issueDate ? new Date(extractedData.issueDate) : null,
        dueDate: extractedData.dueDate ? new Date(extractedData.dueDate) : null,
        currency: extractedData.currency || "ILS",
        subtotal: extractedData.subtotal,
        vatRate: extractedData.vatRate,
        vatAmount: extractedData.vatAmount,
        totalAmount: extractedData.totalAmount,
        paymentMethod: extractedData.paymentMethod,
        description: extractedData.description,
        rawText,
        extractionMethod,
        extractionScore: confidence,
        supplierId,
        status: "completed",
      },
    });

    // Update supplier totals
    if (supplierId && extractedData.totalAmount) {
      await updateSupplierTotals(supplierId);
    }

    logger.info(
      {
        docId: doc.id,
        supplier: extractedData.supplierName,
        total: extractedData.totalAmount,
        method: extractionMethod,
        confidence: Math.round(confidence * 100),
      },
      "Document processed successfully"
    );

    return doc.id;
  } catch (error) {
    logger.error({ error, docId: doc.id }, "Pipeline error");
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: "error",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    return doc.id;
  }
}

/**
 * Merge rule-based and AI extractions, preferring higher-confidence source
 */
function mergeExtractions(
  rules: ExtractedInvoiceData,
  ai: ExtractedInvoiceData,
  ruleConfidence: number
): ExtractedInvoiceData {
  const merged: ExtractedInvoiceData = { ...ai };

  // For each field, prefer the non-null value, with rules taking priority when confident
  const fields: (keyof ExtractedInvoiceData)[] = [
    "documentType", "supplierName", "supplierBusinessId", "invoiceNumber",
    "issueDate", "dueDate", "currency", "subtotal", "vatRate", "vatAmount",
    "totalAmount", "paymentMethod", "description",
  ];

  for (const field of fields) {
    const ruleValue = rules[field];
    const aiValue = ai[field];

    if (ruleValue !== null && ruleValue !== undefined) {
      if (ruleConfidence >= 0.5 || aiValue === null || aiValue === undefined) {
        (merged as any)[field] = ruleValue;
      }
    }
  }

  return merged;
}

async function updateSupplierTotals(supplierId: string) {
  const result = await prisma.document.aggregate({
    where: { supplierId, status: "completed" },
    _sum: { totalAmount: true },
    _count: true,
  });

  await prisma.supplier.update({
    where: { id: supplierId },
    data: {
      totalSpent: result._sum.totalAmount || 0,
      documentCount: result._count,
    },
  });
}

/**
 * Reprocess a specific document
 */
export async function reprocessDocument(documentId: string): Promise<void> {
  const doc = await prisma.document.findUniqueOrThrow({
    where: { id: documentId },
  });

  if (!doc.filePath) {
    throw new Error("No file path stored for this document");
  }

  const isPdf = doc.fileType === "pdf";
  await processFile(
    doc.filePath,
    doc.fileName || "unknown",
    isPdf ? "application/pdf" : "image/jpeg",
    doc.emailId || "",
    isPdf
  );
}
