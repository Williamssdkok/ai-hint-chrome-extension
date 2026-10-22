$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$manifestPath = Join-Path $root 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json

if ($manifest.manifest_version -ne 3) {
    throw 'Expected a Manifest V3 extension.'
}

$files = @(
    'background.js', 'content.js', 'game.css', 'game.html', 'game.js',
    'manifest.json', 'options.css', 'options.html', 'options.js',
    'popup.css', 'popup.html', 'popup.js', 'shared-defaults.js',
    'icons/icon16.png', 'icons/icon32.png', 'icons/icon48.png', 'icons/icon128.png'
)

foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $file) -PathType Leaf)) {
        throw "Required extension file is missing: $file"
    }
}

New-Item -ItemType Directory -Path $dist -Force | Out-Null
$archive = Join-Path $dist "ai-hint-chrome-extension-$($manifest.version).zip"
if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
}
$staging = Join-Path $dist ".package-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $staging | Out-Null
foreach ($file in $files) {
    $source = Join-Path $root $file
    $destination = Join-Path $staging $file
    $destinationFolder = Split-Path -Parent $destination
    New-Item -ItemType Directory -Path $destinationFolder -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -CompressionLevel Optimal
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Output "Created $archive"
