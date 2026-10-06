$ErrorActionPreference = "Stop"

# Run from the root of a newly delivered club-admin package. Environment files
# and local data are deliberately preserved.
$sourceRoot = (Resolve-Path (Split-Path -Parent $MyInvocation.MyCommand.Path)).Path
$installRoot = Join-Path $env:LOCALAPPDATA "ESH Football Platform"
$sourceServer = Join-Path $sourceRoot ".next\standalone\server.js"
if (-not (Test-Path -LiteralPath $sourceServer)) { throw "هذه الحزمة لا تحتوي على نسخة تشغيل صالحة." }
if (-not (Test-Path -LiteralPath $installRoot)) { throw "لم يتم تثبيت المنصة بعد. شغّل Install-ESH-Platform.vbs أولاً." }

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
if (Test-Path (Join-Path $sourceRoot "runtime")) {
  & robocopy (Join-Path $sourceRoot "runtime") (Join-Path $installRoot "runtime") /MIR /R:2 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  if ($LASTEXITCODE -gt 7) { throw "فشل تحديث Node.js المرفق." }
}
foreach ($name in @("app.js", "Launch-ESH-Platform.bat", "Launch-ESH-Platform.vbs", "Setup-ESH-Local-AI.ps1", "Setup-ESH-Local-AI.vbs", "Install-ESH-Platform.vbs")) {
  $path = Join-Path $sourceRoot $name
  if (Test-Path -LiteralPath $path) { Copy-Item -LiteralPath $path -Destination (Join-Path $installRoot $name) -Force }
}

Start-Process -FilePath (Join-Path $installRoot "Launch-ESH-Platform.vbs") -WorkingDirectory $installRoot
Write-Host "تم تحديث منصة النادي بنجاح. تم حفظ نسخة إعدادات احتياطية في $backupRoot"
