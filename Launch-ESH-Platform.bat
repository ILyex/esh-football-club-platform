@echo off
setlocal EnableExtensions

REM ESH Football Platform - one-click local administration launcher.
set "ROOT=%~dp0"
cd /d "%ROOT%"
title ESH Football Platform - Local Administration

REM If the app is already running, reuse it and open the login page.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if($c){Start-Process 'http://localhost:3000/ar/login'; exit 0}; exit 1"
if %ERRORLEVEL% EQU 0 goto :done

if not exist "node_modules\.bin\next.cmd" (
  echo Installing platform dependencies for the first run...
  call npm ci
  if errorlevel 1 goto :failed
)

if not exist ".next\standalone\server.js" (
  echo The local production bundle is missing. Preparing it now.
  call npm run build:cpanel
  if errorlevel 1 goto :failed
)

REM A server without these copied assets opens as unstyled HTML. Repair that
REM state automatically (it can happen after a Cloudflare build).
if not exist ".next\standalone\.next\static\css\*.css" (
  echo Refreshing local static assets...
  echo Preparing the local production build. This happens only once or after an update.
  call npm run build:cpanel
  if errorlevel 1 goto :failed
)

REM Keep AI and FAF local. Ollama is optional; the platform still starts safely if it is offline.
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue; if(-not $c){Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Hidden}"
)

REM Start detached from this launcher so closing the launcher does not stop the app.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p=Start-Process -FilePath 'node.exe' -ArgumentList 'app.js' -WorkingDirectory '%ROOT%' -WindowStyle Hidden -RedirectStandardOutput '%ROOT%\.local-admin.log' -RedirectStandardError '%ROOT%\.local-admin-error.log' -PassThru; if(-not $p){exit 1}"
if errorlevel 1 goto :failed

echo Starting the platform...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 30;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/health?type=liveness' -TimeoutSec 1;if($r.StatusCode -eq 200){Start-Process 'http://localhost:3000/ar/login';exit 0}}catch{};Start-Sleep -Seconds 1};exit 1"
if errorlevel 1 goto :failed

:done
echo The platform is open in your browser.
exit /b 0

:failed
echo.
echo Could not start the platform. See .local-admin.log for details.
pause
exit /b 1
