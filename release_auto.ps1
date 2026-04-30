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

function Get-Release($version) {
    $tag = "v$version"
    # Draft는 태그 API로 못 찾으므로 목록에서 검색
    $releases = Invoke-GitHubApi "GET" "https://api.github.com/repos/KoreaUm/teacher-app/releases?per_page=10"
    $release = $releases | Where-Object { $_.tag_name -eq $tag } | Select-Object -First 1
    if (-not $release) { Fail "GitHub에서 v$version 릴리즈를 찾을 수 없습니다." }
    return $release
}

function Publish-Release($release) {
    Write-Host "Draft → Published 전환 중..." -ForegroundColor Yellow
    Invoke-RestMethod `
        -Method PATCH `
        -Uri $release.url `
        -Headers @{
            Authorization = "Bearer $env:GH_TOKEN"
            Accept = "application/vnd.github+json"
            "X-GitHub-Api-Version" = "2022-11-28"
            "Content-Type" = "application/json"
        } `
        -Body '{"draft":false}' | Out-Null
    Write-Host "릴리즈 공개 완료!" -ForegroundColor Green
}

function Ensure-ReleaseAssets($version) {
    $distDir = Join-Path $scriptDir "dist"
    $setupPath = Join-Path $distDir "teacher-app-setup-$version.exe"
    $blockmapPath = Join-Path $distDir "teacher-app-setup-$version.exe.blockmap"
    $latestPath = Join-Path $distDir "latest.yml"

    Write-Step "GitHub Draft 릴리즈 찾기 및 자산 확인"
    $release = Get-Release $version

    if ($release.draft) {
        # electron-builder가 이미 업로드했으므로 추가 업로드 불필요
        # latest.yml만 빠진 경우 보완 업로드
        $hasLatest = $release.assets | Where-Object { $_.name -eq "latest.yml" }
        if (-not $hasLatest) {
            Upload-ReleaseAsset $release $latestPath "application/x-yaml"
            $release = Get-Release $version
        }

        # Draft → 공개
        Publish-Release $release
    } else {
        Write-Host "이미 공개된 릴리즈입니다." -ForegroundColor Green
    }

    Write-Host "v$version 릴리즈 완료!" -ForegroundColor Green
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
# index.lock 잔여 파일 제거
$lockFile = Join-Path $scriptDir ".git\index.lock"
if (Test-Path $lockFile) {
    Write-Host "index.lock 제거 중..." -ForegroundColor Yellow
    Remove-Item $lockFile -Force
}
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
