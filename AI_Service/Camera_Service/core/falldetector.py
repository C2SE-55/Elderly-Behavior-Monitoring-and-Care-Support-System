"""
Phát hiện té: bbox + spread keypoint + heuristic vai–hông (torso nằm ngang trong khung).
Mặc định không bắt buộc “gần sàn” (FALL_REQUIRE_FLOOR=0). Cấu hình: pipeline_config FALL_*.
"""
from __future__ import annotations

import logging
import math
from collections import OrderedDict, deque
from typing import Any, List, Optional, Tuple

import numpy as np

from . import pipeline_config

LOG = logging.getLogger(__name__)

STANDING = 0
WALKING = 1
LYING = 2

LYING_STABLE_FRAMES = 1
UPRIGHT_MIN_FRAMES = 1
HISTORY_SECONDS = 2.0

LYING_ASPECT = pipeline_config.FALL_LYING_ASPECT
MOVEMENT_RATIO = pipeline_config.FALL_MOVEMENT_RATIO
CLEARLY_LYING_ASPECT = pipeline_config.FALL_CLEARLY_LYING_ASPECT
MIN_HISTORY_FOR_LYING_ONLY = pipeline_config.FALL_MIN_HISTORY_FRAMES
COOLDOWN_FRAMES = pipeline_config.FALL_COOLDOWN_FRAMES
FLOOR_Y_RATIO = pipeline_config.FALL_FLOOR_Y_RATIO
STABLE_LYING_FALL_FRAMES = pipeline_config.FALL_STABLE_LYING_FRAMES


def keypoint_span_wh(kps: np.ndarray) -> Tuple[Optional[float], Optional[float]]:
    """Khoảng rộng/cao của các keypoint có confidence > 0 (không dùng joint_scales)."""
    if kps is None or len(kps) < 3:
        return None, None
    m = kps[:, 2] > 0
    if np.count_nonzero(m) < 3:
        return None, None
    xs = kps[m, 0]
    ys = kps[m, 1]
    return float(np.max(xs) - np.min(xs)), float(np.max(ys) - np.min(ys))


def torso_shoulder_hip_horizontal(kps: np.ndarray) -> bool:
    """COCO 0-based: vai 5,6 — hông 11,12. dx lớn so với dy → thân nằm ngang trong ảnh."""
    if not pipeline_config.FALL_USE_TORSO or kps is None or len(kps) < 13:
        return False
    for i in (5, 6, 11, 12):
        if kps[i, 2] <= 0:
            return False
    sx = 0.5 * (float(kps[5, 0]) + float(kps[6, 0]))
    sy = 0.5 * (float(kps[5, 1]) + float(kps[6, 1]))
    hx = 0.5 * (float(kps[11, 0]) + float(kps[12, 0]))
    hy = 0.5 * (float(kps[11, 1]) + float(kps[12, 1]))
    dx = abs(sx - hx)
    dy = abs(sy - hy) + 1e-6
    return dx >= pipeline_config.FALL_TORSO_MIN_RATIO * dy


def _visible_kp_count(arr: np.ndarray) -> int:
    if arr is None or arr.ndim != 2 or arr.shape[1] < 3:
        return 0
    return int(np.count_nonzero(arr[:, 2] > 0))


