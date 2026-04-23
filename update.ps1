[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "=== Update Start ===" -ForegroundColor Cyan

# Search candidates (including AppData)
$searchRoots = @(
    "$env:LOCALAPPDATA\Programs",
    "C:\Program Files",
    "C:\Program Files (x86)"
)

$installDir = $null
foreach ($root in $searchRoots) {
    if (-not (Test-Path $root)) { continue }
    $found = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue |
             Where-Object { Test-Path "$($_.FullName)\resources" } |
             Where-Object { (Get-ChildItem "$($_.FullName)" -Filter "*.exe" -ErrorAction SilentlyContinue | Measure-Object).Count -gt 0 } |
             Where-Object { Test-Path "$($_.FullName)\resources\app" -or Test-Path "$($_.FullName)\resources\app.asar" } |
             Select-Object -First 1
    if ($found) {
        $installDir = $found.FullName
        break
    }
}

if (-not $installDir) {
    Write-Host "Install path not found automatically." -ForegroundColor Yellow
    $installDir = Read-Host "Enter install path (e.g. C:\Users\username\AppData\Local\Programs\teacher-app)"
}

$appDir = "$installDir\resources\app"

Write-Host "Install dir: $installDir" -ForegroundColor Gray

# Check if installed with asar (old format) or folder (new format)
if (-not (Test-Path $appDir)) {
    if (Test-Path "$installDir\resources\app.asar") {
        Write-Host ""
        Write-Host "[!] This install uses app.asar (old format)." -ForegroundColor Yellow
        Write-Host "    Please rebuild and reinstall once with the new build first." -ForegroundColor Yellow
        Write-Host "    Run: setup file from dist folder" -ForegroundColor Yellow
        Read-Host "Press Enter to exit"
        exit 1
    }
    Write-Host "ERROR: $appDir not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Kill running app
Write-Host "[1/3] Stopping app..." -ForegroundColor Yellow
Get-Process -ErrorAction SilentlyContinue | Where-Object {
    try { $_.MainModule.FileName -like "*$installDir*" } catch { $false }
} | Stop-Process -Force
Start-Sleep -Seconds 2

# Copy files
Write-Host "[2/3] Copying files..." -ForegroundColor Yellow
try {
    Copy-Item -Path "$scriptDir\src\*" -Destination "$appDir\src\" -Recurse -Force -ErrorAction Stop
    if (Test-Path "$scriptDir\main.js") {
        Copy-Item "$scriptDir\main.js" "$appDir\main.js" -Force
    }
    if (Test-Path "$scriptDir\preload.js") {
        Copy-Item "$scriptDir\preload.js" "$appDir\preload.js" -Force
    }
    Write-Host "Files copied OK" -ForegroundColor Green
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Restart app
Write-Host "[3/3] Restarting app..." -ForegroundColor Yellow
$exe = Get-ChildItem $installDir -Filter "*.exe" -ErrorAction SilentlyContinue |
       Where-Object { $_.Name -notlike "Uninstall*" -and $_.Name -notlike "elevate*" } |
       Select-Object -First 1
if ($exe) {
    Start-Process $exe.FullName
    Write-Host "Done! App restarted." -ForegroundColor Green
} else {
    Write-Host "Done! Please start the app manually." -ForegroundColor Green
}

Start-Sleep -Seconds 2
