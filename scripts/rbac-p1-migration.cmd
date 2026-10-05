@echo off
setlocal
REM ============================================================================
REM ESH — P1 RBAC FOUNDATION: baseline + first real migration, plus regression
REM ----------------------------------------------------------------------------
REM VERSION 6 — P1 blocker fixes. Changes from version 5:
REM
REM  1. CMD PARSER HAZARD FIXED: two echo lines inside parenthesized if-blocks
REM     contained a bare ")" in their text:
REM       echo %DATE% %TIME% (recorded on resume, verified via fresh drift check)
REM     The closing ")" was interpreted by CMD as the end of the enclosing
REM     if ( ... ) block, causing the redirection and goto on that same line to
REM     execute outside the block (and the block to close prematurely). Fixed by
REM     escaping it as "^)" in the echo text at both sites:
REM       echo %DATE% %TIME% ^(recorded on resume, verified via fresh drift check^)
REM     Both occurrences are in resume branches that write the .p1_deployed
REM     marker after a fresh POSTP1_STATE==MATCH verification.
REM
REM  2. FAIL-CLOSED DEPENDENCY CHECKS: the pre-migration dependency steps
REM     (npm install, prisma generate, prisma validate) previously logged
REM     failures but did not stop execution - later steps that depended on their
REM     success could run on a broken state. Fixed:
REM     - npm install failure now stops the script before prisma generate runs.
REM     - prisma generate failure now stops the script before prisma validate
REM       runs (a generated client is required for validate to be meaningful).
REM     - prisma validate failure now stops the script before any migration
REM       logic runs (an invalid schema must not be migrated).
REM     The post-deploy prisma generate (after migrate deploy) is also now
REM     checked and logged, though this step is best-effort: a failure there
REM     does not affect the already-applied migration itself, but it is
REM     reported so the operator knows the client needs regenerating.
REM
REM Everything from version 5 is otherwise preserved: DATABASE_URL quoted
REM assignment, markers-as-checkpoints-only model with fresh database re-
REM verification on every resume branch, hash-verified reference schema,
REM reference-has-no-P1-tokens / live-has-P1-tokens guards, Contract-byte-
REM identical guard, strict exact-name database-target check, baseline from
REM reference-v3-schema.prisma only, P1 delta via migrate diff schema-to-
REM schema only (no migrate dev, no shadow database), the four-table allowlist
REM + no-DROP + no-Contract guard, quarantine on rejection, immediate fail-
REM closed capture of migrate deploy's exit code, human review gate, and no
REM automatic transition to P2.
REM ============================================================================

set EXPECTED_HASH=FCD724E441ED7619FEA6913C1016B08E8D98610ECEDE34A3A4F61D78E6C106F2
set EXPECTED_DB_NAME=football_club_test

cd /d "%~dp0.."
set REPORT=rbac-p1-report.txt
echo RBAC P1 verification report (v5 - marker-vs-database source-of-truth pass) > %REPORT%
echo Started: %DATE% %TIME% >> %REPORT%

REM ---------------------------------------------------------------- guard: env var present
if "%DATABASE_URL_TEST%"=="" (
  echo STOP: DATABASE_URL_TEST is not set. >> %REPORT%
  goto :fail_report
)

REM ---------------------------------------------------------------- guard: exact database name
if not exist scripts\check-database-target.ps1 (
  echo STOP: scripts\check-database-target.ps1 is missing from this package. >> %REPORT%
  goto :fail_report
)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-database-target.ps1 -Url "%DATABASE_URL_TEST%" -ExpectedDatabaseName "%EXPECTED_DB_NAME%" >> %REPORT% 2>&1
if errorlevel 1 (
  echo STOP: DATABASE_URL_TEST does not point at the expected test database. >> %REPORT%
  echo See the extracted database name above ^(the full connection string is >> %REPORT%
  echo never printed^). If you deliberately intend a differently-named test >> %REPORT%
  echo database, edit EXPECTED_DB_NAME near the top of this script - do not >> %REPORT%
  echo rename your database just to pass this check. >> %REPORT%
  goto :fail_report
)
set "DATABASE_URL=%DATABASE_URL_TEST%"

REM ---------------------------------------------------------------- guard: reference file present
if not exist scripts\reference-v3-schema.prisma (
  echo STOP: scripts\reference-v3-schema.prisma is missing from this package. >> %REPORT%
  goto :fail_report
)

