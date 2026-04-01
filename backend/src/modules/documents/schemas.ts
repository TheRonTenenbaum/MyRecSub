import { z } from "zod";

export const documentFiltersSchema = z.object({
  page: z.coerce.number().default(1),
  limit: z.coerce.number().default(25),
  search: z.string().optional(),
  supplierId: z.string().optional(),
  documentType: z.string().optional(),
  status: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  amountMin: z.coerce.number().optional(),
  amountMax: z.coerce.number().optional(),
  sortBy: z.enum(["issueDate", "totalAmount", "supplierName", "createdAt"]).default("issueDate"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const updateDocumentSchema = z.object({
  documentType: z.string().optional(),
  invoiceNumber: z.string().optional(),
  issueDate: z.string().optional(),
  dueDate: z.string().optional(),
  currency: z.string().optional(),
  subtotal: z.number().optional(),
  vatRate: z.number().optional(),
  vatAmount: z.number().optional(),
  totalAmount: z.number().optional(),
  paymentMethod: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  isVerified: z.boolean().optional(),
});

export type DocumentFilters = z.infer<typeof documentFiltersSchema>;
