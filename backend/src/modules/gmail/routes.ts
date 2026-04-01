import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { getAuthUrl, handleCallback } from "./oauth";
import { syncEmails } from "./service";
import { taskQueue } from "../../queue/task-queue";

export async function gmailRoutes(app: FastifyInstance) {
  // List connected Gmail accounts
  app.get("/accounts", async () => {
    const accounts = await prisma.gmailAccount.findMany({
      select: {
        id: true,
        email: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        _count: { select: { emails: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return accounts;
  });

  // Get OAuth URL for connecting a new account
  app.get("/auth-url", async () => {
    const url = getAuthUrl();
    return { url };
  });

  // Handle OAuth callback
  app.get("/callback", async (request, reply) => {
    const schema = z.object({ code: z.string() });
    const { code } = schema.parse(request.query);

    const account = await handleCallback(code);

    // Redirect to frontend settings page
    return reply.redirect(`http://localhost:3000/settings?gmail=connected&email=${account.email}`);
  });

  // Trigger sync for an account
  app.post("/sync", async (request) => {
    const schema = z.object({
      accountId: z.string().optional(),
      daysBack: z.number().min(1).max(365).optional(),
    });
    const { accountId, daysBack } = schema.parse(request.body || {});

    if (accountId) {
      // Sync specific account
      const result = await taskQueue.add(() => syncEmails(accountId, { daysBack }));
      return result;
    }

    // Sync all active accounts
    const accounts = await prisma.gmailAccount.findMany({
      where: { isActive: true },
    });

    const results = [];
    for (const account of accounts) {
      const result = await taskQueue.add(() => syncEmails(account.id, { daysBack }));
      results.push({ accountId: account.id, email: account.email, ...result });
    }
    return results;
  });

  // Sync all (shortcut)
  app.post("/sync-all", async () => {
    const accounts = await prisma.gmailAccount.findMany({
      where: { isActive: true },
    });

    const jobs = [];
    for (const account of accounts) {
      const job = await prisma.processingJob.create({
        data: {
          type: "sync_emails",
          status: "queued",
          entityId: account.id,
        },
      });

      taskQueue.add(async () => {
        await prisma.processingJob.update({
          where: { id: job.id },
          data: { status: "running", startedAt: new Date() },
        });
        try {
          const result = await syncEmails(account.id);
          await prisma.processingJob.update({
            where: { id: job.id },
            data: {
              status: "completed",
              progress: result.totalFetched,
              total: result.totalFetched,
              completedAt: new Date(),
            },
          });
        } catch (error) {
          await prisma.processingJob.update({
            where: { id: job.id },
            data: {
              status: "failed",
              error: error instanceof Error ? error.message : "Unknown error",
              completedAt: new Date(),
            },
          });
        }
      });

      jobs.push({ jobId: job.id, email: account.email });
    }

    return { message: "Sync started for all accounts", jobs };
  });

  // Disconnect account
  app.delete("/accounts/:id", async (request) => {
    const { id } = request.params as { id: string };
    await prisma.gmailAccount.update({
      where: { id },
      data: { isActive: false },
    });
    return { success: true };
  });

  // Get emails for an account (for debugging)
  app.get("/emails", async (request) => {
    const schema = z.object({
      accountId: z.string().optional(),
      invoicesOnly: z.coerce.boolean().default(false),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(50),
    });
    const { accountId, invoicesOnly, page, limit } = schema.parse(request.query);

    const where: any = {};
    if (accountId) where.accountId = accountId;
    if (invoicesOnly) where.isInvoice = true;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where,
        orderBy: { receivedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.email.count({ where }),
    ]);

    return { emails, total, page, limit, pages: Math.ceil(total / limit) };
  });
}
