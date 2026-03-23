"""Không thấy người được giám sát đủ lâu → cảnh báo rời vùng quan sát."""

from __future__ import annotations

import time


class SafeZoneTracker:
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
