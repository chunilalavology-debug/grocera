@echo off
REM Double-click this file, or run from Command Prompt (cmd.exe).
REM If PowerShell blocks "npm", use "npm.cmd install" once, then use this script to start the API.
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not in PATH. Install Node from https://nodejs.org
  pause
  exit /b 1
)
if not exist "node_modules\" (
  echo [ERROR] node_modules missing. Open Command Prompt here and run:
  echo   npm.cmd install
  pause
  exit /b 1
)
echo Starting backend (node app.js)...
echo Open http://localhost:5000/api/health (or your PORT from .env^)
echo.
node app.js
if errorlevel 1 pause
