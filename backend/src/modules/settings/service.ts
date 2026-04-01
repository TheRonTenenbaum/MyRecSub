import { prisma } from "../../config/prisma";

export async function getSettings() {
  let settings = await prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings) {
    settings = await prisma.appSettings.create({
      data: { id: "singleton" },
    });
  }

  return {
    ...settings,
    // Mask API key for frontend
    openaiApiKey: settings.openaiApiKey ? "sk-***configured***" : null,
  };
}

export async function updateSettings(data: {
  language?: string;
  theme?: string;
  openaiApiKey?: string | null;
  syncIntervalMinutes?: number;
  autoSync?: boolean;
  firstRunCompleted?: boolean;
}) {
  const settings = await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });
  return settings;
}

export async function getRawSettings() {
  return prisma.appSettings.findUnique({
    where: { id: "singleton" },
  });
}
