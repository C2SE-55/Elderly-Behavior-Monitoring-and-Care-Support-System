"""Vùng an toàn: polygon normalized + theo dõi có người trong vùng."""

from __future__ import annotations

import time
from typing import List, Optional, Sequence, Tuple


def parse_polygon(raw: str) -> List[Tuple[float, float]]:
    """Parse 'x,y;x,y;...' → danh sách điểm [0..1]."""
    if not raw or not str(raw).strip():
        return []
    pts = []
    for token in str(raw).strip().split(";"):
        token = token.strip()
        if not token:
            continue
        parts = token.split(",")
        if len(parts) != 2:
            continue
        try:
            x = float(parts[0].strip())
            y = float(parts[1].strip())
            pts.append((max(0.0, min(1.0, x)), max(0.0, min(1.0, y))))
        except ValueError:
            continue
    return pts if len(pts) >= 3 else []


def default_supervisor_zone() -> List[Tuple[float, float]]:
    """Hình chữ nhật mặc định (gần full khung), bo viền rõ."""
    m = 0.06
    return [
        (m, m),
        (1.0 - m, m),
        (1.0 - m, 1.0 - m),
        (m, 1.0 - m),
    ]


def point_in_polygon(px: float, py: float, polygon: Sequence[Tuple[float, float]]) -> bool:
    """Ray casting; tọa độ normalized cùng hệ với ảnh (x trái→phải, y trên→dưới)."""
    if not polygon or len(polygon) < 3:
        return True
    inside = False
    n = len(polygon)
    for i in range(n):
        x1, y1 = polygon[i]
        x2, y2 = polygon[(i + 1) % n]
        if (y1 > py) != (y2 > py):
            xinters = (x2 - x1) * (py - y1) / (y2 - y1 + 1e-9) + x1
            if px < xinters:
                inside = not inside
    return inside


class ZoneOccupancyTracker:
    """Không thấy người trong vùng đủ lâu → báo."""

    def __init__(self, empty_seconds: float = 3.0):
        self.empty_seconds = max(0.5, float(empty_seconds))
        self._last_seen_in_zone = time.time()

    def update(self, person_in_zone: bool) -> None:
        if person_in_zone:
            self._last_seen_in_zone = time.time()

    def is_empty_long_enough(self) -> bool:
        return (time.time() - self._last_seen_in_zone) >= self.empty_seconds


class SafeZoneTracker:
    """Không thấy người được giám sát đủ lâu → cảnh báo rời vùng quan sát (legacy face)."""

    def __init__(
        self,
        out_seconds: float = 12.0,
        alert_cooldown: float = 30.0,
    ):
        self.out_seconds = max(1.0, out_seconds)
        self.alert_cooldown = max(1.0, alert_cooldown)
        self._last_seen_target = time.time()
        self._last_alert = 0.0

    def mark_target_seen(self) -> None:
        self._last_seen_target = time.time()

    def seconds_since_target(self) -> float:
        return time.time() - self._last_seen_target

    def is_out_of_zone(self) -> bool:
        return self.seconds_since_target() >= self.out_seconds

    def should_emit_alert(self) -> bool:
        if not self.is_out_of_zone():
            return False
        now = time.time()
        if now - self._last_alert < self.alert_cooldown:
            return False
        self._last_alert = now
        return True