def slumped_seated_hint(kps: np.ndarray) -> bool:
    """Té ngồi / sụp: vai–hông thấp trong khung keypoint, thân nghiêng hoặc đầu không cao hơn vai."""
    if not pipeline_config.FALL_USE_SLUMPED_HINT or kps is None or len(kps) < 13:
        return False
    for i in (5, 6, 11, 12):
        if kps[i, 2] <= 0:
            return False
    ys = kps[kps[:, 2] > 0, 1]
    if ys.size < 4:
        return False
    y_min = float(np.min(ys))
    y_max = float(np.max(ys))
    span = y_max - y_min
    if span < max(40.0, float(pipeline_config.FALL_KP_MIN_SPAN_H) * 0.55):
        return False
    sy = 0.5 * (float(kps[5, 1]) + float(kps[6, 1]))
    hy = 0.5 * (float(kps[11, 1]) + float(kps[12, 1]))
    torso_mid = 0.5 * (sy + hy)
    floor_band = y_min + pipeline_config.FALL_SLUMP_TORSO_Y_RATIO * span
    if torso_mid < floor_band:
        return False
    sx = 0.5 * (float(kps[5, 0]) + float(kps[6, 0]))
    hx = 0.5 * (float(kps[11, 0]) + float(kps[12, 0]))
    dx = abs(sx - hx)
    dy = abs(sy - hy) + 1e-6
    tilted = dx >= pipeline_config.FALL_SLUMP_TORSO_MIN_RATIO * dy
    head_low = False
    if kps[0, 2] > 0:
        head_low = float(kps[0, 1]) >= sy - max(12.0, 0.08 * span)
    return tilted or head_low


def min_lying_bbox_aspect(kps) -> float:
    """Ngưỡng w/h bbox cho fallback — thấp hơn khi slumped (bbox pose vẫn dọc)."""
    if kps is None:
        return float(pipeline_config.FALL_CLEARLY_LYING_ASPECT)
    if slumped_seated_hint(np.asarray(kps)):
        return float(pipeline_config.FALL_SLUMP_BBOX_ASPECT)
    return float(pipeline_config.FALL_CLEARLY_LYING_ASPECT)


def legs_suggest_standing(kps: np.ndarray) -> bool:
    """Gối/mắt cá nằm rõ phía dưới hông (trục y ảnh tăng xuống) → thường là đứng/cúi, không phải nằm ngang."""
    if not pipeline_config.FALL_LEG_VETO or kps is None or len(kps) < 17:
        return False
    hip_y = []
    for i in (11, 12):
        if kps[i, 2] > 0:
            hip_y.append(float(kps[i, 1]))
    if not hip_y:
        return False
    hip_mid = float(np.mean(hip_y))
    ys = kps[:, 1][kps[:, 2] > 0]
    span_y = float(np.max(ys) - np.min(ys)) if ys.size > 1 else 80.0
    margin = max(18.0, 0.07 * span_y)

    def y_below_hip(idx: int) -> bool:
        if kps[idx, 2] <= 0:
            return False
        return float(kps[idx, 1]) > hip_mid + margin

    below = sum(1 for i in (13, 14, 15, 16) if y_below_hip(i))
    if below >= 2:
        return True
    # Một chân đủ dài: đầu gối rồi mắt cá cùng phía, cả hai dưới hông
    for knee, ankle in ((13, 15), (14, 16)):
        if kps[knee, 2] <= 0 or kps[ankle, 2] <= 0:
            continue
        ky, ay = float(kps[knee, 1]), float(kps[ankle, 1])
        if ay > ky > hip_mid + margin * 0.5:
            return True
    return False


def lying_hint_from_keypoints(kps) -> bool:
    """True nếu spread ngang đủ hoặc đoạn vai–hông nằm ngang (trừ trường hợp cúi có chân đứng)."""
    if kps is None:
        return False
    arr = np.asarray(kps)
    if arr.ndim != 2 or arr.shape[1] < 3:
        return False

    wk, hk = keypoint_span_wh(arr)
    keypoints_look_horizontal = False
    if wk is not None and hk is not None and hk > 1e-6 and wk >= 1.02 * hk:
        keypoints_look_horizontal = True

    # Cúi/đứng: chân dưới hông nhưng bbox kéo dọc — chặn FP. Không chặn té ngồi/sụp trên sàn.
    if legs_suggest_standing(arr) and not keypoints_look_horizontal:
        if not (
            pipeline_config.FALL_LEG_VETO_RESPECT_SLUMP
            and slumped_seated_hint(arr)
        ):
            return False

    if slumped_seated_hint(arr):
        return True

    if pipeline_config.FALL_USE_KEYPOINT_SPREAD:
        if _visible_kp_count(arr) >= pipeline_config.FALL_KP_MIN_COUNT_SPREAD:
            if wk is not None and hk is not None and hk > 1e-6:
                min_h = max(8.0, float(pipeline_config.FALL_KP_MIN_SPAN_H))
                if hk >= min_h and wk >= pipeline_config.FALL_KP_LYING_ASPECT * hk:
                    return True
    if torso_shoulder_hip_horizontal(arr):
        return True
    return False