REM ---------------------------------------------------------------- guard: reference file hash
for /f "usebackq tokens=* delims=" %%h in (`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\get-hash.ps1 -Path scripts\reference-v3-schema.prisma`) do set ACTUAL_HASH=%%h
echo reference-v3-schema.prisma SHA-256: %ACTUAL_HASH% >> %REPORT%
echo expected:                           %EXPECTED_HASH% >> %REPORT%
if /I not "%ACTUAL_HASH%"=="%EXPECTED_HASH%" (
  echo STOP: reference-v3-schema.prisma hash mismatch. This file may have been >> %REPORT%
  echo modified or corrupted. Refusing to use it as the baseline source. >> %REPORT%
  goto :fail_report
)

REM ---------------------------------------------------------------- guard: reference file has NO P1 tokens
findstr /C:"teamScoped" scripts\reference-v3-schema.prisma >nul
if not errorlevel 1 (
  echo STOP: reference-v3-schema.prisma unexpectedly contains "teamScoped". >> %REPORT%
  goto :fail_report
)
findstr /C:"model UserTeam" scripts\reference-v3-schema.prisma >nul
if not errorlevel 1 (
  echo STOP: reference-v3-schema.prisma unexpectedly contains "model UserTeam". >> %REPORT%
  goto :fail_report
)
findstr /C:"model StaffTeam" scripts\reference-v3-schema.prisma >nul
if not errorlevel 1 (
  echo STOP: reference-v3-schema.prisma unexpectedly contains "model StaffTeam". >> %REPORT%
  goto :fail_report
)
findstr /C:"userId String? @unique" scripts\reference-v3-schema.prisma >nul
if not errorlevel 1 (
  echo STOP: reference-v3-schema.prisma unexpectedly contains a unique Staff.userId. >> %REPORT%
  goto :fail_report
)
echo Reference file confirmed: hash-correct, contains none of the P1 additions. >> %REPORT%

REM ---------------------------------------------------------------- guard: live schema HAS the P1 additions
set MISSING_P1=0
findstr /C:"teamScoped  Boolean  @default(false)" prisma\schema.prisma >nul || set MISSING_P1=1
findstr /C:"model UserTeam" prisma\schema.prisma >nul || set MISSING_P1=1
findstr /C:"model StaffTeam" prisma\schema.prisma >nul || set MISSING_P1=1
findstr /C:"userId String? @unique" prisma\schema.prisma >nul || set MISSING_P1=1
if "%MISSING_P1%"=="1" (
  echo STOP: prisma\schema.prisma does NOT contain all four expected P1 additions. >> %REPORT%
  echo This package may be wrong or schema.prisma was reverted. >> %REPORT%
  goto :fail_report
)
echo Live schema.prisma confirmed to contain all four intended P1 additions. >> %REPORT%

REM ---------------------------------------------------------------- guard: Contract model unchanged
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\check-contract-unchanged.ps1 -ReferencePath scripts\reference-v3-schema.prisma -LivePath prisma\schema.prisma >> %REPORT% 2>&1
if errorlevel 1 (
  echo STOP: model Contract differs between the reference schema and the live >> %REPORT%
  echo schema, or could not be found in one of them. Contract.teamId must remain >> %REPORT%
  echo byte-identical to official v3 - refusing to proceed. >> %REPORT%
  goto :fail_report
)
echo Contract model confirmed byte-identical between reference and live schema. >> %REPORT%

REM ---------------------------------------------------------------- guard: Prisma CLI available
call npx prisma -v >> %REPORT% 2>&1
if errorlevel 1 (
  echo STOP: Prisma CLI is not available ^(npx prisma -v failed^). Run npm install first. >> %REPORT%
  goto :fail_report
)

echo. >> %REPORT%
echo ===== 1a. npm install ===== >> %REPORT%
call npm install >> %REPORT% 2>&1
set NPM_INSTALL_RC=%ERRORLEVEL%
echo exit code: %NPM_INSTALL_RC% >> %REPORT%
if not "%NPM_INSTALL_RC%"=="0" (
  echo STOP: npm install failed ^(exit code %NPM_INSTALL_RC%^). Cannot run prisma generate >> %REPORT%
  echo or any migration steps on a broken dependency tree. Resolve the npm error >> %REPORT%
  echo above and re-run. >> %REPORT%
  goto :fail_report
)

