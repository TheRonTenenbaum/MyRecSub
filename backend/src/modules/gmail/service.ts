import { gmail_v1 } from "googleapis";
import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { getGmailClient } from "./oauth";
import { detectInvoiceEmail } from "./detector";
import { paths } from "../../config/paths";
import fs from "fs";
import path from "path";

/**
 * Fetch and store emails from a Gmail account
 * Supports both historical (full) and incremental sync
 */
export async function syncEmails(accountId: string, options?: { maxResults?: number; daysBack?: number }) {
  const gmail = await getGmailClient(accountId);
  const account = await prisma.gmailAccount.findUniqueOrThrow({ where: { id: accountId } });

  const maxResults = options?.maxResults || 500;
  const daysBack = options?.daysBack || 180; // Default: 6 months

  let totalFetched = 0;
  let invoicesFound = 0;

  // Create processing job
  const job = await prisma.processingJob.create({
    data: {
      type: "sync_emails",
      status: "running",
      entityId: accountId,
      startedAt: new Date(),
    },
  });

  try {
    if (account.lastHistoryId) {
      // Incremental sync using history
      logger.info({ email: account.email, historyId: account.lastHistoryId }, "Starting incremental sync");
      const result = await incrementalSync(gmail, account.id, account.lastHistoryId);
      totalFetched = result.fetched;
      invoicesFound = result.invoices;
    } else {
      // Full historical sync
      logger.info({ email: account.email, daysBack }, "Starting historical sync");
      const result = await historicalSync(gmail, account.id, maxResults, daysBack);
      totalFetched = result.fetched;
      invoicesFound = result.invoices;
    }

    // Update job
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        total: totalFetched,
        progress: totalFetched,
        completedAt: new Date(),
      },
    });

    logger.info({ email: account.email, totalFetched, invoicesFound }, "Sync completed");
    return { totalFetched, invoicesFound, jobId: job.id };
  } catch (error) {
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
        completedAt: new Date(),
      },
    });
    throw error;
  }
}

async function historicalSync(
  gmail: gmail_v1.Gmail,
  accountId: string,
  maxResults: number,
  daysBack: number
) {
  const afterDate = new Date();
  afterDate.setDate(afterDate.getDate() - daysBack);
  const query = `after:${afterDate.toISOString().split("T")[0]}`;

  let fetched = 0;
  let invoices = 0;
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: Math.min(100, maxResults - fetched),
      pageToken,
    });

    const messages = response.data.messages || [];
    for (const msg of messages) {
      if (!msg.id) continue;
      const result = await processMessage(gmail, accountId, msg.id);
      fetched++;
      if (result.isInvoice) invoices++;
    }

    pageToken = response.data.nextPageToken || undefined;

    // Update history ID from the latest response
    if (response.data.resultSizeEstimate) {
      const profile = await gmail.users.getProfile({ userId: "me" });
      if (profile.data.historyId) {
        await prisma.gmailAccount.update({
          where: { id: accountId },
          data: {
            lastHistoryId: profile.data.historyId,
            lastSyncAt: new Date(),
          },
        });
      }
    }
  } while (pageToken && fetched < maxResults);

  return { fetched, invoices };
}

async function incrementalSync(
  gmail: gmail_v1.Gmail,
  accountId: string,
  historyId: string
) {
  let fetched = 0;
  let invoices = 0;

  try {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId: historyId,
      historyTypes: ["messageAdded"],
    });

    const histories = response.data.history || [];
    for (const history of histories) {
      const addedMessages = history.messagesAdded || [];
      for (const added of addedMessages) {
        if (!added.message?.id) continue;

        // Skip if already processed
        const existing = await prisma.email.findUnique({
          where: { gmailMessageId: added.message.id },
        });
        if (existing) continue;

        const result = await processMessage(gmail, accountId, added.message.id);
        fetched++;
        if (result.isInvoice) invoices++;
      }
    }

    // Update history ID
    if (response.data.historyId) {
      await prisma.gmailAccount.update({
        where: { id: accountId },
        data: {
          lastHistoryId: response.data.historyId,
          lastSyncAt: new Date(),
        },
      });
    }
  } catch (error: any) {
    // If history ID is invalid, fall back to full sync
    if (error.code === 404) {
      logger.warn({ accountId }, "History ID expired, resetting for full sync");
      await prisma.gmailAccount.update({
        where: { id: accountId },
        data: { lastHistoryId: null },
      });
      return historicalSync(
        gmail,
        accountId,
        500,
        30 // Only last 30 days for recovery sync
      );
    }
    throw error;
  }

  return { fetched, invoices };
}

