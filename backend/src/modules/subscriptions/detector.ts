import { prisma } from "../../config/prisma";
import { logger } from "../../config/logger";
import { addMonths, addWeeks, addYears, addQuarters, differenceInDays } from "date-fns";

interface FrequencyAnalysis {
  frequency: "weekly" | "monthly" | "quarterly" | "yearly" | null;
  confidence: number;
  averageInterval: number;
}

/**
 * Detect recurring subscriptions from invoice history
 * Requires 3+ invoices from the same supplier with consistent timing and amounts
 */
export async function detectSubscriptions(): Promise<number> {
  // Get all suppliers with 3+ completed documents
  const suppliers = await prisma.supplier.findMany({
    where: {
      documents: {
        some: {
          status: "completed",
          totalAmount: { not: null },
          issueDate: { not: null },
        },
      },
    },
    include: {
      documents: {
        where: {
          status: "completed",
          totalAmount: { not: null },
          issueDate: { not: null },
        },
        orderBy: { issueDate: "asc" },
        select: {
          id: true,
          issueDate: true,
          totalAmount: true,
          currency: true,
        },
      },
    },
  });

  let detected = 0;

  for (const supplier of suppliers) {
    if (supplier.documents.length < 3) continue;

    const docs = supplier.documents.filter(
      (d) => d.issueDate !== null && d.totalAmount !== null
    );

    if (docs.length < 3) continue;

    // Analyze frequency
    const intervals: number[] = [];
    for (let i = 1; i < docs.length; i++) {
      const days = differenceInDays(
        docs[i].issueDate!,
        docs[i - 1].issueDate!
      );
      intervals.push(days);
    }

    const freqAnalysis = analyzeFrequency(intervals);
    if (!freqAnalysis.frequency || freqAnalysis.confidence < 0.5) continue;

    // Analyze amount consistency
    const amounts = docs.map((d) => d.totalAmount!);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const amountVariance =
      amounts.reduce((sum, a) => sum + Math.pow(a - avgAmount, 2), 0) / amounts.length;
    const amountStdDev = Math.sqrt(amountVariance);
    const amountConsistency = avgAmount > 0 ? 1 - amountStdDev / avgAmount : 0;

    // Need at least 80% amount consistency
    if (amountConsistency < 0.8) continue;

    // Calculate overall confidence
    const confidence = (freqAnalysis.confidence + amountConsistency) / 2;

    // Calculate next expected charge
    const lastDoc = docs[docs.length - 1];
    const nextExpected = calculateNextDate(
      lastDoc.issueDate!,
      freqAnalysis.frequency
    );

    // Build price history
    const priceHistory = docs.map((d) => ({
      date: d.issueDate!.toISOString().split("T")[0],
      amount: d.totalAmount!,
    }));

    // Create or update subscription
    const existing = await prisma.subscription.findFirst({
      where: { supplierId: supplier.id, isActive: true },
    });

    if (existing) {
      await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          averageAmount: Math.round(avgAmount * 100) / 100,
          frequency: freqAnalysis.frequency,
          lastChargeAt: lastDoc.issueDate,
          nextExpectedAt: nextExpected,
          confidence,
          priceHistory: JSON.stringify(priceHistory),
        },
      });

      // Link documents
      for (const doc of docs) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { subscriptionId: existing.id },
        });
      }
    } else {
      const subscription = await prisma.subscription.create({
        data: {
          supplierId: supplier.id,
          averageAmount: Math.round(avgAmount * 100) / 100,
          currency: docs[0].currency,
          frequency: freqAnalysis.frequency,
          lastChargeAt: lastDoc.issueDate,
          nextExpectedAt: nextExpected,
          isActive: true,
          confidence,
          priceHistory: JSON.stringify(priceHistory),
        },
      });

      // Link documents
      for (const doc of docs) {
        await prisma.document.update({
          where: { id: doc.id },
          data: { subscriptionId: subscription.id },
        });
      }

      detected++;
    }

    logger.info(
      {
        supplier: supplier.name,
        frequency: freqAnalysis.frequency,
        avgAmount,
        confidence: Math.round(confidence * 100),
        docs: docs.length,
      },
      "Subscription detected"
    );
  }

  return detected;
}

function analyzeFrequency(intervals: number[]): FrequencyAnalysis {
  const avgInterval =
    intervals.reduce((a, b) => a + b, 0) / intervals.length;

  // Check against known frequencies
  const frequencies: {
    name: "weekly" | "monthly" | "quarterly" | "yearly";
    expected: number;
    tolerance: number;
  }[] = [
    { name: "weekly", expected: 7, tolerance: 3 },
    { name: "monthly", expected: 30, tolerance: 7 },
    { name: "quarterly", expected: 91, tolerance: 15 },
    { name: "yearly", expected: 365, tolerance: 30 },
  ];

  let bestMatch: FrequencyAnalysis = {
    frequency: null,
    confidence: 0,
    averageInterval: avgInterval,
  };

  for (const freq of frequencies) {
    // Check how many intervals fall within tolerance
    const matchingIntervals = intervals.filter(
      (i) => Math.abs(i - freq.expected) <= freq.tolerance
    );
    const matchRate = matchingIntervals.length / intervals.length;

    if (matchRate > bestMatch.confidence && matchRate >= 0.6) {
      bestMatch = {
        frequency: freq.name,
        confidence: matchRate,
        averageInterval: avgInterval,
      };
    }
  }

  return bestMatch;
}

function calculateNextDate(
  lastDate: Date,
  frequency: "weekly" | "monthly" | "quarterly" | "yearly"
): Date {
  switch (frequency) {
    case "weekly":
      return addWeeks(lastDate, 1);
    case "monthly":
      return addMonths(lastDate, 1);
    case "quarterly":
      return addQuarters(lastDate, 1);
    case "yearly":
      return addYears(lastDate, 1);
  }
}
