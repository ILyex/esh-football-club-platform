# Verifies model Contract is byte-identical between the pre-P1 reference
# schema and the live (P1-modified) schema.prisma. Exits 0 if identical,
# 1 otherwise (missing in either file, or textually different).
param(
    [Parameter(Mandatory = $true)][string]$ReferencePath,
    [Parameter(Mandatory = $true)][string]$LivePath
)

$reference = Get-Content -Raw -Path $ReferencePath
$live = Get-Content -Raw -Path $LivePath

$referenceMatch = [regex]::Match($reference, '(?s)model Contract \{.*?\n\}')
$liveMatch = [regex]::Match($live, '(?s)model Contract \{.*?\n\}')

if (-not $referenceMatch.Success) {
    Write-Output "FAIL: model Contract not found in reference schema ($ReferencePath)"
    exit 1
}
if (-not $liveMatch.Success) {
    Write-Output "FAIL: model Contract not found in live schema ($LivePath)"
    exit 1
}
if ($referenceMatch.Value -cne $liveMatch.Value) {
    Write-Output "FAIL: model Contract differs between reference and live schema"
    Write-Output "--- reference ---"
    Write-Output $referenceMatch.Value
    Write-Output "--- live ---"
    Write-Output $liveMatch.Value
    exit 1
}

Write-Output "OK: model Contract is byte-identical in both files"
exit 0
