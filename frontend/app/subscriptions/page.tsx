"use client";

import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatCurrency, formatDate, frequencyLabels } from "@/lib/format";

export default function SubscriptionsPage() {
  const { data: subscriptions, loading, error, refetch } = useApi(
    () => api.subscriptions(true)
  );
  const { data: summary } = useApi(() => api.subscriptionSummary());

  const handleDetect = async () => {
    await api.detectSubscriptions();
    setTimeout(refetch, 3000);
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    await api.toggleSubscription(id, !isActive);
    refetch();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מנויים חוזרים</h1>
          <p className="text-muted-foreground">חיובים חוזרים שזוהו אוטומטית</p>
        </div>
        <button
          onClick={handleDetect}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90"
        >
          זהה מנויים
        </button>
      </div>

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">מנויים פעילים</p>
            <p className="text-2xl font-bold">{summary.activeCount}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">עלות חודשית מוערכת</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.monthlyTotal)}</p>
          </div>
          <div className="border rounded-lg p-4 bg-card">
            <p className="text-sm text-muted-foreground">עלות שנתית מוערכת</p>
            <p className="text-2xl font-bold">{formatCurrency(summary.yearlyTotal)}</p>
          </div>
        </div>
      )}

      {/* Subscription Cards */}
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">טוען...</div>
      ) : error ? (
        <div className="text-center py-8 text-destructive">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subscriptions?.map((sub: any) => (
            <div
              key={sub.id}
              className={`border rounded-lg p-5 bg-card transition-all hover:shadow-md ${
                !sub.isActive ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-lg">{sub.supplier?.name}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {frequencyLabels[sub.frequency] || sub.frequency}
                  </span>
                </div>
                <button
                  onClick={() => handleToggle(sub.id, sub.isActive)}
                  className={`text-xs px-2 py-1 rounded ${
                    sub.isActive
                      ? "bg-green-100 text-green-800 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {sub.isActive ? "פעיל" : "לא פעיל"}
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">סכום</span>
                  <span className="font-bold text-xl">
                    {formatCurrency(sub.averageAmount, sub.currency)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">חיוב אחרון</span>
                  <span>{formatDate(sub.lastChargeAt)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">חיוב צפוי הבא</span>
                  <span className="text-primary font-medium">{formatDate(sub.nextExpectedAt)}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">עלות שנתית</span>
                  <span className="font-medium">
                    {formatCurrency(
                      sub.frequency === "monthly"
                        ? sub.averageAmount * 12
                        : sub.frequency === "quarterly"
                        ? sub.averageAmount * 4
                        : sub.frequency === "weekly"
                        ? sub.averageAmount * 52
                        : sub.averageAmount
                    , sub.currency)}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">חשבוניות</span>
                  <span>{sub._count?.documents || 0}</span>
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">ביטחון:</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5">
                      <div
                        className="bg-primary rounded-full h-1.5"
                        style={{ width: `${sub.confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(sub.confidence * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(!subscriptions || subscriptions.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <p className="text-lg">לא זוהו מנויים עדיין</p>
              <p className="text-sm mt-2">לחץ על &quot;זהה מנויים&quot; לאחר שיש לפחות 3 חשבוניות מאותו ספק</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
