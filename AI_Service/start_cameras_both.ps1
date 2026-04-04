# Mở 2 cửa sổ: Room 1 = file video (9001), Room 2 = webcam (9002).
# App chọn luồng theo room nhờ Backend CAMERA_AI_STREAM_PORTS=1:9001,2:9002
# (Tương đương chạy tay: .\run_camera_room1.ps1 và .\run_camera_webcam.ps1 — cùng lõi python -m Camera_Service.api.main + biến môi trường PORT/CAMERA_ID/VIDEO_SOURCE.)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Đang mở Camera Service room 1 (port 9001)..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-NoProfile",
    "-File", (Join-Path $PSScriptRoot "run_camera_room1.ps1")
)

Start-Sleep -Seconds 2

Write-Host "Đang mở Camera Service room 2 / webcam (port 9002)..." -ForegroundColor Cyan
Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-ExecutionPolicy", "Bypass",
    "-NoProfile",
    "-File", (Join-Path $PSScriptRoot "run_camera_webcam.ps1")
)

Write-Host "Xong. Giữ 2 cửa sổ PowerShell đang chạy; đóng là mất MJPEG." -ForegroundColor Green
Start-Sleep -Seconds 2
