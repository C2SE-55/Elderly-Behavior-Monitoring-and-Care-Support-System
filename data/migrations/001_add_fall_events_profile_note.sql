-- Bổ sung cột profile_id, note và mở rộng image_url/video_url cho bảng fall_events.
-- Chạy từng lệnh một; nếu báo "Duplicate column name" thì cột đã có, bỏ qua lệnh đó.

ALTER TABLE fall_events ADD COLUMN profile_id INT NULL COMMENT 'Người được chăm sóc (health_profiles)' AFTER camera_id;
ALTER TABLE fall_events ADD CONSTRAINT fk_fall_events_profile FOREIGN KEY (profile_id) REFERENCES health_profiles(id) ON DELETE SET NULL;

ALTER TABLE fall_events ADD COLUMN note TEXT NULL COMMENT 'Ghi chú thêm' AFTER severity_level;

ALTER TABLE fall_events MODIFY COLUMN image_url VARCHAR(500) NULL;
ALTER TABLE fall_events MODIFY COLUMN video_url VARCHAR(500) NULL;
