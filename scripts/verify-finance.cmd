@echo off
REM Runs the Finance closure-gate checks in order and saves EVERYTHING to verify-report.txt.
REM Usage (from the project folder):  scripts\verify-finance.cmd
REM Then send verify-report.txt (or its contents) back.
REM Always run from the project root, even when this file is double-clicked from Explorer.
cd /d "%~dp0.."
set REPORT=verify-report.txt
echo.
echo Verification started. This window shows only progress lines; the details go to %REPORT%.
echo Each step can take 1-5 minutes. Please wait for the word DONE.
echo.
echo Finance verification report > %REPORT%
echo Started: %DATE% %TIME% >> %REPORT%
echo Node: >> %REPORT%
node -v >> %REPORT% 2>&1

echo. >> %REPORT%
echo [step 1 of 5] running prisma validate ...
echo ===== 1. prisma validate ===== >> %REPORT%
call npx prisma validate >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo [step 2 of 5] running tsc --noEmit ...
echo ===== 2. tsc --noEmit ===== >> %REPORT%
call npx tsc --noEmit >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo [step 3 of 5] running lint ...
echo ===== 3. lint ===== >> %REPORT%
call npm run lint >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo [step 4 of 5] running build ...
echo ===== 4. build ===== >> %REPORT%
call npm run build >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo [step 5 of 5] running test:finance ...
echo ===== 5. test:finance (no database needed) ===== >> %REPORT%
call npm run test:finance >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo Finished: %DATE% %TIME% >> %REPORT%
echo.
echo DONE. Send the file %REPORT% back.
echo Report saved in: %CD%\%REPORT%
pause
