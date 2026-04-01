import { buildApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { ensureDirectories } from "./config/paths";

async function main() {
  // Ensure data directories exist
  ensureDirectories();

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    logger.info(`MyRecSub backend running on http://${env.HOST}:${env.PORT}`);
    logger.info(`Environment: ${env.NODE_ENV}`);
    logger.info(`Database: ${env.DATABASE_URL}`);
  } catch (err) {
    logger.error(err, "Failed to start server");
    process.exit(1);
  }
}

main();
