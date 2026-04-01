"use client";

import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate, getStatusBadge, getDocTypeBadge, getConfidenceColor, getConfidenceLabel } from "@/lib/format";

export default function DocumentsPage() {
  const [filters, setFilters] = useState({
    page: "1",
    limit: "25",
    search: "",
    documentType: "",
    status: "",
    sortBy: "issueDate",
    sortOrder: "desc",
  });

  const { data, loading, error, refetch } = useApi(
    () => api.documents(Object.fromEntries(Object.entries(filters).filter(([_, v]) => v))),
    [JSON.stringify(filters)]
  );

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, search: e.target.value, page: "1" });
  };

  const handleReprocess = async (id: string) => {
    try {
      await api.reprocess(id);
      setTimeout(refetch, 2000);
    } catch (err) {
      alert("שגיאה בעיבוד מחדש");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">חשבוניות וקבלות</h1>
          <p className="text-muted-foreground">כל המסמכים שזוהו מהמייל</p>
        </div>
        <button
          onClick={() => api.processAll().then(() => setTimeout(refetch, 3000))}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          עבד הכל
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="חיפוש..."
          value={filters.search}
          onChange={handleSearch}
          className="px-3 py-2 border rounded-md text-sm w-64"
        />
        <select
          value={filters.documentType}
          onChange={(e) => setFilters({ ...filters, documentType: e.target.value, page: "1" })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">כל הסוגים</option>
          <option value="invoice">חשבונית</option>
          <option value="tax_invoice">חשבונית מס</option>
          <option value="receipt">קבלה</option>
          <option value="credit_note">זיכוי</option>
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value, page: "1" })}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="">כל הסטטוסים</option>
          <option value="completed">הושלם</option>
          <option value="verified">מאומת</option>
          <option value="pending">ממתין</option>
          <option value="error">שגיאה</option>
        </select>
      </div>

      {/* Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">טוען...</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-right py-3 px-4 font-medium">תאריך</th>
                    <th className="text-right py-3 px-4 font-medium">ספק</th>
                    <th className="text-right py-3 px-4 font-medium">מספר חשבונית</th>
                    <th className="text-right py-3 px-4 font-medium">סוג</th>
                    <th className="text-right py-3 px-4 font-medium">סכום</th>
                    <th className="text-right py-3 px-4 font-medium">דיוק</th>
                    <th className="text-right py-3 px-4 font-medium">סטטוס</th>
                    <th className="text-right py-3 px-4 font-medium">פעולות</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.documents?.map((doc: any) => {
                    const statusBadge = getStatusBadge(doc.status);
                    const typeBadge = getDocTypeBadge(doc.documentType);
                    return (
                      <tr key={doc.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">{formatDate(doc.issueDate)}</td>
                        <td className="py-3 px-4 font-medium">{doc.supplier?.name || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{doc.invoiceNumber || "—"}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${typeBadge.color}`}>
                            {typeBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-bold text-lg">
                          {formatCurrency(doc.totalAmount, doc.currency)}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`text-xs ${getConfidenceColor(doc.extractionScore)}`}>
                            {getConfidenceLabel(doc.extractionScore)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.color}`}>
                            {statusBadge.label}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            <a
                              href={`/document/?id=${doc.id}`}
                              className="text-primary hover:underline text-xs"
                            >
                              צפה
                            </a>
                            <button
                              onClick={() => handleReprocess(doc.id)}
                              className="text-muted-foreground hover:text-foreground text-xs"
                            >
                              עבד מחדש
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {data?.documents?.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-8 text-muted-foreground">
                        לא נמצאו חשבוניות
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div className="flex items-center justify-between p-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {data.total} תוצאות, עמוד {data.page} מתוך {data.pages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={data.page <= 1}
                    onClick={() => setFilters({ ...filters, page: String(data.page - 1) })}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                  >
                    הקודם
                  </button>
                  <button
                    disabled={data.page >= data.pages}
                    onClick={() => setFilters({ ...filters, page: String(data.page + 1) })}
                    className="px-3 py-1 border rounded text-sm disabled:opacity-50"
                  >
                    הבא
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
