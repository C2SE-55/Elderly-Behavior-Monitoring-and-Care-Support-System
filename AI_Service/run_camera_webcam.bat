@echo off
REM Webcam: bat buoc USE_WEBCAM=1 (khong thi se uu tien videofall.mp4 neu co trong Frontend).
cd /d "%~dp0"
set USE_WEBCAM=1
set VIDEO_SOURCE=0
python -m Camera_Service.api.main