echo. >> %REPORT%
echo ===== 1b. prisma generate ===== >> %REPORT%
call npx prisma generate >> %REPORT% 2>&1
set PRISMA_GEN_RC=%ERRORLEVEL%
echo exit code: %PRISMA_GEN_RC% >> %REPORT%
if not "%PRISMA_GEN_RC%"=="0" (
  echo STOP: prisma generate failed ^(exit code %PRISMA_GEN_RC%^). Cannot validate or >> %REPORT%
  echo migrate with a broken generated client. Resolve the generate error above >> %REPORT%
  echo and re-run. >> %REPORT%
  goto :fail_report
)

echo. >> %REPORT%
echo ===== 2. prisma validate ^(live/P1 schema^) ===== >> %REPORT%
call npx prisma validate >> %REPORT% 2>&1
set PRISMA_VALIDATE_RC=%ERRORLEVEL%
echo exit code: %PRISMA_VALIDATE_RC% >> %REPORT%
if not "%PRISMA_VALIDATE_RC%"=="0" (
  echo STOP: prisma validate failed ^(exit code %PRISMA_VALIDATE_RC%^). The live >> %REPORT%
  echo schema.prisma is invalid. Do NOT proceed with migration against an invalid >> %REPORT%
  echo schema. Resolve the validation error above and re-run. >> %REPORT%
  goto :fail_report
)

REM ============================================================================
REM RECOVERY / RESUME LOGIC
REM ----------------------------------------------------------------------------
REM A marker file means only "this script previously completed that
REM checkpoint" - it is NEVER treated as proof of the database's actual
REM state. Every branch below that could lead to `migrate deploy` re-verifies
REM the real database, read-only, via :check_db_matches_schema before
REM continuing. If the database does not match what that marker implies it
REM should, this script stops and reports rather than guessing.
REM ============================================================================
if not exist prisma\migrations goto :fresh_run

echo. >> %REPORT%
echo ===== RESUME: prisma\migrations already exists - checking markers ===== >> %REPORT%

if not exist prisma\migrations\.p1_deployed goto :check_p1_delta_ready
echo Marker found: .p1_deployed - a prior run OBSERVED a successful deploy. >> %REPORT%
echo This is a workflow checkpoint, not proof - verifying the actual database >> %REPORT%
echo now matches the full P1 schema before trusting it. >> %REPORT%
call :check_db_matches_schema prisma\schema.prisma POSTP1_STATE resume-check-post-p1.sql
if "%POSTP1_STATE%"=="MATCH" (
  echo Confirmed: the database matches the full P1 schema exactly. Not >> %REPORT%
  echo touching the database again - proceeding to read-only verification only. >> %REPORT%
  goto :post_deploy_verification
)
echo STOP: .p1_deployed marker is present, but the database does NOT ^(or a >> %REPORT%
echo check could not confirm it does^) currently match the full P1 schema. >> %REPORT%
echo See resume-check-post-p1.sql for the exact difference. This is exactly >> %REPORT%
echo the "marker says done, database disagrees" case - this script will not >> %REPORT%
echo guess what happened. Send me this report and resume-check-post-p1.sql. >> %REPORT%
goto :fail_report