async function processMessage(
  gmail: gmail_v1.Gmail,
  accountId: string,
  messageId: string
): Promise<{ isInvoice: boolean }> {
  // Skip if already exists
  const existing = await prisma.email.findUnique({
    where: { gmailMessageId: messageId },
  });
  if (existing) return { isInvoice: existing.isInvoice };

  // Fetch full message
  const message = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format: "full",
  });

  const headers = message.data.payload?.headers || [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || null;

  const subject = getHeader("subject");
  const from = getHeader("from");
  const date = getHeader("date");

  // Parse from address
  const fromMatch = from?.match(/<([^>]+)>/) || from?.match(/(\S+@\S+)/);
  const fromAddress = fromMatch ? fromMatch[1] : from;
  const fromName = from?.replace(/<[^>]+>/, "").trim() || null;

  // Check for attachments
  const parts = message.data.payload?.parts || [];
  const attachmentNames: string[] = [];
  let hasAttachments = false;

  function findAttachments(partList: gmail_v1.Schema$MessagePart[]) {
    for (const part of partList) {
      if (part.filename && part.filename.length > 0) {
        hasAttachments = true;
        attachmentNames.push(part.filename);
      }
      if (part.parts) {
        findAttachments(part.parts);
      }
    }
  }
  findAttachments(parts);

  // Detect if this is an invoice
  const detection = detectInvoiceEmail(subject, fromAddress, hasAttachments, attachmentNames);

  // Save email
  await prisma.email.create({
    data: {
      gmailMessageId: messageId,
      accountId,
      subject,
      fromAddress,
      fromName,
      receivedAt: date ? new Date(date) : null,
      snippet: message.data.snippet || null,
      hasAttachments,
      isInvoice: detection.isInvoice,
      detectionScore: detection.score,
      processed: false,
    },
  });

  return { isInvoice: detection.isInvoice };
}

/**
 * Download all attachments for an email
 */
export async function downloadAttachments(
  accountId: string,
  emailId: string
): Promise<{ filePath: string; fileName: string; mimeType: string }[]> {
  const email = await prisma.email.findUniqueOrThrow({
    where: { id: emailId },
  });

  const gmail = await getGmailClient(accountId);
  const message = await gmail.users.messages.get({
    userId: "me",
    id: email.gmailMessageId,
    format: "full",
  });

  const downloadDir = path.join(paths.attachmentsDir, emailId);
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const results: { filePath: string; fileName: string; mimeType: string }[] = [];

  async function processPartAttachments(parts: gmail_v1.Schema$MessagePart[]) {
    for (const part of parts) {
      if (part.filename && part.body?.attachmentId) {
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: email.gmailMessageId,
          id: part.body.attachmentId,
        });

        if (attachment.data.data) {
          const buffer = Buffer.from(attachment.data.data, "base64");
          const filePath = path.join(downloadDir, part.filename);
          fs.writeFileSync(filePath, buffer);

          results.push({
            filePath,
            fileName: part.filename,
            mimeType: part.mimeType || "application/octet-stream",
          });
        }
      }
      if (part.parts) {
        await processPartAttachments(part.parts);
      }
    }
  }

  const parts = message.data.payload?.parts || [];
  await processPartAttachments(parts);

  return results;
}

/**
 * Get email body as HTML or plain text
 */
export function extractEmailBody(
  payload: gmail_v1.Schema$MessagePart
): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  function findBody(part: gmail_v1.Schema$MessagePart) {
    if (part.mimeType === "text/html" && part.body?.data) {
      html = Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.mimeType === "text/plain" && part.body?.data) {
      text = Buffer.from(part.body.data, "base64").toString("utf-8");
    }
    if (part.parts) {
      for (const subPart of part.parts) {
        findBody(subPart);
      }
    }
  }

  findBody(payload);
  return { html, text };
}
