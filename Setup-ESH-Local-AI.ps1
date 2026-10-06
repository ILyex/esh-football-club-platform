$ErrorActionPreference = "Stop"

# One-time technician setup for the private, local AI subsystem.
# The daily administrator launcher never downloads models or opens a terminal.
$ollama = (Get-Command ollama -ErrorAction SilentlyContinue).Source
if (-not $ollama) {
  throw "Ollama is not installed. Install it from https://ollama.com/download/windows, then run this setup again."
}

$listener = Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue
if (-not $listener) {
  Start-Process -FilePath $ollama -ArgumentList "serve" -WindowStyle Hidden
  for ($i = 0; $i -lt 30; $i++) {
    try { Invoke-RestMethod -Uri "http://127.0.0.1:11434/api/tags" -TimeoutSec 2 | Out-Null; break } catch { Start-Sleep -Seconds 1 }
  }
}

& $ollama pull qwen2.5:7b
if ($LASTEXITCODE -ne 0) { throw "The text model could not be downloaded." }
& $ollama pull llava:7b
if ($LASTEXITCODE -ne 0) { throw "The vision model could not be downloaded." }

Write-Host "ESH local AI is ready: qwen2.5:7b + llava:7b"
