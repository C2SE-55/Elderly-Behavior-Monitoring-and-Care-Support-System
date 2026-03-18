"""
API Camera Service: phát MJPEG stream video đã qua model phát hiện té ngã,
phục vụ Frontend (Giám sát và phát hiện hành vi) quét tự động và liên tục.

Nguồn video (không bắt buộc dùng webcam):
  - Mặc định: dùng file Frontend/assets/videos/video3.mp4 (video chính giám sát); nếu không có thì video2.mp4, videofall.mp4; không thì webcam 0.
  - Biến môi trường VIDEO_SOURCE (ghi đè mặc định):
    + VIDEO_SOURCE=0          -> webcam
    + VIDEO_SOURCE=path.mp4   -> file video (lặp liên tục khi hết)
    + VIDEO_SOURCE=1          -> webcam thứ 2
  - Tăng tốc FPS / đường truyền:
    + VIDEO_SCALE=0.5         -> co ảnh 50% trước khi chạy model (mặc định 0.5, nhanh hơn)
    + VIDEO_SKIP_FRAMES=2    -> chạy model mỗi 2 frame (mặc định 2), giảm tải
    Ví dụ: set VIDEO_SCALE=0.6  set VIDEO_SKIP_FRAMES=1  (chất lượng cao hơn, FPS thấp hơn)
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

Lưu ảnh té ngã vào database (bảng fall_events):
  - Khi phát hiện té, Camera Service gửi ảnh lên Backend POST /api/fall-events.
  - Biến môi trường: BACKEND_URL (Backend API), CAMERA_ID (id camera trong bảng cameras, mặc định 1).
"""

import os
import sys
import time
import logging
import threading

# Import từ package Camera_Service (parent của api) để video.py chạy đúng relative imports
from ..video import inference as video_inference, cli as video_cli


def _get_default_video_path():
    """Video mặc định giám sát: video3.mp4; nếu không có thì video2.mp4, videofall.mp4 (khi không set VIDEO_SOURCE)."""
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    videos_dir = os.path.join(root, "Frontend", "assets", "videos")
    for name in ("video3.mp4", "video2.mp4", "videofall.mp4"):
        path = os.path.join(videos_dir, name)
        if os.path.isfile(path):
            return path
    return None


def _get_video_source():
    """Nguồn video: từ env VIDEO_SOURCE. Mặc định dùng video3.mp4 (chính) nếu có, không thì webcam 0."""
    raw = os.environ.get("VIDEO_SOURCE", "").strip()
    if raw == "" or raw == "0":
        default_file = _get_default_video_path()
        if default_file:
            return default_file
        return 0
    if raw.isdigit():
        return int(raw)
    return raw


def _parse_stream_args(source=None):
    """Giả lập argv để video.cli() parse được. source: 0 (webcam) hoặc đường dẫn file video."""
    if source is None:
        source = _get_video_source()
    old_argv = sys.argv
    src_str = str(source) if source is not None else "0"
    scale = os.environ.get("VIDEO_SCALE", "0.4").strip()   # 0.3 = nhẹ, giảm lag (8GB)
    skip = os.environ.get("VIDEO_SKIP_FRAMES", "2").strip()  # 2 = mỗi 2 frame, bớt lag
    sys.argv = [
        "video",
        "--source=" + src_str,
        "--quiet",
        "--scale=" + scale,
        "--skip-frames=" + skip,
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
}

_inference_thread = None
_inference_started = False


def _run_inference():
    """Chạy vòng inference: đọc từ VIDEO_SOURCE (webcam 0 hoặc file video), chạy model, cập nhật stream_state."""
    global stream_state, _inference_started
    try:
        source = _get_video_source()
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
    port = int(os.environ.get("PORT", 9000))
    uvicorn.run(app, host="0.0.0.0", port=port)
