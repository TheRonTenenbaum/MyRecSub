"use client";

import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function ProcessingPage() {
  const { data, loading, error, refetch } = useApi(() => api.processingJobs());

  const handleSyncAll = async () => {
    await api.gmailSyncAll();
    setTimeout(refetch, 2000);
  };

  const handleProcessAll = async () => {
    await api.processAll();
    setTimeout(refetch, 2000);
  };

  const handleDetect = async () => {
    await api.detectSubscriptions();
    setTimeout(refetch, 2000);
  };

  const statusColors: Record<string, string> = {
    queued: "bg-gray-100 text-gray-800",
    running: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  const statusLabels: Record<string, string> = {
    queued: "בתור",
    running: "רץ",
    completed: "הושלם",
    failed: "נכשל",
  };

  const typeLabels: Record<string, string> = {
    sync_emails: "סנכרון אימיילים",
    process_document: "עיבוד מסמך",
    detect_subscriptions: "זיהוי מנויים",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">עיבוד</h1>
        <p className="text-muted-foreground">סטטוס סנכרון, עיבוד חשבוניות וזיהוי מנויים</p>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleSyncAll}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          📧 סנכרן אימיילים
        </button>
        <button
          onClick={handleProcessAll}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          📄 עבד חשבוניות
        </button>
        <button
          onClick={handleDetect}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          🔄 זהה מנויים
        </button>
        <button
          onClick={refetch}
          className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
        >
          🔄 רענן
        </button>
      </div>

      {/* Jobs Table */}
      <div className="border rounded-lg bg-card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">טוען...</div>
        ) : error ? (
          <div className="p-8 text-center text-destructive">{error}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-right py-3 px-4 font-medium">סוג</th>
                <th className="text-right py-3 px-4 font-medium">סטטוס</th>
                <th className="text-right py-3 px-4 font-medium">התקדמות</th>
                <th className="text-right py-3 px-4 font-medium">נוצר</th>
                <th className="text-right py-3 px-4 font-medium">הושלם</th>
                <th className="text-right py-3 px-4 font-medium">שגיאה</th>
              </tr>
            </thead>
            <tbody>
              {data?.jobs?.map((job: any) => (
                <tr key={job.id} className="border-b">
                  <td className="py-3 px-4">{typeLabels[job.type] || job.type}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[job.status] || ""}`}>
                      {statusLabels[job.status] || job.status}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {job.total > 0 ? `${job.progress}/${job.total}` : "—"}
                  </td>
                  <td className="py-3 px-4">{formatDate(job.createdAt)}</td>
                  <td className="py-3 px-4">{formatDate(job.completedAt)}</td>
                  <td className="py-3 px-4 text-destructive text-xs max-w-xs truncate">
                    {job.error || "—"}
                  </td>
                </tr>
              ))}
              {(!data?.jobs || data.jobs.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground">
                    אין משימות עיבוד
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
