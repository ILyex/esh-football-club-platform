$ErrorActionPreference = "Stop"

$toolsRoot = Join-Path $env:LOCALAPPDATA "ESH-Android-Build"
$jdkRoot = Join-Path $toolsRoot "jdk-17"
$jdk = Get-ChildItem -LiteralPath $jdkRoot -Directory | Select-Object -First 1 -ExpandProperty FullName
$androidSdk = Join-Path $env:LOCALAPPDATA "Android\Sdk"
$keystore = Join-Path $toolsRoot "esh-matchday-preview.keystore"
$secretFile = Join-Path $toolsRoot "signing-password.dpapi"
$project = Join-Path $PSScriptRoot "native"
$signingProperties = Join-Path $env:TEMP "esh-native-signing-$PID.properties"

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
    if ($LASTEXITCODE -ne 0) { throw "Native Android build failed with exit code $LASTEXITCODE" }
  } finally { Pop-Location }
  $output = Join-Path $project "app\build\outputs\apk\release\app-release.apk"
  $delivery = Join-Path $project "app-release-native-signed.apk"
  Copy-Item -LiteralPath $output -Destination $delivery -Force
  $releaseVersion = (Select-String -Path (Join-Path $project "app\build.gradle") -Pattern "versionName\s+'([^']+)'" ).Matches[0].Groups[1].Value
  $releaseVersionCode = [int](Select-String -Path (Join-Path $project "app\build.gradle") -Pattern "versionCode\s+(\d+)" ).Matches[0].Groups[1].Value
  $platformRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
  $downloadRoot = Join-Path $platformRoot "public\downloads"
  New-Item -ItemType Directory -Path $downloadRoot -Force | Out-Null
  $versionedFileName = "esh-field-v$releaseVersion-$releaseVersionCode.apk"
  $versionedApk = Join-Path $downloadRoot $versionedFileName
  Copy-Item -LiteralPath $output -Destination $versionedApk -Force
  $publicApk = Join-Path $downloadRoot "esh-field-latest.apk"
  Copy-Item -LiteralPath $output -Destination $publicApk -Force
  $sha256 = (Get-FileHash -LiteralPath $publicApk -Algorithm SHA256).Hash.ToLowerInvariant()
  # The stable alias can remain cached at a CDN edge after replacing the APK.
  # Point clients to a unique immutable URL for each release so its hash and
  # downloaded bytes can never come from different app versions.
  $manifest = [ordered]@{ version = $releaseVersion; versionCode = $releaseVersionCode; apkUrl = "/downloads/$versionedFileName"; sha256 = $sha256 }
  $manifestPath = Join-Path $platformRoot "public\native-android-release.json"
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Compress), [Text.UTF8Encoding]::new($false))
  Write-Output "Native APK: $delivery"
  Write-Output "Public update APK: $publicApk"
  Write-Output "Versioned update APK: $versionedApk"
  Write-Output "Public update manifest: $manifestPath"
} finally {
  Remove-Item Env:ESH_SIGNING_PROPERTIES -ErrorAction SilentlyContinue
  if (Test-Path $signingProperties) { Remove-Item -LiteralPath $signingProperties -Force }
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
}
