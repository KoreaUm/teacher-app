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

function Require-CleanExitCode($LASTEXITCODE, $message) {
    if ($LASTEXITCODE -ne 0) {
        Fail $message
    }
}

function Get-NextVersion($version) {
    $parts = $version.Split(".")
    if ($parts.Length -ne 3) {
        throw "version 형식이 x.y.z 가 아닙니다: $version"
    }

    $major = [int]$parts[0]
    $minor = [int]$parts[1]
    $patch = [int]$parts[2]
    return "$major.$minor.$($patch + 1)"
}

if (-not $env:GH_TOKEN) {
    Fail "GH_TOKEN 이 등록되지 않았습니다. PowerShell에서 `$env:GH_TOKEN=""토큰값""` 을 먼저 실행해 주세요."
}

$pkgPath = Join-Path $scriptDir "package.json"
if (-not (Test-Path $pkgPath)) {
    Fail "package.json 파일을 찾을 수 없습니다."
}

Write-Step "현재 버전 확인"
$pkgRaw = Get-Content $pkgPath -Raw -Encoding UTF8
$pkg = $pkgRaw | ConvertFrom-Json
$currentVersion = [string]$pkg.version
$nextVersion = Get-NextVersion $currentVersion
Write-Host "현재 버전: $currentVersion" -ForegroundColor Yellow
Write-Host "다음 버전: $nextVersion" -ForegroundColor Yellow

Write-Step "package.json 버전 올리기"
$updatedPkgRaw = $pkgRaw -replace ('"version"\s*:\s*"' + [regex]::Escape($currentVersion) + '"'), ('"version": "' + $nextVersion + '"')
if ($updatedPkgRaw -eq $pkgRaw) {
    Fail "package.json 의 version 값을 바꾸지 못했습니다."
}
Set-Content -Path $pkgPath -Value $updatedPkgRaw -Encoding UTF8
Write-Host "version 을 $nextVersion 로 변경했습니다." -ForegroundColor Green

Write-Step "Git 상태 반영"
git add .
Require-CleanExitCode $LASTEXITCODE "git add 에 실패했습니다."

git commit -m "Release v$nextVersion"
Require-CleanExitCode $LASTEXITCODE "git commit 에 실패했습니다."

git push
Require-CleanExitCode $LASTEXITCODE "git push 에 실패했습니다."

Write-Step "GitHub Releases 배포"
& npm.cmd run release:win
Require-CleanExitCode $LASTEXITCODE "release:win 실행에 실패했습니다."

Write-Step "배포 완료"
Write-Host "새 버전 $nextVersion 배포가 완료되었습니다." -ForegroundColor Green
Write-Host "GitHub Releases 와 dist 폴더를 확인하세요." -ForegroundColor Gray

if (Test-Path (Join-Path $scriptDir "dist")) {
    explorer (Join-Path $scriptDir "dist")
}
