@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo Semi-auto GitHub Release
echo ==========================================
echo.
echo This will:
echo - bump package.json patch version
echo - git add / commit / push
echo - run npm.cmd run release:win
echo.

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0release_auto.ps1"
if errorlevel 1 (
  echo.
  echo Release failed. Check the error message above.
  pause
  exit /b 1
)

echo.
echo Release finished.
if exist "dist" explorer "dist"
pause
