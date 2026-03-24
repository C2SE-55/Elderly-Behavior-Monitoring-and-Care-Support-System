@echo off
REM Webcam may tinh (mac dinh). De chay video demo: set USE_DEMO_VIDEO=1 hoac dung run_camera_videofall.bat
cd /d "%~dp0"
set USE_DEMO_VIDEO=
set USE_WEBCAM=
set VIDEO_SOURCE=0
python -m Camera_Service.api.main
