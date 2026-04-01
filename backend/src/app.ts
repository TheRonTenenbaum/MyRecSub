import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import { logger } from "./config/logger";
import { AppError } from "./shared/errors";
import { registerModules } from "./modules";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // We use our own pino logger
  });

  // CORS - allow frontend
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AppError) {
      logger.warn({ err: error }, `AppError: ${error.message}`);
      return reply.status(error.statusCode).send({
        error: error.message,
        code: error.code,
      });
    }

    logger.error({ err: error }, "Unhandled error");
    return reply.status(500).send({
      error: "Internal server error",
    });
  });

  // Register all API modules under /api prefix
  await app.register(
    async (api) => {
      await registerModules(api);
    },
    { prefix: "/api" }
  );

  // Serve frontend static files in production
  const frontendPath = path.join(__dirname, "../../frontend/out");
  try {
    await app.register(fastifyStatic, {
      root: frontendPath,
      prefix: "/",
      decorateReply: false,
    });
  } catch {
    logger.info("Frontend static files not found - running in API-only mode");
  }

  return app;
}
