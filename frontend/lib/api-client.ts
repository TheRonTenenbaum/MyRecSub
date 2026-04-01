const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {} } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}${path}`, config);

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(error.error || `API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Health
  health: () => request("/health"),

  // Dashboard
  dashboard: () => request<any>("/dashboard"),
  dashboardSummary: () => request<any>("/dashboard/summary"),
  monthlySpend: (months = 12) => request<any>(`/dashboard/monthly-spend?months=${months}`),
  topSuppliers: (limit = 10) => request<any>(`/dashboard/top-suppliers?limit=${limit}`),

  // Documents
  documents: (params?: Record<string, any>) => {
    const query = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return request<any>(`/documents${query}`);
  },
  document: (id: string) => request<any>(`/documents/${id}`),
  updateDocument: (id: string, data: any) =>
    request<any>(`/documents/${id}`, { method: "PATCH", body: data }),
  deleteDocument: (id: string) =>
    request<void>(`/documents/${id}`, { method: "DELETE" }),

  // Suppliers
  suppliers: (params?: Record<string, any>) => {
    const query = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return request<any>(`/suppliers${query}`);
  },
  supplier: (id: string) => request<any>(`/suppliers/${id}`),

  // Subscriptions
  subscriptions: (activeOnly = true) =>
    request<any>(`/subscriptions?activeOnly=${activeOnly}`),
  subscriptionSummary: () => request<any>("/subscriptions/summary"),
  subscription: (id: string) => request<any>(`/subscriptions/${id}`),
  toggleSubscription: (id: string, isActive: boolean) =>
    request<any>(`/subscriptions/${id}`, { method: "PATCH", body: { isActive } }),
  detectSubscriptions: () =>
    request<any>("/subscriptions/detect", { method: "POST" }),

  // Gmail
  gmailAccounts: () => request<any>("/gmail/accounts"),
  gmailAuthUrl: () => request<{ url: string }>("/gmail/auth-url"),
  gmailSync: (accountId?: string, daysBack?: number) =>
    request<any>("/gmail/sync", { method: "POST", body: { accountId, daysBack } }),
  gmailSyncAll: () => request<any>("/gmail/sync-all", { method: "POST" }),
  gmailDisconnect: (id: string) =>
    request<any>(`/gmail/accounts/${id}`, { method: "DELETE" }),

  // Processing
  processingJobs: (params?: Record<string, any>) => {
    const query = params ? "?" + new URLSearchParams(params as any).toString() : "";
    return request<any>(`/processing/jobs${query}`);
  },
  processAll: () => request<any>("/processing/process-all", { method: "POST" }),
  reprocess: (id: string) =>
    request<any>(`/processing/reprocess/${id}`, { method: "POST" }),

  // Settings
  settings: () => request<any>("/settings"),
  updateSettings: (data: any) =>
    request<any>("/settings", { method: "PATCH", body: data }),
};
