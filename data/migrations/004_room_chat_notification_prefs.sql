USE data_ecms;

CREATE TABLE IF NOT EXISTS room_chat_notification_prefs (
  room_id INT NOT NULL,
  user_id INT NOT NULL,
  chat_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id),
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_room_chat_notif_user ON room_chat_notification_prefs(user_id);
