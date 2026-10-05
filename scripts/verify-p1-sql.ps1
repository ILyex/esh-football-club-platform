# Verifies a generated P1 migration.sql touches only the four approved
# tables/columns (Role, Staff, UserTeam, StaffTeam), contains no DROP
# statement, and never mentions Contract. Exit codes:
#   0 = OK   2 = DROP found   3 = Contract mentioned
#   4 = unexpected table touched   5 = no changes detected at all
param(
    [Parameter(Mandatory = $true)][string]$SqlPath
)

$allowedTables = @('Role', 'Staff', 'UserTeam', 'StaffTeam')
$sql = Get-Content -Raw -Path $SqlPath

$touched = New-Object System.Collections.Generic.HashSet[string]
foreach ($m in [regex]::Matches($sql, '(?im)^\s*ALTER TABLE\s+"(\w+)"')) {
    [void]$touched.Add($m.Groups[1].Value)
}
foreach ($m in [regex]::Matches($sql, '(?im)^\s*CREATE TABLE\s+"(\w+)"')) {
    [void]$touched.Add($m.Groups[1].Value)
}

if ($sql -match '(?i)\bDROP\s+(TABLE|COLUMN|INDEX|CONSTRAINT)\b') {
    Write-Output "FAIL_DROP_FOUND: a DROP statement is present in the generated SQL"
    exit 2
}

if ($sql -match '(?i)"Contract"') {
    Write-Output "FAIL_CONTRACT_MENTIONED: the generated SQL references Contract, which already existed in v3 and must not appear in the P1 delta"
    exit 3
}

$unexpected = $touched | Where-Object { $allowedTables -notcontains $_ }
if ($unexpected.Count -gt 0) {
    Write-Output ("FAIL_UNEXPECTED_TABLES: " + ($unexpected -join ', '))
    exit 4
}

if ($touched.Count -eq 0) {
    Write-Output "FAIL_NO_CHANGES_DETECTED: the generated SQL does not ALTER or CREATE any of the expected tables"
    exit 5
}

Write-Output ("OK_TABLES_TOUCHED: " + ($touched -join ', '))
exit 0
