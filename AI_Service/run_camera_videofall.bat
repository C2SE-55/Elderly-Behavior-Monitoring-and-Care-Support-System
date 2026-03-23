@echo off
REM Camera Service: video demo té ngã (không dùng webcam).
cd /d "%~dp0"
set USE_WEBCAM=
set "VIDEO_SOURCE=%~dp0..\Frontend\assets\videos\videofall.mp4"
REM Pose mỗi frame -> dễ bắt té hơn khi xem file (đổi 2 nếu máy yếu)
set VIDEO_SKIP_FRAMES=1
python -m Camera_Service.api.main
