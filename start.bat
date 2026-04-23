@echo off
echo Starting PulsePlay...

:: Kill anything on ports 3000 and 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 "') do taskkill /F /PID %%a >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 "') do taskkill /F /PID %%a >nul 2>&1

:: Start game server
echo Starting Socket.io game server on port 3001...
start "PulsePlay Game Server" cmd /k "cd /d d:\compete\pulseplay && node server/index.js"

:: Wait a moment then start Next.js
timeout /t 2 /nobreak >nul
echo Starting Next.js on port 3000...
start "PulsePlay Web" cmd /k "cd /d d:\compete\pulseplay && npx next dev -p 3000"

echo.
echo Both servers starting in separate windows.
echo  - Website:     http://localhost:3000
echo  - Game Server: http://localhost:3001
echo.
pause
