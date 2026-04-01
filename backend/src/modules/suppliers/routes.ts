import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSuppliers, getSupplierById } from "./service";

export async function suppliersRoutes(app: FastifyInstance) {
  app.get("/", async (request) => {
    const schema = z.object({
      search: z.string().optional(),
      sortBy: z.enum(["totalSpent", "documentCount", "name", "createdAt"]).default("totalSpent"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    });
    const options = schema.parse(request.query);
    return getSuppliers(options);
  });

  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getSupplierById(id);
  });
}
