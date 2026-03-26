-- Increase daily_schedules.title length to avoid ER_DATA_TOO_LONG
ALTER TABLE daily_schedules
  MODIFY COLUMN title VARCHAR(255);

