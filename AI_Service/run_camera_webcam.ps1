# Camera Service - webcam may tinh (index 0). Chay tu thu muc AI_Service.
Set-Location $PSScriptRoot
$env:VIDEO_SOURCE = "0"
python -m Camera_Service.api.main
