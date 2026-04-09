"""
API Camera Service: phát MJPEG stream video đã qua model phát hiện té ngã,
phục vụ Frontend (Giám sát và phát hiện hành vi) quét tự động và liên tục.

Nguồn video:
  - Mặc định: ưu tiên video demo trong repo (`Frontend/assets/videos/video3.mp4`, fallback `videofall.mp4`, `video2.mp4`), nếu không có thì webcam 0.
  - Biến môi trường VIDEO_SOURCE:
    + VIDEO_SOURCE rỗng       -> dùng file demo nếu có, không thì webcam 0
    + VIDEO_SOURCE=0          -> dùng file demo nếu có (trừ khi USE_WEBCAM=1)
    + USE_DEMO_VIDEO=1        -> giữ tương thích ngược (không bắt buộc nữa)
    + USE_WEBCAM=1            -> buộc webcam khi VIDEO_SOURCE=0 (bỏ qua file demo)
    + VIDEO_SOURCE=path.mp4   -> file video (lặp liên tục khi hết)
  - Tăng tốc FPS / đường truyền:
    + VIDEO_SCALE=0.35        -> co ảnh trước khi chạy model (mặc định trong code ~0.4), nhỏ hơn = nhanh hơn
    + VIDEO_SKIP_FRAMES=3     -> OpenPifPaf mỗi N frame (mặc định 2), tăng N = FPS cao hơn, pose giật hơn
    + VIDEO_MAX_FPS=10        -> giới hạn FPS xử lý/hiển thị (mặc định 10 để giảm tải)
    + STREAM_JPEG_DPI=40      -> DPI ảnh MJPEG (mặc định 48), thấp hơn = encode nhanh hơn
    + STREAM_JPEG_QUALITY=65  -> chất lượng JPEG stream (mặc định 72), thấp hơn = nhanh hơn
    + YOLO_IMGSZ=320          -> kích thước input YOLO (mặc định 416), nhỏ hơn = nhanh hơn
    + YOLO_HALF=auto          -> FP16 trên GPU (mặc định auto); YOLO_HALF=0 tắt
  Phát hiện té (bbox + spread keypoint + vai–hông; mặc định không kiểm tra “sàn”):
    + FALL_REQUIRE_FLOOR=1       -> bật kiểm tra gần sàn (mặc định tắt)
    + FALL_LEG_VETO=0            -> tắt lọc “chân dưới hông” nếu cần tinh chỉnh
    + FALL_FB1_MIN_STREAK=5      -> số frame liên tiếp mới cho fallback keypoint đếm +1
  Ví dụ (Windows): set VIDEO_SOURCE=D:\\videos\\room1.mp4
  Ví dụ (Linux):   export VIDEO_SOURCE=/path/to/video.mp4

Chạy từ thư mục AI_Service (cha của Camera_Service):
  python -m Camera_Service.api.main
  hoặc
  uvicorn Camera_Service.api.main:app --host 0.0.0.0 --port 9000

Endpoint:
  GET /stream     -> MJPEG stream (video liên tục có overlay pose + fall)
  GET /api/status -> JSON { fallcount, fps, ready, source } để hiển thị trên app

Nhận diện khuôn mặt (người cần giám sát từ Quản lý thông tin sức khỏe):
  - Backend cung cấp GET /api/health-metrics/face-references (danh sách ảnh face_image_url).
  - Camera Service gọi API đó khi khởi động; biến môi trường BACKEND_URL (vd: http://localhost:5000).
  - FACE_MATCH_TOLERANCE (mặc định 0.65), FACE_RECOGNITION_INTERVAL (N frame), FACE_TARGET_PROFILE_IDS (CSV id),
    FACE_REFS_REFRESH_SECONDS (0=chỉ lúc start), FACE_SINGLE_PERSON_FALLBACK=0 (1=1 người+1 ref thì gán tên khi chưa khớp mặt).

Ghi nhận sự kiện té (bảng fall_events) qua Backend:
  - Khi phát hiện té, Camera Service gửi ảnh JPEG lên Backend POST /api/fall-events.
  - Biến môi trường: BACKEND_URL (Backend API), CAMERA_ID (id camera trong bảng cameras, mặc định 1).

Ghi nhận “không phát hiện người” (bảng left_safe_zone_events):
  - Khi chuyển từ có người → không có người, chụp frame và POST /api/left-safe-zone-events.
  - SUPERVISOR_NO_PERSON_SNAPSHOT=1 (mặc định), SUPERVISOR_NO_PERSON_COOLDOWN_SECONDS=45, SAFE_ZONE_ID (tùy chọn).
"""

