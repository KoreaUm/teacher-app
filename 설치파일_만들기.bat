@echo off
chcp 65001 > nul
cd /d "%~dp0"
call npm.cmd run build:win
if exist "dist" (
  explorer "dist"
)
