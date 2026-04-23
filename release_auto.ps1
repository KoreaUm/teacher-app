[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Write-Step($message) {
    Write-Host ""
    Write-Host "=== $message ===" -ForegroundColor Cyan
}

function Fail($message) {
    Write-Host ""
    Write-Host $message -ForegroundColor Red
    exit 1
}

function Ensure-LastExitCode($code, $message) {
    if ($code -ne 0) {
        Fail $message
    }
}

function Get-NextVersion($version) {
    $parts = $version.Split(".")
    if ($parts.Length -ne 3) {
        throw "version format must be x.y.z : $version"
    }

    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]
    return "$major.$minor.$($patch + 1)"
}

if (-not $env:GH_TOKEN) {
    Fail 'GH_TOKEN is not set. Run: $env:GH_TOKEN="your_token"'
}

$pkgPath = Join-Path $scriptDir "package.json"
if (-not (Test-Path $pkgPath)) {
    Fail "package.json not found."
}

Write-Step "Read current version"
$pkgRaw = Get-Content $pkgPath -Raw -Encoding UTF8
$pkg = $pkgRaw | ConvertFrom-Json
$currentVersion = [string]$pkg.version
$nextVersion = Get-NextVersion $currentVersion
Write-Host "Current version: $currentVersion" -ForegroundColor Yellow
Write-Host "Next version: $nextVersion" -ForegroundColor Yellow

Write-Step "Bump package.json version"
$updatedPkgRaw = $pkgRaw -replace ('"version"\s*:\s*"' + [regex]::Escape($currentVersion) + '"'), ('"version": "' + $nextVersion + '"')
if ($updatedPkgRaw -eq $pkgRaw) {
    Fail "Could not update version in package.json"
}
Set-Content -Path $pkgPath -Value $updatedPkgRaw -Encoding UTF8
Write-Host "Updated package.json to $nextVersion" -ForegroundColor Green

Write-Step "Git add / commit / push"
git add .
Ensure-LastExitCode $LASTEXITCODE "git add failed"

git commit -m "Release v$nextVersion"
Ensure-LastExitCode $LASTEXITCODE "git commit failed"

git push
Ensure-LastExitCode $LASTEXITCODE "git push failed"

Write-Step "Run release:win"
& npm.cmd run release:win
Ensure-LastExitCode $LASTEXITCODE "npm.cmd run release:win failed"

Write-Step "Done"
Write-Host "Released version $nextVersion" -ForegroundColor Green

if (Test-Path (Join-Path $scriptDir "dist")) {
    explorer (Join-Path $scriptDir "dist")
}
