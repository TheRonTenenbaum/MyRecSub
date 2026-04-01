import { FastifyInstance } from "fastify";
import { documentFiltersSchema, updateDocumentSchema } from "./schemas";
import { getDocuments, getDocumentById, updateDocument, deleteDocument } from "./service";
import { prisma } from "../../config/prisma";

export async function documentsRoutes(app: FastifyInstance) {
  // List documents with filters
  app.get("/", async (request) => {
    const filters = documentFiltersSchema.parse(request.query);
    return getDocuments(filters);
  });

  // Get single document
  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getDocumentById(id);
  });

  // Update document (manual corrections)
  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const data = updateDocumentSchema.parse(request.body);

    const updateData: any = { ...data };
    if (data.issueDate) updateData.issueDate = new Date(data.issueDate);
    if (data.dueDate) updateData.dueDate = new Date(data.dueDate);
    if (data.isVerified) updateData.status = "verified";

    return updateDocument(id, updateData);
  });

  // Delete document
  app.delete("/:id", async (request) => {
    const { id } = request.params as { id: string };
    await deleteDocument(id);
    return { success: true };
  });

  // Get document statistics
  app.get("/stats", async () => {
    const [total, completed, errors, verified] = await Promise.all([
      prisma.document.count(),
      prisma.document.count({ where: { status: "completed" } }),
      prisma.document.count({ where: { status: "error" } }),
      prisma.document.count({ where: { isVerified: true } }),
    ]);

    return { total, completed, errors, verified };
  });
}
