"use client";

import { useState } from "react";
import { api } from "@/lib/api-client";

type Step = "language" | "gmail" | "openai" | "sync" | "done";

export default function SetupPage() {
  const [step, setStep] = useState<Step>("language");
  const [language, setLanguage] = useState("he");
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");

  const handleLanguage = async (lang: string) => {
    setLanguage(lang);
    await api.updateSettings({ language: lang });
    setStep("gmail");
  };

  const handleConnectGmail = async () => {
    try {
      const { url } = await api.gmailAuthUrl();
      window.open(url, "_blank", "width=600,height=700");
      // After user connects, they'll be redirected back
      // Wait a bit then check if account was connected
      setTimeout(async () => {
        const accounts = await api.gmailAccounts();
        if (accounts.length > 0) {
          setStep("openai");
        }
      }, 5000);
    } catch {
      alert("שגיאה. בדוק את הגדרות Google OAuth.");
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setSyncProgress("מסנכרן אימיילים...");
    try {
      await api.gmailSyncAll();
      setSyncProgress("מעבד חשבוניות...");
      await api.processAll();
      setSyncProgress("מזהה מנויים...");
      await api.detectSubscriptions();
      setSyncProgress("הושלם!");

      await api.updateSettings({ firstRunCompleted: true });
      setTimeout(() => setStep("done"), 1000);
    } catch {
      setSyncProgress("שגיאה בסנכרון. נסה שוב מאוחר יותר.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold">📄 MyRecSub</h1>
          <p className="text-muted-foreground mt-2">הגדרה ראשונית</p>
        </div>

        {/* Progress */}
        <div className="flex justify-center gap-2">
          {(["language", "gmail", "openai", "sync"] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full ${
                step === s ? "bg-primary" : step === "done" || i < ["language", "gmail", "openai", "sync"].indexOf(step) ? "bg-primary/50" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {/* Step: Language */}
        {step === "language" && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">בחר שפה</h2>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => handleLanguage("he")}
                className="px-8 py-4 border-2 rounded-lg hover:border-primary transition-colors text-lg"
              >
                🇮🇱 עברית
              </button>
              <button
                onClick={() => handleLanguage("en")}
                className="px-8 py-4 border-2 rounded-lg hover:border-primary transition-colors text-lg"
              >
                🇺🇸 English
              </button>
            </div>
          </div>
        )}

        {/* Step: Gmail */}
        {step === "gmail" && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">חבר את ה-Gmail שלך</h2>
            <p className="text-sm text-muted-foreground">
              המערכת תסרוק את האימיילים שלך ותזהה חשבוניות וקבלות אוטומטית
            </p>
            <button
              onClick={handleConnectGmail}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 w-full"
            >
              📧 התחבר עם Google
            </button>
            <button
              onClick={() => setStep("openai")}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              דלג לעכשיו
            </button>
          </div>
        )}

        {/* Step: OpenAI */}
        {step === "openai" && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">מפתח OpenAI (אופציונלי)</h2>
            <p className="text-sm text-muted-foreground">
              משפר את דיוק חילוץ הנתונים מחשבוניות מורכבות. העלות כ-0.6 אגורות לחשבונית.
              <br />
              המערכת עובדת גם בלי.
            </p>
            <input
              type="password"
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded-md text-sm"
              onBlur={async (e) => {
                if (e.target.value) {
                  await api.updateSettings({ openaiApiKey: e.target.value });
                }
              }}
            />
            <div className="flex gap-3">
              <button
                onClick={() => setStep("sync")}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                המשך
              </button>
              <button
                onClick={() => setStep("sync")}
                className="px-6 py-3 border rounded-md text-sm hover:bg-muted"
              >
                דלג
              </button>
            </div>
          </div>
        )}

        {/* Step: Sync */}
        {step === "sync" && (
          <div className="space-y-4 text-center">
            <h2 className="text-xl font-semibold">סנכרון ראשוני</h2>
            <p className="text-sm text-muted-foreground">
              המערכת תסרוק את 6 החודשים האחרונים של האימיילים שלך
            </p>

            {syncing ? (
              <div className="space-y-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-sm">{syncProgress}</p>
              </div>
            ) : (
              <button
                onClick={handleSync}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 w-full"
              >
                🚀 התחל סנכרון
              </button>
            )}
          </div>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <div className="space-y-4 text-center">
            <div className="text-5xl">🎉</div>
            <h2 className="text-xl font-semibold">הכל מוכן!</h2>
            <p className="text-sm text-muted-foreground">
              המערכת מוכנה לשימוש. חשבוניות ומנויים יזוהו אוטומטית.
            </p>
            <a
              href="/"
              className="inline-block px-6 py-3 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              עבור לדשבורד
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
