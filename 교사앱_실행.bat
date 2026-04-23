@echo off
chcp 65001 > nul
cd /d "%~dp0"

if exist "dist\win-unpacked\교사 업무 관리.exe" (
  start "" "dist\win-unpacked\교사 업무 관리.exe"
  exit /b
)

echo 설치본이 아직 없습니다. 개발용 Electron으로 실행합니다.
start "" node_modules\.bin\electron.cmd .
