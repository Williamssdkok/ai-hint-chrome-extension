param(
    [ValidateSet('Standard', 'Lite')]
    [string]$Edition = 'Standard'
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'

if ($Edition -eq 'Lite') {
    $map = [ordered]@{
        'editions/lite/manifest.json' = 'manifest.json'
        'editions/lite/background-lite.js' = 'background.js'
        'content.js' = 'content.js'
        'game.css' = 'game.css'
        'game.html' = 'game.html'
        'game.js' = 'game.js'
        'options.css' = 'options.css'
        'editions/lite/options-lite.html' = 'options.html'
        'editions/lite/options-lite.js' = 'options.js'
        'popup.css' = 'popup.css'
        'editions/lite/popup-lite.html' = 'popup.html'
        'editions/lite/popup-lite.js' = 'popup.js'
        'editions/lite/shared-defaults.js' = 'shared-defaults.js'
        'welcome.html' = 'welcome.html'
        'welcome.css' = 'welcome.css'
        'welcome.js' = 'welcome.js'
        'history.html' = 'history.html'
        'history.css' = 'history.css'
        'history.js' = 'history.js'
        'icons/icon16.png' = 'icons/icon16.png'
        'icons/icon32.png' = 'icons/icon32.png'
        'icons/icon48.png' = 'icons/icon48.png'
        'icons/icon128.png' = 'icons/icon128.png'
    }
    $manifestSource = Join-Path $root 'editions/lite/manifest.json'
    $packagePrefix = 'ai-hint-lite'
} else {
    $map = [ordered]@{
        'manifest.json' = 'manifest.json'
        'background.js' = 'background.js'
        'content.js' = 'content.js'
        'game.css' = 'game.css'
        'game.html' = 'game.html'
        'game.js' = 'game.js'
        'options.css' = 'options.css'
        'options.html' = 'options.html'
        'options.js' = 'options.js'
        'popup.css' = 'popup.css'
        'popup.html' = 'popup.html'
        'popup.js' = 'popup.js'
        'shared-defaults.js' = 'shared-defaults.js'
        'welcome.html' = 'welcome.html'
        'welcome.css' = 'welcome.css'
        'welcome.js' = 'welcome.js'
        'history.html' = 'history.html'
        'history.css' = 'history.css'
        'history.js' = 'history.js'
        'icons/icon16.png' = 'icons/icon16.png'
        'icons/icon32.png' = 'icons/icon32.png'
        'icons/icon48.png' = 'icons/icon48.png'
        'icons/icon128.png' = 'icons/icon128.png'
    }
    $manifestSource = Join-Path $root 'manifest.json'
    $packagePrefix = 'ai-hint-chrome-extension'
}

$manifest = Get-Content -LiteralPath $manifestSource -Raw | ConvertFrom-Json
if ($manifest.manifest_version -ne 3) { throw 'Expected a Manifest V3 extension.' }
foreach ($sourceFile in $map.Keys) {
    if (-not (Test-Path -LiteralPath (Join-Path $root $sourceFile) -PathType Leaf)) {
        throw "Required $Edition source file is missing: $sourceFile"
    }
}

New-Item -ItemType Directory -Path $dist -Force | Out-Null
$archive = Join-Path $dist "$packagePrefix-$($manifest.version).zip"
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
$staging = Join-Path $dist ".package-$Edition-$([guid]::NewGuid().ToString('N'))"
New-Item -ItemType Directory -Path $staging | Out-Null
foreach ($sourceFile in $map.Keys) {
    $source = Join-Path $root $sourceFile
    $destination = Join-Path $staging $map[$sourceFile]
    New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
    Copy-Item -LiteralPath $source -Destination $destination
}
Compress-Archive -Path (Join-Path $staging '*') -DestinationPath $archive -CompressionLevel Optimal
Remove-Item -LiteralPath $staging -Recurse -Force
Write-Output "Created $archive"
