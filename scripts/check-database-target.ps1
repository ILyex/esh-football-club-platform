# Verifies the connection string's DATABASE NAME (not its host, user, or
# password) matches the expected test database name. Never prints the full
# URL - only the extracted, non-secret database name - so credentials never
# reach the report file.
param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][string]$ExpectedDatabaseName
)

try {
    $uri = [System.Uri]$Url
} catch {
    Write-Output "FAIL: could not parse the connection string as a URL"
    exit 1
}

$databaseName = $uri.AbsolutePath.TrimStart('/')
if ([string]::IsNullOrEmpty($databaseName)) {
    Write-Output "FAIL: no database name found in the connection string path"
    exit 1
}

Write-Output "Target database name: $databaseName"

if ($databaseName -ieq $ExpectedDatabaseName) {
    Write-Output "OK: matches expected test database name '$ExpectedDatabaseName'"
    exit 0
} else {
    Write-Output "FAIL: expected database name '$ExpectedDatabaseName', found '$databaseName'"
    exit 1
}
