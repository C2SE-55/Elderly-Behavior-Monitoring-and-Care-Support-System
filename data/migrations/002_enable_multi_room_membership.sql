USE data_ecms;

-- Cho phép 1 user làm HOST ở nhiều room:
-- bỏ UNIQUE trên rooms.host_user_id nếu đang tồn tại.
SET @rooms_host_unique_idx := (
  SELECT INDEX_NAME
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'rooms'
    AND column_name = 'host_user_id'
    AND NON_UNIQUE = 0
  LIMIT 1
);
SET @sql_drop_rooms_host_unique := IF(
  @rooms_host_unique_idx IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE rooms DROP INDEX ', @rooms_host_unique_idx)
);
PREPARE stmt_drop_rooms_host_unique FROM @sql_drop_rooms_host_unique;
EXECUTE stmt_drop_rooms_host_unique;
DEALLOCATE PREPARE stmt_drop_rooms_host_unique;

-- Cho phép 1 user tham gia nhiều room:
-- bỏ UNIQUE toàn cục trên room_members.user_id nếu đang tồn tại.
SET @room_members_user_unique_idx := (
  SELECT INDEX_NAME
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'room_members'
    AND column_name = 'user_id'
    AND NON_UNIQUE = 0
    AND INDEX_NAME <> 'PRIMARY'
  LIMIT 1
);
SET @sql_drop_room_members_user_unique := IF(
  @room_members_user_unique_idx IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE room_members DROP INDEX ', @room_members_user_unique_idx)
);
PREPARE stmt_drop_room_members_user_unique FROM @sql_drop_room_members_user_unique;
EXECUTE stmt_drop_room_members_user_unique;
DEALLOCATE PREPARE stmt_drop_room_members_user_unique;
