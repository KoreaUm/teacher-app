@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ==========================================
echo GitHub Releases 자동 업데이트 배포 시작
echo ==========================================
echo.
echo 먼저 PowerShell에서 GH_TOKEN 을 등록한 뒤 실행하세요.
echo.

call npm.cmd run release:win
if errorlevel 1 (
  echo.
  echo 배포에 실패했습니다. 위의 오류 내용을 먼저 확인하세요.
  pause
  exit /b 1
)

echo.
echo 배포가 끝났습니다. dist 폴더와 GitHub Releases를 확인하세요.
if exist "dist" explorer "dist"
pause
