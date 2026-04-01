import { prisma } from "../../config/prisma";
import { DocumentFilters } from "./schemas";
import { Prisma } from "@prisma/client";

export async function getDocuments(filters: DocumentFilters) {
  const where: Prisma.DocumentWhereInput = {};

  if (filters.search) {
    where.OR = [
      { supplier: { name: { contains: filters.search } } },
      { invoiceNumber: { contains: filters.search } },
      { description: { contains: filters.search } },
    ];
  }

  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.documentType) where.documentType = filters.documentType;
  if (filters.status) where.status = filters.status;

  if (filters.dateFrom || filters.dateTo) {
    where.issueDate = {};
    if (filters.dateFrom) where.issueDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.issueDate.lte = new Date(filters.dateTo);
  }

  if (filters.amountMin !== undefined || filters.amountMax !== undefined) {
    where.totalAmount = {};
    if (filters.amountMin !== undefined) where.totalAmount.gte = filters.amountMin;
    if (filters.amountMax !== undefined) where.totalAmount.lte = filters.amountMax;
  }

  const orderBy: Prisma.DocumentOrderByWithRelationInput = {};
  if (filters.sortBy === "supplierName") {
    orderBy.supplier = { name: filters.sortOrder };
  } else {
    (orderBy as any)[filters.sortBy] = filters.sortOrder;
  }

  const [documents, total] = await Promise.all([
    prisma.document.findMany({
      where,
      include: {
        supplier: { select: { id: true, name: true } },
      },
      orderBy,
      skip: (filters.page - 1) * filters.limit,
      take: filters.limit,
    }),
    prisma.document.count({ where }),
  ]);

  return {
    documents,
    total,
    page: filters.page,
    limit: filters.limit,
    pages: Math.ceil(total / filters.limit),
  };
}

export async function getDocumentById(id: string) {
  return prisma.document.findUniqueOrThrow({
    where: { id },
    include: {
      supplier: true,
      email: {
        select: {
          id: true,
          subject: true,
          fromAddress: true,
          receivedAt: true,
        },
      },
      subscription: {
        select: { id: true, frequency: true, averageAmount: true },
      },
    },
  });
}

export async function updateDocument(id: string, data: Prisma.DocumentUpdateInput) {
  return prisma.document.update({
    where: { id },
    data,
    include: { supplier: true },
  });
}

export async function deleteDocument(id: string) {
  return prisma.document.delete({ where: { id } });
}
