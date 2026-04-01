import { prisma } from "../../config/prisma";

export async function getSubscriptions(options?: { activeOnly?: boolean }) {
  const where: any = {};
  if (options?.activeOnly !== false) {
    where.isActive = true;
  }

  return prisma.subscription.findMany({
    where,
    include: {
      supplier: {
        select: { id: true, name: true, category: true },
      },
      _count: { select: { documents: true } },
    },
    orderBy: { averageAmount: "desc" },
  });
}

export async function getSubscriptionById(id: string) {
  return prisma.subscription.findUniqueOrThrow({
    where: { id },
    include: {
      supplier: true,
      documents: {
        orderBy: { issueDate: "desc" },
        select: {
          id: true,
          issueDate: true,
          totalAmount: true,
          invoiceNumber: true,
          status: true,
        },
      },
    },
  });
}

export async function toggleSubscription(id: string, isActive: boolean) {
  return prisma.subscription.update({
    where: { id },
    data: { isActive },
  });
}

export async function getSubscriptionSummary() {
  const subscriptions = await prisma.subscription.findMany({
    where: { isActive: true },
    select: {
      averageAmount: true,
      currency: true,
      frequency: true,
    },
  });

  let monthlyTotal = 0;
  for (const sub of subscriptions) {
    switch (sub.frequency) {
      case "weekly":
        monthlyTotal += sub.averageAmount * 4.33;
        break;
      case "monthly":
        monthlyTotal += sub.averageAmount;
        break;
      case "quarterly":
        monthlyTotal += sub.averageAmount / 3;
        break;
      case "yearly":
        monthlyTotal += sub.averageAmount / 12;
        break;
    }
  }

  return {
    activeCount: subscriptions.length,
    monthlyTotal: Math.round(monthlyTotal * 100) / 100,
    yearlyTotal: Math.round(monthlyTotal * 12 * 100) / 100,
  };
}
