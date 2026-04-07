USE data_ecms;

ALTER TABLE medication_logs
  ADD COLUMN acted_by_user_id INT NULL,
  ADD CONSTRAINT fk_medication_logs_acted_by
    FOREIGN KEY (acted_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_medication_logs_acted_by_time ON medication_logs (acted_by_user_id, taken_time);
