import { FastifyInstance } from "fastify";
import { prisma } from "../../config/prisma";

export async function healthRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    let dbStatus = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      dbStatus = "error";
    }

    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      database: dbStatus,
    };
  });
}
