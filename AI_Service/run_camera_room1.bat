@echo off
REM Room 1: camera id 1, port 9001, file video3.mp4
cd /d "%~dp0"
set CAMERA_ID=1
set PORT=9001
if not defined BACKEND_URL set BACKEND_URL=http://localhost:5000
set USE_WEBCAM=
set "VIDEO_SOURCE=%~dp0..\Frontend\assets\videos\video3.mp4"
python -m Camera_Service.api.main
