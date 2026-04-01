import { prisma } from "../../config/prisma";
import { normalizeHebrew, containsHebrew } from "../../shared/hebrew-utils";
import Fuse from "fuse.js";

/**
 * Normalize a supplier name for deduplication
 */
export function normalizeSupplierName(name: string): string {
  let normalized = name.trim();

  // Remove common suffixes
  normalized = normalized
    .replace(/\s*(בע"מ|בע''מ|Ltd\.?|Inc\.?|LLC|Corp\.?|Co\.?)\s*/gi, "")
    .trim();

  // Normalize Hebrew if present
  if (containsHebrew(normalized)) {
    normalized = normalizeHebrew(normalized);
  }

  // Lowercase English parts
  normalized = normalized.toLowerCase();

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  return normalized;
}

/**
 * Find existing supplier by fuzzy name match, or create a new one
 */
export async function findOrCreateSupplier(
  name: string,
  businessId?: string | null
): Promise<{ id: string; name: string }> {
  const normalizedName = normalizeSupplierName(name);

  // First try exact normalized match
  const exactMatch = await prisma.supplier.findUnique({
    where: { normalizedName },
  });
  if (exactMatch) return exactMatch;

  // Try business ID match
  if (businessId) {
    const bizMatch = await prisma.supplier.findFirst({
      where: { businessId },
    });
    if (bizMatch) return bizMatch;
  }

  // Try fuzzy name match against existing suppliers
  const allSuppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, normalizedName: true },
  });

  if (allSuppliers.length > 0) {
    const fuse = new Fuse(allSuppliers, {
      keys: ["normalizedName"],
      threshold: 0.3, // Strict enough to avoid false matches
      includeScore: true,
    });

    const fuzzyResults = fuse.search(normalizedName);
    if (fuzzyResults.length > 0 && fuzzyResults[0].score !== undefined && fuzzyResults[0].score < 0.2) {
      return fuzzyResults[0].item;
    }
  }

  // Create new supplier
  const supplier = await prisma.supplier.create({
    data: {
      name: name.trim(),
      normalizedName,
      businessId: businessId || null,
    },
  });

  return supplier;
}

export async function getSuppliers(options?: { search?: string; sortBy?: string; sortOrder?: string }) {
  const where: any = {};
  if (options?.search) {
    where.OR = [
      { name: { contains: options.search } },
      { normalizedName: { contains: options.search } },
    ];
  }

  return prisma.supplier.findMany({
    where,
    orderBy: { [options?.sortBy || "totalSpent"]: options?.sortOrder || "desc" },
    include: {
      _count: { select: { documents: true, subscriptions: true } },
    },
  });
}

export async function getSupplierById(id: string) {
  return prisma.supplier.findUniqueOrThrow({
    where: { id },
    include: {
      documents: {
        orderBy: { issueDate: "desc" },
        take: 50,
      },
      subscriptions: true,
    },
  });
}
