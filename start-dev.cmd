@echo off
REM Starts backend + frontend without PowerShell npm.ps1 (uses npm.cmd).
cd /d "%~dp0"
where node >nul 2>nul || (
  echo Node.js is not in PATH.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo npm not found.
  pause
  exit /b 1
)
echo Installing root dev tool if needed...
call npm.cmd install
echo.
echo Starting backend and frontend (two CMD windows)...
start "Grocera API" /D "%~dp0backend" cmd /k npm.cmd start
timeout /t 3 /nobreak >nul
start "Grocera Web" /D "%~dp0frontend" cmd /k npm.cmd start
echo.
echo Two CMD windows opened. Close them to stop servers.
pause
