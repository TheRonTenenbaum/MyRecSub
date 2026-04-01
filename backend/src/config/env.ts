import { z } from "zod";
import path from "path";
import os from "os";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default("127.0.0.1"),

  // Database
  DATABASE_URL: z.string().default(() => {
    const dataDir = path.join(os.homedir(), ".myrecsub");
    return `file:${path.join(dataDir, "data.db")}`;
  }),

  // Gmail OAuth2
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().default("http://localhost:3001/api/gmail/callback"),

  // OpenAI (optional - AI fallback)
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Paths
  DATA_DIR: z.string().default(() => path.join(os.homedir(), ".myrecsub")),
  ATTACHMENTS_DIR: z.string().default(() => path.join(os.homedir(), ".myrecsub", "attachments")),
  LOGS_DIR: z.string().default(() => path.join(os.homedir(), ".myrecsub", "logs")),

  // Frontend
  FRONTEND_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return result.data;
}

export const env = loadEnv();
