@echo off
cd /d "%~dp0"
rem If the dev server is already running, just open the app.
netstat -ano | findstr /R /C:":5180 .*LISTENING" >nul
if %errorlevel%==0 (
  start "" http://localhost:5180
  exit /b
)
if not exist node_modules call npm install
start "PRISM Lite server" /min cmd /c "npm run dev"
timeout /t 3 /nobreak >nul
start "" http://localhost:5180