def match_annotation_for_centroid(px: float, py: float, annotations: List[Any]) -> Any:
    if not annotations:
        return None
    best = None
    best_d = 1e18
    for ann in annotations:
        xb, yb, wb, hb = ann.bbox()
        cx = xb + wb / 2.0
        cy = yb + hb / 2.0
        d = (cx - px) ** 2 + (cy - py) ** 2
        if d < best_d:
            best_d = d
            best = ann
    return best


class FallDetector:
    def __init__(self):
        self._per_id = OrderedDict()
        self.falls = OrderedDict()

    @staticmethod
    def _center_in_floor_band(cy: float, frame_height: float, y_inverted: bool) -> bool:
        """Tâm bbox nằm thấp trong khung (gần sàn) — tách FP ‘chỉ lại gần cam’ (đứng vẫn h>w, không qua aspect nằm)."""
        fh = frame_height
        if fh is None or fh <= 0:
            return True
        r = max(0.15, min(0.92, float(pipeline_config.FALL_BBOX_BOTTOM_MIN_RATIO)))
        if not y_inverted:
            return cy >= r * fh
        return cy <= (1.0 - r) * fh

    def _get_state(
        self,
        w_: float,
        h_: float,
        lying_hint: bool,
        frame_height: Optional[float],
        y_inverted: bool,
        y_top: float,
        y_bottom: float,
    ) -> int:
        # 1) Khung xương / spread / torso
        if lying_hint:
            return LYING
        # 2) Bbox pose nằm ngang rõ + tâm thấp: bắt lúc nằm mà mất keypoint (không dùng mỗi “bbox to” khi đứng)
        if (
            pipeline_config.FALL_USE_HORIZONTAL_FLOOR_HINT
            and frame_height is not None
            and frame_height > 0
            and h_ > 1e-6
            and w_ >= pipeline_config.FALL_HORIZONTAL_FLOOR_ASPECT * h_
        ):
            cy = 0.5 * (float(y_top) + float(y_bottom))
            if self._center_in_floor_band(cy, float(frame_height), y_inverted):
                return LYING
        # 3) Tùy chọn cũ: aspect bbox pose mọi chỗ (dễ FP)
        if pipeline_config.FALL_USE_POSE_BBOX_ASPECT and h_ > 1e-6 and w_ >= LYING_ASPECT * h_:
            return LYING
        # Đứng/đi: bbox cao hơn rộng (scale-invariant, không phụ thuộc khoảng cách như “diện tích” thuần)
        return WALKING if h_ >= w_ else STANDING

    def _had_recent_movement(self, positions, diag_ref):
        if not positions or len(positions) < 2 or diag_ref < 1e-6:
            return False
        total = 0.0
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i - 1][0]
            dy = positions[i][1] - positions[i - 1][1]
            total += math.sqrt(dx * dx + dy * dy)
        return total >= MOVEMENT_RATIO * diag_ref

    def _on_floor(self, center_y: float, frame_height: float, y_inverted: bool) -> bool:
        if not pipeline_config.FALL_REQUIRE_FLOOR:
            return True
        if frame_height is None or frame_height <= 0:
            return True
        if y_inverted:
            return center_y <= (1.0 - FLOOR_Y_RATIO) * frame_height
        return center_y >= FLOOR_Y_RATIO * frame_height

    def update(
        self,
        persons,
        framecount,
        fps,
        frame_height=None,
        y_inverted=False,
        annotations=None,
    ):
        self.falls = OrderedDict()
        history_len = max(10, int(HISTORY_SECONDS * (fps or 1)))
        ann_list = list(annotations) if annotations is not None else []

        for ID, (x, y, x_, y_, w_, h_) in persons.items():
            ann = match_annotation_for_centroid(float(x), float(y), ann_list)
            lying_hint = False
            if ann is not None and hasattr(ann, "data"):
                lying_hint = lying_hint_from_keypoints(ann.data)

            diag = math.sqrt(w_ * w_ + h_ * h_)
            y_top = float(y_)
            y_bottom = float(y_ + h_)
            state = self._get_state(
                w_, h_, lying_hint, frame_height, y_inverted, y_top, y_bottom
            )

            if ID not in self._per_id:
                self._per_id[ID] = {
                    "state": state,
                    "state_frames": 1,
                    "positions": deque(maxlen=history_len),
                    "last_bbox": (x_, y_, w_, h_),
                    "cooldown_until": -1,
                    "upright_frames": 0,
                    "upright_frames_before_fall": 0,
                }
            rec = self._per_id[ID]
            rec["positions"].append((x, y))
            rec["last_bbox"] = (x_, y_, w_, h_)

            if rec["cooldown_until"] >= 0 and framecount <= rec["cooldown_until"]:
                if state == LYING:
                    rec["state"] = LYING
                    rec["state_frames"] = rec["state_frames"] + 1 if rec["state"] == LYING else 1
                    self.falls[ID] = (x_, y_, w_, h_)
                continue

            prev_state = rec["state"]
            if state == rec["state"]:
                rec["state_frames"] += 1
            else:
                if state == LYING and (prev_state == STANDING or prev_state == WALKING):
                    rec["upright_frames_before_fall"] = rec.get("upright_frames", 0)
                rec["state"] = state
                rec["state_frames"] = 1

            if state == STANDING or state == WALKING:
                rec["upright_frames"] = rec.get("upright_frames", 0) + 1
            else:
                rec["upright_frames"] = 0

            if state == LYING and rec["state_frames"] >= LYING_STABLE_FRAMES:
                center_y = y_ + h_ / 2.0
                fh = frame_height if frame_height is not None else None
                if fh is not None and fh > 0 and not self._on_floor(center_y, float(fh), y_inverted):
                    continue

                pos_list = list(rec["positions"])
                had_movement = self._had_recent_movement(pos_list, diag)
                was_upright_long_enough = rec.get("upright_frames_before_fall", 0) >= UPRIGHT_MIN_FRAMES
                clearly_bbox = h_ > 1e-6 and w_ >= CLEARLY_LYING_ASPECT * h_
                slumped = (
                    ann is not None
                    and hasattr(ann, "data")
                    and slumped_seated_hint(np.asarray(ann.data))
                )
                clearly_lying = clearly_bbox or lying_hint or slumped
                enough_history = len(pos_list) >= MIN_HISTORY_FOR_LYING_ONLY
                stable_lying = (
                    rec["state_frames"] >= STABLE_LYING_FALL_FRAMES
                    and len(pos_list) >= STABLE_LYING_FALL_FRAMES
                )
                # Chỉ geometry (bbox ngang+sàn), không có keypoint: bắt buộc đã từng đứng/đi + có chuyển động — tránh mở cam thấy người nằm sẵn / nhầm khung to
                if not lying_hint:
                    if rec["state_frames"] < pipeline_config.FALL_GEOMETRY_LYING_MIN_FRAMES:
                        continue
                    if not (had_movement and was_upright_long_enough):
                        continue
                if (
                    (had_movement and was_upright_long_enough)
                    or (clearly_lying and enough_history)
                    or stable_lying
                ):
                    self.falls[ID] = (x_, y_, w_, h_)
                    rec["cooldown_until"] = framecount + COOLDOWN_FRAMES
                    LOG.info("FALL DETECTED (state machine): ID=%s", ID)

        current_ids = set(persons.keys())
        for id_ in list(self._per_id.keys()):
            if id_ not in current_ids:
                del self._per_id[id_]

        return self.falls
