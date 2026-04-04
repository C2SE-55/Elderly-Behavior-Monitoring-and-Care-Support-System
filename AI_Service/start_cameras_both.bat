@echo off
REM Một cú double-click: bật room1 (video) + room2 (webcam)
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0start_cameras_both.ps1"
pause