:check_p1_delta_ready
if not exist prisma\migrations\.p1_delta_ready goto :check_baseline_resolved_only
set /p MIGDIR=<prisma\migrations\.p1_delta_ready
echo Marker found: .p1_delta_ready -^> %MIGDIR% >> %REPORT%
if not exist prisma\migrations\.baseline_resolved (
  echo STOP: .p1_delta_ready exists but .baseline_resolved does not. This is >> %REPORT%
  echo an inconsistent marker state this script does not recognize - it will >> %REPORT%
  echo not guess. Send me this report and a directory listing of >> %REPORT%
  echo prisma\migrations before doing anything else. >> %REPORT%
  goto :fail_report
)
if not exist "prisma\migrations\%MIGDIR%\migration.sql" (
  echo STOP: the migration file recorded in .p1_delta_ready is missing on >> %REPORT%
  echo disk ^(prisma\migrations\%MIGDIR%\migration.sql^). Unrecognized state - >> %REPORT%
  echo send me this report before doing anything else. >> %REPORT%
  goto :fail_report
)
echo Re-verifying the actual database state before trusting these markers... >> %REPORT%
call :check_db_matches_schema prisma\schema.prisma POSTP1_STATE resume-check-post-p1.sql
if "%POSTP1_STATE%"=="MATCH" (
  echo Discovery: the database ALREADY matches the full P1 schema exactly, >> %REPORT%
  echo even though .p1_deployed was never written. This means a prior deploy >> %REPORT%
  echo most likely succeeded but the script stopped before recording the >> %REPORT%
  echo marker. Recording it now, based on this fresh verification - not >> %REPORT%
  echo re-running deploy or the approval prompt. >> %REPORT%
  echo %DATE% %TIME% ^(recorded on resume, verified via fresh drift check^)> prisma\migrations\.p1_deployed
  goto :post_deploy_verification
)
if "%POSTP1_STATE%"=="ERROR" (
  echo STOP: could not verify the database against the full P1 schema ^(tool >> %REPORT%
  echo or connection error - see above^). Not proceeding. >> %REPORT%
  goto :fail_report
)
call :check_db_matches_schema scripts\reference-v3-schema.prisma PREP1_STATE resume-check-pre-p1.sql
if not "%PREP1_STATE%"=="MATCH" (
  echo STOP: the database matches NEITHER the full P1 schema NOR the pre-P1 >> %REPORT%
  echo reference schema. This is an ambiguous, partially-drifted state this >> %REPORT%
  echo script will not guess about or repair. See resume-check-post-p1.sql >> %REPORT%
  echo and resume-check-pre-p1.sql for the exact differences. Send me this >> %REPORT%
  echo report and both files before doing anything else. >> %REPORT%
  goto :fail_report
)
echo Confirmed: database is still cleanly at the pre-P1 baseline - deploy has >> %REPORT%
echo genuinely not happened yet. Re-verifying the existing P1 SQL fresh >> %REPORT%
echo ^(defense in depth^)... >> %REPORT%
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-p1-sql.ps1 -SqlPath "prisma\migrations\%MIGDIR%\migration.sql" >> %REPORT% 2>&1
set SQLCHECK=%ERRORLEVEL%
echo P1 SQL re-verification exit code: %SQLCHECK% >> %REPORT%
if not "%SQLCHECK%"=="0" (
  echo STOP: the previously-generated P1 SQL no longer passes verification. >> %REPORT%
  echo Something changed since it was generated. Not proceeding automatically. >> %REPORT%
  goto :fail_report
)
echo Baseline confirmed resolved, database confirmed still pre-P1, and P1 >> %REPORT%
echo delta re-verified - skipping straight to your review and deploy. >> %REPORT%
goto :show_sql_for_approval

:check_baseline_resolved_only
if not exist prisma\migrations\.baseline_resolved goto :unrecognized_migrations_state
echo Marker found: .baseline_resolved only. Verifying the actual database >> %REPORT%
echo state before trusting it - checking against the full P1 schema first >> %REPORT%
echo ^(in case a full deploy secretly succeeded without any later marker being >> %REPORT%
echo written^), then against the pre-P1 reference. >> %REPORT%
call :check_db_matches_schema prisma\schema.prisma POSTP1_STATE resume-check-post-p1.sql
if "%POSTP1_STATE%"=="MATCH" (
  echo Discovery: the database already matches the full P1 schema exactly. >> %REPORT%
  echo Recording .p1_deployed now, based on this fresh verification. >> %REPORT%
  echo %DATE% %TIME% ^(recorded on resume, verified via fresh drift check^)> prisma\migrations\.p1_deployed
  goto :post_deploy_verification
)
if "%POSTP1_STATE%"=="ERROR" (
  echo STOP: could not verify the database against the full P1 schema ^(tool >> %REPORT%
  echo or connection error - see above^). Not proceeding. >> %REPORT%
  goto :fail_report
)
call :check_db_matches_schema scripts\reference-v3-schema.prisma PREP1_STATE resume-check-pre-p1.sql
if not "%PREP1_STATE%"=="MATCH" (
  echo STOP: the database matches NEITHER the full P1 schema NOR the pre-P1 >> %REPORT%
  echo reference schema - an ambiguous, partially-drifted state. Not >> %REPORT%
  echo guessing or repairing. See resume-check-post-p1.sql and >> %REPORT%
  echo resume-check-pre-p1.sql for the exact differences. >> %REPORT%
  goto :fail_report
)
echo Confirmed: database is still cleanly at the pre-P1 baseline. >> %REPORT%
echo Quarantining any stray unverified P1 delta folder from an earlier >> %REPORT%
echo failed attempt, then regenerating. >> %REPORT%
for /d %%d in (prisma\migrations\*_p1_rbac_foundation) do (
  echo Quarantining stray folder: %%d -^> %%d_STALE_REJECTED >> %REPORT%
  ren "%%d" "%%~nxd_STALE_REJECTED"
)
goto :generate_p1_delta

