import { FastifyInstance } from "fastify";
import { healthRoutes } from "./health/routes";
import { settingsRoutes } from "./settings/routes";
import { gmailRoutes } from "./gmail/routes";
import { documentsRoutes } from "./documents/routes";
import { processingRoutes } from "./processing/routes";
import { subscriptionsRoutes } from "./subscriptions/routes";
import { suppliersRoutes } from "./suppliers/routes";
import { dashboardRoutes } from "./dashboard/routes";

export async function registerModules(app: FastifyInstance) {
  await app.register(healthRoutes, { prefix: "/health" });
  await app.register(settingsRoutes, { prefix: "/settings" });
  await app.register(gmailRoutes, { prefix: "/gmail" });
  await app.register(documentsRoutes, { prefix: "/documents" });
  await app.register(processingRoutes, { prefix: "/processing" });
  await app.register(subscriptionsRoutes, { prefix: "/subscriptions" });
  await app.register(suppliersRoutes, { prefix: "/suppliers" });
  await app.register(dashboardRoutes, { prefix: "/dashboard" });
}
