import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getDashboardSummary,
  getMonthlySpend,
  getSpendBySupplier,
  getRecentDocuments,
} from "./service";

export async function dashboardRoutes(app: FastifyInstance) {
  // Full dashboard data
  app.get("/", async () => {
    const [summary, monthlySpend, topSuppliers, recentDocs] = await Promise.all([
      getDashboardSummary(),
      getMonthlySpend(12),
      getSpendBySupplier(10),
      getRecentDocuments(10),
    ]);

    return {
      summary,
      monthlySpend,
      topSuppliers,
      recentDocuments: recentDocs,
    };
  });

  // Just summary
  app.get("/summary", async () => {
    return getDashboardSummary();
  });

  // Monthly spend chart data
  app.get("/monthly-spend", async (request) => {
    const schema = z.object({ months: z.coerce.number().default(12) });
    const { months } = schema.parse(request.query);
    return getMonthlySpend(months);
  });

  // Top suppliers
  app.get("/top-suppliers", async (request) => {
    const schema = z.object({ limit: z.coerce.number().default(10) });
    const { limit } = schema.parse(request.query);
    return getSpendBySupplier(limit);
  });

  // Recent documents
  app.get("/recent", async (request) => {
    const schema = z.object({ limit: z.coerce.number().default(10) });
    const { limit } = schema.parse(request.query);
    return getRecentDocuments(limit);
  });
}
