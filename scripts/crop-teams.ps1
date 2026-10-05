Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\hocin\.gemini\antigravity\brain\b0204a20-0368-475e-8b18-35024e0b1179\.user_uploaded\media_1791007213195.png"
$img = [System.Drawing.Bitmap]::FromFile($srcPath)

$destDir = "c:\Users\hocin\OneDrive\Desktop\New folder\p1-rbac-foundation\proj-baseline-v3\public\branding\teams"
if (!(Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

function Find-Card-Bounds($minX, $maxX, $minY, $maxY) {
    $left = $maxX; $right = $minX; $top = $maxY; $bottom = $minY
    for ($y = $minY; $y -lt $maxY; $y += 2) {
        for ($x = $minX; $x -lt $maxX; $x += 2) {
            $c = $img.GetPixel($x, $y)
            # Check if pixel is not the pure dark background (e.g. brightness > 8)
            if (($c.R + $c.G + $c.B) -gt 25) {
                if ($x -lt $left) { $left = $x }
                if ($x -gt $right) { $right = $x }
                if ($y -lt $top) { $top = $y }
                if ($y -gt $bottom) { $bottom = $y }
            }
        }
    }
    return [PSCustomObject]@{
        X = $left
        Y = $top
        Width = ($right - $left + 1)
        Height = ($bottom - $top + 1)
    }
}

# Quadrants:
# Top-Left: U20
$bU20 = Find-Card-Bounds 0 512 0 250
# Top-Right: Senior
$bSenior = Find-Card-Bounds 512 1024 0 250
# Bottom-Left: U15
$bU15 = Find-Card-Bounds 0 512 250 500
# Bottom-Right: U17
$bU17 = Find-Card-Bounds 512 1024 250 500

Write-Output "U20 Bounds: $($bU20.X), $($bU20.Y), $($bU20.Width)x$($bU20.Height)"
Write-Output "Senior Bounds: $($bSenior.X), $($bSenior.Y), $($bSenior.Width)x$($bSenior.Height)"
Write-Output "U15 Bounds: $($bU15.X), $($bU15.Y), $($bU15.Width)x$($bU15.Height)"
Write-Output "U17 Bounds: $($bU17.X), $($bU17.Y), $($bU17.Width)x$($bU17.Height)"

function Save-Cropped($bounds, $name) {
    $rect = New-Object System.Drawing.Rectangle($bounds.X, $bounds.Y, $bounds.Width, $bounds.Height)
    $cropped = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $g = [System.Drawing.Graphics]::FromImage($cropped)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle(0, 0, $bounds.Width, $bounds.Height)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $outPath = Join-Path $destDir "$name.png"
    $cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $cropped.Dispose()
    Write-Output "Saved: $outPath ($($bounds.Width) x $($bounds.Height))"
}

Save-Cropped $bSenior "team-senior"
Save-Cropped $bU20 "team-u20"
Save-Cropped $bU17 "team-u17"
Save-Cropped $bU15 "team-u15"

$img.Dispose()
