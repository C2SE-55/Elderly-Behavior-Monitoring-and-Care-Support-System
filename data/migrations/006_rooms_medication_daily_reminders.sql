USE data_ecms;

ALTER TABLE rooms
  ADD COLUMN medication_daily_reminders_enabled TINYINT(1) NOT NULL DEFAULT 1
  COMMENT 'Host: bật nhắc OS lặp hằng ngày cho cả room';

ALTER TABLE rooms
MODIFY COLUMN medication_daily_reminders_enabled TINYINT NOT NULL DEFAULT 1;