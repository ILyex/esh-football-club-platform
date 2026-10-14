@echo off
setlocal EnableExtensions

REM ESH Football Platform - one-click local administration launcher.
set "ROOT=%~dp0"
if /I not "%ESH_LAUNCH_FROM_VBS%"=="1" (
  start "" "%WINDIR%\System32\wscript.exe" "%ROOT%Launch-ESH-Platform.vbs"
  exit /b 0
)
cd /d "%ROOT%"

REM Force the standalone launcher to use the Node/Prisma adapter. A previous
REM Cloudflare preview can leave OpenNext context files in the build folder;
REM this flag prevents the local server from looking for Worker-only secrets.
set "DEPLOY_TARGET=node"
set "NODE_BIN=node.exe"
if exist "%ROOT%runtime\node.exe" set "NODE_BIN=%ROOT%runtime\node.exe"
set "BUILD_ID_FILE=%ROOT%.next\BUILD_ID"
set "SERVER_BUILD_FILE=%ROOT%.local-admin-build-id"
REM Allow recovery from stale/duplicated Auth.js cookies. Node's default
REM header limit is small enough to turn a recoverable session into HTTP 431;
REM middleware still validates the session and the login page can replace it.
set "NODE_OPTIONS=--max-old-space-size=768 --max-http-header-size=65536"
set "OLLAMA_NUM_PARALLEL=1"
set "OLLAMA_MAX_LOADED_MODELS=1"

REM Reuse a healthy server when it already serves this exact build. This
REM avoids a downtime window where the browser can lose a chunk in flight.
set "EXPECTED_BUILD="
set "SERVED_BUILD="
if exist "%BUILD_ID_FILE%" set /p EXPECTED_BUILD=<"%BUILD_ID_FILE%"
if exist "%SERVER_BUILD_FILE%" set /p SERVED_BUILD=<"%SERVER_BUILD_FILE%"
if not "%EXPECTED_BUILD%"=="" if "%EXPECTED_BUILD%"=="%SERVED_BUILD%" (
  netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
  if not errorlevel 1 (
    start "" "http://localhost:3000/ar/login?build=%EXPECTED_BUILD%"
    goto :done
  )
)

REM A different build is ready, so replace this project's production process.
REM Also stop a stale `next dev` process on port 3000. Reusing it would keep
REM the development compiler alive and can consume more than 1 GB of RAM.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$root=[regex]::Escape('%ROOT%'); $listeners=Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; foreach($c in $listeners){$p=Get-CimInstance Win32_Process -Filter (\"ProcessId = \" + $c.OwningProcess) -ErrorAction SilentlyContinue; if($p -and $p.CommandLine -match $root -and ($p.CommandLine -match 'next.*dev|start-dev|start-server\.js|app\.js')){taskkill.exe /PID $p.ProcessId /T /F | Out-Null}}; Start-Sleep -Milliseconds 700"

if not exist ".next\standalone\server.js" (
  if not exist "node_modules\.bin\next.cmd" (
    echo Installing platform dependencies for the first run...
    call npm ci
    if errorlevel 1 goto :failed
  )
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

REM Start the hidden supervisor after stale processes and first-run builds are handled.
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%Start-Local-Platform-Supervisor.ps1"
if errorlevel 1 goto :failed

REM Keep AI and FAF local. Ollama is optional; the platform still starts safely if it is offline.
where ollama >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$c=Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue; if(-not $c){Start-Process 'ollama' -ArgumentList 'serve' -WindowStyle Hidden}"
)

echo Starting the platform...
powershell -NoProfile -ExecutionPolicy Bypass -Command "for($i=0;$i -lt 90;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri 'http://localhost:3000/api/health?type=liveness' -TimeoutSec 2;if($r.StatusCode -eq 200){exit 0}}catch{};Start-Sleep -Seconds 1};exit 1"
if errorlevel 1 goto :failed
powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-Content -LiteralPath '%BUILD_ID_FILE%' -Raw).Trim() | Set-Content -LiteralPath '%SERVER_BUILD_FILE%' -NoNewline"
set "EXPECTED_BUILD="
if exist "%BUILD_ID_FILE%" set /p EXPECTED_BUILD=<"%BUILD_ID_FILE%"
start "" "http://localhost:3000/ar/login?build=%EXPECTED_BUILD%"

:done
echo The platform is open in your browser.
exit /b 0

:failed
> "%ROOT%.local-admin-launch-error.log" echo Could not start the platform. See .local-admin.log and .local-admin-error.log for details.
if /I not "%ESH_LAUNCH_FROM_VBS%"=="1" echo Could not start the platform. See .local-admin-launch-error.log for details.
exit /b 1
