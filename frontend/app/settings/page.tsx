"use client";

import { useState } from "react";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { formatDate } from "@/lib/format";

export default function SettingsPage() {
  const { data: settings, loading, refetch } = useApi(() => api.settings());
  const { data: accounts, refetch: refetchAccounts } = useApi(() => api.gmailAccounts());
  const [openaiKey, setOpenaiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const handleConnectGmail = async () => {
    try {
      const { url } = await api.gmailAuthUrl();
      window.open(url, "_blank", "width=600,height=700");
    } catch (err) {
      alert("שגיאה בהתחברות ל-Gmail. בדוק שהגדרת Google Client ID ו-Secret.");
    }
  };

  const handleDisconnect = async (id: string) => {
    if (confirm("בטוח שרוצה לנתק חשבון זה?")) {
      await api.gmailDisconnect(id);
      refetchAccounts();
    }
  };

  const handleSaveApiKey = async () => {
    setSaving(true);
    try {
      await api.updateSettings({ openaiApiKey: openaiKey || null });
      setOpenaiKey("");
      refetch();
    } catch {
      alert("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    await api.updateSettings({ [key]: value });
    refetch();
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">טוען...</div>;

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted-foreground">ניהול חשבונות Gmail, AI, ושפה</p>
      </div>

      {/* Gmail Accounts */}
      <section className="border rounded-lg p-6 bg-card space-y-4">
        <h2 className="text-lg font-semibold">📧 חשבונות Gmail</h2>
        <p className="text-sm text-muted-foreground">
          חבר את חשבונות ה-Gmail שלך לזיהוי אוטומטי של חשבוניות
        </p>

        {accounts?.map((account: any) => (
          <div
            key={account.id}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
          >
            <div>
              <p className="font-medium">{account.email}</p>
              <p className="text-xs text-muted-foreground">
                סנכרון אחרון: {formatDate(account.lastSyncAt) || "לא סונכרן עדיין"} |{" "}
                {account._count?.emails || 0} אימיילים
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => api.gmailSync(account.id).then(() => setTimeout(refetchAccounts, 2000))}
                className="text-xs px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                סנכרן
              </button>
              <button
                onClick={() => handleDisconnect(account.id)}
                className="text-xs px-3 py-1 border border-destructive text-destructive rounded hover:bg-destructive/10"
              >
                נתק
              </button>
            </div>
          </div>
        ))}

        <button
          onClick={handleConnectGmail}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 w-full"
        >
          + חבר חשבון Gmail
        </button>
      </section>

      {/* OpenAI API Key */}
      <section className="border rounded-lg p-6 bg-card space-y-4">
        <h2 className="text-lg font-semibold">🤖 OpenAI API Key (אופציונלי)</h2>
        <p className="text-sm text-muted-foreground">
          משמש רק כגיבוי כשחילוץ אוטומטי נכשל. העלות כ-0.006$ לחשבונית. המערכת עובדת גם בלי.
        </p>

        <div className="flex items-center gap-2">
          {settings?.openaiApiKey ? (
            <div className="flex-1">
              <p className="text-sm text-green-600">✓ מפתח API מוגדר</p>
              <button
                onClick={() => handleUpdateSetting("openaiApiKey", null)}
                className="text-xs text-destructive hover:underline mt-1"
              >
                מחק מפתח
              </button>
            </div>
          ) : (
            <>
              <input
                type="password"
                placeholder="sk-..."
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md text-sm"
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!openaiKey || saving}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Language & Sync */}
      <section className="border rounded-lg p-6 bg-card space-y-4">
        <h2 className="text-lg font-semibold">⚙️ כללי</h2>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">שפה</p>
            <p className="text-xs text-muted-foreground">שפת הממשק</p>
          </div>
          <select
            value={settings?.language || "he"}
            onChange={(e) => handleUpdateSetting("language", e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
          >
            <option value="he">עברית</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">סנכרון אוטומטי</p>
            <p className="text-xs text-muted-foreground">סנכרון אימיילים אוטומטי</p>
          </div>
          <button
            onClick={() => handleUpdateSetting("autoSync", !settings?.autoSync)}
            className={`px-3 py-1 rounded-full text-sm ${
              settings?.autoSync
                ? "bg-green-100 text-green-800"
                : "bg-gray-100 text-gray-600"
            }`}
          >
            {settings?.autoSync ? "פעיל" : "כבוי"}
          </button>
        </div>

        {settings?.autoSync && (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">תדירות סנכרון</p>
              <p className="text-xs text-muted-foreground">כל כמה דקות לבדוק אימיילים חדשים</p>
            </div>
            <select
              value={settings?.syncIntervalMinutes || 15}
              onChange={(e) => handleUpdateSetting("syncIntervalMinutes", parseInt(e.target.value))}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="5">5 דקות</option>
              <option value="15">15 דקות</option>
              <option value="30">30 דקות</option>
              <option value="60">שעה</option>
            </select>
          </div>
        )}
      </section>
    </div>
  );
}
