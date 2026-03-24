"""Cấu hình pipeline giám sát (biến môi trường)."""

import os

BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")
CAMERA_ID = int(os.environ.get("CAMERA_ID", "1"))

YOLO_MODEL = os.environ.get("YOLO_MODEL", "yolov8n.pt")
YOLO_EVERY_N_FRAMES = max(1, int(os.environ.get("YOLO_EVERY_N_FRAMES", "5")))
YOLO_CONF = float(os.environ.get("YOLO_CONF", "0.35"))
# imgsz nhỏ hơn 640 → YOLO nhanh hơn (đổi lại độ chính xác xa người có thể giảm)
YOLO_IMGSZ = max(32, int(os.environ.get("YOLO_IMGSZ", "256")))
# FP16 trên GPU: auto | 1 | 0 (trên CPU luôn tắt)
YOLO_HALF = os.environ.get("YOLO_HALF", "auto").strip().lower()
# Pose-YOLO gating: giảm khung xương ảo ở nền khi không khớp vùng người YOLO
POSE_USE_YOLO_GATE = os.environ.get("POSE_USE_YOLO_GATE", "0").lower() in ("1", "true", "yes", "")
POSE_YOLO_MIN_OVERLAP = float(os.environ.get("POSE_YOLO_MIN_OVERLAP", "0.06"))
POSE_MIN_SCORE = float(os.environ.get("POSE_MIN_SCORE", "0.03"))
POSE_MIN_BOX_AREA = float(os.environ.get("POSE_MIN_BOX_AREA", "80.0"))

# MJPEG (matplotlib savefig): dpi/quality thấp → encode nhanh, FPS stream cao hơn
STREAM_JPEG_DPI = max(20, min(120, int(os.environ.get("STREAM_JPEG_DPI", "28"))))
STREAM_JPEG_QUALITY = max(30, min(95, int(os.environ.get("STREAM_JPEG_QUALITY", "45"))))
STREAM_UPDATE_EVERY_N_FRAMES = max(1, int(os.environ.get("STREAM_UPDATE_EVERY_N_FRAMES", "2")))

FACE_RECOGNITION_INTERVAL = max(1, int(os.environ.get("FACE_RECOGNITION_INTERVAL", "20")))

OUT_OF_ZONE_SECONDS = float(os.environ.get("OUT_OF_ZONE_SECONDS", "12"))
OUT_OF_ZONE_ALERT_COOLDOWN = float(os.environ.get("OUT_OF_ZONE_ALERT_COOLDOWN", "30"))

STRICT_EMPTY_ROOM = os.environ.get("STRICT_EMPTY_ROOM", "0").lower() in ("1", "true", "yes")

# Vùng giám sát (viền trên khung): YOLO/pose — tâm bbox nằm trong polygon → có người trong vùng
SUPERVISOR_ZONE_ENABLED = os.environ.get("SUPERVISOR_ZONE_ENABLED", "1").lower() in ("1", "true", "yes", "")
# Polygon normalized "x,y;x,y;..." — rỗng thì dùng khung mặc định (safe_zone.default_supervisor_zone)
SAFE_ZONE_POLYGON = os.environ.get("SAFE_ZONE_POLYGON", "").strip()
# (Dự phòng) Trước đây dùng debounce “mất người trong vùng”; hiện thông báo không người là tức thì.
SUPERVISOR_ZONE_EMPTY_SECONDS = float(os.environ.get("SUPERVISOR_ZONE_EMPTY_SECONDS", "3"))
# Gửi ảnh lên left_safe_zone_events khi chuyển từ có người → không có người (tránh spam mỗi frame)
SUPERVISOR_NO_PERSON_SNAPSHOT = os.environ.get("SUPERVISOR_NO_PERSON_SNAPSHOT", "1").lower() in ("1", "true", "yes", "")
# Khoảng cách tối thiểu giữa hai lần ghi (giây) — hạn chế nhiễu detect nhấp nháy
SUPERVISOR_NO_PERSON_COOLDOWN_SECONDS = float(os.environ.get("SUPERVISOR_NO_PERSON_COOLDOWN_SECONDS", "45"))
# Tùy chọn: gửi kèm zone_id (Backend vẫn có thể resolve theo camera_id nếu bỏ trống)
_SAFE_ZONE_ID_RAW = os.environ.get("SAFE_ZONE_ID", "").strip()
try:
    SAFE_ZONE_ID = int(_SAFE_ZONE_ID_RAW) if _SAFE_ZONE_ID_RAW else None
except ValueError:
    SAFE_ZONE_ID = None

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
FALL_CONFIRM_FRAMES = max(1, int(os.environ.get("FALL_CONFIRM_FRAMES", "1")))
FALL_GLOBAL_COOLDOWN_FRAMES = max(1, int(os.environ.get("FALL_GLOBAL_COOLDOWN_FRAMES", "18")))
FALL_USE_YOLO_FALLBACK = os.environ.get("FALL_USE_YOLO_FALLBACK", "1").lower() in ("1", "true", "yes", "")
FALL_YOLO_LYING_ASPECT = float(os.environ.get("FALL_YOLO_LYING_ASPECT", "1.35"))
# Mặc định tắt: kiểm tra “gần sàn” hay làm mất hết sự kiện té; bật lại: FALL_REQUIRE_FLOOR=1
FALL_REQUIRE_FLOOR = os.environ.get("FALL_REQUIRE_FLOOR", "0").lower() in ("1", "true", "yes")
