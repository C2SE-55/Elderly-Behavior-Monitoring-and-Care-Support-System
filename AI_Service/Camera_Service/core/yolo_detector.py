"""YOLOv8 (Ultralytics) — phát hiện người; không bắt buộc (thiếu ultralytics → trả rỗng)."""

from __future__ import annotations

import logging
import os
from typing import List, Tuple

from . import pipeline_config

LOG = logging.getLogger(__name__)

_model = None

try:
    from ultralytics import YOLO as _YOLO
except ImportError:
    _YOLO = None


def yolo_available() -> bool:
    return _YOLO is not None


def _get_model(weights: str):
    global _model
    if _model is None:
        if _YOLO is None:
            return None
        LOG.info("Đang tải YOLO: %s", weights)
        _model = _YOLO(weights)
    return _model


def _yolo_use_half() -> bool:
    mode = pipeline_config.YOLO_HALF
    if mode in ("0", "false", "no", "off"):
        return False
    try:
        import torch
        if not torch.cuda.is_available():
            return False
    except ImportError:
        return False
    if mode in ("1", "true", "yes", "on"):
        return True
    # auto
    return mode in ("auto", "")


def detect_person_boxes(
    image_rgb,
    *,
    weights: str | None = None,
    conf: float = 0.35,
) -> List[Tuple[int, int, int, int]]:
    if _YOLO is None:
        return []

    w = weights or os.environ.get("YOLO_MODEL", "yolov8n.pt")
    m = _get_model(w)
    if m is None:
        return []

    try:
        kw = dict(
            conf=conf,
            classes=[0],
            verbose=False,
            imgsz=pipeline_config.YOLO_IMGSZ,
        )
        if _yolo_use_half():
            kw["half"] = True
        res = m.predict(image_rgb, **kw)
    except Exception as e:
        LOG.warning("YOLO predict lỗi: %s", e)
        return []

    if not res:
        return []
    r0 = res[0]
    boxes = r0.boxes
    if boxes is None or len(boxes) == 0:
        return []

    out: List[Tuple[int, int, int, int]] = []
    xyxy = boxes.xyxy
    for i in range(len(boxes)):
        x1, y1, x2, y2 = map(int, xyxy[i].tolist())
        out.append((x1, y1, x2, y2))
    return out
