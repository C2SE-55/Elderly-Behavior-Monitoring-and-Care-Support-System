"""
Nhận diện khuôn mặt từ ảnh tham chiếu (health_profiles.face_image_url) để đánh dấu
người cần giám sát trong video, kể cả khi có nhiều người trong khung hình.
"""
import os
import logging
from collections import namedtuple

import cv2

LOG = logging.getLogger(__name__)

# Optional: face_recognition (pip install face_recognition). Nếu không cài thì nhận diện tắt.
try:
    import face_recognition
    import numpy as np
    HAS_FACE_RECOGNITION = True
except ImportError:
    HAS_FACE_RECOGNITION = False
    face_recognition = None
    np = None

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# (top, right, bottom, left) trong face_recognition; (x_center, y_center) để map với pose
FaceMatch = namedtuple("FaceMatch", "bbox_xyxy name profile_id")  # bbox_xyxy = (x1,y1,x2,y2)


def _get_backend_url():
    return os.environ.get("BACKEND_URL", "http://localhost:5000").rstrip("/")


def load_face_references(backend_url=None):
    """
    Gọi API Backend GET /api/health-metrics/face-references, tải từng ảnh,
    trích embedding khuôn mặt. Trả về list (elderly_name, profile_id, encoding).
    """
    if not HAS_FACE_RECOGNITION or not HAS_REQUESTS:
        LOG.warning("Thiếu face_recognition hoặc requests: bỏ qua nhận diện khuôn mặt.")
        return []

    backend_url = backend_url or _get_backend_url()
    api_url = backend_url + "/api/health-metrics/face-references"
    refs = []
    try:
        r = requests.get(api_url, timeout=10)
        r.raise_for_status()
        data = r.json()
        payload = data.get("data") if isinstance(data, dict) else None
        items = payload.get("data") if isinstance(payload, dict) else (payload if isinstance(payload, list) else [])
        if not isinstance(items, list):
            items = []
    except Exception as e:
        LOG.warning("Không lấy được face-references từ Backend (%s): %s", api_url, e)
        return []

    for item in items:
        full_url = item.get("image_full_url") or (backend_url + (item.get("face_image_url") or "").lstrip("/"))
        name = (item.get("elderly_name") or "").strip() or "N/A"
        profile_id = item.get("id") or item.get("user_id")
        try:
            img_r = requests.get(full_url, timeout=5)
            img_r.raise_for_status()
            arr = np.frombuffer(img_r.content, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            if img is None:
                LOG.warning("Không decode được ảnh: %s", full_url)
                continue
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            locs = face_recognition.face_locations(img_rgb)
            if not locs:
                LOG.warning("Không tìm thấy khuôn mặt trong ảnh: %s", full_url)
                continue
            encodings = face_recognition.face_encodings(img_rgb, locs)
            if not encodings:
                continue
            refs.append((name, profile_id, encodings[0]))
            LOG.info("Đã thêm tham chiếu: %s (id=%s)", name, profile_id)
        except Exception as e:
            LOG.warning("Lỗi xử lý ảnh %s: %s", full_url, e)
    return refs


def match_faces_in_image(image_rgb, reference_encodings, tolerance=0.65):
    """
    image_rgb: numpy (H,W,3) RGB.
    reference_encodings: list of (elderly_name, profile_id, encoding) từ load_face_references.
    Trả về list of FaceMatch(bbox_xyxy, name, profile_id) cho mỗi khuôn mặt trong ảnh được nhận diện.
    """
    if not HAS_FACE_RECOGNITION or not reference_encodings:
        return []

    try:
        locs = face_recognition.face_locations(image_rgb)
        if not locs:
            return []
        encodings = face_recognition.face_encodings(image_rgb, locs)
        if len(encodings) != len(locs):
            return []
    except Exception as e:
        LOG.debug("face_locations/encodings lỗi: %s", e)
        return []

    results = []
    for (top, right, bottom, left), enc in zip(locs, encodings):
        name = None
        profile_id = None
        best_dist = float("inf")
        for ref_name, ref_id, ref_enc in reference_encodings:
            dist = face_recognition.face_distance([ref_enc], enc)[0]
            if dist < best_dist and dist <= tolerance:
                best_dist = dist
                name = ref_name
                profile_id = ref_id
        bbox_xyxy = (left, top, right, bottom)
        if name:
            results.append(FaceMatch(bbox_xyxy=bbox_xyxy, name=name, profile_id=profile_id))
        else:
            results.append(FaceMatch(bbox_xyxy=bbox_xyxy, name="", profile_id=None))
    return results


def assign_names_to_predictions(preds, face_matches, xy_scale=1.0):
    """
    Gán tên (từ face_matches) cho từng pose trong preds bằng cách map face bbox với pose bbox.
    preds: list of annotation objects có .data (keypoints).
    face_matches: list of FaceMatch.
    xy_scale: scale của ảnh so với keypoints.
    Trả về list[str]: texts[i] là tên cho preds[i], rỗng nếu không khớp.
    """
    if np is None or not preds:
        return [""] * len(preds) if preds else []
    if not face_matches:
        return [""] * len(preds)

    # Lấy bbox (x_min, y_min, x_max, y_max) và center cho từng pose từ keypoints
    def bbox_and_center(ann):
        kps = getattr(ann, "data", None)
        if kps is None or not len(kps):
            return None, None
        xs = kps[:, 0] * xy_scale
        ys = kps[:, 1] * xy_scale
        vs = kps[:, 2]
        valid = vs > 0
        if not np.any(valid):
            return None, None
        x_min, x_max = float(np.min(xs[valid])), float(np.max(xs[valid]))
        y_min, y_max = float(np.min(ys[valid])), float(np.max(ys[valid]))
        cx = (x_min + x_max) / 2
        cy = (y_min + y_max) / 2
        return (x_min, y_min, x_max, y_max), (cx, cy)

    pose_bboxes = []
    pose_centers = []
    for ann in preds:
        bbox, center = bbox_and_center(ann)
        pose_bboxes.append(bbox)
        pose_centers.append(center)

    # Với mỗi face có tên, tìm pose gần nhất (face center nằm trong pose bbox hoặc khoảng cách min)
    texts = [""] * len(preds)
    used_pose = set()
    for fm in face_matches:
        if not fm.name:
            continue
        left, top, right, bottom = fm.bbox_xyxy
        fx = (left + right) / 2.0
        fy = (top + bottom) / 2.0
        best_i = -1
        best_dist = float("inf")
        for i, (bbox, center) in enumerate(zip(pose_bboxes, pose_centers)):
            if center is None or bbox is None:
                continue
            x_min, y_min, x_max, y_max = bbox
            if x_min <= fx <= x_max and y_min <= fy <= y_max:
                best_i = i
                best_dist = 0
                break
            cx, cy = center
            dist = (fx - cx) ** 2 + (fy - cy) ** 2
            if dist < best_dist:
                best_dist = dist
                best_i = i
        if best_i >= 0 and best_i not in used_pose:
            texts[best_i] = fm.name
            used_pose.add(best_i)
    return texts
