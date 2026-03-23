# Camera Service: videofall.mp4 (demo té), không webcam
Set-Location $PSScriptRoot
Remove-Item Env:USE_WEBCAM -ErrorAction SilentlyContinue
$env:VIDEO_SOURCE = (Join-Path $PSScriptRoot "..\Frontend\assets\videos\videofall.mp4")
$env:VIDEO_SKIP_FRAMES = "1"
python -m Camera_Service.api.main
