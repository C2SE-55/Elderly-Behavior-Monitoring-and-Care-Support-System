"""
Fall detection: chỉ đếm khi đứng/đi (thẳng) rồi chuyển sang nằm im trên sàn/bề mặt phẳng.
Tránh bắt sai khi đang đứng.
"""
import math
import logging
from collections import OrderedDict, deque

LOG = logging.getLogger(__name__)

STANDING = 0
WALKING = 1
LYING = 2

# Nằm: bbox nằm ngang. Đứng: h_ > w_ nên dùng 1.1 tránh nhầm đứng (đứng thường h_ rõ > w_)
LYING_ASPECT = 1.1       # w_ >= 1.1*h_ coi là nằm (pose khi nằm đôi khi chỉ ~1.1)
LYING_STABLE_FRAMES = 1  # 1 frame nằm là đủ (để bắt kịp khi pose mất nhanh)
UPRIGHT_MIN_FRAMES = 1   # thấy đứng/đi ít nhất 1 frame là chấp nhận "đi xong nằm"
HISTORY_SECONDS = 2.0
MOVEMENT_RATIO = 0.06    # FPS thấp: ít di chuyển cũng coi là có đi
CLEARLY_LYING_ASPECT = 1.15  # w_ >= 1.15*h_ = rõ nằm (nới để bắt sớm hơn)
MIN_HISTORY_FOR_LYING_ONLY = 3  # 3 frame rồi rõ nằm → đếm 1 lần (đã nằm sẵn / FPS thấp)
COOLDOWN_FRAMES = 90
# Đơn giản: chỉ đếm té khi người ở phần dưới khung (gần sàn), tránh bắt nhầm nằm giường
FLOOR_Y_RATIO = 0.55  # tâm bbox phải >= 55% chiều cao ảnh (y tăng xuống dưới)


class FallDetector:
    def __init__(self):
        # ID -> (state, state_frames, positions_deque, last_bbox, cooldown_until_frame)
        self._per_id = OrderedDict()
        self.falls = OrderedDict()

    def _get_state(self, w_, h_):
        if w_ >= LYING_ASPECT * h_:
            return LYING
        return WALKING if h_ >= w_ else STANDING  # h_ >= w_ => đứng/đi

    def _had_recent_movement(self, positions, diag_ref):
        if not positions or len(positions) < 2 or diag_ref < 1e-6:
            return False
        total = 0.0
        for i in range(1, len(positions)):
            dx = positions[i][0] - positions[i - 1][0]
            dy = positions[i][1] - positions[i - 1][1]
            total += math.sqrt(dx * dx + dy * dy)
        return total >= MOVEMENT_RATIO * diag_ref

    def update(self, persons, framecount, fps, frame_height=None, y_inverted=False):
        self.falls = OrderedDict()
        fps_safe = max(1, int(fps or 1))
        history_len = max(10, int(HISTORY_SECONDS * fps))

        for ID, (x, y, x_, y_, w_, h_) in persons.items():
            diag = math.sqrt(w_ * w_ + h_ * h_)
            state = self._get_state(w_, h_)

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

            # Đếm té khi: nằm ổn định VÀ (đi xong nằm hoặc rõ nằm) VÀ (nếu có frame_height: người ở phần dưới ảnh = gần sàn)
            if state == LYING and rec["state_frames"] >= LYING_STABLE_FRAMES:
                on_floor = True
                if frame_height is not None and frame_height > 0:
                    center_y = y_ + h_ / 2.0
                    # matplotlib imshow thường y đảo: đáy ảnh = y nhỏ → y_inverted=True
                    if y_inverted:
                        on_floor = center_y <= (1.0 - FLOOR_Y_RATIO) * frame_height
                    else:
                        on_floor = center_y >= FLOOR_Y_RATIO * frame_height
                if not on_floor:
                    continue
                pos_list = list(rec["positions"])
                had_movement = self._had_recent_movement(pos_list, diag)
                was_upright_long_enough = rec.get("upright_frames_before_fall", 0) >= UPRIGHT_MIN_FRAMES
                clearly_lying = w_ >= CLEARLY_LYING_ASPECT * h_
                enough_history = len(pos_list) >= MIN_HISTORY_FOR_LYING_ONLY
                if (had_movement and was_upright_long_enough) or (clearly_lying and enough_history):
                    self.falls[ID] = (x_, y_, w_, h_)
                    rec["cooldown_until"] = framecount + COOLDOWN_FRAMES
                    LOG.info("FALL DETECTED (state machine): ID=%s", ID)

        # Dọn ID không còn trong persons (giới hạn size dict)
        current_ids = set(persons.keys())
        for id_ in list(self._per_id.keys()):
            if id_ not in current_ids:
                del self._per_id[id_]

        return self.falls