:unrecognized_migrations_state
echo STOP: prisma\migrations exists but none of the expected marker files >> %REPORT%
echo ^(.baseline_resolved, .p1_delta_ready, .p1_deployed^) are present. This is an >> %REPORT%
echo unrecognized state - possibly left over from an older version of this >> %REPORT%
echo script, or manual changes. This script will not guess what happened. >> %REPORT%
echo. >> %REPORT%
echo Directory listing of prisma\migrations: >> %REPORT%
dir /s /b prisma\migrations >> %REPORT% 2>&1
echo. >> %REPORT%
echo Best-effort read-only status ^(informational only - no decision is based on it^): >> %REPORT%
call npx prisma migrate status >> %REPORT% 2>&1
echo. >> %REPORT%
echo Send me this full report before taking any further action. >> %REPORT%
goto :fail_report

:fresh_run
echo. >> %REPORT%
echo ===== 3a. Database connectivity check (read-only) ===== >> %REPORT%
echo SELECT 1; | call npx prisma db execute --url "%DATABASE_URL_TEST%" --stdin >> %REPORT% 2>&1
if errorlevel 1 (
  echo STOP: could not connect to the target database. >> %REPORT%
  echo See the output above for the exact connection error. >> %REPORT%
  goto :fail_report
)
echo Database reachable. >> %REPORT%

echo. >> %REPORT%
echo ===== 3b. DRIFT CHECK: does the database match the PRE-P1 v3 reference schema? ===== >> %REPORT%
echo [step 3] Checking the database against the pre-P1 reference schema...
call :check_db_matches_schema scripts\reference-v3-schema.prisma PREP1_STATE drift-check.sql
if "%PREP1_STATE%"=="ERROR" (
  echo STOP: could not check the database against the reference schema ^(tool or >> %REPORT%
  echo connection error - see above^). >> %REPORT%
  goto :fail_report
)
if not "%PREP1_STATE%"=="MATCH" (
  echo STOP: the database does not exactly match the pre-P1 v3 reference schema. >> %REPORT%
  echo No repair, no reset, no db push will be attempted. See drift-check.sql >> %REPORT%
  echo for the exact difference. >> %REPORT%
  goto :fail_report
)
echo Drift check passed: the database matches the pre-P1 v3 schema exactly. >> %REPORT%

echo. >> %REPORT%
echo ===== 4. BASELINE migration.sql (file-only: --from-empty -^> reference schema) ===== >> %REPORT%
mkdir prisma\migrations\0_baseline
call npx prisma migrate diff --from-empty --to-schema-datamodel scripts\reference-v3-schema.prisma --script > prisma\migrations\0_baseline\migration.sql 2>>%REPORT%
if errorlevel 1 (
  echo STOP: baseline migration.sql generation failed. >> %REPORT%
  goto :fail_report
)
findstr /C:"teamScoped" prisma\migrations\0_baseline\migration.sql >nul
if not errorlevel 1 (
  echo STOP: the generated BASELINE unexpectedly mentions "teamScoped". Not proceeding. >> %REPORT%
  goto :fail_report
)
findstr /C:"UserTeam" prisma\migrations\0_baseline\migration.sql >nul
if not errorlevel 1 (
  echo STOP: the generated BASELINE unexpectedly mentions "UserTeam". Not proceeding. >> %REPORT%
  goto :fail_report
)
findstr /C:"StaffTeam" prisma\migrations\0_baseline\migration.sql >nul
if not errorlevel 1 (
  echo STOP: the generated BASELINE unexpectedly mentions "StaffTeam". Not proceeding. >> %REPORT%
  goto :fail_report
)
echo Baseline SQL confirmed to contain none of the P1 additions. >> %REPORT%
echo ---- baseline migration.sql (first 40 lines) ---- >> %REPORT%
powershell -NoProfile -Command "Get-Content prisma\migrations\0_baseline\migration.sql -TotalCount 40" >> %REPORT%
echo ---- end excerpt ---- >> %REPORT%

