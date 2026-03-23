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


def lying_hint_from_keypoints(kps) -> bool:
    """True nếu spread ngang đủ hoặc đoạn vai–hông nằm ngang trong khung."""
    if kps is None:
        return False
    arr = np.asarray(kps)
    if arr.ndim != 2 or arr.shape[1] < 3:
        return False
    if pipeline_config.FALL_USE_KEYPOINT_SPREAD:
        wk, hk = keypoint_span_wh(arr)
        if wk is not None and hk is not None and hk > 1e-6:
            if wk >= pipeline_config.FALL_KP_LYING_ASPECT * hk:
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

    def _get_state(self, w_: float, h_: float, lying_hint: bool) -> int:
        if h_ > 1e-6 and w_ >= LYING_ASPECT * h_:
            return LYING
        if lying_hint:
            return LYING
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
            state = self._get_state(w_, h_, lying_hint)

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
                clearly_lying = clearly_bbox or lying_hint
                enough_history = len(pos_list) >= MIN_HISTORY_FOR_LYING_ONLY
                stable_lying = (
                    rec["state_frames"] >= STABLE_LYING_FALL_FRAMES
                    and len(pos_list) >= STABLE_LYING_FALL_FRAMES
                )
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
