$ErrorActionPreference = "Stop"

# Run from the root of a newly delivered club-admin package. Environment files
# and local data are deliberately preserved.
$sourceRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$installRoot = Join-Path $env:LOCALAPPDATA "ESH Football Platform"
$sourceServer = Join-Path $sourceRoot ".next\standalone\server.js"
$maintenanceMarker = Join-Path $installRoot ".local-admin-maintenance"
if (-not (Test-Path -LiteralPath $sourceServer)) { throw "هذه الحزمة لا تحتوي على نسخة تشغيل صالحة." }
if (-not (Test-Path -LiteralPath $installRoot)) { throw "لم يتم تثبيت المنصة بعد. شغّل Install-ESH-Platform.vbs أولاً." }

New-Item -ItemType File -Path $maintenanceMarker -Force | Out-Null
Start-Sleep -Seconds 2
Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -match [regex]::Escape((Join-Path $installRoot "app.js")) } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

$backupRoot = Join-Path $installRoot ("backups\" + (Get-Date -Format "yyyyMMdd-HHmmss"))
New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null
foreach ($name in @(".env", ".env.local")) {
  $path = Join-Path $installRoot $name
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination $backupRoot -Force }
}

& robocopy (Join-Path $sourceRoot ".next\standalone") (Join-Path $installRoot ".next\standalone") /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($LASTEXITCODE -gt 7) { throw "فشل تحديث ملفات التشغيل." }

# Move assets created by earlier local-storage releases to Neon before
# switching the installed app to database-backed media. The migration script
# deletes source files only after every database copy has been verified.
$mediaMigration = Join-Path $installRoot ".next\standalone\migrate-local-public-assets-to-database.mjs"
$runtimeNode = Join-Path $installRoot "runtime\node.exe"
if (-not (Test-Path -LiteralPath $runtimeNode)) { $runtimeNode = (Get-Command node.exe -ErrorAction SilentlyContinue).Source }
if ((Test-Path -LiteralPath $mediaMigration) -and $runtimeNode) {
  Push-Location $installRoot
  try {
    & $runtimeNode "--env-file=$(Join-Path $installRoot '.env')" $mediaMigration --delete-source
  } finally {
    Pop-Location
  }
  if ($LASTEXITCODE -ne 0) { throw "فشل نقل الوسائط إلى قاعدة البيانات؛ الملفات الأصلية محفوظة ولم يتغير إعداد التخزين." }
}

# Preserve S3 when the club explicitly configured it. Upgrade old local or
# unset media storage to the remote database so new uploads never grow on PC.
$runtimeEnvPath = Join-Path $installRoot ".env"
if (Test-Path -LiteralPath $runtimeEnvPath) {
  $runtimeEnv = [System.IO.File]::ReadAllText($runtimeEnvPath)
  $driverMatch = [regex]::Match($runtimeEnv, '(?im)^(?<prefix>\s*STORAGE_DRIVER\s*=\s*)(?<value>[^#\r\n]*)$')
  $currentDriver = if ($driverMatch.Success) { $driverMatch.Groups["value"].Value.Trim().Trim('"').Trim("'").ToLowerInvariant() } else { "" }
  if ($currentDriver -eq "local" -or -not $driverMatch.Success -or -not $currentDriver) {
    if ($driverMatch.Success) {
      $runtimeEnv = [regex]::Replace($runtimeEnv, '(?im)^(?<prefix>\s*STORAGE_DRIVER\s*=\s*)[^#\r\n]*$', '${prefix}database', 1)
    } else {
      $runtimeEnv = $runtimeEnv.TrimEnd() + "`r`nSTORAGE_DRIVER=database`r`n"
    }
    [System.IO.File]::WriteAllText($runtimeEnvPath, $runtimeEnv, [System.Text.UTF8Encoding]::new($false))
  }
}
if (Test-Path (Join-Path $sourceRoot "runtime")) {
  & robocopy (Join-Path $sourceRoot "runtime") (Join-Path $installRoot "runtime") /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "فشل تحديث Node.js المرفق." }
}
foreach ($name in @("app.js", "Launch-ESH-Platform.bat", "Launch-ESH-Platform.vbs", "Local-Platform-Supervisor.mjs", "Start-Local-Platform-Supervisor.ps1", "Setup-ESH-Local-AI.ps1", "Setup-ESH-Local-AI.vbs", "Install-ESH-Platform.vbs")) {
  $path = Join-Path $sourceRoot $name
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination (Join-Path $installRoot $name) -Force }
}

Remove-Item -LiteralPath $maintenanceMarker -Force -ErrorAction SilentlyContinue
Start-Process -FilePath (Join-Path $installRoot "Launch-ESH-Platform.vbs") -WorkingDirectory $installRoot
Write-Host "تم تحديث منصة النادي بنجاح. تم حفظ نسخة إعدادات احتياطية في $backupRoot"
