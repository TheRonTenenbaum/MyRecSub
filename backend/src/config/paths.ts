import path from "path";
import fs from "fs";
import { env } from "./env";

export const paths = {
  dataDir: env.DATA_DIR,
  dbFile: path.join(env.DATA_DIR, "data.db"),
  attachmentsDir: env.ATTACHMENTS_DIR,
  logsDir: env.LOGS_DIR,
  tempDir: path.join(env.DATA_DIR, "temp"),
};

/**
 * Ensure all required directories exist
 */
export function ensureDirectories(): void {
  const dirs = [
    paths.dataDir,
    paths.attachmentsDir,
    paths.logsDir,
    paths.tempDir,
  ];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}
