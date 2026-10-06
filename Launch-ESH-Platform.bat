@echo off
setlocal EnableExtensions

REM ESH Football Platform - one-click local administration launcher.
set "ROOT=%~dp0"
cd /d "%ROOT%"
title ESH Football Platform - Local Administration

REM Force the standalone launcher to use the Node/Prisma adapter. A previous
REM Cloudflare preview can leave OpenNext context files in the build folder;
REM this flag prevents the local server from looking for Worker-only secrets.
set "DEPLOY_TARGET=node"
set "BUILD_ID_FILE=%ROOT%.next\BUILD_ID"
set "SERVER_BUILD_FILE=%ROOT%.local-admin-build-id"

REM Reuse a healthy server when it already serves this exact build. This
REM avoids a downtime window where the browser can lose a chunk in flight.
set "EXPECTED_BUILD="
set "SERVED_BUILD="
if exist "%BUILD_ID_FILE%" set /p EXPECTED_BUILD=<"%BUILD_ID_FILE%"
if exist "%SERVER_BUILD_FILE%" set /p SERVED_BUILD=<"%SERVER_BUILD_FILE%"
if not "%EXPECTED_BUILD%"=="" if "%EXPECTED_BUILD%"=="%SERVED_BUILD%" (
  netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
  if not errorlevel 1 (
    start "" "http://localhost:3000/ar/login"
    goto :done
  )
)

REM A different build is ready, so replace only this project's app.js process.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ps=Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match '\bapp\.js\b' }; $ps | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; Start-Sleep -Milliseconds 500"

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

REM Prisma's query compiler is required for every database operation. Rebuild
REM automatically if an older standalone bundle does not contain its WASM file.
if not exist ".next\standalone\node_modules\.prisma\client\query_compiler_bg.wasm" (
  echo Refreshing the database runtime files...
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

REM Open the browser immediately after the server becomes reachable. The
REM health poll below only reports a failed startup and never delays a ready
REM instance.
start "" "http://localhost:3000/ar/login"
powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -LiteralPath '%BUILD_ID_FILE%' -Raw).Trim() | Set-Content -LiteralPath '%SERVER_BUILD_FILE%' -NoNewline"

REM Start the durable background worker silently when the full source package
REM is present. Reuse an existing worker so repeated clicks stay lightweight.
echo Starting the platform...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/health?type=liveness' -TimeoutSec 2;if($r.StatusCode -eq 200){exit 0}}catch{};Start-Sleep -Seconds 1};exit 1"
if errorlevel 1 goto :failed

:done
echo The platform is open in your browser.
exit /b 0

:failed
echo.
echo Could not start the platform. See .local-admin.log for details.
pause
exit /b 1
