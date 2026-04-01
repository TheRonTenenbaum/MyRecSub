@echo off
echo ==========================================
echo  MyRecSub - Starting...
echo ==========================================
echo.
echo Backend:  http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Press Ctrl+C to stop.
echo.

start "MyRecSub Backend" /min cmd /c "cd backend && npm run dev"
timeout /t 3 /nobreak > nul
start "MyRecSub Frontend" /min cmd /c "cd frontend && npm run dev"

echo Servers starting... opening browser in 5 seconds...
timeout /t 5 /nobreak > nul
start http://localhost:3000
echo.
echo Both servers are running in background windows.
echo Close those windows to stop the app.
pause
