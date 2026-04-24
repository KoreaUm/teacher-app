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

function Write-Utf8NoBom($path, $content) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
}

function Invoke-GitHubApi($method, $uri) {
    return Invoke-RestMethod `
        -Method $method `
        -Uri $uri `
        -Headers @{
            Authorization = "Bearer $env:GH_TOKEN"
            Accept = "application/vnd.github+json"
            "X-GitHub-Api-Version" = "2022-11-28"
        }
}

function Upload-ReleaseAsset($release, $filePath, $contentType) {
    if (-not (Test-Path $filePath)) {
        Fail "Release asset not found: $filePath"
    }

    $name = [System.IO.Path]::GetFileName($filePath)
    $existing = @($release.assets | Where-Object { $_.name -eq $name })
    foreach ($asset in $existing) {
        Write-Host "Delete existing asset: $name" -ForegroundColor Yellow
        Invoke-GitHubApi "DELETE" $asset.url | Out-Null
    }

    $uploadBase = $release.upload_url -replace "\{\?name,label\}$", ""
    $uploadUri = $uploadBase + "?name=$([System.Uri]::EscapeDataString($name))"

    Write-Host "Upload asset: $name" -ForegroundColor Yellow
    Invoke-RestMethod `
        -Method POST `
        -Uri $uploadUri `
        -Headers @{
            Authorization = "Bearer $env:GH_TOKEN"
            Accept = "application/vnd.github+json"
            "X-GitHub-Api-Version" = "2022-11-28"
            "Content-Type" = $contentType
        } `
        -InFile $filePath | Out-Null
}

function Ensure-ReleaseAssets($version) {
    $tag = "v$version"
    $distDir = Join-Path $scriptDir "dist"
    $setupPath = Join-Path $distDir "teacher-app-setup-$version.exe"
    $blockmapPath = Join-Path $distDir "teacher-app-setup-$version.exe.blockmap"
    $latestPath = Join-Path $distDir "latest.yml"

    Write-Step "Verify GitHub release assets"
    $release = Invoke-GitHubApi "GET" "https://api.github.com/repos/KoreaUm/teacher-app/releases/tags/$tag"

    Upload-ReleaseAsset $release $latestPath "application/x-yaml"
    $release = Invoke-GitHubApi "GET" "https://api.github.com/repos/KoreaUm/teacher-app/releases/tags/$tag"
    Upload-ReleaseAsset $release $setupPath "application/octet-stream"
    $release = Invoke-GitHubApi "GET" "https://api.github.com/repos/KoreaUm/teacher-app/releases/tags/$tag"
    Upload-ReleaseAsset $release $blockmapPath "application/octet-stream"

    Write-Host "Release assets verified for $tag" -ForegroundColor Green
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
Write-Utf8NoBom $pkgPath $updatedPkgRaw
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

Ensure-ReleaseAssets $nextVersion

Write-Step "Done"
Write-Host "Released version $nextVersion" -ForegroundColor Green

if (Test-Path (Join-Path $scriptDir "dist")) {
    explorer (Join-Path $scriptDir "dist")
}