import os
import sys
import time
import logging
import threading

# Import từ package Camera_Service (parent của api) để video.py chạy đúng relative imports
from ..video import inference as video_inference, cli as video_cli


def _get_default_video_path():
    """Tìm video3.mp4 → videofall.mp4 → video2.mp4 trong Frontend/assets/videos (nhiều gốc thư mục)."""
    names = ("video3.mp4", "videofall.mp4", "video2.mp4")
    api_dir = os.path.dirname(os.path.abspath(__file__))
    roots = []
    pr = os.environ.get("PROJECT_ROOT", "").strip()
    if pr:
        roots.append(os.path.abspath(pr))
    roots.append(os.path.abspath(os.path.join(api_dir, "..", "..", "..")))
    d = os.path.abspath(os.getcwd())
    for _ in range(8):
        roots.append(d)
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent
    seen = set()
    for root in roots:
        root = os.path.normpath(root)
        if root in seen:
            continue
        seen.add(root)
        videos_dir = os.path.join(root, "Frontend", "assets", "videos")
        for name in names:
            path = os.path.join(videos_dir, name)
            if os.path.isfile(path):
                return path
    return None


def _get_video_source():
    """Nguồn video: mặc định ưu tiên file demo (video3) nếu có, fallback webcam.

    - Đường dẫn / URL (không chỉ số): dùng trực tiếp.
    - VIDEO_SOURCE rỗng hoặc 0: dùng file demo trong Frontend nếu có, không thì webcam 0.
    - USE_DEMO_VIDEO=1: tương thích ngược (không bắt buộc nữa).
    - USE_WEBCAM=1 + VIDEO_SOURCE=0: luôn webcam 0 (bỏ qua demo).
    - VIDEO_SOURCE=1,2,...: webcam chỉ số đó.
    """
    raw = os.environ.get("VIDEO_SOURCE", "").strip()
    default_file = _get_default_video_path()
    use_webcam = os.environ.get("USE_WEBCAM", "").lower() in ("1", "true", "yes")

    if raw.isdigit():
        idx = int(raw)
        if idx == 0 and default_file and not use_webcam:
            return default_file
        return idx

    if raw == "":
        if default_file:
            return default_file
        return 0

    return raw


def _parse_stream_args(source=None):
    """Giả lập argv để video.cli() parse được. source: 0 (webcam) hoặc đường dẫn file video."""
    if source is None:
        source = _get_video_source()
    old_argv = sys.argv
    src_str = str(source) if source is not None else "0"
    scale = os.environ.get("VIDEO_SCALE", "0.35").strip()   # preset CPU nhanh: giảm kích thước input
    skip = os.environ.get("VIDEO_SKIP_FRAMES", "2").strip()  # preset CPU nhanh: giảm tần suất pose
    max_fps = os.environ.get("VIDEO_MAX_FPS", "12").strip()  # giới hạn FPS để stream ổn định hơn
    sys.argv = [
        "video",
        "--source=" + src_str,
        "--quiet",
        "--scale=" + scale,
        "--skip-frames=" + skip,
        "--max-fps=" + max_fps,
    ]
    try:
        args = video_cli()
        args.show = False
        args.video_output = None
        args.max_frames = None
        return args
    finally:
        sys.argv = old_argv


# Trạng thái stream dùng chung (thread-safe: chỉ thread inference ghi, API đọc)
stream_state = {
    "jpeg": b"",
    "fallcount": 0,
    "fps": 0.0,
    "ready": False,
    "target_visible": False,
    "person_count": 0,
    "matched_profile_id": None,
    "matched_name": "",
    "face_references_count": 0,
    "face_recognition_active": False,
    "person_in_zone": False,
    "supervisor_missing": False,
    "any_person": False,
}

_inference_thread = None
_inference_started = False


