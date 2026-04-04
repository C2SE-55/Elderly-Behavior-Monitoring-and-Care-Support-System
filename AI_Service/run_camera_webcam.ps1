# Room 2 → cameras.id=2, MJPEG http://localhost:9002/stream
# Webcam / iVCam: preset "rõ hơn" — nếu máy giật, bớt VIDEO_SCALE hoặc STREAM_JPEG_QUALITY
Set-Location $PSScriptRoot
$env:CAMERA_ID = "2"
$env:PORT = "9002"
$env:BACKEND_URL = if ($env:BACKEND_URL) { $env:BACKEND_URL } else { "http://localhost:5000" }
$env:USE_WEBCAM = "1"
$env:VIDEO_SOURCE = "0"

# Đầu vào model lớn hơn mặc định (0.35) → pose/té ổn định hơn khi nguồn hơi mờ
$env:VIDEO_SCALE = if ($env:VIDEO_SCALE) { $env:VIDEO_SCALE } else { "0.52" }
$env:VIDEO_SKIP_FRAMES = if ($env:VIDEO_SKIP_FRAMES) { $env:VIDEO_SKIP_FRAMES } else { "1" }
$env:VIDEO_MAX_FPS = if ($env:VIDEO_MAX_FPS) { $env:VIDEO_MAX_FPS } else { "12" }

# MJPEG lên app
$env:STREAM_JPEG_DPI = if ($env:STREAM_JPEG_DPI) { $env:STREAM_JPEG_DPI } else { "80" }
$env:STREAM_JPEG_QUALITY = if ($env:STREAM_JPEG_QUALITY) { $env:STREAM_JPEG_QUALITY } else { "88" }

# YOLO: ảnh lớn hơn → xa/người nhỏ dễ thấy hơn (CPU/GPU tải tăng)
$env:YOLO_IMGSZ = if ($env:YOLO_IMGSZ) { $env:YOLO_IMGSZ } else { "416" }
$env:YOLO_EVERY_N_FRAMES = if ($env:YOLO_EVERY_N_FRAMES) { $env:YOLO_EVERY_N_FRAMES } else { "3" }

# OpenCV yêu cầu độ phân giải (iVCam: chỉnh thêm app điện thoại Quality cao + Wi‑Fi tốt)
$env:WEBCAM_WIDTH = if ($env:WEBCAM_WIDTH) { $env:WEBCAM_WIDTH } else { "1280" }
$env:WEBCAM_HEIGHT = if ($env:WEBCAM_HEIGHT) { $env:WEBCAM_HEIGHT } else { "720" }

# Pose hơi nới khi khung nhiễu
$env:POSE_MIN_SCORE = if ($env:POSE_MIN_SCORE) { $env:POSE_MIN_SCORE } else { "0.022" }

python -m Camera_Service.api.main
