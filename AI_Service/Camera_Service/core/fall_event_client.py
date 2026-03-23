"""
Gửi ảnh té ngã lên Backend để lưu vào bảng fall_events (image_url, camera_id, profile_id, ...).
Camera Service gọi khi phát hiện té trong video inference.
"""
import os
import logging

LOG = logging.getLogger(__name__)

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False


def _get_backend_url():
    return os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")


def send_fall_image_to_backend(
    image_bytes,
    camera_id,
    profile_id=None,
    severity_level="high",
    note=None,
):
    """
    POST ảnh (JPEG bytes) lên Backend API /api/fall-events.
    Backend nhận ảnh và ghi bản ghi fall_events (POST /api/fall-events).

    :param image_bytes: bytes (ảnh JPEG)
    :param camera_id: int, bắt buộc (id camera trong bảng cameras)
    :param profile_id: int hoặc None (health_profiles.id - người được giám sát)
    :param severity_level: 'low' | 'medium' | 'high'
    :param note: str hoặc None
    :return: True nếu gửi thành công, False nếu lỗi hoặc không gửi
    """
    if not HAS_REQUESTS:
        LOG.warning("Thiếu thư viện requests: không gửi ảnh té lên Backend.")
        return False
    if not image_bytes or camera_id is None:
        LOG.debug("Bỏ qua gửi fall event: thiếu image_bytes hoặc camera_id")
        return False

    url = _get_backend_url() + "/api/fall-events"
    try:
        files = {"image": ("fall.jpg", image_bytes, "image/jpeg")}
        data = {
            "camera_id": int(camera_id),
            "severity_level": severity_level or "high",
        }
        if profile_id is not None:
            data["profile_id"] = int(profile_id)
        if note is not None and str(note).strip():
            data["note"] = str(note).strip()

        r = requests.post(url, files=files, data=data, timeout=10)
        if r.ok:
            LOG.info("Đã lưu ảnh té ngã lên Backend (fall_events): %s", r.json().get("data", {}).get("image_url"))
            return True
        LOG.warning("Backend trả lỗi khi lưu fall event: %s %s", r.status_code, r.text[:200])
        return False
    except Exception as e:
        LOG.warning("Gửi ảnh té lên Backend thất bại: %s", e)
        return False


def send_out_of_zone_snapshot(image_bytes, camera_id, profile_id=None):
    """Cùng API fall-events; note + severity medium để phân biệt với té ngã."""
    return send_fall_image_to_backend(
        image_bytes,
        camera_id=camera_id,
        profile_id=profile_id,
        severity_level="medium",
        note="Rời khỏi vùng quan sát (không thấy người được giám sát trong khung hình)",
    )
