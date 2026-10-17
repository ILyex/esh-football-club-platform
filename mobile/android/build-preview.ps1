$ErrorActionPreference = "Stop"

$toolsRoot = Join-Path $env:LOCALAPPDATA "ESH-Android-Build"
$jdkRoot = Join-Path $toolsRoot "jdk-17"
$jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Select-Object -First 1 -ExpandProperty FullName
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$keystore = Join-Path $toolsRoot "esh-matchday-preview.keystore"
$secretFile = Join-Path $toolsRoot "signing-password.dpapi"
$project = Join-Path $PSScriptRoot "project"

foreach ($requiredPath in @($jdk, $androidSdk, $keystore, $secretFile, (Join-Path $project "twa-manifest.json"))) {
  if (-not (Test-Path -LiteralPath $requiredPath)) {
    throw "Required Android build file or tool is missing: $requiredPath"
  }
}

$securePassword = ConvertTo-SecureString -String (Get-Content -LiteralPath $secretFile -Raw).Trim()
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $env:BUBBLEWRAP_KEYSTORE_PASSWORD = $password
  $env:BUBBLEWRAP_KEY_PASSWORD = $password
  $env:JAVA_HOME = $jdk
  $env:ANDROID_HOME = $androidSdk
  $env:PATH = "$jdk\bin;$env:PATH"
  Push-Location $project
  try {
    bubblewrap build --signingKeyPath="$keystore" --signingKeyAlias=esh-matchday
    if ($LASTEXITCODE -ne 0) {
      throw "Bubblewrap build failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
  Remove-Item Env:BUBBLEWRAP_KEYSTORE_PASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:BUBBLEWRAP_KEY_PASSWORD -ErrorAction SilentlyContinue
}
