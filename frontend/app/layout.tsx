import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MyRecSub - מעקב חשבוניות ומנויים",
  description: "מערכת אוטומטית לזיהוי חשבוניות, מעקב הוצאות וזיהוי מנויים חוזרים",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <div className="p-6">{children}</div>
          </main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="w-64 border-l bg-card flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold text-primary">📄 MyRecSub</h1>
        <p className="text-xs text-muted-foreground mt-1">מעקב חשבוניות ומנויים</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <NavItem href="/" icon="📊" label="דשבורד" />
        <NavItem href="/documents/" icon="📄" label="חשבוניות" />
        <NavItem href="/subscriptions/" icon="🔄" label="מנויים" />
        <NavItem href="/suppliers/" icon="🏢" label="ספקים" />
        <NavItem href="/processing/" icon="⚙️" label="עיבוד" />
      </nav>

      <div className="p-4 border-t">
        <NavItem href="/settings/" icon="⚙️" label="הגדרות" />
      </div>
    </aside>
  );
}

function NavItem({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <a
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      <span>{icon}</span>
      <span>{label}</span>
    </a>
  );
}
