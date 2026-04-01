"use client";

import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate, formatPercentage, getStatusBadge, getDocTypeBadge } from "@/lib/format";

export default function DashboardPage() {
  const { data, loading, error } = useApi(() => api.dashboard());

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  const { summary, monthlySpend, topSuppliers, recentDocuments } = data;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">דשבורד</h1>
        <p className="text-muted-foreground">סקירה כללית של ההוצאות והמנויים שלך</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="הוצאות החודש"
          value={formatCurrency(summary.thisMonthSpend)}
          change={formatPercentage(summary.monthOverMonth)}
          changePositive={summary.monthOverMonth <= 0}
        />
        <SummaryCard
          title="הוצאות חודש קודם"
          value={formatCurrency(summary.lastMonthSpend)}
          subtitle={`${summary.thisMonthInvoices} חשבוניות החודש`}
        />
        <SummaryCard
          title="סה״כ חשבוניות"
          value={summary.totalDocuments.toString()}
          subtitle={`${summary.supplierCount} ספקים`}
        />
        <SummaryCard
          title="מנויים פעילים"
          value={summary.activeSubscriptions.toString()}
          subtitle="מנויים חוזרים"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Spend Chart */}
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">הוצאות חודשיות</h2>
          <div className="space-y-2">
            {monthlySpend.map((m: any) => (
              <div key={m.month} className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground w-20">{m.month}</span>
                <div className="flex-1 bg-muted rounded-full h-4">
                  <div
                    className="bg-primary rounded-full h-4 transition-all"
                    style={{
                      width: `${Math.min(100, (m.amount / Math.max(...monthlySpend.map((x: any) => x.amount || 1))) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-sm font-medium w-28 text-left">{formatCurrency(m.amount)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Suppliers */}
        <div className="border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">ספקים מובילים</h2>
          <div className="space-y-3">
            {topSuppliers.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.documentCount} חשבוניות</p>
                </div>
                <span className="font-semibold">{formatCurrency(s.totalSpent)}</span>
              </div>
            ))}
            {topSuppliers.length === 0 && (
              <p className="text-muted-foreground text-center py-4">אין נתונים עדיין</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="border rounded-lg p-6 bg-card">
        <h2 className="text-lg font-semibold mb-4">חשבוניות אחרונות</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-right py-2 px-3 font-medium">תאריך</th>
                <th className="text-right py-2 px-3 font-medium">ספק</th>
                <th className="text-right py-2 px-3 font-medium">סוג</th>
                <th className="text-right py-2 px-3 font-medium">סכום</th>
                <th className="text-right py-2 px-3 font-medium">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {recentDocuments.map((doc: any) => {
                const statusBadge = getStatusBadge(doc.status);
                const typeBadge = getDocTypeBadge(doc.documentType);
                return (
                  <tr key={doc.id} className="border-b hover:bg-muted/50 transition-colors">
                    <td className="py-2 px-3">{formatDate(doc.issueDate)}</td>
                    <td className="py-2 px-3">{doc.supplier?.name || "—"}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${typeBadge.color}`}>
                        {typeBadge.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {formatCurrency(doc.totalAmount, doc.currency)}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {recentDocuments.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-muted-foreground">
                    אין חשבוניות עדיין. חבר את חשבון ה-Gmail שלך בהגדרות.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  change,
  changePositive,
  subtitle,
}: {
  title: string;
  value: string;
  change?: string;
  changePositive?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {change && (
        <p className={`text-sm mt-1 ${changePositive ? "text-green-600" : "text-red-600"}`}>
          {change} מחודש קודם
        </p>
      )}
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">טוען נתונים...</p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-center">
        <p className="text-destructive text-lg font-medium">שגיאה</p>
        <p className="text-muted-foreground mt-2">{message}</p>
      </div>
    </div>
  );
}
