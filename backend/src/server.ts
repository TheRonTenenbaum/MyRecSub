import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { ensureDirectories } from "./config/paths";
import { prisma } from "./config/prisma";

async function main() {
  // Ensure data directories exist
  ensureDirectories();

  // Ensure DB is connected and schema is up to date
  try {
    await prisma.$connect();
    logger.info("Database connected");
  } catch (err) {
    logger.error(err, "Database connection failed");
    process.exit(1);
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`MyRecSub backend running on http://${env.HOST}:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);

    // Start auto-sync if enabled
    if (env.NODE_ENV === "production") {
      scheduleAutoSync();
    }
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Shutting down...");
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

async function scheduleAutoSync() {
  const { syncEmails } = await import("./modules/gmail/service");
  const { detectSubscriptions } = await import("./modules/subscriptions/detector");

  const runSync = async () => {
    try {
      const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
      if (!settings?.autoSync) return;

      const accounts = await prisma.gmailAccount.findMany({ where: { isActive: true } });
      for (const account of accounts) {
        await syncEmails(account.id);
      }

      // Process any unprocessed invoices
      const { processEmail } = await import("./modules/processing/pipeline");
      const emails = await prisma.email.findMany({
        where: { isInvoice: true, processed: false },
        take: 50,
      });
      for (const email of emails) {
        await processEmail(email.id).catch(() => null);
      }

      // Detect subscriptions
      await detectSubscriptions();

      const intervalMinutes = settings?.syncIntervalMinutes || 15;
      logger.info({ intervalMinutes }, "Auto-sync completed, scheduling next run");
      setTimeout(runSync, intervalMinutes * 60 * 1000);
    } catch (err) {
      logger.error(err, "Auto-sync error");
      setTimeout(runSync, 5 * 60 * 1000); // Retry in 5 min on error
    }
  };

  // Start first sync after 30 seconds
  setTimeout(runSync, 30 * 1000);
}

main();
