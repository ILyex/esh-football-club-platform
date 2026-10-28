$ErrorActionPreference = "Stop"

$toolsRoot = Join-Path $env:LOCALAPPDATA "ESH-Android-Build"
$jdkRoot = Join-Path $toolsRoot "jdk-17"
$jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Select-Object -First 1 -ExpandProperty FullName
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$keystore = Join-Path $toolsRoot "esh-matchday-preview.keystore"
$secretFile = Join-Path $toolsRoot "signing-password.dpapi"
$project = Join-Path $PSScriptRoot "public"
$signingProperties = Join-Path $env:TEMP "esh-public-signing-$PID.properties"

foreach ($requiredPath in @($jdk, $androidSdk, (Join-Path $project "gradlew.bat"))) {
  if (-not (Test-Path -LiteralPath $requiredPath)) { throw "Required Android build file or tool is missing: $requiredPath" }
}

$securePassword = if ((Test-Path -LiteralPath $secretFile) -and (Test-Path -LiteralPath $keystore)) {
  ConvertTo-SecureString -String (Get-Content -LiteralPath $secretFile -Raw).Trim()
} else {
  Read-Host -Prompt "Enter the release signing password (input is hidden)" -AsSecureString
}
$passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
try {
  $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
  $escapedKeyStore = $keystore.Replace('\', '\\')
  $properties = "storeFile=$escapedKeyStore`r`nstorePassword=$password`r`nkeyAlias=esh-matchday`r`nkeyPassword=$password`r`n"
  [IO.File]::WriteAllText($signingProperties, $properties, [Text.UTF8Encoding]::new($false))
  $env:JAVA_HOME = $jdk
  $env:ANDROID_HOME = $androidSdk
  $env:PATH = "$jdk\bin;$env:PATH"
  $env:ESH_SIGNING_PROPERTIES = $signingProperties
  Push-Location $project
  try {
    & .\gradlew.bat --no-daemon assembleRelease
    if ($LASTEXITCODE -ne 0) { throw "Public Android build failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
  $output = Join-Path $project "app\build\outputs\apk\release\app-release.apk"
  $delivery = Join-Path $project "app-release-public-signed.apk"
  Copy-Item -LiteralPath $output -Destination $delivery -Force
  $platformRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $downloadRoot = Join-Path $platformRoot "public\downloads"
  New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
  $releaseVersion = (Select-String -Path (Join-Path $project "app\build.gradle") -Pattern "versionName\s+'([^']+)'" ).Matches[0].Groups[1].Value
  $releaseVersionCode = [int](Select-String -Path (Join-Path $project "app\build.gradle") -Pattern "versionCode\s+(\d+)" ).Matches[0].Groups[1].Value
  $versionedFileName = "esh-public-v$releaseVersion-$releaseVersionCode.apk"
  $versionedApk = Join-Path $downloadRoot $versionedFileName
  Copy-Item -LiteralPath $output -Destination $versionedApk -Force
  $publicApk = Join-Path $downloadRoot "esh-public-latest.apk"
  Copy-Item -LiteralPath $output -Destination $publicApk -Force
  $sha256 = (Get-FileHash -LiteralPath $publicApk -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest = [ordered]@{ version = $releaseVersion; versionCode = $releaseVersionCode; packageName = "dz.esh.footballclub.publicapp"; apkUrl = "/downloads/$versionedFileName"; sha256 = $sha256 }
  $manifestPath = Join-Path $platformRoot "public\public-android-release.json"
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  Write-Output "Public app APK: $delivery"
  Write-Output "Public download APK: $publicApk"
  Write-Output "Versioned download APK: $versionedApk"
  Write-Output "Public release manifest: $manifestPath"
  Write-Output "Package: dz.esh.footballclub.publicapp"
  Write-Output "SHA-256: $sha256"
} finally {
  Remove-Item Env:ESH_SIGNING_PROPERTIES -ErrorAction SilentlyContinue
  if (Test-Path $signingProperties) { Remove-Item -LiteralPath $signingProperties -Force }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
