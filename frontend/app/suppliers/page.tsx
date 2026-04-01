"use client";

import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format";

export default function SuppliersPage() {
  const [search, setSearch] = useState("");
  const { data: suppliers, loading, error } = useApi(
    () => api.suppliers({ search: search || undefined }),
    [search]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">ספקים</h1>
        <p className="text-muted-foreground">כל הספקים שזוהו מהחשבוניות</p>
      </div>

      <input
        type="text"
        placeholder="חפש ספק..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border rounded-md text-sm w-64"
      />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground">טוען...</div>
      ) : error ? (
        <div className="text-center py-8 text-destructive">{error}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers?.map((supplier: any) => (
            <div key={supplier.id} className="border rounded-lg p-5 bg-card hover:shadow-md transition-all">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-lg">{supplier.name}</h3>
                {supplier.category && (
                  <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                    {supplier.category}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">סה״כ הוצאות</span>
                  <span className="font-bold text-lg">{formatCurrency(supplier.totalSpent)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">חשבוניות</span>
                  <span>{supplier._count?.documents || supplier.documentCount}</span>
                </div>
                {supplier._count?.subscriptions > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">מנויים</span>
                    <span className="text-primary">{supplier._count.subscriptions} פעילים</span>
                  </div>
                )}
                {supplier.businessId && (
                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    ח.פ: {supplier.businessId}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(!suppliers || suppliers.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              לא נמצאו ספקים
            </div>
          )}
        </div>
      )}
    </div>
  );
}
