import { format, parseISO } from "date-fns";
import { he, enUS } from "date-fns/locale";

export function formatCurrency(amount: number | null, currency = "ILS"): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat(currency === "ILS" ? "he-IL" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date | null, locale = "he"): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", {
    locale: locale === "he" ? he : enUS,
  });
}

export function formatDateRelative(date: string | Date | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? parseISO(date) : date;
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "היום";
  if (diffDays === 1) return "אתמול";
  if (diffDays < 7) return `לפני ${diffDays} ימים`;
  if (diffDays < 30) return `לפני ${Math.floor(diffDays / 7)} שבועות`;
  return formatDate(d);
}

export function formatPercentage(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.8) return "text-green-600";
  if (score >= 0.5) return "text-yellow-600";
  return "text-red-600";
}

export function getConfidenceLabel(score: number): string {
  if (score >= 0.8) return "גבוהה";
  if (score >= 0.5) return "בינונית";
  return "נמוכה";
}

export function getStatusBadge(status: string): { label: string; color: string } {
  const statusMap: Record<string, { label: string; color: string }> = {
    pending: { label: "ממתין", color: "bg-gray-100 text-gray-800" },
    processing: { label: "מעבד", color: "bg-blue-100 text-blue-800" },
    completed: { label: "הושלם", color: "bg-green-100 text-green-800" },
    verified: { label: "מאומת", color: "bg-emerald-100 text-emerald-800" },
    error: { label: "שגיאה", color: "bg-red-100 text-red-800" },
  };
  return statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };
}

export function getDocTypeBadge(type: string | null): { label: string; color: string } {
  const typeMap: Record<string, { label: string; color: string }> = {
    invoice: { label: "חשבונית", color: "bg-blue-100 text-blue-800" },
    tax_invoice: { label: "חשבונית מס", color: "bg-indigo-100 text-indigo-800" },
    receipt: { label: "קבלה", color: "bg-green-100 text-green-800" },
    credit_note: { label: "זיכוי", color: "bg-orange-100 text-orange-800" },
    proforma: { label: "חשבון עסקה", color: "bg-purple-100 text-purple-800" },
  };
  return typeMap[type || ""] || { label: type || "לא ידוע", color: "bg-gray-100 text-gray-800" };
}

export const frequencyLabels: Record<string, string> = {
  weekly: "שבועי",
  monthly: "חודשי",
  quarterly: "רבעוני",
  yearly: "שנתי",
};