echo. >> %REPORT%
echo ===== 5. Resolve baseline as applied (writes ONE bookkeeping row; runs no SQL) ===== >> %REPORT%
call npx prisma migrate resolve --applied 0_baseline >> %REPORT% 2>&1
if errorlevel 1 (
  echo STOP: migrate resolve failed. >> %REPORT%
  goto :fail_report
)
echo Baseline resolved as applied. >> %REPORT%
echo v5 written here > prisma\migrations\.baseline_resolved
echo Marker written: .baseline_resolved ^(checkpoint only - not treated as proof on a future resume^) >> %REPORT%

:generate_p1_delta
echo. >> %REPORT%
echo ===== 6. P1 delta migration.sql (file-only: reference schema -^> live/P1 schema) ===== >> %REPORT%
for /f "usebackq tokens=* delims=" %%t in (`powershell -NoProfile -ExecutionPolicy Bypass -File scripts\get-timestamp.ps1`) do set TS=%%t
set MIGDIR=%TS%_p1_rbac_foundation
mkdir "prisma\migrations\%MIGDIR%"
call npx prisma migrate diff --from-schema-datamodel scripts\reference-v3-schema.prisma --to-schema-datamodel prisma\schema.prisma --script > "prisma\migrations\%MIGDIR%\migration.sql" 2>>%REPORT%
if errorlevel 1 (
  echo STOP: P1 delta migration.sql generation failed. >> %REPORT%
  goto :fail_report
)

echo. >> %REPORT%
echo ===== 6b. Verifying the generated P1 SQL (table allowlist, DROP, Contract) ===== >> %REPORT%
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\verify-p1-sql.ps1 -SqlPath "prisma\migrations\%MIGDIR%\migration.sql" >> %REPORT% 2>&1
set SQLCHECK=%ERRORLEVEL%
echo P1 SQL verification exit code: %SQLCHECK% (0=OK, 2=DROP found, 3=Contract mentioned, 4=unexpected table, 5=empty) >> %REPORT%
if not "%SQLCHECK%"=="0" (
  echo STOP: generated P1 SQL failed verification - see the line above. >> %REPORT%
  echo Quarantining the rejected migration folder ^(renaming, not deleting^) so >> %REPORT%
  echo it can never be picked up by a future migrate deploy. >> %REPORT%
  ren "prisma\migrations\%MIGDIR%" "%MIGDIR%_REJECTED"
  goto :fail_report
)
echo %MIGDIR%> prisma\migrations\.p1_delta_ready
echo Marker written: .p1_delta_ready -^> %MIGDIR% ^(checkpoint only^) >> %REPORT%

:show_sql_for_approval
echo. >> %REPORT%
echo ---- GENERATED P1 MIGRATION SQL (READ THIS BEFORE CONTINUING) ---- >> %REPORT%
type "prisma\migrations\%MIGDIR%\migration.sql" >> %REPORT%
echo ---- END OF GENERATED SQL ---- >> %REPORT%

echo.
echo ============================================================
echo   Automated checks passed: only Role/Staff/UserTeam/StaffTeam
echo   are touched, no DROP, no Contract mention, and the database
echo   was freshly re-verified to still be pre-P1.
echo   STILL READ prisma\migrations\%MIGDIR%\migration.sql YOURSELF
echo   before continuing - the automated check is a safety net,
echo   not a replacement for your own review.
echo ============================================================
echo.
choice /M "Have you read the SQL and does it look correct? Apply it now"
if errorlevel 2 (
  echo. >> %REPORT%
  echo User declined to apply after reviewing it. STOPPING HERE. Nothing applied. >> %REPORT%
  echo Re-run this script later to resume from exactly this point - the >> %REPORT%
  echo .p1_delta_ready marker means it will re-verify the database and, if >> %REPORT%
  echo still pre-P1, skip straight back here. >> %REPORT%
  goto :done_no_apply
)

