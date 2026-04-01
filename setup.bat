@echo off
echo ==========================================
echo  MyRecSub - Setup
echo ==========================================

echo.
echo [1/4] Installing dependencies...
cd backend
call npm install
cd ..
cd frontend
call npm install
cd ..

echo.
echo [2/4] Generating Prisma client...
cd backend
call npx prisma generate
cd ..

echo.
echo [3/4] Creating database...
if not exist .env (
  copy .env.example .env
  echo IMPORTANT: Edit .env and add your Google Client ID and Secret!
)
cd backend
call npx dotenv -e ../.env -- npx prisma db push
cd ..

echo.
echo [4/4] Setup complete!
echo.
echo Next steps:
echo   1. Edit .env and fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
echo      (See README.md for Google Cloud setup instructions)
echo   2. Run: start.bat
echo.
pause
