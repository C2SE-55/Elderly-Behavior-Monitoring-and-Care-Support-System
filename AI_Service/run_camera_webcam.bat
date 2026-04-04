@echo off
REM Room 2: camera id 2, port 9002 — preset rõ hơn cho webcam/iVCam (máy yếu: giảm VIDEO_SCALE)
cd /d "%~dp0"
set CAMERA_ID=2
set PORT=9002
if not defined BACKEND_URL set BACKEND_URL=http://localhost:5000
set USE_WEBCAM=1
set VIDEO_SOURCE=0
if not defined VIDEO_SCALE set VIDEO_SCALE=0.52
if not defined VIDEO_SKIP_FRAMES set VIDEO_SKIP_FRAMES=1
if not defined VIDEO_MAX_FPS set VIDEO_MAX_FPS=12
if not defined STREAM_JPEG_DPI set STREAM_JPEG_DPI=80
if not defined STREAM_JPEG_QUALITY set STREAM_JPEG_QUALITY=88
if not defined YOLO_IMGSZ set YOLO_IMGSZ=416
if not defined YOLO_EVERY_N_FRAMES set YOLO_EVERY_N_FRAMES=3
if not defined WEBCAM_WIDTH set WEBCAM_WIDTH=1280
if not defined WEBCAM_HEIGHT set WEBCAM_HEIGHT=720
if not defined POSE_MIN_SCORE set POSE_MIN_SCORE=0.022
python -m Camera_Service.api.main
