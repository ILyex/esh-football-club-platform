param([Parameter(Mandatory = $true)][string]$Path)
(Get-FileHash -Algorithm SHA256 -Path $Path).Hash
