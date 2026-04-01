import { prisma } from "../../config/prisma";
import { subMonths, startOfMonth, endOfMonth, format } from "date-fns";

export async function getDashboardSummary() {
  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = endOfMonth(subMonths(now, 1));

  const [
    thisMonthDocs,
    lastMonthDocs,
    totalDocuments,
    activeSubscriptions,
    supplierCount,
  ] = await Promise.all([
    prisma.document.aggregate({
      where: {
        status: { in: ["completed", "verified"] },
        issueDate: { gte: thisMonthStart, lte: thisMonthEnd },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.document.aggregate({
      where: {
        status: { in: ["completed", "verified"] },
        issueDate: { gte: lastMonthStart, lte: lastMonthEnd },
      },
      _sum: { totalAmount: true },
      _count: true,
    }),
    prisma.document.count({ where: { status: { in: ["completed", "verified"] } } }),
    prisma.subscription.count({ where: { isActive: true } }),
    prisma.supplier.count(),
  ]);

  const thisMonthSpend = thisMonthDocs._sum.totalAmount || 0;
  const lastMonthSpend = lastMonthDocs._sum.totalAmount || 0;
  const monthOverMonth = lastMonthSpend > 0
    ? ((thisMonthSpend - lastMonthSpend) / lastMonthSpend) * 100
    : 0;

  return {
    thisMonthSpend: Math.round(thisMonthSpend * 100) / 100,
    lastMonthSpend: Math.round(lastMonthSpend * 100) / 100,
    monthOverMonth: Math.round(monthOverMonth * 10) / 10,
    thisMonthInvoices: thisMonthDocs._count,
    totalDocuments,
    activeSubscriptions,
    supplierCount,
  };
}

export async function getMonthlySpend(months: number = 12) {
  const now = new Date();
  const result: { month: string; amount: number; count: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const date = subMonths(now, i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);

    const data = await prisma.document.aggregate({
      where: {
        status: { in: ["completed", "verified"] },
        issueDate: { gte: start, lte: end },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    result.push({
      month: format(date, "yyyy-MM"),
      amount: Math.round((data._sum.totalAmount || 0) * 100) / 100,
      count: data._count,
    });
  }

  return result;
}

export async function getSpendBySupplier(limit: number = 10) {
  return prisma.supplier.findMany({
    where: { totalSpent: { gt: 0 } },
    select: {
      id: true,
      name: true,
      totalSpent: true,
      documentCount: true,
      category: true,
    },
    orderBy: { totalSpent: "desc" },
    take: limit,
  });
}

export async function getRecentDocuments(limit: number = 10) {
  return prisma.document.findMany({
    where: { status: { in: ["completed", "verified"] } },
    include: {
      supplier: { select: { id: true, name: true } },
    },
    orderBy: { issueDate: "desc" },
    take: limit,
  });
}
