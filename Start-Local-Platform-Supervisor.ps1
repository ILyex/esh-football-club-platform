$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$supervisor = Join-Path $root "Local-Platform-Supervisor.mjs"
$nodePath = Join-Path $root "runtime\node.exe"
if (-not (Test-Path -LiteralPath $nodePath)) { $nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source }
$startupDirectory = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\Startup"
$startupLauncher = Join-Path $root "Start-Local-Platform-Supervisor.vbs"
$alreadyRunning = Get-CimInstance Win32_Process -Filter "Name='node.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine.Contains($supervisor) } | Select-Object -First 1

if ((Test-Path -LiteralPath $supervisor) -and (Test-Path -LiteralPath $startupLauncher)) {
  try {
    New-Item -ItemType Directory -Path $startupDirectory -Force | Out-Null
    $startupShortcutPath = Join-Path $startupDirectory "ESH Football Platform Server.lnk"
    $targetPath = Join-Path $env:WINDIR "System32\wscript.exe"
    $targetArguments = "`"$startupLauncher`""
    $refreshShortcut = -not (Test-Path -LiteralPath $startupShortcutPath)
    if (-not $refreshShortcut) {
      $existingShortcut = (New-Object -ComObject WScript.Shell).CreateShortcut($startupShortcutPath)
      $refreshShortcut = $existingShortcut.TargetPath -ne $targetPath -or $existingShortcut.Arguments -ne $targetArguments
    }
    if ($refreshShortcut) {
      $shell = New-Object -ComObject WScript.Shell
      $shortcut = $shell.CreateShortcut($startupShortcutPath)
      $shortcut.TargetPath = $targetPath
      $shortcut.Arguments = $targetArguments
      $shortcut.WorkingDirectory = $root
      $shortcut.Description = "Keep the ESH platform available to administrators"
      $shortcut.Save()
    }
  } catch {}
}

if ((Test-Path -LiteralPath (Join-Path $root ".next\standalone\server.js")) -and -not $nodePath) {
  throw "Node.js was not found. The platform package must include runtime\node.exe or the computer must already have Node.js installed."
}

if (-not $alreadyRunning -and $nodePath -and (Test-Path -LiteralPath $supervisor) -and (Test-Path -LiteralPath (Join-Path $root ".next\standalone\server.js"))) {
  # Stop the earlier PowerShell monitor during upgrade; it used substantially
  # more memory than this lightweight Node.js monitor.
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.Contains((Join-Path $root "Local-Platform-Supervisor.ps1")) } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

  # Adopt the app server only after a clean start so the monitor owns its PID
  # and can recover a hung process without touching unrelated listeners.
  Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object {
      $processInfo = Get-CimInstance Win32_Process -Filter ("ProcessId = " + $_.OwningProcess) -ErrorAction SilentlyContinue
      if ($processInfo -and $processInfo.Name -eq "node.exe" -and $processInfo.CommandLine -and
          ($processInfo.CommandLine.Contains($root) -or $processInfo.CommandLine -match "app\.js")) {
        & taskkill.exe /PID $processInfo.ProcessId /T /F | Out-Null
      }
    }

  $arguments = "`"$supervisor`""
  Start-Process -FilePath $nodePath -ArgumentList $arguments -WorkingDirectory $root -WindowStyle Hidden `
    -RedirectStandardOutput (Join-Path $root ".local-admin-supervisor-console.log") `
    -RedirectStandardError (Join-Path $root ".local-admin-supervisor-error.log")
}
