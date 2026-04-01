"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate, getStatusBadge, getDocTypeBadge, getConfidenceColor } from "@/lib/format";

function DocumentDetail() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") || "";
  const { data: doc, loading, error, refetch } = useApi(
    () => (id ? api.document(id) : Promise.resolve(null)),
    [id]
  );
  const [showRawText, setShowRawText] = useState(false);

  const handleVerify = async () => {
    await api.updateDocument(id, { isVerified: true });
    refetch();
  };

  const handleReprocess = async () => {
    await api.reprocess(id);
    setTimeout(refetch, 3000);
  };

  if (!id) return <div className="p-8 text-center text-muted-foreground">לא נבחר מסמך</div>;
  if (loading) return <div className="p-8 text-center text-muted-foreground">טוען...</div>;
  if (error) return <div className="p-8 text-center text-destructive">{error}</div>;
  if (!doc) return null;

  const statusBadge = getStatusBadge(doc.status);
  const typeBadge = getDocTypeBadge(doc.documentType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <a href="/documents/" className="text-sm text-primary hover:underline">← חזרה לרשימה</a>
          <h1 className="text-2xl font-bold mt-2">
            {doc.supplier?.name || "מסמך"} - {doc.invoiceNumber || "ללא מספר"}
          </h1>
          <div className="flex gap-2 mt-2">
            <span className={`px-2 py-0.5 rounded-full text-xs ${typeBadge.color}`}>{typeBadge.label}</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.color}`}>{statusBadge.label}</span>
            <span className={`text-xs ${getConfidenceColor(doc.extractionScore)}`}>
              דיוק: {Math.round(doc.extractionScore * 100)}%
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleReprocess} className="px-4 py-2 border rounded-md text-sm hover:bg-muted">
            עבד מחדש
          </button>
          {!doc.isVerified && (
            <button onClick={handleVerify} className="px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700">
              ✓ אמת
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg p-6 bg-card space-y-4">
          <h2 className="text-lg font-semibold">נתונים שחולצו</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="ספק" value={doc.supplier?.name} />
            <Field label="מספר חשבונית" value={doc.invoiceNumber} />
            <Field label="תאריך" value={formatDate(doc.issueDate)} />
            <Field label="תאריך פירעון" value={formatDate(doc.dueDate)} />
            <Field label="מטבע" value={doc.currency} />
            <Field label="שיטת תשלום" value={doc.paymentMethod} />
          </div>
          <div className="border-t pt-4 mt-4">
            <h3 className="text-sm font-semibold mb-3">סכומים</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="לפני מע״מ" value={formatCurrency(doc.subtotal, doc.currency)} />
              <Field label="שיעור מע״מ" value={doc.vatRate ? `${doc.vatRate}%` : null} />
              <Field label="מע״מ" value={formatCurrency(doc.vatAmount, doc.currency)} />
              <div className="col-span-2 bg-primary/5 rounded-lg p-3">
                <p className="text-sm text-muted-foreground">סה״כ לתשלום</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(doc.totalAmount, doc.currency)}
                </p>
              </div>
            </div>
          </div>
          {doc.description && (
            <div className="border-t pt-4">
              <Field label="תיאור" value={doc.description} />
            </div>
          )}
          <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
            <p>שיטת חילוץ: {doc.extractionMethod || "—"}</p>
            <p>קובץ: {doc.fileName || "—"}</p>
            <p>נוצר: {formatDate(doc.createdAt)}</p>
          </div>
        </div>

        <div className="border rounded-lg p-6 bg-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{showRawText ? "טקסט גולמי" : "מידע נוסף"}</h2>
            <button onClick={() => setShowRawText(!showRawText)} className="text-sm text-primary hover:underline">
              {showRawText ? "הסתר טקסט גולמי" : "הצג טקסט גולמי"}
            </button>
          </div>
          {showRawText ? (
            <pre className="text-xs bg-muted p-4 rounded-md overflow-auto max-h-[600px] whitespace-pre-wrap" dir="auto">
              {doc.rawText || "אין טקסט גולמי"}
            </pre>
          ) : (
            <div className="space-y-4">
              {doc.email && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">פרטי אימייל</h3>
                  <p className="text-sm">נושא: {doc.email.subject}</p>
                  <p className="text-sm">מאת: {doc.email.fromAddress}</p>
                  <p className="text-sm">תאריך: {formatDate(doc.email.receivedAt)}</p>
                </div>
              )}
              {doc.subscription && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold mb-2">🔄 מנוי מזוהה</h3>
                  <p className="text-sm">תדירות: {doc.subscription.frequency}</p>
                  <p className="text-sm">סכום ממוצע: {formatCurrency(doc.subscription.averageAmount)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

export default function DocumentDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">טוען...</div>}>
      <DocumentDetail />
    </Suspense>
  );
}
