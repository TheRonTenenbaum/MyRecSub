import { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  getSubscriptions,
  getSubscriptionById,
  toggleSubscription,
  getSubscriptionSummary,
} from "./service";
import { detectSubscriptions } from "./detector";
import { taskQueue } from "../../queue/task-queue";
import { prisma } from "../../config/prisma";

export async function subscriptionsRoutes(app: FastifyInstance) {
  // List subscriptions
  app.get("/", async (request) => {
    const schema = z.object({
      activeOnly: z.coerce.boolean().default(true),
    });
    const { activeOnly } = schema.parse(request.query);
    return getSubscriptions({ activeOnly });
  });

  // Get summary
  app.get("/summary", async () => {
    return getSubscriptionSummary();
  });

  // Get single subscription
  app.get("/:id", async (request) => {
    const { id } = request.params as { id: string };
    return getSubscriptionById(id);
  });

  // Toggle active/inactive
  app.patch("/:id", async (request) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ isActive: z.boolean() });
    const { isActive } = schema.parse(request.body);
    return toggleSubscription(id, isActive);
  });

  // Trigger subscription detection
  app.post("/detect", async () => {
    const job = await prisma.processingJob.create({
      data: {
        type: "detect_subscriptions",
        status: "queued",
      },
    });

    taskQueue.add(async () => {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { status: "running", startedAt: new Date() },
      });

      try {
        const detected = await detectSubscriptions();
        await prisma.processingJob.update({
          where: { id: job.id },
          data: {
            status: "completed",
            progress: detected,
            total: detected,
            completedAt: new Date(),
          },
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

    return { message: "Detection started", jobId: job.id };
  });
}
