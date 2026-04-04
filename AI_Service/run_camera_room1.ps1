# Room 1 → cameras.id=1, MJPEG http://localhost:9001/stream (khớp Backend CAMERA_AI_STREAM_PORTS)
Set-Location $PSScriptRoot
$env:CAMERA_ID = "1"
$env:PORT = "9001"
$env:BACKEND_URL = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:5000" }
Remove-Item Env:USE_WEBCAM -ErrorAction SilentlyContinue
$env:VIDEO_SOURCE = (Join-Path $PSScriptRoot "..\Frontend\assets\videos\video3.mp4")
python -m Camera_Service.api.main
