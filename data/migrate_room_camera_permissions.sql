-- Áp dụng lên DB đang chạy (ví dụ data_ecms). Chạy từng khối; bỏ qua nếu cột/constraint đã có.

USE data_ecms;

-- 1) Quyền xem camera cho từng thành viên (HOST luôn xem được — xử lý ở app layer)
ALTER TABLE room_members
  ADD COLUMN can_view_live BOOLEAN NOT NULL DEFAULT TRUE AFTER can_receive_medication_notifications;

-- 2) Liên kết camera với room (bỏ qua nếu đã có cột room_id)
ALTER TABLE cameras
  ADD COLUMN room_id INT NULL AFTER id;

ALTER TABLE cameras
  ADD CONSTRAINT fk_cameras_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE SET NULL;

CREATE INDEX idx_cameras_room_id ON cameras(room_id);
