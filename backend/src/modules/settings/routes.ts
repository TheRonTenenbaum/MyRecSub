import { FastifyInstance } from "fastify";
import { z } from "zod";
import { getSettings, updateSettings } from "./service";

const updateSettingsSchema = z.object({
  language: z.enum(["he", "en"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
  openaiApiKey: z.string().nullable().optional(),
  syncIntervalMinutes: z.number().min(5).max(120).optional(),
  autoSync: z.boolean().optional(),
  firstRunCompleted: z.boolean().optional(),
});

export async function settingsRoutes(app: FastifyInstance) {
  // Get settings
  app.get("/", async () => {
    return getSettings();
  });

  // Update settings
  app.patch("/", async (request, reply) => {
    const body = updateSettingsSchema.parse(request.body);
    const settings = await updateSettings(body);
    return settings;
  });
}
