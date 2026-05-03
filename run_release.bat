@echo off
chcp 65001 > nul
setlocal
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "%~dp0release_auto.ps1"
if errorlevel 1 pause