echo. >> %REPORT%
echo ===== 8. Applying the P1 migration ===== >> %REPORT%
call npx prisma migrate deploy >> %REPORT% 2>&1
set DEPLOY_RESULT=%ERRORLEVEL%
echo migrate deploy exit code: %DEPLOY_RESULT% >> %REPORT%
if not "%DEPLOY_RESULT%"=="0" (
  echo. >> %REPORT%
  echo STOP: prisma migrate deploy FAILED. The database may be in a partial >> %REPORT%
  echo state. NOT running prisma generate, tsc, build, or any Finance/P1 tests - >> %REPORT%
  echo none of that would be meaningful on top of a failed migration. >> %REPORT%
  echo. >> %REPORT%
  echo Do NOT re-run this script blindly. Send me this report and the exact >> %REPORT%
  echo error above. A re-run's resume logic will freshly check the database >> %REPORT%
  echo against both the pre-P1 and full-P1 schemas before doing anything, so >> %REPORT%
  echo it will not blindly repeat this failure - but let's look at it together >> %REPORT%
  echo first. >> %REPORT%
  goto :fail_report
)
echo migrate deploy succeeded. >> %REPORT%
echo %DATE% %TIME% > prisma\migrations\.p1_deployed
echo Marker written: .p1_deployed >> %REPORT%
call npx prisma generate >> %REPORT% 2>&1
set POSTDEPLOY_GEN_RC=%ERRORLEVEL%
echo prisma generate exit code: %POSTDEPLOY_GEN_RC% >> %REPORT%
if not "%POSTDEPLOY_GEN_RC%"=="0" (
  echo WARNING: post-deploy prisma generate failed ^(exit code %POSTDEPLOY_GEN_RC%^). >> %REPORT%
  echo The migration was already applied successfully - this does NOT roll it back. >> %REPORT%
  echo However the TypeScript client is out of date and the application will not >> %REPORT%
  echo compile or start until you resolve the generate error and re-run it manually. >> %REPORT%
  echo Continuing to the read-only verification steps for completeness. >> %REPORT%
)

:post_deploy_verification
echo. >> %REPORT%
echo ===== 9a. tsc --noEmit ===== >> %REPORT%
call npx tsc --noEmit >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo ===== 9b. npm run build ===== >> %REPORT%
call npm run build >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo ===== 10a. Finance unit tests (60 expected) ===== >> %REPORT%
call npm run test:finance >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo ===== 10b. Finance real-PostgreSQL integration tests (22 expected) ===== >> %REPORT%
call npm run test:finance:integration >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

echo. >> %REPORT%
echo ===== 10c. NEW P1 RBAC unit tests (46 expected, 0 skipped) ===== >> %REPORT%
call npx tsx --tsconfig tests\rbac\tsconfig.unit.json --test tests\rbac\unit\*.test.ts >> %REPORT% 2>&1
echo exit code: %ERRORLEVEL% >> %REPORT%

:done_no_apply
echo. >> %REPORT%
echo Finished: %DATE% %TIME% >> %REPORT%
type %REPORT%
echo.
echo Done. Send back rbac-p1-report.txt AND any drift-check*/resume-check*.sql files present AND the migration.sql files.
echo Report saved in: %CD%\%REPORT%
pause
exit /b 0

:fail_report
type %REPORT%
echo.
echo STOPPED - see %REPORT% above for the exact reason.
pause
exit /b 1

REM ============================================================================
REM SUBROUTINES — only ever reached via `call`, never by falling through from
REM the main flow above (which always exits or gotos before reaching here).
REM ============================================================================

REM :check_db_matches_schema <SchemaFile> <ResultVarName> <DiffOutputFile>
REM Read-only. Saves the diff SQL to %3 (empty file if no difference) and sets
REM the caller's variable named by %2 to MATCH, NOMATCH, or ERROR. Never
REM writes to the database - this is the single implementation of "does the
REM live database match schema file X", reused by the fresh-run drift check
REM and by every resume branch's re-verification.
:check_db_matches_schema
call npx prisma migrate diff --from-url "%DATABASE_URL_TEST%" --to-schema-datamodel "%~1" --script > %3 2>>%REPORT%
set "GEN_RC=%ERRORLEVEL%"
if not "%GEN_RC%"=="0" (
  set "%~2=ERROR"
  goto :check_db_matches_schema_done
)
call npx prisma migrate diff --from-url "%DATABASE_URL_TEST%" --to-schema-datamodel "%~1" --exit-code >nul 2>>%REPORT%
set "DIFF_RC=%ERRORLEVEL%"
if "%DIFF_RC%"=="0" (
  set "%~2=MATCH"
) else if "%DIFF_RC%"=="2" (
  set "%~2=NOMATCH"
) else (
  set "%~2=ERROR"
)
:check_db_matches_schema_done
exit /b 0
