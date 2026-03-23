"""Cấu hình pipeline giám sát (biến môi trường)."""

import os

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")
CAMERA_ID = int(os.environ.get("CAMERA_ID", "1"))

YOLO_MODEL = os.environ.get("YOLO_MODEL", "yolov8n.pt")
YOLO_EVERY_N_FRAMES = max(1, int(os.environ.get("YOLO_EVERY_N_FRAMES", "2")))
YOLO_CONF = float(os.environ.get("YOLO_CONF", "0.35"))
# imgsz nhỏ hơn 640 → YOLO nhanh hơn (đổi lại độ chính xác xa người có thể giảm)
YOLO_IMGSZ = max(32, int(os.environ.get("YOLO_IMGSZ", "416")))
# FP16 trên GPU: auto | 1 | 0 (trên CPU luôn tắt)
YOLO_HALF = os.environ.get("YOLO_HALF", "auto").strip().lower()

# MJPEG (matplotlib savefig): dpi/quality thấp → encode nhanh, FPS stream cao hơn
STREAM_JPEG_DPI = max(20, min(120, int(os.environ.get("STREAM_JPEG_DPI", "48"))))
STREAM_JPEG_QUALITY = max(30, min(95, int(os.environ.get("STREAM_JPEG_QUALITY", "72"))))

FACE_RECOGNITION_INTERVAL = max(1, int(os.environ.get("FACE_RECOGNITION_INTERVAL", "20")))

OUT_OF_ZONE_SECONDS = float(os.environ.get("OUT_OF_ZONE_SECONDS", "12"))
OUT_OF_ZONE_ALERT_COOLDOWN = float(os.environ.get("OUT_OF_ZONE_ALERT_COOLDOWN", "30"))

STRICT_EMPTY_ROOM = os.environ.get("STRICT_EMPTY_ROOM", "0").lower() in ("1", "true", "yes")

# Phát hiện té (falldetector): mặc định đã nới để dễ bắt hơn; tăng giá trị = khắt khe hơn
# FALL_FLOOR_Y_RATIO: tâm bbox phải nằm trong phần “dưới” ảnh (càng nhỏ = vùng “sàn” càng rộng)
FALL_FLOOR_Y_RATIO = float(os.environ.get("FALL_FLOOR_Y_RATIO", "0.28"))
# Bbox (có joint_scales): rộng >= hệ số * cao
FALL_LYING_ASPECT = float(os.environ.get("FALL_LYING_ASPECT", "1.02"))
FALL_CLEARLY_LYING_ASPECT = float(os.environ.get("FALL_CLEARLY_LYING_ASPECT", "1.05"))
# Spread keypoint thuần (min/max điểm vẽ được): w_span >= hệ số * h_span → coi nằm ngang (bắt té khi bbox vẫn “đứng”)
FALL_USE_KEYPOINT_SPREAD = os.environ.get("FALL_USE_KEYPOINT_SPREAD", "1").lower() in ("1", "true", "yes", "")
FALL_KP_LYING_ASPECT = float(os.environ.get("FALL_KP_LYING_ASPECT", "0.78"))
# Vai–hông: |x_vai - x_hông| so với |y_vai - y_hông| (người nằm nghiêng trong khung)
FALL_USE_TORSO = os.environ.get("FALL_USE_TORSO", "1").lower() in ("1", "true", "yes", "")
FALL_TORSO_MIN_RATIO = float(os.environ.get("FALL_TORSO_MIN_RATIO", "0.52"))
FALL_MOVEMENT_RATIO = float(os.environ.get("FALL_MOVEMENT_RATIO", "0.025"))
FALL_MIN_HISTORY_FRAMES = max(1, int(os.environ.get("FALL_MIN_HISTORY_FRAMES", "1")))
FALL_COOLDOWN_FRAMES = max(1, int(os.environ.get("FALL_COOLDOWN_FRAMES", "45")))
FALL_STABLE_LYING_FRAMES = max(1, int(os.environ.get("FALL_STABLE_LYING_FRAMES", "1")))
FALL_FALLBACK_COOLDOWN_FRAMES = max(1, int(os.environ.get("FALL_FALLBACK_COOLDOWN_FRAMES", "18")))
# Mặc định tắt: kiểm tra “gần sàn” hay làm mất hết sự kiện té; bật lại: FALL_REQUIRE_FLOOR=1
FALL_REQUIRE_FLOOR = os.environ.get("FALL_REQUIRE_FLOOR", "0").lower() in ("1", "true", "yes")