def _run_inference():
    """Chạy vòng inference: đọc từ VIDEO_SOURCE (webcam 0 hoặc file video), chạy model, cập nhật stream_state."""
    global stream_state, _inference_started
    log = logging.getLogger(__name__)
    try:
        try:
            from ..core import pipeline_config

            log.warning(
                "Camera pipeline: CAMERA_ID=%s BACKEND_URL=%s (sự kiện té/vùng an toàn POST về đây)",
                pipeline_config.CAMERA_ID,
                pipeline_config.BACKEND_URL,
            )
            try:
                import requests

                health = f"{pipeline_config.BACKEND_URL}/health"
                r = requests.get(health, timeout=3)
                if r.ok:
                    log.warning("Đã kết nối Backend OK: GET %s → %s", health, r.status_code)
                else:
                    log.warning("Backend trả mã %s khi GET %s — kiểm tra server.", r.status_code, health)
            except Exception as ex:
                log.warning(
                    "Không gọi được Backend (%s): %s — POST fall / left_safe_zone sẽ thất bại.",
                    pipeline_config.BACKEND_URL,
                    ex,
                )
        except Exception:
            pass

        source = _get_video_source()
        if isinstance(source, str) and source.lower().endswith((".mp4", ".avi", ".mkv", ".mov")):
            log.info("Nguồn video (file): %s", source)
        elif isinstance(source, int):
            log.info("Nguồn video: webcam index %s", source)
        args = _parse_stream_args(source)
        label = "webcam" if isinstance(source, int) else "video_file"
        stream = (source, label, getattr(args, "scale", 1.0))
        video_inference(args, stream, stream_state=stream_state)
    except Exception as e:
        logging.getLogger(__name__).exception("Inference thread error: %s", e)
    finally:
        _inference_started = False


def _ensure_inference_started():
    global _inference_thread, _inference_started
    if _inference_started and _inference_thread is not None and _inference_thread.is_alive():
        return
    _inference_started = True
    _inference_thread = threading.Thread(target=_run_inference, daemon=True)
    _inference_thread.start()
    # Đợi vài frame đầu có dữ liệu
    for _ in range(100):
        if stream_state.get("ready"):
            break
        time.sleep(0.05)


# FastAPI app
try:
    from fastapi import FastAPI
    from fastapi.responses import StreamingResponse, Response
    from fastapi.middleware.cors import CORSMiddleware
except ImportError:
    FastAPI = None
    StreamingResponse = None
    Response = None
    CORSMiddleware = None

if FastAPI is None:
    raise RuntimeError("Cần cài: pip install fastapi uvicorn")

app = FastAPI(title="Camera Service API", description="Stream video + fall detection")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "service": "camera"}


@app.get("/api/status")
def fall_status():
    """Trạng thái hiện tại: số lần té, FPS, nguồn video. Frontend gọi để hiển thị và thông báo."""
    _ensure_inference_started()
    src = _get_video_source()
    source_label = "webcam" if isinstance(src, int) else str(src)
    return {
        "fallcount": stream_state.get("fallcount", 0),
        "fps": round(stream_state.get("fps", 0), 1),
        "ready": stream_state.get("ready", False),
        "source": source_label,
        "target_visible": stream_state.get("target_visible", False),
        "person_count": stream_state.get("person_count", 0),
        "matched_profile_id": stream_state.get("matched_profile_id"),
        "matched_name": stream_state.get("matched_name", "") or "",
        "face_references_count": stream_state.get("face_references_count", 0),
        "face_recognition_active": stream_state.get("face_recognition_active", False),
        "person_in_zone": stream_state.get("person_in_zone", False),
        "supervisor_missing": stream_state.get("supervisor_missing", False),
        "any_person": stream_state.get("any_person", False),
    }


def _mjpeg_stream():
    """Generator gửi từng frame JPEG dưới dạng MJPEG (multipart)."""
    boundary = "frame"
    while True:
        if stream_state.get("ready") and stream_state.get("jpeg"):
            jpeg = stream_state["jpeg"]
            yield (
                b"--" + boundary.encode() + b"\r\n"
                b"Content-Type: image/jpeg\r\n"
                b"Content-Length: " + str(len(jpeg)).encode() + b"\r\n\r\n"
                + jpeg
                + b"\r\n"
            )
        time.sleep(0.04)  # ~25 FPS, giảm lag (8GB RAM)


@app.get("/stream")
def stream():
    """Stream MJPEG: video liên tục đã qua model pose + fall detection."""
    _ensure_inference_started()
    return StreamingResponse(
        _mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


if __name__ == "__main__":
    import uvicorn
    import argparse

    parser = argparse.ArgumentParser(add_help=True)
    parser.add_argument("--host", default=os.environ.get("HOST", "0.0.0.0"))
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("PORT", 9000)),
        help="Port for Camera Service API (default: env PORT or 9000)",
    )
    args, _unknown = parser.parse_known_args()

    uvicorn.run(app, host=args.host, port=args.port)