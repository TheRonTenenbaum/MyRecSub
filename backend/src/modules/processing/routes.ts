import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { processEmail, reprocessDocument } from "./pipeline";
import { taskQueue } from "../../queue/task-queue";

export async function processingRoutes(app: FastifyInstance) {
  // Get processing jobs
  app.get("/jobs", async (request) => {
    const schema = z.object({
      status: z.enum(["queued", "running", "completed", "failed"]).optional(),
      page: z.coerce.number().default(1),
      limit: z.coerce.number().default(50),
    });
    const { status, page, limit } = schema.parse(request.query);

    const where: any = {};
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.processingJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.processingJob.count({ where }),
    ]);

    return { jobs, total, page, limit };
  });

  // Process all unprocessed invoice emails
  app.post("/process-all", async () => {
    const emails = await prisma.email.findMany({
      where: { isInvoice: true, processed: false },
      take: 100,
    });

    const job = await prisma.processingJob.create({
      data: {
        type: "process_document",
        status: "running",
        total: emails.length,
        startedAt: new Date(),
      },
    });

    // Process in background
    taskQueue.add(async () => {
      let processed = 0;
      for (const email of emails) {
        try {
          await processEmail(email.id);
          processed++;
          await prisma.processingJob.update({
            where: { id: job.id },
            data: { progress: processed },
          });
        } catch (error) {
          // Continue processing other emails
        }
      }

      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          status: "completed",
          progress: processed,
          completedAt: new Date(),
        },
      });
    });

    return {
      message: `Processing ${emails.length} emails`,
      jobId: job.id,
    };
  });

  // Reprocess a specific document
  app.post("/reprocess/:id", async (request) => {
    const { id } = request.params as { id: string };

    const job = await prisma.processingJob.create({
      data: {
        type: "process_document",
        status: "queued",
        entityId: id,
      },
    });

    taskQueue.add(async () => {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });

      try {
        await reprocessDocument(id);
        await prisma.processingJob.update({
          where: { id: job.id },
          data: { status: "completed", completedAt: new Date() },
        });
      } catch (error) {
        await prisma.processingJob.update({
          where: { id: job.id },
          data: {
            status: "failed",
            error: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          },
        });
      }
    });

    return { jobId: job.id };
  });
}
