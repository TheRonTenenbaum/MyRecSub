# 📄 MyRecSub - Personal Invoice & Subscription Tracker

מערכת אוטומטית לזיהוי חשבוניות מאימייל, חילוץ נתוני הוצאות, וזיהוי מנויים חוזרים.

## Features

- 📧 **Gmail Integration** — מתחבר לחשבונות Gmail מרובים, מזהה חשבוניות אוטומטית
- 📄 **Smart Extraction** — חילוץ טקסט מ-PDF, OCR לסריקות, AI כגיבוי
- 🇮🇱 **Hebrew + English** — תמיכה מלאה בחשבוניות ישראליות בעברית
- 🔄 **Subscription Detection** — זיהוי אוטומטי של מנויים חוזרים
- 📊 **Dashboard** — סקירת הוצאות, גרפים, ספקים מובילים
- 🖥️ **Desktop App** — אפליקציית Electron, מותקנת מקומית

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Desktop | Electron |
| Backend | Fastify + TypeScript |
| Frontend | Next.js 14 + Tailwind CSS |
| Database | SQLite + Prisma |
| PDF | pdf-parse + Tesseract.js OCR |
| AI Fallback | OpenAI GPT-4o-mini (optional) |
| Email | Gmail API + OAuth2 |

## Quick Start (Development)

### Prerequisites

- Node.js 18+
- npm 9+
- Google Cloud Project with Gmail API enabled (see [Gmail Setup Guide](#gmail-setup))

### 1. Clone & Install

```bash
git clone https://github.com/TheRonTenenbaum/MyRecSub.git
cd MyRecSub
cp .env.example .env
# Edit .env with your Google OAuth credentials
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Setup Database

```bash
cd backend
npx prisma generate
npx prisma db push
cd ..
```

### 3. Run Development Servers

```bash
# Terminal 1: Backend
cd backend && npm run dev

# Terminal 2: Frontend
cd frontend && npm run dev
```

Open http://localhost:3000 in your browser.

### 4. Build Electron App

```bash
npm run build
cd electron && npm install && npm run package:win
```

The installer will be in `electron/release/`.

## Gmail Setup

### Step 1: Create Google Cloud Project
1. Go to https://console.cloud.google.com/
2. Create a new project (e.g., "MyRecSub")
3. Enable the **Gmail API**: APIs & Services → Library → Search "Gmail API" → Enable

### Step 2: Create OAuth Credentials
1. Go to APIs & Services → Credentials
2. Click "Create Credentials" → "OAuth 2.0 Client IDs"
3. Application type: **Desktop app** (or Web application)
4. Authorized redirect URIs: `http://localhost:3001/api/gmail/callback`
5. Copy the **Client ID** and **Client Secret**

### Step 3: Configure OAuth Consent Screen
1. Go to APIs & Services → OAuth consent screen
2. User Type: **External**
3. Fill in app name, support email
4. Scopes: Add `gmail.readonly` and `userinfo.email`
5. Test users: Add your email address

### Step 4: Add to .env
```env
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

## Folder Structure

```
myrecsub/
├── backend/          # Fastify API server
│   ├── prisma/       # Database schema
│   └── src/
│       ├── modules/  # Feature modules (gmail, documents, processing, etc.)
│       ├── config/   # Environment, paths, logger
│       ├── queue/    # In-process task queue
│       └── shared/   # Utilities (Hebrew, currency)
├── frontend/         # Next.js 14 dashboard
│   ├── app/          # Pages (dashboard, documents, subscriptions, settings)
│   ├── components/   # UI components
│   ├── hooks/        # React hooks
│   └── lib/          # API client, formatters
└── electron/         # Desktop app wrapper
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/health | Health check |
| GET | /api/dashboard | Full dashboard data |
| GET | /api/documents | List invoices with filters |
| GET | /api/documents/:id | Invoice detail |
| GET | /api/subscriptions | Recurring charges |
| GET | /api/suppliers | All suppliers |
| POST | /api/gmail/sync | Trigger email sync |
| POST | /api/processing/process-all | Process all invoices |
| POST | /api/subscriptions/detect | Detect subscriptions |

## License

MIT
